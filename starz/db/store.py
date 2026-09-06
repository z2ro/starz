"""Transactional PostgreSQL adapter for StarZ domain state."""
from datetime import datetime, timezone
from time import time
from uuid import UUID, uuid4

from sqlalchemy import create_engine, select, text
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
        self.database, self.catalog, self.seed, self.clock = database, catalog, seed, clock

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
                planet = m.Planet(system_id=system.id, planet_index=0, empire_id=empire.id, population_total=engine.state.population_total, created_at=stamp, last_updated=stamp)
                session.add(planet)
                session.flush()
                empire.home_planet_id = planet.id
                engine.state.planet_id = engine.state.home_planet_id = str(planet.id)
                engine.state.home_system_x, engine.state.home_system_y = system.x, system.y
                engine.state.planets = [_planet_summary(planet, system, True)]
                persist(session, empire, planet, engine.state)
            else:
                engine = Engine(self.catalog, load(session, empire, catalog=self.catalog))
            validate_state(self.catalog, engine.state)
            empire_id = empire.id
        return empire_id

    @staticmethod
    def _lock_target(session: Session, universe_id, target: tuple[int, int, int]) -> None:
        key = f'{universe_id}:{target[0]}:{target[1]}:{target[2]}'
        session.execute(text('SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))'), {'key': key})

    def run(self, empire_id, call, now: float | None = None, *, planet_id=None, colony_target: tuple[int, int, int] | None = None):
        with Session(self.database) as session, session.begin():
            empire = session.scalar(select(m.Empire).where(m.Empire.id == empire_id).with_for_update())
            if empire is None:
                raise RuntimeError('império inexistente')
            if colony_target is not None:
                self._lock_target(session, empire.universe_id, colony_target)
            arriving = session.execute(select(m.Fleet.destination_x, m.Fleet.destination_y, m.Fleet.target_planet_index).where(m.Fleet.empire_id == empire.id, m.Fleet.status == 'TRANSIT', m.Fleet.mission == 'COLONIZE')).all()
            for target in sorted((x, y, index) for x, y, index in arriving):
                self._lock_target(session, empire.universe_id, target)
            stamp = max(self.clock(), epoch(empire.last_updated)) if now is None else now
            try:
                selected_id = UUID(str(planet_id)) if planet_id is not None else empire.home_planet_id
            except ValueError as exc:
                raise DataValidationError('planet_id inválido') from exc
            if selected_id != empire.home_planet_id:
                home = session.get(m.Planet, empire.home_planet_id)
                home_state = load(session, empire, catalog=self.catalog)
                home_engine = Engine(self.catalog, home_state)
                home_engine.advance(stamp)
                persist(session, empire, home, home_state)
                session.flush()
                state = load(session, empire, planet_id=selected_id, catalog=self.catalog)
                engine = Engine(self.catalog, state)
                engine.advance_planet(stamp)
            else:
                state = load(session, empire, catalog=self.catalog)
                engine = Engine(self.catalog, state)
                engine.advance(stamp)
            validate_state(self.catalog, state)
            result = call(engine)
            validate_state(self.catalog, state)
            planet = session.get(m.Planet, UUID(state.planet_id))
            if planet is None or planet.empire_id != empire.id:
                raise DataValidationError('planeta ativo persistido inválido')
            persist(session, empire, planet, state)
            return result


def _planet_summary(planet: m.Planet, system: m.StarSystem, home: bool) -> dict:
    return {'id': str(planet.id), 'x': system.x, 'y': system.y, 'planet_index': planet.planet_index, 'population_total': planet.population_total, 'created_at': epoch(planet.created_at), 'last_updated': epoch(planet.last_updated), 'home': home}


def load(session: Session, empire: m.Empire, planet_id=None, catalog: Catalog | None = None) -> GameState:
    universe = session.get(m.Universe, empire.universe_id)
    home_system = session.get(m.StarSystem, empire.home_system_id)
    home = session.get(m.Planet, empire.home_planet_id)
    try:
        active = session.get(m.Planet, UUID(str(planet_id))) if planet_id is not None else home
    except ValueError as exc:
        raise DataValidationError('planet_id inválido') from exc
    if universe is None or home_system is None or home is None or home.empire_id != empire.id or home.system_id != home_system.id:
        raise DataValidationError('homeworld persistido inválido')
    if active is None or active.empire_id != empire.id:
        raise DataValidationError('planeta inexistente ou não pertence ao império')
    active_system = session.get(m.StarSystem, active.system_id)
    if active_system is None or active_system.universe_id != empire.universe_id:
        raise DataValidationError('sistema do planeta ativo inválido')

    def rows(model):
        return session.scalars(select(model).where(model.empire_id == empire.id)).all()

    owned = session.execute(select(m.Planet, m.StarSystem).join(m.StarSystem).where(m.Planet.empire_id == empire.id).order_by(m.StarSystem.x, m.StarSystem.y, m.Planet.planet_index)).all()
    occupied = session.execute(select(m.Planet, m.StarSystem).join(m.StarSystem).where(m.StarSystem.universe_id == empire.universe_id)).all()
    research = session.get(m.Research, empire.id)
    completed = sorted(rows(m.CompletedTechnology), key=lambda row: (row.completed_at, row.technology_id))
    jobs = session.scalars(select(m.Construction).where(m.Construction.planet_id == active.id).order_by(m.Construction.started_at, m.Construction.id)).all()
    associations, ships, fleets = rows(m.FleetShip), sorted(rows(m.Ship), key=lambda row: (row.created_at, row.id)), sorted(rows(m.Fleet), key=lambda row: row.id)
    notices = session.scalars(select(m.Notice).where(m.Notice.empire_id == empire.id).order_by(m.Notice.sequence.desc()).limit(100)).all()
    claims = session.execute(select(m.Fleet.id, m.Fleet.destination_x, m.Fleet.destination_y, m.Fleet.target_planet_index).join(m.Empire).where(m.Empire.universe_id == empire.universe_id, m.Fleet.status == 'TRANSIT', m.Fleet.mission == 'COLONIZE')).all()
    state = GameState(
        seed=universe.seed, system_x=active_system.x, system_y=active_system.y, population_total=active.population_total, last_updated=epoch(empire.last_updated),
        stocks={row.resource_id: row.amount for row in rows(m.Stock)},
        districts={row.district_id: row.level for row in session.scalars(select(m.District).where(m.District.planet_id == active.id))},
        construction=[{'id': row.district_id, 'job_id': str(row.id), 'started_at': epoch(row.started_at), 'complete_at': epoch(row.complete_at)} for row in jobs],
        research={'active': research.active_technology_id, 'remaining_work': research.remaining_work, 'complete_at': epoch(research.complete_at), 'completed': [row.technology_id for row in completed], 'completed_at': {row.technology_id: epoch(row.completed_at) for row in completed}},
        ships=[{'id': str(row.id), 'hull_id': row.hull_id, 'propulsion_id': row.propulsion_id, 'fuel_id': row.fuel_id, 'crew': row.crew, 'mass': row.mass, 'ready_at': epoch(row.ready_at)} for row in ships],
        fleets=[{'id': str(row.id), 'name': row.name, 'ship_ids': sorted(str(link.ship_id) for link in associations if link.fleet_id == row.id), 'x': row.x, 'y': row.y, 'destination_x': row.destination_x, 'destination_y': row.destination_y, 'status': row.status, 'mission': row.mission, 'target_planet_index': row.target_planet_index, 'colonization_population': row.colonization_population, 'departure_at': epoch(row.departure_at), 'arrival_at': epoch(row.arrival_at), 'propulsion': row.propulsion_id, 'mode': row.mode, 'fuel_cost': row.fuel_cost} for row in fleets],
        notices=[row.message for row in notices],
        system_knowledge={f'{row.system_x}:{row.system_y}': epoch(row.surveyed_at) for row in rows(m.SystemKnowledge)},
        planet_id=str(active.id), planet_index=active.planet_index, home_planet_id=str(home.id), home_system_x=home_system.x, home_system_y=home_system.y,
        planets=[_planet_summary(planet, system, planet.id == home.id) for planet, system in owned],
        occupied_planets=[f'{system.x}:{system.y}:{planet.planet_index}' for planet, system in occupied],
        colonization_claims={f'{x}:{y}:{index}': str(fleet_id) for fleet_id, x, y, index in claims},
        crew_committed_override=0 if active.id != home.id else None,
        planet_last_updated=epoch(active.last_updated),
    )
    if active.id != home.id and catalog is not None:
        home_districts = {row.district_id: row.level for row in session.scalars(select(m.District).where(m.District.planet_id == home.id))}
        home_state = GameState(seed=universe.seed, system_x=home_system.x, system_y=home_system.y, stocks=state.stocks, population_total=home.population_total, districts=home_districts, ships=state.ships, last_updated=state.last_updated)
        state.research_rate_override = Engine(catalog, home_state).capacities()['effective_research_rate']
    return state


def persist(session: Session, empire: m.Empire, planet: m.Planet, state: GameState):
    stamp = utc(state.last_updated)
    empire.last_updated, planet.population_total, planet.last_updated = stamp, state.population_total, stamp
    for resource_id, amount in state.stocks.items():
        session.merge(m.Stock(empire_id=empire.id, resource_id=resource_id, amount=amount))
    for district_id, level in state.districts.items():
        session.merge(m.District(planet_id=planet.id, district_id=district_id, level=level))
    existing_jobs = {str(row.id): row for row in session.scalars(select(m.Construction).where(m.Construction.planet_id == planet.id))}
    for job in state.construction:
        if existing_jobs.pop(job['job_id'], None) is None:
            session.add(m.Construction(id=UUID(job['job_id']), planet_id=planet.id, district_id=job['id'], started_at=utc(job['started_at']), complete_at=utc(job['complete_at'])))
    for row in existing_jobs.values():
        session.delete(row)
    for colony in state.new_colonies:
        system = session.scalar(select(m.StarSystem).where(m.StarSystem.universe_id == empire.universe_id, m.StarSystem.x == colony['x'], m.StarSystem.y == colony['y']))
        if system is None:
            system = m.StarSystem(universe_id=empire.universe_id, x=colony['x'], y=colony['y'], created_at=utc(colony['created_at']))
            session.add(system)
            session.flush()
        colony_row = m.Planet(id=UUID(colony['id']), system_id=system.id, planet_index=colony['planet_index'], empire_id=empire.id, population_total=colony['population_total'], created_at=utc(colony['created_at']), last_updated=utc(colony['created_at']))
        session.add(colony_row)
        session.flush()
        for district_id, level in colony['districts'].items():
            session.add(m.District(planet_id=colony_row.id, district_id=district_id, level=level))
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
        session.merge(m.Fleet(id=UUID(fleet['id']), empire_id=empire.id, name=fleet['name'], x=fleet['x'], y=fleet['y'], destination_x=fleet['destination_x'], destination_y=fleet['destination_y'], status=fleet['status'], mission=fleet.get('mission', 'MOVE'), target_planet_index=fleet.get('target_planet_index'), colonization_population=fleet.get('colonization_population'), departure_at=utc(fleet['departure_at']), arrival_at=utc(fleet['arrival_at']), propulsion_id=fleet['propulsion'], mode=fleet['mode'], fuel_cost=fleet['fuel_cost']))
        session.flush()
        for ship_id in fleet['ship_ids']:
            session.merge(m.FleetShip(fleet_id=UUID(fleet['id']), ship_id=UUID(ship_id), empire_id=empire.id))
    existing_notices = session.scalars(select(m.Notice).where(m.Notice.empire_id == empire.id).order_by(m.Notice.sequence.desc()).limit(100)).all()
    added, sequence = len(state.notices) - len(existing_notices), (existing_notices[0].sequence + 1 if existing_notices else 0)
    for message in reversed(state.notices[:added]):
        session.add(m.Notice(empire_id=empire.id, message=message, sequence=sequence, created_at=stamp))
        sequence += 1
    for key, surveyed_at in state.system_knowledge.items():
        x, y = (int(value) for value in key.split(':', 1))
        session.merge(m.SystemKnowledge(empire_id=empire.id, system_x=x, system_y=y, knowledge_level='SURVEYED', surveyed_at=utc(surveyed_at)))
    state.new_colonies.clear()


def validate_state(catalog: Catalog, state: GameState):
    for resource_id in state.stocks:
        catalog.get('fuels' if resource_id in catalog.items['fuels'] else 'resources', resource_id)
    for district_id in state.districts:
        catalog.get('districts', district_id)
    for job in state.construction:
        catalog.get('districts', job['id'])
    for colony in state.new_colonies:
        for district_id in colony['districts']:
            catalog.get('districts', district_id)
    for technology_id in [*state.research['completed'], *([state.research['active']] if state.research['active'] else [])]:
        catalog.get('technologies', technology_id)
    ships, attached = {ship['id']: ship for ship in state.ships}, set()
    for ship in ships.values():
        hull, motor = catalog.get('ships', ship['hull_id']), catalog.get('propulsion', ship['propulsion_id'])
        catalog.get('fuels', ship['fuel_id'])
        if motor.id not in hull.compatible_propulsion or ship['fuel_id'] not in motor.compatible_fuels:
            raise DataValidationError('nave persistida incompatível com catálogo')
    for fleet in state.fleets:
        catalog.get('propulsion', fleet['propulsion'])
        catalog.get('travel_modes', fleet['mode'])
        mission = fleet.get('mission', 'MOVE')
        if mission not in {'MOVE', 'SURVEY', 'COLONIZE'}:
            raise DataValidationError('missão de frota persistida inválida')
        if (mission == 'COLONIZE') != (fleet.get('target_planet_index') is not None and fleet.get('colonization_population') is not None):
            raise DataValidationError('alvo colonial persistido inválido')
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
