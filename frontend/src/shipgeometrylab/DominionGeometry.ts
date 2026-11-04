import * as THREE from 'three';
import { appendHull } from './HullGenerator';
import { assembleShip } from './ShipAssembly';
import { shipBuilders, boxEngine } from './NavalDetails';
import { section as s, platedHull, battery, vents } from './FleetPrimitives';

export function createDominionShip() {
  const b = shipBuilders();
  platedHull(b, [s(-4.4, 4.8, 2.2), s(-0.4, 7.5, 3.4), s(3.8, 7.3, 3.5), s(6.3, 5.5, 2.5)]);
  // Fortress keystone extends below as well as above the hull, unlike Leviathan's long belts.
  appendHull(b.hull, [s(-3.5, 3.4, 1.4, -1), s(-0.5, 4.8, 2.5, -1.3), s(4.2, 4.2, 2.1, -1.3), s(5.8, 2.2, 1.3, -0.8)], '#304b60');
  for (let tier = 0; tier < 5; tier++) {
    const radius = 3.45 - tier * 0.56, y = 1.65 + tier * 0.69;
    if (tier < 2) {
      const m = new THREE.Matrix4().makeTranslation(0, y, 1.3).multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
      for (const key of ['hull', 'armor', 'windows'] as const) b[key].push(m);
      b.hull.cylinder([0, 0, 0], radius, 0.74, '#435f76', radius * 0.88, 8);
      b.armor.cylinder([0, 0, 0.39], radius * 1.03, 0.12, '#91a7b7', radius, 8);
      b.windows.cylinder([0, 0, 0.2], radius * 0.96, 0.045, '#91c2cf', radius * 0.96, 8, false);
      b.hull.pop(); b.armor.pop(); b.windows.pop();
    } else {
      b.hull.taperedBox([0, y, 1.3], [radius * 1.8, 0.76, radius * 2.4], radius * 1.55, radius * 2, '#435f76');
      b.armor.taperedBox([0, y + 0.39, 1.3], [radius * 1.86, 0.12, radius * 2.4], radius * 1.75, radius * 2.2, '#91a7b7');
      const lowZ = 1.3 - radius * 1.0684 - 0.012, highZ = 1.3 - radius * 1.0368 - 0.012;
      b.windows.quad([-radius * 0.55, y + 0.12, lowZ], [-radius * 0.55, y + 0.24, highZ], [radius * 0.55, y + 0.24, highZ], [radius * 0.55, y + 0.12, lowZ], '#91c2cf');
    }
  }
  for (const side of [-1, 1]) {
    b.hull.push(new THREE.Matrix4().makeTranslation(side * 1.3, 0, 0));
    appendHull(b.hull, [s(-10.4, 0.75, 1.2), s(-8.3, 1.35, 1.9), s(-4.2, 1.65, 2.1)], '#506b7e'); b.hull.pop();
    b.hull.push(new THREE.Matrix4().makeTranslation(side * 3.65, 0, 0));
    appendHull(b.hull, [s(-4.4, 0.3, 0.6), s(-1.7, 3.2, 2.1), s(2.8, 3.3, 2.3), s(5.5, 0.9, 1.5)], '#415e75'); b.hull.pop();
    for (const z of [-1.5, 2.2]) {
      b.armor.taperedBox([side * 3.95, 1.22, z], [2.5, 0.35, 2.7], 2.1, 2.4, '#8099ac');
      battery(b, side * 3.95, 1.5, z, 1.2);
      b.lights.box([side * 5.31, -0.15, z], [0.035, 0.08, 1.1], '#c6d6d8');
    }
    // Paired fortified fore rails and lower artillery galleries.
    b.armor.beam([side * 0.75, 0.7, -9.2], [side * 1.6, 1.3, -2.8], 0.36, '#8fa6b8');
    battery(b, side * 1.2, 0.83, -6.6, 1.05);
    for (const y of [-0.95, 0.95]) {
      const m = new THREE.Matrix4().compose(new THREE.Vector3(side * 2.5, y, 7.2), new THREE.Quaternion(), new THREE.Vector3().setScalar(1.6));
      for (const key of ['engines', 'nozzles', 'emission'] as const) b[key].push(m);
      boxEngine(b, 0, 0, 0); b.engines.pop(); b.nozzles.pop(); b.emission.pop();
    }
    vents(b, side * 2.5, 1.85, 4.7, 1);
    b.details.beam([side * 0.45, 4.9, 1.3], [side * 0.45, 5.9, 1.4], 0.06, '#a1b5bf');
    b.hull.taperedBox([side * 2.7, 1.9, 1.3], [0.6, 1.65, 0.9], 0.4, 0.65, '#526d80');
  }
  b.details.box([0, 5.1, 1.4], [1.3, 0.1, 0.25], '#7899ae');
  return assembleShip(b, 'Dominion Prototype — Dreadnought');
}
