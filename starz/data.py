from __future__ import annotations

from pathlib import Path
from typing import Annotated, Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

Positive = Annotated[float, Field(gt=0, allow_inf_nan=False)]
NonNegative = Annotated[float, Field(ge=0, allow_inf_nan=False)]


class DataValidationError(ValueError):
    pass


class Content(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    id: str = Field(pattern=r"^[a-zA-Z][a-zA-Z0-9_]*$")
    name: str
    description: str
    category: str
    cost: dict[str, Positive] = Field(default_factory=dict)
    requires: list[str] = Field(default_factory=list)


class Resource(Content):
    stock: bool


class Fuel(Content):
    energy_density: float = Field(gt=0)
    storage_factor: float = Field(gt=0)


class Propulsion(Content):
    compatible_fuels: list[str] = Field(min_length=1)
    speed_factor: float = Field(gt=0, le=10)
    fuel_efficiency: float = Field(gt=0, le=10)
    thermal_load: float = Field(ge=0, le=10)
    signature: float = Field(ge=0, le=10)


class Technology(Content):
    domain: Literal["civil", "military", "fundamental"] = "fundamental"
    tier: int = Field(default=1, ge=1, le=5)
    kind: Literal["repeatable", "breakthrough"] = "repeatable"
    future_unlocks: list[Literal["planetary_shields", "missile_defense", "orbital_platforms", "stellar_megastructures"]] = Field(default_factory=list)
    advances_tier: int | None = Field(default=None, ge=2, le=5)
    milestones: dict[int, dict[str, NonNegative]] = Field(default_factory=dict)
    duration: float = Field(gt=0)
    unlocks: list[str] = Field(default_factory=list)
    level_cost_growth: float = Field(default=1.7, ge=1, le=3)
    level_work_growth: float = Field(default=1.55, ge=1, le=3)
    level_requires: dict[str, int] = Field(default_factory=dict)
    infrastructure: dict[str, int] = Field(default_factory=dict)
    effects: dict[str, NonNegative] = Field(default_factory=dict)


class District(Content):
    science_domain: Literal["civil", "military", "fundamental"] | None = None
    duration: float = Field(gt=0)
    workforce: int = Field(ge=0)
    energy_generation: float = Field(default=0, ge=0)
    energy_consumption: float = Field(default=0, ge=0)
    production: dict[str, Positive] = Field(default_factory=dict)
    processing: dict[str, Positive] = Field(default_factory=dict)
    research_rate: float = Field(default=0, ge=0)
    population_capacity: int = Field(default=0, ge=0)
    industrial_capacity: NonNegative = 0
    construction_slots: int = Field(default=0, ge=0, strict=True)
    shipyard_slots: int = Field(default=0, ge=0, strict=True)

    @model_validator(mode="after")
    def process_has_outputs(self):
        if self.processing and not self.production:
            raise ValueError("processing exige production")
        return self


class Hull(Content):
    hull_points: Positive = 100
    weapon_damage: NonNegative = 5
    shield_points: NonNegative = 0
    combat_class: Literal["light", "medium", "capital"] = "light"
    weapon_modifiers: dict[Literal["light", "medium", "capital"], Positive] = Field(default_factory=dict)
    classification: str = Field(pattern=r"^[a-z][a-z0-9_]*$")
    role: str = Field(pattern=r"^[a-z][a-z0-9_]*$")
    mass: float = Field(gt=0)
    crew: int = Field(ge=0)
    duration: float = Field(gt=0)
    compatible_propulsion: list[str] = Field(min_length=1)
    combat_power: NonNegative = 0
    cargo_capacity: NonNegative = 0
    science_bonus: NonNegative = 0
    carrier_capacity: int = Field(default=0, ge=0)


class Defense(Content):
    kind: Literal['structure', 'ammunition'] = 'structure'
    duration: Positive
    industrial_requirement: int = Field(default=1, ge=1, le=50)
    level_requires: dict[str, int] = Field(default_factory=dict)
    hull_points: Positive = 100
    damage: NonNegative = 0
    shield: NonNegative = 0
    energy_consumption: NonNegative = 0
    workforce: int = Field(default=0, ge=0)
    modifiers: dict[Literal['light', 'medium', 'capital'], Positive] = Field(default_factory=dict)
    ammunition: str | None = None
    missile_range: NonNegative = 0
    intercept_capacity: int = Field(default=0,ge=0,le=100)
    shield_regen: NonNegative = 0


class Archetype(Content):
    weight: Positive

    @model_validator(mode="after")
    def ordered_ranges(self):
        for name in type(self).model_fields:
            if name.endswith('_range'):
                low, high = getattr(self, name)
                if low > high:
                    raise ValueError(f"{name}: mínimo maior que máximo")
        for name in ('water_range', 'usable_surface_range'):
            if hasattr(self, name) and getattr(self, name)[1] > 100:
                raise ValueError(f"{name}: percentual excede 100")
        return self


class StarArchetype(Archetype):
    stellar_class: str
    mass_range: tuple[Positive, Positive]
    luminosity_offset: NonNegative
    luminosity_scale_range: tuple[Positive, Positive]
    activity_range: tuple[NonNegative, NonNegative]
    age_range: tuple[NonNegative, NonNegative]


class PlanetArchetype(Archetype):
    star_archetypes: list[str] = Field(min_length=1)
    mass_range: tuple[Positive, Positive]
    radius_range: tuple[Positive, Positive]
    gravity_range: tuple[Positive, Positive]
    orbital_distance_range: tuple[Positive, Positive]
    temperature_base: Positive
    temperature_scale: Positive
    atmosphere_profiles: list[str] = Field(min_length=1)
    radiation_range: tuple[NonNegative, NonNegative]
    magnetic_field_range: tuple[NonNegative, NonNegative]
    water_range: tuple[NonNegative, NonNegative]
    geological_activity_range: tuple[NonNegative, NonNegative]
    mineral_profile: dict[str, tuple[NonNegative, NonNegative]] = Field(min_length=1)
    usable_surface_range: tuple[Positive, Positive]

    @model_validator(mode="after")
    def mineral_ranges(self):
        if any(low > high for low, high in self.mineral_profile.values()):
            raise ValueError("mineral_profile: range invertido")
        return self


class TravelMode(Content):
    travel_time_modifier: Positive
    fuel_modifier: Positive
    thermal_modifier: NonNegative
    signature_modifier: NonNegative


class Colonization(Content):
    population: int = Field(gt=0, strict=True)
    initial_districts: dict[str, int] = Field(min_length=1)
    initial_stocks: dict[str, NonNegative] = Field(default_factory=dict)
    viable_gravity_range: tuple[Positive, Positive]
    viable_temperature_range: tuple[Positive, Positive]
    survivable_gravity_range: tuple[Positive, Positive]
    survivable_temperature_range: tuple[Positive, Positive]
    viable_max_radiation: NonNegative
    survivable_max_radiation: NonNegative
    viable_min_water: NonNegative

    @model_validator(mode='after')
    def valid_thresholds(self):
        for name in ('viable_gravity_range', 'viable_temperature_range', 'survivable_gravity_range', 'survivable_temperature_range'):
            low, high = getattr(self, name)
            if low > high:
                raise ValueError(f'{name}: mínimo maior que máximo')
        if not (self.survivable_gravity_range[0] <= self.viable_gravity_range[0] <= self.viable_gravity_range[1] <= self.survivable_gravity_range[1]):
            raise ValueError('gravity ranges inconsistentes')
        if not (self.survivable_temperature_range[0] <= self.viable_temperature_range[0] <= self.viable_temperature_range[1] <= self.survivable_temperature_range[1]):
            raise ValueError('temperature ranges inconsistentes')
        if self.viable_max_radiation > self.survivable_max_radiation or self.viable_min_water > 100:
            raise ValueError('thresholds ambientais inconsistentes')
        if any(level <= 0 for level in self.initial_districts.values()):
            raise ValueError('initial_districts exige níveis positivos')
        return self


KINDS: dict[str, type[Content]] = {
    "resources": Resource,
    "fuels": Fuel,
    "propulsion": Propulsion,
    "technologies": Technology,
    "districts": District,
    "ships": Hull,
    "defenses": Defense,
    "stars": StarArchetype,
    "planets": PlanetArchetype,
    "travel_modes": TravelMode,
    "colonization": Colonization,
}


class Catalog:
    def __init__(self, items: dict[str, dict[str, Content]], sources: dict[str, str]):
        self.items = items
        self.sources = sources

    @classmethod
    def load(cls, root: str | Path, overlay: str | Path | None = None) -> "Catalog":
        root = Path(root)
        items: dict[str, dict[str, Content]] = {kind: {} for kind in KINDS}
        sources: dict[str, str] = {}
        errors: list[str] = []
        if not root.is_dir():
            raise DataValidationError(f"diretório inexistente: {root}")
        override_root = Path(overlay) if overlay is not None else None
        overridden: set[str] = set()
        paths = sorted(root.rglob("*.yaml")) + (sorted(override_root.rglob("*.yaml")) if override_root else [])
        for path in paths:
            override = override_root is not None and path.is_relative_to(override_root)
            kind = path.relative_to(override_root if override else root).parts[0]
            if kind not in KINDS:
                errors.append(f"{path}: diretório de conteúdo desconhecido")
                continue
            try:
                raw = yaml.safe_load(path.read_text())
                entries = raw if isinstance(raw, list) else [raw]
                if not all(isinstance(entry, dict) for entry in entries):
                    raise ValueError("arquivo deve conter um mapa ou lista de mapas")
                for entry in entries:
                    item = KINDS[kind].model_validate(entry)
                    if item.id in sources and (not override or item.id in overridden):
                        errors.append(f"ID duplicado: {item.id} ({sources[item.id]} e {path})")
                    else:
                        items[kind][item.id] = item
                        sources[item.id] = str(path)
                        if override:
                            overridden.add(item.id)
            except (OSError, yaml.YAMLError, ValidationError, ValueError) as exc:
                errors.append(f"{path}: {exc}")
        catalog = cls(items, sources)
        if not sources:
            errors.append('catálogo vazio')
        errors.extend(catalog._reference_errors())
        if errors:
            raise DataValidationError("\n".join(errors))
        return catalog

    def _reference_errors(self) -> list[str]:
        errors: list[str] = []
        resources = set(self.items["resources"])
        unlockable = set().union(*(self.items[kind] for kind in ('technologies', 'districts', 'ships', 'fuels', 'propulsion', 'travel_modes', 'defenses')))
        for kind, entries in self.items.items():
            for item in entries.values():
                for resource_id in item.cost:
                    if resource_id not in resources:
                        errors.append(f"{item.id}: recurso desconhecido em cost: {resource_id}")
                for ref in item.requires:
                    if ref not in self.items['technologies'] and ref not in self.items['districts']:
                        errors.append(f"{item.id}: referência desconhecida: {ref}")
                if isinstance(item, Defense):
                    for ref, required in item.level_requires.items():
                        if ref not in self.items['technologies'] or not 1 <= required <= 50:
                            errors.append(f'{item.id}: requisito tecnológico inválido: {ref}')
                    if item.ammunition and (item.ammunition not in self.items['defenses'] or self.items['defenses'][item.ammunition].kind != 'ammunition'):
                        errors.append(f'{item.id}: munição inválida')
                if isinstance(item, Technology):
                    if item.advances_tier and (item.kind != "breakthrough" or item.advances_tier != item.tier):
                        errors.append(f"{item.id}: avanço de tier inválido")
                    if item.advances_tier and (item.id != f'{item.domain}_tier_{item.tier}' or (item.tier > 2 and f'{item.domain}_tier_{item.tier-1}' not in item.requires)):
                        errors.append(f"{item.id}: cadeia de avanço inválida")
                    from .progression import EFFECTS
                    if set(item.effects) - EFFECTS or any(set(v) - EFFECTS for v in item.milestones.values()):
                        errors.append(f"{item.id}: efeito desconhecido")
                    if any(n < 1 or n > 50 for n in item.milestones):
                        errors.append(f"{item.id}: milestone inválido")
                    for ref, level in item.level_requires.items():
                        if ref not in self.items['technologies'] or not 1 <= level <= 50:
                            errors.append(f'{item.id}: requisito de nível inválido: {ref}')
                    for ref, level in item.infrastructure.items():
                        if ref not in self.items['districts'] or not 1 <= level <= 50:
                            errors.append(f'{item.id}: infraestrutura inválida: {ref}')
                    for ref in item.unlocks:
                        if ref not in unlockable:
                            errors.append(f"{item.id}: unlock inválido: {ref}")
        for item in self.items["propulsion"].values():
            for fuel_id in item.compatible_fuels:
                if fuel_id not in self.items["fuels"]:
                    errors.append(f"{item.id}: combustível desconhecido: {fuel_id}")
        for item in self.items["districts"].values():
            for ref in item.production.keys() | item.processing.keys():
                if ref not in resources | set(self.items['fuels']):
                    errors.append(f"{item.id}: recurso de processo desconhecido: {ref}")
        for item in self.items["ships"].values():
            for propulsion_id in item.compatible_propulsion:
                if propulsion_id not in self.items["propulsion"]:
                    errors.append(f"{item.id}: propulsão desconhecida: {propulsion_id}")
        for item in self.items['planets'].values():
            for ref in item.star_archetypes:
                if ref not in self.items['stars']:
                    errors.append(f"{item.id}: arquétipo estelar desconhecido: {ref}")
            for ref in item.mineral_profile:
                if ref not in resources:
                    errors.append(f"{item.id}: mineral desconhecido: {ref}")
        for item in self.items['colonization'].values():
            for ref in item.initial_districts:
                if ref not in self.items['districts']:
                    errors.append(f'{item.id}: distrito inicial desconhecido: {ref}')
            for ref in item.initial_stocks:
                if ref not in resources | set(self.items['fuels']):
                    errors.append(f'{item.id}: estoque inicial desconhecido: {ref}')
        for star_id in self.items['stars']:
            if not any(star_id in planet.star_archetypes for planet in self.items['planets'].values()):
                errors.append(f"{star_id}: nenhum arquétipo planetário compatível")
        errors.extend(self._technology_cycles())
        return errors

    def _technology_cycles(self) -> list[str]:
        errors: list[str] = []
        graph = {item.id: list(item.requires) for entries in self.items.values() for item in entries.values()}
        for defense in self.items['defenses'].values():
            graph[defense.id].extend(defense.level_requires)
        for technology in self.items['technologies'].values():
            graph[technology.id].extend(technology.level_requires)
            graph[technology.id].extend(technology.infrastructure)
            if technology.tier > 1 and not technology.advances_tier:
                gate = f'{technology.domain}_tier_{technology.tier}'
                if gate in graph: graph[technology.id].append(gate)
                else: errors.append(f'{technology.id}: avanço de tier ausente')
            for target in technology.unlocks:
                if target in graph:
                    graph[target].append(technology.id)
        visiting: set[str] = set()
        visited: set[str] = set()

        def visit(node: str) -> None:
            if node in visiting:
                errors.append(f"ciclo proibido em requirements de tecnologia: {node}")
                return
            if node in visited:
                return
            visiting.add(node)
            for dependency in sorted(graph[node]):
                if dependency in graph:
                    visit(dependency)
            visiting.remove(node)
            visited.add(node)

        for node in graph:
            visit(node)
        return errors

    def get(self, kind: str, item_id: str) -> Content:
        try:
            return self.items[kind][item_id]
        except KeyError as exc:
            raise DataValidationError(f"{kind}: conteúdo inexistente: {item_id}") from exc

    def has(self, item_id: str) -> bool:
        return item_id in self.sources
