"""Physical sealed-core pickup, delivery and return on native paid fleet missions."""
from copy import deepcopy
from math import ceil, isfinite
from uuid import uuid5

from sqlalchemy import select

from ..db import models as m
from ..db.store import epoch, utc
from ..data import DataValidationError
from ..progression import effect, level
from ..travel import preview_travel
from .stellar import MODULE_CARGO, identifier, require

# Experimental cargo/mass, independent of the native ships towing the core.
PROFILE = 'experimental-core-transport-v1'
CORE_CARGO = 100
CORE_MASS = 250
MISSIONS = ('CORE_PICKUP', 'CORE_TRANSPORT', 'CORE_RETURN')


def fleet_locked(session, empire, fleetid):
    """Held carriers cannot be reused by ordinary dispatch or recall."""
    return any(op.actor_id == empire.id and op.universe_id == empire.universe_id
               and op.status == 'returning' and op.payload.get('fleet_id') == str(fleetid)
               and bool(op.payload.get('held_reason'))
               for op in session.scalars(select(m.StellarOperation).where(
                   m.StellarOperation.actor_id == empire.id,
                   m.StellarOperation.universe_id == empire.universe_id,
                   m.StellarOperation.status == 'returning',
                   m.StellarOperation.payload['fleet_id'].astext == str(fleetid))))


def _context(session, empire, operation_id):
    op = session.get(m.StellarOperation, identifier(operation_id))
    require(op is not None and op.actor_id == empire.id and op.universe_id == empire.universe_id
            and op.kind in ('repatriate', 'withdraw'), 'Transporte não autorizado.')
    core = session.get(m.StellarUnit, op.unit_id)
    require(core is not None and core.universe_id == op.universe_id and core.source_id == op.source_id,
            'Identidade do núcleo inconsistente.')
    return op, core


def _system(session, identity, universe):
    row = session.get(m.StarSystem, identity)
    require(row is not None and row.universe_id == universe, 'Sistema fora do universo.')
    return row


def _planet(session, identity, universe, owner=None):
    row = session.get(m.Planet, identifier(identity))
    require(row is not None, 'Planeta físico inexistente.')
    system = _system(session, row.system_id, universe)
    require(owner is None or row.empire_id == owner, 'Planeta não pertence ao império autorizado.')
    return row, system


def _stocks(core, engine):
    require(isinstance(core.stocks, dict) and all(
        key in engine.catalog.items['resources'] or key in engine.catalog.items['fuels'] for key in core.stocks),
        'Estoque físico do núcleo inválido.')
    require(all(type(n) in (int, float) and isfinite(n) and n >= 0 for n in core.stocks.values()),
            'Carga do núcleo deve ser finita e não negativa.')
    return sum(core.stocks.values())


def _ships(engine, identities):
    require(isinstance(identities, list) and 0 < len(identities) <= 100
            and len(set(identities)) == len(identities), 'Selecione naves únicas para o rebocador.')
    by_id = {s['id']: s for s in engine.state.ships}
    require(all(key in by_id for key in identities), 'Nave de transporte não pertence ao império.')
    ships = [by_id[key] for key in identities]
    require(all(s['ready_at'] <= engine.state.last_updated and
                engine.state.universe.get('ship_health', {}).get(s['id'], 1) > 0 for s in ships),
            'Nave de transporte não está operacional.')
    require(len({(s['propulsion_id'], s['fuel_id']) for s in ships}) == 1,
            'Rebocadores exigem propulsão e combustível comuns.')
    return ships


def _quote(engine, ships, origin, destination, mass=0):
    capacities = [engine.catalog.get('ships', s['hull_id']).cargo_capacity for s in ships]
    total_capacity = sum(capacities)
    require(not mass or total_capacity > 0, 'Frota sem espaço para carga física.')
    quotes = [preview_travel(engine.catalog, tuple(origin), tuple(destination),
              {**s, 'mass': s['mass'] + (mass*capacity/total_capacity if total_capacity else 0)},
              s['propulsion_id'], 'NORMAL', intra_system=True)
              for s, capacity in zip(ships, capacities)]
    return {'origin': list(origin), 'destination': list(destination),
            'duration': max(1, ceil(max(q['eta_seconds'] for q in quotes)/(1+effect(engine.catalog, engine.state, 'speed')))),
            'fuel': ceil(sum(q['fuel_cost'] for q in quotes)/(1+effect(engine.catalog, engine.state, 'fuel')))}


def _pickup_authority(core, op, pickup, empire):
    require(core.state == 'sealed_wreck' and core.custodian_empire_id == empire.id
            and core.custody_version == op.custody_version
            and (core.system_id, core.planet_id) == (op.system_id, op.planet_id),
            'Custódia ou âncora do núcleo mudou.')
    if pickup.empire_id == empire.id:
        return
    grant = core.payload.get('withdrawal_grant', {})
    require(op.kind == 'withdraw' and grant.get('recipient_id') == str(empire.id)
            and grant.get('sender_id') == str(pickup.empire_id)
            and grant.get('planet_id') == str(pickup.id)
            and grant.get('custody_version') == core.custody_version,
            'Retirada estrangeira exige cessão e autorização específicas deste núcleo.')


def prepare(session, empire, e, data):
    """Read-only native-dispatch plan; parent validates busy fleets and pays once."""
    op, core = _context(session, empire, data['operation_id'])
    require(op.status == 'pending' and not op.payload.get('fleet_id'), 'Transporte já lançado ou encerrado.')
    require(all(level(e.state, key) >= 1 for key in
                ('mobile_stellar_confinement', 'gravitational_propulsion', 'stellar_logistics')),
            'Pesquisas de transporte do núcleo incompletas.')
    origin, origin_system = _planet(session, e.state.planet_id, empire.universe_id, empire.id)
    pickup, pickup_system = _planet(session, op.planet_id, empire.universe_id)
    _pickup_authority(core, op, pickup, empire)
    require(pickup.system_id == op.system_id, 'Âncora de coleta inconsistente.')
    source = session.get(m.StellarSource, core.source_id)
    require(source is not None and source.universe_id == empire.universe_id and source.removed_at is not None,
            'Estrela original não está confinada.')
    if op.kind == 'withdraw':
        destination, destination_system = _planet(session, op.payload['destination_planet_id'], empire.universe_id, empire.id)
        destination_id = str(destination.id)
    else:
        require(pickup.empire_id == empire.id, 'Repatriação deve coletar núcleo em planeta próprio.')
        destination_system = _system(session, source.origin_system_id, empire.universe_id)
        destination_id = None
    ids = data['ship_ids']
    ships = _ships(e, ids)
    from .service import busy, locate
    require(all(not busy(e, ship) and locate(e, ship) == (origin_system.x, origin_system.y) for ship in ships),
            'Rebocadores precisam estar na colônia de partida.')
    module_ids = op.payload.get('module_ids', [])
    require(len(module_ids) == 1, 'Transporte exige um módulo de propulsão físico.')
    tug = session.get(m.StellarModule, identifier(module_ids[0]))
    require(tug is not None and tug.kind == 'propulsion' and tug.empire_id == empire.id
            and tug.universe_id == empire.universe_id and tug.operation_id == op.id
            and tug.status == 'committed' and tug.current_planet_id == origin.id and tug.fleet_id is None,
            'Módulo de rebocador não está reservado nesta colônia.')
    cargo = _stocks(core, e)
    capacity = sum(e.catalog.get('ships', s['hull_id']).cargo_capacity for s in ships)*(1+effect(e.catalog, e.state, 'cargo'))
    require(capacity >= max(MODULE_CARGO, CORE_CARGO+cargo), 'Capacidade insuficiente para núcleo e estoques reais.')
    origin_xy, pickup_xy, destination_xy = ([origin_system.x, origin_system.y],
        [pickup_system.x, pickup_system.y], [destination_system.x, destination_system.y])
    first = _quote(e, ships, origin_xy, pickup_xy, MODULE_CARGO)
    second = _quote(e, ships, pickup_xy, destination_xy, CORE_MASS+cargo)
    third = ({'origin': destination_xy, 'destination': origin_xy, 'duration': 0, 'fuel': 0}
             if destination_id == str(origin.id) else _quote(e, ships, destination_xy, origin_xy))
    loaded_home = _quote(e, ships, pickup_xy, origin_xy, CORE_MASS+cargo)
    # Recall may backtrack the loaded leg before towing the core to the origin colony.
    reserve = max(second['fuel']+third['fuel'], 2*second['fuel']+loaded_home['fuel'], first['fuel'])
    total = first['fuel']+reserve
    fuel_id = ships[0]['fuel_id']
    require(e.state.stocks.get(fuel_id, 0) >= total, 'Combustível real insuficiente para rota e retorno do núcleo.')
    return {'profile': PROFILE, 'operation_id': str(op.id), 'core_id': str(core.id), 'tug_id': str(tug.id),
            'ship_ids': list(ids), 'origin_planet_id': str(origin.id), 'origin_system_id': str(origin.system_id),
            'pickup_planet_id': str(pickup.id),
            'pickup_system_id': str(pickup.system_id), 'destination_planet_id': destination_id,
            'destination_system_id': str(destination_system.id), 'coords': pickup_xy,
            'origin': origin_xy, 'destination': destination_xy, 'leg1': first, 'leg2': second, 'leg3': third,
            'loaded_home': loaded_home, 'total_fuel': total, 'reserve': reserve, 'fuel_id': fuel_id,
            'fuel_before': e.state.stocks[fuel_id], 'capacity_cargo': CORE_CARGO+cargo,
            'core_stocks': deepcopy(core.stocks), 'cargo_capacity': capacity}


def dispatch(store, session, empire, e, operation, unit, ship_ids, module_ids, destination_planet=None):
    require(operation.unit_id == unit.id and list(operation.payload.get('module_ids', [])) == list(module_ids),
            'Manifesto de transporte inconsistente.')
    if destination_planet is not None:
        require(operation.payload.get('destination_planet_id') == str(destination_planet.id), 'Destino de retirada inconsistente.')
    return store.dispatch(session, empire, e, {'mission': 'CORE_PICKUP', 'operation_id': str(operation.id),
        'ship_ids': list(ship_ids), 'x': 0, 'y': 0, 'target_planet_id': None, 'cargo': {}})


def launch(session, empire, e, plan, fleet, order):
    op, core = _context(session, empire, plan['operation_id'])
    require(op.status == 'pending' and order.kind == 'mission' and order.empire_id == empire.id
            and order.universe_id == empire.universe_id and order.payload.get('mission') == 'CORE_PICKUP'
            and set(fleet['ship_ids']) == set(plan['ship_ids']) and fleet['status'] == 'TRANSIT',
            'Lançamento físico do núcleo inconsistente.')
    require(e.state.stocks[plan['fuel_id']] == plan['fuel_before']-plan['total_fuel']
            and fleet['fuel_reserve'] == plan['reserve'], 'Rota deve ser paga exatamente uma vez.')
    tug = session.get(m.StellarModule, identifier(plan['tug_id']))
    require(tug is not None and tug.status == 'committed' and tug.operation_id == op.id,
            'Rebocador já utilizado.')
    tug.status, tug.current_planet_id, tug.fleet_id = 'transit', None, identifier(fleet['id'])
    tug.updated_at = utc(e.state.last_updated)
    op.status, op.due_at = 'transit', order.due_at
    op.payload = {**op.payload, 'transport': deepcopy(plan), 'fleet_id': fleet['id'], 'pickup_order_id': str(order.id)}
    order.payload = {**order.payload, 'operation_id': str(op.id), 'core_picked_up': False}
    _record(session, op, 'launch', 'fuel_reserved', {'fuel_id': plan['fuel_id'], 'amount': plan['total_fuel'],
            'origin_planet_id': plan['origin_planet_id'], 'fleet_id': fleet['id']}, e.state.last_updated)


def _record(session, op, suffix, effect_name, payload, now):
    from .stellar_custody import record_effect
    return record_effect(session, op, str(op.id)+':transport:'+suffix, effect_name, payload, now)


def _arrived(e, fleet, coords):
    require(fleet['status'] == 'ARRIVED' and [fleet['x'], fleet['y']] == coords,
            'Frota ainda não chegou à âncora física.')


def _queue(session, empire, e, op, prior, fleet, quote, mission, **extra):
    require(fleet['fuel_reserve'] >= quote['fuel'], 'Reserva física de retorno insuficiente.')
    now = e.state.last_updated
    identity = uuid5(prior.id, mission+':'+extra.get('return_stage', 'delivery'))
    require(session.get(m.UniverseOrder, identity) is None, 'Etapa de transporte já criada.')
    fleet.update(status='TRANSIT', mission='MOVE', destination_x=quote['destination'][0],
                 destination_y=quote['destination'][1], departure_at=now, arrival_at=now+quote['duration'],
                 fuel_reserve=fleet['fuel_reserve']-quote['fuel'], fuel_cost=quote['fuel'])
    e.state.universe.setdefault('fleet_planets', {})[fleet['id']] = None
    payload = {**deepcopy(prior.payload), 'mission': mission, 'target': None, 'cargo': {},
               'duration': quote['duration'], 'fuel': quote['fuel'], 'operation_id': str(op.id), **extra}
    payload.pop('applied', None)
    order = m.UniverseOrder(id=identity, universe_id=empire.universe_id, empire_id=empire.id,
        kind='mission', payload=payload, due_at=utc(fleet['arrival_at']), resolved=False)
    session.add(order)
    op.due_at = order.due_at
    _record(session, op, 'leg:'+str(identity), 'fuel_spent', {'amount': quote['fuel'], 'mission': mission}, now)
    return order


def _end(session, op, status, now):
    op.status, op.completed_at = status, utc(now)
    _record(session, op, 'terminal', status, {}, now)


def _safe_return(session, empire, e, op, order, fleet, core, picked, system_id, reason, *, require_route=False):
    """Choose an affordable owned anchor from the actual arrival, otherwise hold."""
    system = _system(session, identifier(system_id), empire.universe_id)
    require([system.x, system.y] == [fleet['x'], fleet['y']], 'Local físico do transporte inconsistente.')
    plan = op.payload['transport']
    held_reason = 'no_reachable_owned_anchor'
    try:
        ships = _ships(e, fleet['ship_ids'])
        cargo = _stocks(core, e) if picked else 0
        capacity = sum(e.catalog.get('ships', s['hull_id']).cargo_capacity for s in ships)*(1+effect(e.catalog, e.state, 'cargo'))
        require(capacity >= (CORE_CARGO+cargo if picked else MODULE_CARGO), 'Capacidade de retorno insuficiente.')
    except DataValidationError:
        held_reason = 'carrier_unavailable'
        ships = []

    def candidate(planet):
        if planet is None or planet.empire_id != empire.id:
            return None
        destination = session.get(m.StarSystem, planet.system_id)
        if destination is None or destination.universe_id != empire.universe_id:
            return None
        quote = _quote(e, ships, [fleet['x'],fleet['y']], [destination.x,destination.y],
                       CORE_MASS+cargo if picked else MODULE_CARGO)
        return (planet, quote) if quote['fuel'] <= fleet['fuel_reserve'] else None

    chosen = None
    if ships:
        chosen = candidate(session.get(m.Planet, identifier(plan['origin_planet_id'])))
        if chosen is None:
            alternatives = [value for planet in session.scalars(select(m.Planet).join(m.StarSystem).where(
                m.Planet.empire_id == empire.id, m.StarSystem.universe_id == empire.universe_id))
                if (value := candidate(planet)) is not None]
            chosen = min(alternatives, key=lambda value: (value[1]['fuel'], value[1]['duration'], str(value[0].id)), default=None)
    require(not require_route or chosen is not None, 'Nenhuma âncora própria alcançável com a reserva atual.')
    if picked:
        core.system_id = system.id
    op.status = 'returning'
    op.payload = {**op.payload, 'return_reason': op.payload.get('return_reason', reason)}
    if chosen:
        destination, quote = chosen
        op.payload = {k:v for k,v in op.payload.items() if not k.startswith('held_')}
        return _queue(session, empire, e, op, order, fleet, quote, 'CORE_RETURN',
            core_picked_up=picked, return_stage='home', return_planet_id=str(destination.id),
            return_system_id=str(destination.system_id), return_coords=quote['destination'])
    op.due_at = None
    op.payload = {**op.payload, 'held_reason': held_reason, 'held_at': e.state.last_updated,
                  'held_coords': [fleet['x'],fleet['y']], 'held_system_id': str(system.id),
                  'held_order_id': str(order.id), 'held_core_picked_up': picked}
    e.state.universe.setdefault('fleet_planets', {})[fleet['id']] = None
    _record(session, op, 'held:'+str(order.id), 'held',
            {'reason': held_reason, 'coords': op.payload['held_coords'], 'core_picked_up': picked}, e.state.last_updated)
    return None


def resume_held(store, session, empire, e, op):
    """Explicit custody retry; an unreachable route leaves the hold unchanged."""
    checked, core = _context(session, empire, op.id)
    require(checked.id == op.id and op.status == 'returning' and op.payload.get('held_reason'),
            'Operação não possui transporte retido.')
    fleet = next((f for f in e.state.fleets if f['id'] == op.payload['fleet_id']), None)
    require(fleet is not None, 'Portador físico ausente.')
    _arrived(e, fleet, op.payload['held_coords'])
    picked = op.payload['held_core_picked_up']
    if picked:
        require(core.state == 'core_transit' and core.payload.get('core_fleet_id') == fleet['id']
                and core.custodian_empire_id == empire.id and core.custody_version == op.custody_version,
                'Carga estelar ou custódia inconsistente.')
    prior = session.get(m.UniverseOrder, identifier(op.payload['held_order_id']))
    require(prior is not None and prior.empire_id == empire.id and prior.universe_id == empire.universe_id
            and prior.payload.get('operation_id') == str(op.id), 'Evento de retenção inconsistente.')
    order = _safe_return(session, empire, e, op, prior, fleet, core, picked,
                         op.payload['held_system_id'], op.payload.get('return_reason', 'cancelled'), require_route=True)
    store.save(session, empire.id, e)
    session.flush()
    return {'operation_id': str(op.id), 'fleet_id': fleet['id'], 'arrival_at': epoch(order.due_at)}


def _return_from_pickup(session, empire, e, op, order, fleet, core, picked, reason):
    plan = op.payload['transport']
    return _safe_return(session, empire, e, op, order, fleet, core, picked, plan['pickup_system_id'], reason)


def complete(store, session, order, engines):
    if order.kind != 'mission' or order.payload.get('mission') not in MISSIONS:
        return False
    if order.resolved or order.payload.get('applied'):
        return True
    empire = session.get(m.Empire, order.empire_id)
    require(empire is not None and empire.universe_id == order.universe_id, 'Missão fora do universo.')
    e = engines[str(empire.id)]
    now = e.state.last_updated
    require(order.due_at is not None and now >= epoch(order.due_at), 'Transporte ainda não venceu.')
    op, core = _context(session, empire, order.payload['operation_id'])
    require(op.status in ('transit', 'returning'), 'Operação de transporte não está ativa.')
    plan = op.payload['transport']
    fleet = next((f for f in e.state.fleets if f['id'] == order.payload['fleet_id']), None)
    require(fleet is not None and op.payload['fleet_id'] == fleet['id'], 'Frota de transporte ausente.')
    mission = order.payload['mission']
    if mission == 'CORE_PICKUP':
        _arrived(e, fleet, plan['coords'])
        try:
            pickup, _ = _planet(session, op.planet_id, empire.universe_id)
            _pickup_authority(core, op, pickup, empire)
            from .stellar_custody import contested
            require(not contested(store, session, empire, e, core), 'Órbita de coleta em disputa.')
            if pickup.empire_id != empire.id:
                require(store.relation(session, empire.id, pickup.empire_id)['status'] != 'war', 'Cessão interrompida por guerra.')
            ships = _ships(e, fleet['ship_ids'])
            capacity = sum(e.catalog.get('ships', s['hull_id']).cargo_capacity for s in ships)*(1+effect(e.catalog, e.state, 'cargo'))
            require(core.stocks == plan['core_stocks'] and capacity >= plan['capacity_cargo'], 'Carga ou capacidade mudou durante a coleta.')
        except DataValidationError:
            _return_from_pickup(session, empire, e, op, order, fleet, core, False, 'pickup_authorization_lost')
        else:
            tug = session.get(m.StellarModule, identifier(plan['tug_id']))
            require(tug is not None and tug.status == 'transit' and tug.operation_id == op.id
                    and tug.fleet_id == identifier(fleet['id']), 'Rebocador físico ausente.')
            _record(session, op, 'tug', 'consume_module', {'module_id': str(tug.id)}, now)
            tug.status, tug.fleet_id, tug.current_planet_id = 'consumed', None, None
            tug.updated_at = utc(now)
            core.state, core.planet_id = 'core_transit', None
            core.payload = {**core.payload, 'core_fleet_id': fleet['id'], 'energy': 0,
                            'energy_at': now, 'shield': 0, 'hp': 0}
            _record(session, op, 'pickup', 'core_loaded', {'fleet_id': fleet['id'], 'planet_id': plan['pickup_planet_id']}, now)
            _queue(session, empire, e, op, order, fleet, plan['leg2'], 'CORE_TRANSPORT', core_picked_up=True)
    elif mission == 'CORE_RETURN' and order.payload.get('return_stage') == 'backtrack':
        _arrived(e, fleet, plan['coords'])
        _return_from_pickup(session, empire, e, op, order, fleet, core, True, op.payload.get('return_reason', 'cancelled'))
    else:
        picked = order.payload.get('core_picked_up', False)
        returning = mission == 'CORE_RETURN'
        _arrived(e, fleet, order.payload.get('return_coords', plan['origin']) if returning else plan['destination'])
        if picked:
            require(core.state == 'core_transit' and core.payload.get('core_fleet_id') == fleet['id']
                    and core.custodian_empire_id == empire.id and core.custody_version == op.custody_version,
                    'Carga estelar ou custódia inconsistente.')
        if returning or op.kind == 'withdraw':
            destination_id = order.payload.get('return_planet_id', plan['origin_planet_id']) if returning else plan['destination_planet_id']
            try:
                destination, _ = _planet(session, destination_id, empire.universe_id, empire.id)
            except DataValidationError:
                system_id = (order.payload.get('return_system_id', plan['origin_system_id'])
                             if returning else plan['destination_system_id'])
                _safe_return(session, empire, e, op, order, fleet, core, picked, system_id,
                             'return_anchor_unavailable' if returning else 'destination_unavailable')
                order.payload = {**order.payload, 'applied': True}
                store.save(session, empire.id, e)
                session.flush()
                return True
            if picked:
                core.system_id, core.planet_id, core.state = destination.system_id, destination.id, 'sealed_wreck'
                p = deepcopy(core.payload)
                p.pop('core_fleet_id', None); p.pop('withdrawal_grant', None)
                core.payload = p
            else:
                tug = session.get(m.StellarModule, identifier(plan['tug_id']))
                require(tug is not None and tug.status == 'transit' and tug.operation_id == op.id,
                        'Manifesto de retorno inconsistente.')
                tug.status, tug.fleet_id, tug.current_planet_id, tug.operation_id = 'ready', None, destination.id, None
                tug.updated_at = utc(now)
            e.state.universe.setdefault('fleet_planets', {})[fleet['id']] = str(destination.id)
            _end(session, op, ('cancelled' if op.payload.get('return_reason') == 'cancelled' else 'failed') if returning else 'completed', now)
            if not returning and destination.id != identifier(plan['origin_planet_id']):
                _queue(session, empire, e, op, order, fleet, plan['leg3'], 'RETURN', core_picked_up=False)
        else:
            source = session.get(m.StellarSource, core.source_id)
            require(source is not None and source.universe_id == empire.universe_id
                    and str(source.origin_system_id) == plan['destination_system_id'] and source.removed_at is not None,
                    'Origem imutável da estrela inconsistente.')
            _record(session, op, 'reinstall', 'stellar_reinstalled', {'source_id': str(source.id)}, now)
            source.removed_at = None
            core.state, core.system_id, core.planet_id = 'reinstalled', source.origin_system_id, None
            p = deepcopy(core.payload); p.pop('core_fleet_id', None)
            core.payload = p
            _end(session, op, 'completed', now)
            _queue(session, empire, e, op, order, fleet, plan['leg3'], 'RETURN', core_picked_up=False)
    order.payload = {**order.payload, 'applied': True}
    store.save(session, empire.id, e)
    session.flush()
    return True


def recall(store, session, empire, e, order):
    require(not order.resolved and order.payload.get('mission') in MISSIONS, 'Missão de núcleo não retornável.')
    op, core = _context(session, empire, order.payload['operation_id'])
    require(op.status == 'transit' and order.payload['mission'] != 'CORE_RETURN', 'Retorno do núcleo já comprometido.')
    plan = op.payload['transport']
    fleet = next((f for f in e.state.fleets if f['id'] == order.payload['fleet_id']), None)
    require(fleet is not None and fleet['status'] == 'TRANSIT', 'Frota sem trânsito retornável.')
    elapsed = max(1, ceil(e.state.last_updated-fleet['departure_at']))
    picked = order.payload.get('core_picked_up', False)
    quote = {'origin': [fleet['destination_x'], fleet['destination_y']],
             'destination': plan['coords'] if picked else plan['origin'], 'duration': elapsed,
             'fuel': plan['leg2']['fuel'] if picked else plan['leg1']['fuel']}
    op.status = 'returning'
    op.payload = {**op.payload, 'return_reason': 'cancelled'}
    next_order = _queue(session, empire, e, op, order, fleet, quote, 'CORE_RETURN', core_picked_up=picked,
                        return_stage='backtrack' if picked else 'home')
    order.resolved = True
    store.save(session, empire.id, e)
    return {'operation_id': str(op.id), 'arrival_at': epoch(next_order.due_at), 'core_picked_up': picked}
