"""Physical sealed-core transport: native quotes, real ORM rows, no database."""
import copy
import os
import unittest
from uuid import UUID, uuid4
from unittest.mock import Mock

from sqlalchemy import select
from sqlalchemy.orm import Session

from starz.data import Catalog, DataValidationError
from starz.db import models as m
from starz.db.store import utc, epoch
from starz.persistent import stellar_transport as transport
from starz.persistent.stellar import MODULE_CARGO
from test_combat3 import engine
from test_stargrave import MemorySession
import test_stellar_custody as custody_fixtures
from starz.persistent import stellar, stellar_custody as custody


class StellarTransport(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = Catalog.load('game_data', 'persistent_data')

    def setUp(self):
        self.universe = UUID(int=1)
        self.actor = m.Empire(id=UUID(int=2), universe_id=self.universe)
        self.sender = m.Empire(id=UUID(int=3), universe_id=self.universe)
        self.origin_system = m.StarSystem(id=UUID(int=4), universe_id=self.universe, x=0, y=0)
        self.pickup_system = m.StarSystem(id=UUID(int=5), universe_id=self.universe, x=1, y=0)
        self.source_system = m.StarSystem(id=UUID(int=6), universe_id=self.universe, x=3, y=0)
        self.origin = m.Planet(id=UUID(int=7), system_id=self.origin_system.id, empire_id=self.actor.id)
        self.pickup = m.Planet(id=UUID(int=8), system_id=self.pickup_system.id, empire_id=self.actor.id)
        self.source = m.StellarSource(id=UUID(int=9), universe_id=self.universe,
            origin_system_id=self.source_system.id, removed_at=utc(900))
        self.core = m.StellarUnit(id=UUID(int=10), universe_id=self.universe, source_id=self.source.id,
            project_id=UUID(int=11), empire_id=self.sender.id, custodian_empire_id=self.actor.id,
            custody_version=1, state='sealed_wreck', system_id=self.pickup_system.id,
            planet_id=self.pickup.id, stocks={'fusion_fuel': 20},
            payload={'hp': 0, 'shield': 0, 'energy': 0, 'defeated_at': 800})
        self.tug = m.StellarModule(id=UUID(int=12), universe_id=self.universe, empire_id=self.actor.id,
            kind='propulsion', status='committed', current_planet_id=self.origin.id,
            origin_planet_id=self.origin.id, fleet_id=None, operation_id=UUID(int=13))
        self.op = m.StellarOperation(id=UUID(int=13), universe_id=self.universe, source_id=self.source.id,
            unit_id=self.core.id, actor_id=self.actor.id, kind='repatriate', status='pending',
            system_id=self.pickup_system.id, planet_id=self.pickup.id, custody_version=1,
            payload={'module_ids': [str(self.tug.id)]}, created_at=utc(1000))
        self.e = engine(self.catalog, str(self.origin.id), dict.fromkeys(
            ('mobile_stellar_confinement', 'gravitational_propulsion', 'stellar_logistics'), 1))
        self.e.state.system_x, self.e.state.system_y = 0, 0
        self.e.state.stocks['fusion_fuel'] = 100000
        hull = self.catalog.get('ships', 'wayfarer_hull')
        self.ship = {'id': str(UUID(int=14)), 'hull_id': hull.id, 'mass': hull.mass, 'crew': hull.crew,
            'propulsion_id': 'nuclear_drive', 'fuel_id': 'fusion_fuel', 'ready_at': 0,
            'system_x': 0, 'system_y': 0, 'origin_planet_id': str(self.origin.id)}
        self.e.state.ships = [self.ship]
        self.session = MemorySession(self.actor, self.sender, self.origin_system, self.pickup_system,
            self.source_system, self.origin, self.pickup, self.source, self.core, self.tug, self.op)
        self.store = Mock()
        self.store.relation.return_value = {'status': 'neutral'}

    def plan(self):
        return transport.prepare(self.session, self.actor, self.e, {
            'operation_id': str(self.op.id), 'ship_ids': [self.ship['id']]})

    def launch(self):
        plan = self.plan()
        self.e._pay({plan['fuel_id']: plan['total_fuel']})
        first = plan['leg1']; now = self.e.state.last_updated
        fleet = {'id': str(UUID(int=15)), 'ship_ids': [self.ship['id']], 'x': 0, 'y': 0,
            'destination_x': first['destination'][0], 'destination_y': first['destination'][1],
            'status': 'TRANSIT', 'mission': 'MOVE', 'fuel_reserve': plan['reserve'],
            'departure_at': now, 'arrival_at': now+first['duration'], 'fuel_cost': first['fuel']}
        self.e.state.fleets.append(fleet)
        order = m.UniverseOrder(id=UUID(int=16), universe_id=self.universe, empire_id=self.actor.id,
            kind='mission', due_at=utc(fleet['arrival_at']), resolved=False,
            payload={'mission': 'CORE_PICKUP', 'operation_id': str(self.op.id), 'fleet_id': fleet['id'],
                'origin_planet': str(self.origin.id), 'origin': [0,0], 'target': None, 'cargo': {},
                'duration': first['duration'], 'fuel': first['fuel']})
        self.session.add(order)
        transport.launch(self.session, self.actor, self.e, plan, fleet, order)
        return plan, fleet, order

    def arrive(self, fleet, order):
        self.e.state.last_updated = epoch(order.due_at)
        fleet.update(status='ARRIVED', x=fleet['destination_x'], y=fleet['destination_y'])
        transport.complete(self.store, self.session, order, {str(self.actor.id): self.e})

    def next_order(self, mission, stage=None):
        orders = [r for (kind, _), r in self.session.rows.items() if kind is m.UniverseOrder
                  and r.payload.get('mission') == mission and not r.payload.get('applied') and not r.resolved]
        if stage:
            orders = [o for o in orders if o.payload.get('return_stage') == stage]
        self.assertEqual(len(orders), 1)
        return orders[0]

    def withdrawal(self):
        self.op.kind = 'withdraw'
        self.op.payload['destination_planet_id'] = str(self.origin.id)
        self.pickup.empire_id = self.sender.id
        self.core.payload['withdrawal_grant'] = {'recipient_id': str(self.actor.id),
            'sender_id': str(self.sender.id), 'planet_id': str(self.pickup.id), 'custody_version': 1}

    def test_plan_is_read_only_prices_real_loaded_mass_and_recall_reserve(self):
        before = copy.deepcopy((self.e.state.to_dict(), self.op.payload, self.core.payload, self.core.stocks))
        plan = self.plan()
        self.assertEqual(plan['coords'], [1,0]); self.assertEqual(plan['destination'], [3,0])
        unloaded = transport._quote(self.e, [self.ship], [1,0], [3,0])
        self.assertGreater(plan['leg2']['fuel'], unloaded['fuel'])
        self.assertEqual(plan['total_fuel'], plan['leg1']['fuel']+plan['reserve'])
        self.assertGreaterEqual(plan['reserve'], 2*plan['leg2']['fuel']+plan['loaded_home']['fuel'])
        self.assertEqual(plan['capacity_cargo'], transport.CORE_CARGO+20)
        self.assertEqual(before, (self.e.state.to_dict(), self.op.payload, self.core.payload, self.core.stocks))

    def test_pickup_consumes_real_tug_once_then_reinstalls_original_source_and_native_return(self):
        plan, fleet, first = self.launch()
        fuel_paid = self.e.state.stocks['fusion_fuel']
        self.assertEqual(self.tug.status, 'transit')
        self.assertEqual(self.core.planet_id, self.pickup.id)
        self.arrive(fleet, first)
        self.assertEqual(self.tug.status, 'consumed')
        self.assertEqual(self.core.state, 'core_transit'); self.assertIsNone(self.core.planet_id)
        self.assertIsNotNone(self.source.removed_at)
        second = self.next_order('CORE_TRANSPORT')
        before = copy.deepcopy((self.core.payload, fleet))
        transport.complete(self.store, self.session, first, {str(self.actor.id): self.e})
        self.assertEqual(before, (self.core.payload, fleet))
        self.arrive(fleet, second)
        self.assertEqual(self.core.state, 'reinstalled')
        self.assertEqual(self.core.system_id, self.source_system.id)
        self.assertIsNone(self.source.removed_at)
        self.assertEqual(self.op.status, 'completed')
        self.assertEqual(self.core.source_id, self.source.id)
        self.assertEqual(self.core.stocks, {'fusion_fuel': 20})
        self.assertEqual(self.core.custodian_empire_id, self.actor.id)
        self.assertEqual(self.core.payload['energy'], 0)
        native = self.next_order('RETURN')
        self.assertEqual(native.payload['origin_planet'], str(self.origin.id))
        self.assertEqual(native.payload['cargo'], {})
        self.assertEqual(self.e.state.stocks['fusion_fuel'], fuel_paid)
        self.assertGreaterEqual(fleet['fuel_reserve'], 0)
        ledgers = [r for (kind, _), r in self.session.rows.items() if kind is m.StellarLedger]
        self.assertEqual(sum(r.effect == 'consume_module' for r in ledgers), 1)

    def test_ceded_foreign_pickup_only_moves_core_to_recipient_owned_orbit(self):
        self.withdrawal()
        plan, fleet, first = self.launch()
        self.arrive(fleet, first)
        second = self.next_order('CORE_TRANSPORT')
        self.assertIsNone(self.core.planet_id)
        self.arrive(fleet, second)
        self.assertEqual(self.core.state, 'sealed_wreck')
        self.assertEqual(self.core.planet_id, self.origin.id)
        self.assertEqual(self.core.custodian_empire_id, self.actor.id)
        self.assertEqual(self.pickup.empire_id, self.sender.id)
        self.assertNotIn('withdrawal_grant', self.core.payload)
        self.assertIsNotNone(self.source.removed_at)
        self.assertEqual(self.op.status, 'completed')
        self.assertEqual(fleet['status'], 'ARRIVED')

    def test_foreign_core_without_matching_cession_is_not_pickable(self):
        self.withdrawal()
        for key, wrong in (('recipient_id', str(self.sender.id)), ('planet_id', str(self.origin.id)),
                           ('custody_version', 0), ('sender_id', str(self.actor.id))):
            grant = copy.deepcopy(self.core.payload['withdrawal_grant'])
            self.core.payload['withdrawal_grant'][key] = wrong
            with self.assertRaises(DataValidationError): self.plan()
            self.core.payload['withdrawal_grant'] = grant

    def test_lost_custody_or_war_at_pickup_returns_tug_without_taking_core(self):
        for invalid in ('custody', 'war'):
            with self.subTest(invalid=invalid):
                self.setUp(); self.withdrawal()
                plan, fleet, first = self.launch()
                if invalid == 'custody': self.core.custody_version += 1
                else: self.store.relation.return_value = {'status': 'war'}
                self.arrive(fleet, first)
                self.assertEqual(self.core.planet_id, self.pickup.id)
                self.assertEqual(self.core.state, 'sealed_wreck')
                self.arrive(fleet, self.next_order('CORE_RETURN', 'home'))
                self.assertEqual(self.tug.status, 'ready')
                self.assertEqual(self.tug.current_planet_id, self.origin.id)
                self.assertEqual(self.op.status, 'failed')

    def test_recall_before_pickup_returns_same_unconsumed_tug_physically(self):
        plan, fleet, first = self.launch()
        self.e.state.last_updated += 1
        transport.recall(self.store, self.session, self.actor, self.e, first)
        self.assertTrue(first.resolved)
        self.assertEqual(self.core.planet_id, self.pickup.id)
        self.assertEqual(self.tug.status, 'transit')
        self.arrive(fleet, self.next_order('CORE_RETURN', 'home'))
        self.assertEqual(self.tug.status, 'ready')
        self.assertEqual(self.op.status, 'cancelled')
        self.assertEqual(self.core.planet_id, self.pickup.id)

    def test_recall_after_pickup_backtracks_then_tows_same_core_home_without_refund(self):
        plan, fleet, first = self.launch()
        fuel_paid = self.e.state.stocks['fusion_fuel']
        self.arrive(fleet, first)
        second = self.next_order('CORE_TRANSPORT')
        self.e.state.last_updated += 1
        transport.recall(self.store, self.session, self.actor, self.e, second)
        self.assertEqual(self.core.state, 'core_transit'); self.assertIsNone(self.core.planet_id)
        self.assertEqual(self.tug.status, 'consumed')
        self.arrive(fleet, self.next_order('CORE_RETURN', 'backtrack'))
        self.assertIsNone(self.core.planet_id)
        self.arrive(fleet, self.next_order('CORE_RETURN', 'home'))
        self.assertEqual(self.core.planet_id, self.origin.id)
        self.assertEqual(self.core.state, 'sealed_wreck')
        self.assertEqual(self.core.stocks, {'fusion_fuel': 20})
        self.assertIsNotNone(self.source.removed_at)
        self.assertEqual(self.op.status, 'cancelled')
        self.assertEqual(self.tug.status, 'consumed')
        self.assertEqual(fuel_paid, self.e.state.stocks['fusion_fuel'])
        self.assertGreaterEqual(fleet['fuel_reserve'], 0)

    def test_capacity_stocks_module_science_and_fuel_are_real_boundaries(self):
        for invalid in ('capacity', 'stocks', 'module', 'science', 'fuel', 'foreign_universe'):
            with self.subTest(invalid=invalid):
                self.setUp()
                if invalid == 'capacity': self.core.stocks['fusion_fuel'] = 1000
                elif invalid == 'stocks': self.core.stocks['fusion_fuel'] = float('nan')
                elif invalid == 'module': self.tug.current_planet_id = self.pickup.id
                elif invalid == 'science': self.e.state.universe['levels'] = {}
                elif invalid == 'fuel': self.e.state.stocks['fusion_fuel'] = 0
                else: self.source.universe_id = UUID(int=99)
                before = self.e.state.stocks['fusion_fuel']
                with self.assertRaises(DataValidationError): self.plan()
                self.assertEqual(self.e.state.stocks['fusion_fuel'], before)
                self.assertEqual(self.tug.status, 'committed')

    def test_launch_detects_double_fuel_payment_and_requires_reserved_tug(self):
        plan = self.plan()
        fleet = {'id': str(UUID(int=15)), 'ship_ids': [self.ship['id']], 'status': 'TRANSIT',
                 'fuel_reserve': plan['reserve']}
        order = m.UniverseOrder(id=UUID(int=16), kind='mission', empire_id=self.actor.id,
            universe_id=self.universe, payload={'mission': 'CORE_PICKUP'})
        with self.assertRaises(DataValidationError):
            transport.launch(self.session, self.actor, self.e, plan, fleet, order)
        self.assertEqual(self.tug.status, 'committed')

    def test_early_or_unrelated_orders_do_not_apply_transport(self):
        plan, fleet, first = self.launch()
        with self.assertRaises(DataValidationError):
            transport.complete(self.store, self.session, first, {str(self.actor.id): self.e})
        ordinary = m.UniverseOrder(kind='mission', payload={'mission': 'RETURN'})
        self.assertFalse(transport.complete(self.store, self.session, ordinary, {}))


@unittest.skipUnless(os.getenv('PERSISTENT_TEST_DATABASE_URL'), 'isolated core transport PostgreSQL required')
class CoreTransportPersistence(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        custody_fixtures.CustodyPersistence.setUpClass.__func__(cls)

    @classmethod
    def tearDownClass(cls):
        custody_fixtures.CustodyPersistence.tearDownClass.__func__(cls)

    prepare = custody_fixtures.CustodyPersistence.prepare
    commission = custody_fixtures.CustodyPersistence.commission
    wreck = custody_fixtures.CustodyPersistence.wreck
    act = custody_fixtures.CustodyPersistence.act

    def claimed_core(self):
        store, now, actor, other, project, unit_id, home = self.wreck()
        claimed = self.act(store, actor, unit_id, 'claim')
        now[0] = claimed['complete_at']; store.tick(); store.tick()
        return store, now, actor, other, project, unit_id, home

    def tug_and_ships(self, store, now, actor):
        def prepare(e):
            e.state.population_total = 1000
            e.state.districts.update(orbital_shipyard=4, solar_field=100)
            e.state.stocks.update(refined_alloy=100000, components=100000, ion_fuel=100000)
            return [e.build_ship('wayfarer_hull', now=e.state.last_updated)['id'] for _ in range(2)]
        ships = store.run(actor, prepare)
        tug = store.transaction(actor, lambda session, empire, e:
            stellar.manufacture(session, empire, e, 'propulsion', uuid4().hex))
        now[0] += 10000; store.tick()
        return ships, tug['module_id']

    def test_physical_repatriation_native_dispatch_offline_ticks_reinstalls_once_and_returns_fleet(self):
        store, now, actor, other, project, unit_id, home = self.claimed_core()
        ships, tug_id = self.tug_and_ships(store, now, actor)
        data = {'action': 'repatriate', 'unit_id': unit_id, 'ship_ids': ships,
                'module_ids': [tug_id], 'idempotency_key': uuid4().hex}
        before = store.run(actor, lambda e: e.state.stocks['ion_fuel'])
        result = store.transaction(actor, lambda session, empire, e: custody.command(store, session, empire, e, data))
        self.assertEqual(result, store.transaction(actor, lambda session, empire, e:
            custody.command(store, session, empire, e, data)))
        with Session(self.db) as session:
            op = session.get(m.StellarOperation, UUID(result['operation_id']))
            plan = copy.deepcopy(op.payload['transport'])
            initial = session.get(m.StellarUnit, UUID(unit_id))
            stocks = dict(initial.stocks)
            self.assertEqual(str(initial.planet_id), home)
            self.assertEqual(session.get(m.StellarModule, UUID(tug_id)).status, 'transit')
        self.assertEqual(before-store.run(actor, lambda e: e.state.stocks['ion_fuel']), plan['total_fuel'])
        now[0] = result['fleet']['arrival_at']; store.tick(); store.tick()
        with Session(self.db) as session:
            loaded = session.get(m.StellarUnit, UUID(unit_id))
            self.assertEqual(loaded.state, 'core_transit'); self.assertIsNone(loaded.planet_id)
            self.assertEqual(session.get(m.StellarModule, UUID(tug_id)).status, 'consumed')
            self.assertIsNotNone(session.get(m.StellarSource, loaded.source_id).removed_at)
        now[0] += plan['leg2']['duration']+plan['leg3']['duration']+1
        store.tick(); store.tick()
        with Session(self.db) as session:
            final = session.get(m.StellarUnit, UUID(unit_id))
            source = session.get(m.StellarSource, final.source_id)
            self.assertEqual(final.state, 'reinstalled')
            self.assertEqual(final.system_id, source.origin_system_id)
            self.assertIsNone(final.planet_id); self.assertIsNone(source.removed_at)
            self.assertEqual(final.custodian_empire_id, actor)
            self.assertEqual(str(final.source_id), project['source_id'])
            self.assertEqual(str(final.project_id), project['project_id'])
            self.assertEqual(final.stocks, stocks)
            self.assertEqual(final.payload['energy'], 0)
            self.assertEqual(session.get(m.StellarOperation, UUID(result['operation_id'])).status, 'completed')
            ledger = list(session.scalars(select(m.StellarLedger).where(
                m.StellarLedger.operation_id == UUID(result['operation_id']))))
            self.assertEqual(sum(r.effect == 'consume_module' for r in ledger), 1)
            self.assertEqual(sum(r.effect == 'stellar_reinstalled' for r in ledger), 1)
            fleet = session.get(m.Fleet, UUID(result['fleet']['id']))
            self.assertEqual(fleet.status, 'ARRIVED'); self.assertGreaterEqual(fleet.fuel_reserve, 0)
            self.assertTrue(all(session.get(m.Ship, UUID(identity)) is not None for identity in ships))

    def test_accepted_cession_withdrawal_picks_only_granted_core_and_reaches_recipient_planet(self):
        store, now, sender, recipient, project, unit_id, sender_home = self.claimed_core()
        offered = self.act(store, sender, unit_id, 'offer', recipient_id=str(recipient))
        self.act(store, recipient, unit_id, 'accept', operation_id=offered['operation_id'])
        recipient_home = store.run(recipient, lambda e: e.state.planet_id)
        ships, tug_id = self.tug_and_ships(store, now, recipient)
        before_sender = store.run(sender, lambda e: copy.deepcopy(e.state.stocks))
        with Session(self.db) as session:
            original = session.get(m.StellarUnit, UUID(unit_id))
            version, stocks = original.custody_version, dict(original.stocks)
            self.assertEqual(str(original.planet_id), sender_home)
        data = {'action': 'withdraw', 'unit_id': unit_id, 'ship_ids': ships,
                'module_ids': [tug_id], 'idempotency_key': uuid4().hex}
        result = store.transaction(recipient, lambda session, empire, e:
            custody.command(store, session, empire, e, data))
        self.assertEqual(result, store.transaction(recipient, lambda session, empire, e:
            custody.command(store, session, empire, e, data)))
        self.assertEqual(before_sender, store.run(sender, lambda e: e.state.stocks))
        now[0] = result['fleet']['arrival_at']; store.tick(); store.tick()
        with Session(self.db) as session:
            loaded = session.get(m.StellarUnit, UUID(unit_id))
            self.assertEqual(loaded.state, 'core_transit'); self.assertIsNone(loaded.planet_id)
            op = session.get(m.StellarOperation, UUID(result['operation_id']))
            duration = op.payload['transport']['leg2']['duration']
        now[0] += duration+1; store.tick(); store.tick()
        with Session(self.db) as session:
            final = session.get(m.StellarUnit, UUID(unit_id))
            planet = session.get(m.Planet, UUID(recipient_home))
            self.assertEqual(final.state, 'sealed_wreck')
            self.assertEqual(final.planet_id, planet.id); self.assertEqual(final.system_id, planet.system_id)
            self.assertEqual(final.custodian_empire_id, recipient)
            self.assertEqual(final.empire_id, sender)
            self.assertEqual(final.custody_version, version)
            self.assertEqual(final.stocks, stocks)
            self.assertEqual(str(final.source_id), project['source_id'])
            self.assertIsNotNone(session.get(m.StellarSource, final.source_id).removed_at)
            self.assertEqual(session.get(m.Planet, UUID(sender_home)).empire_id, sender)
            self.assertEqual(session.get(m.StellarModule, UUID(tug_id)).status, 'consumed')
            self.assertEqual(session.get(m.StellarOperation, UUID(result['operation_id'])).status, 'completed')
            self.assertIsNone(final.payload.get('core_fleet_id'))
            self.assertEqual(session.get(m.Fleet, UUID(result['fleet']['id'])).status, 'ARRIVED')
