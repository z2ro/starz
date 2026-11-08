"""Stellar construction contracts; SQL cases reuse the isolated persistent DB fixture."""
from copy import deepcopy
from types import SimpleNamespace
from uuid import uuid4, uuid5
import os
import runpy
import unittest
from unittest.mock import MagicMock

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import test_persistent_universe as persistent_tests
import test_research_domains as research_tests
from starz.data import Catalog, DataValidationError
from starz.db import models as m
from starz.db.store import load, utc
from starz.persistent import stellar
from starz.persistent.service import PersistentStore
from starz.simulation import Engine


class StellarRules(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = Catalog.load('game_data', 'persistent_data')

    engine = research_tests.ResearchDomains.engine

    def fixture(self):
        e = self.engine()
        e.state.planet_id = str(uuid4())
        e.state.universe['levels'].update(precision_manufacturing=1, extreme_materials=1)
        e.state.districts.update(processor=3, solar_field=100)
        e.state.population_total = 1000
        empire = SimpleNamespace(id=uuid4(), universe_id=uuid4())
        planet = SimpleNamespace(id=stellar.identifier(e.state.planet_id), empire_id=empire.id,
                                 system_id=uuid4())
        system = SimpleNamespace(id=planet.system_id, universe_id=empire.universe_id)
        session = MagicMock()
        session.get.side_effect = lambda model, key: planet if model is m.Planet else system if model is m.StarSystem else None
        return session, empire, e

    def test_canonical_identity_and_profile(self):
        system = uuid4()
        self.assertEqual(stellar.canonical_source_id(system), uuid5(system, 'star:0'))
        self.assertNotEqual(stellar.canonical_source_id(system), stellar.canonical_source_id(uuid4()))
        self.assertEqual(tuple(kind for kind, _ in stellar.PHASES),
                         ('containment', 'shielding', 'control', 'propulsion', 'weapons'))
        self.assertTrue(all(value > 0 for value in stellar.MODULE_COST.values()))
        self.assertEqual(set(stellar.MODULE_COST), {'refined_alloy', 'components'})
        self.assertGreater(stellar.MODULE_CARGO, 0)
        self.assertIn('experimental', stellar.PROFILE)

    def test_manufacture_pays_local_stocks_and_snapshots_actual_industry(self):
        session, empire, e = self.fixture()
        before = dict(e.state.stocks)
        result = stellar.manufacture(session, empire, e, 'containment', 'make-1')
        for key, value in stellar.MODULE_COST.items():
            self.assertEqual(e.state.stocks[key], before[key] - value)
        objects = [call.args[0] for call in session.add.call_args_list]
        order = next(obj for obj in objects if isinstance(obj, m.UniverseOrder))
        module = next(obj for obj in objects if isinstance(obj, m.StellarModule))
        self.assertEqual(order.kind, 'stellar_module')
        self.assertEqual(module.origin_planet_id, stellar.identifier(e.state.planet_id))
        self.assertEqual(module.status, 'manufacturing')
        self.assertIsNone(module.project_id)
        self.assertEqual(order.payload['cost'], stellar.MODULE_COST)
        self.assertGreater(order.payload['industry'], 0)
        self.assertGreater(result['complete_at'], e.state.last_updated)
        self.assertEqual(order.payload['work'], stellar.MODULE_WORK)

    def test_manufacture_rejects_missing_science_industry_and_wrong_owner_before_payment(self):
        for condition in ('science', 'industry', 'owner'):
            with self.subTest(condition=condition):
                session, empire, e = self.fixture()
                if condition == 'science':
                    e.state.universe['levels'].pop('extreme_materials')
                elif condition == 'industry':
                    e.state.districts.clear()
                else:
                    empire.id = uuid4()
                before = dict(e.state.stocks)
                with self.assertRaises(DataValidationError):
                    stellar.manufacture(session, empire, e, 'control', condition)
                self.assertEqual(before, e.state.stocks)
                session.add.assert_not_called()

    def test_completion_rejects_early_or_foreign_event(self):
        session, empire, e = self.fixture()
        order = SimpleNamespace(kind='stellar_module', payload={}, empire_id=empire.id,
                                universe_id=empire.universe_id, due_at=utc(e.state.last_updated + 10))
        session.get.side_effect = lambda model, key: empire if model is m.Empire else None
        with self.assertRaisesRegex(DataValidationError, 'ainda não venceu'):
            stellar.complete(None, session, order, {str(empire.id): e})
        order.universe_id = uuid4()
        with self.assertRaisesRegex(DataValidationError, 'império válido'):
            stellar.complete(None, session, order, {str(empire.id): e})
        self.assertFalse(stellar.complete(None, session, SimpleNamespace(kind='mission'), {}))

    def test_downgrade_refuses_stellar_records_or_active_orders_before_any_drop(self):
        migration = runpy.run_path('migrations/versions/d05e00000001_stellar_projects.py')
        operations = MagicMock()
        operations.get_bind.return_value.scalar.return_value = True
        migration['downgrade'].__globals__['op'] = operations
        with self.assertRaisesRegex(RuntimeError, 'rollback must preserve'):
            migration['downgrade']()
        sql = str(operations.get_bind.return_value.scalar.call_args.args[0])
        for table in ('stellar_source', 'stellar_project', 'stellar_module', 'stellar_unit'):
            self.assertIn('EXISTS (SELECT 1 FROM ' + table + ')', sql)
        self.assertIn('NOT resolved', sql)
        self.assertIn("'stellar_module', 'stellar_phase', 'stellar_action'", sql)
        self.assertIn('STELLAR_DELIVERY', sql)
        operations.drop_table.assert_not_called()
        operations.drop_index.assert_not_called()
        operations.drop_constraint.assert_not_called()

    def test_empty_stellar_schema_downgrade_can_drop_only_new_tables_and_constraints(self):
        migration = runpy.run_path('migrations/versions/d05e00000001_stellar_projects.py')
        operations = MagicMock()
        operations.get_bind.return_value.scalar.return_value = False
        migration['downgrade'].__globals__['op'] = operations
        migration['downgrade']()
        self.assertEqual([call.args[0] for call in operations.drop_table.call_args_list],
                         ['stellar_unit', 'stellar_module', 'stellar_project', 'stellar_source'])
        self.assertEqual(operations.drop_index.call_count, 1)
        self.assertEqual(operations.drop_constraint.call_count, 4)


@unittest.skipUnless(os.getenv('PERSISTENT_TEST_DATABASE_URL'), 'isolated PostgreSQL required')
class StellarProjects(unittest.TestCase):
    setUpClass = classmethod(persistent_tests.SharedUniverse.setUpClass.__func__)
    tearDownClass = classmethod(persistent_tests.SharedUniverse.tearDownClass.__func__)
    sequence = 0

    def setUp(self):
        type(self).sequence += 1
        self.x, self.y = 30 + self.sequence, 20
        self.now = 1000.0
        self.store = PersistentStore(self.db, self.catalog, clock=lambda: self.now)
        with Session(self.db) as session, session.begin():
            self.store.lock(session)
            self.empire_id = self.store.create_player(session, 'stellar_' + uuid4().hex[:12]).id
        def prepare(session, empire, e):
            e.state.universe['levels'] = {t.id: 5 if t.kind == 'repeatable' else 1
                                          for t in self.catalog.items['technologies'].values()}
            e.state.research['completed'] = list(e.state.universe['levels'])
            e.state.research['completed_at'] = {key: self.now for key in e.state.research['completed']}
            e.state.system_knowledge[f'{self.x}:{self.y}'] = self.now
            e.state.population_total = 1000
            e.state.districts.update(processor=5, solar_field=100, orbital_shipyard=10,
                                    research_lab=15, civil_lab=1, military_lab=1, fundamental_lab=1)
            e.state.stocks.update(refined_alloy=10000, components=10000, ion_fuel=10000, fusion_fuel=10000)
        self.call(prepare)

    def call(self, function):
        # Drive the same service transaction, but completion explicitly, until parent settler integration.
        with Session(self.db) as session, session.begin():
            self.store.lock(session)
            empire = session.get(m.Empire, self.empire_id)
            e = Engine(self.catalog, load(session, empire, catalog=self.catalog))
            e.advance(self.now)
            result = function(session, empire, e)
            self.store.save(session, empire.id, e)
            return result

    def reserve(self, key='reserve'):
        return self.call(lambda session, empire, e: stellar.reserve(session, empire, e, self.x, self.y, key))

    def finish(self, order_id):
        def run(session, empire, e):
            order = session.get(m.UniverseOrder, order_id)
            self.assertTrue(stellar.complete(self.store, session, order, {str(empire.id): e}))
            self.assertTrue(stellar.complete(self.store, session, order, {str(empire.id): e}))
            order.resolved = True
        self.call(run)

    def make(self, kind):
        result = self.call(lambda session, empire, e: stellar.manufacture(session, empire, e, kind, 'make-' + kind))
        self.now = result['complete_at']
        with Session(self.db) as session:
            order_id = session.get(m.StellarModule, stellar.identifier(result['module_id'])).manufacture_order_id
        self.finish(order_id)
        return result['module_id']

    def test_reservation_cancel_replay_conflict_and_reopen(self):
        result = self.reserve()
        self.assertEqual(self.reserve(), result)
        with self.assertRaisesRegex(DataValidationError, 'conflitante'):
            self.call(lambda s, a, e: stellar.reserve(s, a, e, self.x + 1, self.y, 'reserve'))
        with self.assertRaisesRegex(DataValidationError, 'reservada'):
            self.reserve('different-request')
        cancelled = self.call(lambda s, a, e: stellar.cancel_project(s, a, e, result['project_id'], 'cancel'))
        self.assertEqual(cancelled['status'], 'cancelled')
        self.assertEqual(self.call(lambda s, a, e: stellar.cancel_project(s, a, e, result['project_id'], 'cancel')), cancelled)
        reopened = self.reserve('reopen')
        self.assertEqual(reopened['source_id'], result['source_id'])
        self.assertNotEqual(reopened['project_id'], result['project_id'])
        # Retrying the old reserve cannot reactivate a cancelled project.
        self.assertEqual(self.reserve(), result)

    def test_unknown_home_inhabited_and_colonial_commitments_rejected(self):
        with self.assertRaises(DataValidationError):
            self.call(lambda s, a, e: stellar.reserve(s, a, e, self.x + 1, self.y, 'unknown'))
        with self.assertRaisesRegex(DataValidationError, 'natal'):
            self.call(lambda s, a, e: stellar.reserve(s, a, e, e.state.home_system_x, e.state.home_system_y, 'home'))
        def committed(session, empire, e):
            session.add(m.Fleet(id=uuid4(), empire_id=empire.id, name='Synthetic colonial commitment',
                x=e.state.system_x, y=e.state.system_y, destination_x=self.x, destination_y=self.y,
                status='TRANSIT', mission='COLONIZE', target_planet_index=0,
                colonization_population=10, colonization_origin_planet_id=empire.home_planet_id,
                fuel_reserve=10, departure_at=utc(self.now), arrival_at=utc(self.now + 10000),
                propulsion_id='chemical_drive', mode='NORMAL', fuel_cost=10))
            session.flush()
            with self.assertRaisesRegex(DataValidationError, 'Colonização'):
                stellar.reserve(session, empire, e, self.x, self.y, 'colonial')
        # Avoid persisting the synthetic fleet through Engine's fleet reconciliation.
        with Session(self.db) as session, session.begin():
            self.store.lock(session)
            empire = session.get(m.Empire, self.empire_id)
            committed(session, empire, Engine(self.catalog, load(session, empire, catalog=self.catalog)))

    def test_five_phases_real_modules_removal_and_single_commission(self):
        project = self.reserve()
        module_ids = [self.make(kind) for kind in stellar.MODULE_KINDS]
        ship = self.call(lambda s, a, e: e.build_ship('wayfarer_hull', 'chemical_drive', 'ion_fuel', now=self.now))
        self.now = ship['ready_at']
        def dispatch(session, empire, e):
            fleet = self.store.dispatch(session, empire, e, {
                'mission': 'STELLAR_DELIVERY', 'ship_ids': [ship['id']],
                'x': self.x, 'y': self.y, 'planet_index': None,
                'stellar_project_id': project['project_id'], 'module_ids': module_ids,
                'cargo': {'fusion_fuel': 20}})
            session.flush()
            order = next(order for order in session.scalars(select(m.UniverseOrder).where(
                m.UniverseOrder.empire_id == empire.id, m.UniverseOrder.kind == 'mission',
                m.UniverseOrder.resolved == False)) if order.payload['fleet_id'] == fleet['id'])
            return order.id, fleet['arrival_at']
        order_id, self.now = self.call(dispatch)
        def deliver(session, empire, e):
            order = session.get(m.UniverseOrder, order_id)
            from starz.persistent.stellar_delivery import deliver
            deliver(session, order, e)
            order.resolved = True
        self.call(deliver)
        for phase in range(1, 6):
            result = self.call(lambda s, a, e: stellar.start_phase(s, a, e, project['project_id'], f'phase-{phase}'))
            with Session(self.db) as session:
                source = session.get(m.StellarSource, stellar.identifier(project['source_id']))
                self.assertEqual(source.removed_at is not None, phase > 2)
            with self.assertRaisesRegex(DataValidationError, 'andamento'):
                self.call(lambda s, a, e: stellar.start_phase(s, a, e, project['project_id'], f'duplicate-{phase}'))
            self.now = result['complete_at']
            self.finish(stellar.identifier(result['order_id']))
            with Session(self.db) as session:
                saved = session.get(m.StellarProject, stellar.identifier(project['project_id']))
                source = session.get(m.StellarSource, saved.source_id)
                self.assertEqual(saved.completed_phases, phase)
                self.assertEqual(source.removed_at is not None, phase >= 2)
                self.assertEqual(sum(r['completed'] for r in saved.phase_records), phase)
        with Session(self.db) as session:
            unit = session.scalar(select(m.StellarUnit).where(m.StellarUnit.project_id == stellar.identifier(project['project_id'])))
            self.assertEqual(unit.state, 'operational')
            self.assertEqual(unit.stocks, {'fusion_fuel': 20})
            self.assertEqual(set(unit.payload['subsystems']), set(stellar.MODULE_KINDS))
            saved = session.get(m.StellarProject, unit.project_id)
            self.assertEqual(saved.stocks, {})
            self.assertEqual(saved.status, 'commissioned')
            modules = session.scalars(select(m.StellarModule).where(m.StellarModule.project_id == unit.project_id)).all()
            self.assertEqual({module.consumed_phase for module in modules}, set(range(1, 6)))
            self.assertTrue(all(module.status == 'consumed' for module in modules))
            self.assertNotIn(str(unit.id), {str(ship.id) for ship in session.scalars(select(m.Ship))})

    def test_undelivered_module_cannot_advance_and_manufacture_retry_does_not_charge(self):
        project = self.reserve()
        made = self.call(lambda s, a, e: stellar.manufacture(s, a, e, 'containment', 'retry'))
        before = self.call(lambda s, a, e: dict(e.state.stocks))
        self.assertEqual(self.call(lambda s, a, e: stellar.manufacture(s, a, e, 'containment', 'retry')), made)
        self.assertEqual(self.call(lambda s, a, e: dict(e.state.stocks)), before)
        with self.assertRaisesRegex(DataValidationError, 'módulo físico entregue'):
            self.call(lambda s, a, e: stellar.start_phase(s, a, e, project['project_id'], 'phase'))
        with self.assertRaisesRegex(DataValidationError, 'conflitante'):
            self.call(lambda s, a, e: stellar.manufacture(s, a, e, 'weapons', 'retry'))

    def test_source_foreign_universe_fk_and_snapshot_privacy(self):
        result = self.reserve()
        with Session(self.db) as session, session.begin():
            source = session.get(m.StellarSource, stellar.identifier(result['source_id']))
            other = m.Universe(id=uuid4(), name='synthetic_' + uuid4().hex, seed='synthetic', created_at=utc(self.now))
            session.add(other)
            session.flush()
            separate_system = m.StarSystem(id=uuid4(), universe_id=source.universe_id,
                                           x=90, y=90, created_at=utc(self.now))
            session.add(separate_system)
            session.flush()
            with self.assertRaises(IntegrityError), session.begin_nested():
                session.add(m.StellarSource(id=stellar.canonical_source_id(separate_system.id), universe_id=other.id,
                    origin_system_id=separate_system.id, removed_at=None, created_at=utc(self.now)))
                session.flush()
        def private(session, empire, e):
            other = self.store.create_player(session, 'observer_' + uuid4().hex[:10])
            observer = Engine(self.catalog, load(session, other, catalog=self.catalog))
            view = stellar.snapshot(session, other, observer)
            self.assertEqual(view['projects'], [])
            self.assertEqual(view['modules'], [])
            self.assertEqual(view['units'], [])
        self.call(private)
