from __future__ import annotations

from dataclasses import asdict, dataclass
import hashlib
import math


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


def generate_system(seed: str, x: int, y: int) -> StarSystem:
    u = lambda key: _unit(seed, x, y, key)
    classes = ["K", "G", "F", "M"]
    stellar_class = classes[int(u("class") * len(classes))]
    mass = round(0.65 + u("mass") * 1.2, 2)
    luminosity = round(0.45 + mass**3 * (0.6 + u("luminosity") * 0.5), 2)
    activity = round(0.15 + u("activity") * 0.7, 2)
    star = Star(stellar_class, mass, luminosity, round(1 + u("age") * 9, 2), activity)
    orbital_distance = round(0.75 + u("orbit") * 1.4, 2)
    gravity = round(0.65 + u("gravity") * 1.0, 2)
    temperature = round(185 + 90 * luminosity / orbital_distance, 1)
    planet = Planet(
        id=f"planet-{x}-{y}",
        name=f"{chr(65 + int(u('name') * 26))}{100 + int(u('name2') * 900)}-{abs(x) + abs(y)}",
        mass=round(0.6 + u("pmass") * 2.3, 2),
        radius=round(0.75 + u("radius") * 0.6, 2),
        gravity=gravity,
        orbital_distance=orbital_distance,
        temperature=temperature,
        atmosphere=["thin nitrogen", "temperate nitrogen", "dense methane"][int(u("atmosphere") * 3)],
        radiation=round(activity * (1.2 - min(0.7, u("shield") * 0.7)), 2),
        magnetic_field=round(0.3 + u("magnetic") * 1.4, 2),
        water=round(20 + u("water") * 70, 1),
        geological_activity=round(u("geo"), 2),
        mineral_profile={"raw_ore": round(0.8 + u("ore") * 0.7, 2), "volatiles": round(0.6 + u("volatile") * 0.8, 2)},
        usable_surface=round(45 + u("surface") * 50, 1),
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
    access = min(1.0, (p.mineral_profile["raw_ore"] + p.mineral_profile["volatiles"]) / 2.6)
    energy = min(1.0, system.star.luminosity / 1.6) * (0.8 + p.magnetic_field / 5)
    population = min(1.0, p.usable_surface / 75) * min(1.0, 1.2 / p.gravity)
    industry = access * (0.75 + p.usable_surface / 400)
    score = round(0.35 * access + 0.25 * energy + 0.2 * population + 0.2 * industry, 3)
    return ViabilityReport(score, score >= 0.56, access, energy, population, industry, round(20 / max(score, 0.2), 1), round(80 / max(score, 0.2), 1))


def find_spawn_system(seed: str) -> tuple[StarSystem, ViabilityReport]:
    # ponytail: bounded candidate scan; reserved spawn allocation can replace this when clusters exist.
    candidates = [generate_system(seed, x, y) for radius in range(3) for x in range(-radius, radius + 1) for y in range(-radius, radius + 1) if abs(x) + abs(y) == radius]
    ranked = sorted(((evaluate_viability(system), system) for system in candidates), key=lambda pair: (-pair[0].viable, -pair[0].score, abs(pair[1].x) + abs(pair[1].y)))
    report, system = ranked[0]
    return system, report
