from __future__ import annotations

from dataclasses import asdict, dataclass
import hashlib
from .data import Catalog, DataValidationError


def _unit(seed: str, *parts: object) -> float:
    digest = hashlib.sha256(":".join(map(str, (seed, *parts))).encode()).digest()
    return int.from_bytes(digest[:8], "big") / 2**64


@dataclass(frozen=True)
class Star:
    stellar_class: str
    mass: float
    luminosity: float
    age: float
    activity: float


@dataclass(frozen=True)
class Planet:
    id: str
    name: str
    mass: float
    radius: float
    gravity: float
    orbital_distance: float
    temperature: float
    atmosphere: str
    radiation: float
    magnetic_field: float
    water: float
    geological_activity: float
    mineral_profile: dict[str, float]
    usable_surface: float


@dataclass(frozen=True)
class StarSystem:
    id: str
    name: str
    x: int
    y: int
    star: Star
    planet: Planet

    def to_dict(self) -> dict:
        return asdict(self)


def _choose(items, value: float):
    ordered = sorted(items, key=lambda item: item.id)
    if not ordered:
        raise DataValidationError('nenhum arquétipo compatível')
    target = value * sum(item.weight for item in ordered)
    for item in ordered:
        target -= item.weight
        if target < 0:
            return item
    return ordered[-1]  # Floating-point rounding at the upper endpoint.


def generate_system(seed: str, x: int, y: int, catalog: Catalog) -> StarSystem:
    def u(key):
        return _unit(seed, x, y, key)

    def sample(limits, key):
        return limits[0] + u(key) * (limits[1] - limits[0])
    stellar = _choose(catalog.items['stars'].values(), u('class'))
    archetype = _choose([p for p in catalog.items['planets'].values() if stellar.id in p.star_archetypes], u('planet_class'))
    mass = sample(stellar.mass_range, 'mass')
    luminosity = stellar.luminosity_offset + mass**3 * sample(stellar.luminosity_scale_range, 'luminosity')
    activity = sample(stellar.activity_range, 'activity')
    star = Star(stellar.stellar_class, mass, luminosity, sample(stellar.age_range, 'age'), activity)
    orbital_distance = sample(archetype.orbital_distance_range, 'orbit')
    gravity = sample(archetype.gravity_range, 'gravity')
    temperature = archetype.temperature_base + archetype.temperature_scale * luminosity / orbital_distance
    atmospheres = sorted(archetype.atmosphere_profiles)
    planet = Planet(
        id=f"planet-{x}-{y}",
        name=f"{chr(65 + int(u('name') * 26))}{100 + int(u('name2') * 900)}-{abs(x) + abs(y)}",
        mass=sample(archetype.mass_range, 'pmass'),
        radius=sample(archetype.radius_range, 'radius'),
        gravity=gravity,
        orbital_distance=orbital_distance,
        temperature=temperature,
        atmosphere=atmospheres[int(u('atmosphere') * len(atmospheres))],
        radiation=activity * sample(archetype.radiation_range, 'shield'),
        magnetic_field=sample(archetype.magnetic_field_range, 'magnetic'),
        water=sample(archetype.water_range, 'water'),
        geological_activity=sample(archetype.geological_activity_range, 'geo'),
        mineral_profile={key: sample(limits, f'mineral:{key}') for key, limits in sorted(archetype.mineral_profile.items())},
        usable_surface=sample(archetype.usable_surface_range, 'surface'),
    )
    return StarSystem(f"system-{x}-{y}", f"Asterion {x:+d}:{y:+d}", x, y, star, planet)


@dataclass(frozen=True)
class ViabilityReport:
    score: float
    viable: bool
    access_to_basics: float
    energy: float
    population: float
    industry: float
    first_ship_minutes: float
    first_expansion_minutes: float


def evaluate_viability(system: StarSystem) -> ViabilityReport:
    p = system.planet
    access = min(1.0, (p.mineral_profile.get("raw_ore", 0) + p.mineral_profile.get("volatiles", 0)) / 2.6)
    energy = min(1.0, system.star.luminosity / 1.6) * (0.8 + p.magnetic_field / 5)
    population = min(1.0, p.usable_surface / 75) * min(1.0, 1.2 / p.gravity)
    industry = access * (0.75 + p.usable_surface / 400)
    score = round(0.35 * access + 0.25 * energy + 0.2 * population + 0.2 * industry, 3)
    return ViabilityReport(score, score >= 0.56, access, energy, population, industry, round(20 / max(score, 0.2), 1), round(80 / max(score, 0.2), 1))


def find_spawn_system(seed: str, catalog: Catalog) -> tuple[StarSystem, ViabilityReport]:
    # ponytail: bounded candidate scan; reserved spawn allocation can replace this when clusters exist.
    candidates = [generate_system(seed, x, y, catalog) for radius in range(3) for x in range(-radius, radius + 1) for y in range(-radius, radius + 1) if abs(x) + abs(y) == radius]
    ranked = sorted(((evaluate_viability(system), system) for system in candidates), key=lambda pair: (-pair[0].viable, -pair[0].score, abs(pair[1].x) + abs(pair[1].y)))
    report, system = ranked[0]
    return system, report
