import * as THREE from 'three';
import { appendHull } from './HullGenerator';
import { assembleShip } from './ShipAssembly';
import { shipBuilders } from './NavalDetails';
import { section as s, platedHull, bridge, drive, vents } from './FleetPrimitives';
import type { Point3 } from './GeometryBuilder';

export function createOdysseyShip() {
  const b = shipBuilders();
  platedHull(b, [s(-8.8, 0.8, 0.65), s(-7, 2.8, 1.35), s(-4.2, 3.1, 1.5), s(-1.8, 1.7, 1.1), s(2.2, 1.8, 1.2), s(5.3, 2.9, 1.8), s(6.7, 2.6, 1.6)]);
  bridge(b, -5.7, 0.85, 1.3, 0.45);
  // Laboratory drums and their structural service arms, not weapon nacelles.
  for (const side of [-1, 1]) {
    b.hull.beam([0, -0.15, 0.1], [side * 3.0, -0.15, 0.1], 0.45, '#516e82');
    b.hull.beam([side * 0.6, -0.3, 3.5], [side * 2.8, -0.3, 1.9], 0.25, '#526d80');
    b.hull.cylinder([side * 2.6, -0.1, 0.5], 0.85, 3.9, '#698291', 0.85, 12);
    b.armor.cylinder([side * 2.6, -0.1, -1.2], 0.94, 0.25, '#a2b4bd', 0.94, 12);
    b.armor.cylinder([side * 2.6, -0.1, 2.1], 0.94, 0.25, '#a2b4bd', 0.94, 12);
    b.windows.box([side * 3.46, 0, 0.3], [0.04, 0.09, 1.8], '#84bed0');
    b.details.beam([side * 0.8, 0.4, 4.3], [side * 1.75, 2.4, 4.3], 0.12, '#9baeb9');
    b.details.cylinder([side * 1.75, 2.4, 4.3], 0.36, 0.7, '#7995a8', 0.36, 12);
    drive(b, side * 1.1, 0, 6.8, 1.05);
    vents(b, side * 0.85, 0.94, 4.6);
  }
  // A large, open observation dish and feed tripod define science in silhouette.
  b.hull.taperedBox([0, 1.0, 0.7], [1.3, 1.4, 1.5], 0.7, 0.85, '#3b586d');
  const mount = new THREE.Matrix4().makeTranslation(0, 1.7, 0.7).multiply(new THREE.Matrix4().makeRotationX(-0.4));
  for (const key of ['armor', 'details'] as const) b[key].push(mount);
  const radii = [0.2, 0.8, 1.5, 2.3];
  const p = (r: number, angle: number, offset = 0): Point3 => [Math.cos(angle) * r, (r / 2.3) ** 2 * 0.8 + offset, Math.sin(angle) * r];
  for (let ring = 0; ring < radii.length - 1; ring++) for (let i = 0; i < 24; i++) {
    const a = i * Math.PI / 12, c = (i + 1) * Math.PI / 12, r = radii[ring], t = radii[ring + 1];
    b.armor.quad(p(r, a), p(r, c), p(t, c), p(t, a), ring % 2 ? '#8ba0af' : '#637f92');
    b.armor.quad(p(r, a, -0.1), p(t, a, -0.1), p(t, c, -0.1), p(r, c, -0.1), '#435e73');
    if (ring === radii.length - 2) b.armor.quad(p(t, a), p(t, c), p(t, c, -0.1), p(t, a, -0.1), '#a4b7c2');
  }
  for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; b.details.beam(p(2.2, a), [0, 1.85, 0], 0.07, '#a2b5bf'); }
  b.details.cylinder([0, 1.85, 0], 0.15, 0.3, '#4b6e83', 0.15, 8);
  b.armor.pop(); b.details.pop();
  b.lights.box([0, -0.34, -8.85], [0.22, 0.07, 0.03], '#bfdae0');
  return assembleShip(b, 'Odyssey Prototype — Science Cruiser');
}
