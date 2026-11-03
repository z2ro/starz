import * as THREE from 'three';
import { disposeLabObject } from '../planetlab/PlanetModel';
import type { PlanetGenerationSettings } from '../planetlab/planetGenerator';
import { createMoon } from './Moon';
import { createNightLights } from './NightLights';
import { createOrbitalStation } from './OrbitalStation';
import { updateOrbitTransform } from './orbit';
import type { SpaceSceneSettings } from './spaceSceneTypes';

export function livingOrbitRadii(shipOrbit: number, shipRadius: number, stationRadius: number, moonRadius: number) {
  const station = shipOrbit + shipRadius + stationRadius + 0.14;
  return { station, moon: station + stationRadius + moonRadius + 0.18 };
}

export function createLivingWorld(generation: PlanetGenerationSettings) {
  const root = new THREE.Group(); root.name = 'Living orbital world';
  const moonPivot = new THREE.Group(), stationPivot = new THREE.Group();
  let moon = createMoon(generation.seed), cities = createNightLights(generation);
  const station = createOrbitalStation();
  moonPivot.add(moon); stationPivot.add(station.root); root.add(moonPivot, stationPivot);
  const stationUnitRadius = station.bounds.getBoundingSphere(new THREE.Sphere()).radius;
  let moonPhase = 0.5, stationPhase = 4.9, moonRadius = 1, stationRadius = 1;
  const tangent = new THREE.Vector3(), sunlight = new THREE.Vector3();
  const position = () => {
    updateOrbitTransform(moonPivot, moonPhase, moonRadius, 35, tangent);
    updateOrbitTransform(stationPivot, stationPhase, stationRadius, 0, tangent);
  };
  return {
    root, moonPivot, stationPivot, station,
    get moon() { return moon; }, get cities() { return cities; },
    get outerRadius() { return moonRadius + moon.scale.x * 1.03; },
    regenerate(next: PlanetGenerationSettings, planet: THREE.Group) {
      const nextMoon = createMoon(next.seed), nextCities = createNightLights(next);
      moonPivot.remove(moon); moon.geometry.dispose(); moon.material.dispose();
      cities.removeFromParent(); disposeLabObject(cities);
      moon = nextMoon; cities = nextCities; moonPivot.add(moon); planet.add(cities);
      cities.material.uniforms.uSun.value.copy(sunlight);
    },
    apply(settings: SpaceSceneSettings, shipOrbit: number, shipRadius: number, time: number) {
      moon.scale.setScalar(settings.moonScale);
      station.root.scale.setScalar(settings.stationScale);
      const radii = livingOrbitRadii(shipOrbit, shipRadius, stationUnitRadius * settings.stationScale, settings.moonScale * 1.03);
      moonRadius = radii.moon; stationRadius = radii.station;
      moonPivot.visible = settings.moonVisible; stationPivot.visible = settings.stationVisible;
      cities.visible = settings.cityVisible;
      cities.material.uniforms.uIntensity.value = settings.cityIntensity;
      moon.rotation.y = time * 0.025;
      station.navigation.emissiveIntensity = 0.8 + Math.sin(time * 1.2) * 0.08;
      position();
    },
    update(delta: number, settings: SpaceSceneSettings, time: number) {
      moonPhase = (moonPhase + delta * settings.moonSpeed) % (Math.PI * 2);
      stationPhase = (stationPhase + delta * settings.stationSpeed) % (Math.PI * 2);
      moon.rotation.y = time * 0.025;
      station.navigation.emissiveIntensity = 0.8 + Math.sin(time * 1.2) * 0.08;
      position();
    },
    setLight(direction: THREE.Vector3) { sunlight.copy(direction); cities.material.uniforms.uSun.value.copy(direction); },
    dispose() { cities.removeFromParent(); disposeLabObject(cities); disposeLabObject(root); },
  };
}
