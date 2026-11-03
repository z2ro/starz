import { GeometryBuilder, type Point3 } from './GeometryBuilder';
import type { ColorRepresentation } from 'three';

export type HullSection = { z: number; width: number; height: number; y: number; bevel: number };

// Lab units, not canonical Horizon dimensions. Bow is -Z, stern is +Z, +Y is dorsal.
export const HULL_SECTIONS: readonly HullSection[] = [
  { z: -5.8, width: 0.24, height: 0.22, y: -0.07, bevel: 0.25 },
  { z: -5.0, width: 0.82, height: 0.45, y: -0.03, bevel: 0.25 },
  { z: -3.5, width: 1.35, height: 0.76, y: 0, bevel: 0.26 },
  { z: -1.6, width: 1.82, height: 1.02, y: 0, bevel: 0.27 },
  { z: 0.5, width: 2.2, height: 1.22, y: 0, bevel: 0.25 },
  { z: 2.4, width: 2.3, height: 1.25, y: 0.02, bevel: 0.25 },
  { z: 3.5, width: 1.9, height: 1.08, y: 0.02, bevel: 0.26 },
  { z: 4.0, width: 1.5, height: 0.88, y: 0.02, bevel: 0.25 },
];

export function sectionRing(section: HullSection): Point3[] {
  const w = section.width / 2, h = section.height / 2, b = section.bevel;
  return [[-w * (1 - b), h], [-w, h * (1 - b)], [-w, -h * (1 - b)], [-w * (1 - b), -h], [w * (1 - b), -h], [w, -h * (1 - b)], [w, h * (1 - b)], [w * (1 - b), h]].map(([x, y]) => [x, y + section.y, section.z]);
}

export function appendHull(builder: GeometryBuilder, sections: readonly HullSection[], color: ColorRepresentation) {
  if (sections.length < 2 || sections.some((section, index) => ![section.z, section.width, section.height, section.y, section.bevel].every(Number.isFinite) || section.width <= 0 || section.height <= 0 || section.bevel <= 0 || section.bevel >= 1 || (index > 0 && section.z <= sections[index - 1].z))) throw new Error('Hull sections must be finite, positive and ordered');
  const rings = sections.map(sectionRing);
  for (let section = 0; section < rings.length - 1; section++) for (let index = 0; index < 8; index++) {
    const next = (index + 1) % 8;
    builder.quad(rings[section][index], rings[section][next], rings[section + 1][next], rings[section + 1][index], color);
  }
  const first = sections[0], last = sections[sections.length - 1];
  for (let index = 0; index < 8; index++) {
    const next = (index + 1) % 8;
    builder.triangle([0, first.y, first.z], rings[0][next], rings[0][index], color);
    builder.triangle([0, last.y, last.z], rings[rings.length - 1][index], rings[rings.length - 1][next], color);
  }
  return builder;
}

export function hullSectionAt(z: number): HullSection {
  if (z < HULL_SECTIONS[0].z || z > HULL_SECTIONS[HULL_SECTIONS.length - 1].z) throw new RangeError('Outside hull');
  const index = Math.max(1, HULL_SECTIONS.findIndex(section => section.z >= z));
  const a = HULL_SECTIONS[index - 1], b = HULL_SECTIONS[index], t = (z - a.z) / (b.z - a.z);
  return { z, width: a.width + (b.width - a.width) * t, height: a.height + (b.height - a.height) * t, y: a.y + (b.y - a.y) * t, bevel: a.bevel + (b.bevel - a.bevel) * t };
}

export function generateHull() { return appendHull(new GeometryBuilder(), HULL_SECTIONS, '#526e84').build(); }
