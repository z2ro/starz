from __future__ import annotations

from dataclasses import asdict, dataclass, field, replace
import math
import time
from typing import Any
from uuid import NAMESPACE_URL, uuid4, uuid5

from .data import Catalog, DataValidationError, District, Hull, Propulsion, Technology
from .universe import StarSystem, colonization_viability, find_spawn_system, generate_system
from .effects import require_available
from .defenses import ensure_defenses, complete_defenses, regenerate_shields, build_defense
from .travel import preview_travel as calculate_travel
from .economy import produce
from .progression import effect, research_quote, building_quote, migrate_research, grant_legacy_tiers, DOMAINS


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
    campaign: dict[str, Any] | None = None
    universe: dict[str, Any] | None = None
    defenses: dict = field(default_factory=dict)
    stellar_states: dict[str, dict] = field(default_factory=dict)
    science_global: dict | None = None
    research_rate_global: float | None = None
    planet_last_updated: float | None = None

    def to_dict(self) -> dict[str, Any]:
        result = asdict(self)
        if self.campaign is None:
            result.pop('campaign')
        if self.universe is None:
            result.pop('universe')
        return result

    @classmethod
    def from_dict(cls, value: dict[str, Any]) -> "GameState":
        return cls(**value)


class Engine:
    def __init__(self, catalog: Catalog, state: GameState):
        self.catalog = catalog
        self.state = state
        if state.universe is not None: ensure_defenses(catalog,state)

    @classmethod
    def new(cls, catalog: Catalog, seed: str = "STARZ-ALPHA", now: float | None = None) -> "Engine":
        system, report = find_spawn_system(seed, catalog)
        started_at = time.time() if now is None else now
        state = GameState(seed, system.x, system.y, {"raw_ore": 220, "volatiles": 100, "refined_alloy": 140, "components": 55, "ion_fuel": 80, "fusion_fuel": 0}, districts={"civil_district": 1, "solar_field": 3, "ore_extractor": 1, "research_lab": 1}, last_updated=started_at, notices=[f"Spawn avaliado: {report.score:.2f} / acesso inicial equilibrado."], system_knowledge={f'{system.x}:{system.y}': started_at}, occupied_planets=[f'{system.x}:{system.y}:0'])
        return cls(catalog, state)

    def system(self) -> StarSystem:
        return replace(generate_system(self.state.seed, self.state.system_x, self.state.system_y, self.catalog), selected_planet_index=self.state.planet_index)

    def advance(self, now: float | None = None) -> None:
        ensure_defenses(self.catalog,self.state)
        now = time.time() if now is None else now
        if not math.isfinite(now) or now < self.state.last_updated:
            raise DataValidationError('timestamp inválido ou anterior ao estado')
        cursor = self.state.last_updated
        migrate_research(self.catalog, self.state)
        research = self.state.research
        self._complete_events(cursor)
        self._research_eta()
        while cursor < now:
            boundaries = [item['complete_at'] for item in self.state.construction] + [j['complete_at'] for j in self.state.defenses.get('queue',[])]
            boundaries.extend(job['complete_at'] for job in self.research_jobs() if job['active'] and job['complete_at'] is not None)
            boundaries.extend(f['arrival_at'] for f in self.state.fleets if f['status'] == 'TRANSIT')
            boundary = min([now, *(stamp for stamp in boundaries if cursor < stamp <= now)])
            self._produce(boundary - cursor)
            for job in self.research_jobs():
                if job['active']:
                    job['remaining_work'] = max(0, job['remaining_work'] - self.research_rate(job) * (boundary - cursor))
                    if job['complete_at'] is not None and boundary >= job['complete_at']: job['remaining_work'] = 0
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
            boundary = min([now, *(job['complete_at'] for job in [*self.state.construction,*self.state.defenses.get('queue',[])] if cursor < job['complete_at'] <= now)])
            self._produce(boundary - cursor)
            cursor = boundary
            self._complete_construction(cursor)
        self.state.planet_last_updated = now
        self.state.last_updated = now

    def science(self):
        if self.state.science_global is not None: return self.state.science_global
        c = self.capacities()
        factor = min(c['energy_coverage'], c['workforce_coverage']) * (1 + effect(self.catalog, self.state, 'research'))
        general = self.state.districts.get('research_lab', 0)
        return {domain: {'capacity': general + self.state.districts.get(f'{domain}_lab', 0), 'specialized': self.state.districts.get(f'{domain}_lab', 0), 'rate': (general * self.catalog.get('districts', 'research_lab').research_rate / 3 + self.state.districts.get(f'{domain}_lab', 0) * (self.catalog.items['districts'][f'{domain}_lab'].research_rate if f'{domain}_lab' in self.catalog.items['districts'] else 0)) * factor} for domain in DOMAINS}

    def research_jobs(self):
        return list(self.state.universe['research_domains'].values()) if self.state.universe is not None and 'research_domains' in self.state.universe else [self.state.research]

    def research_rate(self, job):
        if self.state.universe is None or job.get('legacy_rate'): return self.capacities()['effective_research_rate']
        return self.science()[self.catalog.get('technologies', job['active']).domain]['rate']

    def _research_eta(self) -> None:
        for job in self.research_jobs():
            rate = self.research_rate(job) if job['active'] else 0
            job['complete_at'] = self.state.last_updated + job['remaining_work'] / rate if job['active'] and rate > 0 else None
        if self.state.universe is not None and 'research_domains' in self.state.universe:
            active = sorted((job for job in self.research_jobs() if job['active']), key=lambda job: job['complete_at'] if job['complete_at'] is not None else float('inf'))
            self.state.research.update({key: active[0][key] if active else (0 if key == 'remaining_work' else None) for key in ('active','remaining_work','complete_at')})

    def _complete_events(self, now: float) -> None:
        self._complete_construction(now)
        for research in self.research_jobs():
            if research["active"] and research['remaining_work'] <= 0:
                self.state.research.setdefault('completed_at', {})[research['active']] = now
                if self.state.universe is not None:
                    levels = self.state.universe.setdefault('levels', {})
                    levels[research['active']] = levels.get(research['active'], 0) + 1
                if research['active'] not in self.state.research['completed']:
                    self.state.research['completed'].append(research['active'])
                if self.state.universe is not None and research.get('legacy_rate'):
                    grant_legacy_tiers(self.state, self.catalog.get('technologies', research['active']), now)
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
        complete_defenses(self.catalog,self.state,now)
        finished = sorted((item for item in self.state.construction if item["complete_at"] <= now), key=lambda item: (item['complete_at'], item['id']))
        for item in finished:
            if item['id']=='orbital_battery' and self.state.universe is not None:
                self.state.defenses['units'].append({'id':item['job_id'],'type':'point_defense','hp':self.catalog.get('defenses','point_defense').hull_points,'charge':0})
            else:
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
        stellar=self.state.stellar_states.get(f'{x}:{y}',{})
        if stellar.get('reserved') or stellar.get('present') is False:
            return {'eligible':False,'reason':'Sistema comprometido por operação estelar ou sem estrela disponível.'}
        system = generate_system(self.state.seed, x, y, self.catalog)
        if not 0 <= planet_index < len(system.planets):
            return {'eligible': False, 'reason': 'Planeta inexistente.'}
        key = self.planet_key(x, y, planet_index)
        viability = colonization_viability(system.planets[planet_index], self.colonization_rules)
        if self.state.campaign and any(not r['conquered'] and [x, y] in r['claims'] for r in self.state.campaign['rivals']):
            return {'eligible': False, 'reason': 'Território soberano de outra civilização.', 'viability': viability}
        if self.state.universe is not None and len(self.state.planets) + sum(f['status'] == 'TRANSIT' and f.get('mission') == 'COLONIZE' for f in self.state.fleets) >= 1 + int(effect(self.catalog, self.state, 'colonies')):
            return {'eligible': False, 'reason': 'Astrofísica insuficiente: limite de colônias.', 'viability': viability}
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
        if self.state.universe is not None:
            for unit in self.state.defenses.get('units',[]):
                item=self.catalog.get('defenses',unit['type'])
                consumption+=item.energy_consumption
                population_demand+=item.workforce
        generation *= 1 + effect(self.catalog, self.state, 'energy')
        population_demand /= 1 + effect(self.catalog, self.state, 'workforce')
        research_rate *= 1 + effect(self.catalog, self.state, 'research')
        active_planet = self.state.planet_id
        crew = sum(
            ship["crew"] for ship in self.state.ships
            if ship.get("origin_planet_id") in (None, active_planet)
        )
        consumption /= 1 + effect(self.catalog, self.state, 'energy_efficiency')
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
            'construction_slots_available': max(0, construction_slots - len(self.state.construction) - len(self.state.defenses.get('queue',[]))),
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
        regenerate_shields(self.catalog,self.state,elapsed,factor)
        self._repair_docked_ships(elapsed,factor)
        if self.state.universe is None:
            produce(self.catalog, self.state.stocks, self.state.districts, elapsed, factor)
        else:
            produce(self.economic_catalog(), self.state.stocks, self.state.districts, elapsed, factor)
            limit = 100000 * 1.7 ** (effect(self.catalog, self.state, 'storage') * 4)
            for key in self.state.stocks:
                self.state.stocks[key] = min(limit, self.state.stocks[key])

    def _repair_docked_ships(self,seconds,factor):
        if self.state.universe is None or self.state.districts.get('orbital_shipyard',0)<1:return
        from .persistent.combat import local_defenders
        health=self.state.universe.setdefault('ship_health',{})
        budget=seconds*2*self.state.districts['orbital_shipyard']*factor
        for ship in sorted(local_defenders(self,self.state.planet_id),key=lambda s:s['id']):
            if ship['id'] not in health:continue
            maximum=self.catalog.get('ships',ship['hull_id']).hull_points
            repair=min(budget,max(0,maximum-health[ship['id']]))
            health[ship['id']]+=repair;budget-=repair

    def economic_catalog(self):
        if self.state.universe is None: return self.catalog
        changed = dict(self.catalog.items)
        changed['districts'] = {}
        for key, district in self.catalog.items['districts'].items():
            n = self.state.districts.get(key, 0)
            scale = 1.08 ** max(0, n - 1)
            efficiency = 1 + effect(self.catalog, self.state, 'processing' if district.processing else 'mining')
            outputs = {r: v * scale * efficiency * (1 + effect(self.catalog, self.state, 'components' if r == 'components' else 'alloy') if r in {'components', 'refined_alloy'} else 1) for r, v in district.production.items()}
            changed['districts'][key] = district.model_copy(update={'production': outputs, 'processing': {r: v * scale for r, v in district.processing.items()}, 'energy_generation': district.energy_generation * (1 + effect(self.catalog, self.state, 'energy')), 'energy_consumption': district.energy_consumption / (1 + effect(self.catalog, self.state, 'energy_efficiency')), 'workforce': district.workforce / (1 + effect(self.catalog, self.state, 'workforce')), 'research_rate': district.research_rate * (1 + effect(self.catalog, self.state, 'research'))})
        return Catalog(changed, self.catalog.sources)

    def build(self, district_id: str, now: float | None = None) -> dict[str, Any]:
        self.advance(now)
        if district_id=='orbital_battery' and self.state.universe is not None:return build_defense(self,'point_defense')
        district: District = self.catalog.get("districts", district_id)  # type: ignore[assignment]
        require_available(self.catalog, self.state, district)
        capacities = self.capacities()
        if capacities["available_population"] < district.workforce:
            raise DataValidationError("população disponível insuficiente")
        if district.energy_consumption > 0 and capacities["energy_generation"] - capacities["energy_consumption"] < district.energy_consumption:
            raise DataValidationError("capacidade energética insuficiente")
        if capacities['construction_slots_available'] < 1:
            raise DataValidationError('slots de construção ocupados ou indisponíveis')
        quote = building_quote(self.catalog, self.state, district_id) if self.state.universe is not None else {'cost': district.cost, 'duration': district.duration}
        self._pay(quote['cost'])
        complete_at = self.state.last_updated + quote['duration']
        self.state.construction.append({"id": district_id, "complete_at": complete_at, "job_id": str(uuid4()), "started_at": self.state.last_updated})
        return {"id": district_id, "complete_at": complete_at}

    def research(self, technology_id: str, now: float | None = None) -> dict[str, Any]:
        self.advance(now)
        technology: Technology = self.catalog.get("technologies", technology_id)  # type: ignore[assignment]
        migrate_research(self.catalog, self.state)
        job = self.state.universe["research_domains"][technology.domain] if self.state.universe is not None else self.state.research
        if job["active"]:
            raise DataValidationError("já existe pesquisa em andamento neste domínio")
        if self.state.universe is None and technology_id in self.state.research["completed"]:
            raise DataValidationError("pesquisa já concluída")
        require_available(self.catalog, self.state, technology)
        if (self.science()[technology.domain]["rate"] if self.state.universe is not None else self.capacities()["research_rate"]) <= 0:
            raise DataValidationError("nenhuma capacidade de pesquisa")
        quote = research_quote(self.catalog, self.state, technology_id) if self.state.universe is not None else {'cost': technology.cost, 'work': technology.duration, 'requirements': []}
        if quote['requirements']:
            raise DataValidationError('; '.join(quote['requirements']))
        self._pay(quote['cost'])
        job.update(active=technology_id, remaining_work=quote['work'], total_work=quote['work'], legacy_rate=False)
        self._research_eta()
        return {'id': technology_id, 'domain': technology.domain, 'complete_at': job['complete_at'], 'remaining_work': quote['work']}

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
            "ready_at": self.state.last_updated + hull.duration / (1 + effect(self.catalog, self.state, 'ship_speed')),
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

    def preview_travel(self, target_x: int, target_y: int, propulsion_id: str, mode: str, *, fleet_id: str | None = None, ship_id: str | None = None, planet_id: str | None = None, intra_system: bool = False) -> dict[str, Any]:
        fleet, ship, origin = self._travel_subject(fleet_id, ship_id)
        self._travel_source(fleet, ship, origin, planet_id)
        require_available(self.catalog, self.state, self.catalog.get('travel_modes', mode))
        return {**calculate_travel(self.catalog, origin, (target_x, target_y), ship, propulsion_id, mode, intra_system=intra_system), 'fleet_id': fleet['id'] if fleet else None, 'ship_id': ship['id']}

    def send_fleet(self, target_x: int, target_y: int, propulsion_id: str, mode: str, now: float | None = None, *, fleet_id: str | None = None, ship_id: str | None = None, mission: str = 'MOVE', target_planet_index: int | None = None, planet_id: str | None = None, intra_system: bool = False) -> dict[str, Any]:
        self.advance(now)
        if mission not in {'MOVE', 'SURVEY', 'COLONIZE'}:
            raise DataValidationError('missão de frota inválida')
        fleet, ship, origin = self._travel_subject(fleet_id, ship_id)
        if self.state.campaign:
            allowed = {'SURVEY': {'exploration', 'science'}, 'COLONIZE': {'exploration', 'logistics'}}
            if mission in allowed and self.catalog.get('ships', ship['hull_id']).role not in allowed[mission]:
                raise DataValidationError('função naval incompatível com a missão')
        if mission == 'COLONIZE':
            if fleet is None or target_planet_index is None:
                raise DataValidationError('colonização exige uma frota e planeta alvo')
            source_id = planet_id or self.state.planet_id
            if self.state.stocks_by_planet and str(source_id) != str(self.state.planet_id):
                raise DataValidationError('selecione o planeta de origem da missão')
            status = self.colonization_status(target_x, target_y, target_planet_index)
            if not status['eligible']:
                raise DataValidationError(status['reason'])
        elif target_planet_index is not None:
            raise DataValidationError('planeta alvo só é válido para colonização')
        preview = self.preview_travel(target_x, target_y, propulsion_id, mode, fleet_id=fleet['id'] if fleet else None, ship_id=None if fleet else ship['id'], planet_id=planet_id, intra_system=mission == 'COLONIZE' or intra_system)
        fuel_stocks, source_id = self._travel_source(fleet, ship, origin, planet_id)
        reserve_mode = bool(self.state.stocks_by_planet)
        if fuel_stocks is None:
            if fleet is None or fleet.get('fuel_reserve', 0) < preview['fuel_cost']:
                raise DataValidationError('combustível local insuficiente para a viagem')
            fleet['fuel_reserve'] -= preview['fuel_cost']
        else:
            required = preview['fuel_cost'] * (3 if self.state.campaign else 2) if reserve_mode and (fleet is None or self.state.campaign) else preview['fuel_cost']
            if fuel_stocks.get(ship['fuel_id'], 0) < required:
                raise DataValidationError('combustível local insuficiente para a viagem')
            fuel_stocks[ship['fuel_id']] -= required
        if mission == 'COLONIZE':
            if source_id is None and self.state.stocks_by_planet:
                raise DataValidationError('colonização exige um planeta de origem no sistema da frota')
            source_stocks = self.state.stocks_by_planet.get(str(source_id), self.state.stocks) if self.state.stocks_by_planet else self.state.stocks
            self._pay_from(source_stocks, self.colonization_rules.cost)
            self.state.population_total -= self.colonization_rules.population
        if fleet is None:
            fleet = {'id': str(uuid4()), 'name': f'Fleet {len(self.state.fleets) + 1:02d}', 'ship_ids': [ship['id']], 'x': origin[0], 'y': origin[1], 'origin_planet_id': ship.get('origin_planet_id') or self.state.planet_id, 'fuel_reserve': preview['fuel_cost'] * (2 if self.state.campaign else 1) if reserve_mode else 0}
            self.state.fleets.append(fleet)
        elif self.state.campaign and fuel_stocks is not None:
            fleet['fuel_reserve'] += preview['fuel_cost'] * 2
        fleet.update(destination_x=target_x, destination_y=target_y, status='TRANSIT', departure_at=self.state.last_updated, arrival_at=self.state.last_updated + preview['eta_seconds'], propulsion=propulsion_id, mode=mode, fuel_cost=preview['fuel_cost'], mission=mission, target_planet_index=target_planet_index, colonization_population=self.colonization_rules.population if mission == 'COLONIZE' else None, colonization_origin_planet_id=source_id if mission == 'COLONIZE' else None)
        if mission == 'COLONIZE':
            self.state.colonization_claims[self.planet_key(target_x, target_y, target_planet_index)] = fleet['id']
        return {**fleet, 'preview': preview}

    def _travel_source(self, fleet: dict[str, Any] | None, ship: dict[str, Any], origin: tuple[int, int], planet_id: str | None) -> tuple[dict[str, float] | None, str | None]:
        if not self.state.stocks_by_planet:
            return self.state.stocks, self.state.planet_id
        source_id = planet_id
        if source_id is None:
            if fleet is None:
                source_id = ship.get('origin_planet_id') or self.state.planet_id
            else:
                active = next((planet for planet in self.state.planets if planet['id'] == self.state.planet_id), None)
                source_id = self.state.planet_id if active and (active['x'], active['y']) == origin else None
        if source_id is None:
            return None, None
        source = next((planet for planet in self.state.planets if str(planet['id']) == str(source_id)), None)
        if source is None or str(source_id) not in self.state.stocks_by_planet:
            raise DataValidationError('planeta de abastecimento não pertence ao império')
        if (source['x'], source['y']) != origin:
            raise DataValidationError('planeta de abastecimento não está no sistema da frota')
        return self.state.stocks_by_planet[str(source_id)], str(source_id)

    def _pay(self, costs: dict[str, float]) -> None:
        self._pay_from(self.state.stocks, costs)

    @staticmethod
    def _pay_from(stocks: dict[str, float], costs: dict[str, float]) -> None:
        missing = [f"{key} ({amount:g})" for key, amount in costs.items() if stocks.get(key, 0) < amount]
        if missing:
            raise DataValidationError("recursos locais insuficientes: " + ", ".join(missing))
        for key, amount in costs.items():
            stocks[key] -= amount
