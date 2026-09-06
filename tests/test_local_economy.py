import copy
import unittest
from pathlib import Path

from starz.data import Catalog, DataValidationError
from starz.simulation import Engine


class LocalPlanetEconomyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = Catalog.load(Path(__file__).parents[1] / 'game_data')

    def state(self, active='a'):
        state = Engine.new(self.catalog, now=0).state
        state.planet_id = active
        state.home_planet_id = 'a'
        state.system_x, state.system_y = 0, 0
        state.planets = [
            {'id': 'a', 'x': 0, 'y': 0, 'planet_index': 0, 'population_total': 100, 'home': True},
            {'id': 'b', 'x': 2, 'y': 0, 'planet_index': 1, 'population_total': 20, 'home': False},
        ]
        state.stocks_by_planet = {
            'a': {'raw_ore': 100, 'refined_alloy': 100, 'components': 100, 'ion_fuel': 100},
            'b': {'raw_ore': 0, 'refined_alloy': 0, 'components': 0, 'ion_fuel': 0},
        }
        state.stocks = state.stocks_by_planet[active]
        state.planet_last_updated = 0
        return state

    def test_extraction_and_processing_never_cross_planet(self):
        state = self.state('b')
        state.districts = {'processor': 1}
        engine = Engine(self.catalog, state)
        engine.advance_planet(60)
        self.assertEqual(state.stocks['refined_alloy'], 0)
        self.assertEqual(state.stocks_by_planet['a']['raw_ore'], 100)

        state.planet_id = 'a'
        state.system_x = 0
        state.stocks = state.stocks_by_planet['a']
        state.districts = {'solar_field': 3, 'ore_extractor': 1}
        state.planet_last_updated = 60
        Engine(self.catalog, state).advance_planet(120)
        self.assertGreater(state.stocks_by_planet['a']['raw_ore'], 100)
        self.assertEqual(state.stocks_by_planet['b']['raw_ore'], 0)

    def test_build_and_shipyard_use_active_planet_stock_and_origin(self):
        state = self.state('b')
        state.districts = {'civil_district': 1, 'solar_field': 3, 'orbital_shipyard': 1}
        state.stocks['ion_fuel'] = 2
        engine = Engine(self.catalog, state)
        with self.assertRaisesRegex(DataValidationError, 'locais'):
            engine.build('processor', now=0)

        state.stocks.update({'refined_alloy': 100, 'components': 100, 'ion_fuel': 100})
        ship = engine.build_ship(now=0)
        self.assertEqual(ship['origin_planet_id'], 'b')
        self.assertEqual((ship['system_x'], ship['system_y']), (0, 0))
        self.assertEqual(state.stocks_by_planet['a']['refined_alloy'], 100)

    def test_remote_fleet_without_local_planet_has_no_magic_fuel(self):
        state = self.state('a')
        state.districts = {'orbital_shipyard': 1}
        engine = Engine(self.catalog, state)
        ship = engine.build_ship(now=0)
        ship['ready_at'] = 0
        fleet = {'id': 'fleet', 'ship_ids': [ship['id']], 'status': 'ARRIVED', 'x': 2, 'y': 0}
        state.fleets = [fleet]
        with self.assertRaisesRegex(DataValidationError, 'combustível local'):
            engine.send_fleet(3, 0, 'chemical_drive', 'NORMAL', now=0, fleet_id='fleet')

    def test_partitioned_local_advance_is_deterministic(self):
        first = self.state('a')
        second = copy.deepcopy(first)
        first.districts = second.districts = {'ore_extractor': 1}
        Engine(self.catalog, first).advance_planet(120)
        e = Engine(self.catalog, second)
        e.advance_planet(60)
        e.advance_planet(120)
        self.assertEqual(first.stocks_by_planet, second.stocks_by_planet)


if __name__ == '__main__':
    unittest.main()
