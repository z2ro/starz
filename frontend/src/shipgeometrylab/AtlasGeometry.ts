import { appendHull } from './HullGenerator';
import { assembleShip } from './ShipAssembly';
import { shipBuilders } from './NavalDetails';
import { section as s, platedHull, bridge, drive, vents } from './FleetPrimitives';

export function createAtlasShip() {
  const b = shipBuilders();
  platedHull(b, [s(-10.3, 0.7, 0.5), s(-8.2, 2.8, 1.1), s(-5.9, 2.4, 1.65), s(-4.5, 1.4, 1.8), s(5.3, 1.4, 1.9), s(7.4, 4.7, 2.25)]);
  // Two actual open hangar galleries: roofs, floors, inner walls, ribs. No painted doors.
  for (const side of [-1, 1]) {
    const x = side * 2.65;
    b.hull.box([x, 1.16, 0], [2.6, 0.32, 13], '#4b667c');
    b.hull.box([x, -1.13, 0], [2.6, 0.32, 13], '#3d566a');
    b.hull.box([side * 1.44, 0, 0], [0.22, 2.1, 13], '#263e51');
    for (const y of [-1.15, 1.18]) b.hull.beam([side * 3.87, y, -6.6], [side * 3.87, y, 6.6], 0.22, '#99acb8');
    for (const z of [-6.4, -2.25, 2.25, 6.4]) {
      b.hull.beam([side * 3.87, -1.15, z], [side * 3.87, 1.18, z], 0.22, '#8fa5b5');
      b.hull.beam([side * 1.44, 1.18, z], [side * 3.87, 1.18, z], 0.22, '#7f98a9');
      b.armor.taperedBox([x, 1.38, z], [2.6, 0.17, 0.55], 2.4, 0.4, '#94a9b7');
      b.hull.box([side * 3.78, 0, z], [0.38, 2.1, 0.85], '#506a7f');
      b.armor.box([side * 4, 0, z], [0.12, 1.8, 0.6], '#8fa4b2');
    }
    for (const z of [-4.4, 0, 4.4]) {
      b.details.box([side * 1.58, -0.05, z], [0.035, 1.2, 2.5], '#142a3c');
      // Operational strips illuminate the recess itself, with no real point lights.
      b.lights.box([side * 1.64, 0.62, z], [0.025, 0.06, 2.6], '#d7cfaa');
      b.lights.box([side * 3.6, 0.95, z], [0.04, 0.055, 2.2], '#d7cfaa');
      b.armor.taperedBox([x, 1.41, z], [2.2, 0.28, 2.7], 1.85, 2.4, '#678295');
      vents(b, x, 1.58, z - 0.4, 1.3);
    }
    b.details.box([x, -0.95, 0], [0.075, 0.035, 12.5], '#a9b6b9');
    b.lights.box([x, -0.94, -5.2], [0.055, 0.035, 1.8], '#93c3d0');
    for (const y of [-0.68, 0.68]) drive(b, side * 2.1, y, 7.6, 1.15);
    b.hull.beam([0, -0.5, 5.8], [side * 2.1, -0.5, 6.6], 0.65, '#3c566c');
  }
  bridge(b, 4.2, 1.55, 1.25, 1.2);
  bridge(b, 4.4, 2.4, 0.9, 0.6);
  return assembleShip(b, 'Atlas Prototype — Carrier');
}
