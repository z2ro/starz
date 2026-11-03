import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createMoon, moonCraters, moonSurface } from '../frontend/src/spacescenelab/Moon';
import { cityEligibility, generateCityLights, nightMask } from '../frontend/src/spacescenelab/NightLights';
import { createOrbitalStation } from '../frontend/src/spacescenelab/OrbitalStation';
import { livingOrbitRadii } from '../frontend/src/spacescenelab/LivingWorld';
import { createSpaceSceneModel } from '../frontend/src/spacescenelab/SpaceSceneModel';
import { DEFAULT_SPACE_SETTINGS as defaults } from '../frontend/src/spacescenelab/spaceSceneTypes';
import { DEFAULT_PLANET_LAB_SETTINGS, PLANET_PRESETS } from '../frontend/src/planetlab/planetLabTypes';
import { samplePlanet, seedNumber } from '../frontend/src/planetlab/planetGenerator';
import { disposeLabObject } from '../frontend/src/planetlab/PlanetModel';

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData: () => undefined } as unknown as CanvasRenderingContext2D);
});
afterEach(() => vi.restoreAllMocks());

it('builds a finite, closed moon with reproducible craters and bounded relief', () => {
  const a = createMoon('STARZ-001'), b = createMoon('STARZ-001'), c = createMoon('STARZ-002');
  expect(a.geometry.attributes.position.array).toEqual(b.geometry.attributes.position.array);
  expect(a.geometry.attributes.position.array).not.toEqual(c.geometry.attributes.position.array);
  for (const key of ['position', 'normal', 'color']) expect([...a.geometry.attributes[key].array].every(Number.isFinite)).toBe(true);
  const bounds = new THREE.Box3().setFromObject(a).getSize(new THREE.Vector3());
  const vertices = a.geometry.attributes.position;
  for (let index = 0; index < vertices.count; index++) {
    const radius = Math.hypot(vertices.getX(index), vertices.getY(index), vertices.getZ(index));
    expect(radius).toBeGreaterThan(0.91999); expect(radius).toBeLessThan(1.026);
  }
  expect(bounds.toArray().every(value => value > 1.85 && value < 2.15)).toBe(true);
  for (const crater of moonCraters('STARZ-001')) {
    expect(crater.center.length()).toBeCloseTo(1);
    const sample = moonSurface(crater.center, [crater], seedNumber('STARZ-001'));
    expect(sample.height).toBeLessThan(0);
    expect(Object.values(sample).every(Number.isFinite)).toBe(true);
  }
  for (const moon of [a, b, c]) { moon.geometry.dispose(); moon.material.dispose(); }
});

it('generates clustered, deterministic lights only on climate-eligible land, never oceans or ice', () => {
  const settings = { ...DEFAULT_PLANET_LAB_SETTINGS };
  const a = generateCityLights(settings), b = generateCityLights(settings);
  expect(a).toEqual(b); expect(a.strengths.length).toBeGreaterThan(10);
  expect(a).not.toEqual(generateCityLights({ ...settings, seed: 'STARZ-002' }));
  const direction = new THREE.Vector3();
  for (let index = 0; index < a.positions.length; index += 3) {
    direction.fromArray(a.positions, index).normalize();
    const sample = samplePlanet(direction, settings);
    expect(sample.land).toBe(true); expect(sample.ice).toBe(false);
    expect(cityEligibility(sample, direction.y, 'terran')).toBeGreaterThan(0);
  }
  for (const family of ['oceanic', 'desert', 'frozen'] as const) {
    const data = generateCityLights({ ...settings, ...PLANET_PRESETS[family].parameters, family }, 12000);
    expect([...data.positions, ...data.strengths].every(Number.isFinite)).toBe(true);
    if (family === 'frozen') expect(data.positions).toHaveLength(0);
  }
});

it('suppresses emission on the dayside and smoothly reveals it beyond twilight', () => {
  expect(nightMask(1)).toBe(0); expect(nightMask(0)).toBe(0);
  expect(nightMask(-0.14)).toBeCloseTo(0.5);
  expect(nightMask(-1)).toBe(1);
  const sun = new THREE.Vector3(0, 0, 1), normal = new THREE.Vector3(0, 0, 1);
  expect(nightMask(normal.dot(sun))).toBe(0);
  normal.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
  expect(nightMask(normal.dot(sun))).toBe(1);
});

it('batches the connected station into three valid meshes with no individual real lights', () => {
  const station = createOrbitalStation();
  expect(station.root.children).toHaveLength(3);
  for (const object of station.root.children) {
    expect(object).toBeInstanceOf(THREE.Mesh);
    const geometry = (object as THREE.Mesh).geometry;
    expect([...geometry.attributes.position.array, ...geometry.attributes.normal.array].every(Number.isFinite)).toBe(true);
    expect([...geometry.index!.array].every(index => index < geometry.attributes.position.count)).toBe(true);
  }
  expect(station.bounds.getSize(new THREE.Vector3()).toArray().every(value => value > 0)).toBe(true);
  expect(station.bounds.getCenter(new THREE.Vector3()).length()).toBeLessThan(1e-8);
  disposeLabObject(station.root);
});

it('separates complete orbital shells at all exposed ship and secondary scales', () => {
  for (const orbit of [1.9, 2.05, 3.8]) for (const ship of [0.22, 0.65]) for (const station of [0.14, 0.36]) for (const moon of [0.12, 0.37]) {
    const radii = livingOrbitRadii(orbit, ship, station, moon);
    expect(radii.station - station - orbit - ship).toBeCloseTo(0.14);
    expect(radii.moon - moon - radii.station - station).toBeCloseTo(0.18);
  }
});

it('animates independent orbits, pauses all additions, switches visibility and disposes each resource once', () => {
  const model = createSpaceSceneModel(defaults);
  const moonPosition = model.living.moonPivot.position.clone(), stationPosition = model.living.stationPivot.position.clone();
  model.update(2);
  expect(model.living.moonPivot.position.distanceTo(moonPosition)).toBeGreaterThan(0);
  expect(model.living.stationPivot.position.distanceTo(stationPosition)).toBeGreaterThan(0);
  model.setSettings({ ...defaults, paused: true, moonVisible: false, stationVisible: false, cityVisible: false });
  expect(model.living.moonPivot.visible).toBe(false); expect(model.living.stationPivot.visible).toBe(false); expect(model.living.cities.visible).toBe(false);
  const pose = model.living.moonPivot.position.clone(), rotation = model.living.moon.rotation.y, emission = model.living.station.navigation.emissiveIntensity;
  model.update(20);
  expect(model.living.moonPivot.position).toEqual(pose); expect(model.living.moon.rotation.y).toBe(rotation); expect(model.living.station.navigation.emissiveIntensity).toBe(emission);
  const sun = new THREE.Vector3(1, 2, 3).normalize(); model.setLightDirection(sun);
  expect(model.living.cities.material.uniforms.uSun.value).toEqual(sun);
  const resources = new Set<THREE.BufferGeometry | THREE.Material>();
  model.living.root.traverse(object => { if (object instanceof THREE.Mesh) { resources.add(object.geometry); resources.add(object.material as THREE.Material); } });
  resources.add(model.living.cities.geometry); resources.add(model.living.cities.material);
  const counters = [...resources].map(resource => { const spy = vi.fn(); resource.addEventListener('dispose', spy); return spy; });
  model.dispose(); model.dispose();
  for (const spy of counters) expect(spy).toHaveBeenCalledTimes(1);
});

it('disposes replaced moon/city geometry and preserves sunlight after seed/family changes', () => {
  const model = createSpaceSceneModel(defaults), sun = new THREE.Vector3(0, 1, 0);
  model.setLightDirection(sun);
  const moonDispose = vi.spyOn(model.living.moon.geometry, 'dispose'), cityDispose = vi.spyOn(model.living.cities.geometry, 'dispose');
  const previous = model.living.moon.geometry.attributes.position.array.slice();
  model.setSettings({ ...defaults, seed: 'STARZ-005', family: 'frozen' });
  expect(moonDispose).toHaveBeenCalledTimes(1); expect(cityDispose).toHaveBeenCalledTimes(1);
  expect(model.living.moon.geometry.attributes.position.array).not.toEqual(previous);
  expect(model.living.cities.geometry.attributes.position.count).toBe(0);
  expect(model.living.cities.material.uniforms.uSun.value).toEqual(sun);
  model.dispose();
});
