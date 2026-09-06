import copy
import unittest
from pathlib import Path

from starz.data import Catalog, DataValidationError
from starz.simulation import Engine
from starz.universe import colonization_viability, generate_system


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

    def test_existing_fleet_uses_explicit_same_system_planet_for_fuel(self):
        state = self.state('a')
        state.planets[1]['x'] = state.planets[1]['y'] = 0
        state.districts = {'orbital_shipyard': 1}
        engine = Engine(self.catalog, state)
        ship = engine.build_ship(now=0)
        ship['ready_at'] = 0
        state.fleets = [{'id': 'fleet', 'ship_ids': [ship['id']], 'status': 'ARRIVED', 'x': 0, 'y': 0}]
        state.planet_id = 'b'
        state.stocks = state.stocks_by_planet['b']
        with self.assertRaisesRegex(DataValidationError, 'combustível local'):
            engine.send_fleet(1, 0, 'chemical_drive', 'NORMAL', now=0, fleet_id='fleet', planet_id='b')

        state.planet_id = 'a'
        state.stocks = state.stocks_by_planet['a']
        mission = engine.send_fleet(1, 0, 'chemical_drive', 'NORMAL', now=0, fleet_id='fleet', planet_id='a')
        self.assertEqual(mission['status'], 'TRANSIT')

    def test_colonization_uses_current_colony_as_source(self):
        state = self.state('a')
        state.planets[1]['x'], state.planets[1]['y'] = 1, 0
        state.stocks_by_planet['b'].update({'refined_alloy': 100, 'components': 100, 'volatiles': 100, 'ion_fuel': 100})
        state.districts = {'orbital_shipyard': 1}
        engine = Engine(self.catalog, state)
        ship = engine.build_ship(now=0)
        ship['ready_at'] = 0
        outbound = engine.send_fleet(1, 0, 'chemical_drive', 'NORMAL', now=0, ship_id=ship['id'], planet_id='a')
        engine.advance(outbound['arrival_at'])
        state.planet_id = 'b'
        state.system_x, state.system_y = 1, 0
        state.stocks = state.stocks_by_planet['b']
        state.population_total = 40
        target = next(
            (x, y, index)
            for x in range(2, 5)
            for y in range(-2, 3)
            for index, planet in enumerate(generate_system(state.seed, x, y, self.catalog).planets)
            if colonization_viability(planet, engine.colonization_rules) == 'VIABLE'
        )
        engine._survey(target[0], target[1], state.last_updated)
        home_before = dict(state.stocks_by_planet['a'])
        mission = engine.send_fleet(target[0], target[1], 'chemical_drive', 'ECONOMY', now=state.last_updated, fleet_id=outbound['id'], mission='COLONIZE', target_planet_index=target[2], planet_id='b')
        self.assertEqual(mission['colonization_origin_planet_id'], 'b')
        self.assertEqual(state.population_total, 20)
        self.assertEqual(state.stocks_by_planet['a'], home_before)

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
