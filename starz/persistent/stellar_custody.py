"""Orbital custody and safe destinations, inside the existing universe transaction."""
from copy import deepcopy
from math import floor, isfinite
from uuid import uuid5

from sqlalchemy import or_, select

from ..db import models as m
from ..db.store import epoch, load, utc
from ..progression import level
from ..simulation import Engine
from .combat import fleet_units, local_defenders
from .combat_rules import STELLAR_RULES
from .stellar import MODULE_KINDS, _order, _request, identifier, require

# Experimental D08 intermediate profile; no production balance claim.
PROFILE = 'experimental-custody-v1'
STABILIZATION_SECONDS = 86400
CLAIM_SECONDS = 86400
REBUILD_SECONDS = 86400
RELIC_SECONDS = 3600
SALVAGE_FRACTION = .25
ACTIVE = ('pending', 'offered', 'working', 'transit', 'returning')
ACTIONS = ('claim', 'conquer', 'offer', 'accept', 'cancel', 'rebuild', 'repatriate', 'withdraw', 'decommission')
MILITARY_ROLES = ('escort', 'defense', 'line_combat', 'power_projection', 'capital', 'carrier_operations', 'command')


def _unit(session, empire, unit_id):
    row = session.get(m.StellarUnit, identifier(unit_id))
    require(row is not None and row.universe_id == empire.universe_id, 'Núcleo indisponível.')
    return row


def _operation(session, empire, operation_id):
    op = session.get(m.StellarOperation, identifier(operation_id))
    require(op is not None and op.universe_id == empire.universe_id and
            empire.id in (op.actor_id, op.recipient_id), 'Operação de custódia não autorizada.')
    return op


def _anchor(session, row):
    planet = session.get(m.Planet, row.planet_id) if row.planet_id else None
    require(planet is not None and planet.system_id == row.system_id,
            'Custódia em espaço profundo ou trânsito indisponível.')
    system = session.get(m.StarSystem, planet.system_id)
    require(system is not None and system.universe_id == row.universe_id, 'Âncora fora do universo.')
    return planet


def _presence(session, empire, engine, row):
    planet = _anchor(session, row)
    require(planet.empire_id == empire.id and str(planet.id) == engine.state.planet_id,
            'Custódia exige órbita do planeta próprio selecionado.')
    ships = [ship for ship in local_defenders(engine, str(planet.id))
             if engine.catalog.get('ships', ship['hull_id']).role in MILITARY_ROLES]
    require(any(unit['hp'] > 0 and unit['damage'] > 0 for unit in fleet_units(engine, ships)),
            'Custódia exige naves militares locais operacionais.')
    return planet


def contested(store, session, empire, engine, row):
    """Only actual, combat-capable hostile exceptional units at this exact orbit count."""
    for rival in session.scalars(select(m.StellarUnit).where(
            m.StellarUnit.universe_id == row.universe_id, m.StellarUnit.planet_id == row.planet_id,
            m.StellarUnit.system_id == row.system_id, m.StellarUnit.empire_id != empire.id,
            m.StellarUnit.state.in_(('operational', 'damaged')))):
        p = rival.payload
        if (rival.id != row.id and p.get('hp', 0) > 0 and
            all(p.get('subsystems', {}).get(k, 0) > 0 for k in ('containment', 'control', 'weapons')) and
            store.relation(session, empire.id, rival.empire_id)['status'] == 'war'):
            return True
    return False


def _custodian(row, empire):
    require(row.custodian_empire_id == empire.id, 'Custódia confirmada necessária.')


def _stable(row, now):
    defeated_at = row.payload.get('defeated_at')
    require(type(defeated_at) in (int, float) and isfinite(defeated_at) and
            now >= defeated_at + STABILIZATION_SECONDS, 'Núcleo ainda em estabilização.')


def _free(session, row):
    require(not row.payload.get('active_order_id'), 'Unidade possui operação militar ativa.')
    require(session.scalar(select(m.StellarOperation.id).where(
        m.StellarOperation.unit_id == row.id, m.StellarOperation.status.in_(ACTIVE)).limit(1)) is None,
        'Núcleo possui operação de custódia incompatível.')


def _view(op):
    return {'operation_id': str(op.id), 'unit_id': str(op.unit_id), 'kind': op.kind, 'status': op.status,
            'complete_at': epoch(op.due_at), 'profile': PROFILE}


def record_effect(session, op, event_key, effect, payload, now):
    """One durable provenance record per effect; caller applies the effect only on True."""
    identity = uuid5(op.unit_id, 'custody-ledger:' + event_key)
    prior = session.get(m.StellarLedger, identity)
    if prior is not None:
        require(prior.operation_id == op.id and prior.effect == effect and prior.payload == payload,
                'Efeito de custódia conflitante.')
        return False
    session.add(m.StellarLedger(id=identity, universe_id=op.universe_id, source_id=op.source_id,
        unit_id=op.unit_id, operation_id=op.id, actor_id=op.actor_id, event_key=event_key,
        effect=effect, payload=deepcopy(payload), created_at=utc(now)))
    return True


def _terminal(session, op, status, now, reason):
    op.status, op.completed_at = status, utc(now)
    record_effect(session, op, str(op.id) + ':terminal', status, {'reason': reason}, now)


def _modules(session, empire, engine, module_ids, kinds, planet_id):
    require(isinstance(module_ids, list) and len(module_ids) == len(kinds) and
            len(set(module_ids)) == len(module_ids), 'Manifesto de módulos inválido.')
    result = [session.get(m.StellarModule, identifier(key)) for key in module_ids]
    require(all(module is not None and module.empire_id == empire.id and
                module.universe_id == empire.universe_id and module.status == 'ready' and
                module.current_planet_id == planet_id and module.operation_id is None
                for module in result), 'Módulos precisam estar prontos no planeta autorizado.')
    require(sorted(module.kind for module in result) == sorted(kinds), 'Tipos de módulos incompatíveis.')
    return result


def _reserve_modules(op, modules, now):
    for module in modules:
        module.operation_id, module.status, module.updated_at = op.id, 'committed', utc(now)


def _release_modules(session, op, now):
    for module in session.scalars(select(m.StellarModule).where(m.StellarModule.operation_id == op.id)):
        require(module.status == 'committed', 'Módulo já consumido não pode ser devolvido.')
        require(module.current_planet_id is not None and module.fleet_id is None,
                'Módulo em transporte exige retorno físico.')
        module.operation_id, module.status, module.updated_at = None, 'ready', utc(now)


def _consume_modules(session, op, now):
    modules = list(session.scalars(select(m.StellarModule).where(m.StellarModule.operation_id == op.id)))
    require(len(modules) == 5 and sorted(module.kind for module in modules) == sorted(MODULE_KINDS),
            'Reconstrução sem cinco módulos físicos.')
    for module in modules:
        require(module.status == 'committed' and module.current_planet_id == op.planet_id,
                'Módulo de reconstrução fora do local.')
        record_effect(session, op, str(op.id) + ':module:' + str(module.id), 'consume_module',
                      {'module_id': str(module.id), 'manufacture_order_id': str(module.manufacture_order_id)}, now)
        module.status, module.current_planet_id, module.updated_at = 'consumed', None, utc(now)


def _peace(store, session, actor, recipient):
    require(actor != recipient and store.relation(session, actor, recipient)['status'] != 'war'
            and store.relation(session, recipient, actor)['status'] != 'war', 'Cessão exige dois impérios fora de guerra.')


def _new_operation(session, order_id, empire, row, action, now, payload, recipient=None, duration=None):
    op = m.StellarOperation(id=uuid5(order_id, 'custody'), universe_id=empire.universe_id,
        source_id=row.source_id, unit_id=row.id, actor_id=empire.id, recipient_id=recipient,
        kind=action, status='offered' if action == 'offer' else 'pending',
        system_id=row.system_id, planet_id=row.planet_id, custody_version=row.custody_version,
        payload=deepcopy(payload), created_at=utc(now),
        due_at=utc(now + duration) if duration is not None else None, completed_at=None)
    session.add(op)
    session.flush()
    return op


def _custody_commit(session, op, row, recipient, now):
    previous = str(row.custodian_empire_id) if row.custodian_empire_id else None
    record_effect(session, op, str(op.id) + ':custody', 'custody',
                  {'previous': previous, 'current': str(recipient)}, now)
    row.custodian_empire_id = recipient
    row.custody_version += 1
    p = deepcopy(row.payload)
    p.pop('withdrawal_grant', None)
    if op.kind == 'offer':
        p['withdrawal_grant'] = {'recipient_id': str(recipient), 'sender_id': str(op.actor_id),
                                 'planet_id': str(op.planet_id), 'custody_version': row.custody_version}
    row.payload = p
    _terminal(session, op, 'completed', now, 'custody_confirmed')


def command(store, session, empire, e, data):
    action = data.get('action')
    require(action in ACTIONS, 'Ação de custódia desconhecida.')
    unit_id = identifier(data['unit_id'])
    module_ids = [str(identifier(key)) for key in data.get('module_ids', [])]
    ship_ids = [str(identifier(key)) for key in data.get('ship_ids', [])]
    require(len(set(module_ids)) == len(module_ids) and len(set(ship_ids)) == len(ship_ids), 'Manifesto duplicado.')
    recipient_id = identifier(data['recipient_id']) if data.get('recipient_id') else None
    operation_id = identifier(data['operation_id']) if data.get('operation_id') else None
    request_data = {'unit_id': str(unit_id), 'module_ids': sorted(module_ids), 'ship_ids': sorted(ship_ids),
                    'recipient_id': str(recipient_id) if recipient_id else None,
                    'operation_id': str(operation_id) if operation_id else None,
                    'planet_id': e.state.planet_id}
    order_id, request, prior = _request(session, empire, str(data['idempotency_key']), 'custody:' + action, request_data)
    if prior:
        return deepcopy(prior.payload['result'])
    row = _unit(session, empire, unit_id)
    now = e.state.last_updated
    if action in ('accept', 'cancel'):
        require(operation_id is not None, 'Informe a operação de custódia.')
        op = _operation(session, empire, operation_id)
        require(op.unit_id == row.id and op.status in ACTIVE, 'Operação encerrada ou núcleo incorreto.')
        if action == 'accept':
            require(op.kind == 'offer' and op.recipient_id == empire.id and op.status == 'offered', 'Oferta não recebida.')
            require(row.state == 'sealed_wreck' and row.custodian_empire_id == op.actor_id and
                    row.custody_version == op.custody_version and row.system_id == op.system_id and
                    row.planet_id == op.planet_id and not row.payload.get('active_order_id'), 'Oferta ficou desatualizada.')
            _anchor(session, row)
            _peace(store, session, op.actor_id, empire.id)
            require(not contested(store, session, empire, e, row), 'Órbita em disputa.')
            _custody_commit(session, op, row, empire.id, now)
        else:
            require(op.actor_id == empire.id, 'Somente o autor pode cancelar a operação.')
            if op.status in ('transit', 'returning'):
                require(op.kind in ('withdraw', 'repatriate'), 'Operação não admite recall.')
                if op.status != 'returning':
                    require(op.payload.get('fleet_id'), 'Transporte sem frota.')
                    store.recall(session, empire, e, op.payload['fleet_id'])
                    op.status = 'returning'
                result = _view(op)
                _order(session, empire, order_id, request, result)
                return result
            _release_modules(session, op, now)
            if row.state == 'rebuilding':
                row.state = 'sealed_wreck'
            _terminal(session, op, 'cancelled', now, 'cancelled_before_consumption')
        result = _view(op)
        _order(session, empire, order_id, request, result)
        return result
    require(row.state == 'sealed_wreck', 'Operação exige núcleo selado não terminal.')
    _anchor(session, row)
    _free(session, row)
    payload = {'module_ids': module_ids, 'profile': PROFILE}
    modules = []
    duration = None
    if action in ('claim', 'conquer'):
        _presence(session, empire, e, row)
        _stable(row, now)
        if action == 'claim':
            require(row.custodian_empire_id is None, 'Custódia existente exige nova conquista.')
        else:
            require(row.custodian_empire_id is not None and row.custodian_empire_id != empire.id,
                    'Conquista exige custodiante adversário.')
            require(store.relation(session, empire.id, row.custodian_empire_id)['status'] == 'war',
                    'Conquista exige guerra com o custodiante.')
        duration = CLAIM_SECONDS
    elif action == 'offer':
        _custodian(row, empire)
        require(recipient_id is not None, 'Informe destinatário.')
        recipient = session.get(m.Empire, recipient_id)
        require(recipient is not None and recipient.universe_id == empire.universe_id, 'Destinatário fora do universo.')
        _peace(store, session, empire.id, recipient_id)
        require(not contested(store, session, empire, e, row), 'Órbita em disputa.')
    else:
        _custodian(row, empire)
        if action != 'withdraw':
            local = _local_engine(session, empire, e, row.planet_id) if action == 'repatriate' else e
            _presence(session, empire, local, row)
        require(not contested(store, session, empire, e, row), 'Órbita em disputa.')
        if action == 'rebuild':
            from .stellar import PHASES
            keys = {key for _, gates in PHASES for key in gates} | {'precision_manufacturing', 'extreme_materials'}
            require(all(level(e.state, key) >= 1 for key in keys), 'Pesquisas de reconstrução incompletas.')
            modules = _modules(session, empire, e, module_ids, MODULE_KINDS, row.planet_id)
            duration = REBUILD_SECONDS
        elif action in ('repatriate', 'withdraw'):
            require(all(level(e.state, key) >= 1 for key in
                        ('mobile_stellar_confinement', 'gravitational_propulsion', 'stellar_logistics')),
                    'Pesquisas de transporte do núcleo incompletas.')
            departure = session.get(m.Planet, identifier(e.state.planet_id))
            require(departure is not None and departure.empire_id == empire.id, 'Transporte parte de colônia própria.')
            require(ship_ids, 'Transporte exige naves próprias reais.')
            modules = _modules(session, empire, e, module_ids, ('propulsion',), departure.id)
            if action == 'withdraw':
                payload['destination_planet_id'] = str(departure.id)
                source_planet = _anchor(session, row)
                if source_planet.empire_id == empire.id:
                    _presence(session, empire, _local_engine(session, empire, e, row.planet_id), row)
                else:
                    grant = row.payload.get('withdrawal_grant', {})
                    require(grant.get('recipient_id') == str(empire.id) and
                            grant.get('sender_id') == str(source_planet.empire_id) and
                            grant.get('planet_id') == str(row.planet_id) and
                            grant.get('custody_version') == row.custody_version,
                            'Retirada estrangeira exige autorização específica de cessão.')
                    _peace(store, session, empire.id, source_planet.empire_id)
        elif action == 'decommission':
            duration = RELIC_SECONDS
    op = _new_operation(session, order_id, empire, row, action, now, payload, recipient_id, duration)
    if modules:
        _reserve_modules(op, modules, now)
    if action == 'rebuild':
        row.state = 'rebuilding'
        op.status = 'working'
    if action in ('repatriate', 'withdraw'):
        from . import stellar_transport
        destination = session.get(m.Planet, identifier(e.state.planet_id)) if action == 'withdraw' else None
        fleet = stellar_transport.dispatch(store, session, empire, e, op, row, ship_ids, module_ids, destination)
        result = {**_view(op), 'fleet': fleet}
        _order(session, empire, order_id, request, result)
    else:
        result = _view(op)
        _order(session, empire, order_id, request, result,
               kind='stellar_custody' if duration is not None else 'stellar_action', due_at=op.due_at,
               operation_id=str(op.id))
    session.flush()
    return result


def _local_engine(session, empire, engine, planet_id):
    if engine.state.planet_id == str(planet_id):
        return engine
    return Engine(engine.catalog, load(session, empire, planet_id=planet_id, catalog=engine.catalog))


def _salvage(session, op, row, engine, now):
    # Recovery is bounded by the actually paid original modules, once per unique core.
    prior = session.scalar(select(m.StellarLedger.id).where(m.StellarLedger.unit_id == row.id,
                                                          m.StellarLedger.event_key == 'salvage'))
    if prior is not None:
        return
    recovered = {}
    for module in session.scalars(select(m.StellarModule).where(
            m.StellarModule.project_id == row.project_id, m.StellarModule.status == 'consumed')):
        paid = session.get(m.UniverseOrder, module.manufacture_order_id)
        require(paid is not None and paid.kind == 'stellar_module', 'Proveniência industrial ausente.')
        for key, amount in paid.payload.get('cost', {}).items():
            require(key in engine.catalog.items['resources'] and type(amount) in (int, float)
                    and isfinite(amount) and amount > 0, 'Custo industrial inválido.')
            recovered[key] = recovered.get(key, 0) + amount
    recovered = {key: floor(value * SALVAGE_FRACTION) for key, value in recovered.items()}
    if record_effect(session, op, 'salvage', 'material_recovery', {'resources': recovered,
                     'planet_id': engine.state.planet_id, 'fraction': SALVAGE_FRACTION}, now):
        for key, value in recovered.items():
            engine.state.stocks[key] = engine.state.stocks.get(key, 0) + value


def complete(store, session, order, engines):
    if order.kind != 'stellar_custody':
        return False
    if order.payload.get('applied'):
        return True
    op = session.get(m.StellarOperation, identifier(order.payload['operation_id']))
    require(op is not None and op.universe_id == order.universe_id and op.actor_id == order.empire_id,
            'Evento de custódia inconsistente.')
    if op.status not in ACTIVE:
        order.payload = {**order.payload, 'applied': True}
        return True
    empire = session.get(m.Empire, op.actor_id)
    row = _unit(session, empire, op.unit_id)
    e = engines.get(str(empire.id))
    require(e is not None and op.due_at is not None and e.state.last_updated >= epoch(op.due_at),
            'Operação de custódia ainda não venceu.')
    now = e.state.last_updated
    local = e
    expected = 'rebuilding' if op.kind == 'rebuild' else 'sealed_wreck'
    valid = row.state == expected and row.custody_version == op.custody_version and (
        row.planet_id, row.system_id) == (op.planet_id, op.system_id)
    reason = 'location_or_custody_changed'
    try:
        local = _local_engine(session, empire, e, op.planet_id)
        _presence(session, empire, local, row)
        if contested(store, session, empire, local, row):
            valid, reason = False, 'contested'
        if op.kind == 'conquer':
            valid = valid and row.custodian_empire_id is not None and store.relation(
                session, empire.id, row.custodian_empire_id)['status'] == 'war'
        elif op.kind == 'claim':
            valid = valid and row.custodian_empire_id is None
        else:
            valid = valid and row.custodian_empire_id == empire.id
    except (ValueError, TypeError):
        valid, reason = False, 'presence_or_authorization_lost'
    if not valid:
        _release_modules(session, op, now)
        if row.state == 'rebuilding':
            row.state = 'sealed_wreck'
        _terminal(session, op, 'contested' if reason == 'contested' else 'failed', now, reason)
    elif op.kind in ('claim', 'conquer'):
        _custody_commit(session, op, row, empire.id, now)
    elif op.kind == 'rebuild':
        _consume_modules(session, op, now)
        row.empire_id = empire.id
        row.state = 'operational'
        p = deepcopy(row.payload)
        p.update(hp=STELLAR_RULES['structural_hp'], shield=STELLAR_RULES['shield_capacity'],
                 subsystems=dict.fromkeys(MODULE_KINDS, STELLAR_RULES['subsystem_hp']), energy=0, energy_at=now)
        for key in ('defeated_at', 'active_order_id', 'active_action'):
            p.pop(key, None)
        row.payload = p
        row.custody_version += 1
        _terminal(session, op, 'completed', now, 'same_unit_rebuilt')
    elif op.kind == 'decommission':
        _salvage(session, op, row, local, now)
        row.state = 'sealed_relic'
        row.payload = {**row.payload, 'hp': 0, 'shield': 0, 'energy': 0, 'energy_at': now,
                       'active_order_id': None, 'active_action': None}
        _terminal(session, op, 'completed', now, 'sealed_relic')
        store.save(session, empire.id, local)
        session.flush()
        engines[str(empire.id)] = Engine(e.catalog, load(session, empire, catalog=e.catalog))
    else:
        require(False, 'Tipo de evento de custódia inválido.')
    order.payload = {**order.payload, 'applied': True, 'completion': op.status}
    session.flush()
    return True


def unit_views(session, empire, engine):
    result = []
    own_orbits = select(m.Planet.id).where(m.Planet.empire_id == empire.id)
    for row in session.scalars(select(m.StellarUnit).where(m.StellarUnit.universe_id == empire.universe_id,
            or_(m.StellarUnit.empire_id == empire.id, m.StellarUnit.custodian_empire_id == empire.id,
                m.StellarUnit.planet_id.in_(own_orbits)))
            .order_by(m.StellarUnit.created_at, m.StellarUnit.id)):
        item = {'id': str(row.id), 'source_id': str(row.source_id), 'system_id': str(row.system_id),
                'planet_id': str(row.planet_id) if row.planet_id else None, 'state': row.state}
        if row.state in ('operational', 'damaged', 'incapacitated', 'transit') and row.empire_id == empire.id:
            from .stargrave import unit_view
            item = unit_view(row, engine.state.last_updated)
        elif row.custodian_empire_id == empire.id:
            item.update(stocks=dict(row.stocks), custody_version=row.custody_version,
                        custodian_empire_id=str(empire.id),
                        integrity={key: deepcopy(row.payload[key]) for key in
                                   ('hp', 'shield', 'subsystems', 'defeated_at') if key in row.payload})
        controller = False
        planet = session.get(m.Planet, row.planet_id) if row.planet_id else None
        if planet is not None and planet.empire_id == empire.id:
            try:
                _presence(session, empire, _local_engine(session, empire, engine, planet.id), row)
                controller = True
            except (ValueError, TypeError):
                pass
        item['roles'] = {
            'operational_owner': row.empire_id == empire.id and row.state in
                                 ('operational', 'damaged', 'incapacitated', 'transit'),
            'historical_owner': row.payload.get('original_owner_id') == str(empire.id),
            'custodian': row.custodian_empire_id == empire.id,
            'controller': controller,
        }
        item['requires_server_validation'] = True
        result.append(item)
    return result


def snapshot(session, empire, e):
    operations = []
    for op in session.scalars(select(m.StellarOperation).where(m.StellarOperation.universe_id == empire.universe_id,
            or_(m.StellarOperation.actor_id == empire.id, m.StellarOperation.recipient_id == empire.id))
            .order_by(m.StellarOperation.created_at, m.StellarOperation.id)):
        operations.append({**_view(op), 'actor_id': str(op.actor_id),
                           'recipient_id': str(op.recipient_id) if op.recipient_id else None})
    return {'units': unit_views(session, empire, e), 'operations': operations, 'profile': PROFILE,
            'experimental': True, 'stabilization_seconds': STABILIZATION_SECONDS,
            'claim_seconds': CLAIM_SECONDS, 'rebuild_seconds': REBUILD_SECONDS,
            'relic_seconds': RELIC_SECONDS, 'salvage_fraction': SALVAGE_FRACTION}
