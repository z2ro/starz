import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createHash } from 'node:crypto';
import { FLEET_DESIGNS, createFleetStudy } from '../frontend/src/shipgeometrylab/FleetStudy';
import { DEFAULT_SHIP_SETTINGS, SHIP_CAMERAS } from '../frontend/src/shipgeometrylab/shipLabTypes';
import { SHIP_CAMERA_DIRECTIONS } from '../frontend/src/shipgeometrylab/shipCamera';
import { createPrototypeShip } from '../frontend/src/shipgeometrylab/ShipGeometry';
import { createStargrave, STELLAR_CORE_RADIUS } from '../frontend/src/shipgeometrylab/StargraveGeometry';

function meshes(root: THREE.Object3D) {
  const result: THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>[] = [];
  root.traverse(object => { if (object instanceof THREE.Mesh) result.push(object); });
  return result;
}
function fingerprint(root: THREE.Object3D) {
  const hash = createHash('sha256');
  for (const mesh of meshes(root)) {
    for (const name of ['position', 'normal', 'color']) hash.update(Buffer.from(mesh.geometry.getAttribute(name).array.buffer));
    hash.update(Buffer.from(mesh.geometry.index!.array.buffer));
  }
  return hash.digest('hex');
}

it('preserves the original main Horizon position/normal/color/index buffers byte for byte', () => {
  const ship = createPrototypeShip();
  // Baseline from main 53b0872, before extracting the shared material/lifecycle assembly.
  expect(fingerprint(ship.root)).toBe('fd4a2eda53093f63a48aa5c4472606b288cea99820311c7cb0b60fcede5c1b01');
  expect(meshes(ship.root).reduce((sum, mesh) => sum + mesh.geometry.index!.count / 3, 0)).toBe(2494);
  ship.dispose();
});

it('preserves the three Lab 02 recipes', () => {
  const baseline: Record<string, string> = {
    horizon: 'fd4a2eda53093f63a48aa5c4472606b288cea99820311c7cb0b60fcede5c1b01',
    wayfarer: '400ac4c61b46482c1e134ea48255976bed5eb9c4d1cfcf96be224272b3f44a47',
    vanguard: '146229556395c1f1f5c13e83203e4f581b9800323d51f94088863000cde6c625',
  };
  for (const design of FLEET_DESIGNS.slice(0, 3)) {
    const ship = design.create(); expect(fingerprint(ship.root)).toBe(baseline[design.id]); ship.dispose();
  }
});

it.each(FLEET_DESIGNS)('$name has deterministic finite indexed geometry, consistent face orientation and symmetric structure', ({ id, create }) => {
  const ship = create(), repeated = create();
  expect(fingerprint(ship.root)).toBe(fingerprint(repeated.root));
  const all = meshes(ship.root); expect(all).toHaveLength(id === 'stargrave' ? 6 : 8);
  let triangles = 0;
  for (const { geometry } of all) {
    const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal'), c = geometry.getAttribute('color'), ids = geometry.index!;
    expect([p.count, n.count, c.count]).toEqual([p.count, p.count, p.count]);
    for (const attr of [p, n, c]) expect(Array.from(attr.array).every(Number.isFinite)).toBe(true);
    expect(ids.count % 3).toBe(0); triangles += ids.count / 3;
    for (let i = 0; i < ids.count; i += 3) {
      const indices = [ids.getX(i), ids.getX(i + 1), ids.getX(i + 2)];
      expect(indices.every(id => Number.isInteger(id) && id >= 0 && id < p.count)).toBe(true);
      const [a, b, c] = indices.map(id => new THREE.Vector3().fromBufferAttribute(p, id));
      const cross = b.sub(a).cross(c.sub(a)); expect(cross.lengthSq()).toBeGreaterThan(1e-15);
      expect(indices.every(id => cross.dot(new THREE.Vector3().fromBufferAttribute(n, id)) > 0)).toBe(true);
    }
  }
  expect(triangles).toBeLessThan(6500);
  const size = ship.bounds.getSize(new THREE.Vector3());
  expect(size.toArray().every(v => v > 1 && v < 23)).toBe(true);
  if (id === 'stargrave') expect(Math.max(...size.toArray()) / Math.min(...size.toArray())).toBeLessThan(1.35);
  else expect(size.z).toBeGreaterThan(size.x);
  const p = meshes(ship.layers.hull)[0].geometry.getAttribute('position');
  const key = (x: number, y: number, z: number) => [x, y, z].map(v => Math.round(v * 1e4)).join(',');
  const points = new Set(Array.from({ length: p.count }, (_, i) => key(p.getX(i), p.getY(i), p.getZ(i))));
  if (id === 'stargrave') expect(ship.bounds.getCenter(new THREE.Vector3()).length()).toBeLessThan(0.1);
  else for (let i = 0; i < p.count; i++) expect(points.has(key(-p.getX(i), p.getY(i), p.getZ(i)))).toBe(true);
  ship.dispose(); repeated.dispose();
});

it.each(FLEET_DESIGNS)('$name reuses buffers across controls and disposes original/shared/silhouette resources once', ({ create }) => {
  const ship = create(), before = fingerprint(ship.root), materials = new Set<THREE.Material>(), geometries = new Set<THREE.BufferGeometry>();
  const collect = () => meshes(ship.root).forEach(mesh => { geometries.add(mesh.geometry); (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material => materials.add(material)); });
  collect(); ship.update({ ...DEFAULT_SHIP_SETTINGS, hullOnly: true, silhouette: true }); collect();
  expect(ship.layers.armor.visible).toBe(false); expect(ship.layers.engines.visible).toBe(false); expect(ship.layers.details.visible).toBe(false);
  ship.update({ ...DEFAULT_SHIP_SETTINGS, armor: false, details: false, engineEmission: 0.7 });
  expect(ship.layers.engines.visible).toBe(true); expect(ship.coreMaterial.emissiveIntensity).toBe(0.7); expect(fingerprint(ship.root)).toBe(before);
  const counts = new Map<THREE.EventDispatcher, number>();
  for (const resource of [...materials, ...geometries]) resource.addEventListener('dispose', () => counts.set(resource, (counts.get(resource) ?? 0) + 1));
  ship.dispose(); ship.dispose();
  expect(counts.size).toBe(materials.size + geometries.size); expect([...counts.values()].every(n => n === 1)).toBe(true); expect(ship.root.children).toHaveLength(0);
});

it('leaves actual rear openings to the recessed emissive cores, with no housing cap obscuring them', () => {
  for (const [design, point] of [['wayfarer', [-1.45, -0.8, 20]], ['vanguard', [1.55, 0.65, 20]]] as const) {
    const ship = FLEET_DESIGNS.find(item => item.id === design)!.create(); ship.root.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(new THREE.Vector3(...point), new THREE.Vector3(0, 0, -1));
    const hits = ray.intersectObject(ship.root, true);
    expect(hits.length).toBeGreaterThan(0); expect((hits[0].object as THREE.Mesh).material).toBe(ship.coreMaterial);
    ship.dispose();
  }
});

it('Atlas has genuinely open side hangars behind structural roofs, not painted exterior doors', () => {
  const ship = FLEET_DESIGNS.find(d => d.id === 'atlas')!.create(); ship.root.updateMatrixWorld(true);
  for (const side of [-1, 1]) {
    const ray = new THREE.Raycaster(new THREE.Vector3(side * 20, 0, 0), new THREE.Vector3(-side, 0, 0));
    const interior = ray.intersectObject(ship.root, true)[0];
    expect(Math.abs(interior.point.x)).toBeLessThan(1.7);
    ray.ray.origin.y = 1.16;
    expect(Math.abs(ray.intersectObject(ship.root, true)[0].point.x)).toBeGreaterThan(3.8);
  }
  expect(FLEET_DESIGNS.some(d => ['interceptor', 'fighter', 'bomber'].includes(d.id))).toBe(false);
  ship.dispose();
});

it('relative-scale presentation follows the guide without changing native geometry', () => {
  const study = createFleetStudy(), original = study.entries.map(e => fingerprint(e.ship.root));
  study.layout('scale', new THREE.Vector3(...SHIP_CAMERA_DIRECTIONS.Top));
  let previous = 0;
  study.entries.forEach(({ design, ship, display }, i) => {
    expect(fingerprint(ship.root)).toBe(original[i]);
    if (design.id === 'stargrave') { expect(display.visible).toBe(false); return; }
    expect(design.visualLength).toBeGreaterThan(previous); previous = design.visualLength;
    const size = ship.bounds.clone().applyMatrix4(display.matrixWorld).getSize(new THREE.Vector3());
    expect(size.z).toBeCloseTo(design.visualLength); expect(fingerprint(ship.root)).toBe(original[i]);
  });
  study.dispose();
});

it.each(SHIP_CAMERAS)('lays out the class gallery without projected overlaps and frames it in %s', cameraName => {
  const study = createFleetStudy(), direction = new THREE.Vector3(...SHIP_CAMERA_DIRECTIONS[cameraName]);
  study.layout('fleet', direction); expect(study.meshCount).toBe(86);
  const right = new THREE.Vector3(0, 1, 0).cross(direction).normalize();
  const up = direction.clone().normalize().cross(right).normalize();
  const ranges = study.entries.map(({ ship, display }) => {
    const projected: number[] = [], vertical: number[] = [];
    for (const x of [ship.bounds.min.x, ship.bounds.max.x]) for (const y of [ship.bounds.min.y, ship.bounds.max.y]) for (const z of [ship.bounds.min.z, ship.bounds.max.z]) { const p = new THREE.Vector3(x, y, z).applyMatrix4(display.matrixWorld); projected.push(p.dot(right)); vertical.push(p.dot(up)); }
    return [Math.min(...projected), Math.max(...projected), Math.min(...vertical), Math.max(...vertical)];
  });
  for (let i = 0; i < ranges.length; i++) for (let j = i + 1; j < ranges.length; j++) { const a = ranges[i], b = ranges[j]; expect(a[1] < b[0] || b[1] < a[0] || a[3] < b[2] || b[3] < a[2]).toBe(true); }
  const frame = study.framing(1.6, direction); expect(frame).toEqual(study.framing(1.6, direction));
  const camera = new THREE.OrthographicCamera(-frame.halfHeight * 1.6, frame.halfHeight * 1.6, frame.halfHeight, -frame.halfHeight, 0.1, frame.distance * 3);
  camera.position.copy(frame.position); camera.lookAt(frame.center); camera.updateMatrixWorld();
  for (const { ship, display } of study.entries) for (const x of [ship.bounds.min.x, ship.bounds.max.x]) for (const y of [ship.bounds.min.y, ship.bounds.max.y]) for (const z of [ship.bounds.min.z, ship.bounds.max.z]) {
    const p = new THREE.Vector3(x, y, z).applyMatrix4(display.matrixWorld).project(camera); expect(Math.abs(p.x)).toBeLessThanOrEqual(0.841); expect(Math.abs(p.y)).toBeLessThanOrEqual(0.561);
  }
  expect(study.labels(camera)).toHaveLength(FLEET_DESIGNS.length);
  expect(study.labels(camera).every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && p.x > 0 && p.x < 100 && p.y > 0 && p.y < 100)).toBe(true);
  const geometry = study.entries[0].ship.layers.hull.children[0];
  study.layout('wayfarer', direction); expect(study.meshCount).toBe(8);
  expect(study.entries.filter(item => item.display.visible).map(e => e.design.id)).toEqual(['wayfarer']); expect(study.entries[0].ship.layers.hull.children[0]).toBe(geometry);
  study.layout('horizon', direction); expect(study.bounds).toEqual(study.entries[0].ship.bounds);
  study.dispose(); study.dispose(); expect(study.root.children).toHaveLength(0);
});

it('contains exactly the eleven principal designs in official order, without independent strike craft', () => {
  expect(FLEET_DESIGNS.map(d => d.id)).toEqual(['horizon', 'wayfarer', 'vanguard', 'sentinel', 'odyssey', 'aegis', 'spearhead', 'leviathan', 'atlas', 'dominion', 'stargrave']);
});

it('Stargrave exposes a large captive star through real negative spaces and has no conventional propulsion', () => {
  const star = createStargrave(); star.root.updateMatrixWorld(true);
  expect(star.layers.engines.children).toHaveLength(0);
  expect(meshes(star.root).some(m => /engine|nozzle/i.test(m.name))).toBe(false);
  expect(STELLAR_CORE_RADIUS * 2).toBeGreaterThan(star.bounds.getSize(new THREE.Vector3()).length() * 0.15);
  const forward = new THREE.Vector3(...SHIP_CAMERA_DIRECTIONS['3/4 Front']).normalize(), right = new THREE.Vector3(0, 1, 0).cross(forward).normalize(), up = forward.clone().cross(right).normalize();
  const ray = new THREE.Raycaster(forward.clone().multiplyScalar(30), forward.clone().negate());
  expect((ray.intersectObject(star.root, true)[0].object as THREE.Mesh).material).toBe(star.coreMaterial);
  let open = 0;
  for (const radius of [3.3, 4.2, 5.1, 6]) for (let i = 0; i < 32; i++) {
    const angle = i * Math.PI * 2 / 32;
    ray.ray.origin.copy(forward).multiplyScalar(30).addScaledVector(right, Math.cos(angle) * radius).addScaledVector(up, Math.sin(angle) * radius);
    if (!ray.intersectObject(star.root, true).length) open++;
  }
  // Sample the containment annulus, not just one ring where three projected belts cross.
  expect(open).toBeGreaterThanOrEqual(32);
  star.dispose();
});

it('disposes all owned Stargrave materials, including unused propulsion materials, once', () => {
  const spy = vi.spyOn(THREE.Material.prototype, 'dispose'), star = createStargrave();
  star.dispose(); star.dispose();
  expect(spy).toHaveBeenCalledTimes(8); expect(new Set(spy.mock.instances).size).toBe(8); spy.mockRestore();
});

it.each(SHIP_CAMERAS)('frames the radial Stargrave geometry without clipping in %s', preset => {
  const study = createFleetStudy(), direction = new THREE.Vector3(...SHIP_CAMERA_DIRECTIONS[preset]);
  for (const aspect of [1.4, 1.6, 1.9]) {
    study.layout('stargrave', direction, aspect);
    const frame = study.framing(aspect, direction);
    const camera = new THREE.OrthographicCamera(-frame.halfHeight * aspect, frame.halfHeight * aspect, frame.halfHeight, -frame.halfHeight, 0.1, frame.distance * 3);
    camera.position.copy(frame.position); camera.lookAt(frame.center); camera.updateMatrixWorld();
    const star = study.entries.find(e => e.design.id === 'stargrave')!;
    for (const mesh of meshes(star.ship.root)) {
      const points = mesh.geometry.getAttribute('position');
      for (let i = 0; i < points.count; i++) {
        const p = new THREE.Vector3().fromBufferAttribute(points, i).applyMatrix4(mesh.matrixWorld).project(camera);
        expect(Math.abs(p.x)).toBeLessThan(0.75); expect(Math.abs(p.y)).toBeLessThan(0.75); expect(Math.abs(p.z)).toBeLessThan(1);
      }
    }
  }
  study.dispose();
});

it('compares Stargrave only with a labelled capital context in its separate category study', () => {
  const study = createFleetStudy(); study.layout('titan', new THREE.Vector3(...SHIP_CAMERA_DIRECTIONS['3/4 Front']));
  const visible = study.entries.filter(e => e.display.visible);
  expect(visible.map(e => e.design.id)).toEqual(['dominion', 'stargrave']);
  const dimensions = visible.map(e => e.ship.bounds.clone().applyMatrix4(e.display.matrixWorld).getSize(new THREE.Vector3()));
  expect(Math.max(...dimensions[1].toArray())).toBeCloseTo(140);
  expect(dimensions[0].z).toBeCloseTo(64);
  study.dispose();
});
