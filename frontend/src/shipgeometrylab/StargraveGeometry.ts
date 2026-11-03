import * as THREE from 'three';
import { GeometryBuilder, type Point3 } from './GeometryBuilder';
import { assembleShip } from './ShipAssembly';
import { shipBuilders } from './NavalDetails';

export const STELLAR_CORE_RADIUS = 2.7;

/** Closed rectangular-section curved segment in local XY; a full ring has no internal caps. */
function arc(builder: GeometryBuilder, radius: number, width: number, depth: number, start: number, end: number, color: string, steps: number) {
  const ring = (angle: number): Point3[] => [
    [Math.cos(angle) * (radius - width / 2), Math.sin(angle) * (radius - width / 2), -depth / 2],
    [Math.cos(angle) * (radius + width / 2), Math.sin(angle) * (radius + width / 2), -depth / 2],
    [Math.cos(angle) * (radius + width / 2), Math.sin(angle) * (radius + width / 2), depth / 2],
    [Math.cos(angle) * (radius - width / 2), Math.sin(angle) * (radius - width / 2), depth / 2],
  ];
  for (let i = 0; i < steps; i++) {
    const a = ring(start + (end - start) * i / steps), b = ring(start + (end - start) * (i + 1) / steps);
    for (let face = 0; face < 4; face++) { const j = (face + 1) % 4; builder.quad(a[face], b[face], b[j], a[j], color); }
  }
  if (end - start < Math.PI * 2 - 1e-6) {
    const a = ring(start), b = ring(end);
    builder.quad(a[0], a[1], a[2], a[3], color); builder.quad(b[3], b[2], b[1], b[0], color);
  }
}

export function createStargrave() {
  const b = shipBuilders();
  // Three orthogonal segmented containment belts, not a closed metal sphere or a ship fuselage.
  const planes = [new THREE.Matrix4(), new THREE.Matrix4().makeRotationX(Math.PI / 2), new THREE.Matrix4().makeRotationY(Math.PI / 2)];
  for (const plane of planes) {
    for (const key of ['hull', 'armor', 'details', 'windows'] as const) b[key].push(plane);
    for (let sector = 0; sector < 4; sector++) {
      const a = sector * Math.PI / 2 + 0.55, c = (sector + 1) * Math.PI / 2 - 0.55;
      arc(b.hull, 7.5, 0.22, 0.3, a, c, '#536f83', 6);
      arc(b.hull, 5.7, 0.45, 0.65, a, c, '#324e63', 6);
      arc(b.armor, 5.7, 0.85, 1.05, a, c, '#728b9f', 6);
      arc(b.windows, 6.24, 0.045, 0.18, a + 0.04, c - 0.04, '#81bcd2', 6);
      const middle = (a + c) / 2;
      b.hull.beam([Math.cos(middle) * 6.1, Math.sin(middle) * 6.1, 0], [Math.cos(middle) * 7.5, Math.sin(middle) * 7.5, 0], 0.18, '#829bac');
      for (const [angle, node] of [[a, sector * Math.PI / 2], [c, (sector + 1) * Math.PI / 2]]) {
        b.hull.beam([Math.cos(angle) * 5.8, Math.sin(angle) * 5.8, 0], [Math.cos(node) * 6.8, Math.sin(node) * 6.8, 0], 0.18, '#8da4b4');
      }
      for (let rib = 1; rib <= 3; rib++) {
        const angle = a + (c - a) * rib / 4;
        b.details.beam([Math.cos(angle) * 5.15, Math.sin(angle) * 5.15, 0.67], [Math.cos(angle) * 6.25, Math.sin(angle) * 6.25, 0.67], 0.1, '#9aafbd');
      }
    }
    b.hull.pop(); b.armor.pop(); b.details.pop(); b.windows.pop();
  }
  // Six radially oriented, attached military/service sectors with actual recessed docking mouths.
  for (const axis of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as const) {
    const direction = new THREE.Vector3(...axis);
    const m = new THREE.Matrix4().compose(direction.clone().multiplyScalar(6.8), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction), new THREE.Vector3(1, 1, 1));
    for (const key of ['hull', 'armor', 'details', 'lights', 'windows'] as const) b[key].push(m);
    b.hull.taperedBox([0, 0, 0.15], [1.8, 1.2, 1.7], 1.5, 1.45, '#3e5a70');
    b.hull.taperedBox([0, 0.75, 0.1], [1.25, 0.5, 1.5], 0.85, 1.15, '#4e6b80');
    for (const side of [-1, 1]) {
      b.hull.box([side * 1.12, -0.05, 0.15], [0.55, 1.1, 1.4], '#456175');
      b.armor.taperedBox([side * 1.12, 0.55, 0.15], [0.6, 0.15, 1.3], 0.45, 1.15, '#8fa5b4');
      for (let i = 0; i < 3; i++) b.details.box([side * 1.41, 0.15 - i * 0.2, 0.15], [0.035, 0.06, 0.8], '#1e3648');
    }
    b.hull.taperedBox([0, -0.75, 0.1], [1.6, 0.35, 1.4], 1.45, 1.25, '#405d72');
    b.hull.taperedBox([0, 1.15, 0.1], [0.6, 0.45, 0.9], 0.45, 0.7, '#4e6b80');
    b.armor.taperedBox([0, 1.02, 0.1], [1.3, 0.12, 1.45], 1.1, 1.25, '#8da4b4');
    b.hull.box([0, 0.48, 1.35], [1.6, 0.2, 0.8], '#7791a3');
    b.hull.box([0, -0.48, 1.35], [1.6, 0.2, 0.8], '#526e83');
    for (const side of [-1, 1]) b.hull.box([side * 0.71, 0, 1.35], [0.18, 0.8, 0.8], '#7f98a9');
    b.details.box([0, 0, 1.035], [1.22, 0.7, 0.05], '#112637');
    b.lights.box([0, -0.33, 1.77], [1.05, 0.055, 0.035], '#d6cda8');
    b.windows.box([0, 0.6, -0.45], [0.7, 0.06, 0.06], '#88bfd0');
    b.details.beam([0, 1.05, 0.1], [0, 1.65, 0.15], 0.05, '#a8b9c2');
    b.details.box([0, 1.5, 0.15], [0.45, 0.09, 0.2], '#7e9bae');
    b.hull.pop(); b.armor.pop(); b.details.pop(); b.lights.pop(); b.windows.pop();
  }
  // A self-emissive stellar body, built from finite procedural faces, not a small engine emitter.
  const sphere = new THREE.IcosahedronGeometry(STELLAR_CORE_RADIUS, 3), p = sphere.getAttribute('position');
  for (let i = 0; i < p.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(p, i), c = new THREE.Vector3().fromBufferAttribute(p, i + 1), d = new THREE.Vector3().fromBufferAttribute(p, i + 2);
    const signal = Math.sin(a.x * 4.7 + a.y * 3.1) * Math.cos(a.z * 5.3);
    b.emission.triangle(a.toArray(), c.toArray(), d.toArray(), signal > 0.2 ? '#e5f8ff' : signal < -0.2 ? '#649dc8' : '#a8d8ef');
  }
  sphere.dispose();
  const star = assembleShip(b, 'Stargrave-class Prototype — Stellar Siege Titan');
  const core = star.layers.engines.children[0]; core.name = 'Captive stellar core'; star.layers.hull.add(core);
  star.layers.engines.name = 'No conventional propulsion'; star.layers.hull.name = 'Containment frame and captive star'; star.layers.armor.name = 'Segmented Dyson containment';
  star.coreMaterial.emissive.set('#4eade5'); star.coreMaterial.metalness = 0;
  star.root.userData.category = 'stellar-megastructure';
  let radius = 0;
  star.root.updateMatrixWorld(true);
  star.root.traverse(object => { if (object instanceof THREE.Mesh) {
    const points = object.geometry.getAttribute('position'), p = new THREE.Vector3();
    for (let i = 0; i < points.count; i++) radius = Math.max(radius, p.fromBufferAttribute(points, i).applyMatrix4(object.matrixWorld).length());
  } });
  return { ...star, presentationSphere: new THREE.Sphere(new THREE.Vector3(), radius) };
}
