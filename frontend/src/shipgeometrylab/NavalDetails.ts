import * as THREE from 'three';
import { GeometryBuilder, type Point3 } from './GeometryBuilder';
import type { ShipBuilders } from './ShipAssembly';

export function shipBuilders(): ShipBuilders {
  return { hull: new GeometryBuilder(), armor: new GeometryBuilder(), engines: new GeometryBuilder(), nozzles: new GeometryBuilder(), emission: new GeometryBuilder(), details: new GeometryBuilder(), windows: new GeometryBuilder(), lights: new GeometryBuilder() };
}

export function armorPlate(builder: GeometryBuilder, points: Point3[], color: string, thickness = 0.055) {
  const v = points.map(p => new THREE.Vector3(...p));
  const normal = v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).normalize();
  const outer = v.map(p => p.addScaledVector(normal, thickness).toArray() as [number, number, number]);
  builder.quad(outer[0], outer[1], outer[2], outer[3], color);
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; builder.quad(points[i], points[j], outer[j], outer[i], '#344657'); }
}

/** Industrial bell, open at the stern with a recessed core, never a glowing sphere. */
export function roundEngine(b: ShipBuilders, x: number, y: number, z: number, r: number) {
  b.engines.cylinder([x, y, z], r * 1.08, 1.3, '#344e63', r, 12);
  b.engines.cylinder([x, y, z + 0.7], r * 1.1, 0.22, '#8b9eaa', r * 1.1, 12);
  b.engines.cylinder([x, y, z + 1.1], r, 0.65, '#263a4b', r * 0.9, 12, false);
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6, c = (i + 1) * Math.PI / 6;
    const p = (angle: number, radius: number, depth: number): Point3 => [x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, z + depth];
    b.nozzles.quad(p(a, r * 0.9, 1.425), p(c, r * 0.9, 1.425), p(c, r * 0.69, 1.425), p(a, r * 0.69, 1.425), '#93a7b4');
    b.nozzles.quad(p(a, r * 0.69, 1.425), p(c, r * 0.69, 1.425), p(c, r * 0.48, 0.96), p(a, r * 0.48, 0.96), '#142838');
  }
  b.emission.cylinder([x, y, z + 0.96], r * 0.48, 0.025, '#a1d9e3', r * 0.48, 12);
  b.nozzles.cylinder([x, y, z + 1], r * 0.16, 0.04, '#243f50', r * 0.16, 8);
  for (const side of [-1, 1]) b.engines.beam([x + side * r, y, z + 0.25], [x + side * r * 0.94, y, z + 1.1], 0.07, '#9aaeb9');
}

/** Rectangular protected military exhaust; the core sits behind the lip. */
export function boxEngine(b: ShipBuilders, x: number, y: number, z: number) {
  const ring = (w: number, h: number, depth: number): Point3[] => [[x - w, y - h, depth], [x + w, y - h, depth], [x + w, y + h, depth], [x - w, y + h, depth]];
  const outer = ring(0.64, 0.4, z + 0.7), inner = ring(0.48, 0.26, z + 0.7), back = ring(0.37, 0.19, z + 0.44);
  const housing = ring(0.7, 0.47, z - 1.2);
  b.engines.quad(housing[3], housing[2], housing[1], housing[0], '#3d566c');
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    b.engines.quad(housing[i], housing[j], outer[j], outer[i], '#3d566c');
    b.nozzles.quad(outer[i], outer[j], inner[j], inner[i], '#97aab8');
    b.nozzles.quad(inner[i], inner[j], back[j], back[i], '#142737');
  }
  b.emission.quad(back[0], back[1], back[2], back[3], '#9edee9');
  for (let i = -1; i <= 1; i++) b.nozzles.box([x, y + i * 0.11, z + 0.46], [0.75, 0.025, 0.03], '#355367');
}
