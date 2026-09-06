from __future__ import annotations

from dataclasses import asdict, dataclass, field, replace
import math
import time
from typing import Any
from uuid import NAMESPACE_URL, uuid4, uuid5

from .data import Catalog, DataValidationError, District, Hull, Propulsion, Technology
from .universe import StarSystem, colonization_viability, find_spawn_system, generate_system
from .effects import require_available
from .travel import preview_travel as calculate_travel
from .economy import produce


@dataclass
class GameState:
    seed: str
    system_x: int
    system_y: int
    stocks: dict[str, float]
    # The active planet uses ``stocks``; this map keeps the other owned
    # planets available for physical fuel sourcing and persistence.
    stocks_by_planet: dict[str, dict[str, float]] = field(default_factory=dict)
    population_total: int = 100
    districts: dict[str, int] = field(default_factory=dict)
    construction: list[dict[str, Any]] = field(default_factory=list)
    research: dict[str, Any] = field(default_factory=lambda: {"active": None, "complete_at": None, "completed": []})
    ships: list[dict[str, Any]] = field(default_factory=list)
    fleets: list[dict[str, Any]] = field(default_factory=list)
    last_updated: float = 0
    notices: list[str] = field(default_factory=list)
    system_knowledge: dict[str, float] = field(default_factory=dict)
    planet_id: str | None = None
    planet_index: int = 0
    home_planet_id: str | None = None
    home_system_x: int | None = None
    home_system_y: int | None = None
    planets: list[dict[str, Any]] = field(default_factory=list)
    occupied_planets: list[str] = field(default_factory=list)
    colonization_claims: dict[str, str] = field(default_factory=dict)
    new_colonies: list[dict[str, Any]] = field(default_factory=list)
    research_rate_global: float | None = None
    planet_last_updated: float | None = None

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
        started_at = time.time() if now is None else now
        state = GameState(seed, system.x, system.y, {"raw_ore": 220, "volatiles": 100, "refined_alloy": 140, "components": 55, "ion_fuel": 80, "fusion_fuel": 0}, districts={"civil_district": 1, "solar_field": 3, "ore_extractor": 1, "research_lab": 1}, last_updated=started_at, notices=[f"Spawn avaliado: {report.score:.2f} / acesso inicial equilibrado."], system_knowledge={f'{system.x}:{system.y}': started_at}, occupied_planets=[f'{system.x}:{system.y}:0'])
        return cls(catalog, state)

    def system(self) -> StarSystem:
        return replace(generate_system(self.state.seed, self.state.system_x, self.state.system_y, self.catalog), selected_planet_index=self.state.planet_index)

    def advance(self, now: float | None = None) -> None:
        now = time.time() if now is None else now
        if not math.isfinite(now) or now < self.state.last_updated:
            raise DataValidationError('timestamp inválido ou anterior ao estado')
        cursor = self.state.last_updated
        research = self.state.research
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
            self.state.planet_last_updated = cursor
            self._complete_events(cursor)
            self._research_eta()

    def advance_planet(self, now: float) -> None:
        cursor = self.state.planet_last_updated if self.state.planet_last_updated is not None else self.state.last_updated
        if not math.isfinite(now) or now < cursor:
            raise DataValidationError('timestamp inválido ou anterior ao planeta')
        self._complete_construction(cursor)
        while cursor < now:
            boundary = min([now, *(job['complete_at'] for job in self.state.construction if cursor < job['complete_at'] <= now)])
            self._produce(boundary - cursor)
            cursor = boundary
            self._complete_construction(cursor)
        self.state.planet_last_updated = now
        self.state.last_updated = now

    def _research_eta(self) -> None:
        research = self.state.research
        rate = self.capacities()['effective_research_rate']
        research['complete_at'] = self.state.last_updated + research['remaining_work'] / rate if research['active'] and rate > 0 else None

    def _complete_events(self, now: float) -> None:
        self._complete_construction(now)
        research = self.state.research
        if research["active"] and research['remaining_work'] <= 0:
            research.setdefault('completed_at', {})[research['active']] = now
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
                if fleet.get('mission', 'MOVE') == 'SURVEY':
                    self._survey(fleet['x'], fleet['y'], fleet['arrival_at'])
                elif fleet.get('mission') == 'COLONIZE':
                    self._found_colony(fleet)

    def _complete_construction(self, now: float) -> None:
        finished = sorted((item for item in self.state.construction if item["complete_at"] <= now), key=lambda item: (item['complete_at'], item['id']))
        for item in finished:
            self.state.districts[item["id"]] = self.state.districts.get(item["id"], 0) + 1
            self.state.notices.insert(0, f"Construção concluída: {item['id']}.")
        self.state.construction = [item for item in self.state.construction if item["complete_at"] > now]

    def _survey(self, x: int, y: int, surveyed_at: float) -> bool:
        key = f'{x}:{y}'
        if key in self.state.system_knowledge:
            return False
        self.state.system_knowledge[key] = surveyed_at
        self.state.notices.insert(0, f'Sistema {x}:{y} mapeado.')
        return True

    def knowledge_level(self, x: int, y: int) -> str:
        return 'SURVEYED' if f'{x}:{y}' in self.state.system_knowledge else 'UNKNOWN'

    @property
    def colonization_rules(self):
        try:
            return next(iter(self.catalog.items['colonization'].values()))
        except StopIteration as exc:
            raise DataValidationError('configuração de colonização inexistente') from exc

    @staticmethod
    def planet_key(x: int, y: int, planet_index: int) -> str:
        return f'{x}:{y}:{planet_index}'

    def colonization_status(self, x: int, y: int, planet_index: int) -> dict[str, Any]:
        if self.knowledge_level(x, y) != 'SURVEYED':
            return {'eligible': False, 'reason': 'Requer levantamento do sistema.'}
        system = generate_system(self.state.seed, x, y, self.catalog)
        if not 0 <= planet_index < len(system.planets):
            return {'eligible': False, 'reason': 'Planeta inexistente.'}
        key = self.planet_key(x, y, planet_index)
        viability = colonization_viability(system.planets[planet_index], self.colonization_rules)
        if key in self.state.occupied_planets:
            return {'eligible': False, 'reason': 'Planeta já colonizado.', 'viability': viability}
        if key in self.state.colonization_claims:
            return {'eligible': False, 'reason': 'Outra missão colonial já reivindicou o planeta.', 'viability': viability}
        if viability != 'VIABLE':
            return {'eligible': False, 'reason': 'Ambiente não suporta colonização atual.', 'viability': viability}
        if self.capacities()['available_population'] < self.colonization_rules.population:
            return {'eligible': False, 'reason': 'População disponível insuficiente.', 'viability': viability}
        if any(self.state.stocks.get(resource, 0) < amount for resource, amount in self.colonization_rules.cost.items()):
            return {'eligible': False, 'reason': 'Recursos insuficientes para o pacote colonial.', 'viability': viability}
        if not any(fleet['status'] == 'ARRIVED' for fleet in self.state.fleets):
            return {'eligible': False, 'reason': 'Nenhuma frota disponível.', 'viability': viability}
        return {'eligible': True, 'reason': None, 'viability': viability}

    def _found_colony(self, fleet: dict[str, Any]) -> None:
        index = fleet.get('target_planet_index')
        if index is None:
            raise DataValidationError('missão colonial sem planeta alvo')
        x, y = fleet['x'], fleet['y']
        system = generate_system(self.state.seed, x, y, self.catalog)
        if not 0 <= index < len(system.planets):
            raise DataValidationError('planeta colonial inexistente')
        key = self.planet_key(x, y, index)
        if key in self.state.occupied_planets:
            raise DataValidationError('planeta já colonizado')
        if colonization_viability(system.planets[index], self.colonization_rules) != 'VIABLE':
            raise DataValidationError('planeta não é mais colonizável')
        colony = {
            'id': str(uuid5(NAMESPACE_URL, f"starz-colony:{fleet['id']}:{x}:{y}:{index}")), 'x': x, 'y': y, 'planet_index': index,
            'population_total': fleet['colonization_population'],
            'districts': dict(self.colonization_rules.initial_districts),
            'initial_stocks': dict(self.colonization_rules.initial_stocks),
            'created_at': fleet['arrival_at'], 'home': False,
        }
        self.state.new_colonies.append(colony)
        self.state.planets.append(colony.copy())
        self.state.occupied_planets.append(key)
        self.state.colonization_claims.pop(key, None)
        self.state.notices.insert(0, f'Colônia estabelecida em {system.planets[index].name}.')

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
        active_planet = self.state.planet_id
        crew = sum(
            ship["crew"] for ship in self.state.ships
            if ship.get("origin_planet_id") in (None, active_planet)
        )
        supply = max(0, self.state.population_total - crew)
        energy_coverage = 1.0 if consumption <= 0 else min(1.0, generation / consumption)
        workforce_coverage = 1.0 if population_demand <= 0 else min(1.0, supply / population_demand)
        shipyard_occupied = sum(
            ship.get('ready_at', 0) > self.state.last_updated
            and ship.get('origin_planet_id') in (None, active_planet)
            for ship in self.state.ships
        )
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
            'effective_research_rate': self.state.research_rate_global if self.state.research_rate_global is not None else research_rate * min(energy_coverage, workforce_coverage),
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
        self.state.construction.append({"id": district_id, "complete_at": complete_at, "job_id": str(uuid4()), "started_at": self.state.last_updated})
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
        ship = {
            "id": str(uuid4()), "hull_id": hull_id, "propulsion_id": propulsion_id,
            "fuel_id": fuel_id, "crew": hull.crew, "mass": hull.mass,
            "ready_at": self.state.last_updated + hull.duration,
            "origin_planet_id": self.state.planet_id,
            "system_x": self.state.system_x, "system_y": self.state.system_y,
        }
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
            origin = (
                ship.get('system_x') if ship and ship.get('origin_planet_id') and ship.get('system_x') is not None else self.state.system_x,
                ship.get('system_y') if ship and ship.get('origin_planet_id') and ship.get('system_y') is not None else self.state.system_y,
            )
        if ship is None:
            raise DataValidationError('nenhuma nave livre disponível')
        if ship['ready_at'] > self.state.last_updated:
            raise DataValidationError('nave ainda em montagem')
        return fleet, ship, origin

    def preview_travel(self, target_x: int, target_y: int, propulsion_id: str, mode: str, *, fleet_id: str | None = None, ship_id: str | None = None, intra_system: bool = False) -> dict[str, Any]:
        fleet, ship, origin = self._travel_subject(fleet_id, ship_id)
        require_available(self.catalog, self.state, self.catalog.get('travel_modes', mode))
        return {**calculate_travel(self.catalog, origin, (target_x, target_y), ship, propulsion_id, mode, intra_system=intra_system), 'fleet_id': fleet['id'] if fleet else None, 'ship_id': ship['id']}

    def send_fleet(self, target_x: int, target_y: int, propulsion_id: str, mode: str, now: float | None = None, *, fleet_id: str | None = None, ship_id: str | None = None, mission: str = 'MOVE', target_planet_index: int | None = None) -> dict[str, Any]:
        self.advance(now)
        if mission not in {'MOVE', 'SURVEY', 'COLONIZE'}:
            raise DataValidationError('missão de frota inválida')
        fleet, ship, origin = self._travel_subject(fleet_id, ship_id)
        if mission == 'COLONIZE':
            if fleet is None or target_planet_index is None:
                raise DataValidationError('colonização exige uma frota e planeta alvo')
            source_id = fleet.get('origin_planet_id') or self.state.planet_id
            if self.state.stocks_by_planet and str(source_id) != str(self.state.planet_id):
                raise DataValidationError('selecione o planeta de origem da missão')
            status = self.colonization_status(target_x, target_y, target_planet_index)
            if not status['eligible']:
                raise DataValidationError(status['reason'])
        elif target_planet_index is not None:
            raise DataValidationError('planeta alvo só é válido para colonização')
        preview = self.preview_travel(target_x, target_y, propulsion_id, mode, fleet_id=fleet['id'] if fleet else None, ship_id=None if fleet else ship['id'], intra_system=mission == 'COLONIZE')
        fuel_stocks = self._travel_stocks(fleet, ship, origin)
        reserve_mode = bool(self.state.stocks_by_planet)
        if fuel_stocks is None:
            if fleet is None or fleet.get('fuel_reserve', 0) < preview['fuel_cost']:
                raise DataValidationError('combustível local insuficiente para a viagem')
            fleet['fuel_reserve'] -= preview['fuel_cost']
        else:
            required = preview['fuel_cost'] * 2 if reserve_mode and fleet is None else preview['fuel_cost']
            if fuel_stocks.get(ship['fuel_id'], 0) < required:
                raise DataValidationError('combustível local insuficiente para a viagem')
            fuel_stocks[ship['fuel_id']] -= required
        if mission == 'COLONIZE':
            source_id = fleet.get('origin_planet_id') or self.state.planet_id
            source_stocks = self.state.stocks_by_planet.get(str(source_id), self.state.stocks) if self.state.stocks_by_planet else self.state.stocks
            self._pay_from(source_stocks, self.colonization_rules.cost)
            self.state.population_total -= self.colonization_rules.population
        if fleet is None:
            fleet = {'id': str(uuid4()), 'name': f'Fleet {len(self.state.fleets) + 1:02d}', 'ship_ids': [ship['id']], 'x': origin[0], 'y': origin[1], 'origin_planet_id': ship.get('origin_planet_id') or self.state.planet_id, 'fuel_reserve': preview['fuel_cost'] if reserve_mode else 0}
            self.state.fleets.append(fleet)
        fleet.update(destination_x=target_x, destination_y=target_y, status='TRANSIT', departure_at=self.state.last_updated, arrival_at=self.state.last_updated + preview['eta_seconds'], propulsion=propulsion_id, mode=mode, fuel_cost=preview['fuel_cost'], mission=mission, target_planet_index=target_planet_index, colonization_population=self.colonization_rules.population if mission == 'COLONIZE' else None, colonization_origin_planet_id=self.state.planet_id if mission == 'COLONIZE' else None)
        if mission == 'COLONIZE':
            self.state.colonization_claims[self.planet_key(target_x, target_y, target_planet_index)] = fleet['id']
        return {**fleet, 'preview': preview}

    def _travel_stocks(self, fleet: dict[str, Any] | None, ship: dict[str, Any], origin: tuple[int, int]) -> dict[str, float] | None:
        planet_id = ship.get('origin_planet_id') if fleet is None else next(
            (planet['id'] for planet in self.state.planets if planet['x'] == origin[0] and planet['y'] == origin[1]), None
        )
        if not self.state.stocks_by_planet:
            return self.state.stocks
        if planet_id is None:
            return None
        stocks = self.state.stocks_by_planet.get(str(planet_id))
        if stocks is None:
            return None
        return stocks

    def _pay(self, costs: dict[str, float]) -> None:
        self._pay_from(self.state.stocks, costs)

    @staticmethod
    def _pay_from(stocks: dict[str, float], costs: dict[str, float]) -> None:
        missing = [f"{key} ({amount:g})" for key, amount in costs.items() if stocks.get(key, 0) < amount]
        if missing:
            raise DataValidationError("recursos locais insuficientes: " + ", ".join(missing))
        for key, amount in costs.items():
            stocks[key] -= amount
