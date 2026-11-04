import * as THREE from 'three';
import { appendHull } from './HullGenerator';
import { assembleShip } from './ShipAssembly';
import { shipBuilders } from './NavalDetails';
import { section as s, platedHull, battery, bridge, drive, vents } from './FleetPrimitives';

export function createLeviathanShip() {
  const b = shipBuilders();
  platedHull(b, [s(-11, 1.25, 1), s(-9, 3.5, 2.1), s(-6, 4.6, 2.8), s(-2.5, 5.2, 3.25), s(1, 5.6, 3.6), s(4.6, 5.6, 3.5), s(7.8, 4.9, 2.9)]);
  // Deep armored bilges and repeated broadside belts carry the mass of a battleship.
  appendHull(b.hull, [s(-8.6, 1.9, 0.8, -0.75), s(-4.6, 3.7, 1.55, -1.15), s(4.6, 3.8, 1.7, -1.25), s(7.7, 2.9, 1.2, -0.9)], '#2e465a');
  for (const side of [-1, 1]) {
    b.hull.push(new THREE.Matrix4().makeTranslation(side * 2.3, 0, 0));
    appendHull(b.hull, [s(-5, 0.5, 1.2), s(-2.5, 1.8, 2.7), s(4.9, 1.9, 2.8), s(7.6, 1.1, 2.1)], '#40596e'); b.hull.pop();
    for (const z of [-2.6, 0.35, 3.3, 6.1]) {
      b.armor.taperedBox([side * 2.5, 1.48, z], [1.7, 0.3, 2.25], 1.45, 2, '#9aabb6');
      b.armor.box([side * 3.3, -0.2, z], [0.23, 2.2, 2], '#7e94a4');
      b.details.box([side * 3.43, -0.25, z], [0.035, 0.18, 1.6], '#233c50');
      b.lights.box([side * 3.46, -0.4, z], [0.025, 0.06, 0.6], '#bbd3d9');
    }
    for (const z of [-1.4, 2.6, 5.6]) {
      b.hull.push(new THREE.Matrix4().makeTranslation(side * 3.3, 0, 0));
      appendHull(b.hull, [s(z - 1.3, 0.4, 1.1, 0.2), s(z - 0.75, 2.4, 1.6, 0.2), s(z + 0.75, 2.4, 1.6, 0.2), s(z + 1.25, 0.4, 1.1, 0.2)], '#4b667b'); b.hull.pop();
      b.armor.taperedBox([side * 3.4, 1.1, z], [2.3, 0.18, 1.9], 2.1, 1.7, '#8da5b6');
      battery(b, side * 3.5, 1.25, z, 1.15);
    }
    for (const y of [-0.88, 0.88]) drive(b, side * 1.7, y, 8.45, 1.4);
    vents(b, side * 1.2, 1.85, 4.6, 0.85);
  }
  for (const [z, y] of [[-7.3, 1.03], [-4.2, 1.48], [-0.8, 1.76]]) battery(b, 0, y, z, 1.4);
  for (const y of [-0.9, 0.9]) drive(b, 0, y, 8.55, 1.2);
  bridge(b, 3.1, 2.12, 2.2, 0.9);
  bridge(b, 3.4, 2.78, 1.25, 0.5);
  return assembleShip(b, 'Leviathan Prototype — Battleship');
}
