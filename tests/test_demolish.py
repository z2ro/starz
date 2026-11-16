import unittest
from pathlib import Path

from starz.data import Catalog, DataValidationError
from starz.simulation import Engine


class DemolishTests(unittest.TestCase):
    def setUp(self):
        self.e = Engine.new(Catalog.load(Path(__file__).parents[1] / 'game_data'), now=0)

    def test_removes_one_level_at_once_without_refund(self):
        self.e.state.districts['ore_extractor'] = 2
        stocks = dict(self.e.state.stocks)
        self.assertEqual(self.e.demolish('ore_extractor', now=0), {'id': 'ore_extractor', 'level': 1})
        self.assertEqual(self.e.state.districts['ore_extractor'], 1)
        self.assertEqual(self.e.state.stocks, stocks)
        self.e.demolish('ore_extractor', now=0)
        self.assertEqual(self.e.state.districts['ore_extractor'], 0)

    def test_rejects_unbuilt_last_civil_district_and_running_work(self):
        cases = {'processor': 'não construída', 'civil_district': 'último distrito civil'}
        self.e.state.districts.update(processor=0, civil_district=1)
        for key, message in cases.items():
            with self.subTest(key=key), self.assertRaisesRegex(DataValidationError, message):
                self.e.demolish(key, now=0)
        self.e.state.districts['ore_extractor'] = 1
        self.e.state.construction.append({'id': 'ore_extractor', 'complete_at': 99, 'job_id': 'job', 'started_at': 0})
        with self.assertRaisesRegex(DataValidationError, 'obra em andamento'):
            self.e.demolish('ore_extractor', now=0)
        self.assertEqual(self.e.state.districts['ore_extractor'], 1)

    def test_keeps_capacity_committed_to_work_and_residents(self):
        self.e.state.districts.update(civil_district=2, solar_field=1)
        self.e.state.construction.append({'id': 'solar_field', 'complete_at': 99, 'job_id': 'a', 'started_at': 0})
        self.e.state.construction.append({'id': 'solar_field', 'complete_at': 99, 'job_id': 'b', 'started_at': 0})
        with self.assertRaisesRegex(DataValidationError, 'equipes de construção em uso'):
            self.e.demolish('civil_district', now=0)
        self.e.state.construction.clear()
        self.e.state.population_total = 100 + 2 * self.e.catalog.get('districts', 'civil_district').population_capacity
        with self.assertRaisesRegex(DataValidationError, 'habitação'):
            self.e.demolish('civil_district', now=0)
        self.assertEqual(self.e.state.districts['civil_district'], 2)


if __name__ == '__main__':
    unittest.main()
