from __future__ import annotations

from pathlib import Path
from typing import Annotated

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
    duration: float = Field(gt=0)
    unlocks: list[str] = Field(default_factory=list)


class District(Content):
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
    mass: float = Field(gt=0)
    crew: int = Field(ge=0)
    duration: float = Field(gt=0)
    compatible_propulsion: list[str] = Field(min_length=1)


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


KINDS: dict[str, type[Content]] = {
    "resources": Resource,
    "fuels": Fuel,
    "propulsion": Propulsion,
    "technologies": Technology,
    "districts": District,
    "ships": Hull,
    "stars": StarArchetype,
    "planets": PlanetArchetype,
    "travel_modes": TravelMode,
}


class Catalog:
    def __init__(self, items: dict[str, dict[str, Content]], sources: dict[str, str]):
        self.items = items
        self.sources = sources

    @classmethod
    def load(cls, root: str | Path) -> "Catalog":
        root = Path(root)
        items: dict[str, dict[str, Content]] = {kind: {} for kind in KINDS}
        sources: dict[str, str] = {}
        errors: list[str] = []
        if not root.is_dir():
            raise DataValidationError(f"diretório inexistente: {root}")
        for path in sorted(root.rglob("*.yaml")):
            kind = path.relative_to(root).parts[0]
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
                    if item.id in sources:
                        errors.append(f"ID duplicado: {item.id} ({sources[item.id]} e {path})")
                    else:
                        items[kind][item.id] = item
                        sources[item.id] = str(path)
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
        unlockable = set().union(*(self.items[kind] for kind in ('technologies', 'districts', 'ships', 'fuels', 'propulsion', 'travel_modes')))
        for kind, entries in self.items.items():
            for item in entries.values():
                for resource_id in item.cost:
                    if resource_id not in resources:
                        errors.append(f"{item.id}: recurso desconhecido em cost: {resource_id}")
                for ref in item.requires:
                    if ref not in self.items['technologies'] and ref not in self.items['districts']:
                        errors.append(f"{item.id}: referência desconhecida: {ref}")
                if isinstance(item, Technology):
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
        for star_id in self.items['stars']:
            if not any(star_id in planet.star_archetypes for planet in self.items['planets'].values()):
                errors.append(f"{star_id}: nenhum arquétipo planetário compatível")
        errors.extend(self._technology_cycles())
        return errors

    def _technology_cycles(self) -> list[str]:
        graph = {item.id: list(item.requires) for entries in self.items.values() for item in entries.values()}
        for technology in self.items['technologies'].values():
            for target in technology.unlocks:
                if target in graph:
                    graph[target].append(technology.id)
        visiting: set[str] = set()
        visited: set[str] = set()
        errors: list[str] = []

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
