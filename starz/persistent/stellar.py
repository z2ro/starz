"""Transactional stellar construction. The existing universe lock and settler own execution."""
from copy import deepcopy
from math import ceil, isfinite
from uuid import UUID, uuid5

from sqlalchemy import or_, select

from ..db import models as m
from ..db.store import utc, epoch
from ..data import DataValidationError
from ..progression import level
from ..universe import generate_system
from .combat_rules import STELLAR_RULES

# Experimental construction profile; not approved production balance.
PROFILE = 'experimental-stellar-v1'
MODULE_CARGO = 50
MODULE_COST = {'refined_alloy': 200, 'components': 100}
MODULE_WORK = 600
PHASE_SECONDS = 600
PHASES = (
    ('containment', ('stellar_extraction', 'megastructure_engineering')),
    ('shielding', ('stellar_containment', 'extreme_materials')),
    ('control', ('mobile_stellar_confinement',)),
    ('propulsion', ('gravitational_propulsion',)),
    ('weapons', ('stellar_armaments',)),
)
MODULE_KINDS = tuple(kind for kind, _ in PHASES)


def require(condition, message):
    if not condition:
        raise DataValidationError(message)


def identifier(value):
    try:
        return UUID(str(value))
    except (ValueError, TypeError, AttributeError) as exc:
        raise DataValidationError('Identidade estelar inválida.') from exc


def canonical_source_id(system_id):
    return uuid5(identifier(system_id), 'star:0')


def _science(engine, *keys):
    require(all(level(engine.state, key) >= 1 for key in keys),
            'Pesquisa estelar necessária: ' + ', '.join(keys))


def _request(session, empire, key, action, data):
    require(isinstance(key, str) and 0 < len(key) <= 128, 'Chave de idempotência inválida.')
    order_id = uuid5(empire.id, 'stellar:' + key)
    request = {'action': action, **data}
    prior = session.get(m.UniverseOrder, order_id)
    if prior:
        require(prior.universe_id == empire.universe_id and prior.empire_id == empire.id
                and prior.payload.get('request') == request, 'Chave de idempotência conflitante.')
    return order_id, request, prior


def _order(session, empire, order_id, request, result, kind='stellar_action', due_at=None, **payload):
    row = m.UniverseOrder(id=order_id, universe_id=empire.universe_id, empire_id=empire.id,
                          kind=kind, payload={'request': request, 'result': result, **payload},
                          due_at=due_at, resolved=due_at is None)
    session.add(row)
    return row


def _project(session, empire, project_id):
    project = session.get(m.StellarProject, identifier(project_id))
    require(project is not None and project.universe_id == empire.universe_id
            and project.empire_id == empire.id, 'Projeto não pertence ao império.')
    return project


def _source_system(session, project):
    source = session.get(m.StellarSource, project.source_id)
    system = session.get(m.StarSystem, source.origin_system_id)
    return source, system


def _project_view(project):
    return {'project_id': str(project.id), 'source_id': str(project.source_id),
            'status': project.status, 'completed_phases': project.completed_phases}


def reserve(session, empire, engine, x, y, idempotency_key):
    require(type(x) is int and type(y) is int and -100 <= x <= 100 and -100 <= y <= 100,
            'Coordenadas estelares inválidas.')
    order_id, request, prior = _request(session, empire, idempotency_key, 'reserve', {'x': x, 'y': y})
    if prior:
        return deepcopy(prior.payload['result'])
    _science(engine, 'stellar_extraction', 'megastructure_engineering')
    require(engine.knowledge_level(x, y) == 'SURVEYED', 'Requer levantamento do sistema.')
    # The authoritative generator currently produces exactly one central Star.
    require(generate_system(engine.state.seed, x, y, engine.catalog).star is not None,
            'Sistema sem estrela elegível.')
    system = session.scalar(select(m.StarSystem).where(m.StarSystem.universe_id == empire.universe_id,
                                                     m.StarSystem.x == x, m.StarSystem.y == y))
    if system:
        require(session.scalar(select(m.Empire.id).where(m.Empire.home_system_id == system.id)) is None,
                'Sistema natal não pode ser capturado.')
        require(session.scalar(select(m.Planet.id).where(m.Planet.system_id == system.id,
                or_(m.Planet.empire_id.is_not(None), m.Planet.population_total > 0)).limit(1)) is None,
                'Sistema habitado não pode ser capturado.')
    fleets = session.scalars(select(m.Fleet).join(m.Empire).where(
        m.Empire.universe_id == empire.universe_id, m.Fleet.destination_x == x,
        m.Fleet.destination_y == y)).all()
    require(not any(f.status == 'TRANSIT' and f.mission == 'COLONIZE' for f in fleets),
            'Colonização já comprometida neste sistema.')
    fleet_ids = {str(f.id) for f in fleets}
    pending = session.scalars(select(m.UniverseOrder).where(
        m.UniverseOrder.universe_id == empire.universe_id, m.UniverseOrder.kind == 'mission',
        m.UniverseOrder.resolved == False)).all()
    require(not any(o.payload.get('mission') == 'COLONIZE' and
                    o.payload.get('fleet_id') in fleet_ids for o in pending),
            'Ordem colonial já comprometida neste sistema.')
    now = utc(engine.state.last_updated)
    if system is None:
        system = m.StarSystem(universe_id=empire.universe_id, x=x, y=y, created_at=now)
        session.add(system)
        session.flush()
    source_id = canonical_source_id(system.id)
    source = session.get(m.StellarSource, source_id)
    if source is None:
        source = m.StellarSource(id=source_id, universe_id=empire.universe_id,
                                origin_system_id=system.id, removed_at=None, created_at=now)
        session.add(source)
        session.flush()
    require(source.removed_at is None, 'Estrela já removida.')
    require(session.scalar(select(m.StellarProject.id).where(m.StellarProject.source_id == source.id,
                                                           m.StellarProject.status != 'cancelled')) is None,
            'Estrela já reservada.')
    project = m.StellarProject(id=uuid5(order_id, 'project'), universe_id=empire.universe_id,
                              source_id=source.id, empire_id=empire.id, status='reserved',
                              completed_phases=0, phase_records=[], stocks={}, created_at=now, updated_at=now)
    session.add(project)
    result = _project_view(project)
    _order(session, empire, order_id, request, result)
    session.flush()
    return result


def cancel_project(session, empire, engine, project_id, idempotency_key):
    project_id = identifier(project_id)
    order_id, request, prior = _request(session, empire, idempotency_key, 'cancel',
                                       {'project_id': str(project_id)})
    if prior:
        return deepcopy(prior.payload['result'])
    project = _project(session, empire, project_id)
    require(project.status == 'reserved' and not project.phase_records and not project.stocks,
            'Cancelamento disponível apenas antes de comprometer módulos ou fases.')
    require(session.scalar(select(m.StellarModule.id).where(m.StellarModule.project_id == project.id)) is None,
            'Projeto possui módulos comprometidos.')
    project.status = 'cancelled'
    project.updated_at = utc(engine.state.last_updated)
    result = _project_view(project)
    _order(session, empire, order_id, request, result)
    return result


def manufacture(session, empire, engine, kind, idempotency_key):
    require(kind in MODULE_KINDS, 'Tipo de módulo estelar desconhecido.')
    planet_id = identifier(engine.state.planet_id)
    order_id, request, prior = _request(session, empire, idempotency_key, 'manufacture',
                                       {'kind': kind, 'planet_id': str(planet_id)})
    if prior:
        return deepcopy(prior.payload['result'])
    _science(engine, 'precision_manufacturing', 'extreme_materials')
    planet = session.get(m.Planet, planet_id)
    require(planet is not None and planet.empire_id == empire.id, 'Fabricação exige colônia própria.')
    system = session.get(m.StarSystem, planet.system_id)
    require(system.universe_id == empire.universe_id, 'Colônia fora do universo.')
    capacities = engine.capacities()
    industry = capacities['industrial_capacity'] * min(capacities['energy_coverage'],
                                                       capacities['workforce_coverage'])
    require(isfinite(industry) and industry >= 1, 'Capacidade industrial efetiva insuficiente.')
    engine._pay(MODULE_COST)
    duration = max(1, ceil(MODULE_WORK / industry))
    now = engine.state.last_updated
    module_id = uuid5(order_id, 'module')
    result = {'module_id': str(module_id), 'kind': kind, 'status': 'manufacturing',
              'complete_at': now + duration, 'profile': PROFILE}
    _order(session, empire, order_id, request, result, 'stellar_module', utc(now + duration),
           module_id=str(module_id), profile=PROFILE, cost=dict(MODULE_COST),
           work=MODULE_WORK, industry=industry, started_at=now)
    session.flush()
    session.add(m.StellarModule(id=module_id, universe_id=empire.universe_id, empire_id=empire.id,
                               kind=kind, status='manufacturing', origin_planet_id=planet.id,
                               project_id=None, fleet_id=None, consumed_phase=None,
                               manufacture_order_id=order_id, phase_order_id=None, delivery_order_id=None,
                               created_at=utc(now), updated_at=utc(now)))
    return result


def start_phase(session, empire, engine, project_id, idempotency_key):
    project_id = identifier(project_id)
    order_id, request, prior = _request(session, empire, idempotency_key, 'phase',
                                       {'project_id': str(project_id)})
    if prior:
        return deepcopy(prior.payload['result'])
    project = _project(session, empire, project_id)
    require(project.status in ('reserved', 'building') and project.completed_phases < 5,
            'Projeto não pode iniciar fase.')
    require(not any(not r['completed'] for r in project.phase_records), 'Fase já em andamento.')
    phase = project.completed_phases + 1
    kind, gates = PHASES[phase - 1]
    _science(engine, *gates)
    module = session.scalar(select(m.StellarModule).where(m.StellarModule.project_id == project.id,
                            m.StellarModule.kind == kind, m.StellarModule.status == 'delivered')
                            .order_by(m.StellarModule.id).limit(1))
    require(module is not None, 'Fase exige módulo físico entregue: ' + kind)
    now = engine.state.last_updated
    result = {'project_id': str(project.id), 'phase': phase, 'module_id': str(module.id),
              'order_id': str(order_id), 'complete_at': now + PHASE_SECONDS, 'profile': PROFILE}
    _order(session, empire, order_id, request, result, 'stellar_phase', utc(now + PHASE_SECONDS),
           project_id=str(project.id), module_id=str(module.id), phase=phase, profile=PROFILE)
    session.flush()
    module.status = 'committed'
    module.phase_order_id = order_id
    module.updated_at = utc(now)
    project.status = 'building'
    project.updated_at = utc(now)
    project.phase_records = [*project.phase_records, {'phase': phase, 'order_id': str(order_id),
        'module_id': str(module.id), 'started_at': now, 'complete_at': now + PHASE_SECONDS, 'completed': False}]
    return result



def complete(store, session, order, engines):
    if order.kind not in ('stellar_module', 'stellar_phase'):
        return False
    if order.payload.get('applied'):
        return True
    empire = session.get(m.Empire, order.empire_id)
    engine = engines.get(str(order.empire_id))
    require(empire is not None and empire.universe_id == order.universe_id and engine is not None,
            'Ordem estelar sem império válido.')
    require(order.due_at is not None and engine.state.last_updated >= epoch(order.due_at),
            'Ordem estelar ainda não venceu.')
    module = session.get(m.StellarModule, identifier(order.payload['module_id']))
    require(module is not None and module.empire_id == empire.id and module.universe_id == empire.universe_id,
            'Módulo fora do império.')
    now = utc(engine.state.last_updated)
    if order.kind == 'stellar_module':
        require(module.manufacture_order_id == order.id and module.status == 'manufacturing',
                'Fabricação estelar inconsistente.')
        module.status = 'ready'
    else:
        project = _project(session, empire, order.payload['project_id'])
        phase = order.payload['phase']
        require(project.status == 'building' and phase == project.completed_phases + 1 and
                module.project_id == project.id and module.status == 'committed' and
                module.phase_order_id == order.id and module.kind == PHASES[phase - 1][0],
                'Conclusão de fase estelar inconsistente.')
        records = deepcopy(project.phase_records)
        record = next((r for r in records if r['order_id'] == str(order.id)), None)
        require(record is not None and not record['completed'], 'Registro de fase inconsistente.')
        record.update(completed=True, completed_at=engine.state.last_updated)
        project.phase_records, project.completed_phases, project.updated_at = records, phase, now
        if phase == 5:project.status = 'commissioned'
        module.status, module.consumed_phase = 'consumed', phase
        source, system = _source_system(session, project)
        if phase == 2:
            require(source.removed_at is None, 'Estrela já removida.')
            source.removed_at = now
        if phase == 5:
            require(source.removed_at is not None, 'Comissionamento exige estrela confinada.')
            unit_id = uuid5(project.id, 'unit')
            require(session.get(m.StellarUnit, unit_id) is None, 'Unidade já comissionada.')
            session.add(m.StellarUnit(id=unit_id, universe_id=empire.universe_id, source_id=source.id,
                        project_id=project.id, empire_id=empire.id, system_id=system.id, planet_id=None,
                        state='operational', stocks=dict(project.stocks), created_at=now,
                        payload={'profile': PROFILE, 'original_owner_id': str(empire.id),
                                 'hp': STELLAR_RULES['structural_hp'], 'shield': STELLAR_RULES['shield_capacity'],
                                 'subsystems': {key: STELLAR_RULES['subsystem_hp'] for key in MODULE_KINDS}}))
            project.stocks, project.status = {}, 'commissioned'
    module.updated_at = now
    order.payload = {**order.payload, 'applied': True}
    session.flush()
    return True


def snapshot(session, empire, engine):
    projects = []
    for project in session.scalars(select(m.StellarProject).where(
            m.StellarProject.universe_id == empire.universe_id,
            m.StellarProject.empire_id == empire.id).order_by(m.StellarProject.created_at, m.StellarProject.id)):
        source, system = _source_system(session, project)
        projects.append({**_project_view(project), 'id': str(project.id), 'x': system.x, 'y': system.y,
                         'phase_records': deepcopy(project.phase_records), 'stocks': dict(project.stocks),
                         'star_present': source.removed_at is None})
    modules = [{'id': str(module.id), 'kind': module.kind, 'status': module.status,
                'origin_planet_id': str(module.origin_planet_id),
                'project_id': str(module.project_id) if module.project_id else None,
                'fleet_id': str(module.fleet_id) if module.fleet_id else None,
                'consumed_phase': module.consumed_phase}
               for module in session.scalars(select(m.StellarModule).where(
                   m.StellarModule.universe_id == empire.universe_id,
                   m.StellarModule.empire_id == empire.id).order_by(m.StellarModule.created_at, m.StellarModule.id))]
    owned_units = list(session.scalars(select(m.StellarUnit).where(
        m.StellarUnit.universe_id == empire.universe_id,
        m.StellarUnit.empire_id == empire.id).order_by(m.StellarUnit.created_at, m.StellarUnit.id)))
    if owned_units:
        from .stargrave import settle_energy
        for unit in owned_units:settle_energy(unit,engine.state.last_updated)
    units = [{'id': str(unit.id), 'source_id': str(unit.source_id), 'project_id': str(unit.project_id),
              'system_id': str(unit.system_id), 'planet_id': str(unit.planet_id) if unit.planet_id else None,
              'state': unit.state, 'payload': deepcopy(unit.payload), 'stocks': dict(unit.stocks)}
             for unit in owned_units]
    contacts = [{'id':str(unit.id),'planet_id':str(unit.planet_id),'system_id':str(unit.system_id),
                 'owner_id':str(unit.empire_id),'state':unit.state}
                for unit in session.scalars(select(m.StellarUnit).join(m.Planet,m.Planet.id==m.StellarUnit.planet_id).where(
                    m.StellarUnit.universe_id==empire.universe_id,m.Planet.empire_id==empire.id,
                    m.StellarUnit.empire_id!=empire.id).order_by(m.StellarUnit.id))]
    return {'projects': projects, 'modules': modules, 'units': units, 'contacts':contacts, 'profile': PROFILE,
            'experimental': True, 'module_cargo': MODULE_CARGO, 'module_cost': dict(MODULE_COST),
            'module_work': MODULE_WORK, 'phase_seconds': PHASE_SECONDS,
            'phases': [{'phase': index, 'module_kind': kind, 'research': list(gates)}
                       for index, (kind, gates) in enumerate(PHASES, 1)]}
