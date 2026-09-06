"""One transaction and one empire row lock per game action."""
from datetime import datetime, timezone
from time import time
from uuid import UUID, uuid4

from sqlalchemy import create_engine, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from starz.data import Catalog, DataValidationError
from starz.simulation import Engine, GameState
from . import models as m


def utc(epoch: float | None) -> datetime | None:
    return None if epoch is None else datetime.fromtimestamp(epoch, timezone.utc)


def epoch(value: datetime | None) -> float | None:
    if value is not None and value.tzinfo is None:
        raise ValueError('database timestamp must be timezone-aware')
    return None if value is None else value.timestamp()


def database_engine(url: str):
    if not url.startswith('postgresql+psycopg://'):
        raise ValueError('Configure DATABASE_URL com postgresql+psycopg://')
    return create_engine(url, isolation_level='READ COMMITTED', pool_pre_ping=True, hide_parameters=True)


class Store:
    def __init__(self, database, catalog: Catalog, seed: str = 'STARZ-ALPHA', clock=time):
        self.database = database
        self.catalog = catalog
        self.seed = seed
        self.clock = clock

    def bootstrap(self, now: float | None = None):
        stamp = utc(self.clock() if now is None else now)
        with Session(self.database) as session, session.begin():
            session.execute(insert(m.Universe).values(id=uuid4(), name='StarZ', seed=self.seed, created_at=stamp).on_conflict_do_nothing(index_elements=['name']))
            universe = session.scalar(select(m.Universe).where(m.Universe.name == 'StarZ').with_for_update())
            empire = session.scalar(select(m.Empire).where(m.Empire.universe_id == universe.id, m.Empire.name == 'Local Empire').with_for_update())
            if empire is None:
                engine = Engine.new(self.catalog, universe.seed, epoch(stamp))
                system = m.StarSystem(universe_id=universe.id, x=engine.state.system_x, y=engine.state.system_y, created_at=stamp)
                session.add(system)
                session.flush()
                empire = m.Empire(universe_id=universe.id, home_system_id=system.id, name='Local Empire', last_updated=stamp, created_at=stamp)
                session.add(empire)
                session.flush()
                planet = m.Planet(system_id=system.id, planet_index=0, empire_id=empire.id, population_total=engine.state.population_total, created_at=stamp)
                session.add(planet)
                session.flush()
                empire.home_planet_id = planet.id
                persist(session, empire, planet, engine.state)
            else:
                engine = Engine(self.catalog, load(session, empire))
            validate_state(self.catalog, engine.state)
            empire_id = empire.id
        return empire_id

    def run(self, empire_id, call, now: float | None = None):
        with Session(self.database) as session, session.begin():
            empire = session.scalar(select(m.Empire).where(m.Empire.id == empire_id).with_for_update())
            if empire is None:
                raise RuntimeError('império inexistente')
            state = load(session, empire)
            validate_state(self.catalog, state)
            engine = Engine(self.catalog, state)
            # Read the wall clock after obtaining the lock, never before waiting for it.
            stamp = max(self.clock(), state.last_updated) if now is None else now
            engine.advance(stamp)
            result = call(engine)
            validate_state(self.catalog, state)
            planet = session.get(m.Planet, empire.home_planet_id)
            if planet is None or planet.empire_id != empire.id:
                raise DataValidationError('homeworld persistido inválido')
            persist(session, empire, planet, state)
            return result


def load(session: Session, empire: m.Empire) -> GameState:
    universe = session.get(m.Universe, empire.universe_id)
    system = session.get(m.StarSystem, empire.home_system_id)
    planet = session.get(m.Planet, empire.home_planet_id)
    if universe is None or system is None or planet is None or planet.empire_id != empire.id or planet.system_id != system.id:
        raise DataValidationError('homeworld persistido inválido')
    def rows(model):
        return session.scalars(select(model).where(model.empire_id == empire.id)).all()
    research = session.get(m.Research, empire.id)
    completed = sorted(rows(m.CompletedTechnology), key=lambda row: (row.completed_at, row.technology_id))
    jobs = session.scalars(select(m.Construction).where(m.Construction.planet_id == planet.id).order_by(m.Construction.started_at, m.Construction.id)).all()
    associations = rows(m.FleetShip)
    ships = sorted(rows(m.Ship), key=lambda row: (row.created_at, row.id))
    fleets = sorted(rows(m.Fleet), key=lambda row: row.id)
    knowledge = rows(m.SystemKnowledge)
    notices = session.scalars(select(m.Notice).where(m.Notice.empire_id == empire.id).order_by(m.Notice.sequence.desc()).limit(100)).all()
    return GameState(
        seed=universe.seed, system_x=system.x, system_y=system.y,
        population_total=planet.population_total, last_updated=epoch(empire.last_updated),
        stocks={row.resource_id: row.amount for row in rows(m.Stock)},
        districts={row.district_id: row.level for row in session.scalars(select(m.District).where(m.District.planet_id == planet.id))},
        construction=[{'id': row.district_id, 'job_id': str(row.id), 'started_at': epoch(row.started_at), 'complete_at': epoch(row.complete_at)} for row in jobs],
        research={'active': research.active_technology_id, 'remaining_work': research.remaining_work, 'complete_at': epoch(research.complete_at), 'completed': [row.technology_id for row in completed], 'completed_at': {row.technology_id: epoch(row.completed_at) for row in completed}},
        ships=[{'id': str(row.id), 'hull_id': row.hull_id, 'propulsion_id': row.propulsion_id, 'fuel_id': row.fuel_id, 'crew': row.crew, 'mass': row.mass, 'ready_at': epoch(row.ready_at)} for row in ships],
        fleets=[{'id': str(row.id), 'name': row.name, 'ship_ids': sorted(str(link.ship_id) for link in associations if link.fleet_id == row.id), 'x': row.x, 'y': row.y, 'destination_x': row.destination_x, 'destination_y': row.destination_y, 'status': row.status, 'mission': row.mission, 'departure_at': epoch(row.departure_at), 'arrival_at': epoch(row.arrival_at), 'propulsion': row.propulsion_id, 'mode': row.mode, 'fuel_cost': row.fuel_cost} for row in fleets],
        notices=[row.message for row in notices],
        system_knowledge={f'{row.system_x}:{row.system_y}': epoch(row.surveyed_at) for row in knowledge},
    )


def persist(session: Session, empire: m.Empire, planet: m.Planet, state: GameState):
    stamp = utc(state.last_updated)
    empire.last_updated = stamp
    planet.population_total = state.population_total
    for resource_id, amount in state.stocks.items():
        session.merge(m.Stock(empire_id=empire.id, resource_id=resource_id, amount=amount))
    for district_id, level in state.districts.items():
        session.merge(m.District(planet_id=planet.id, district_id=district_id, level=level))
    existing_jobs = {str(row.id): row for row in session.scalars(select(m.Construction).where(m.Construction.planet_id == planet.id))}
    for job in state.construction:
        row = existing_jobs.pop(job['job_id'], None)
        if row is None:
            session.add(m.Construction(id=UUID(job['job_id']), planet_id=planet.id, district_id=job['id'], started_at=utc(job['started_at']), complete_at=utc(job['complete_at'])))
    for row in existing_jobs.values():
        session.delete(row)
    research = state.research
    session.merge(m.Research(empire_id=empire.id, active_technology_id=research['active'], remaining_work=research.get('remaining_work', 0), complete_at=utc(research['complete_at']), updated_at=stamp))
    for technology_id in research['completed']:
        if session.get(m.CompletedTechnology, (empire.id, technology_id)) is None:
            session.add(m.CompletedTechnology(empire_id=empire.id, technology_id=technology_id, completed_at=utc(research['completed_at'][technology_id])))
    for ship in state.ships:
        if session.get(m.Ship, UUID(ship['id'])) is None:
            session.add(m.Ship(id=UUID(ship['id']), empire_id=empire.id, hull_id=ship['hull_id'], propulsion_id=ship['propulsion_id'], fuel_id=ship['fuel_id'], crew=ship['crew'], mass=ship['mass'], ready_at=utc(ship['ready_at']), created_at=stamp))
    session.flush()
    for fleet in state.fleets:
        session.merge(m.Fleet(id=UUID(fleet['id']), empire_id=empire.id, name=fleet['name'], x=fleet['x'], y=fleet['y'], destination_x=fleet['destination_x'], destination_y=fleet['destination_y'], status=fleet['status'], mission=fleet.get('mission', 'MOVE'), departure_at=utc(fleet['departure_at']), arrival_at=utc(fleet['arrival_at']), propulsion_id=fleet['propulsion'], mode=fleet['mode'], fuel_cost=fleet['fuel_cost']))
        session.flush()
        for ship_id in fleet['ship_ids']:
            session.merge(m.FleetShip(fleet_id=UUID(fleet['id']), ship_id=UUID(ship_id), empire_id=empire.id))
    existing_notices = session.scalars(select(m.Notice).where(m.Notice.empire_id == empire.id).order_by(m.Notice.sequence.desc()).limit(100)).all()
    added = len(state.notices) - len(existing_notices)
    sequence = existing_notices[0].sequence + 1 if existing_notices else 0
    for message in reversed(state.notices[:added]):
        session.add(m.Notice(empire_id=empire.id, message=message, sequence=sequence, created_at=stamp))
        sequence += 1
    for key, surveyed_at in state.system_knowledge.items():
        x, y = (int(value) for value in key.split(':', 1))
        session.merge(m.SystemKnowledge(empire_id=empire.id, system_x=x, system_y=y, knowledge_level='SURVEYED', surveyed_at=utc(surveyed_at)))


def validate_state(catalog: Catalog, state: GameState):
    for resource_id in state.stocks:
        catalog.get('fuels' if resource_id in catalog.items['fuels'] else 'resources', resource_id)
    for district_id in state.districts:
        catalog.get('districts', district_id)
    for job in state.construction:
        catalog.get('districts', job['id'])
    for technology_id in [*state.research['completed'], *([state.research['active']] if state.research['active'] else [])]:
        catalog.get('technologies', technology_id)
    ships = {ship['id']: ship for ship in state.ships}
    attached = set()
    for ship in ships.values():
        hull = catalog.get('ships', ship['hull_id'])
        motor = catalog.get('propulsion', ship['propulsion_id'])
        catalog.get('fuels', ship['fuel_id'])
        if motor.id not in hull.compatible_propulsion or ship['fuel_id'] not in motor.compatible_fuels:
            raise DataValidationError('nave persistida incompatível com catálogo')
    for fleet in state.fleets:
        catalog.get('propulsion', fleet['propulsion'])
        catalog.get('travel_modes', fleet['mode'])
        if fleet.get('mission', 'MOVE') not in {'MOVE', 'SURVEY'}:
            raise DataValidationError('missão de frota persistida inválida')
        for ship_id in fleet['ship_ids']:
            if ship_id not in ships or ship_id in attached:
                raise DataValidationError('ownership de nave persistida inválido')
            attached.add(ship_id)
    for key in state.system_knowledge:
        try:
            x, y = (int(value) for value in key.split(':', 1))
        except (TypeError, ValueError) as exc:
            raise DataValidationError('coordenada de conhecimento inválida') from exc
        if key != f'{x}:{y}':
            raise DataValidationError('coordenada de conhecimento inválida')
