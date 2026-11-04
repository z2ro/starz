import * as THREE from 'three';
import { appendHull } from './HullGenerator';
import { assembleShip } from './ShipAssembly';
import { shipBuilders } from './NavalDetails';
import { section as s, platedHull, battery, drive, vents } from './FleetPrimitives';

/** Current named-hull concept revision: dominant spear bow, low command, six aft drives. */
export function createSpearheadShip() {
  const b = shipBuilders();
  platedHull(b, [s(-10.7, 0.14, 0.18), s(-8.4, 0.8, 0.5), s(-5.7, 1.9, 1.05), s(-2.3, 3.3, 1.7), s(0.8, 4.5, 2.1), s(4.1, 4.8, 2.15), s(6.7, 4.2, 1.9)]);
  appendHull(b.hull, [s(-7.5, 0.5, 0.3, -0.22), s(-2.8, 1.2, 0.75, -0.55), s(5.7, 2, 0.8, -0.65)], '#2b465a');
  b.hull.taperedBox([0, 1.28, 2.3], [1.5, 0.65, 2.8], 1.1, 2.3, '#456277');
  b.windows.box([0, 1.52, 0.91], [0.9, 0.07, 0.04], '#91c7d8');
  for (const side of [-1, 1]) {
    // Recessed forward weapon rails hug the reinforced lance, not a tower of turrets.
    b.details.beam([side * 0.72, 0.33, -6.5], [side * 1.32, 0.64, -1.8], 0.15, '#233b50');
    b.armor.beam([side * 0.88, 0.35, -5.5], [side * 1.5, 0.7, -1.6], 0.1, '#9bafbc');
    b.hull.push(new THREE.Matrix4().makeTranslation(side * 2.2, 0, 0));
    appendHull(b.hull, [s(0.2, 0.25, 0.5), s(3.8, 1.6, 1.9), s(6.7, 1.3, 1.85)], '#405c72'); b.hull.pop();
    b.hull.push(new THREE.Matrix4().makeTranslation(side * 2.25, 0, 0));
    appendHull(b.hull, [s(3.9, 0.12, 0.2, 0.85), s(5.5, 0.2, 1.4, 1.25), s(6.3, 0.2, 0.8, 1.15)], '#7a94a5'); b.hull.pop();
    b.armor.beam([side * 1.65, 0.7, 2.4], [side * 3.3, 0.45, 6.2], 0.22, '#8ca3b3');
    for (const y of [-0.65, 0.65]) drive(b, side * 1.75, y, 7, 1.05);
    vents(b, side * 2.1, 0.98, 4.4, 0.65);
    battery(b, side * 1.2, 0.84, -0.7, 0.7);
    b.lights.box([side * 2.9, -0.15, 5.3], [0.04, 0.07, 0.6], '#b1d4de');
  }
  for (const y of [-0.67, 0.67]) drive(b, 0, y, 7.1, 1.05);
  return assembleShip(b, 'Spearhead Prototype — Battlecruiser');
}
