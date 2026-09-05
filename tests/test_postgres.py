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
from starz.db import models as m
from starz.db.store import Store, load, persist, utc
from starz.simulation import Engine
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
            ))
            session.flush()
        with Session(self.db) as session:
            empire = session.get(m.Empire, self.empire_id)
            self.assertEqual(session.get(m.Planet, empire.home_planet_id).planet_index, 0)

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
            )
            session.add(planet)
            session.flush()
            second.home_planet_id = planet.id
            persist(session, second, planet, state)
            second_id = second.id
        self.store.run(self.empire_id, lambda e: e.state.stocks.update(raw_ore=1), now=1000)
        self.store.run(second_id, lambda e: e.state.stocks.update(raw_ore=2), now=1000)
        with Session(self.db) as session:
            first = load(session, session.get(m.Empire, self.empire_id))
            second = load(session, session.get(m.Empire, second_id))
            self.assertEqual(first.stocks['raw_ore'], 1)
            self.assertEqual(second.stocks['raw_ore'], 2)

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
