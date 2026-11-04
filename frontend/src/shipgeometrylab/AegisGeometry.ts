import * as THREE from 'three';
import { appendHull } from './HullGenerator';
import { assembleShip } from './ShipAssembly';
import { shipBuilders } from './NavalDetails';
import { section as s, platedHull, battery, bridge, drive, vents } from './FleetPrimitives';

export function createAegisShip() {
  const b = shipBuilders();
  platedHull(b, [s(-9, 0.6, 0.65), s(-7.5, 2.4, 1.25), s(-4.7, 3.5, 1.8), s(-1.9, 4.3, 2.15), s(1.2, 4.9, 2.45), s(4.5, 4.4, 2.3), s(6.6, 3.8, 1.9)]);
  appendHull(b.hull, [s(-3.8, 1.6, 0.8, -0.7), s(-1, 2.7, 1.3, -1), s(4.7, 2.5, 1.2, -1), s(6.7, 1.4, 0.6, -0.5)], '#2f485c');
  bridge(b, 1.6, 1.7, 1.9, 1.05);
  bridge(b, 1.9, 2.43, 1.05, 0.55);
  for (const side of [-1, 1]) {
    // Balanced midship bulwarks, with independent forward and aft battery terraces.
    b.hull.push(new THREE.Matrix4().makeTranslation(side * 2, 0, 0));
    appendHull(b.hull, [s(-3.5, 0.3, 0.6), s(-1.5, 1.75, 1.6), s(2.6, 1.9, 1.9), s(5.8, 1.35, 1.5)], '#496579'); b.hull.pop();
    for (const z of [-0.85, 2.1]) {
      b.armor.taperedBox([side * 2.2, 0.95, z], [1.6, 0.22, 2.35], 1.3, 2.1, '#8da3b2');
      battery(b, side * 2.15, 1.16, z, 0.7);
    }
    b.details.box([side * 2.96, -0.3, 0.4], [0.04, 0.6, 2.6], '#243d50');
    b.windows.box([side * 2.99, -0.35, 0.4], [0.025, 0.06, 2.1], '#8bbccb');
    b.lights.box([side * 1.8, -0.3, -3.6], [0.035, 0.07, 0.35], '#bed8df');
    for (const y of [-0.65, 0.65]) drive(b, side * 1.2, y, 6.9, 1.05);
    vents(b, side * 1.25, 1.22, 4.8, 0.75);
    b.armor.beam([side * 0.75, -0.9, -5.6], [side * 1.2, -1.35, 3.3], 0.17, '#7b93a3');
  }
  battery(b, 0, 0.77, -6, 0.8); battery(b, 0, 1.08, -3.5, 1);
  return assembleShip(b, 'Aegis Prototype — Cruiser');
}
