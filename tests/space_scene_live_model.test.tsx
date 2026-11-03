import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import * as planets from '../frontend/src/planetlab/PlanetModel';
import * as vessels from '../frontend/src/shipgeometrylab/ShipGeometry';
import * as lights from '../frontend/src/spacescenelab/NightLights';
import { createVisualDescriptor } from '../frontend/src/visual-state/VisualStateAdapter';
import { createLiveSceneModel } from '../frontend/src/space-scene-live/LiveSceneModel';
import { geographicKey, liveGeneration } from '../frontend/src/space-scene-live/livePresentation';
import { liveCatalog, realSnapshot, localFleetSnapshot, emptySnapshot, transitSnapshot, incompleteSnapshot } from './fixtures/liveSnapshots';

beforeEach(() => vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData: () => undefined } as unknown as CanvasRenderingContext2D));
afterEach(() => vi.restoreAllMocks());
const adapt = (state: ReturnType<typeof realSnapshot>) => createVisualDescriptor(state, liveCatalog);

it('uses exact adapter generation values and stable geography across population updates', () => {
  const factory = vi.spyOn(planets, 'createLabPlanet'), cityFactory = vi.spyOn(lights, 'createNightLights');
  const model = createLiveSceneModel(), state = realSnapshot(), descriptor = adapt(state);
  model.setDescriptor(descriptor);
  expect(factory).toHaveBeenLastCalledWith(expect.objectContaining({ seed: descriptor.identity.seed, family: descriptor.planet.family, ...descriptor.planet.parameters }));
  const planet = model.planet, geometry = planet!.surface.geometry;
  const cityGeometry = model.cities!.geometry;
  const changed = adapt({ ...state, population: { total: 0 } });
  expect(geographicKey(changed)).toBe(geographicKey(descriptor));
  model.setDescriptor(changed); expect(model.cities!.visible).toBe(false);
  model.setDescriptor(adapt({ ...state, population: { total: 20 } }));
  expect(model.cities!.visible).toBe(true); expect(model.cities!.geometry).toBe(cityGeometry);
  expect(factory).toHaveBeenCalledTimes(1); expect(cityFactory).toHaveBeenCalledTimes(1);
  expect(model.planet).toBe(planet); expect(model.planet!.surface.geometry).toBe(geometry);
  expect(model.generationCount).toBe(1); model.dispose();
});

it('does not create fictional ships or lights for empty, unready, transit or incomplete snapshots', () => {
  const shipFactory = vi.spyOn(vessels, 'createPrototypeShip'), cityFactory = vi.spyOn(lights, 'createNightLights');
  const model = createLiveSceneModel();
  model.setDescriptor(adapt(emptySnapshot())); expect(model.cities).toBeNull(); expect(model.ship).toBeNull();
  model.setDescriptor(adapt(transitSnapshot())); expect(model.ship).toBeNull();
  model.setDescriptor(adapt(realSnapshot())); expect(model.ship).toBeNull(); // remote fleet + free ship without observedAt
  model.setDescriptor(adapt(incompleteSnapshot())); expect(model.root.visible).toBe(false);
  expect(shipFactory).not.toHaveBeenCalled(); expect(cityFactory).toHaveBeenCalledTimes(1);
  expect(liveGeneration(adapt(incompleteSnapshot()))).toBeNull(); model.dispose();
});

it('creates one identified compatible representative only for proved local presence, no orbit', () => {
  const factory = vi.spyOn(vessels, 'createPrototypeShip'), model = createLiveSceneModel(), state = localFleetSnapshot();
  model.setDescriptor(adapt(state)); const ship = model.ship!;
  const display = ship.root.parent!;
  expect(display.userData.shipId).toBe(state.fleets![0].ship_ids![0]);
  expect(display.visible).toBe(true); expect(ship.coreMaterial.emissiveIntensity).toBe(0);
  const pose = display.position.clone(), rotation = display.quaternion.clone();
  model.update(1, false, 300); expect(display.position).toEqual(pose); expect(display.quaternion.equals(rotation)).toBe(true);
  model.setDescriptor(adapt(transitSnapshot())); expect(display.visible).toBe(false);
  model.setDescriptor(adapt(state)); expect(display.visible).toBe(true); expect(factory).toHaveBeenCalledTimes(1);
  const unknown = { ...state, ships: state.ships!.map(value => ({ ...value, hull_id: 'unmapped' })) };
  model.setDescriptor(adapt(unknown)); expect(display.visible).toBe(false); expect(factory).toHaveBeenCalledTimes(1);
  const names: string[] = []; model.root.traverse(object => names.push(object.name));
  expect(names.join(' ')).not.toMatch(/moon|station|orbit/i); model.dispose();
});

it('clears the previous presentation during a switch and releases old geography once', () => {
  const model = createLiveSceneModel(), state = realSnapshot(); model.setDescriptor(adapt(state));
  const geometry = model.planet!.surface.geometry, onDispose = vi.fn(); geometry.addEventListener('dispose', onDispose);
  model.setDescriptor(null); expect(model.root.visible).toBe(false);
  model.setDescriptor(adapt(state)); expect(model.generationCount).toBe(1);
  const other = { ...state, active_planet: { id: 'different-planet', planet_index: 1 }, planets: [] };
  model.setDescriptor(adapt(other)); expect(model.root.visible).toBe(true);
  expect(model.generationCount).toBe(2); expect(onDispose).toHaveBeenCalledTimes(1);
  expect(model.planet!.surface.geometry).not.toBe(geometry); model.dispose();
});

it('updates atmosphere and city uniforms in place, pauses rotation and deduplicates disposal', () => {
  const model = createLiveSceneModel(); const descriptor = adapt(localFleetSnapshot()); model.setDescriptor(descriptor);
  const sun = new THREE.Vector3(-1, 2, 3).normalize(); model.setLightDirection(sun);
  expect(model.cities!.material.uniforms.uSun.value).toEqual(sun);
  expect(model.planet!.atmosphere.material.uniforms.uLight.value).toEqual(sun);
  model.update(2, false, 250); const rotation = model.planet!.root.rotation.y;
  model.update(5, true, 250); expect(model.planet!.root.rotation.y).toBe(rotation);
  model.setDescriptor({ ...descriptor, planet: { ...descriptor.planet, atmosphere: { ...descriptor.planet.atmosphere, visible: false } } });
  expect(model.planet!.atmosphere.visible).toBe(false); expect(model.generationCount).toBe(1);
  const resources = new Set<THREE.BufferGeometry | THREE.Material | THREE.Texture>();
  model.root.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.Points) { resources.add(object.geometry); for (const m of Array.isArray(object.material) ? object.material : [object.material]) { resources.add(m); Object.values(m).forEach(value => { if (value instanceof THREE.Texture) resources.add(value); }); } } });
  const spies = [...resources].map(resource => { const spy = vi.fn(); resource.addEventListener('dispose', spy); return spy; });
  model.dispose(); model.dispose(); spies.forEach(spy => expect(spy).toHaveBeenCalledTimes(1));
});
