import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import * as planetModel from '../frontend/src/planetlab/PlanetModel';
import * as shipModel from '../frontend/src/shipgeometrylab/ShipGeometry';
import { DEFAULT_PLANET_LAB_SETTINGS, PLANET_PRESETS } from '../frontend/src/planetlab/planetLabTypes';
import { DEFAULT_SPACE_SETTINGS as defaults } from '../frontend/src/spacescenelab/spaceSceneTypes';
import { createSpaceSceneModel } from '../frontend/src/spacescenelab/SpaceSceneModel';
import { orbitCameraSpan, presentationScale, safeOrbitRadius, shipCenterOccluded, updateOrbitTransform } from '../frontend/src/spacescenelab/orbit';

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
    return { createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData: () => undefined } as unknown as CanvasRenderingContext2D;
  });
});
afterEach(() => { vi.restoreAllMocks(); });

it('preserves the approved planet mesh assembly and material settings', () => {
  const planet = planetModel.createLabPlanet(DEFAULT_PLANET_LAB_SETTINGS);
  expect(planet.root.children).toHaveLength(3);
  expect(planet.surface.geometry.parameters).toMatchObject({ radius: 1.28, widthSegments: 128, heightSegments: 80 });
  expect(planet.surface.material.roughness).toBe(0.72);
  expect(planet.surface.material.metalness).toBe(0.04);
  expect(planet.surface.material.map!.colorSpace).toBe(THREE.SRGBColorSpace);
  expect(planet.cloudLayer.material.opacity).toBe(0.52);
  expect(planet.cloudLayer.material.depthWrite).toBe(false);
  expect(planet.cloudLayer.renderOrder).toBe(2);
  expect(planet.atmosphere.renderOrder).toBe(3);
  expect(planet.root.rotation.z).toBeCloseTo(THREE.MathUtils.degToRad(18));
  planetModel.disposeLabObject(planet.root);
});

describe('orbital presentation', () => {
  it('is periodic and deterministic with the bow aligned to the tangent', () => {
    for (const inclination of [0, 25, 80]) for (const phase of [0, 0.5, Math.PI, 4.7]) {
      const a = new THREE.Group(), b = new THREE.Group();
      const tangent = new THREE.Vector3();
      updateOrbitTransform(a, phase, 2.1, inclination, tangent);
      updateOrbitTransform(b, phase + 2 * Math.PI, 2.1, inclination, new THREE.Vector3());
      expect(a.position.distanceTo(b.position)).toBeLessThan(1e-12);
      expect(a.position.length()).toBeCloseTo(2.1, 12);
      expect(a.position.dot(tangent)).toBeCloseTo(0, 12);
      expect(new THREE.Vector3(0, 0, -1).applyQuaternion(a.quaternion).distanceTo(tangent)).toBeLessThan(1e-12);
      expect(new THREE.Vector3(0, 1, 0).applyQuaternion(a.quaternion).distanceTo(new THREE.Vector3(0, Math.cos(THREE.MathUtils.degToRad(inclination)), -Math.sin(THREE.MathUtils.degToRad(inclination))))).toBeLessThan(1e-12);
      const next = new THREE.Group();
      updateOrbitTransform(next, phase + 1.3, 2.1, inclination, new THREE.Vector3());
      const transport = a.quaternion.clone().invert().premultiply(next.quaternion);
      expect(a.position.clone().applyQuaternion(transport).distanceTo(next.position)).toBeLessThan(1e-12);
    }
  });
  it('keeps the full scaled ship outside the planet and atmosphere', () => {
    const ship = shipModel.createPrototypeShip();
    for (const length of [0.4, 0.9, 1.2]) {
      const presentation = presentationScale(ship.bounds, length);
      const radius = safeOrbitRadius(1.9, presentation.radius);
      expect(radius - presentation.radius).toBeGreaterThanOrEqual(planetModel.PLANET_OUTER_RADIUS + 0.119999);
      expect(ship.bounds.getSize(new THREE.Vector3()).z * presentation.scale).toBeCloseTo(length);
    }
    for (const length of [0, -1, Infinity, NaN, 2]) expect(() => presentationScale(ship.bounds, length)).toThrow();
    expect(() => presentationScale(new THREE.Box3(), 0.9)).toThrow();
    expect(() => safeOrbitRadius(NaN, 0.4)).toThrow();
    ship.dispose();
  });
  it('keeps the orbital envelope inside cinematic/overview framing at desktop targets', () => {
    const inclination = 25, direction = new THREE.Vector3(3.2, 2.2, 4.6).normalize();
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize();
    const up = new THREE.Vector3().crossVectors(direction, right).normalize();
    for (const aspect of [1.4, 1.64, 2]) {
      const span = orbitCameraSpan(2.05, 0.48, inclination, aspect, direction);
      for (let phase = 0; phase < Math.PI * 2; phase += 0.12) {
        const ship = new THREE.Group();
        updateOrbitTransform(ship, phase, 2.05, inclination, new THREE.Vector3());
        expect(Math.abs(ship.position.dot(right)) + 0.48).toBeLessThan(span * aspect);
        expect(Math.abs(ship.position.dot(up)) + 0.48).toBeLessThan(span);
      }
    }
  });
  it('distinguishes foreground, behind-planet and off-limb positions', () => {
    const direction = new THREE.Vector3(0, 0, 1);
    expect(shipCenterOccluded(new THREE.Vector3(0, 0, -2), direction, 1.28)).toBe(true);
    expect(shipCenterOccluded(new THREE.Vector3(0, 0, 2), direction, 1.28)).toBe(false);
    expect(shipCenterOccluded(new THREE.Vector3(2, 0, -2), direction, 1.28)).toBe(false);
  });
});

describe('shared scene model', () => {
  it('reuses both real generators, retains ship buffers and regenerates only the planet when needed', () => {
    const planetFactory = vi.spyOn(planetModel, 'createLabPlanet');
    const shipFactory = vi.spyOn(shipModel, 'createPrototypeShip');
    const model = createSpaceSceneModel(defaults);
    expect(planetFactory).toHaveBeenCalledTimes(1);
    expect(shipFactory).toHaveBeenCalledTimes(1);
    expect(model.root.children).toContain(model.planet.root);
    expect(model.root.children).toContain(model.shipPivot);
    expect(model.shipPivot.children).toContain(model.shipPresentation);
    const hull = model.ship.layers.hull.children[0] as THREE.Mesh;
    const vertices = hull.geometry.getAttribute('position').array.slice();
    const initialPlanet = model.planet;
    const map = initialPlanet.surface.material.map!;
    const onDispose = vi.fn(); map.addEventListener('dispose', onDispose);
    model.setSettings({ ...defaults, shipLength: 1.2, orbitRadius: 1.9, intensity: 3, raw: true });
    expect(planetFactory).toHaveBeenCalledTimes(1);
    expect(model.shipRadius + planetModel.PLANET_OUTER_RADIUS).toBeLessThan(model.radius);
    expect(hull.geometry.getAttribute('position').array).toEqual(vertices);
    model.setSettings({ ...defaults, seed: 'STARZ-002' });
    expect(planetFactory).toHaveBeenCalledTimes(2);
    expect(onDispose).toHaveBeenCalledTimes(1);
    expect(model.planet).not.toBe(initialPlanet);
    const second = model.planet;
    model.setSettings({ ...defaults, family: 'oceanic', seed: 'STARZ-002' });
    expect(planetFactory).toHaveBeenLastCalledWith(expect.objectContaining({ ...PLANET_PRESETS.oceanic.parameters, family: 'oceanic', seed: 'STARZ-002' }));
    expect(model.planet.diagnostics.waterCoverage).not.toBe(second.diagnostics.waterCoverage);
    expect(shipFactory).toHaveBeenCalledTimes(1);
    expect(hull.geometry.getAttribute('position').array).toEqual(vertices);
    model.dispose();
  });
  it('advances visual time and freezes all animation while leaving settings usable', () => {
    const model = createSpaceSceneModel(defaults);
    const initialPhase = model.phase;
    model.update(1);
    expect(model.phase).toBeCloseTo(initialPhase + defaults.orbitSpeed);
    expect(model.planet.root.rotation.y).toBeCloseTo(0.035);
    expect(model.planet.cloudLayer.rotation.y).toBeCloseTo(0.035 * 1.35);
    model.setSettings({ ...defaults, paused: true });
    const pose = model.shipPivot.matrix.clone();
    model.shipPivot.updateMatrix();
    pose.copy(model.shipPivot.matrix);
    const emission = model.ship.coreMaterial.emissiveIntensity;
    model.update(10);
    model.shipPivot.updateMatrix();
    expect(model.shipPivot.matrix).toEqual(pose);
    expect(model.visualTime).toBe(1);
    expect(model.ship.coreMaterial.emissiveIntensity).toBe(emission);
    expect(model.planet.root.rotation.y).toBeCloseTo(0.035);
    model.setSettings({ ...defaults, paused: true, shipVisible: false });
    expect(model.shipPivot.visible).toBe(false);
    expect(() => model.update(NaN)).toThrow();
    model.dispose();
  });
  it('shares the stellar direction with the atmosphere and disposes all model resources once', () => {
    const model = createSpaceSceneModel(defaults);
    const direction = new THREE.Vector3(-1, 2, 3).normalize();
    model.setLightDirection(direction);
    expect(model.planet.atmosphere.material.uniforms.uLight.value).toEqual(direction);
    const materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>(), geometries = new Set<THREE.BufferGeometry>();
    model.root.traverse(object => {
      if (!(object instanceof THREE.Mesh || object instanceof THREE.Line)) return;
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material);
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
      }
    });
    const counts = new Map<object, number>();
    for (const resource of [...materials, ...textures, ...geometries]) resource.addEventListener('dispose', () => counts.set(resource, (counts.get(resource) ?? 0) + 1));
    model.dispose(); model.dispose();
    expect(counts.size).toBe(materials.size + textures.size + geometries.size);
    expect([...counts.values()].every(value => value === 1)).toBe(true);
    expect(model.root.children).toHaveLength(0);
  });
});

it('uses the existing pixel pipeline and isolates the lazy route from the gameplay shell', () => {
  const renderer = readFileSync('frontend/src/spacescenelab/SpaceSceneRenderer.ts', 'utf8');
  expect(renderer).toContain("from '../shipgeometrylab/ShipPixelPipeline'");
  expect(renderer.match(/new THREE.WebGLRenderer/g)).toHaveLength(1);
  const router = readFileSync('frontend/src/app/router.tsx', 'utf8');
  expect(router).toContain("import('../spacescenelab/SpaceSceneLabView')");
  expect(router.indexOf('path="/space-scene-lab"')).toBeLessThan(router.indexOf('element={<AppShell'));
  expect(readFileSync('frontend/src/components/shell/Sidebar.tsx', 'utf8')).not.toContain('space-scene-lab');
});
