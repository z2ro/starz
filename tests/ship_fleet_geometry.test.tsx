import { expect, it } from 'vitest';
import * as THREE from 'three';
import { createHash } from 'node:crypto';
import { FLEET_DESIGNS, createFleetStudy } from '../frontend/src/shipgeometrylab/FleetStudy';
import { DEFAULT_SHIP_SETTINGS, SHIP_CAMERAS } from '../frontend/src/shipgeometrylab/shipLabTypes';
import { SHIP_CAMERA_DIRECTIONS } from '../frontend/src/shipgeometrylab/shipCamera';
import { createPrototypeShip } from '../frontend/src/shipgeometrylab/ShipGeometry';

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

it.each(FLEET_DESIGNS)('$name has deterministic finite indexed geometry, consistent face orientation and symmetric structure', ({ create }) => {
  const ship = create(), repeated = create();
  expect(fingerprint(ship.root)).toBe(fingerprint(repeated.root));
  const all = meshes(ship.root); expect(all).toHaveLength(8);
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
  expect(size.toArray().every(v => v > 1 && v < 23)).toBe(true); expect(size.z).toBeGreaterThan(size.x * 2);
  const p = meshes(ship.layers.hull)[0].geometry.getAttribute('position');
  const key = (x: number, y: number, z: number) => [x, y, z].map(v => Math.round(v * 1e4)).join(',');
  const points = new Set(Array.from({ length: p.count }, (_, i) => key(p.getX(i), p.getY(i), p.getZ(i))));
  for (let i = 0; i < p.count; i++) expect(points.has(key(-p.getX(i), p.getY(i), p.getZ(i)))).toBe(true);
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

it.each(SHIP_CAMERAS)('lays out the three distinct ships without projected overlaps and frames them in %s', cameraName => {
  const study = createFleetStudy(), direction = new THREE.Vector3(...SHIP_CAMERA_DIRECTIONS[cameraName]);
  study.layout('fleet', direction); expect(study.meshCount).toBe(24);
  const right = new THREE.Vector3(0, 1, 0).cross(direction).normalize();
  const ranges = study.entries.map(({ ship, display }) => {
    const projected: number[] = [];
    for (const x of [ship.bounds.min.x, ship.bounds.max.x]) for (const y of [ship.bounds.min.y, ship.bounds.max.y]) for (const z of [ship.bounds.min.z, ship.bounds.max.z]) projected.push(new THREE.Vector3(x, y, z).add(display.position).dot(right));
    return [Math.min(...projected), Math.max(...projected)];
  });
  expect(ranges[0][1]).toBeLessThan(ranges[1][0]); expect(ranges[1][1]).toBeLessThan(ranges[2][0]);
  const frame = study.framing(1.6, direction); expect(frame).toEqual(study.framing(1.6, direction));
  const camera = new THREE.OrthographicCamera(-frame.halfHeight * 1.6, frame.halfHeight * 1.6, frame.halfHeight, -frame.halfHeight, 0.1, frame.distance * 3);
  camera.position.copy(frame.position); camera.lookAt(frame.center); camera.updateMatrixWorld();
  for (const { ship, display } of study.entries) for (const x of [ship.bounds.min.x, ship.bounds.max.x]) for (const y of [ship.bounds.min.y, ship.bounds.max.y]) for (const z of [ship.bounds.min.z, ship.bounds.max.z]) {
    const p = new THREE.Vector3(x, y, z).add(display.position).project(camera); expect(Math.abs(p.x)).toBeLessThanOrEqual(0.841); expect(Math.abs(p.y)).toBeLessThanOrEqual(0.641);
  }
  const geometry = study.entries[0].ship.layers.hull.children[0];
  study.layout('wayfarer', direction); expect(study.meshCount).toBe(8);
  expect(study.entries.map(item => item.display.visible)).toEqual([false, true, false]); expect(study.entries[0].ship.layers.hull.children[0]).toBe(geometry);
  study.layout('horizon', direction); expect(study.bounds).toEqual(study.entries[0].ship.bounds);
  study.dispose(); study.dispose(); expect(study.root.children).toHaveLength(0);
});
