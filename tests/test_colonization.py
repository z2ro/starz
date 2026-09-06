import copy
import unittest
from pathlib import Path

from pydantic import ValidationError

from starz.data import Catalog, Colonization, DataValidationError
from starz.simulation import Engine
from starz.universe import colonization_viability, generate_system

ROOT = Path(__file__).parents[1]


class ColonizationDomainTests(unittest.TestCase):
    def setUp(self):
        self.catalog = Catalog.load(ROOT / 'game_data')
        self.engine = Engine.new(self.catalog, now=0)
        self.engine.state.districts['orbital_shipyard'] = 1
        ship = self.engine.build_ship(now=0)
        x, y = self.engine.state.system_x, self.engine.state.system_y
        outward = self.engine.send_fleet(x - 1, y, 'chemical_drive', 'NORMAL', now=ship['ready_at'])
        self.engine.advance(outward['arrival_at'])
        home = self.engine.send_fleet(x, y, 'chemical_drive', 'NORMAL', now=outward['arrival_at'], fleet_id=outward['id'])
        self.engine.advance(home['arrival_at'])
        self.fleet_id = home['id']

    def target(self, viability='VIABLE'):
        hx, hy = self.engine.state.system_x, self.engine.state.system_y
        for x in range(hx - 2, hx + 3):
            for y in range(hy - 2, hy + 3):
                if (x, y) == (hx, hy):
                    continue
                system = generate_system(self.engine.state.seed, x, y, self.catalog)
                for index, planet in enumerate(system.planets):
                    if colonization_viability(planet, self.engine.colonization_rules) == viability:
                        return x, y, index
        self.fail(f'no {viability} planet generated')

    def colonize(self, target):
        x, y, index = target
        return self.engine.send_fleet(x, y, 'chemical_drive', 'ECONOMY', now=self.engine.state.last_updated, fleet_id=self.fleet_id, mission='COLONIZE', target_planet_index=index)

    def test_validation_cost_population_and_target(self):
        target = self.target()
        before = copy.deepcopy(self.engine.state.to_dict())
        with self.assertRaisesRegex(DataValidationError, 'levantamento'):
            self.colonize(target)
        self.assertEqual(before, self.engine.state.to_dict())
        self.engine._survey(target[0], target[1], self.engine.state.last_updated)
        with self.assertRaisesRegex(DataValidationError, 'Planeta inexistente'):
            self.colonize((target[0], target[1], 999))
        hostile = self.target('HOSTILE')
        self.engine._survey(hostile[0], hostile[1], self.engine.state.last_updated)
        with self.assertRaisesRegex(DataValidationError, 'Ambiente'):
            self.colonize(hostile)
        self.engine.state.population_total = self.engine.colonization_rules.population
        with self.assertRaisesRegex(DataValidationError, 'População'):
            self.colonize(target)
        self.engine.state.population_total = 100
        self.engine.state.stocks['components'] = 0
        with self.assertRaisesRegex(DataValidationError, 'Recursos'):
            self.colonize(target)

    def test_arrival_creates_one_colony_without_duplication_and_is_partition_independent(self):
        target = self.target()
        self.engine._survey(target[0], target[1], self.engine.state.last_updated)
        rules = self.engine.colonization_rules
        population_before = self.engine.state.population_total
        stocks_before = dict(self.engine.state.stocks)
        mission = self.colonize(target)
        self.assertEqual(mission['target_planet_index'], target[2])
        self.assertEqual(self.engine.state.population_total, population_before - rules.population)
        for resource, amount in rules.cost.items():
            self.assertEqual(self.engine.state.stocks[resource], stocks_before[resource] - amount)
        split = Engine(self.catalog, copy.deepcopy(self.engine.state))
        self.engine.advance(mission['arrival_at'] + 100)
        split.advance(mission['arrival_at'] - 1)
        split.advance(mission['arrival_at'])
        split.advance(mission['arrival_at'] + 100)
        self.assertEqual(self.engine.state.to_dict(), split.state.to_dict())
        self.assertEqual(len(self.engine.state.new_colonies), 1)
        colony = self.engine.state.new_colonies[0]
        self.assertEqual(colony['population_total'], rules.population)
        self.assertEqual(colony['districts'], rules.initial_districts)
        notice = f"Colônia estabelecida em {generate_system(self.engine.state.seed, target[0], target[1], self.catalog).planets[target[2]].name}."
        self.assertEqual(self.engine.state.notices.count(notice), 1)
        self.engine.advance(mission['arrival_at'] + 200)
        self.assertEqual(self.engine.state.notices.count(notice), 1)

    def test_move_and_survey_remain_compatible(self):
        x, y = self.engine.state.system_x + 1, self.engine.state.system_y
        survey = self.engine.send_fleet(x, y, 'chemical_drive', 'ECONOMY', now=self.engine.state.last_updated, fleet_id=self.fleet_id, mission='SURVEY')
        self.engine.advance(survey['arrival_at'])
        self.assertEqual(self.engine.knowledge_level(x, y), 'SURVEYED')
        move = self.engine.send_fleet(x + 1, y, 'chemical_drive', 'ECONOMY', now=survey['arrival_at'], fleet_id=self.fleet_id)
        self.assertIsNone(move['target_planet_index'])

    def test_colonization_balance_is_typed_and_validated(self):
        raw = self.engine.colonization_rules.model_dump()
        with self.assertRaises(ValidationError):
            Colonization.model_validate({**raw, 'population': 0})
        with self.assertRaises(ValidationError):
            Colonization.model_validate({**raw, 'viable_temperature_range': [500, 100]})


if __name__ == '__main__':
    unittest.main()
