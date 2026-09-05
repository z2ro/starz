from __future__ import annotations

from dataclasses import asdict, dataclass, field
import json
import math
from pathlib import Path
import time
from typing import Any
from uuid import uuid4

from .data import Catalog, DataValidationError, District, Hull, Propulsion, Technology
from .universe import StarSystem, find_spawn_system, generate_system


MODES = {"ECONOMY": (1.55, 0.65, 0.8), "NORMAL": (1.0, 1.0, 1.0), "FORCED": (0.62, 2.2, 1.8)}


@dataclass
class GameState:
    seed: str
    system_x: int
    system_y: int
    stocks: dict[str, float]
    population_total: int = 100
    districts: dict[str, int] = field(default_factory=dict)
    construction: list[dict[str, Any]] = field(default_factory=list)
    research: dict[str, Any] = field(default_factory=lambda: {"active": None, "complete_at": None, "completed": []})
    ships: list[dict[str, Any]] = field(default_factory=list)
    fleets: list[dict[str, Any]] = field(default_factory=list)
    last_updated: float = 0
    notices: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, value: dict[str, Any]) -> "GameState":
        return cls(**value)


class Engine:
    def __init__(self, catalog: Catalog, state: GameState):
        self.catalog = catalog
        self.state = state

    @classmethod
    def new(cls, catalog: Catalog, seed: str = "STARZ-ALPHA", now: float | None = None) -> "Engine":
        system, report = find_spawn_system(seed)
        state = GameState(seed, system.x, system.y, {"raw_ore": 220, "volatiles": 100, "refined_alloy": 140, "components": 55, "ion_fuel": 80, "fusion_fuel": 0}, districts={"civil_district": 1, "solar_field": 3, "ore_extractor": 1, "research_lab": 1}, last_updated=now or time.time(), notices=[f"Spawn avaliado: {report.score:.2f} / acesso inicial equilibrado."])
        return cls(catalog, state)

    def system(self) -> StarSystem:
        return generate_system(self.state.seed, self.state.system_x, self.state.system_y)

    def advance(self, now: float | None = None) -> None:
        now = now or time.time()
        elapsed = max(0, now - self.state.last_updated)
        if elapsed:
            self._produce(elapsed)
        self.state.last_updated = now
        finished = [item for item in self.state.construction if item["complete_at"] <= now]
        for item in finished:
            self.state.districts[item["id"]] = self.state.districts.get(item["id"], 0) + 1
            self.state.notices.insert(0, f"Construção concluída: {item['id']}.")
        self.state.construction = [item for item in self.state.construction if item["complete_at"] > now]
        research = self.state.research
        if research["active"] and research["complete_at"] <= now:
            research["completed"].append(research["active"])
            self.state.notices.insert(0, f"Pesquisa concluída: {research['active']}.")
            research["active"] = None
            research["complete_at"] = None
        for fleet in self.state.fleets:
            if fleet["status"] == "TRANSIT" and fleet["arrival_at"] <= now:
                fleet["x"], fleet["y"] = fleet["destination_x"], fleet["destination_y"]
                fleet["status"] = "ARRIVED"
                self.state.notices.insert(0, f"{fleet['name']} chegou ao sistema de destino.")

    def capacities(self) -> dict[str, float]:
        generation = consumption = industrial = population_demand = research_rate = 0.0
        for district_id, level in self.state.districts.items():
            district = self.catalog.get("districts", district_id)
            generation += district.energy_generation * level
            consumption += district.energy_consumption * level
            industrial += district.capacity * level
            population_demand += district.workforce * level
            research_rate += district.research_rate * level
        crew = sum(ship["crew"] for ship in self.state.ships)
        return {"energy_generation": generation, "energy_consumption": consumption, "industrial": industrial, "population_demand": population_demand, "available_population": max(0, self.state.population_total - population_demand - crew), "research_rate": research_rate}

    def _produce(self, elapsed: float) -> None:
        minutes = elapsed / 60
        capacities = self.capacities()
        energy_ratio = min(1.0, max(0.0, (capacities["energy_generation"] - capacities["energy_consumption"]) / max(1.0, capacities["energy_generation"])))
        workforce_ratio = min(1.0, capacities["available_population"] / max(1.0, capacities["population_demand"]))
        factor = min(energy_ratio, workforce_ratio)
        for district_id, level in self.state.districts.items():
            district = self.catalog.get("districts", district_id)
            for resource_id, amount in district.production.items():
                if district.processing:
                    factor = min(factor, *(self.state.stocks.get(source, 0) / max(0.001, rate * minutes) for source, rate in district.processing.items()))
                produced = amount * level * minutes * max(0, factor)
                self.state.stocks[resource_id] = self.state.stocks.get(resource_id, 0) + produced
                for source, rate in district.processing.items():
                    self.state.stocks[source] = max(0, self.state.stocks.get(source, 0) - rate * level * minutes * max(0, factor))

    def build(self, district_id: str, now: float | None = None) -> dict[str, Any]:
        self.advance(now)
        district: District = self.catalog.get("districts", district_id)  # type: ignore[assignment]
        if district.unlock and district.unlock not in self.state.research["completed"]:
            raise DataValidationError(f"requer pesquisa: {district.unlock}")
        capacities = self.capacities()
        if capacities["available_population"] < district.workforce:
            raise DataValidationError("população disponível insuficiente")
        if capacities["energy_generation"] - capacities["energy_consumption"] < district.energy_consumption:
            raise DataValidationError("capacidade energética insuficiente")
        if capacities["industrial"] < len(self.state.construction) + 1:
            raise DataValidationError("capacidade industrial ocupada")
        self._pay(district.cost)
        complete_at = (now or time.time()) + district.duration
        self.state.construction.append({"id": district_id, "complete_at": complete_at})
        return {"id": district_id, "complete_at": complete_at}

    def research(self, technology_id: str, now: float | None = None) -> dict[str, Any]:
        self.advance(now)
        technology: Technology = self.catalog.get("technologies", technology_id)  # type: ignore[assignment]
        if self.state.research["active"]:
            raise DataValidationError("já existe pesquisa em andamento")
        if technology_id in self.state.research["completed"]:
            raise DataValidationError("pesquisa já concluída")
        if any(req not in self.state.research["completed"] for req in technology.requires):
            raise DataValidationError("requirements de pesquisa não atendidos")
        if self.capacities()["research_rate"] <= 0:
            raise DataValidationError("nenhuma capacidade de pesquisa")
        self._pay(technology.cost)
        complete_at = (now or time.time()) + technology.duration / self.capacities()["research_rate"]
        self.state.research.update(active=technology_id, complete_at=complete_at)
        return {"id": technology_id, "complete_at": complete_at}

    def build_ship(self, hull_id: str = "scout_hull", propulsion_id: str = "chemical_drive", fuel_id: str = "ion_fuel", now: float | None = None) -> dict[str, Any]:
        self.advance(now)
        hull: Hull = self.catalog.get("ships", hull_id)  # type: ignore[assignment]
        propulsion: Propulsion = self.catalog.get("propulsion", propulsion_id)  # type: ignore[assignment]
        if self.state.districts.get("orbital_shipyard", 0) < 1:
            raise DataValidationError("estaleiro orbital necessário")
        if propulsion_id not in hull.compatible_propulsion:
            raise DataValidationError("propulsão incompatível com o casco")
        if fuel_id not in propulsion.compatible_fuels:
            raise DataValidationError("combustível incompatível com a propulsão")
        if propulsion.requires and any(req not in self.state.research["completed"] for req in propulsion.requires):
            raise DataValidationError("tecnologia de propulsão não pesquisada")
        if self.state.stocks.get(fuel_id, 0) < 1:
            raise DataValidationError("combustível insuficiente")
        self._pay(hull.cost)
        ship = {"id": str(uuid4()), "hull_id": hull_id, "propulsion_id": propulsion_id, "fuel_id": fuel_id, "crew": hull.crew, "mass": hull.mass, "ready_at": (now or time.time()) + hull.duration}
        self.state.ships.append(ship)
        return ship

    def preview_travel(self, target_x: int, target_y: int, propulsion_id: str, mode: str, ship: dict[str, Any] | None = None) -> dict[str, Any]:
        if mode not in MODES:
            raise DataValidationError(f"regime inválido: {mode}")
        propulsion: Propulsion = self.catalog.get("propulsion", propulsion_id)  # type: ignore[assignment]
        ship = ship or (self.state.ships[0] if self.state.ships else None)
        if ship is None:
            raise DataValidationError("nenhuma nave disponível")
        distance = max(1.0, math.hypot(target_x - self.state.system_x, target_y - self.state.system_y))
        time_factor, fuel_factor, heat_factor = MODES[mode]
        fuel: Any = self.catalog.get("fuels", ship["fuel_id"])
        fuel_cost = max(1.0, math.ceil(ship["mass"] * distance * fuel_factor / propulsion.fuel_efficiency / fuel.energy_density))
        seconds = distance * 180 * time_factor / propulsion.speed_factor
        return {"distance": round(distance, 2), "eta_seconds": round(seconds), "fuel_cost": fuel_cost, "heat": round(propulsion.thermal_load * heat_factor, 2), "signature": round(propulsion.signature * heat_factor, 2), "mode": mode}

    def send_fleet(self, target_x: int, target_y: int, propulsion_id: str, mode: str, now: float | None = None) -> dict[str, Any]:
        self.advance(now)
        ship = next((candidate for candidate in self.state.ships if not any(candidate["id"] in fleet["ship_ids"] for fleet in self.state.fleets)), None)
        if ship is None:
            raise DataValidationError("nenhuma nave livre")
        if ship["ready_at"] > (now or time.time()):
            raise DataValidationError("nave ainda em montagem")
        if ship["propulsion_id"] != propulsion_id:
            raise DataValidationError("propulsão solicitada não está instalada")
        preview = self.preview_travel(target_x, target_y, propulsion_id, mode, ship)
        if self.state.stocks.get(ship["fuel_id"], 0) < preview["fuel_cost"]:
            raise DataValidationError("combustível insuficiente para a viagem")
        self.state.stocks[ship["fuel_id"]] -= preview["fuel_cost"]
        departure = now or time.time()
        fleet = {"id": str(uuid4()), "name": f"Fleet {len(self.state.fleets) + 1:02d}", "ship_ids": [ship["id"]], "x": self.state.system_x, "y": self.state.system_y, "destination_x": target_x, "destination_y": target_y, "status": "TRANSIT", "departure_at": departure, "arrival_at": departure + preview["eta_seconds"], "propulsion": propulsion_id, "mode": mode, "fuel_cost": preview["fuel_cost"]}
        self.state.fleets.append(fleet)
        return {**fleet, "preview": preview}

    def _pay(self, costs: dict[str, float]) -> None:
        missing = [f"{key} ({amount:g})" for key, amount in costs.items() if self.state.stocks.get(key, 0) < amount]
        if missing:
            raise DataValidationError("recursos insuficientes: " + ", ".join(missing))
        for key, amount in costs.items():
            self.state.stocks[key] -= amount


def load_or_create(catalog: Catalog, path: str | Path, seed: str = "STARZ-ALPHA") -> Engine:
    path = Path(path)
    if path.exists():
        return Engine(catalog, GameState.from_dict(json.loads(path.read_text())))
    return Engine.new(catalog, seed)


def save(engine: Engine, path: str | Path) -> None:
    path = Path(path)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(engine.state.to_dict(), indent=2))
    temporary.replace(path)
