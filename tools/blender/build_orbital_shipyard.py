from __future__ import annotations

import math
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent))
from export_common import MODEL_DIR, clear_scene, cone, cube, cylinder, export_glb, make_material, sphere, torus


def build() -> None:
    clear_scene()
    gunmetal = make_material("Shipyard | gunmetal", (0.09, 0.13, 0.16, 1), 0.82, 0.4)
    steel = make_material("Shipyard | steel", (0.28, 0.36, 0.4, 1), 0.76, 0.34)
    dark = make_material("Shipyard | shadow structure", (0.025, 0.045, 0.06, 1), 0.66, 0.46)
    blue_light = make_material("Shipyard | docking lights", (0.03, 0.11, 0.15, 1), 0.25, 0.25,
                               (0.04, 0.42, 0.62, 1), 3.2)
    amber = make_material("Shipyard | construction indicators", (0.18, 0.1, 0.035, 1), 0.2, 0.3,
                          (0.9, 0.22, 0.03, 1), 1.8)

    # The station uses the same +Z-forward convention as the ship, with its origin at the hub.
    cylinder("shipyard_core", (0, 0, 0), 0.48, 0.46, gunmetal, 24, rotation=(math.pi / 2, 0, 0))
    torus("shipyard_construction_ring", (0, 0, 0), 1.65, 0.075, steel, rotation=(math.pi / 2, 0, 0), major_segments=48)
    torus("shipyard_service_ring", (0, 0, 0), 1.16, 0.045, dark, rotation=(math.pi / 2, 0, 0), major_segments=40)
    cube("shipyard_main_spine", (0, 0, 0), (0.36, 0.36, 3.6), steel, 0.05)
    cube("shipyard_lower_spine", (0, -0.55, 0), (0.22, 0.2, 3.0), dark, 0.03)

    # Parallel gantry rails communicate construction capacity without making a closed ring.
    for x in (-0.52, 0.52):
        cube("shipyard_gantry_rail", (x, 0.38, 0), (0.12, 0.12, 3.25), steel, 0.025)
        for z in (-1.25, -0.42, 0.42, 1.25):
            cube("shipyard_gantry_brace", (x, 0.38, z), (1.1, 0.08, 0.08), dark, 0.018)

    for angle in (0, math.pi / 2, math.pi, math.pi * 1.5):
        x, z = math.cos(angle) * 1.28, math.sin(angle) * 1.28
        arm = cube("shipyard_docking_arm", (x, 0, z), (0.18, 0.2, 1.0), steel, 0.025,
                   rotation=(0, -angle, 0))
        arm.rotation_euler[1] = -angle
        cube("shipyard_docking_clamp", (math.cos(angle) * 1.82, 0, math.sin(angle) * 1.82),
             (0.35, 0.25, 0.22), gunmetal, 0.03, rotation=(0, -angle, 0))

    # Uneven service modules keep the silhouette industrial rather than perfectly radial.
    modules = [(-1.05, 0.3, 0.5), (1.04, -0.25, 0.44), (-0.68, -0.58, 0.36), (0.62, 0.58, 0.4)]
    for index, (x, y, scale) in enumerate(modules):
        cube(f"shipyard_service_module_{index}", (x, y, 0), (0.42 * scale, 0.58 * scale, 0.72 * scale), gunmetal, 0.035)
        cylinder(f"shipyard_radiator_{index}", (x, y - 0.35 * scale, 0), 0.16 * scale, 0.08, steel, 12,
                 rotation=(math.pi / 2, 0, 0))

    for z in (-1.35, -0.45, 0.45, 1.35):
        sphere("shipyard_docking_light", (0, 0.18, z), (0.055, 0.035, 0.055), blue_light, 10, 6)
    for x in (-0.72, 0.72):
        sphere("shipyard_construction_light", (x, 0.53, 0.0), (0.045, 0.03, 0.045), amber, 10, 6)

    antenna = cylinder("shipyard_sensor_mast", (0.85, 0.82, 0), 0.025, 0.8, steel, 10)
    antenna.rotation_euler[2] = math.radians(-14)
    cone("shipyard_sensor_dish", (0.95, 1.2, 0), 0.18, 0.04, 0.16, dark, 16, rotation=(0, math.pi / 2, 0))
    cube("shipyard_service_bridge", (0, 0.62, 0), (1.7, 0.08, 0.12), steel, 0.02)
    cube("shipyard_service_bridge_low", (0, -0.62, 0), (1.35, 0.08, 0.1), dark, 0.02)

    export_glb(MODEL_DIR / "orbital_shipyard.glb")


if __name__ == "__main__":
    build()
