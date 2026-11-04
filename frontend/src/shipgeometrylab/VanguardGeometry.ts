import * as THREE from 'three';
import { appendHull, sectionRing, type HullSection } from './HullGenerator';
import { assembleShip } from './ShipAssembly';
import { armorPlate, boxEngine, shipBuilders } from './NavalDetails';

/** Experimental frigate: a closed armored wedge, casemates and protected drives. */
export function createVanguardShip() {
  const b = shipBuilders();
  const s = (z: number, width: number, height: number, y = 0): HullSection => ({ z, width, height, y, bevel: 0.28 });
  const sections = [s(-7.7, 0.6, 0.34, -0.12), s(-6.4, 1.6, 0.65, -0.05), s(-4.6, 2.8, 1.15), s(-2.8, 3.4, 1.4), s(-0.6, 3.85, 1.65), s(1.6, 4.25, 1.85), s(3.8, 4.3, 1.9), s(5.3, 3.65, 1.7)];
  appendHull(b.hull, sections, '#405c73');
  appendHull(b.hull, [s(-5.5, 0.8, 0.45, -0.42), s(-2.6, 1.9, 0.85, -0.65), s(3.7, 2.2, 0.75, -0.8), s(5.3, 1.8, 0.6, -0.65)], '#2e465c');
  // Plates follow the actual section rings, retaining the wedge instead of box piles.
  for (let band = 0; band < sections.length - 1; band++) {
    const a = { ...sections[band], z: sections[band].z + 0.05 }, c = { ...sections[band + 1], z: sections[band + 1].z - 0.05 };
    const first = sectionRing(a), last = sectionRing(c);
    for (const face of [0, 1, 3, 5, 6, 7]) {
      const next = (face + 1) % 8;
      armorPlate(b.armor, [first[face], first[next], last[next], last[face]], face === 7 ? ['#7c93a4', '#5b758a', '#688398'][band % 3] : face === 0 || face === 6 ? '#8d9fae' : '#5a7287', 0.085);
    }
  }
  // Low dorsal command citadel intersects the upper hull, with a compact mast.
  appendHull(b.hull, [s(-0.5, 1.05, 0.4, 0.87), s(0.4, 1.45, 0.75, 1.12), s(2.75, 1.55, 0.65, 1.22), s(3.25, 1.15, 0.4, 1.1)], '#415c73');
  b.hull.taperedBox([0, 1.84, 1.95], [0.85, 1.15, 0.85], 0.5, 0.6, '#546d80');
  b.armor.taperedBox([0, 2.44, 1.95], [1.15, 0.16, 0.85], 1.05, 0.75, '#a1b2be');
  b.windows.box([0, 2.37, 1.5], [0.85, 0.075, 0.04], '#9acee0');
  b.details.beam([0, 2.5, 1.95], [0, 3.05, 2.05], 0.035, '#a8b9c1');
  b.details.beam([-0.32, 2.7, 2.02], [0.32, 2.7, 2.02], 0.045, '#7996aa');
  // Two restrained, forward-facing twin mounts. Visual mission equipment, no gameplay stats.
  for (const [z, y] of [[-4.3, 0.64], [-1.8, 0.89]]) {
    b.details.taperedBox([0, y, z], [0.94, 0.25, 0.8], 0.75, 0.62, '#293f52');
    b.armor.taperedBox([0, y + 0.2, z], [0.8, 0.25, 0.65], 0.55, 0.5, '#8197a9');
    for (const side of [-1, 1]) {
      b.details.cylinder([side * 0.23, y + 0.19, z - 0.72], 0.08, 0.95, '#273b4d', 0.08, 8);
      b.details.cylinder([side * 0.23, y + 0.19, z - 1.16], 0.1, 0.1, '#9babb6', 0.1, 8);
      b.details.cylinder([side * 0.23, y + 0.19, z - 1.22], 0.06, 0.02, '#10212e', 0.06, 8);
    }
  }
  for (const side of [-1, 1]) {
    // Armored side casemates and drive shoulders grow directly out of the main hull.
    b.hull.push(new THREE.Matrix4().makeTranslation(side * 1.95, 0, 0));
    appendHull(b.hull, [s(-0.2, 0.3, 0.5, -0.12), s(1.1, 1.45, 1.05, -0.12), s(3.95, 1.5, 1.4), s(5.55, 1.3, 1.45)], '#3c566d');
    b.hull.pop();
    b.armor.taperedBox([side * 2.05, 0.65, 3.45], [1.2, 0.22, 2.9], 0.95, 2.6, '#8298aa');
    b.armor.taperedBox([side * 2.25, 0.2, 0.45], [1.12, 0.5, 1.5], 0.85, 1.25, '#698196');
    for (const x of [side * 2.08, side * 2.42]) b.details.cylinder([x, 0.16, -0.55], 0.085, 0.8, '#1c3043', 0.085, 8);
    for (let i = 0; i < 5; i++) b.details.box([side * 2.1, 0.78, 2.45 + i * 0.33], [0.75, 0.04, 0.11], '#1d3447');
    b.armor.box([side * 1.38, 0.6, -1.8], [0.12, 0.13, 1.55], '#79524f');
    for (const z of [-3.2, -0.6, 2.6]) b.lights.box([side * (z < -2 ? 1.74 : 2.71), -0.2, z], [0.035, 0.065, 0.34], '#a5d7e6');
    b.details.box([side * 2.71, -0.12, 2.5], [0.04, 0.62, 1.5], '#253f53');
    for (let i = 0; i < 5; i++) b.details.box([side * 2.74, -0.1, 1.92 + i * 0.28], [0.035, 0.44, 0.045], '#8da2b0');
    b.details.box([side * 1.25, 0.99, 2.85], [0.4, 0.08, 1.8], '#223e52');
    for (let i = 0; i < 5; i++) b.details.box([side * 1.25, 1.04, 2.15 + i * 0.31], [0.35, 0.025, 0.075], '#98acb9');
    for (const y of [-0.57, 0.57]) boxEngine(b, side * 1.35, y, 6.45);
    // Protective upper and lower sills stop short of the recessed exhaust plane.
    for (const y of [-1.12, 1.12]) b.armor.taperedBox([side * 1.35, y, 5.8], [1.5, 0.17, 1.8], 1.35, 1.65, '#698397');
  }
  b.windows.box([0, 1.36, 0.27], [0.9, 0.07, 0.035], '#83c2d5');
  b.details.box([0, 0.05, -7.72], [0.4, 0.18, 0.06], '#182e40');
  b.lights.box([0, 0.05, -7.76], [0.18, 0.06, 0.025], '#acd6e1');
  return assembleShip(b, 'Vanguard Prototype — Frigate');
}
