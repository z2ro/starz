import * as THREE from 'three';
import { appendHull, type HullSection } from './HullGenerator';
import { assembleShip } from './ShipAssembly';
import { roundEngine, shipBuilders } from './NavalDetails';

/** Experimental freighter: cargo volume and an exposed load-bearing spine. */
export function createWayfarerShip() {
  const b = shipBuilders();
  const section = (z: number, width: number, height: number, y = 0): HullSection => ({ z, width, height, y, bevel: 0.22 });
  appendHull(b.hull, [section(-8.8, 1.5, 1.1), section(-7.8, 3.1, 2.1), section(-6.2, 3.7, 2.5), section(-4.8, 3.4, 2.4), section(-4.3, 1.7, 1.25), section(6.9, 1.7, 1.25), section(8, 2.9, 1.7)], '#4a6275');
  // A raised forward command block, industrial rather than an aircraft canopy.
  appendHull(b.hull, [section(-7.1, 1.15, 0.5, 1.04), section(-6.35, 1.7, 0.65, 1.4), section(-5.1, 1.7, 0.65, 1.4), section(-4.8, 1.1, 0.3, 1.2)], '#5c7689');
  b.windows.quad([-0.48, 1.39, -6.96], [-0.57, 1.51, -6.75], [0.57, 1.51, -6.75], [0.48, 1.39, -6.96], '#8bc5d3');
  b.details.beam([0, 1.4, -6.96], [0, 1.52, -6.75], 0.035, '#203748');
  b.armor.taperedBox([0, 1.77, -5.65], [1.8, 0.15, 1.4], 1.5, 1.1, '#a0b1ba');
  b.details.beam([0, 1.8, -5.6], [0, 2.45, -5.5], 0.045, '#a7b7bf');
  b.details.box([0, 2.25, -5.5], [0.5, 0.08, 0.12], '#738e9f');
  // Eight sealed cargo units. They intersect the spine/supports, with chamfered corners.
  for (const side of [-1, 1]) {
    for (let bay = 0; bay < 4; bay++) {
      const z = -3.05 + bay * 2.5, x = side * 1.72;
      b.hull.beam([side * 0.55, -0.2, z], [side * 2.35, -0.2, z], 0.3, '#263b4a');
      b.armor.push(new THREE.Matrix4().makeTranslation(x, 0, 0));
      appendHull(b.armor, [section(z - 1.08, 1.55, 2.3, -0.1), section(z - 0.9, 1.82, 2.55, -0.1), section(z + 0.9, 1.82, 2.55, -0.1), section(z + 1.08, 1.55, 2.3, -0.1)], bay % 2 ? '#71848c' : '#81949c');
      b.armor.pop();
      b.details.box([side * 2.64, -0.08, z], [0.035, 1.76, 1.57], '#405663');
      for (const dz of [-0.67, 0, 0.67]) b.details.box([side * 2.67, -0.08, z + dz], [0.06, 1.85, 0.055], '#acb9bc');
      b.details.box([side * 2.69, -0.9, z], [0.045, 0.12, 1.1], '#263e4c');
      b.lights.box([side * 2.72, -0.9, z + 0.36], [0.018, 0.055, 0.18], '#dbcf9d');
      b.details.box([x, 1.2, z], [1.2, 0.06, 1.45], '#485f6c');
      b.details.box([x, 1.24, z - 0.6], [0.75, 0.035, 0.1], '#b4a373');
    }
    // Continuous girders join the repeated bulkheads and engine pylons.
    for (const y of [-1.5, 1.38]) b.hull.beam([side * 2.55, y, -4.3], [side * 2.55, y, 6.3], 0.18, '#455f70');
    for (let frame = 0; frame < 5; frame++) {
      const z = -4.3 + frame * 2.5;
      b.hull.beam([side * 2.55, -1.5, z], [side * 2.55, 1.38, z], 0.18, '#8a9da6');
      b.hull.beam([0, 0.5, z], [side * 2.55, 1.38, z], 0.18, '#455e70');
      b.hull.beam([0, -0.5, z], [side * 2.55, -1.5, z], 0.18, '#455e70');
    }
    // Utility docking modules are attached to the broad forward hull.
    b.hull.taperedBox([side * 1.8, -0.35, -5.5], [1.1, 1.1, 1.6], 0.85, 1.3, '#3a5265');
    b.details.box([side * 2.35, -0.35, -5.5], [0.06, 0.55, 0.7], '#a5b2b9');
    b.lights.box([side * 2.39, -0.1, -5.5], [0.025, 0.06, 0.35], '#c6e0e5');
    b.hull.push(new THREE.Matrix4().makeTranslation(side * 1.65, 0, 0));
    appendHull(b.hull, [section(5.85, 1.1, 1.6), section(6.6, 2, 3.3), section(8.35, 2, 3.3)], '#3d5668');
    b.hull.pop();
    for (const y of [-0.88, 0.88]) roundEngine(b, side * 1.65, y, 8.65, 0.74);
    b.armor.taperedBox([side * 1.65, 1.7, 7.5], [1.85, 0.14, 1.7], 1.65, 1.5, '#91a4ad');
    for (let i = 0; i < 5; i++) b.details.box([side * 1.65, 1.78, 6.95 + i * 0.23], [1.2, 0.03, 0.07], '#263b49');
  }
  b.hull.beam([-2.5, -0.7, 6.35], [2.5, -0.7, 6.35], 0.35, '#4f697c');
  for (const side of [-1, 1]) {
    b.armor.beam([side * 0.8, 0.65, -8.05], [side * 1.6, 1.12, -6.8], 0.1, '#a5b6bf');
    b.armor.taperedBox([side * 0.8, 1.14, -6.7], [0.65, 0.12, 1.15], 0.52, 0.95, '#8197a4');
    b.details.box([side * 1.65, -0.35, -7.2], [0.04, 0.3, 0.65], '#253e50');
    b.lights.box([side * 1.69, -0.32, -7.2], [0.025, 0.06, 0.45], '#bacdd2');
    for (let i = 0; i < 4; i++) b.details.box([side * 1.77, 0.35, -6.3 + i * 0.26], [0.04, 0.35, 0.09], '#263c4b');
  }
  return assembleShip(b, 'Wayfarer Prototype — Freighter');
}
