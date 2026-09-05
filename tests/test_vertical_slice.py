import tempfile
import unittest
from pathlib import Path

import yaml

from starz.data import Catalog, DataValidationError
from starz.simulation import Engine
from tests.json_fixture import load_or_create, save
from starz.universe import evaluate_viability, generate_system


ROOT = Path(__file__).parents[1]


class CatalogContractTests(unittest.TestCase):
    def write_catalog(self, files: dict[str, list[dict]]) -> Path:
        root = Path(tempfile.mkdtemp())
        for relative, entries in files.items():
            path = root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(yaml.safe_dump(entries))
        return root

    def test_new_common_content_loads_without_engine_branch(self):
        root = self.write_catalog({
            "resources/base.yaml": [{"id": "ore", "name": "Ore", "description": "x", "category": "natural", "stock": True}],
            "districts/new.yaml": [{"id": "new_district", "name": "New", "description": "x", "category": "Mining", "cost": {"ore": 1}, "duration": 1, "workforce": 1, "production": {"ore": 1}}],
        })
        catalog = Catalog.load(root)
        self.assertIn("new_district", catalog.items["districts"])

    def test_duplicate_id_fails(self):
        root = self.write_catalog({
            "resources/a.yaml": [{"id": "same", "name": "A", "description": "x", "category": "natural", "stock": True}],
            "resources/b.yaml": [{"id": "same", "name": "B", "description": "x", "category": "natural", "stock": True}],
        })
        with self.assertRaises(DataValidationError):
            Catalog.load(root)

    def test_unknown_reference_fails(self):
        root = self.write_catalog({
            "resources/base.yaml": [{"id": "ore", "name": "Ore", "description": "x", "category": "natural", "stock": True}],
            "districts/bad.yaml": [{"id": "bad", "name": "Bad", "description": "x", "category": "Mining", "cost": {"missing": 1}, "duration": 1, "workforce": 1}],
        })
        with self.assertRaises(DataValidationError):
            Catalog.load(root)

    def test_unknown_effect_fails(self):
        root = self.write_catalog({
            "resources/base.yaml": [{"id": "ore", "name": "Ore", "description": "x", "category": "natural", "stock": True}],
            "districts/bad.yaml": [{"id": "bad", "name": "Bad", "description": "x", "category": "Mining", "duration": 1, "workforce": 1, "effects": ["teleport_everything"]}],
        })
        with self.assertRaises(DataValidationError):
            Catalog.load(root)

    def test_incompatible_fuel_fails_in_engine(self):
        catalog = Catalog.load(ROOT / "game_data")
        engine = Engine.new(catalog, now=1000)
        engine.state.districts["orbital_shipyard"] = 1
        with self.assertRaises(DataValidationError):
            engine.build_ship(fuel_id="fusion_fuel", now=1000)


class SimulationTests(unittest.TestCase):
    def test_universe_and_spawn_are_deterministic(self):
        catalog = Catalog.load(ROOT / 'game_data')
        self.assertEqual(generate_system("seed", 4, -2, catalog), generate_system("seed", 4, -2, catalog))
        self.assertNotEqual(generate_system("seed", 4, -2, catalog), generate_system("seed", 4, -1, catalog))
        self.assertTrue(evaluate_viability(generate_system("seed", 4, -2, catalog)).score >= 0)

    def test_economy_construction_research_ship_and_travel(self):
        catalog = Catalog.load(ROOT / "game_data")
        engine = Engine.new(catalog, now=1000)
        before = engine.state.stocks["raw_ore"]
        engine.advance(1600)
        self.assertGreater(engine.state.stocks["raw_ore"], before)
        build = engine.build("processor", now=1600)
        self.assertGreater(build["complete_at"], 1600)
        engine.advance(2000)
        self.assertEqual(engine.state.districts["processor"], 1)
        engine.research("orbital_engineering", now=2000)
        engine.advance(2050)
        self.assertIn("orbital_engineering", engine.state.research["completed"])
        engine.build("orbital_shipyard", now=2050)
        engine.advance(2120)
        engine.build_ship(now=2120)
        with self.assertRaises(DataValidationError):
            engine.send_fleet(1, 0, "chemical_drive", "NORMAL", now=2120)
        engine.advance(2151)
        previews = [engine.preview_travel(1, 0, "chemical_drive", mode)["fuel_cost"] for mode in ("ECONOMY", "NORMAL", "FORCED")]
        self.assertLess(previews[0], previews[1])
        self.assertLess(previews[1], previews[2])
        fleet = engine.send_fleet(1, 0, "chemical_drive", "FORCED", now=2151)
        self.assertEqual(fleet["status"], "TRANSIT")
        engine.advance(2151 + fleet["preview"]["eta_seconds"] + 1)
        self.assertEqual(engine.state.fleets[0]["status"], "ARRIVED")

    def test_state_round_trips_through_persistence(self):
        catalog = Catalog.load(ROOT / "game_data")
        engine = Engine.new(catalog, now=1000)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            save(engine, path)
            restored = load_or_create(catalog, path)
            self.assertEqual(restored.state.to_dict(), engine.state.to_dict())


if __name__ == "__main__":
    unittest.main()
