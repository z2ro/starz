import unittest
import copy
import tempfile
from pathlib import Path
from unittest.mock import patch

import yaml

from starz.data import Catalog, DataValidationError
from starz.simulation import Engine, GameState
from tests.json_fixture import load_or_create, save
from starz.effects import require_available, unlocked_content
from starz.universe import generate_system

ROOT = Path(__file__).parents[1]


class EconomyTests(unittest.TestCase):
    def setUp(self):
        self.catalog = Catalog.load(ROOT / 'game_data')
        self.engine = Engine.new(self.catalog, now=1000)
        self.engine.state.districts = {'solar_field': 1, 'ore_extractor': 1}
        self.engine.state.stocks = dict.fromkeys(self.engine.state.stocks, 0.0)

    def test_energy_coverage(self):
        for generation, consumption, expected in [(8, 2, 2), (2, 2, 2), (1, 2, 1), (0, 0, 2)]:
            with self.subTest(generation=generation, consumption=consumption):
                self.catalog.get('districts', 'solar_field').energy_generation = generation
                self.catalog.get('districts', 'ore_extractor').energy_consumption = consumption
                self.engine.state.stocks['raw_ore'] = 0
                self.engine._produce(60)
                self.assertAlmostEqual(self.engine.state.stocks['raw_ore'], expected)

    def test_workforce_coverage(self):
        self.engine.state.districts = {'ore_extractor': 1}
        self.catalog.get('districts', 'ore_extractor').energy_consumption = 0
        for crew, demand, coverage, available in [(0, 80, 1, 20), (0, 120, 100/120, 0), (20, 80, 1, 0), (30, 90, 70/90, 0)]:
            with self.subTest(crew=crew, demand=demand):
                self.catalog.get('districts', 'ore_extractor').workforce = demand
                self.engine.state.ships = [{'crew': crew}]
                c = self.engine.capacities()
                self.assertAlmostEqual(c['workforce_coverage'], coverage)
                self.assertEqual(c['available_population'], available)
                self.engine.state.stocks['raw_ore'] = 0
                self.engine._produce(60)
                self.assertAlmostEqual(self.engine.state.stocks['raw_ore'], 2 * coverage)

    def test_processor_consumes_once_and_produces_all_outputs(self):
        self.engine.state.districts = {'processor': 2}
        self.catalog.get('districts', 'processor').energy_consumption = 0
        self.engine.state.stocks.update(raw_ore=10, volatiles=10)
        self.engine._produce(60)
        self.assertEqual(self.engine.state.stocks['raw_ore'], 7)
        self.assertEqual(self.engine.state.stocks['volatiles'], 9)
        self.assertEqual(self.engine.state.stocks['refined_alloy'], 2)
        self.assertEqual(self.engine.state.stocks['components'], .5)

    def test_factor_does_not_leak(self):
        self.engine.state.districts = {'processor': 1, 'ore_extractor': 1}
        for key in self.engine.state.districts:
            self.catalog.get('districts', key).energy_consumption = 0
        self.engine._produce(60)
        self.assertEqual(self.engine.state.stocks['raw_ore'], 2)
        self.assertEqual(self.engine.state.stocks['refined_alloy'], 0)

    def test_building_completes_mid_offline(self):
        self.engine.state.districts = {'solar_field': 1}
        self.engine.state.construction = [{'id': 'ore_extractor', 'complete_at': 1060}]
        self.engine.advance(1600)
        self.assertEqual(self.engine.state.stocks['raw_ore'], 18)

    def test_input_shortage_scales_entire_batch(self):
        self.engine.state.districts = {'processor': 3}
        self.catalog.get('districts', 'processor').energy_consumption = 0
        self.engine.state.stocks.update(raw_ore=1.5, volatiles=2)
        self.engine._produce(120)
        self.assertEqual(self.engine.state.stocks['raw_ore'], 0)
        self.assertEqual(self.engine.state.stocks['volatiles'], 1.5)
        self.assertEqual(self.engine.state.stocks['refined_alloy'], 1)
        self.assertEqual(self.engine.state.stocks['components'], .25)

    def test_resource_depletion_does_not_depend_on_poll_frequency(self):
        e = self.engine
        e.state.districts = {'processor': 1, 'ore_extractor': 1}
        for key in e.state.districts:
            self.catalog.get('districts', key).energy_consumption = 0
        self.catalog.get('districts', 'ore_extractor').production = {'raw_ore': .5}
        e.state.stocks.update(raw_ore=1, volatiles=.75)
        split = Engine(self.catalog, copy.deepcopy(e.state))
        e.advance(1600)
        for now in range(1010, 1601, 10):
            split.advance(now)
        for resource, amount in e.state.stocks.items():
            self.assertAlmostEqual(amount, split.state.stocks[resource])


class OfflineAndFleetTests(unittest.TestCase):
    def setUp(self):
        self.catalog = Catalog.load(ROOT / 'game_data')
        self.engine = Engine.new(self.catalog, now=0)

    def test_research_boundary_executes_unlocks(self):
        e = self.engine
        e.research('orbital_engineering', now=0)
        observations = []
        produce = e._produce
        def observe(seconds):
            observations.append((e.state.last_updated, seconds, unlocked_content(self.catalog, e.state.research['completed'])))
            produce(seconds)
        with patch.object(e, '_produce', side_effect=observe):
            e.advance(600)
        self.assertEqual(observations[0], (0, 45, set()))
        self.assertEqual(observations[1], (45, 555, {'orbital_shipyard'}))
        require_available(self.catalog, e.state, self.catalog.get('districts', 'orbital_shipyard'))

    def test_simultaneous_boundaries_and_partition_are_deterministic(self):
        e = self.engine
        e.state.construction = [{'id': 'solar_field', 'complete_at': 60}, {'id': 'ore_extractor', 'complete_at': 60}]
        e.state.research.update(active='orbital_engineering', complete_at=60, remaining_work=60)
        e.state.fleets = [{'id': 'fleet', 'name': 'F', 'status': 'TRANSIT', 'arrival_at': 60, 'x': 0, 'y': 0, 'destination_x': 1, 'destination_y': 0, 'ship_ids': []}]
        split = Engine(self.catalog, copy.deepcopy(e.state))
        split.state.construction.reverse()
        e.advance(600)
        split.advance(60)
        self.assertEqual(split.state.fleets[0]['status'], 'ARRIVED')
        self.assertIn('orbital_engineering', split.state.research['completed'])
        split.advance(600)
        self.assertEqual(e.state.to_dict(), split.state.to_dict())
        before = copy.deepcopy(e.state.to_dict())
        e.advance(600)
        self.assertEqual(e.state.to_dict(), before)
        with self.assertRaises(DataValidationError):
            e.advance(599)
        with self.assertRaises(DataValidationError):
            e.advance(float('nan'))
        self.assertEqual(e.state.to_dict(), before)

    def test_overdue_at_cursor_is_applied_once(self):
        e = self.engine
        e.state.construction = [{'id': 'ore_extractor', 'complete_at': 0}]
        e.advance(0)
        self.assertEqual(e.state.districts['ore_extractor'], 2)
        e.advance(0)
        self.assertEqual(e.state.districts['ore_extractor'], 2)

    def ready_ship(self):
        e = self.engine
        e.state.districts['orbital_shipyard'] = 1
        ship = e.build_ship(now=0)
        e.advance(30)
        return ship

    def test_round_trip_fleet_can_receive_second_order_from_B(self):
        e = self.engine
        self.ready_ship()
        e.state.system_x = e.state.system_y = 0
        fuel_before = e.state.stocks['ion_fuel']
        first = e.send_fleet(3, 0, 'chemical_drive', 'NORMAL', now=30)
        self.assertEqual(first['preview']['distance'], 3)
        self.assertEqual(first['preview']['fuel_cost'], 30)
        self.assertEqual(first['arrival_at'], 570)
        with self.assertRaises(DataValidationError):
            e.send_fleet(4, 0, 'chemical_drive', 'NORMAL', now=30, fleet_id=first['id'])
        e.advance(first['arrival_at'])
        self.assertEqual((e.state.fleets[0]['x'], e.state.fleets[0]['y']), (3, 0))
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'state.json'
            save(e, path)
            e = load_or_create(self.catalog, path)
        preview = e.preview_travel(4, 0, 'chemical_drive', 'NORMAL', fleet_id=first['id'])
        self.assertEqual(preview['origin'], [3, 0])
        self.assertEqual(preview['distance'], 1)
        self.assertEqual(preview['fuel_cost'], 10)
        self.assertEqual(preview['eta_seconds'], 180)
        second = e.send_fleet(4, 0, 'chemical_drive', 'NORMAL', now=570, fleet_id=first['id'])
        self.assertEqual(second['id'], first['id'])
        self.assertEqual(second['ship_ids'], first['ship_ids'])
        self.assertEqual(len(e.state.fleets), 1)
        e.advance(second['arrival_at'])
        self.assertEqual((e.state.fleets[0]['x'], e.state.fleets[0]['y']), (4, 0))
        self.assertEqual(e.state.fleets[0]['status'], 'ARRIVED')
        self.assertEqual(e.state.stocks['ion_fuel'], fuel_before - 40)

    def test_preview_and_send_reject_invalid_subject_without_debit(self):
        e = self.engine
        ship = self.ready_ship()
        before = copy.deepcopy(e.state.to_dict())
        attempts = [
            dict(target_x=e.state.system_x, target_y=e.state.system_y, propulsion_id='chemical_drive', mode='NORMAL'),
            dict(target_x=20, target_y=0, propulsion_id='nuclear_drive', mode='NORMAL'),
            dict(target_x=20, target_y=0, propulsion_id='chemical_drive', mode='INVALID'),
            dict(target_x=20, target_y=0, propulsion_id='chemical_drive', mode='NORMAL', fleet_id='missing'),
            dict(target_x=20, target_y=0, propulsion_id='chemical_drive', mode='NORMAL', fleet_id='missing', ship_id=ship['id']),
        ]
        for payload in attempts:
            with self.subTest(payload=payload):
                with self.assertRaises(DataValidationError):
                    e.preview_travel(**payload)
                with self.assertRaises(DataValidationError):
                    e.send_fleet(**payload, now=30)
                self.assertEqual(e.state.to_dict(), before)

    def test_legacy_state_loads_without_schema_reset(self):
        state = self.engine.state.to_dict()
        self.assertEqual(GameState.from_dict(state).to_dict(), state)


class DataDrivenTests(unittest.TestCase):
    def setUp(self):
        self.catalog = Catalog.load(ROOT / 'game_data')

    def load_modified(self, kind, item_id, changes):
        with tempfile.TemporaryDirectory() as directory:
            for group, items in self.catalog.items.items():
                path = Path(directory) / group / 'items.yaml'
                path.parent.mkdir()
                entries = [item.model_dump() for item in items.values()]
                for entry in entries:
                    if group == kind and entry['id'] == item_id:
                        entry.update(changes)
                path.write_text(yaml.safe_dump(entries))
            return Catalog.load(directory)

    def test_archetypes_and_modes_load_and_drive_generation(self):
        self.assertEqual(len(self.catalog.items['stars']), 4)
        self.assertEqual(len(self.catalog.items['planets']), 1)
        self.assertEqual(len(self.catalog.items['travel_modes']), 3)
        changed = self.load_modified('planets', 'rocky_world', {'water_range': [42, 42]})
        self.assertEqual(generate_system('seed', 0, 0, changed).planet.water, 42)

    def test_invalid_data_fails(self):
        cases = [
            ('stars', 'g_class', {'mass_range': [2, 1]}),
            ('stars', 'g_class', {'weight': 0}),
            ('stars', 'g_class', {'activity_range': [-1, 1]}),
            ('planets', 'rocky_world', {'water_range': [0, 101]}),
            ('planets', 'rocky_world', {'radius_range': [0, 1]}),
            ('planets', 'rocky_world', {'star_archetypes': ['unknown']}),
            ('planets', 'rocky_world', {'atmosphere_profiles': []}),
            ('planets', 'rocky_world', {'mineral_profile': {'raw_ore': [2, 1]}}),
            ('planets', 'rocky_world', {'mineral_profile': {'missing': [1, 2]}}),
            ('travel_modes', 'NORMAL', {'fuel_modifier': 0}),
            ('travel_modes', 'NORMAL', {'travel_time_modifier': float('nan')}),
            ('travel_modes', 'NORMAL', {'signature_modifier': -1}),
            ('propulsion', 'chemical_drive', {'compatible_fuels': ['missing']}),
            ('ships', 'scout_hull', {'compatible_propulsion': ['missing']}),
            ('technologies', 'orbital_engineering', {'requires': ['nuclear_propulsion']}),
            ('technologies', 'orbital_engineering', {'unlocks': ['orbital_engineering']}),
            ('technologies', 'orbital_engineering', {'unlocks': ['missing']}),
            ('districts', 'processor', {'production': {'missing': 1}}),
            ('districts', 'processor', {'processing': {'raw_ore': -1}}),
            ('districts', 'processor', {'cost': {'raw_ore': -1}}),
            ('districts', 'processor', {'requires': ['raw_ore']}),
            ('technologies', 'orbital_engineering', {'effects': ['modify_production']}),
        ]
        for kind, item, changes in cases:
            with self.subTest(kind=kind, changes=changes):
                with self.assertRaises(DataValidationError):
                    self.load_modified(kind, item, changes)

    def test_determinism_is_independent_of_catalog_order(self):
        reversed_catalog = copy.deepcopy(self.catalog)
        for kind, items in reversed_catalog.items.items():
            reversed_catalog.items[kind] = dict(reversed(list(items.items())))
        for seed in ['seed', 'another']:
            for xy in [(0, 0), (4, -2)]:
                self.assertEqual(generate_system(seed, *xy, self.catalog), generate_system(seed, *xy, reversed_catalog))

    def test_new_mode_parameters_execute_without_engine_changes(self):
        changed = self.load_modified('travel_modes', 'NORMAL', {'id': 'CUSTOM', 'travel_time_modifier': 2, 'fuel_modifier': 3, 'thermal_modifier': 4, 'signature_modifier': 5})
        e = Engine.new(changed, now=0)
        e.state.districts['orbital_shipyard'] = 1
        e.build_ship(now=0)
        e.advance(30)
        preview = e.preview_travel(e.state.system_x + 1, e.state.system_y, 'chemical_drive', 'CUSTOM')
        self.assertEqual((preview['eta_seconds'], preview['fuel_cost'], preview['heat'], preview['signature']), (360, 30, 4, 5))

    def test_unlock_targets_without_handlers_are_rejected(self):
        with self.assertRaises(DataValidationError):
            self.load_modified('technologies', 'orbital_engineering', {'unlocks': ['raw_ore']})

    def test_new_yaml_content_executes_existing_unlock_and_production(self):
        # Rename common content in YAML: no engine branch or schema change.
        changed = self.load_modified('districts', 'processor', {'id': 'new_processor'})
        with tempfile.TemporaryDirectory() as directory:
            for kind, items in changed.items.items():
                path = Path(directory) / kind / 'items.yaml'
                path.parent.mkdir()
                entries = [item.model_dump() for item in items.values()]
                if kind == 'technologies':
                    next(t for t in entries if t['id'] == 'orbital_engineering')['unlocks'].append('new_processor')
                path.write_text(yaml.safe_dump(entries))
            changed = Catalog.load(directory)
        e = Engine.new(changed, now=0)
        with self.assertRaises(DataValidationError):
            e.build('new_processor', now=0)
        e.research('orbital_engineering', now=0)
        e.advance(45)
        e.build('new_processor', now=45)
        e.advance(73)
        before = e.state.stocks['components']
        e.advance(133)
        self.assertAlmostEqual(e.state.stocks['components'] - before, .25)
