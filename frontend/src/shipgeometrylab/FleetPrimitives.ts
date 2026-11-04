import * as THREE from 'three';
import { appendHull, sectionRing, type HullSection } from './HullGenerator';
import { armorPlate, roundEngine } from './NavalDetails';
import type { ShipBuilders } from './ShipAssembly';

export const section = (z: number, width: number, height: number, y = 0, bevel = 0.25): HullSection => ({ z, width, height, y, bevel });

export function platedHull(b: ShipBuilders, sections: HullSection[]) {
  appendHull(b.hull, sections, '#405b70');
  for (let i = 0; i < sections.length - 1; i++) {
    const a = sectionRing({ ...sections[i], z: sections[i].z + 0.04 });
    const c = sectionRing({ ...sections[i + 1], z: sections[i + 1].z - 0.04 });
    for (const face of [0, 1, 3, 5, 6, 7]) {
      const next = (face + 1) % 8;
      armorPlate(b.armor, [a[face], a[next], c[next], c[face]], face === 7 ? ['#728b9e', '#536e83'][i % 2] : face === 0 || face === 6 ? '#8b9eab' : '#536c80', 0.06);
    }
  }
}

export function bridge(b: ShipBuilders, z: number, y: number, width: number, height: number) {
  b.hull.taperedBox([0, y, z], [width, height, width * 1.6], width * 0.62, width * 1.2, '#4c687d');
  b.armor.taperedBox([0, y + height / 2, z], [width * 0.95, 0.12, width * 1.5], width * 0.85, width * 1.3, '#9bafbc');
  const lowY = y + height * 0.18, highY = y + height * 0.32;
  const lowZ = z - width * 0.664 - 0.012, highZ = z - width * 0.636 - 0.012;
  b.windows.quad([-width * 0.3, lowY, lowZ], [-width * 0.3, highY, highZ], [width * 0.3, highY, highZ], [width * 0.3, lowY, lowZ], '#a2d1dd');
  b.details.beam([0, y + height / 2, z], [0, y + height / 2 + 0.55, z + 0.08], 0.045, '#a5b7c0');
}

export function battery(b: ShipBuilders, x: number, y: number, z: number, size = 1) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3().setScalar(size));
  for (const key of ['armor', 'details'] as const) b[key].push(m);
  b.details.taperedBox([0, 0, 0], [0.95, 0.22, 0.95], 0.8, 0.8, '#203a4e');
  b.armor.taperedBox([0, 0.22, 0], [0.85, 0.38, 0.8], 0.65, 0.65, '#8298a8');
  for (const x of [-0.22, 0.22]) {
    b.details.cylinder([x, 0.22, -0.9], 0.09, 1.35, '#2c4559', 0.09, 8);
    b.details.cylinder([x, 0.22, -1.56], 0.11, 0.1, '#8da3b2', 0.11, 8);
    b.details.cylinder([x, 0.22, -1.62], 0.07, 0.025, '#142735', 0.07, 8);
  }
  b.armor.pop(); b.details.pop();
}

export function drive(b: ShipBuilders, x: number, y: number, z: number, scale = 1) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3().setScalar(scale));
  for (const key of ['engines', 'nozzles', 'emission'] as const) b[key].push(m);
  roundEngine(b, 0, 0, 0, 0.65);
  b.engines.pop(); b.nozzles.pop(); b.emission.pop();
}

export function vents(b: ShipBuilders, x: number, y: number, z: number, width = 0.65) {
  for (let i = 0; i < 5; i++) b.details.box([x, y, z + i * 0.2], [width, 0.035, 0.075], '#1e3547');
}
