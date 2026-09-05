from __future__ import annotations

from pathlib import Path
from typing import Any, Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field, ValidationError


class DataValidationError(ValueError):
    pass


class Content(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(pattern=r"^[a-z][a-z0-9_]*$")
    name: str
    description: str
    category: str
    cost: dict[str, float] = Field(default_factory=dict)
    requires: list[str] = Field(default_factory=list)
    unlocks: list[str] = Field(default_factory=list)
    effects: list[str] = Field(default_factory=list)


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


class District(Content):
    duration: float = Field(gt=0)
    workforce: int = Field(ge=0)
    energy_generation: float = Field(default=0, ge=0)
    energy_consumption: float = Field(default=0, ge=0)
    production: dict[str, float] = Field(default_factory=dict)
    processing: dict[str, float] = Field(default_factory=dict)
    research_rate: float = Field(default=0, ge=0)
    population_capacity: int = Field(default=0, ge=0)
    capacity: int = Field(default=1, ge=1)
    unlock: str | None = None


class Hull(Content):
    mass: float = Field(gt=0)
    crew: int = Field(ge=0)
    duration: float = Field(gt=0)
    compatible_propulsion: list[str] = Field(min_length=1)


KINDS: dict[str, type[Content]] = {
    "resources": Resource,
    "fuels": Fuel,
    "propulsion": Propulsion,
    "technologies": Technology,
    "districts": District,
    "ships": Hull,
}
KNOWN_EFFECTS = {"unlock_content", "modify_production"}


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
        for path in sorted(root.rglob("*.yaml")):
            kind = next((key for key in KINDS if key in path.parts), None)
            if kind is None:
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
        errors.extend(catalog._reference_errors())
        if errors:
            raise DataValidationError("\n".join(errors))
        return catalog

    def _reference_errors(self) -> list[str]:
        errors: list[str] = []
        all_ids = set(self.sources)
        resources = set(self.items["resources"])
        for kind, entries in self.items.items():
            for item in entries.values():
                for resource_id in item.cost:
                    if resource_id not in resources:
                        errors.append(f"{item.id}: recurso desconhecido em cost: {resource_id}")
                for ref in [*item.requires, *item.unlocks]:
                    if ref not in all_ids:
                        errors.append(f"{item.id}: referência desconhecida: {ref}")
                unknown_effects = set(item.effects) - KNOWN_EFFECTS
                if unknown_effects:
                    errors.append(f"{item.id}: efeitos desconhecidos: {sorted(unknown_effects)}")
        for item in self.items["propulsion"].values():
            for fuel_id in item.compatible_fuels:
                if fuel_id not in self.items["fuels"]:
                    errors.append(f"{item.id}: combustível desconhecido: {fuel_id}")
        for item in self.items["districts"].values():
            if item.unlock and item.unlock not in self.items["technologies"]:
                errors.append(f"{item.id}: technology unlock desconhecida: {item.unlock}")
        for item in self.items["ships"].values():
            for propulsion_id in item.compatible_propulsion:
                if propulsion_id not in self.items["propulsion"]:
                    errors.append(f"{item.id}: propulsão desconhecida: {propulsion_id}")
        errors.extend(self._technology_cycles())
        return errors

    def _technology_cycles(self) -> list[str]:
        graph = {key: [ref for ref in value.requires if ref in self.items["technologies"]] for key, value in self.items["technologies"].items()}
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
            for dependency in graph[node]:
                visit(dependency)
            visiting.remove(node)
            visited.add(node)

        for node in graph:
            visit(node)
        return errors

    def get(self, kind: Literal["resources", "fuels", "propulsion", "technologies", "districts", "ships"], item_id: str) -> Content:
        try:
            return self.items[kind][item_id]
        except KeyError as exc:
            raise DataValidationError(f"{kind}: conteúdo inexistente: {item_id}") from exc

    def has(self, item_id: str) -> bool:
        return item_id in self.sources
