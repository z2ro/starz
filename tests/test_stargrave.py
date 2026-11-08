"""CPU-only contracts using real ORM unit objects and synthetic engine states."""
import copy
import hashlib
import json
import unittest
from unittest.mock import Mock, patch
from uuid import UUID

from starz.data import Catalog, DataValidationError
from starz.db import models as m
from starz.db.store import utc
from starz.persistent import stargrave as sg
from starz.persistent.combat import plans, apply_hits, resolve_battle, strategic_damage, resolve_missiles
from starz.persistent.combat_rules import STELLAR_RULES, SUBSYSTEMS, combat_config
from starz.persistent.service import PersistentStore
from starz.travel import preview_travel, travel_distance, travel_seconds
from test_combat3 import engine, ship, defense, unit


class MemorySession:
    def __init__(self, *rows):
        self.rows = {(type(r), r.id): r for r in rows}
        self.query_rows = []

    def get(self, model, identity):
        return self.rows.get((model, identity))

    def add(self, row):
        self.rows[type(row), row.id] = row

    def flush(self):
        pass

    def scalars(self, query):
        return self.query_rows


class Stargrave(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = Catalog.load('game_data', 'persistent_data')

    def setUp(self):
        self.universe = UUID(int=1)
        self.owner = m.Empire(id=UUID(int=2), universe_id=self.universe, name='Synthetic A')
        self.enemy = m.Empire(id=UUID(int=3), universe_id=self.universe, name='Synthetic B')
        self.origin = m.StarSystem(id=UUID(int=4), universe_id=self.universe, x=0, y=0)
        self.destination = m.StarSystem(id=UUID(int=5), universe_id=self.universe, x=1, y=0)
        self.planet = m.Planet(id=UUID(int=6), system_id=self.destination.id, empire_id=self.owner.id)
        self.row = m.StellarUnit(id=UUID(int=7), universe_id=self.universe, source_id=UUID(int=8),
            project_id=UUID(int=9), empire_id=self.owner.id, system_id=self.origin.id, planet_id=None,
            state='operational', created_at=utc(1000), stocks={},
            payload={'hp': 5000, 'shield': 2000, 'original_owner_id': str(self.owner.id),
                     'subsystems': dict.fromkeys(SUBSYSTEMS, 1000)})
        self.a = engine(self.catalog, 'a', {'gravitational_propulsion': 1, 'stellar_armaments': 1})
        self.b = engine(self.catalog, str(self.planet.id))
        self.session = MemorySession(self.owner, self.enemy, self.origin, self.destination, self.planet, self.row)
        self.store = PersistentStore(None, self.catalog)
        self.store.save = Mock()
        self.store.relation = Mock(return_value={'status': 'war'})

    def powered(self, energy=10000):
        self.row.payload = {**self.row.payload, 'energy': energy, 'energy_at': 1000}
        return self.row

    def command(self, **values):
        data = {'action': 'move', 'unit_id': str(self.row.id), 'target_planet_id': str(self.planet.id),
                'idempotency_key': 'synthetic-operation', **values}
        return sg.command(self.store, self.session, self.owner, self.a, data)

    def war(self):
        self.session.query_rows = [m.UniverseOrder(payload={
            'parties': sorted((str(self.owner.id), str(self.enemy.id))), 'status': 'war'})]

    def test_energy_starts_empty_regenerates_bounded_and_floor_is_protected(self):
        self.assertEqual(sg.settle_energy(self.row, 1000), 0)
        with self.assertRaises(DataValidationError): self.command()
        self.assertEqual(sg.settle_energy(self.row, 20000), 10000)
        u = sg.combat_units([self.row], self.a, 20000)[0]
        self.assertTrue(sg.spend(u, 9000))
        self.assertFalse(sg.spend(u, 1))
        self.assertEqual(u['energy'], STELLAR_RULES['containment_floor'])
        with self.assertRaises(DataValidationError): sg.settle_energy(self.row, 19999)

    def test_sealed_units_never_regenerate_or_move_and_view_keeps_defeat_time(self):
        self.powered(); self.row.state = 'sealed_wreck'
        self.row.payload.update(energy=0, defeated_at=900)
        view = sg.unit_view(self.row, 100000)
        self.assertEqual(view['payload']['energy'], 0)
        self.assertEqual(view['payload']['defeated_at'], 900)
        with self.assertRaises(DataValidationError): self.command()

    def test_move_preview_then_commit_arrival_and_replay_no_hull_or_fuel(self):
        self.powered(); original = copy.deepcopy(self.row.payload)
        preview = self.command(preview=True)
        self.assertEqual(self.row.payload, original)
        result = self.command()
        self.assertEqual(result, preview)
        self.assertEqual(result, self.command())
        self.assertEqual(self.row.payload['energy'], 10000-result['energy_cost'])
        self.assertEqual(self.row.stocks, {})
        self.assertEqual(self.row.state, 'transit'); self.assertIsNone(self.row.planet_id)
        order = self.session.get(m.UniverseOrder, UUID(result['order_id']))
        self.a.state.last_updated = result['arrival_at']
        engines = {str(self.owner.id): self.a}
        self.assertTrue(sg.complete(self.store, self.session, order, engines))
        self.assertEqual((self.row.system_id, self.row.planet_id), (self.destination.id, self.planet.id))
        self.assertEqual(self.row.state, 'operational')
        before = copy.deepcopy(self.row.payload)
        sg.complete(self.store, self.session, order, engines)
        self.assertEqual(before, self.row.payload)
        self.assertNotIn('hull_id', self.row.payload)
        self.assertEqual(self.row.source_id, UUID(int=8))

    def test_owner_hostility_operation_conflict_and_due_time(self):
        self.powered()
        self.planet.empire_id = self.enemy.id
        with self.assertRaises(DataValidationError): self.command()
        self.planet.empire_id = self.owner.id
        result = self.command()
        with self.assertRaises(DataValidationError): self.command(idempotency_key='another')
        order = self.session.get(m.UniverseOrder, UUID(result['order_id']))
        with self.assertRaises(DataValidationError):
            sg.complete(self.store, self.session, order, {str(self.owner.id): self.a})

    def test_conventional_fleet_defeats_actual_unit_and_seals_same_identity(self):
        self.powered()
        self.row.planet_id, self.row.system_id = self.planet.id, self.destination.id
        self.row.empire_id = self.enemy.id
        for i in range(48): ship(self.a, 'leviathan_hull', f'a{i}')
        snapshots = sg.combat_units([self.row], self.b, 1000)
        report = resolve_battle(self.a, self.a.state.ships[:], self.b, self.b.state.planet_id,
                                stellar_defenders=snapshots)
        sg.apply_result([self.row], snapshots, 1000)
        self.assertEqual(self.row.state, 'sealed_wreck')
        self.assertEqual(self.row.payload['hp'], 0)
        self.assertEqual(self.row.payload['energy'], 0)
        self.assertEqual(self.row.payload['defeated_at'], 1000)
        self.assertEqual(self.row.source_id, UUID(int=8))
        self.assertEqual(self.row.empire_id, self.enemy.id)
        self.assertLessEqual(len(report['rounds']), 6)
        self.assertTrue(report['attacker_stellar_after'] == [])
        self.assertNotIn('subsystems', str(report))
        self.assertNotIn('energy', str(report))
        sg.apply_result([self.row], snapshots, 1100)
        self.assertEqual(self.row.payload['defeated_at'], 1000)

    def test_aimed_shot_reuses_one_budget_shield_armor_and_no_structural_double_hit(self):
        self.powered()
        snapshot = sg.combat_units([self.row], self.a, 1000)[0]
        snapshot['shield'] = 25
        shooter = unit('s', damage=100, ammunition='round')
        ammo = {'round': 1}; trace = []
        hits = plans([shooter], [snapshot], ammo, aim={
            'target_stellar_id': snapshot['id'], 'target_subsystem': 'weapons'}, telemetry=trace)
        result = apply_hits(hits, [snapshot], [])
        self.assertEqual(result['shots'], 1); self.assertEqual(ammo['round'], 0)
        self.assertEqual(snapshot['shield'], 0)
        self.assertEqual(snapshot['subsystems']['weapons'], 1000-75/2)
        self.assertEqual(snapshot['hp'], 5000)
        self.assertEqual(result['hull_damage'], 0)

    def test_containment_blocked_by_shields_pool_intact_modules_then_falls_back(self):
        self.powered(); snapshot = sg.combat_units([self.row], self.a, 1000)[0]
        aim = {'target_stellar_id': snapshot['id'], 'target_subsystem': 'containment'}
        for shield, external, pool in ((1, 999, 0), (0, 1000, 0), (0, 999, 10)):
            target = copy.deepcopy(snapshot); target['shield'] = shield
            target['subsystems']['weapons'] = external
            targets = [target, unit('generator', kind='defense', hp=10000, pool=pool)] if pool else [target]
            trace = []
            hits = plans([unit('s', damage=100)], targets, {}, aim=aim, telemetry=trace)
            self.assertEqual(len(hits[0]), 2)
            self.assertEqual(trace[0]['aimed_shot_fallback'], 'target_ineligible')
        snapshot['shield'] = 0; snapshot['subsystems']['weapons'] = 999
        hits = plans([unit('s', damage=100)], [snapshot], {}, aim=aim)
        self.assertEqual(hits[0][2], 'containment')
        apply_hits(hits, [snapshot], [])
        self.assertEqual(snapshot['subsystems']['containment'], 950)

    def test_destroyed_module_disables_next_salvo_and_weapon_energy_once(self):
        self.powered(1300)
        u = sg.combat_units([self.row], self.a, 1000)[0]
        sg.prepare_salvo([u])
        self.assertEqual(u['energy'], 1280)
        hits = plans([u], [unit('target', hp=10000)], {})
        self.assertEqual(len(hits), 1); self.assertEqual(u['energy'], 1180)
        u['subsystems']['weapons'] = 0
        sg.prepare_salvo([u])
        self.assertEqual(plans([u], [unit('target')], {}), [])
        self.assertGreaterEqual(u['energy'], 1000)
        u['subsystems']['shielding'] = 0
        sg.prepare_salvo([u]); self.assertEqual(u['shield'], 0)

    def test_current_confirmed_intelligence_for_directed_only_and_actual_foreign_anchor(self):
        self.row.empire_id = self.enemy.id
        self.row.system_id, self.row.planet_id = self.destination.id, self.planet.id
        self.war()
        self.assertIs(sg.orbital_target(self.session, self.owner, self.a, self.planet.id, self.row.id), self.row)
        self.a.state.universe['levels']['containment_warfare'] = 1
        with self.assertRaises(DataValidationError):
            sg.authorize_aim(self.session, self.owner, self.a, self.planet.id, self.row.id, 'weapons')
        observation = {'at': 999, 'expires_at': 1001, 'planet_id': str(self.planet.id),
            'stellar_units': {'status': 'CONFIRMED', 'value': {str(self.row.id): {
                'subsystems': dict.fromkeys(SUBSYSTEMS, 1000)}}}}
        self.a.state.universe['intelligence'] = [observation]
        aim = sg.authorize_aim(self.session, self.owner, self.a, self.planet.id, self.row.id, 'weapons')
        self.assertEqual(aim['target_stellar_id'], str(self.row.id))
        self.a.state.last_updated = 1001
        with self.assertRaises(DataValidationError):
            sg.authorize_aim(self.session, self.owner, self.a, self.planet.id, self.row.id, 'weapons')
        self.row.planet_id = None
        with self.assertRaises(DataValidationError):
            sg.orbital_target(self.session, self.owner, self.a, self.planet.id, self.row.id)

    def test_foreign_orbital_counterattack_never_uses_home_defenses_ammo_or_loot(self):
        self.powered(); self.row.empire_id = self.enemy.id
        self.row.system_id, self.row.planet_id = self.destination.id, self.planet.id
        self.b.state.planet_id = 'enemy-home'
        defense(self.b, 'orbital_platform', 'home-fort')
        self.b.state.defenses['ammunition']['anti_ship_missile'] = 7
        before = copy.deepcopy((self.b.state.defenses, self.b.state.stocks))
        for i in range(48): ship(self.a, 'leviathan_hull', f'a{i}')
        snapshots = sg.combat_units([self.row], self.b, 1000)
        report = resolve_battle(self.a, self.a.state.ships[:], self.b, str(self.planet.id),
            config={'target_stellar_id': str(self.row.id)}, stellar_defenders=snapshots,
            planet_defenses=False, allow_loot=False)
        self.assertEqual(report['outcome'], 'attacker')
        self.assertEqual(before, (self.b.state.defenses, self.b.state.stocks))
        self.assertEqual(report['defenses_after'], [])
        self.assertEqual(report['ammunition_before'], {})
        self.assertEqual(report['loot'], {})

    def test_native_orbital_target_keeps_real_shield_and_fortification(self):
        self.powered(); self.row.empire_id = self.enemy.id
        defense(self.b, 'planetary_shield', 'pool', 350)
        ship(self.a, 'scout_hull', 'scout')
        snapshots = sg.combat_units([self.row], self.b, 1000)
        report = resolve_battle(self.a, self.a.state.ships[:], self.b, self.b.state.planet_id,
            config={'target_stellar_id': str(self.row.id)}, stellar_defenders=snapshots)
        self.assertGreater(report['rounds'][0]['defender']['shield_absorbed'], 0)
        self.assertTrue(report['defenses_after'])

    def test_stellar_counterattack_arrives_at_foreign_unit_without_enemy_home_effects(self):
        self.powered()
        invader = copy.deepcopy(self.row)
        invader.id, invader.empire_id = UUID(int=10), self.enemy.id
        invader.system_id, invader.planet_id = self.destination.id, self.planet.id
        invader.payload.update(hp=10, shield=0)
        self.session.add(invader); self.war()
        self.b.state.planet_id = 'enemy-home'
        defense(self.b, 'orbital_platform', 'home-fort')
        before = copy.deepcopy((self.b.state.defenses, self.b.state.stocks))
        result = self.command(action='attack', target_stellar_id=str(invader.id))
        self.assertEqual(self.row.state, 'transit')
        order = self.session.get(m.UniverseOrder, UUID(result['order_id']))
        self.a.state.last_updated = result['arrival_at']
        with patch.object(sg, 'load', return_value=self.b.state):
            sg.complete(self.store, self.session, order, {str(self.owner.id): self.a})
        self.assertEqual(invader.state, 'sealed_wreck')
        self.assertEqual((self.row.system_id, self.row.planet_id), (self.destination.id, self.planet.id))
        self.assertEqual(self.planet.empire_id, self.owner.id)
        self.assertEqual(before, (self.b.state.defenses, self.b.state.stocks))
        battle = self.a.state.universe['battles'][0]
        self.assertEqual(battle['defenses_before'], [])
        self.assertEqual(battle['loot'], {})

    def test_stellar_targeting_native_unit_preserves_native_planetary_shield(self):
        self.powered(); self.planet.empire_id = self.enemy.id
        native = copy.deepcopy(self.row)
        native.id, native.empire_id = UUID(int=10), self.enemy.id
        native.system_id, native.planet_id = self.destination.id, self.planet.id
        native.payload.update(hp=10, shield=0)
        self.session.add(native); self.war()
        defense(self.b, 'planetary_shield', 'native-shield', 350)
        result = self.command(action='attack', target_stellar_id=str(native.id))
        order = self.session.get(m.UniverseOrder, UUID(result['order_id']))
        self.a.state.last_updated = result['arrival_at']
        with patch.object(sg, 'load', return_value=self.b.state), patch.object(sg, 'orbital_units', return_value=[native]):
            sg.complete(self.store, self.session, order, {str(self.owner.id): self.a})
        battle = self.a.state.universe['battles'][0]
        self.assertEqual(battle['defenses_before'][0]['id'], 'native-shield')
        self.assertEqual(battle['rounds'][0]['defender']['shield_absorbed'], 300)
        self.assertEqual(self.planet.empire_id, self.enemy.id)

    def test_incapacitation_cancels_preparation_without_cancelling_new_operation_on_replay(self):
        self.powered(); self.planet.empire_id = self.enemy.id
        self.row.system_id, self.row.planet_id = self.destination.id, self.planet.id
        with patch.object(sg, 'load', return_value=self.b.state):
            result = self.command(action='bombard')
        snapshots = sg.combat_units([self.row], self.a, 1000)
        snapshots[0]['subsystems']['weapons'] = 0
        sg.apply_result([self.row], snapshots, 1000)
        self.assertIsNone(self.row.payload['active_order_id'])
        self.assertIn(result['order_id'], self.row.payload['cancelled_operations'])
        self.row.payload.update(active_order_id='new-operation', active_action='move')
        order = self.session.get(m.UniverseOrder, UUID(result['order_id']))
        self.a.state.last_updated = result['arrival_at']
        sg.complete(self.store, self.session, order, {str(self.owner.id): self.a})
        self.assertEqual(self.row.payload['active_order_id'], 'new-operation')
        self.assertEqual(order.payload['completion'], 'capability_lost')

    def test_superiority_checks_armed_defenses_modes_ammo_and_ships(self):
        self.row.planet_id = self.planet.id
        self.assertTrue(sg._superiority(self.session, self.row, self.b, self.enemy))
        battery = defense(self.b, 'orbital_missile_battery', 'battery')
        self.assertTrue(sg._superiority(self.session, self.row, self.b, self.enemy))
        self.b.state.defenses['ammunition']['anti_ship_missile'] = 1
        self.assertFalse(sg._superiority(self.session, self.row, self.b, self.enemy))
        self.b.state.defenses['units'] = []
        platform = defense(self.b, 'orbital_platform', 'platform'); platform['mode'] = 'interdiction'
        self.assertTrue(sg._superiority(self.session, self.row, self.b, self.enemy))
        platform['mode'] = 'defense'
        self.assertFalse(sg._superiority(self.session, self.row, self.b, self.enemy))
        self.b.state.defenses['units'] = []
        ship(self.b, 'scout_hull', 'local')
        self.assertFalse(sg._superiority(self.session, self.row, self.b, self.enemy))

    def test_bombardment_preparation_visible_energy_once_civil_safe_and_replay(self):
        self.powered(); self.planet.empire_id = self.enemy.id
        self.row.system_id, self.row.planet_id = self.destination.id, self.planet.id
        civil = self.b.state.districts['civil_district']
        with patch.object(sg, 'load', return_value=self.b.state):
            result = self.command(action='bombard')
            self.assertEqual(result['arrival_at']-1000, 64800)
            self.assertTrue(any('bombardeio' in n for n in self.b.state.notices))
            self.assertEqual(self.row.payload['energy'], 8000)
            self.assertEqual(result, self.command(action='bombard'))
            order = self.session.get(m.UniverseOrder, UUID(result['order_id']))
            self.a.state.last_updated = result['arrival_at']
            engines = {str(self.owner.id): self.a}
            sg.complete(self.store, self.session, order, engines)
            after = copy.deepcopy(self.b.state.districts)
            sg.complete(self.store, self.session, order, engines)
        self.assertEqual(self.b.state.districts, after)
        self.assertEqual(after['civil_district'], civil)
        self.assertTrue(self.b.state.universe['battles'][0]['infrastructure_losses'])

    def test_bombardment_cancelled_on_new_fortification_or_incapacitation(self):
        for loss in ('fort', 'weapons', 'control', 'containment', 'peace'):
            with self.subTest(loss=loss):
                self.setUp(); self.powered(); self.planet.empire_id = self.enemy.id
                self.row.system_id, self.row.planet_id = self.destination.id, self.planet.id
                with patch.object(sg, 'load', return_value=self.b.state):
                    result = self.command(action='bombard')
                    order = self.session.get(m.UniverseOrder, UUID(result['order_id']))
                    if loss == 'fort': defense(self.b, 'heavy_em_cannon', 'new-fort')
                    elif loss == 'peace': self.store.relation.return_value = {'status': 'neutral'}
                    else: self.row.payload['subsystems'][loss] = 0
                    before = copy.deepcopy(self.b.state.districts)
                    self.a.state.last_updated = result['arrival_at']
                    sg.complete(self.store, self.session, order, {str(self.owner.id): self.a})
                    self.assertEqual(before, self.b.state.districts)
                    self.assertFalse(self.b.state.universe.get('battles'))

    def test_strategic_damage_does_not_launch_or_intercept_missiles(self):
        defense(self.b, 'missile_interceptor', 'interceptor')
        self.b.state.defenses['ammunition']['interceptor_missile'] = 5
        ammunition = copy.deepcopy(self.b.state.defenses['ammunition'])
        strategic_damage(self.a, self.b, 1000)
        self.assertEqual(ammunition, self.b.state.defenses['ammunition'])

    def test_shared_strategic_impact_preserves_frozen_missile_results(self):
        expected = {
            0: '4a3336f792570e72a9257dc11e230727b39233eb057dad0b0fb004ecf5838ce9',
            1: '2c09aff161affb5a942712491befe0f7d202caaba06a1fddff70fb7667f5a035',
            4: 'b508283a2da72c5d05e0ab4dbcc10a531c6ee8bc668880551429f7b9e6ec2119',
            10: '594e37707dfac6ab2ae0d6616ff3a31815e496f7869844d1545f5de8f16fd16b',
        }
        for count, digest in expected.items():
            a, b = engine(self.catalog, 'a'), engine(self.catalog, 'b')
            defense(b, 'planetary_shield', 'shield', 350)
            defense(b, 'orbital_platform', 'platform')
            defense(b, 'missile_interceptor', 'interceptor')
            b.state.defenses['ammunition']['interceptor_missile'] = 2
            report = resolve_missiles(a, b, count)
            actual = hashlib.sha256(json.dumps([report, b.state.districts], sort_keys=True).encode()).hexdigest()
            self.assertEqual(actual, digest)

    def test_shared_travel_arithmetic_keeps_catalog_validation(self):
        self.assertEqual(travel_distance((0,0), (3,4)), 5)
        self.assertEqual(travel_seconds(5, 1.7), round(5*180/1.7))
        self.assertEqual(travel_distance((0,0), (0,0), intra_system=True), .25)
        with self.assertRaises(DataValidationError):
            preview_travel(self.catalog, (0,0), (1,0), {'hull_id': 'scout_hull',
                'propulsion_id': 'chemical_drive', 'fuel_id': 'fusion_fuel', 'mass': 10}, 'chemical_drive', 'NORMAL')
        self.assertEqual(combat_config({'target_stellar_id': 'unit'})['target_stellar_id'], 'unit')
