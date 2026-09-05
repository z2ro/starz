import copy
import unittest
import tempfile
from pathlib import Path

from pydantic import ValidationError

from starz.data import Catalog, DataValidationError, District
from starz.simulation import Engine
from tests.json_fixture import load_or_create, save


class CapacityTests(unittest.TestCase):
    def setUp(self):
        self.catalog = Catalog.load(Path(__file__).parents[1] / 'game_data')
        self.e = Engine.new(self.catalog, now=0)

    def test_industry_is_not_slots(self):
        self.assertEqual(self.e.capacities()['industrial_capacity'], 0)
        for key in ['solar_field', 'civil_district', 'research_lab', 'ore_extractor', 'orbital_shipyard']:
            with self.subTest(key=key):
                self.e.state.districts = {key: 2}
                self.assertEqual(self.e.capacities()['industrial_capacity'], 0)
        self.e.state.districts = {'processor': 3}
        self.assertEqual(self.e.capacities()['industrial_capacity'], 6)
        self.assertEqual(self.e.capacities()['construction_slots'], 0)

    def test_construction_slot_released_and_duration_fixed(self):
        e = self.e
        e.state.districts['processor'] = 2
        job = e.build('solar_field', now=0)
        before = dict(e.state.stocks)
        with self.assertRaisesRegex(DataValidationError, 'slots de construção'):
            e.build('solar_field', now=0)
        self.assertEqual(e.state.stocks, before)
        e.state.population_total = 0
        e.advance(job['complete_at'])
        self.assertEqual(e.capacities()['construction_slots_available'], 1)
        e.state.population_total = 100
        e.build('solar_field', now=job['complete_at'])

    def test_shipyard_slots_and_readiness(self):
        e = self.e
        e.state.districts['orbital_shipyard'] = 1
        ship = e.build_ship(now=0)
        before = dict(e.state.stocks)
        with self.assertRaisesRegex(DataValidationError, 'slots de estaleiro'):
            e.build_ship(now=0)
        self.assertEqual(e.state.stocks, before)
        e.advance(ship['ready_at'])
        self.assertEqual(e.capacities()['shipyard_slots_available'], 1)
        e.build_ship(now=ship['ready_at'])
        e.state.districts['orbital_shipyard'] = 2
        self.assertEqual(e.capacities()['shipyard_slots'], 2)
        e.build_ship(now=ship['ready_at'])
        self.assertEqual(e.capacities()['shipyard_slots_available'], 0)

    def test_capacity_validation(self):
        raw = self.catalog.get('districts', 'processor').model_dump()
        for field, value in [('industrial_capacity', -1), ('industrial_capacity', float('inf')), ('shipyard_slots', -1), ('construction_slots', 1.5), ('construction_slots', True), ('shipyard_slots', '1'), ('capacity', 1)]:
            with self.subTest(field=field, value=value), self.assertRaises(ValidationError):
                District.model_validate({**raw, field: value})

    def test_research_full_half_and_zero_coverage(self):
        for generation, work, eta in [(3, 35, 45), (1.5, 40, 90), (0, 45, None)]:
            with self.subTest(generation=generation):
                e = Engine.new(self.catalog, now=0)
                e.state.districts = {'solar_field': 1, 'research_lab': 1}
                self.catalog.get('districts', 'solar_field').energy_generation = generation
                e.research('orbital_engineering', now=0)
                e.advance(10)
                self.assertEqual(e.state.research['remaining_work'], work)
                self.assertEqual(e.state.research['complete_at'], eta)

    def test_coverage_changes_at_construction_boundary_and_polling(self):
        e = self.e
        e.state.districts = {'solar_field': 1, 'research_lab': 1}
        self.catalog.get('districts', 'solar_field').energy_generation = 1.5
        e.state.construction = [{'id': 'solar_field', 'complete_at': 20}]
        e.research('orbital_engineering', now=0)
        split = Engine(self.catalog, copy.deepcopy(e.state))
        e.advance(54)
        self.assertEqual(e.state.research['remaining_work'], 1)
        self.assertEqual(e.state.research['complete_at'], 55)
        e.advance(100)
        for stamp in [10, 20, 30, 54, 55, 100]:
            split.advance(stamp)
        self.assertEqual(e.state.research, split.state.research)
        self.assertEqual(e.state.notices, split.state.notices)
        for key in e.state.stocks:
            self.assertAlmostEqual(e.state.stocks[key], split.state.stocks[key])
        self.assertIn('orbital_engineering', e.state.research['completed'])

    def test_workforce_change_pauses_and_resumes_research(self):
        e = self.e
        e.research('orbital_engineering', now=0)
        e.advance(10)
        e.state.population_total = 0
        e.advance(30)
        self.assertEqual(e.state.research['remaining_work'], 35)
        self.assertIsNone(e.state.research['complete_at'])
        e.state.population_total = int(e.capacities()['workforce_demand'] / 2)
        e.advance(40)
        self.assertEqual(e.state.research['remaining_work'], 30)
        e.state.population_total = 100
        e.advance(70)
        self.assertIn('orbital_engineering', e.state.research['completed'])

    def test_saved_research_remaining_work(self):
        e = self.e
        e.state.last_updated = 10
        e.state.research.update(active='orbital_engineering', complete_at=45, remaining_work=35)
        e.advance(20)
        self.assertEqual(e.state.research['remaining_work'], 25)

    def test_paused_research_persists_and_resumes(self):
        e = self.e
        e.research('orbital_engineering', now=0)
        e.advance(10)
        e.state.population_total = 0
        e.advance(20)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'state.json'
            save(e, path)
            restored = load_or_create(self.catalog, path)
            self.assertEqual(restored.state.to_dict(), e.state.to_dict())
            restored.advance(100)
            self.assertEqual(restored.state.research['remaining_work'], 35)
            restored.state.population_total = 100
            restored.advance(135)
            self.assertIn('orbital_engineering', restored.state.research['completed'])
