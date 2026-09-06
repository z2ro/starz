"""Real PostgreSQL tests. Set TEST_DATABASE_URL; every test uses a fresh schema."""
import copy
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Barrier
from uuid import uuid4

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from starz.data import Catalog, DataValidationError
from starz.api import galaxy_snapshot
from starz.db import models as m
from starz.db.store import Store, load, persist, utc
from starz.simulation import Engine
from starz.universe import colonization_viability, generate_system
from starz.settings import Settings


@unittest.skipUnless(Settings.from_env().test_database_url, 'TEST_DATABASE_URL required for PostgreSQL integration tests')
class PostgresTests(unittest.TestCase):
    def setUp(self):
        self.url = Settings.from_env().test_database_url
        self.schema = 'starz_test_' + uuid4().hex
        self.admin = create_engine(self.url)
        with self.admin.begin() as connection:
            connection.execute(text(f'CREATE SCHEMA {self.schema}'))
        self.db = create_engine(self.url, isolation_level='READ COMMITTED', connect_args={'options': f'-csearch_path={self.schema}'})
        self.addCleanup(self.cleanup)
        self.config = Config(str(Path(__file__).parents[1] / 'alembic.ini'))
        with self.db.begin() as connection:
            self.config.attributes['connection'] = connection
            command.upgrade(self.config, 'head')
        self.catalog = Catalog.load(Path(__file__).parents[1] / 'game_data')
        self.store = Store(self.db, self.catalog)
        self.empire_id = self.store.bootstrap(now=1000)

    def cleanup(self):
        self.db.dispose()
        with self.admin.begin() as connection:
            connection.execute(text(f'DROP SCHEMA {self.schema} CASCADE'))
        self.admin.dispose()

    def snapshot(self):
        with Session(self.db) as session:
            empire = session.get(m.Empire, self.empire_id)
            return load(session, empire).to_dict()

    def restart(self):
        self.db.dispose()
        restarted = Store(self.db, self.catalog, seed='ignored-after-bootstrap')
        self.assertEqual(restarted.bootstrap(now=9999), self.empire_id)
        self.store = restarted

    def viable_target(self):
        state = self.snapshot()
        rules = next(iter(self.catalog.items['colonization'].values()))
        for x in range(state['system_x'] - 2, state['system_x'] + 3):
            for y in range(state['system_y'] - 2, state['system_y'] + 3):
                if (x, y) == (state['system_x'], state['system_y']):
                    continue
                for index, planet in enumerate(generate_system(state['seed'], x, y, self.catalog).planets):
                    if colonization_viability(planet, rules) == 'VIABLE':
                        return x, y, index
        self.fail('no viable colony target')

    def test_bootstrap_idempotent_and_concurrent(self):
        before = self.snapshot()
        barrier = Barrier(2)
        def boot():
            store = Store(self.db, self.catalog, seed='different')
            barrier.wait(timeout=10)
            return store.bootstrap(now=2000)
        with ThreadPoolExecutor(2) as pool:
            results = list(pool.map(lambda _: boot(), range(2)))
        self.assertEqual(results, [self.empire_id] * 2)
        self.assertEqual(before, self.snapshot())
        with Session(self.db) as session:
            for model in (m.Universe, m.Empire, m.Planet, m.StarSystem):
                self.assertEqual(session.scalar(select(func.count()).select_from(model)), 1)
            knowledge = session.get(m.SystemKnowledge, (self.empire_id, before['system_x'], before['system_y']))
            self.assertEqual(knowledge.knowledge_level, 'SURVEYED')

    def test_planet_cardinality_and_explicit_homeworld(self):
        with Session(self.db) as session, session.begin():
            empire = session.get(m.Empire, self.empire_id)
            home = session.get(m.Planet, empire.home_planet_id)
            self.assertEqual(home.planet_index, 0)
            self.assertEqual(home.empire_id, empire.id)
            system_id = home.system_id
            second = m.Planet(
                system_id=system_id,
                planet_index=1,
                empire_id=empire.id,
                population_total=5,
                created_at=utc(1000),
                last_updated=utc(1000),
            )
            session.add(second)
            session.flush()
            self.assertEqual(
                session.scalar(select(func.count()).select_from(m.Planet).where(m.Planet.empire_id == empire.id)),
                2,
            )
        with self.assertRaises(IntegrityError), Session(self.db) as session, session.begin():
            session.add(m.Planet(
                system_id=system_id,
                planet_index=1,
                empire_id=self.empire_id,
                population_total=5,
                created_at=utc(1000),
                last_updated=utc(1000),
            ))
            session.flush()
        with Session(self.db) as session:
            empire = session.get(m.Empire, self.empire_id)
            self.assertEqual(session.get(m.Planet, empire.home_planet_id).planet_index, 0)

    def test_planet_stocks_are_local_and_production_isolated(self):
        with Session(self.db) as session, session.begin():
            empire = session.get(m.Empire, self.empire_id)
            home = session.get(m.Planet, empire.home_planet_id)
            second = m.Planet(system_id=home.system_id, planet_index=1, empire_id=empire.id, population_total=20, created_at=utc(1000), last_updated=utc(1000))
            session.add(second)
            session.flush()
            session.add_all([
                m.PlanetStock(planet_id=second.id, resource_id='raw_ore', amount=0),
                m.PlanetStock(planet_id=second.id, resource_id='refined_alloy', amount=0),
                m.PlanetStock(planet_id=second.id, resource_id='components', amount=0),
                m.PlanetStock(planet_id=second.id, resource_id='ion_fuel', amount=0),
                m.District(planet_id=second.id, district_id='civil_district', level=1),
                m.District(planet_id=second.id, district_id='solar_field', level=3),
                m.District(planet_id=second.id, district_id='ore_extractor', level=1),
            ])
            second_id = second.id
        before = self.snapshot()['stocks']['raw_ore']
        self.store.run(self.empire_id, lambda e: None, now=1060)
        self.store.run(self.empire_id, lambda e: None, now=1060, planet_id=second_id)
        with Session(self.db) as session:
            empire = session.get(m.Empire, self.empire_id)
            home = load(session, empire)
            colony = load(session, empire, planet_id=second_id, catalog=self.catalog)
            self.assertGreater(home.stocks['raw_ore'], before)
            self.assertGreater(colony.stocks['raw_ore'], 0)
            self.assertEqual(colony.stocks['refined_alloy'], 0)
            self.assertEqual(colony.stocks['ion_fuel'], 0)
        with self.assertRaisesRegex(DataValidationError, 'locais'):
            self.store.run(self.empire_id, lambda e: e.build('processor', now=e.state.last_updated), now=1060, planet_id=second_id)

    def test_store_explicit_ownership_supports_two_empires(self):
        with Session(self.db) as session, session.begin():
            first = session.get(m.Empire, self.empire_id)
            system = session.get(m.StarSystem, first.home_system_id)
            universe = session.get(m.Universe, first.universe_id)
            state = Engine.new(self.catalog, universe.seed, now=1000).state
            second = m.Empire(
                id=uuid4(), universe_id=first.universe_id, home_system_id=system.id,
                name='Second Empire', last_updated=utc(1000), created_at=utc(1000),
            )
            session.add(second)
            session.flush()
            planet = m.Planet(
                system_id=system.id, planet_index=1, empire_id=second.id,
                population_total=state.population_total, created_at=utc(1000),
                last_updated=utc(1000),
            )
            session.add(planet)
            session.flush()
            second.home_planet_id = planet.id
            persist(session, second, planet, state)
            second_id = second.id
        self.store.run(self.empire_id, lambda e: e.state.stocks.update(raw_ore=1), now=1000)
        self.store.run(second_id, lambda e: e.state.stocks.update(raw_ore=2), now=1000)
        self.store.run(self.empire_id, lambda e: e._survey(state.system_x + 1, state.system_y, 1000), now=1000)
        with Session(self.db) as session:
            first = load(session, session.get(m.Empire, self.empire_id))
            second = load(session, session.get(m.Empire, second_id))
            self.assertEqual(first.stocks['raw_ore'], 1)
            self.assertEqual(second.stocks['raw_ore'], 2)
            self.assertEqual(first.system_knowledge.get(f'{state.system_x + 1}:{state.system_y}'), 1000)
            self.assertNotIn(f'{state.system_x + 1}:{state.system_y}', second.system_knowledge)

    def test_survey_knowledge_persists_and_is_unique(self):
        self.store.run(self.empire_id, lambda e: e.state.districts.update(orbital_shipyard=1), now=1000)
        ship = self.store.run(self.empire_id, lambda e: e.build_ship(now=e.state.last_updated), now=1000)
        state = self.snapshot()
        mission = self.store.run(
            self.empire_id,
            lambda e: e.send_fleet(state['system_x'] + 1, state['system_y'], 'chemical_drive', 'NORMAL', now=e.state.last_updated, mission='SURVEY'),
            now=ship['ready_at'],
        )
        self.store.run(self.empire_id, lambda e: None, now=mission['arrival_at'])
        self.restart()
        surveyed = self.snapshot()
        key = f"{state['system_x'] + 1}:{state['system_y']}"
        self.assertEqual(surveyed['system_knowledge'][key], mission['arrival_at'])
        with self.assertRaises(IntegrityError), Session(self.db) as session, session.begin():
            session.add(m.SystemKnowledge(empire_id=self.empire_id, system_x=state['system_x'] + 1, system_y=state['system_y'], knowledge_level='SURVEYED', surveyed_at=utc(mission['arrival_at'])))
            session.flush()

    def test_galaxy_read_does_not_materialize_unknown_systems(self):
        state = self.snapshot()
        systems = self.store.run(
            self.empire_id,
            lambda e: galaxy_snapshot(e, (state['system_x'], state['system_y']), 3),
            now=1000,
        )['systems']
        home = next(item for item in systems if item['home'])
        unknown = next(item for item in systems if item['knowledge_level'] == 'UNKNOWN')
        self.assertIn('planet', home)
        self.assertNotIn('planet', unknown)
        self.assertNotIn('star', unknown)
        with Session(self.db) as session:
            self.assertEqual(session.scalar(select(func.count()).select_from(m.StarSystem)), 1)
            self.assertEqual(session.scalar(select(func.count()).select_from(m.SystemKnowledge)), 1)

    def test_full_flow_reload_offline_and_two_trips(self):
        job = self.store.run(self.empire_id, lambda e: e.build('processor', now=e.state.last_updated), now=1000)
        pending = self.snapshot()
        self.assertEqual(len(pending['construction']), 1)
        self.restart()
        self.assertEqual(pending, self.snapshot())
        self.store.run(self.empire_id, lambda e: None, now=1060)
        state = self.snapshot()
        self.assertEqual(state['districts']['processor'], 1)
        self.assertAlmostEqual(state['stocks']['components'], 55 - 6 + (1060-job['complete_at'])/60*.25)
        research = self.store.run(self.empire_id, lambda e: e.research('orbital_engineering', now=e.state.last_updated), now=1060)
        self.store.run(self.empire_id, lambda e: None, now=1070)
        self.assertEqual(self.snapshot()['research']['remaining_work'], 35)
        self.restart()
        self.store.run(self.empire_id, lambda e: None, now=research['complete_at'])
        self.assertEqual(self.snapshot()['research']['completed_at']['orbital_engineering'], 1105)
        job = self.store.run(self.empire_id, lambda e: e.build('orbital_shipyard', now=e.state.last_updated), now=1105)
        ship = self.store.run(self.empire_id, lambda e: e.build_ship(now=e.state.last_updated), now=job['complete_at'])
        state = self.snapshot()
        self.assertEqual(state['ships'][0]['id'], ship['id'])
        x, y = state['system_x'], state['system_y']
        first = self.store.run(self.empire_id, lambda e: e.send_fleet(x+1, y, 'chemical_drive', 'NORMAL', now=e.state.last_updated), now=ship['ready_at'])
        self.restart()
        self.store.run(self.empire_id, lambda e: None, now=first['arrival_at'])
        state = self.snapshot()
        self.assertEqual(state['fleets'][0]['status'], 'ARRIVED')
        self.assertEqual(state['fleets'][0]['x'], x+1)
        second = self.store.run(self.empire_id, lambda e: e.send_fleet(x+2, y, 'chemical_drive', 'NORMAL', now=e.state.last_updated, fleet_id=first['id']), now=first['arrival_at'])
        self.assertEqual(second['preview']['distance'], 1)
        self.assertEqual(second['preview']['fuel_cost'], 10)
        self.assertEqual(second['id'], first['id'])
        self.restart()
        self.store.run(self.empire_id, lambda e: None, now=second['arrival_at'])
        state = self.snapshot()
        self.assertEqual(state['fleets'][0]['x'], x+2)
        self.assertEqual(state['stocks']['ion_fuel'], 60)
        with Session(self.db) as session:
            self.assertEqual(session.scalar(select(func.count()).select_from(m.FleetShip)), 1)
            self.assertEqual(session.scalar(select(func.count()).select_from(m.CompletedTechnology)), 1)

    def test_empty_bootstrap_concurrent(self):
        with self.db.begin() as connection:
            self.config.attributes['connection'] = connection
            command.downgrade(self.config, 'base')
            command.upgrade(self.config, 'head')
        barrier = Barrier(2)
        def boot():
            store = Store(self.db, self.catalog)
            barrier.wait(timeout=10)
            return store.bootstrap(now=1000)
        with ThreadPoolExecutor(2) as pool:
            results = list(pool.map(lambda _: boot(), range(2)))
        self.assertEqual(results[0], results[1])
        self.empire_id = results[0]
        self.assertEqual(self.snapshot()['population_total'], 100)
        with Session(self.db) as session:
            self.assertEqual(session.scalar(select(func.count()).select_from(m.Empire)), 1)

    def test_insufficient_fuel_rolls_back_advance_and_order(self):
        self.store.run(self.empire_id, lambda e: e.state.districts.update(orbital_shipyard=1), now=1000)
        ship = self.store.run(self.empire_id, lambda e: e.build_ship(now=e.state.last_updated), now=1000)
        self.store.run(self.empire_id, lambda e: e.state.stocks.update(ion_fuel=0), now=ship['ready_at'])
        before = self.snapshot()
        with self.assertRaises(DataValidationError):
            self.store.run(self.empire_id, lambda e: e.send_fleet(before['system_x']+1, before['system_y'], 'chemical_drive', 'NORMAL', now=e.state.last_updated), now=ship['ready_at']+10)
        self.assertEqual(before, self.snapshot())

    def test_rollback_after_mutation_and_database_failure(self):
        before = self.snapshot()
        def fail(e):
            e.build('processor', now=e.state.last_updated)
            raise DataValidationError('failure after resources debited')
        with self.assertRaises(DataValidationError):
            self.store.run(self.empire_id, fail, now=1010)
        self.assertEqual(before, self.snapshot())
        def invalid(e):
            e.state.stocks['raw_ore'] = -1
        with self.assertRaises(IntegrityError):
            self.store.run(self.empire_id, invalid, now=1010)
        self.assertEqual(before, self.snapshot())

    def test_concurrent_construction_cannot_double_spend(self):
        self.store.run(self.empire_id, lambda e: e.state.stocks.update(refined_alloy=22, components=6), now=1000)
        barrier = Barrier(2)
        def build():
            barrier.wait(timeout=10)
            try:
                self.store.run(self.empire_id, lambda e: e.build('processor', now=e.state.last_updated), now=1000)
                return 'success'
            except DataValidationError:
                return 'rejected'
        with ThreadPoolExecutor(2) as pool:
            results = list(pool.map(lambda _: build(), range(2)))
        self.assertCountEqual(results, ['success', 'rejected'])
        state = self.snapshot()
        self.assertEqual(len(state['construction']), 1)
        self.assertEqual(state['stocks']['refined_alloy'], 0)
        self.assertEqual(state['stocks']['components'], 0)

    def test_concurrent_shipyard_slot(self):
        self.store.run(self.empire_id, lambda e: e.state.districts.update(orbital_shipyard=1), now=1000)
        barrier = Barrier(2)
        def build():
            barrier.wait(timeout=10)
            try:
                self.store.run(self.empire_id, lambda e: e.build_ship(now=e.state.last_updated), now=1000)
                return 'success'
            except DataValidationError:
                return 'rejected'
        with ThreadPoolExecutor(2) as pool:
            results = list(pool.map(lambda _: build(), range(2)))
        self.assertCountEqual(results, ['success', 'rejected'])
        self.assertEqual(len(self.snapshot()['ships']), 1)

    def test_invalid_persisted_content_fails_on_startup(self):
        changed = copy.deepcopy(self.catalog)
        del changed.items['districts']['civil_district']
        with self.assertRaises(DataValidationError):
            Store(self.db, changed).bootstrap(now=2000)

    def test_migration_downgrade_upgrade(self):
        with self.db.begin() as connection:
            self.config.attributes['connection'] = connection
            command.downgrade(self.config, 'base')
            command.upgrade(self.config, 'head')
        self.empire_id = self.store.bootstrap(now=1000)
        self.assertEqual(self.snapshot()['population_total'], 100)

    def test_local_stock_migration_backfills_homeworld(self):
        with self.db.begin() as connection:
            self.config.attributes['connection'] = connection
            command.downgrade(self.config, '4a6d1c9e8b20')
        with self.db.begin() as connection:
            connection.execute(text("UPDATE empire_stock SET amount = 321 WHERE empire_id = :empire AND resource_id = 'raw_ore'"), {'empire': self.empire_id})
        with self.db.begin() as connection:
            self.config.attributes['connection'] = connection
            command.upgrade(self.config, 'head')
        with Session(self.db) as session:
            empire = session.get(m.Empire, self.empire_id)
            home_stock = session.scalar(select(m.PlanetStock).where(m.PlanetStock.planet_id == empire.home_planet_id, m.PlanetStock.resource_id == 'raw_ore'))
            self.assertEqual(home_stock.amount, 321)
            self.assertEqual(session.scalar(select(func.count()).select_from(m.PlanetStock).where(m.PlanetStock.resource_id == 'raw_ore')), 1)

    def test_exploration_migration_downgrade_upgrade_and_backfill(self):
        fleet_id = uuid4()
        with Session(self.db) as session, session.begin():
            session.add(m.Fleet(id=fleet_id, empire_id=self.empire_id, name='Legacy Fleet', x=0, y=0, destination_x=0, destination_y=0, status='ARRIVED', mission='MOVE', departure_at=utc(1000), arrival_at=utc(1000), propulsion_id='chemical_drive', mode='NORMAL', fuel_cost=0))
        with self.db.begin() as connection:
            self.config.attributes['connection'] = connection
            command.downgrade(self.config, '2c4f8a1b9e77')
            command.upgrade(self.config, 'head')
        with Session(self.db) as session:
            knowledge = session.scalar(select(m.SystemKnowledge).where(m.SystemKnowledge.empire_id == self.empire_id))
            self.assertEqual(knowledge.knowledge_level, 'SURVEYED')
            self.assertEqual(session.get(m.Fleet, fleet_id).mission, 'MOVE')

    def test_database_unique_ownership(self):
        self.store.run(self.empire_id, lambda e: e.state.districts.update(orbital_shipyard=1), now=1000)
        ship = self.store.run(self.empire_id, lambda e: e.build_ship(now=e.state.last_updated), now=1000)
        state = self.snapshot()
        fleet = self.store.run(self.empire_id, lambda e: e.send_fleet(state['system_x']+1, state['system_y'], 'chemical_drive', 'NORMAL', now=e.state.last_updated), now=ship['ready_at'])
        from uuid import UUID
        with self.assertRaises(IntegrityError), Session(self.db) as session, session.begin():
            other = m.Fleet(id=uuid4(), empire_id=self.empire_id, name='Other', x=0, y=0, destination_x=1, destination_y=0, status='TRANSIT', departure_at=utc(1030), arrival_at=utc(1200), propulsion_id='chemical_drive', mode='NORMAL', fuel_cost=10)
            session.add(other)
            session.flush()
            session.add(m.FleetShip(fleet_id=other.id, ship_id=UUID(ship['id']), empire_id=self.empire_id))
        self.assertEqual(self.snapshot()['fleets'][0]['id'], fleet['id'])

    def test_colony_materializes_on_arrival_and_planet_state_isolated(self):
        target = self.viable_target()
        self.store.run(self.empire_id, lambda e: (e.state.districts.update(orbital_shipyard=1), e._survey(target[0], target[1], e.state.last_updated)), now=1000)
        ship = self.store.run(self.empire_id, lambda e: e.build_ship(now=e.state.last_updated), now=1000)
        state = self.snapshot()
        first = self.store.run(self.empire_id, lambda e: e.send_fleet(state['system_x'] - 1, state['system_y'], 'chemical_drive', 'ECONOMY', now=e.state.last_updated), now=ship['ready_at'])
        self.store.run(self.empire_id, lambda e: None, now=first['arrival_at'])
        colony = self.store.run(
            self.empire_id,
            lambda e: e.send_fleet(target[0], target[1], 'chemical_drive', 'ECONOMY', now=e.state.last_updated, fleet_id=first['id'], mission='COLONIZE', target_planet_index=target[2]),
            now=first['arrival_at'], colony_target=target,
        )
        with Session(self.db) as session:
            self.assertEqual(session.scalar(select(func.count()).select_from(m.StarSystem)), 1)
        self.store.run(self.empire_id, lambda e: None, now=colony['arrival_at'])
        self.restart()
        state = self.snapshot()
        self.assertEqual(len(state['planets']), 2)
        remote = next(item for item in state['planets'] if not item['home'])
        self.assertEqual((remote['x'], remote['y'], remote['planet_index']), target)
        self.assertEqual(remote['population_total'], 20)
        home_districts = dict(state['districts'])
        job = self.store.run(self.empire_id, lambda e: e.build('ore_extractor', now=e.state.last_updated), now=colony['arrival_at'], planet_id=remote['id'])
        self.store.run(self.empire_id, lambda e: None, now=job['complete_at'])
        self.store.run(self.empire_id, lambda e: None, now=job['complete_at'], planet_id=remote['id'])
        with Session(self.db) as session:
            empire = session.get(m.Empire, self.empire_id)
            home = load(session, empire)
            remote_state = load(session, empire, planet_id=remote['id'], catalog=self.catalog)
            self.assertEqual(home.districts, home_districts)
            self.assertEqual(remote_state.districts['ore_extractor'], 1)
            self.assertEqual(remote_state.population_total, 20)
            self.assertEqual(session.scalar(select(func.count()).select_from(m.Planet).where(m.Planet.empire_id == self.empire_id)), 2)

    def test_survey_then_colonize_smoke(self):
        target = self.viable_target()
        self.store.run(self.empire_id, lambda e: e.state.districts.update(orbital_shipyard=1), now=1000)
        ship = self.store.run(self.empire_id, lambda e: e.build_ship(now=e.state.last_updated), now=1000)
        survey = self.store.run(self.empire_id, lambda e: e.send_fleet(target[0], target[1], 'chemical_drive', 'ECONOMY', now=e.state.last_updated, ship_id=ship['id'], mission='SURVEY'), now=ship['ready_at'])
        self.store.run(self.empire_id, lambda e: None, now=survey['arrival_at'])
        state = self.snapshot()
        self.assertIn(f'{target[0]}:{target[1]}', state['system_knowledge'])
        back = self.store.run(self.empire_id, lambda e: e.send_fleet(state['system_x'], state['system_y'], 'chemical_drive', 'ECONOMY', now=e.state.last_updated, fleet_id=survey['id']), now=survey['arrival_at'])
        self.store.run(self.empire_id, lambda e: None, now=back['arrival_at'])
        mission = self.store.run(self.empire_id, lambda e: e.send_fleet(target[0], target[1], 'chemical_drive', 'ECONOMY', now=e.state.last_updated, fleet_id=survey['id'], mission='COLONIZE', target_planet_index=target[2]), now=back['arrival_at'], colony_target=target)
        self.restart()
        self.store.run(self.empire_id, lambda e: None, now=mission['arrival_at'])
        colony = next(item for item in self.snapshot()['planets'] if not item['home'])
        home_before = dict(self.snapshot()['districts'])
        job = self.store.run(self.empire_id, lambda e: e.build('ore_extractor', now=e.state.last_updated), now=mission['arrival_at'], planet_id=colony['id'])
        self.store.run(self.empire_id, lambda e: None, now=job['complete_at'], planet_id=colony['id'])
        with Session(self.db) as session:
            empire = session.get(m.Empire, self.empire_id)
            self.assertEqual(load(session, empire).districts, home_before)
            self.assertEqual(load(session, empire, planet_id=colony['id']).districts['ore_extractor'], 1)

    def test_colonization_target_is_reserved_between_empires(self):
        target = self.viable_target()
        with Session(self.db) as session, session.begin():
            first = session.get(m.Empire, self.empire_id)
            home_system = session.get(m.StarSystem, first.home_system_id)
            second = m.Empire(universe_id=first.universe_id, home_system_id=home_system.id, name='Colonial Rival', last_updated=utc(1000), created_at=utc(1000))
            session.add(second)
            session.flush()
            planet = m.Planet(system_id=home_system.id, planet_index=1, empire_id=second.id, population_total=100, created_at=utc(1000), last_updated=utc(1000))
            session.add(planet)
            session.flush()
            second.home_planet_id = planet.id
            state = Engine.new(self.catalog, now=1000).state
            state.system_x, state.system_y = home_system.x, home_system.y
            persist(session, second, planet, state)
            second_id = second.id

        def prepare(empire_id):
            self.store.run(empire_id, lambda e: (e.state.districts.update(orbital_shipyard=1), e._survey(target[0], target[1], e.state.last_updated)), now=1000)
            ship = self.store.run(empire_id, lambda e: e.build_ship(now=e.state.last_updated), now=1000)
            state = self.store.run(empire_id, lambda e: e.state.to_dict(), now=ship['ready_at'])
            trip = self.store.run(empire_id, lambda e: e.send_fleet(state['system_x'] - 1, state['system_y'], 'chemical_drive', 'ECONOMY', now=e.state.last_updated), now=ship['ready_at'])
            self.store.run(empire_id, lambda e: None, now=trip['arrival_at'])
            return trip['id'], trip['arrival_at']

        prepared = {empire_id: prepare(empire_id) for empire_id in (self.empire_id, second_id)}
        barrier = Barrier(2)

        def claim(empire_id):
            fleet_id, now = prepared[empire_id]
            barrier.wait(timeout=10)
            try:
                self.store.run(empire_id, lambda e: e.send_fleet(target[0], target[1], 'chemical_drive', 'ECONOMY', now=e.state.last_updated, fleet_id=fleet_id, mission='COLONIZE', target_planet_index=target[2]), now=now, colony_target=target)
                return 'success'
            except DataValidationError:
                return 'rejected'

        with ThreadPoolExecutor(2) as pool:
            results = list(pool.map(claim, (self.empire_id, second_id)))
        self.assertCountEqual(results, ['success', 'rejected'])
