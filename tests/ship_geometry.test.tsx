import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { GeometryBuilder } from '../frontend/src/shipgeometrylab/GeometryBuilder';
import { appendHull, generateHull, HULL_SECTIONS, hullSectionAt, sectionRing } from '../frontend/src/shipgeometrylab/HullGenerator';
import { createPrototypeShip } from '../frontend/src/shipgeometrylab/ShipGeometry';
import { shipFraming, SHIP_CAMERA_DIRECTIONS } from '../frontend/src/shipgeometrylab/shipCamera';
import { DEFAULT_SHIP_SETTINGS, SHIP_CAMERAS } from '../frontend/src/shipgeometrylab/shipLabTypes';

function validateGeometry(geometry: THREE.BufferGeometry) {
  const positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal'), colors = geometry.getAttribute('color');
  const index = geometry.index!;
  expect(index.count % 3).toBe(0);
  expect(normals.count).toBe(positions.count);
  expect(colors.count).toBe(positions.count);
  for (const attribute of [positions, normals, colors]) expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true);
  for (let triangle = 0; triangle < index.count; triangle += 3) {
    const ids = [0, 1, 2].map(offset => index.getX(triangle + offset));
    ids.forEach(id => { expect(id).toBeGreaterThanOrEqual(0); expect(id).toBeLessThan(positions.count); });
    const [a, b, c] = ids.map(id => new THREE.Vector3().fromBufferAttribute(positions, id));
    const cross = b.clone().sub(a).cross(c.clone().sub(a));
    expect(cross.lengthSq()).toBeGreaterThan(1e-15);
    for (const id of ids) expect(cross.dot(new THREE.Vector3().fromBufferAttribute(normals, id))).toBeGreaterThan(0);
  }
}

describe('GeometryBuilder', () => {
  it('builds indexed, colored faces and positive boxes with outward winding', () => {
    const geometry = new GeometryBuilder().box([0, 0, 0], [2, 3, 4], '#789bad').build();
    validateGeometry(geometry);
    expect(geometry.index!.count).toBe(36);
    expect(geometry.boundingBox!.getSize(new THREE.Vector3()).toArray()).toEqual([2, 3, 4]);
    const positions = geometry.getAttribute('position');
    for (let index = 0; index < positions.count; index++) {
      expect(new THREE.Vector3().fromBufferAttribute(positions, index).dot(new THREE.Vector3().fromBufferAttribute(geometry.getAttribute('normal'), index))).toBeGreaterThan(0);
    }
    geometry.dispose();
  });
  it('supports tapered boxes, cylinders, beams and nested transforms', () => {
    const builder = new GeometryBuilder();
    builder.push(new THREE.Matrix4().makeTranslation(3, 0, 0));
    builder.push(new THREE.Matrix4().makeRotationY(0.4)).taperedBox([0, 0, 0], [2, 1, 3], 1, 2, '#8aabc1').pop();
    builder.cylinder([0, 0, 0], 0.4, 2, '#567891', 0.2, 12);
    builder.beam([0, 0, 0], [1, 2, 3], 0.1, '#abcdef').pop();
    const geometry = builder.build();
    validateGeometry(geometry);
    expect(geometry.boundingBox!.min.x).toBeGreaterThan(1);
    geometry.dispose();
  });
  it('rejects non-finite/degenerate geometry and unbalanced transforms', () => {
    expect(() => new GeometryBuilder().triangle([0, 0, 0], [0, 0, 0], [1, 0, 0], '#fff')).toThrow('Degenerate');
    expect(() => new GeometryBuilder().triangle([NaN, 0, 0], [1, 0, 0], [0, 1, 0], '#fff')).toThrow('Non-finite');
    expect(() => new GeometryBuilder().box([0, 0, 0], [0, 1, 1], '#fff')).toThrow();
    expect(() => new GeometryBuilder().cylinder([0, 0, 0], 1, 1, '#fff', 1, 2)).toThrow();
    expect(() => new GeometryBuilder().beam([0, 0, 0], [0, 0, 0], 1, '#fff')).toThrow();
    expect(() => new GeometryBuilder().pop()).toThrow();
    expect(() => new GeometryBuilder().push(new THREE.Matrix4()).build()).toThrow();
    expect(() => new GeometryBuilder().push(new THREE.Matrix4().makeScale(-1, 1, 1))).toThrow();
  });
});

describe('continuous hull', () => {
  it('connects all sections as a closed, outward-facing solid', () => {
    const geometry = generateHull();
    validateGeometry(geometry);
    const positions = geometry.getAttribute('position'), indices = geometry.index!;
    const key = (index: number) => [positions.getX(index), positions.getY(index), positions.getZ(index)].map(value => value.toFixed(5)).join(',');
    const edges = new Map<string, number>();
    let signedVolume = 0;
    for (let index = 0; index < indices.count; index += 3) {
      const ids = [0, 1, 2].map(offset => indices.getX(index + offset));
      const [a, b, c] = ids.map(id => new THREE.Vector3().fromBufferAttribute(positions, id));
      signedVolume += a.dot(b.cross(c)) / 6;
      for (let edge = 0; edge < 3; edge++) {
        const keys = [key(ids[edge]), key(ids[(edge + 1) % 3])].sort().join('|');
        edges.set(keys, (edges.get(keys) ?? 0) + 1);
      }
    }
    expect([...edges.values()].every(count => count === 2)).toBe(true);
    expect(signedVolume).toBeGreaterThan(8);
    expect(geometry.boundingBox!.getSize(new THREE.Vector3()).z).toBeCloseTo(9.8);
    for (const section of HULL_SECTIONS) for (const point of sectionRing(section)) {
      expect(Array.from({ length: positions.count }, (_, index) => new THREE.Vector3().fromBufferAttribute(positions, index).distanceTo(new THREE.Vector3(...point))).some(distance => distance < 1e-5)).toBe(true);
    }
    geometry.dispose();
  });
  it('interpolates ordered sections and rejects invalid profiles', () => {
    expect(hullSectionAt(-2).width).toBeGreaterThan(hullSectionAt(-4).width);
    expect(() => hullSectionAt(8)).toThrow();
    expect(() => appendHull(new GeometryBuilder(), [HULL_SECTIONS[1], HULL_SECTIONS[0]], '#fff')).toThrow();
    expect(() => appendHull(new GeometryBuilder(), [], '#fff')).toThrow();
  });
});

describe('Horizon Prototype', () => {
  it('has finite, nondegenerate batched components and a symmetric structural hull', () => {
    const ship = createPrototypeShip();
    let meshes = 0;
    ship.root.traverse(object => { if (object instanceof THREE.Mesh) { meshes += 1; validateGeometry(object.geometry); } });
    expect(meshes).toBe(8);
    const size = ship.bounds.getSize(new THREE.Vector3());
    expect(size.x).toBeGreaterThan(3);
    expect(size.x).toBeLessThan(4.2);
    expect(size.y).toBeGreaterThan(1);
    expect(size.y).toBeLessThan(2.5);
    expect(size.z).toBeGreaterThan(10);
    expect(size.z).toBeLessThan(12);
    const geometry = (ship.layers.hull.children[0] as THREE.Mesh).geometry;
    const attribute = geometry.getAttribute('position');
    const points = Array.from({ length: attribute.count }, (_, index) => new THREE.Vector3().fromBufferAttribute(attribute, index));
    for (const point of points) expect(points.some(other => Math.abs(other.x + point.x) < 1e-5 && Math.abs(other.y - point.y) < 1e-5 && Math.abs(other.z - point.z) < 1e-5)).toBe(true);
    ship.dispose();
  });
  it('changes visibility and silhouette without allocating replacement geometry', () => {
    const ship = createPrototypeShip();
    const mesh = ship.layers.hull.children[0] as THREE.Mesh;
    const geometry = mesh.geometry, material = mesh.material;
    ship.update({ ...DEFAULT_SHIP_SETTINGS, hullOnly: true, silhouette: true });
    expect(ship.layers.hull.visible).toBe(true);
    expect(ship.layers.armor.visible).toBe(false);
    expect(ship.layers.engines.visible).toBe(false);
    expect(ship.layers.details.visible).toBe(false);
    expect(mesh.geometry).toBe(geometry);
    expect(mesh.material).toBeInstanceOf(THREE.MeshBasicMaterial);
    ship.update({ ...DEFAULT_SHIP_SETTINGS, armor: false, engines: true, details: false, engineEmission: 2.4, hullTone: 0.8, armorContrast: 1.2 });
    expect(ship.layers.armor.visible).toBe(false);
    expect(ship.layers.engines.visible).toBe(true);
    expect(mesh.material).toBe(material);
    expect(ship.coreMaterial.emissiveIntensity).toBe(2.4);
    expect((mesh.material as THREE.MeshStandardMaterial).color.r).toBeCloseTo(0.8);
    expect(((ship.layers.armor.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).color.r).toBeCloseTo(1.2);
    ship.update({ ...DEFAULT_SHIP_SETTINGS, engines: false });
    expect(ship.layers.engines.visible).toBe(false);
    expect(ship.layers.details.visible).toBe(true);
    ship.dispose();
  });
  it('disposes each geometry and all shared/original/silhouette materials exactly once', () => {
    const ship = createPrototypeShip();
    const materials = new Set<THREE.Material>();
    const geometries = new Set<THREE.BufferGeometry>();
    const collect = () => ship.root.traverse(object => { if (object instanceof THREE.Mesh) {
      geometries.add(object.geometry);
      (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material));
    } });
    collect();
    ship.update({ ...DEFAULT_SHIP_SETTINGS, silhouette: true });
    collect();
    const counts = new Map<THREE.EventDispatcher, number>();
    for (const resource of [...materials, ...geometries]) resource.addEventListener('dispose', () => counts.set(resource, (counts.get(resource) ?? 0) + 1));
    ship.dispose(); ship.dispose();
    expect(counts.size).toBe(materials.size + geometries.size);
    expect([...counts.values()].every(value => value === 1)).toBe(true);
    expect(ship.root.children).toHaveLength(0);
  });
});

it.each(SHIP_CAMERAS)('fits the actual bounding box into %s at every desktop target', preset => {
  const ship = createPrototypeShip();
  for (const [width, height] of [[1920, 1080], [1440, 900], [1366, 768]]) {
    const aspect = (width - 336) / (height - 114);
    const direction = new THREE.Vector3(...SHIP_CAMERA_DIRECTIONS[preset]);
    const framing = shipFraming(ship.bounds, aspect, direction);
    expect(framing).toEqual(shipFraming(ship.bounds, aspect, direction));
    const camera = new THREE.OrthographicCamera(-framing.halfHeight * aspect, framing.halfHeight * aspect, framing.halfHeight, -framing.halfHeight, 0.1, framing.distance * 3);
    camera.position.copy(framing.position); camera.lookAt(framing.center); camera.updateMatrixWorld();
    let minX = Infinity, maxX = -Infinity;
    for (const x of [ship.bounds.min.x, ship.bounds.max.x]) for (const y of [ship.bounds.min.y, ship.bounds.max.y]) for (const z of [ship.bounds.min.z, ship.bounds.max.z]) {
      const point = new THREE.Vector3(x, y, z).project(camera);
      expect(Math.abs(point.x)).toBeLessThanOrEqual(0.721);
      expect(Math.abs(point.y)).toBeLessThanOrEqual(0.721);
      expect(Math.abs(point.z)).toBeLessThan(1);
      minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x);
    }
    if (preset === '3/4 Front') expect((maxX - minX) / 2).toBeGreaterThan(0.6);
  }
  ship.dispose();
});

it('keeps the Planet Lab shader copy unchanged and isolates the lazy route from gameplay', () => {
  const planet = readFileSync('frontend/src/planetlab/PlanetLabRenderer.ts', 'utf8');
  const ship = readFileSync('frontend/src/shipgeometrylab/ShipPixelPipeline.ts', 'utf8');
  const shaders = (source: string) => source.slice(source.indexOf('const PALETTE'), source.indexOf('const paletteVectors')).trim();
  expect(shaders(ship)).toBe(shaders(planet));
  const router = readFileSync('frontend/src/app/router.tsx', 'utf8');
  expect(router).toContain("import('../shipgeometrylab/ShipGeometryLabView')");
  expect(router.indexOf('path="/ship-geometry-lab"')).toBeLessThan(router.indexOf('element={<AppShell'));
  expect(readFileSync('frontend/src/components/shell/Sidebar.tsx', 'utf8')).not.toContain('ship-geometry-lab');
});
