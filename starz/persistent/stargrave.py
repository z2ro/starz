"""Exceptional units on real orbital anchors, using the existing combat and settler."""
from copy import deepcopy
from math import ceil, isfinite

from sqlalchemy import select

from ..db import models as m
from ..db.store import load, utc, epoch
from ..progression import level
from ..data import DataValidationError
from ..simulation import Engine
from ..travel import travel_distance, travel_seconds
from .combat_rules import combat_config, experiment_rules, STELLAR_RULES, SUBSYSTEMS, BOMBARD_PREPARATION
from .stellar import identifier, require, _request, _order


def settle_energy(row, now):
    p = deepcopy(row.payload)
    require(isinstance(p.get('subsystems'), dict) and set(p['subsystems']) == set(SUBSYSTEMS)
            and all(type(v) in (int, float) and isfinite(v) and v >= 0
                    for v in (p.get('hp'), p.get('shield'), *p['subsystems'].values())),
            'Integridade estelar inválida.')
    previous = p.get('energy_at', epoch(row.created_at))
    value = p.get('energy', 0)
    require(all(type(v) in (int, float) and isfinite(v) for v in (now, previous, value))
            and now >= previous and 0 <= value <= STELLAR_RULES['energy_capacity'],
            'Reserva energética estelar inválida.')
    if row.state in ('operational', 'damaged', 'transit') and p['hp'] > 0 and all(
            p['subsystems'].get(k, 0) > 0 for k in ('containment', 'control')):
        value = min(STELLAR_RULES['energy_capacity'], value + (now-previous)*STELLAR_RULES['energy_regen'])
    p.update(energy=value, energy_at=now)
    row.payload = p
    return value


def unit_view(row, now):
    settle_energy(row, now)
    return {'id': str(row.id), 'source_id': str(row.source_id), 'project_id': str(row.project_id),
            'system_id': str(row.system_id), 'planet_id': str(row.planet_id) if row.planet_id else None,
            'state': row.state, 'payload': deepcopy(row.payload), 'stocks': dict(row.stocks)}


def capable(snapshot, capability):
    return (snapshot['hp'] > 0 and snapshot.get('state', 'operational') in ('operational', 'damaged')
            and all(snapshot['subsystems'].get(k, 0) > 0
                    for k in ('containment', 'control', capability)))


def spend(snapshot, amount):
    if snapshot['energy'] - amount < STELLAR_RULES['containment_floor']:
        return False
    snapshot['energy'] -= amount
    return True


def prepare_salvo(units):
    for u in units:
        if u['kind'] != 'stellar':
            continue
        if u.get('_shield_active', True):
            u['_shield_charge'] = u['shield']
        u['_shield_active'] = (u['_shield_charge'] > 0 and capable(u, 'shielding')
                               and spend(u, STELLAR_RULES['shield_energy']))
        u['shield'] = u['_shield_charge'] if u['_shield_active'] else 0
        u['damage'] = STELLAR_RULES['weapon_damage'] if capable(u, 'weapons') else 0


def combat_units(rows, engine, now, experiment='intermediate'):
    experiment_rules(experiment)
    result = []
    for row in sorted(rows, key=lambda r: str(r.id)):
        require(row.state in ('operational', 'damaged', 'incapacitated'), 'Unidade não está em combate orbital.')
        settle_energy(row, now)
        p = row.payload
        result.append({'id': str(row.id), 'kind': 'stellar', 'type': 'stargrave', 'class': 'capital',
                       'hp': p['hp'], 'shield': p['shield'], 'subsystems': deepcopy(p['subsystems']),
                       'energy': p['energy'], 'state': row.state, 'damage': STELLAR_RULES['weapon_damage'],
                       'armor': STELLAR_RULES['armor'], 'modifiers': {},
                       '_weapon_energy': STELLAR_RULES['weapon_energy']})
    return result


def apply_result(rows, snapshots, now):
    by_id = {u['id']: u for u in snapshots}
    for row in rows:
        u = by_id[str(row.id)]
        p = deepcopy(row.payload)
        p.update(hp=max(0, u['hp']), shield=max(0, u['shield'] if u.get('_shield_active', True)
                                              else u['_shield_charge']),
                 subsystems=deepcopy(u['subsystems']), energy=u['energy'], energy_at=now)
        if p['hp'] <= 0:
            row.state = 'sealed_wreck'
            p.update(shield=0, energy=0)
            p.setdefault('defeated_at', now)
        elif any(p['subsystems'].get(k, 0) <= 0 for k in ('containment', 'control')):
            row.state = 'incapacitated'
        elif p['hp'] < STELLAR_RULES['structural_hp'] or any(v < STELLAR_RULES['subsystem_hp'] for v in p['subsystems'].values()):
            row.state = 'damaged'
        action = p.get('active_action')
        interrupted = (p['hp'] <= 0 or any(p['subsystems'][k] <= 0 for k in ('control', 'containment'))
                       or action in ('attack', 'bombard') and p['subsystems']['weapons'] <= 0)
        if p.get('active_order_id') and interrupted:
            p['cancelled_operations'] = [*p.get('cancelled_operations', []), p['active_order_id']]
            p.update(active_order_id=None, active_action=None)
        row.payload = p


def orbital_units(session, empire, e, planetid):
    planet = session.get(m.Planet, identifier(planetid))
    require(planet is not None, 'Âncora orbital inexistente.')
    return list(session.scalars(select(m.StellarUnit).where(
        m.StellarUnit.universe_id == empire.universe_id, m.StellarUnit.empire_id == empire.id,
        m.StellarUnit.system_id == planet.system_id, m.StellarUnit.planet_id == planet.id,
        m.StellarUnit.state.in_(('operational', 'damaged', 'incapacitated'))).order_by(m.StellarUnit.id)))


def orbital_target(session, empire, e, planetid, unitid):
    row = session.get(m.StellarUnit, identifier(unitid))
    planet = session.get(m.Planet, identifier(planetid))
    system = session.get(m.StarSystem, planet.system_id) if planet else None
    require(row is not None and planet is not None and system is not None
            and system.universe_id == empire.universe_id and row.universe_id == empire.universe_id
            and row.empire_id != empire.id and row.planet_id == planet.id and row.system_id == planet.system_id
            and row.state in ('operational', 'damaged', 'incapacitated') and row.payload['hp'] > 0,
            'Alvo estelar indisponível nesta órbita.')
    parties = sorted((str(empire.id), str(row.empire_id)))
    war = any(o.payload.get('parties') == parties and o.payload.get('status') == 'war'
              for o in session.scalars(select(m.UniverseOrder).where(
                  m.UniverseOrder.universe_id == empire.universe_id, m.UniverseOrder.kind == 'diplomacy')))
    require(war, 'Ataque orbital exige guerra com o proprietário da unidade.')
    return row


def authorize_aim(session, empire, e, targetplanet_id, unitID, subsystem):
    require(subsystem in SUBSYSTEMS and level(e.state, 'containment_warfare') >= 1,
            'Ataque dirigido exige Guerra de Contenção e subsistema válido.')
    row = orbital_target(session, empire, e, targetplanet_id, unitID)
    planet = session.get(m.Planet, identifier(targetplanet_id))
    require(row is not None and planet is not None and row.universe_id == empire.universe_id
            and row.planet_id == planet.id and row.system_id == planet.system_id
            and row.empire_id != empire.id
            and row.state in ('operational', 'damaged', 'incapacitated') and row.payload['hp'] > 0,
            'Alvo estelar indisponível nesta órbita.')
    now = e.state.last_updated
    known = any(r.get('planet_id') == str(planet.id) and r.get('at', now+1) <= now < r.get('expires_at', 0)
                and r.get('stellar_units', {}).get('status') == 'CONFIRMED'
                and str(row.id) in r['stellar_units'].get('value', {})
                and subsystem in r['stellar_units']['value'][str(row.id)].get('subsystems', {})
                for r in e.state.universe.get('intelligence', []))
    require(known, 'Ataque dirigido exige inteligência atual confirmada desta Stargrave.')
    if subsystem == 'containment':
        require(row.payload['shield'] <= 0 and any(row.payload['subsystems'][k] < STELLAR_RULES['subsystem_hp']
                for k in SUBSYSTEMS if k != 'containment'), 'Contenção ainda protegida.')
    return {'target_stellar_id': str(row.id), 'target_subsystem': subsystem}


def resolve_planet_battle(store, session, order, e, ships, target_engine, targetplanet):
    from .combat import resolve_battle
    owner = session.get(m.Empire, targetplanet.empire_id)
    rows = orbital_units(session, owner, target_engine, targetplanet.id)
    snapshots = combat_units(rows, target_engine, e.state.last_updated)
    report = resolve_battle(e, ships, target_engine, str(targetplanet.id),
                            config=order.payload.get('combat'), stellar_defenders=snapshots)
    apply_result(rows, snapshots, e.state.last_updated)
    return report


def _unit(session, empire, unit_id):
    row = session.get(m.StellarUnit, identifier(unit_id))
    require(row is not None and row.universe_id == empire.universe_id and row.empire_id == empire.id,
            'Unidade estelar não pertence ao império.')
    return row


def _superiority(session, row, local, owner):
    from .combat import local_defenders, fleet_units, defense_units
    armed = any(u['hp'] > 0 and u['damage'] > 0 and
                (not u.get('ammunition') or local.state.defenses['ammunition'].get(u['ammunition'], 0) > 0)
                for u in defense_units(local))
    return (not any(u['hp'] > 0 for u in fleet_units(local, local_defenders(local, str(row.planet_id))))
            and not armed
            and not any(u.id != row.id and u.payload['hp'] > 0
                        for u in orbital_units(session, owner, local, row.planet_id)))


def command(store, session, empire, e, data):
    action = data['action']
    require(action in ('move', 'attack', 'bombard'), 'Operação estelar desconhecida.')
    unit_id, target_id = identifier(data['unit_id']), identifier(data['target_planet_id'])
    experiment = data.get('experiment', 'intermediate')
    experiment_rules(experiment)
    config = combat_config(data.get('combat') or {k: data[k] for k in (
        'doctrine', 'weapon_profile', 'target_subsystem', 'target_stellar_id') if data.get(k) is not None})
    config['experiment'] = experiment
    request_data = {'unit_id': str(unit_id), 'target_planet_id': str(target_id), 'combat': config,
                    'experiment': experiment}
    order_id, request, prior = _request(session, empire, data['idempotency_key'], action, request_data)
    if prior:
        return deepcopy(prior.payload['result'])
    row = _unit(session, empire, unit_id)
    target = session.get(m.Planet, target_id)
    require(target is not None, 'Destino planetário inexistente.')
    destination = session.get(m.StarSystem, target.system_id)
    require(destination is not None and destination.universe_id == empire.universe_id, 'Destino fora do universo.')
    require(row.state in ('operational', 'damaged') and not row.payload.get('active_order_id'),
            'Unidade indisponível ou com operação ativa.')
    require(row.payload['hp'] > 0 and all(row.payload['subsystems'][k] > 0
            for k in ('containment', 'control')), 'Controle ou contenção incapacitados.')
    require(level(e.state, 'gravitational_propulsion') >= 1, 'Requer Propulsão Gravitacional.')
    orbital = None
    if action == 'attack' and config.get('target_stellar_id'):
        orbital = orbital_target(session, empire, e, target.id, config['target_stellar_id'])
    if action == 'move':
        require(target.empire_id == empire.id, 'MOVE exige planeta próprio.')
    else:
        require(orbital is not None or (target.empire_id is not None and target.empire_id != empire.id
                and store.relation(session, empire.id, target.empire_id)['status'] == 'war'),
                'Operação hostil exige guerra ativa.')
        require(row.payload['subsystems']['weapons'] > 0, 'Armamento incapacitado.')
        require(level(e.state, 'stellar_armaments') >= 1, 'Requer Armamentos Estelares.')
    require(config['doctrine'] == 'balanced' or level(e.state, 'fire_control_doctrine') >= 1,
            'Requer Doutrina de Controle de Tiro.')
    require(config['weapon_profile'] == 'standard' or level(e.state, 'shield_disruption') >= 1,
            'Requer Ruptura de Escudos.')
    if config.get('target_subsystem'):
        require(action == 'attack', 'Ataque dirigido exige ATTACK.')
        authorize_aim(session, empire, e, target.id, config['target_stellar_id'], config['target_subsystem'])
    now = e.state.last_updated
    # Preview must not mutate the ORM reserve or timestamp.
    original = deepcopy(row.payload)
    settle_energy(row, now)
    energy = row.payload['energy']
    row.payload = original
    if action == 'bombard':
        require(row.planet_id == target.id and row.system_id == target.system_id, 'Bombardeio exige órbita real do alvo.')
        owner = session.get(m.Empire, target.empire_id)
        local = Engine(e.catalog, load(session, owner, planet_id=target.id, catalog=e.catalog))
        require(_superiority(session, row, local, owner), 'Sem superioridade orbital.')
        duration, cost = BOMBARD_PREPARATION[experiment], STELLAR_RULES['bombard_energy']
    else:
        require(row.payload['subsystems']['propulsion'] > 0, 'Propulsão incapacitada.')
        origin = session.get(m.StarSystem, row.system_id)
        require(origin is not None and origin.universe_id == empire.universe_id, 'Origem estelar inválida.')
        distance = travel_distance((origin.x, origin.y), (destination.x, destination.y), intra_system=True)
        duration = travel_seconds(distance, STELLAR_RULES['gravitational_speed'])
        cost = ceil(distance * STELLAR_RULES['travel_energy_per_distance'])
    require(energy-cost >= STELLAR_RULES['containment_floor'], 'Energia insuficiente acima do piso de contenção.')
    result = {'unit_id': str(row.id), 'target_planet_id': str(target.id), 'action': action,
              'order_id': str(order_id), 'departure_at': now, 'arrival_at': now+duration,
              'energy_cost': cost, 'experiment': experiment, 'experimental': True}
    if data.get('preview'):
        return result
    settle_energy(row, now)
    row.payload = {**row.payload, 'energy': energy-cost, 'active_order_id': str(order_id), 'active_action': action}
    if action != 'bombard':
        row.state, row.planet_id = 'transit', None
    _order(session, empire, order_id, request, result,
           'stargrave_bombard' if action == 'bombard' else 'stargrave_travel', utc(now+duration),
           unit_id=str(row.id), target_planet_id=str(target.id), mission=action, combat=config,
           experiment=experiment)
    if action == 'bombard':
        store.report(local, f'Preparação de bombardeio estelar detectada; conclusão prevista em {now+duration}.')
        store.save(session, target.empire_id, local)
    session.flush()
    return result


def travel(store, session, empire, e, unit_id, targetplanet, mission, key):
    return command(store, session, empire, e, {'action': mission.lower(), 'unit_id': unit_id,
        'target_planet_id': str(getattr(targetplanet, 'id', targetplanet)), 'idempotency_key': key})


def bombard(store, session, empire, e, unit_id, targetplanet, key, experiment='intermediate'):
    return command(store, session, empire, e, {'action': 'bombard', 'unit_id': unit_id,
        'target_planet_id': str(getattr(targetplanet, 'id', targetplanet)),
        'idempotency_key': key, 'experiment': experiment})


def complete(store, session, order, engines):
    if order.kind not in ('stargrave_travel', 'stargrave_bombard'):
        return False
    if order.resolved or order.payload.get('applied'):
        return True
    empire = session.get(m.Empire, order.empire_id)
    require(empire is not None and empire.universe_id == order.universe_id, 'Ordem fora do universo.')
    e = engines[str(empire.id)]
    now = e.state.last_updated
    require(order.due_at is not None and now >= epoch(order.due_at), 'Operação estelar ainda não venceu.')
    p = order.payload
    row = _unit(session, empire, p['unit_id'])
    if str(order.id) in row.payload.get('cancelled_operations', []):
        order.payload = {**p, 'applied': True, 'completion': 'capability_lost'}
        return True
    require(row.payload.get('active_order_id') == str(order.id), 'Operação estelar inconsistente.')
    target = session.get(m.Planet, identifier(p['target_planet_id']))
    valid = row.payload['hp'] > 0 and all(row.payload['subsystems'][k] > 0 for k in ('containment', 'control'))
    reason = 'completed'
    if order.kind == 'stargrave_travel':
        valid = valid and row.state == 'transit' and row.payload['subsystems']['propulsion'] > 0
        require(target is not None, 'Destino físico deixou de existir.')
        destination = session.get(m.StarSystem, target.system_id)
        require(destination is not None and destination.universe_id == empire.universe_id,
                'Destino físico fora do universo.')
        if valid:
            damaged = row.payload['hp'] < STELLAR_RULES['structural_hp'] or any(
                value < STELLAR_RULES['subsystem_hp'] for value in row.payload['subsystems'].values())
            row.system_id, row.planet_id, row.state = target.system_id, target.id, 'damaged' if damaged else 'operational'
        else:
            reason = 'capability_lost'
            # A failed transit stays at its recorded origin system, without invented orbit.
            row.state = 'incapacitated' if row.payload['hp'] > 0 else 'sealed_wreck'
    orbital = None
    if p['mission'] == 'attack' and p['combat'].get('target_stellar_id'):
        try:
            orbital = orbital_target(session, empire, e, target.id, p['combat']['target_stellar_id']) if target else None
        except DataValidationError:
            pass
    hostile = (orbital is not None or (not p['combat'].get('target_stellar_id') and target is not None
               and target.empire_id is not None and target.empire_id != empire.id
               and store.relation(session, empire.id, target.empire_id)['status'] == 'war'))
    if valid and p['mission'] in ('attack', 'bombard'):
        valid = hostile and row.payload['subsystems']['weapons'] > 0
        if not valid:
            reason = 'hostility_or_capability_lost'
        else:
            owner = session.get(m.Empire, orbital.empire_id if orbital is not None else target.empire_id)
            native = orbital is None or orbital.empire_id == target.empire_id
            local = Engine(e.catalog, load(session, owner, planet_id=target.id if native else None, catalog=e.catalog))
            if p['mission'] == 'attack':
                from .combat import resolve_battle
                defending = orbital_units(session, owner, local, target.id) if native else [orbital]
                attack_units = combat_units([row], e, now, p['experiment'])
                defense_units = combat_units(defending, local, now, p['experiment'])
                battle = resolve_battle(e, [], local, str(target.id), config=p['combat'],
                                        stellar_attackers=attack_units, stellar_defenders=defense_units,
                                        planet_defenses=native, allow_loot=native)
                apply_result([row], attack_units, now); apply_result(defending, defense_units, now)
                battle.update(attacker=str(empire.id), defender=str(owner.id),
                              planet_name=local.system().planet.name if native else 'órbita planetária')
                store.battle_report(e, battle, str(empire.id)); store.battle_report(local, battle, str(owner.id))
            else:
                valid = (row.state in ('operational', 'damaged') and row.planet_id == target.id
                         and row.system_id == target.system_id and _superiority(session, row, local, owner))
                if valid:
                    from .combat import strategic_damage
                    battle = strategic_damage(e, local, STELLAR_RULES['bombard_damage'])
                    battle.update(kind='stellar_bombardment', attacker=str(empire.id), defender=str(owner.id))
                    store.battle_report(e, battle, str(empire.id)); store.battle_report(local, battle, str(owner.id))
                else:
                    reason = 'orbital_superiority_lost'
            store.save(session, owner.id, local)
            session.flush()
            engines[str(owner.id)] = Engine(e.catalog, load(session, owner, catalog=e.catalog))
    if not valid and reason == 'completed':
        reason = 'cancelled'
    row.payload = {**row.payload, 'active_order_id': None, 'active_action': None}
    order.payload = {**p, 'applied': True, 'completion': reason}
    store.report(e, f'Operação Stargrave: {reason}.')
    store.save(session, empire.id, e)
    session.flush()
    return True
