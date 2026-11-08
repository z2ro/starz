"""Custody authorization/replay/privacy and actual colony transport to reconstruction."""
from copy import deepcopy
from concurrent.futures import ThreadPoolExecutor
import json
import os
import runpy
import unittest
from unittest.mock import MagicMock, patch
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from starz.data import Catalog, DataValidationError
from starz.db import models as m
from starz.db.store import utc
from starz.persistent import stellar, stellar_custody as custody
from starz.persistent.combat_rules import STELLAR_RULES
from starz.universe import generate_system, colonization_viability
import test_combat3 as combat_fixture
import test_stargrave_operations as construction


class CustodyRules(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = Catalog.load('game_data', 'persistent_data')

    def setUp(self):
        self.actor = m.Empire(id=uuid4(), universe_id=uuid4())
        self.other = m.Empire(id=uuid4(), universe_id=self.actor.universe_id)
        self.system = m.StarSystem(id=uuid4(), universe_id=self.actor.universe_id, x=0, y=0)
        self.planet = m.Planet(id=uuid4(), system_id=self.system.id, empire_id=self.actor.id)
        self.source = m.StellarSource(id=uuid4(), universe_id=self.actor.universe_id,
                                     origin_system_id=self.system.id, removed_at=utc(1))
        self.row = m.StellarUnit(id=uuid4(), universe_id=self.actor.universe_id, source_id=self.source.id,
            project_id=uuid4(), empire_id=self.actor.id, custodian_empire_id=None, custody_version=0,
            system_id=self.system.id, planet_id=self.planet.id, state='sealed_wreck', stocks={},
            created_at=utc(1), payload={'hp': 0, 'shield': 0, 'energy': 0, 'defeated_at': -86400,
                'original_owner_id': str(self.actor.id), 'subsystems': dict.fromkeys(stellar.MODULE_KINDS, 0)})
        self.e = combat_fixture.engine(self.catalog, str(self.planet.id),
                                      {key: 1 for key in self.catalog.items['technologies']})
        combat_fixture.ship(self.e, 'vanguard_hull', str(uuid4()))
        self.rows = {(type(row), row.id): row for row in
                     (self.actor, self.other, self.system, self.planet, self.source, self.row)}
        self.session = MagicMock()
        self.session.get.side_effect = lambda model, identity: self.rows.get((model, identity))
        self.session.add.side_effect = lambda row: self.rows.__setitem__((type(row), row.id), row)
        self.session.scalars.side_effect = lambda query: [row for (model, _), row in self.rows.items()
                                                        if model is query.column_descriptions[0]['entity']]
        def scalar(query):
            entity = query.column_descriptions[0]['entity']
            if entity is m.StellarOperation:
                return next((row.id for (model, _), row in self.rows.items()
                             if model is entity and row.status in custody.ACTIVE), None)
            if entity is m.StellarLedger:
                return next((row.id for (model, _), row in self.rows.items()
                             if model is entity and row.event_key == 'salvage'), None)
            return None
        self.session.scalar.side_effect = scalar
        self.store = MagicMock()
        self.store.relation.return_value = {'status': 'neutral'}

    def command(self, action, actor=None, engine=None, **extra):
        return custody.command(self.store, self.session, actor or self.actor, engine or self.e,
            {'action': action, 'unit_id': str(self.row.id), 'idempotency_key': extra.pop('key', uuid4().hex), **extra})

    def finish(self, result):
        op = self.rows[m.StellarOperation, UUID(result['operation_id'])]
        order = next(row for (model, _), row in self.rows.items()
                     if model is m.UniverseOrder and row.payload.get('operation_id') == str(op.id))
        self.e.state.last_updated = op.due_at.timestamp()
        custody.complete(self.store, self.session, order, {str(self.actor.id): self.e})
        custody.complete(self.store, self.session, order, {str(self.actor.id): self.e})
        return op

    def modules(self):
        ids = []
        for kind in stellar.MODULE_KINDS:
            row = m.StellarModule(id=uuid4(), universe_id=self.actor.universe_id,
                empire_id=self.actor.id, kind=kind, status='ready', origin_planet_id=self.planet.id,
                current_planet_id=self.planet.id, operation_id=None, project_id=None, fleet_id=None,
                manufacture_order_id=uuid4())
            self.rows[m.StellarModule, row.id] = row
            ids.append(str(row.id))
        return ids

    def test_claim_is_timed_replayed_once_and_conflicting_key_is_rejected(self):
        result = self.command('claim', key='claim')
        self.assertEqual(result, self.command('claim', key='claim'))
        self.assertIsNone(self.row.custodian_empire_id)
        self.assertGreater(result['complete_at'], self.e.state.last_updated)
        with self.assertRaisesRegex(DataValidationError, 'conflitante'):
            self.command('offer', key='claim', recipient_id=str(self.other.id))
        op = self.finish(result)
        self.assertEqual(op.status, 'completed')
        self.assertEqual(self.row.custodian_empire_id, self.actor.id)
        self.assertEqual(self.row.custody_version, 1)
        self.assertEqual(sum(model is m.StellarLedger for model, _ in self.rows), 2)

    def test_stabilization_presence_deep_space_and_existing_claims_are_enforced(self):
        self.row.payload = {**self.row.payload, 'defeated_at': 1000}
        with self.assertRaisesRegex(DataValidationError, 'estabilização'):
            self.command('claim')
        self.row.payload = {**self.row.payload, 'defeated_at': -86400}
        self.e.state.ships.clear()
        with self.assertRaisesRegex(DataValidationError, 'naves militares'):
            self.command('claim')
        self.row.planet_id = None
        with self.assertRaisesRegex(DataValidationError, 'espaço profundo'):
            self.command('claim')

    def test_hostile_real_stellar_contest_terminates_without_transfer_and_allows_manual_retry(self):
        result = self.command('claim')
        rival = m.StellarUnit(id=uuid4(), empire_id=self.other.id, universe_id=self.actor.universe_id,
            planet_id=self.planet.id, system_id=self.system.id, state='operational',
            payload={'hp': 100, 'subsystems': dict.fromkeys(stellar.MODULE_KINDS, 1)})
        self.rows[m.StellarUnit, rival.id] = rival
        self.store.relation.return_value = {'status': 'war'}
        self.assertEqual(self.finish(result).status, 'contested')
        self.assertIsNone(self.row.custodian_empire_id)
        self.rows.pop((m.StellarUnit, rival.id))
        retry = self.command('claim')
        self.assertNotEqual(result['operation_id'], retry['operation_id'])
        self.assertGreater(retry['complete_at'], self.e.state.last_updated)

    def test_loss_of_military_presence_does_not_leave_pending_claim(self):
        result = self.command('claim')
        self.e.state.ships.clear()
        self.assertEqual(self.finish(result).status, 'failed')
        self.assertIsNone(self.row.custodian_empire_id)

    def test_conquest_needs_war_and_its_own_window(self):
        self.row.custodian_empire_id = self.other.id
        with self.assertRaisesRegex(DataValidationError, 'guerra'):
            self.command('conquer')
        self.store.relation.return_value = {'status': 'war'}
        result = self.command('conquer')
        self.assertEqual(self.row.custodian_empire_id, self.other.id)
        self.finish(result)
        self.assertEqual(self.row.custodian_empire_id, self.actor.id)

    def test_cession_requires_acceptance_peace_and_grants_only_core_pickup(self):
        self.row.custodian_empire_id = self.actor.id
        offered = self.command('offer', recipient_id=str(self.other.id))
        self.assertEqual(self.row.custodian_empire_id, self.actor.id)
        with self.assertRaises(DataValidationError):
            self.command('accept', operation_id=offered['operation_id'])
        self.store.relation.return_value = {'status': 'war'}
        with self.assertRaisesRegex(DataValidationError, 'fora de guerra'):
            self.command('accept', actor=self.other, operation_id=offered['operation_id'])
        self.store.relation.return_value = {'status': 'neutral'}
        before = self.row.planet_id, self.row.system_id, dict(self.row.stocks)
        result = self.command('accept', actor=self.other, operation_id=offered['operation_id'])
        self.assertEqual(result['status'], 'completed')
        self.assertEqual(self.row.custodian_empire_id, self.other.id)
        self.assertEqual(before, (self.row.planet_id, self.row.system_id, self.row.stocks))
        self.assertEqual(self.row.payload['withdrawal_grant'], {
            'recipient_id': str(self.other.id), 'sender_id': str(self.actor.id),
            'planet_id': str(self.planet.id), 'custody_version': 1})

    def test_rebuild_consumes_five_local_paid_modules_preserving_original_history_and_identity(self):
        self.row.custodian_empire_id = self.actor.id
        self.row.empire_id = self.other.id
        self.row.payload['original_owner_id'] = str(self.other.id)
        original = self.row.id, self.row.source_id, self.row.project_id
        modules = self.modules()
        result = self.command('rebuild', module_ids=modules)
        self.assertTrue(all(self.rows[m.StellarModule, UUID(key)].status == 'committed' for key in modules))
        self.assertEqual(self.row.state, 'rebuilding')
        self.finish(result)
        self.assertEqual((self.row.id, self.row.source_id, self.row.project_id), original)
        self.assertEqual(self.row.empire_id, self.actor.id)
        self.assertEqual(self.row.payload['original_owner_id'], str(self.other.id))
        self.assertEqual(self.row.state, 'operational')
        self.assertEqual(self.row.payload['energy'], 0)
        self.assertNotIn('defeated_at', self.row.payload)
        self.assertEqual(self.row.payload['hp'], STELLAR_RULES['structural_hp'])
        self.assertTrue(all(self.rows[m.StellarModule, UUID(key)].status == 'consumed' for key in modules))

    def test_cancel_rebuild_releases_unconsumed_modules_without_refund(self):
        self.row.custodian_empire_id = self.actor.id
        modules = self.modules()
        result = self.command('rebuild', module_ids=modules)
        before = dict(self.e.state.stocks)
        cancelled = self.command('cancel', operation_id=result['operation_id'], key='cancel')
        self.assertEqual(cancelled, self.command('cancel', operation_id=result['operation_id'], key='cancel'))
        self.assertEqual(cancelled['status'], 'cancelled')
        self.assertEqual(self.row.state, 'sealed_wreck')
        self.assertEqual(self.e.state.stocks, before)
        self.assertTrue(all(self.rows[m.StellarModule, UUID(key)].status == 'ready' and
                            self.rows[m.StellarModule, UUID(key)].operation_id is None for key in modules))
        self.finish(result)
        self.assertEqual(self.row.state, 'sealed_wreck')

    def test_factory_origin_does_not_authorize_remote_module_consumption(self):
        self.row.custodian_empire_id = self.actor.id
        modules = self.modules()
        self.rows[m.StellarModule, UUID(modules[0])].current_planet_id = uuid4()
        with self.assertRaisesRegex(DataValidationError, 'planeta autorizado'):
            self.command('rebuild', module_ids=modules)

    def test_relic_recovery_uses_paid_original_modules_once_and_never_creates_fuel(self):
        self.row.custodian_empire_id = self.actor.id
        for identity in self.modules():
            module = self.rows[m.StellarModule, UUID(identity)]
            module.status, module.project_id = 'consumed', self.row.project_id
            self.rows[m.UniverseOrder, module.manufacture_order_id] = m.UniverseOrder(
                id=module.manufacture_order_id, kind='stellar_module', payload={'cost': dict(stellar.MODULE_COST)})
        before = dict(self.e.state.stocks)
        result = self.command('decommission')
        with patch('starz.persistent.stellar_custody.load', return_value=deepcopy(self.e.state)):
            self.finish(result)
        self.assertEqual(self.row.state, 'sealed_relic')
        self.assertEqual(self.row.payload['energy'], 0)
        self.assertEqual(self.e.state.stocks['refined_alloy'] - before['refined_alloy'], 250)
        self.assertEqual(self.e.state.stocks['components'] - before['components'], 125)
        self.assertNotIn('fusion_fuel', self.e.state.stocks.keys() - before.keys())
        op = self.rows[m.StellarOperation, UUID(result['operation_id'])]
        after = dict(self.e.state.stocks)
        custody._salvage(self.session, op, self.row, self.e, self.e.state.last_updated)
        self.assertEqual(self.e.state.stocks, after)
        with self.assertRaisesRegex(DataValidationError, 'núcleo selado'):
            self.command('decommission')

    def test_historical_owner_view_has_roles_but_no_private_payload_stocks_or_offers(self):
        self.row.custodian_empire_id = self.other.id
        self.row.stocks = {'fusion_fuel': 13}
        self.row.payload['private_enemy_technology'] = 'must-not-leak'
        views = custody.unit_views(self.session, self.actor, self.e)
        view = next(item for item in views if item['id'] == str(self.row.id))
        self.assertNotIn('payload', view)
        self.assertNotIn('stocks', view)
        self.assertNotIn('must-not-leak', json.dumps(view))
        self.assertTrue(view['roles']['historical_owner'])
        self.assertFalse(view['roles']['custodian'])
        self.assertTrue(view['roles']['controller'])
        self.assertTrue(view['requires_server_validation'])

    def test_ledger_provenance_is_once_and_rejects_conflicting_reuse(self):
        result = self.command('claim')
        op = self.rows[m.StellarOperation, UUID(result['operation_id'])]
        self.assertTrue(custody.record_effect(self.session, op, 'event', 'debit', {'components': 2}, 1000))
        self.assertFalse(custody.record_effect(self.session, op, 'event', 'debit', {'components': 2}, 1000))
        with self.assertRaisesRegex(DataValidationError, 'conflitante'):
            custody.record_effect(self.session, op, 'event', 'debit', {'components': 3}, 1000)

    def test_t48_downgrade_guard_and_empty_schema(self):
        migration = runpy.run_path('migrations/versions/d06f00000001_stellar_custody.py')
        operations = MagicMock()
        migration['downgrade'].__globals__['op'] = operations
        operations.get_bind.return_value.scalar.return_value = True
        with self.assertRaisesRegex(RuntimeError, 'preserve operations'):
            migration['downgrade']()
        operations.drop_table.assert_not_called()
        sql = str(operations.get_bind.return_value.scalar.call_args.args[0])
        for table in ('stellar_source', 'stellar_project', 'stellar_module', 'stellar_unit', 'stellar_operation', 'stellar_ledger'):
            self.assertIn('FROM ' + table, sql)
        self.assertIn('CORE_PICKUP', sql)
        operations.get_bind.return_value.scalar.return_value = False
        migration['downgrade']()
        self.assertEqual([call.args[0] for call in operations.drop_table.call_args_list],
                         ['stellar_ledger', 'stellar_operation'])


@unittest.skipUnless(os.getenv('PERSISTENT_TEST_DATABASE_URL'), 'isolated custody PostgreSQL required')
class CustodyPersistence(unittest.TestCase):
    # Own-planet eligibility cannot make two foreign empires eligible at once (full T33 is not covered).
    @classmethod
    def setUpClass(cls):
        construction.StargraveOperations.setUpClass.__func__(cls)

    @classmethod
    def tearDownClass(cls):
        construction.StargraveOperations.tearDownClass.__func__(cls)

    prepare = construction.StargraveOperations.prepare
    commission = construction.StargraveOperations.commission

    def act(self, store, actor, unit_id, action, planet_id=None, **extra):
        data = {'unit_id': unit_id, 'action': action, 'idempotency_key': uuid4().hex, **extra}
        return store.transaction(actor, lambda session, empire, e: custody.command(store, session, empire, e, data),
                                 planet_id=planet_id)

    def wreck(self):
        """Synthetic wreck after paid construction, for isolated custody/transport rules only."""
        store, now, a, b, project, unit = self.commission()
        home = store.run(a, lambda e: e.state.planet_id)
        ship = store.run(a, lambda e: e.build_ship('vanguard_hull', now=e.state.last_updated))
        now[0] = ship['ready_at']; store.tick()
        with Session(self.db) as session, session.begin():
            store.lock(session)
            row = session.get(m.StellarUnit, UUID(unit))
            planet = session.get(m.Planet, UUID(home))
            row.planet_id, row.system_id, row.state = planet.id, planet.system_id, 'sealed_wreck'
            row.payload = {**row.payload, 'hp': 0, 'shield': 0, 'energy': 0,
                           'defeated_at': now[0] - custody.STABILIZATION_SECONDS}
        return store, now, a, b, project, unit, home

    def test_paid_construction_real_move_conventional_defeat_claim_and_relic(self):
        from starz.persistent.stargrave import command as military_command
        store, now, a, b, project, unit_id = self.commission()
        home = store.run(a, lambda e: e.state.planet_id)
        move = store.transaction(a, lambda session, actor, e: military_command(store, session, actor, e,
            {'action': 'move', 'unit_id': unit_id, 'target_planet_id': home, 'idempotency_key': uuid4().hex}))
        now[0] = move['arrival_at']; store.tick()
        def conventional_fleet(e):
            e.state.population_total = 5000
            e.state.districts.update(civil_district=50, solar_field=100, orbital_shipyard=48)
            e.state.stocks.update(refined_alloy=100000, components=100000, fusion_fuel=100000)
            e.state.universe['levels']['containment_warfare'] = 0
            return [e.build_ship('leviathan_hull', 'nuclear_drive', 'fusion_fuel',
                                 now=e.state.last_updated)['id'] for _ in range(48)]
        ships = store.run(b, conventional_fleet)
        now[0] += 10000; store.tick()
        store.transaction(b, lambda session, actor, e: store.diplomacy(session, actor, e, str(a), 'war'))
        attack = store.transaction(b, lambda session, actor, e: store.dispatch(session, actor, e,
            {'mission': 'ATTACK', 'ship_ids': ships, 'target_planet_id': home, 'cargo': {}, 'x': 0, 'y': 0}))
        now[0] = attack['arrival_at']; store.tick(); store.tick()
        with Session(self.db) as session:
            wreck = session.get(m.StellarUnit, UUID(unit_id))
            self.assertEqual(wreck.state, 'sealed_wreck')
            self.assertEqual(wreck.payload['hp'], 0)
            defeated_at = wreck.payload['defeated_at']
            self.assertIsNone(wreck.custodian_empire_id)
        battles = store.run(b, lambda e: e.state.universe['battles'])
        self.assertEqual(len(battles), 1)
        self.assertLessEqual(len(battles[0]['rounds']), 6)
        # Rebuild an actual local military ship after losses; no fixture grants custody.
        guard = store.run(a, lambda e: e.build_ship('vanguard_hull', now=e.state.last_updated))
        now[0] = max(guard['ready_at'], defeated_at + custody.STABILIZATION_SECONDS)
        store.tick()
        claim = self.act(store, a, unit_id, 'claim')
        now[0] = claim['complete_at']; store.tick(); store.tick()
        with Session(self.db) as session:
            self.assertEqual(session.get(m.StellarUnit, UUID(unit_id)).custodian_empire_id, a)
        relic = self.act(store, a, unit_id, 'decommission')
        now[0] = relic['complete_at']; store.tick(); store.tick()
        with Session(self.db) as session:
            final = session.get(m.StellarUnit, UUID(unit_id))
            self.assertEqual(final.state, 'sealed_relic')
            self.assertEqual(final.payload['energy'], 0)
            self.assertEqual(str(final.source_id), project['source_id'])
            self.assertEqual(str(final.project_id), project['project_id'])
            self.assertIsNotNone(session.get(m.StellarSource, final.source_id).removed_at)
            recovery = list(session.scalars(select(m.StellarLedger).where(
                m.StellarLedger.unit_id == final.id, m.StellarLedger.event_key == 'salvage')))
            self.assertEqual(len(recovery), 1)
            self.assertEqual(recovery[0].payload['resources'], {'refined_alloy': 250, 'components': 125})
        with self.assertRaises(DataValidationError):
            self.act(store, a, unit_id, 'decommission')

    def test_actual_tick_claim_cession_private_views_and_cancel_replay(self):
        store, now, a, b, project, unit, home = self.wreck()
        key = uuid4().hex
        request = {'action': 'claim', 'unit_id': unit, 'idempotency_key': key}
        result = store.transaction(a, lambda s, actor, e: custody.command(store, s, actor, e, request))
        self.assertEqual(result, store.transaction(a, lambda s, actor, e: custody.command(store, s, actor, e, request)))
        now[0] = result['complete_at']; store.tick(); store.tick()
        offered = self.act(store, a, unit, 'offer', recipient_id=str(b))
        self.act(store, b, unit, 'accept', operation_id=offered['operation_id'])
        old_view = store.transaction(a, lambda s, actor, e: custody.snapshot(s, actor, e))
        new_view = store.transaction(b, lambda s, actor, e: custody.snapshot(s, actor, e))
        old_unit = next(row for row in old_view['units'] if row['id'] == unit)
        new_unit = next(row for row in new_view['units'] if row['id'] == unit)
        self.assertNotIn('payload', old_unit)
        self.assertNotIn('stocks', old_unit)
        self.assertTrue(new_unit['roles']['custodian'])
        self.assertFalse(old_unit['roles']['custodian'])
        self.assertIn('stocks', new_unit)
        with Session(self.db) as session:
            row = session.get(m.StellarUnit, UUID(unit))
            self.assertEqual(row.empire_id, a)
            self.assertEqual(row.custodian_empire_id, b)
            self.assertEqual(str(row.planet_id), home)
            self.assertEqual(str(row.project_id), project['project_id'])
            self.assertEqual(row.payload['withdrawal_grant']['recipient_id'], str(b))

    def test_same_actor_concurrent_claims_and_destinations_have_one_effect(self):
        store, now, a, b, project, unit, home = self.wreck()
        def claim(_):
            try:
                return self.act(store, a, unit, 'claim')
            except DataValidationError:
                return None
        with ThreadPoolExecutor(2) as pool:
            claims = list(pool.map(claim, range(2)))
        winners = [result for result in claims if result is not None]
        self.assertEqual(len(winners), 1)
        with Session(self.db) as session:
            active = list(session.scalars(select(m.StellarOperation).where(
                m.StellarOperation.unit_id == UUID(unit), m.StellarOperation.status.in_(custody.ACTIVE))))
            self.assertEqual(len(active), 1)
            self.assertIsNone(session.get(m.StellarUnit, UUID(unit)).custodian_empire_id)
        now[0] = winners[0]['complete_at']; store.tick(); store.tick()
        modules = [store.transaction(a, lambda session, actor, e, kind=kind:
            stellar.manufacture(session, actor, e, kind, uuid4().hex)) for kind in stellar.MODULE_KINDS]
        now[0] = max(module['complete_at'] for module in modules); store.tick()
        ids = [module['module_id'] for module in modules]
        def destination(action):
            try:
                return self.act(store, a, unit, action, module_ids=ids if action == 'rebuild' else [])
            except DataValidationError:
                return None
        with ThreadPoolExecutor(2) as pool:
            attempts = list(pool.map(destination, ('rebuild', 'decommission')))
        successful = [result for result in attempts if result is not None]
        self.assertEqual(len(successful), 1)
        winner = successful[0]
        with Session(self.db) as session:
            active = list(session.scalars(select(m.StellarOperation).where(
                m.StellarOperation.unit_id == UUID(unit), m.StellarOperation.status.in_(custody.ACTIVE))))
            self.assertEqual([str(op.id) for op in active], [winner['operation_id']])
        now[0] = winner['complete_at']; store.tick(); store.tick()
        with Session(self.db) as session:
            row = session.get(m.StellarUnit, UUID(unit))
            self.assertEqual(row.state, 'operational' if winner['kind'] == 'rebuild' else 'sealed_relic')
            self.assertEqual(row.custody_version, 2 if winner['kind'] == 'rebuild' else 1)
            ledger = list(session.scalars(select(m.StellarLedger).where(m.StellarLedger.unit_id == row.id)))
            self.assertEqual(sum(entry.effect == 'custody' for entry in ledger), 1)
            self.assertEqual(sum(entry.effect == 'completed' for entry in ledger), 2)
            self.assertEqual(sum(entry.effect == 'consume_module' for entry in ledger),
                             5 if winner['kind'] == 'rebuild' else 0)
            self.assertLessEqual(sum(entry.effect == 'material_recovery' for entry in ledger), 1)
            self.assertEqual(len({entry.event_key for entry in ledger}), len(ledger))

    def test_offer_and_conquest_after_cession_cannot_overwrite_each_other(self):
        store, now, a, b, project, unit, home = self.wreck()
        claim = self.act(store, a, unit, 'claim')
        now[0] = claim['complete_at']; store.tick()
        offered = self.act(store, a, unit, 'offer', recipient_id=str(b))
        self.act(store, b, unit, 'accept', operation_id=offered['operation_id'])
        with Session(self.db) as session, session.begin():
            store.lock(session)
            recipient = store.create_player(session, 'custody_' + uuid4().hex[:12]).id
        store.transaction(a, lambda session, actor, e: store.diplomacy(session, actor, e, str(b), 'war'))
        def compete(action):
            try:
                if action == 'offer':
                    return self.act(store, b, unit, 'offer', recipient_id=str(recipient))
                return self.act(store, a, unit, 'conquer')
            except DataValidationError:
                return None
        with ThreadPoolExecutor(2) as pool:
            attempts = list(pool.map(compete, ('offer', 'conquer')))
        winners = [result for result in attempts if result is not None]
        self.assertEqual(len(winners), 1)
        with Session(self.db) as session:
            row = session.get(m.StellarUnit, UUID(unit))
            self.assertEqual(row.custodian_empire_id, b)
            active = list(session.scalars(select(m.StellarOperation).where(
                m.StellarOperation.unit_id == row.id, m.StellarOperation.status.in_(custody.ACTIVE))))
            self.assertEqual([str(op.id) for op in active], [winners[0]['operation_id']])
        if winners[0]['kind'] == 'conquer':
            now[0] = winners[0]['complete_at']; store.tick(); store.tick()
            with Session(self.db) as session:
                self.assertEqual(session.get(m.StellarUnit, UUID(unit)).custodian_empire_id, a)
        else:
            self.act(store, b, unit, 'cancel', operation_id=winners[0]['operation_id'])
            with Session(self.db) as session:
                self.assertEqual(session.get(m.StellarUnit, UUID(unit)).custodian_empire_id, b)

    def test_real_colony_transport_then_rebuild_uses_same_core_and_immutable_factory_origin(self):
        store, now, a, b, project, unit_id, home = self.wreck()
        state = store.run(a, lambda e: e.state.to_dict())
        with Session(self.db) as session:
            occupied = {(system.x, system.y) for system in session.scalars(select(m.StarSystem))}
        rules = next(iter(self.catalog.items['colonization'].values()))
        x, y = next((state['system_x'] + dx, state['system_y'] + dy)
                    for dx in range(-4, 5) for dy in range(-4, 5)
                    if (state['system_x'] + dx, state['system_y'] + dy) not in occupied and
                    colonization_viability(generate_system(state['seed'], state['system_x'] + dx,
                                           state['system_y'] + dy, self.catalog).planets[0], rules) == 'VIABLE')
        store.run(a, lambda e: e.state.system_knowledge.update({f'{x}:{y}': now[0]}))
        ways = [ship['id'] for ship in state['ships'] if ship['hull_id'] == 'wayfarer_hull']
        colony_fleet = store.transaction(a, lambda s, actor, e: store.dispatch(s, actor, e,
            {'mission': 'COLONIZE', 'ship_ids': [ways[0]], 'x': x, 'y': y, 'planet_index': 0, 'cargo': {}}))
        now[0] = colony_fleet['arrival_at']; store.tick()
        colony = store.run(a, lambda e: next(planet['id'] for planet in e.state.planets if (planet['x'], planet['y']) == (x, y)))
        # Isolated industrial/defense preconditions; travel, manufacture and reconstruction remain real actions.
        def infrastructure(e):
            e.state.districts.update(solar_field=100, processor=3, orbital_shipyard=2)
            e.state.population_total = 500
            e.state.stocks.update(refined_alloy=10000, components=10000, ion_fuel=10000)
        store.run(a, infrastructure, planet_id=colony)
        guard = store.run(a, lambda e: e.build_ship('vanguard_hull', now=e.state.last_updated), planet_id=colony)
        now[0] = guard['ready_at']; store.tick()
        # Place the synthetic defeated fixture at the actual colony; no transport/production result is mocked.
        with Session(self.db) as session, session.begin():
            store.lock(session)
            unit = session.get(m.StellarUnit, UUID(unit_id))
            planet = session.get(m.Planet, UUID(colony))
            unit.system_id, unit.planet_id = planet.system_id, planet.id
            history = deepcopy(session.get(m.StellarProject, unit.project_id).phase_records)
        claim = self.act(store, a, unit_id, 'claim', planet_id=colony)
        now[0] = claim['complete_at']; store.tick()
        modules = [store.transaction(a, lambda s, actor, e, kind=kind: stellar.manufacture(s, actor, e, kind, uuid4().hex))
                   for kind in stellar.MODULE_KINDS]
        now[0] = max(module['complete_at'] for module in modules); store.tick()
        ids = [module['module_id'] for module in modules]
        moved = store.transaction(a, lambda s, actor, e: store.dispatch(s, actor, e, {
            'mission': 'TRANSPORT', 'ship_ids': [ways[1]], 'target_planet_id': colony,
            'module_ids': ids, 'cargo': {}, 'x': x, 'y': y}))
        now[0] = moved['arrival_at']; store.tick(); store.tick()
        with Session(self.db) as session:
            for identity in ids:
                module = session.get(m.StellarModule, UUID(identity))
                self.assertEqual(str(module.origin_planet_id), home)
                self.assertEqual(str(module.current_planet_id), colony)
                self.assertEqual(module.status, 'ready')
        rebuilt = self.act(store, a, unit_id, 'rebuild', planet_id=colony, module_ids=ids)
        now[0] = rebuilt['complete_at']; store.tick(); store.tick()
        with Session(self.db) as session:
            unit = session.get(m.StellarUnit, UUID(unit_id))
            self.assertEqual(unit.state, 'operational')
            self.assertEqual(str(unit.source_id), project['source_id'])
            self.assertEqual(str(unit.project_id), project['project_id'])
            self.assertEqual(session.get(m.StellarProject, unit.project_id).phase_records, history)
            self.assertEqual(unit.payload['energy'], 0)
            for identity in ids:
                module = session.get(m.StellarModule, UUID(identity))
                self.assertEqual(module.status, 'consumed')
                self.assertEqual(str(module.operation_id), rebuilt['operation_id'])
                self.assertIsNone(module.project_id)
                self.assertEqual(str(module.origin_planet_id), home)
