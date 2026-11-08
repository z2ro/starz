"""Deterministic Combat 3.0 contracts, synthetic in-memory participants only."""
import copy
import hashlib
import json
import unittest

from starz.data import Catalog, DataValidationError
from starz.simulation import Engine
from starz.persistent.combat import (
    apply_hits, defense_units, fleet_units, local_defenders, plans,
    resolve_battle, resolve_missiles,
)
from starz.persistent.combat_rules import (
    EXPERIMENTS, combat_config, ew_contest, interdiction_delay,
)


def engine(catalog, name, levels=None):
    e = Engine.new(catalog, now=1000)
    e.state.planet_id = name
    e.state.universe = {'levels': dict(levels or {})}
    e.state.defenses = {'units': [], 'queue': [], 'ammunition': {}}
    e.state.population_total = 500
    e.state.districts.update(solar_field=100, processor=3, manufacturing=3)
    return e


def ship(e, hull, identity):
    definition = e.catalog.get('ships', hull)
    value = {'id': identity, 'hull_id': hull, 'ready_at': 0,
             'crew': definition.crew, 'mass': definition.mass,
             'origin_planet_id': e.state.planet_id,
             'system_x': e.state.system_x, 'system_y': e.state.system_y}
    e.state.ships.append(value)
    return value


def defense(e, kind, identity, charge=0):
    value = {'id': identity, 'type': kind,
             'hp': e.catalog.get('defenses', kind).hull_points, 'charge': charge}
    e.state.defenses['units'].append(value)
    return value


def unit(identity, hull='scout_hull', cls='light', hp=100, shield=0, damage=10, **extra):
    return {'id': identity, 'type': hull, 'kind': 'ship', 'class': cls,
            'hp': hp, 'shield': shield, 'damage': damage, 'armor': 1,
            'modifiers': {}, **extra}


def legacy_fixture(catalog, scenario):
    a = engine(catalog, 'attacker', {'weapons': 2, 'armor': 2, 'shields': 2})
    b = engine(catalog, 'defender', {'weapons': 1, 'armor': 1, 'shields': 1})
    if scenario == 'loot':
        ship(a, 'leviathan_hull', 'a1'); ship(a, 'wayfarer_hull', 'a2')
        defense(b, 'point_defense', 'd1')
    elif scenario == 'salvos':
        ship(a, 'scout_hull', 'a1'); ship(b, 'dominion_hull', 'b1')
    elif scenario == 'shield_ammo':
        for i in range(3):
            ship(a, 'sentinel_hull', f'a{i}')
        ship(b, 'aegis_hull', 'b1')
        defense(b, 'planetary_shield', 'd1', 350)
        defense(b, 'orbital_missile_battery', 'd2')
        b.state.defenses['ammunition']['anti_ship_missile'] = 3
    else:
        for i in range(6):
            ship(a, 'vanguard_hull', f'a{i}')
        for i in range(2):
            ship(b, 'aegis_hull', f'b{i}')
    return a, b


def legacy_digest(report, a, b):
    report = copy.deepcopy(report)
    for salvo in report['rounds']:
        salvo.pop('targeting', None)
    report.pop('combat_config', None)
    states = [{key: getattr(e.state, key) for key in ('ships', 'fleets', 'stocks', 'defenses', 'universe')}
              for e in (a, b)]
    return hashlib.sha256(json.dumps([report, states], sort_keys=True).encode()).hexdigest()


class Combat3(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = Catalog.load('game_data', 'persistent_data')

    def test_b01_frozen_legacy_report_and_persistent_state(self):
        # Captured from the pre-P2 resolver, not a second combat implementation.
        expected = {
            'loot': '8653dc67e8c90489475ae843a6a7a77f24d06a11deadc69248de7609dc0a05bf',
            'salvos': '1378af1ebda574336b28bc4d620654ac022dd59df8a704cdb9eef0573e4b954d',
            'shield_ammo': '04cf181af1fe3579f16d3c8c632ee1a6ac168751ffb76be656265aa2cc86d866',
            'mixed': '05eb349ef76ef2a554f200c19dd1f734c025be1720e8c62e5a774261a9c1d889',
        }
        for scenario, digest in expected.items():
            for config in (None, {'doctrine': 'balanced', 'weapon_profile': 'standard'}):
                with self.subTest(scenario=scenario, config=config):
                    a, b = legacy_fixture(self.catalog, scenario)
                    report = resolve_battle(a, list(a.state.ships), b, b.state.planet_id, config=config)
                    self.assertEqual(legacy_digest(report, a, b), digest)

    def test_b02_b04_class_matchups_and_replay(self):
        for light, count, heavy, heavy_count in (
                ('scout_hull', 10, 'vanguard_hull', 3),
                ('vanguard_hull', 6, 'aegis_hull', 2),
                ('sentinel_hull', 4, 'leviathan_hull', 1)):
            for reverse in (False, True):
                a, b = engine(self.catalog, 'a'), engine(self.catalog, 'b')
                left, right = (b, a) if reverse else (a, b)
                for i in range(count): ship(left, light, f'l{i}')
                for i in range(heavy_count): ship(right, heavy, f'h{i}')
                replay_a, replay_b = copy.deepcopy(a), copy.deepcopy(b)
                report = resolve_battle(a, list(a.state.ships), b, 'b')
                self.assertEqual(report, resolve_battle(replay_a, list(replay_a.state.ships), replay_b, 'b'))
                self.assertLessEqual(len(report['rounds']), 6)

    def test_b09_doctrines_fallback_and_ties(self):
        shooter = unit('s', modifiers={'medium': 3, 'capital': 2})
        targets = [unit('light'), unit('medium', cls='medium'), unit('capital', cls='capital')]
        for doctrine, identity in (('balanced', 'medium'), ('interception', 'light'), ('rupture', 'capital')):
            self.assertEqual(plans([shooter], targets, {}, doctrine=doctrine)[0][0]['id'], identity)
        self.assertEqual(plans([shooter], targets[1:], {}, doctrine='interception')[0][0]['id'], 'medium')
        self.assertEqual(plans([shooter], targets[:2], {}, doctrine='rupture')[0][0]['id'], 'medium')
        for targets in ([unit('a'), unit('z')], [unit('z'), unit('a')]):
            self.assertEqual(plans([shooter], targets, {}, doctrine='interception')[0][0]['id'], 'z')

    def test_b05_b06_exact_escort_hulls_and_attacker_class(self):
        all_hulls = self.catalog.items['ships']
        approved = {
            'vanguard_hull': ('scout_hull', 'wayfarer_hull', 'odyssey_hull'),
            'sentinel_hull': ('scout_hull', 'wayfarer_hull', 'odyssey_hull', 'atlas_hull'),
            'aegis_hull': ('atlas_hull', 'dominion_hull'),
        }
        for escort_hull in all_hulls:
            for protected_hull in all_hulls:
                for source_class in ('light', 'capital'):
                    with self.subTest(escort=escort_hull, protected=protected_hull, source=source_class):
                        source = unit('s', cls=source_class)
                        target = unit('target', protected_hull, hp=1)
                        escort = unit('escort', escort_hull, hp=500)
                        trace = []
                        plans([source], [target, escort], {}, escorts=True, telemetry=trace)
                        expected = protected_hull in approved.get(escort_hull, ()) and (escort_hull != 'sentinel_hull' or source_class == 'light')
                        self.assertEqual(trace[0]['redirected'], expected)
        trace = []
        plans([unit('s', cls='light', kind='defense')],
              [unit('target', hp=1), unit('escort', 'sentinel_hull')], {}, escorts=True, telemetry=trace)
        self.assertFalse(trace[0]['redirected'])

    def test_b06_one_redirect_recalculates_class_and_no_recursion(self):
        sources = [unit(str(i), cls='capital', damage=10, modifiers={'medium': 3, 'light': 2}) for i in range(2)]
        support = unit('support', 'odyssey_hull', cls='medium', hp=50)
        escort = unit('escort', 'vanguard_hull', hp=500)
        trace = []
        hits = plans(sources, [support, escort], {}, escorts=True, telemetry=trace)
        self.assertEqual([t['redirected'] for t in trace], [True, False])
        self.assertEqual([damage for _, damage in hits], [20, 30])
        self.assertEqual([t['effective_target_id'] for t in trace], ['escort', 'support'])
        trace = []
        plans([unit('s')], [escort], {}, escorts=True, telemetry=trace)
        self.assertFalse(trace[0]['redirected'])

    def test_b06_projected_dead_escort_cannot_redirect(self):
        support = unit('support', 'odyssey_hull', cls='medium', hp=20)
        escort = unit('escort', 'vanguard_hull', hp=5)
        sources = [unit('direct', damage=6, modifiers={'light': 10}),
                   unit('support-shot', damage=6, modifiers={'medium': 10})]
        trace = []
        plans(sources, [support, escort], {}, escorts=True, telemetry=trace)
        self.assertEqual([t['effective_target_id'] for t in trace], ['escort', 'support'])
        self.assertFalse(any(t['redirected'] for t in trace))

    def test_b07_simultaneous_death_preserves_planned_fire(self):
        a, b = engine(self.catalog, 'a'), engine(self.catalog, 'b')
        ship(a, 'leviathan_hull', 'a'); ship(b, 'leviathan_hull', 'b')
        a.state.universe['ship_health'] = {'a': 1}
        b.state.universe['ship_health'] = {'b': 1}
        # Remove shields using the catalog-independent planning/apply contract.
        left, right = [unit('a', hp=1)], [unit('b', hp=1)]
        ahits, bhits = plans(left, right, {}), plans(right, left, {})
        apply_hits(ahits, right, []); apply_hits(bhits, left, [])
        self.assertEqual((left[0]['hp'], right[0]['hp']), (0, 0))
        report = resolve_battle(a, a.state.ships[:], b, 'b')
        self.assertTrue(report['rounds'][0]['attacker']['shots'])
        self.assertTrue(report['rounds'][0]['defender']['shots'])

    def test_b07_escort_dies_after_redirect_and_fires_only_current_salvo(self):
        a = engine(self.catalog, 'a', {'fire_control_doctrine': 1})
        b = engine(self.catalog, 'b', {'fleet_coordination': 1})
        ship(a, 'leviathan_hull', 'attacker')
        ship(b, 'odyssey_hull', 'support'); ship(b, 'vanguard_hull', 'escort')
        b.state.universe['ship_health'] = {'support': 1, 'escort': 1}
        report = resolve_battle(a, a.state.ships[:], b, 'b', config={'doctrine': 'rupture'})
        first, second = report['rounds']
        shot = first['targeting']['attacker']['shots'][0]
        self.assertEqual((shot['intended_target_id'], shot['effective_target_id']), ('support', 'escort'))
        self.assertTrue(shot['redirected'])
        self.assertEqual(first['attacker']['shots'], 2)
        self.assertEqual(second['attacker']['shots'], 1)
        self.assertFalse(second['targeting']['attacker']['shots'][0]['redirected'])
        self.assertEqual(second['targeting']['attacker']['shots'][0]['effective_target_id'], 'support')

    def test_b08_local_garrison_only_and_research_gate(self):
        a, b = engine(self.catalog, 'a'), engine(self.catalog, 'b')
        ship(a, 'scout_hull', 'attacker')
        support = ship(b, 'odyssey_hull', 'support')
        ship(b, 'vanguard_hull', 'escort')
        b.state.fleets = [{'id': 'f1', 'status': 'ARRIVED', 'ship_ids': ['support']},
                          {'id': 'f2', 'status': 'ARRIVED', 'ship_ids': ['escort']}]
        b.state.universe['fleet_planets'] = {'f1': 'b', 'f2': 'b'}
        b.state.universe['ship_health'] = {'support': 1}
        without_a, without_b = copy.deepcopy(a), copy.deepcopy(b)
        report = resolve_battle(without_a, without_a.state.ships[:], without_b, 'b')
        self.assertFalse(report['rounds'][0]['targeting']['attacker']['shots'][0]['redirected'])
        b.state.universe['levels']['fleet_coordination'] = 1
        local_a, local_b = copy.deepcopy(a), copy.deepcopy(b)
        report = resolve_battle(local_a, local_a.state.ships[:], local_b, 'b')
        self.assertTrue(report['rounds'][0]['targeting']['attacker']['shots'][0]['redirected'])
        b.state.universe['fleet_planets']['f2'] = 'elsewhere'
        self.assertEqual(local_defenders(b, 'b'), [support])
        b.state.universe['fleet_planets']['f2'] = 'b'; b.state.fleets[1]['status'] = 'TRANSIT'
        self.assertEqual(local_defenders(b, 'b'), [support])
        b.state.fleets[1]['status'] = 'ARRIVED'; b.state.ships[1]['ready_at'] = 1001
        self.assertEqual(local_defenders(b, 'b'), [support])

    def test_b10_ammunition_once_and_empty_battery(self):
        source = unit('battery', cls='medium', kind='defense', ammunition='anti_ship_missile')
        targets = [unit('support', 'odyssey_hull', hp=1), unit('escort', 'vanguard_hull')]
        ammo = {'anti_ship_missile': 1}; trace = []
        hits = plans([source, source], targets, ammo, escorts=True, profile=(1.25,.8), telemetry=trace)
        self.assertEqual(len(hits), 1); self.assertEqual(ammo['anti_ship_missile'], 0)
        self.assertTrue(trace[0]['redirected'])
        self.assertFalse(plans([source], targets, ammo))

    def test_b11_b12_pure_ew_presence_redundancy_and_resistance(self):
        emitter = engine(self.catalog, 'e', {'electronic_warfare': 1, 'sensor_array': 3, 'computing': 2})
        observer = engine(self.catalog, 'o', {'sensor_array': 1, 'computing': 1})
        odyssey = unit('secret-emitter', 'odyssey_hull')
        before = copy.deepcopy((emitter.state.to_dict(), observer.state.to_dict(), odyssey))
        for experiment in EXPERIMENTS:
            self.assertTrue(ew_contest(emitter, [odyssey], observer, experiment))
            self.assertTrue(ew_contest(emitter, [odyssey, {**odyssey, 'id': 'second'}], observer, experiment))
            self.assertFalse(ew_contest(emitter, [], observer, experiment))
            self.assertFalse(ew_contest(emitter, [{**odyssey, 'hp': 0}], observer, experiment))
            self.assertFalse(ew_contest(emitter, [{**odyssey, 'kind': 'defense'}], observer, experiment))
        self.assertEqual(before, (emitter.state.to_dict(), observer.state.to_dict(), odyssey))
        observer.state.universe['levels'].update(sensor_array=3, computing=2)
        self.assertFalse(ew_contest(emitter, [odyssey], observer))
        observer.state.universe['levels']['computing'] = 20
        self.assertFalse(ew_contest(emitter, [odyssey], observer))
        observer.state.universe['levels'] = {}
        emitter.state.universe['levels']['electronic_warfare'] = 0
        self.assertFalse(ew_contest(emitter, [odyssey], observer))

    def test_b11_ew_source_lost_next_salvo_and_no_secret_telemetry(self):
        a = engine(self.catalog, 'a', {'fire_control_doctrine': 1, 'weapons': 10})
        b = engine(self.catalog, 'b', {'electronic_warfare': 1, 'sensor_array': 2, 'computing': 2})
        ship(a, 'sentinel_hull', 'a')
        ship(b, 'odyssey_hull', 'odyssey'); ship(b, 'dominion_hull', 'capital')
        b.state.universe['ship_health'] = {'odyssey': 1}
        report = resolve_battle(a, a.state.ships[:], b, 'b', config={'doctrine': 'rupture'})
        self.assertEqual(report['rounds'][0]['targeting']['attacker']['doctrine'], 'balanced')
        self.assertEqual(report['rounds'][1]['targeting']['attacker']['doctrine'], 'rupture')
        trace = json.dumps(report)
        for secret in ('source_ship_id', 'electronic_warfare', 'sensor_array', 'computing', 'resistance', 'strength'):
            self.assertNotIn(secret, trace)

    def test_b13_single_budget_planet_naval_shield_hull_and_armor(self):
        for rules in EXPERIMENTS.values():
            profile = (rules['shield'], rules['hull'])
            generator = unit('pool', kind='defense', pool=25, hp=1000)
            target = unit('target', shield=25, hp=1000, armor=2)
            result = apply_hits([(target, 100)], [target, generator], [generator], profile=profile)
            self.assertEqual(result['shots'], 1)
            self.assertEqual(result['shield_absorbed'], 50)
            self.assertAlmostEqual(result['hull_damage'], (100-50/profile[0])*profile[1]/2)
            self.assertEqual((generator['pool'], target['shield']), (0, 0))
            bare = unit('bare', hp=1000)
            result = apply_hits([(bare, 100)], [bare], [], profile=profile)
            self.assertAlmostEqual(result['hull_damage'], 100*profile[1])
            charged = unit('charged', shield=1000)
            result = apply_hits([(charged, 100)], [charged], [], profile=profile)
            self.assertAlmostEqual(result['shield_absorbed'], 100*profile[0])
            self.assertEqual(result['hull_damage'], 0)

    def test_b13_projection_uses_same_shield_budget_and_keeps_real_state(self):
        targets = [unit('first', hp=10, shield=10), unit('second', hp=100),
                   unit('pool', kind='defense', pool=10, hp=1000)]
        before = copy.deepcopy(targets)
        hits = plans([unit('s1', damage=100), unit('s2', damage=100)], targets, {}, profile=(1.25,.8))
        self.assertEqual([t['id'] for t, _ in hits], ['first', 'second'])
        self.assertEqual(targets, before)

    def test_b10_b13_actual_generator_charge_and_ammo_persist_once(self):
        for experiment, rules in EXPERIMENTS.items():
            a = engine(self.catalog, 'a', {'shield_disruption': 1})
            b = engine(self.catalog, 'b')
            ship(a, 'scout_hull', 'attacker')
            defense(b, 'planetary_shield', 'generator', 300)
            defense(b, 'orbital_missile_battery', 'battery')
            b.state.defenses['ammunition']['anti_ship_missile'] = 2
            initial_power = fleet_units(a, a.state.ships)[0]['damage']
            report = resolve_battle(a, a.state.ships[:], b, 'b', config={
                'weapon_profile': 'anti_shield', 'experiment': experiment})
            shots = sum(r['defender']['shots'] for r in report['rounds'])
            absorbed = sum(r['defender']['shield_absorbed'] for r in report['rounds'])
            self.assertAlmostEqual(absorbed, shots*initial_power*rules['shield'])
            generator = next(u for u in b.state.defenses['units'] if u['id'] == 'generator')
            self.assertAlmostEqual(generator['charge'], 300-absorbed)
            self.assertEqual(report['ammunition_consumed']['anti_ship_missile'], 2)
            self.assertEqual(sum(r['attacker']['shots'] for r in report['rounds']), 2)
            self.assertEqual(report['combat_config']['weapon_profile'], 'anti_shield')
            self.assertEqual(report['combat_config']['experiment'], experiment)

    def test_b13_unshielded_profile_has_hull_cost_in_real_battle(self):
        a = engine(self.catalog, 'a', {'shield_disruption': 1})
        b = engine(self.catalog, 'b')
        ship(a, 'scout_hull', 'attacker'); defense(b, 'point_defense', 'target')
        standard_a, standard_b = copy.deepcopy(a), copy.deepcopy(b)
        standard = resolve_battle(standard_a, standard_a.state.ships[:], standard_b, 'b')
        specialized = resolve_battle(a, a.state.ships[:], b, 'b', config={'weapon_profile': 'anti_shield'})
        self.assertAlmostEqual(sum(r['defender']['hull_damage'] for r in specialized['rounds']),
                               .8*sum(r['defender']['hull_damage'] for r in standard['rounds']))

    def test_config_gates_and_invalid_values_do_not_mutate_state(self):
        for config in ({'version': 2}, {'version': True}, {'doctrine': 'protection'},
                       {'weapon_profile': 'magic'}, {'experiment': 'production'}, {'extra': 1}, []):
            a, b = engine(self.catalog, 'a'), engine(self.catalog, 'b')
            before = copy.deepcopy((a.state.to_dict(), b.state.to_dict()))
            with self.assertRaises(DataValidationError):
                resolve_battle(a, [], b, 'b', config=config)
            self.assertEqual(before, (a.state.to_dict(), b.state.to_dict()))
        a, b = engine(self.catalog, 'a'), engine(self.catalog, 'b')
        ship(a, 'scout_hull', 'a'); ship(b, 'scout_hull', 'b')
        report = resolve_battle(a, a.state.ships[:], b, 'b', config={'doctrine': 'rupture', 'weapon_profile': 'anti_shield'})
        self.assertEqual(report['rounds'][0]['targeting']['attacker']['doctrine'], 'balanced')
        self.assertEqual(report['combat_config']['weapon_profile'], 'standard')
        self.assertEqual(combat_config(), {'version': 1, 'doctrine': 'balanced', 'weapon_profile': 'standard', 'experiment': 'intermediate'})

    def test_interdiction_platform_targetable_without_conventional_fire(self):
        a, b = engine(self.catalog, 'a'), engine(self.catalog, 'b')
        ship(a, 'scout_hull', 'a')
        platform = defense(b, 'orbital_platform', 'platform'); platform['mode'] = 'interdiction'
        initial = defense_units(b)[0]
        self.assertEqual(initial['damage'], 0)
        self.assertEqual(initial['hp'], platform['hp'])
        report = resolve_battle(a, a.state.ships[:], b, 'b')
        self.assertTrue(all(r['attacker']['shots'] == 0 for r in report['rounds']))
        self.assertLess(report['defenses_after'][0]['hp'], platform['hp'])

    def test_missile_ranking_unchanged_by_interdiction_mode(self):
        a, b = engine(self.catalog, 'a'), engine(self.catalog, 'b')
        defense(b, 'orbital_platform', 'platform'); defense(b, 'heavy_em_cannon', 'cannon')
        legacy = copy.deepcopy(b)
        b.state.defenses['units'][0]['mode'] = 'interdiction'
        actual = resolve_missiles(a, b, 1)
        expected = resolve_missiles(a, legacy, 1)
        for key in ('defenses_before', 'defenses_after'):
            for value in actual[key]: value.pop('mode', None)
        self.assertEqual(actual, expected)

    def test_interdiction_delay_d08_and_invalid_inputs(self):
        for experiment, small, cap in (('conservative', 11, 600), ('intermediate', 26, 1800), ('elevated', 41, 3600)):
            self.assertEqual(interdiction_delay(101, experiment), small)
            self.assertEqual(interdiction_delay(100000, experiment), cap)
            self.assertEqual(interdiction_delay(0, experiment), 0)
        for value in (-1, float('inf'), float('nan'), '100', True):
            with self.assertRaises(DataValidationError): interdiction_delay(value)
        with self.assertRaises(DataValidationError): interdiction_delay(100, 'unknown')
