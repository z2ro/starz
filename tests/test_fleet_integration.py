"""Provisional catalog through the existing build and travel engine (no new rules)."""
import unittest
import json
from pathlib import Path
from starz.data import Catalog, DataValidationError
from starz.simulation import Engine


class FleetIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.catalog = Catalog.load(Path(__file__).parents[1] / 'game_data')

    def engine(self):
        engine = Engine.new(self.catalog, now=1000)
        engine.state.districts = {'orbital_shipyard': 1}
        engine.state.research['completed'] = ['orbital_engineering', 'nuclear_propulsion']
        engine.state.population_total = 1000
        engine.state.stocks.update(refined_alloy=10000, components=10000, ion_fuel=10000, fusion_fuel=10000)
        return engine

    def test_all_ten_build_with_real_cost_duration_and_travel(self):
        self.assertEqual(len(self.catalog.items['ships']), 10)
        fixture = json.loads((Path(__file__).parent / 'fixtures/fleet-api-catalog.json').read_text())
        self.assertEqual(fixture['ships'], [h.model_dump() for h in self.catalog.items['ships'].values()])
        self.assertNotIn('stargrave_hull', self.catalog.items['ships'])
        for hull in self.catalog.items['ships'].values():
            with self.subTest(hull=hull.id):
                e = self.engine()
                propulsion = hull.compatible_propulsion[0]
                fuel = self.catalog.get('propulsion', propulsion).compatible_fuels[0]
                before = dict(e.state.stocks)
                ship = e.build_ship(hull.id, propulsion, fuel, now=1000)
                self.assertEqual(ship['mass'], hull.mass)
                self.assertEqual(ship['crew'], hull.crew)
                self.assertEqual(ship['ready_at'], 1000 + hull.duration)
                for key, amount in hull.cost.items():
                    self.assertEqual(e.state.stocks[key], before[key] - amount)
                self.assertEqual(e.capacities()['shipyard_slots_available'], 0)
                e.advance(ship['ready_at'])
                fleet = e.send_fleet(e.state.system_x + 1, e.state.system_y, propulsion, 'NORMAL', now=ship['ready_at'], ship_id=ship['id'])
                self.assertEqual(fleet['status'], 'TRANSIT')
                self.assertEqual(fleet['ship_ids'], [ship['id']])
                e.advance(fleet['arrival_at'])
                self.assertEqual(e.state.fleets[0]['status'], 'ARRIVED')

    def test_research_compatibility_resources_crew_and_slots_remain_authoritative(self):
        cases = [
            (lambda e: e.state.research.update(completed=[]), 'requer'),
            (lambda e: e.state.stocks.update(components=0), 'insuficiente'),
            (lambda e: setattr(e.state, 'population_total', 0), 'tripulação'),
            (lambda e: e.state.districts.update(orbital_shipyard=0), 'requer'),
        ]
        for alter, message in cases:
            with self.subTest(message=message):
                e = self.engine(); alter(e)
                with self.assertRaises(DataValidationError):
                    e.build_ship('dominion_hull', 'nuclear_drive', 'fusion_fuel', now=1000)
                self.assertFalse(e.state.ships)
        for propulsion, fuel in [('chemical_drive', 'ion_fuel'), ('nuclear_drive', 'ion_fuel')]:
            e = self.engine()
            with self.assertRaises(DataValidationError):
                e.build_ship('dominion_hull', propulsion, fuel, now=1000)
            self.assertFalse(e.state.ships)

        e = self.engine()
        e.build_ship('dominion_hull', 'nuclear_drive', 'fusion_fuel', now=1000)
        before = dict(e.state.stocks)
        with self.assertRaisesRegex(DataValidationError, 'slots'):
            e.build_ship('dominion_hull', 'nuclear_drive', 'fusion_fuel', now=1000)
        self.assertEqual(e.state.stocks, before)
