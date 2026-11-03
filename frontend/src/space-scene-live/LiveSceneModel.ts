import * as THREE from 'three';
import { createLabPlanet, disposeLabObject } from '../planetlab/PlanetModel';
import { createNightLights } from '../spacescenelab/NightLights';
import { createPrototypeShip } from '../shipgeometrylab/ShipGeometry';
import { presentationScale } from '../spacescenelab/orbit';
import type { SpaceSceneDescriptor } from '../visual-state/types';
import { geographicKey, liveGeneration, representativeShip } from './livePresentation';

/** Descriptor consumer only: no API, moon/station factories or orbital gameplay. */
export function createLiveSceneModel() {
  const root = new THREE.Group(); root.name = 'Gameplay-driven scene'; root.visible = false;
  const shipDisplay = new THREE.Group(); root.add(shipDisplay);
  let planet: ReturnType<typeof createLabPlanet> | null = null;
  let cities: ReturnType<typeof createNightLights> | null = null;
  let ship: ReturnType<typeof createPrototypeShip> | null = null;
  let key: string | null = null, descriptor: SpaceSceneDescriptor | null = null, disposed = false, visualTime = 0;
  let generationCount = 0;
  const sun = new THREE.Vector3();
  return {
    root,
    get planet() { return planet; }, get cities() { return cities; }, get ship() { return ship; },
    get generationCount() { return generationCount; }, get key() { return key; },
    setDescriptor(next: SpaceSceneDescriptor | null) {
      if (disposed) return;
      descriptor = next;
      const settings = liveGeneration(next), nextKey = geographicKey(next);
      root.visible = settings !== null;
      if (!settings || !next) return;
      if (key !== nextKey) {
        const replacement = createLabPlanet(settings);
        if (planet) { root.remove(planet.root); disposeLabObject(planet.root); }
        planet = replacement; cities = null; key = nextKey; visualTime = 0; generationCount++;
        root.add(planet.root);
      }
      planet!.atmosphere.visible = next.planet.atmosphere.visible;
      planet!.atmosphere.material.uniforms.uColor.value.set(next.planet.atmosphere.color).multiplyScalar(next.planet.atmosphere.strength);
      planet!.atmosphere.material.uniforms.uLight.value.copy(sun);
      if (next.civilization.lightsEnabled && !cities) { cities = createNightLights(settings); planet!.root.add(cities); }
      if (cities) {
        cities.visible = next.civilization.lightsEnabled;
        cities.material.uniforms.uIntensity.value = next.civilization.intensity;
        cities.material.uniforms.uSun.value.copy(sun);
      }
      const selected = representativeShip(next);
      if (selected && !ship) {
        ship = createPrototypeShip();
        ship.root.position.copy(ship.bounds.getCenter(new THREE.Vector3())).negate();
        ship.root.traverse(object => { if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; } });
        ship.coreMaterial.emissiveIntensity = 0;
        shipDisplay.add(ship.root);
      }
      shipDisplay.visible = selected !== null;
      shipDisplay.userData.shipId = selected?.id ?? null;
      if (ship && selected) {
        shipDisplay.scale.setScalar(presentationScale(ship.bounds, next.presentation.shipLength).scale);
        // Display staging only, explicitly DEFAULT in live diagnostics; no orbit is asserted.
        shipDisplay.position.set(-1.85, -0.3, 1);
        shipDisplay.rotation.set(-0.17, 1.3, 0);
      }
    },
    setLightDirection(direction: THREE.Vector3) {
      sun.copy(direction);
      planet?.atmosphere.material.uniforms.uLight.value.copy(sun);
      cities?.material.uniforms.uSun.value.copy(sun);
    },
    update(delta: number, paused: boolean, height: number) {
      if (disposed) return;
      if (cities) cities.material.uniforms.uHeight.value = height;
      if (paused || !root.visible || !planet) return;
      visualTime += delta;
      planet.root.rotation.y = visualTime * 0.035;
      planet.cloudLayer.rotation.y = visualTime * 0.035 * 1.35;
    },
    dispose() {
      if (disposed) return; disposed = true;
      if (planet) disposeLabObject(planet.root);
      ship?.dispose(); root.clear();
    },
  };
}
