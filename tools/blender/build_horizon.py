from __future__ import annotations

import math
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent))
from export_common import MODEL_DIR, clear_scene, cone, cube, cylinder, export_glb, make_material, sphere


def build() -> None:
    clear_scene()
    gunmetal = make_material("Horizon | gunmetal", (0.12, 0.16, 0.19, 1), 0.78, 0.42)
    light_metal = make_material("Horizon | structural alloy", (0.34, 0.41, 0.45, 1), 0.72, 0.36)
    dark = make_material("Horizon | recess", (0.025, 0.04, 0.05, 1), 0.6, 0.5)
    glass = make_material("Horizon | sensor glass", (0.04, 0.16, 0.21, 1), 0.25, 0.2,
                          (0.03, 0.35, 0.52, 1), 2.1)
    engine = make_material("Horizon | engine emissive", (0.03, 0.11, 0.15, 1), 0.25, 0.25,
                           (0.06, 0.45, 0.8, 1), 4.0)

    # +Z is the forward direction. The origin stays at the visual center of mass.
    cube("horizon_body", (0, 0, 0), (0.28, 0.17, 0.58), gunmetal, 0.035)
    cone("horizon_prow", (0, 0, 0.38), 0.13, 0.035, 0.28, light_metal, 6)
    cube("horizon_keel", (0, -0.095, -0.04), (0.17, 0.04, 0.62), dark, 0.012)
    cube("horizon_dorsal_spine", (0, 0.11, -0.03), (0.09, 0.045, 0.48), light_metal, 0.012)
    sphere("horizon_sensor_dome", (0, 0.155, 0.19), (0.065, 0.035, 0.09), glass, 16, 8)
    cylinder("horizon_sensor_mast", (0, 0.205, -0.02), 0.012, 0.13, light_metal, 8)
    sphere("horizon_forward_sensor", (0, 0.02, 0.53), (0.035, 0.025, 0.018), glass, 12, 6)

    for side in (-1, 1):
        x = side * 0.205
        cube("horizon_service_pod", (x, 0, -0.03), (0.17, 0.08, 0.28), light_metal, 0.018,
             rotation=(0, side * math.radians(8), 0))
        cube("horizon_lateral_sensor", (side * 0.24, 0.075, 0.16), (0.055, 0.025, 0.16), dark, 0.01,
             rotation=(0, side * math.radians(18), 0))
        sphere("horizon_window", (side * 0.105, 0.085, 0.23), (0.03, 0.012, 0.045), glass, 10, 6)
        cylinder("horizon_engine_housing", (side * 0.095, 0, -0.39), 0.065, 0.16, dark, 12)
        cone("horizon_engine_nozzle", (side * 0.095, 0, -0.5), 0.052, 0.03, 0.08, light_metal, 12)
        cylinder("horizon_engine_core", (side * 0.095, 0, -0.548), 0.026, 0.012, engine, 12)

    cube("horizon_docking_spine", (0, -0.02, -0.28), (0.38, 0.035, 0.08), dark, 0.012)
    antenna = cylinder("horizon_antenna", (0.035, 0.265, 0.02), 0.008, 0.18, light_metal, 8)
    antenna.rotation_euler[1] = math.radians(-12)
    sphere("horizon_antenna_tip", (0.055, 0.35, 0.02), (0.018, 0.018, 0.018), glass, 10, 6)

    export_glb(MODEL_DIR / "horizon.glb")


if __name__ == "__main__":
    build()
