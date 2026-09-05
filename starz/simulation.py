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
from .effects import require_available
from .travel import preview_travel as calculate_travel
from .economy import produce


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
        system, report = find_spawn_system(seed, catalog)
        state = GameState(seed, system.x, system.y, {"raw_ore": 220, "volatiles": 100, "refined_alloy": 140, "components": 55, "ion_fuel": 80, "fusion_fuel": 0}, districts={"civil_district": 1, "solar_field": 3, "ore_extractor": 1, "research_lab": 1}, last_updated=time.time() if now is None else now, notices=[f"Spawn avaliado: {report.score:.2f} / acesso inicial equilibrado."])
        return cls(catalog, state)

    def system(self) -> StarSystem:
        return generate_system(self.state.seed, self.state.system_x, self.state.system_y, self.catalog)

    def advance(self, now: float | None = None) -> None:
        now = time.time() if now is None else now
        if not math.isfinite(now) or now < self.state.last_updated:
            raise DataValidationError('timestamp inválido ou anterior ao estado')
        cursor = self.state.last_updated
        research = self.state.research
        if research['active'] and 'remaining_work' not in research:
            # Legacy fixed ETA: preserve outstanding work at the last saved instant.
            research['remaining_work'] = max(0, research['complete_at'] - cursor) * self.capacities()['research_rate']
        self._complete_events(cursor)
        self._research_eta()
        while cursor < now:
            boundaries = [item['complete_at'] for item in self.state.construction]
            if self.state.research['active'] and self.state.research['complete_at'] is not None:
                boundaries.append(self.state.research['complete_at'])
            boundaries.extend(f['arrival_at'] for f in self.state.fleets if f['status'] == 'TRANSIT')
            boundary = min([now, *(stamp for stamp in boundaries if cursor < stamp <= now)])
            self._produce(boundary - cursor)
            if research['active']:
                research['remaining_work'] = max(0, research['remaining_work'] - self.capacities()['effective_research_rate'] * (boundary - cursor))
                if research['complete_at'] is not None and boundary >= research['complete_at']:
                    research['remaining_work'] = 0
            cursor = boundary
            self.state.last_updated = cursor
            self._complete_events(cursor)
            self._research_eta()

    def _research_eta(self) -> None:
        research = self.state.research
        rate = self.capacities()['effective_research_rate']
        research['complete_at'] = self.state.last_updated + research['remaining_work'] / rate if research['active'] and rate > 0 else None

    def _complete_events(self, now: float) -> None:
        finished = sorted((item for item in self.state.construction if item["complete_at"] <= now), key=lambda item: (item['complete_at'], item['id']))
        for item in finished:
            self.state.districts[item["id"]] = self.state.districts.get(item["id"], 0) + 1
            self.state.notices.insert(0, f"Construção concluída: {item['id']}.")
        self.state.construction = [item for item in self.state.construction if item["complete_at"] > now]
        research = self.state.research
        if research["active"] and research['remaining_work'] <= 0:
            research["completed"].append(research["active"])
            self.state.notices.insert(0, f"Pesquisa concluída: {research['active']}.")
            research["active"] = None
            research["complete_at"] = None
            research['remaining_work'] = 0
        for fleet in sorted(self.state.fleets, key=lambda item: item['id']):
            if fleet["status"] == "TRANSIT" and fleet["arrival_at"] <= now:
                fleet["x"], fleet["y"] = fleet["destination_x"], fleet["destination_y"]
                fleet["status"] = "ARRIVED"
                self.state.notices.insert(0, f"{fleet['name']} chegou ao sistema de destino.")

    def capacities(self) -> dict[str, float]:
        generation = consumption = industrial = population_demand = research_rate = 0.0
        construction_slots = shipyard_slots = 0
        for district_id, level in self.state.districts.items():
            district = self.catalog.get("districts", district_id)
            generation += district.energy_generation * level
            consumption += district.energy_consumption * level
            industrial += district.industrial_capacity * level
            construction_slots += district.construction_slots * level
            shipyard_slots += district.shipyard_slots * level
            population_demand += district.workforce * level
            research_rate += district.research_rate * level
        crew = sum(ship["crew"] for ship in self.state.ships)
        supply = max(0, self.state.population_total - crew)
        energy_coverage = 1.0 if consumption <= 0 else min(1.0, generation / consumption)
        workforce_coverage = 1.0 if population_demand <= 0 else min(1.0, supply / population_demand)
        shipyard_occupied = sum(ship.get('ready_at', 0) > self.state.last_updated for ship in self.state.ships)
        return {
            'energy_generation': generation, 'energy_consumption': consumption,
            'energy_coverage': energy_coverage,
            'industrial_capacity': industrial, 'population_total': self.state.population_total,
            'construction_slots': construction_slots,
            'construction_slots_available': max(0, construction_slots - len(self.state.construction)),
            'shipyard_slots': shipyard_slots,
            'shipyard_slots_available': max(0, shipyard_slots - shipyard_occupied),
            'crew_committed': crew, 'workforce_supply': supply,
            'workforce_demand': population_demand,
            'workforce_coverage': workforce_coverage,
            'available_population': max(0, supply - population_demand), 'research_rate': research_rate,
            'effective_research_rate': research_rate * min(energy_coverage, workforce_coverage),
        }

    def _produce(self, elapsed: float) -> None:
        capacities = self.capacities()
        if elapsed <= 0:
            return
        factor = min(capacities['energy_coverage'], capacities['workforce_coverage'])
        produce(self.catalog, self.state.stocks, self.state.districts, elapsed, factor)

    def build(self, district_id: str, now: float | None = None) -> dict[str, Any]:
        self.advance(now)
        district: District = self.catalog.get("districts", district_id)  # type: ignore[assignment]
        require_available(self.catalog, self.state, district)
        capacities = self.capacities()
        if capacities["available_population"] < district.workforce:
            raise DataValidationError("população disponível insuficiente")
        if capacities["energy_generation"] - capacities["energy_consumption"] < district.energy_consumption:
            raise DataValidationError("capacidade energética insuficiente")
        if capacities['construction_slots_available'] < 1:
            raise DataValidationError('slots de construção ocupados ou indisponíveis')
        self._pay(district.cost)
        complete_at = self.state.last_updated + district.duration
        self.state.construction.append({"id": district_id, "complete_at": complete_at})
        return {"id": district_id, "complete_at": complete_at}

    def research(self, technology_id: str, now: float | None = None) -> dict[str, Any]:
        self.advance(now)
        technology: Technology = self.catalog.get("technologies", technology_id)  # type: ignore[assignment]
        if self.state.research["active"]:
            raise DataValidationError("já existe pesquisa em andamento")
        if technology_id in self.state.research["completed"]:
            raise DataValidationError("pesquisa já concluída")
        require_available(self.catalog, self.state, technology)
        if self.capacities()["research_rate"] <= 0:
            raise DataValidationError("nenhuma capacidade de pesquisa")
        self._pay(technology.cost)
        self.state.research.update(active=technology_id, remaining_work=technology.duration)
        self._research_eta()
        return {'id': technology_id, 'complete_at': self.state.research['complete_at'], 'remaining_work': technology.duration}

    def build_ship(self, hull_id: str = "scout_hull", propulsion_id: str = "chemical_drive", fuel_id: str = "ion_fuel", now: float | None = None) -> dict[str, Any]:
        self.advance(now)
        hull: Hull = self.catalog.get("ships", hull_id)  # type: ignore[assignment]
        propulsion: Propulsion = self.catalog.get("propulsion", propulsion_id)  # type: ignore[assignment]
        for item in (hull, propulsion, self.catalog.get('fuels', fuel_id)):
            require_available(self.catalog, self.state, item)
        if propulsion_id not in hull.compatible_propulsion:
            raise DataValidationError("propulsão incompatível com o casco")
        if fuel_id not in propulsion.compatible_fuels:
            raise DataValidationError("combustível incompatível com a propulsão")
        if self.capacities()['available_population'] < hull.crew:
            raise DataValidationError('tripulação disponível insuficiente')
        if self.capacities()['shipyard_slots_available'] < 1:
            raise DataValidationError('slots de estaleiro ocupados ou indisponíveis')
        if self.state.stocks.get(fuel_id, 0) < 1:
            raise DataValidationError("combustível insuficiente")
        self._pay(hull.cost)
        ship = {"id": str(uuid4()), "hull_id": hull_id, "propulsion_id": propulsion_id, "fuel_id": fuel_id, "crew": hull.crew, "mass": hull.mass, "ready_at": self.state.last_updated + hull.duration}
        self.state.ships.append(ship)
        self._research_eta()
        return ship

    def _travel_subject(self, fleet_id: str | None, ship_id: str | None):
        if fleet_id and ship_id:
            raise DataValidationError('selecione fleet_id ou ship_id')
        fleets = sorted(self.state.fleets, key=lambda f: f['id'])
        fleet = next((f for f in fleets if f['id'] == fleet_id), None) if fleet_id else None
        if fleet_id and fleet is None:
            raise DataValidationError('frota inexistente')
        if not fleet_id and not ship_id:
            fleet = next((f for f in fleets if f['status'] == 'ARRIVED'), None)
        attached = {sid for f in fleets for sid in f['ship_ids']}
        if fleet:
            if fleet['status'] != 'ARRIVED':
                raise DataValidationError('frota em trânsito')
            if len(fleet['ship_ids']) != 1:
                raise DataValidationError('slice suporta uma nave por frota')
            ship = next((s for s in self.state.ships if s['id'] == fleet['ship_ids'][0]), None)
            origin = (fleet['x'], fleet['y'])
        else:
            ship = next((s for s in self.state.ships if s['id'] not in attached and (s['id'] == ship_id if ship_id else s['ready_at'] <= self.state.last_updated)), None)
            origin = (self.state.system_x, self.state.system_y)
        if ship is None:
            raise DataValidationError('nenhuma nave livre disponível')
        if ship['ready_at'] > self.state.last_updated:
            raise DataValidationError('nave ainda em montagem')
        return fleet, ship, origin

    def preview_travel(self, target_x: int, target_y: int, propulsion_id: str, mode: str, *, fleet_id: str | None = None, ship_id: str | None = None) -> dict[str, Any]:
        fleet, ship, origin = self._travel_subject(fleet_id, ship_id)
        require_available(self.catalog, self.state, self.catalog.get('travel_modes', mode))
        return {**calculate_travel(self.catalog, origin, (target_x, target_y), ship, propulsion_id, mode), 'fleet_id': fleet['id'] if fleet else None, 'ship_id': ship['id']}

    def send_fleet(self, target_x: int, target_y: int, propulsion_id: str, mode: str, now: float | None = None, *, fleet_id: str | None = None, ship_id: str | None = None) -> dict[str, Any]:
        self.advance(now)
        fleet, ship, origin = self._travel_subject(fleet_id, ship_id)
        preview = self.preview_travel(target_x, target_y, propulsion_id, mode, fleet_id=fleet['id'] if fleet else None, ship_id=None if fleet else ship['id'])
        if self.state.stocks.get(ship['fuel_id'], 0) < preview['fuel_cost']:
            raise DataValidationError('combustível insuficiente para a viagem')
        self.state.stocks[ship['fuel_id']] -= preview['fuel_cost']
        if fleet is None:
            fleet = {'id': str(uuid4()), 'name': f'Fleet {len(self.state.fleets) + 1:02d}', 'ship_ids': [ship['id']], 'x': origin[0], 'y': origin[1]}
            self.state.fleets.append(fleet)
        fleet.update(destination_x=target_x, destination_y=target_y, status='TRANSIT', departure_at=self.state.last_updated, arrival_at=self.state.last_updated + preview['eta_seconds'], propulsion=propulsion_id, mode=mode, fuel_cost=preview['fuel_cost'])
        return {**fleet, 'preview': preview}

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
