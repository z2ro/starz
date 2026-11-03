import * as THREE from 'three';
import { appendHull } from './HullGenerator';
import { assembleShip } from './ShipAssembly';
import { shipBuilders } from './NavalDetails';
import { section as s, platedHull, battery, bridge, drive, vents } from './FleetPrimitives';

export function createSentinelShip() {
  const b = shipBuilders();
  platedHull(b, [s(-7.8, 1.6, 1.05), s(-6.2, 3.3, 1.9), s(-3, 4.3, 2.3), s(0, 4.6, 2.6), s(3.8, 4.4, 2.6), s(6.2, 3.7, 2.2)]);
  // Broad defensive shoulders flank a recessed command/sensor spine.
  for (const side of [-1, 1]) {
    b.hull.push(new THREE.Matrix4().makeTranslation(side * 2.15, 0, 0));
    appendHull(b.hull, [s(-3.9, 0.45, 1.2, -0.1), s(-2.2, 1.9, 2.3), s(2.9, 1.9, 2.5), s(5.5, 1.2, 1.8)], '#435d71'); b.hull.pop();
    for (const z of [-1.9, 0.25, 2.4]) {
      b.armor.taperedBox([side * 2.24, 1.28, z], [1.8, 0.25, 1.7], 1.48, 1.5, '#9aabb6');
      b.armor.box([side * 3.11, 0, z], [0.18, 1.8, 1.55], '#7890a0');
      b.details.box([side * 3.22, 0, z], [0.045, 0.16, 1.1], '#263f51');
    }
    battery(b, side * 2.15, 1.48, 1, 0.85);
    b.lights.box([side * 3.23, -0.3, 1.6], [0.035, 0.07, 0.6], '#b9d4d9');
    vents(b, side * 1.25, 1.38, 3.6, 0.8);
    for (const y of [-0.64, 0.64]) drive(b, side * 1.15, y, 6.5, 1.05);
  }
  bridge(b, 0.7, 1.55, 1.65, 0.7);
  b.hull.taperedBox([0, 1.15, -3.9], [1.7, 0.45, 1.7], 1.35, 1.35, '#3c576c');
  b.details.box([0, 1.39, -4.7], [0.75, 0.18, 0.06], '#172e40');
  b.windows.box([0, 1.4, -4.74], [0.48, 0.08, 0.025], '#7bb8cc');
  battery(b, 0, 1.05, -5.3, 0.85);
  return assembleShip(b, 'Sentinel Prototype — Destroyer');
}
