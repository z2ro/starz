import * as THREE from 'three';
import { createLabPlanet, disposeLabObject } from '../planetlab/PlanetModel';
import { DEFAULT_PLANET_LAB_SETTINGS, PLANET_PRESETS } from '../planetlab/planetLabTypes';
import { createPrototypeShip } from '../shipgeometrylab/ShipGeometry';
import { DEFAULT_SHIP_SETTINGS } from '../shipgeometrylab/shipLabTypes';
import { presentationScale, safeOrbitRadius, updateOrbitTransform } from './orbit';
import type { SpaceSceneSettings } from './spaceSceneTypes';

const planetSettings = (settings: SpaceSceneSettings) => ({ ...DEFAULT_PLANET_LAB_SETTINGS, ...PLANET_PRESETS[settings.family].parameters, family: settings.family, seed: settings.seed });

export function createSpaceSceneModel(initial: SpaceSceneSettings) {
  const root = new THREE.Group();
  root.name = 'Space Scene Lab';
  let settings = initial;
  let planet = createLabPlanet(planetSettings(initial));
  planet.root.name = 'Procedural planet';
  const ship = createPrototypeShip();
  const shipPivot = new THREE.Group(), shipPresentation = new THREE.Group();
  shipPivot.name = 'Orbital presentation';
  ship.root.position.copy(ship.bounds.getCenter(new THREE.Vector3())).negate();
  shipPresentation.add(ship.root);
  shipPivot.add(shipPresentation);
  ship.root.traverse(object => {
    if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; }
  });
  const positions = [];
  for (let index = 0; index < 128; index++) { const angle = index / 128 * Math.PI * 2; positions.push(Math.cos(angle), 0, Math.sin(angle)); }
  const orbitLine = new THREE.LineLoop(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)), new THREE.LineBasicMaterial({ color: '#466174', transparent: true, opacity: 0.24, depthWrite: false }));
  orbitLine.name = 'Presentation orbit';
  root.add(planet.root, shipPivot, orbitLine);
  let radius = initial.orbitRadius, shipRadius = 0;
  let visualTime = 0, phase = 1.85, disposed = false;
  const tangent = new THREE.Vector3();

  const applyPresentation = () => {
    const presentation = presentationScale(ship.bounds, settings.shipLength);
    shipPresentation.scale.setScalar(presentation.scale);
    shipRadius = presentation.radius;
    radius = safeOrbitRadius(settings.orbitRadius, shipRadius);
    shipPivot.visible = settings.shipVisible;
    ship.update({ ...DEFAULT_SHIP_SETTINGS, engineEmission: settings.engineEmission });
    ship.coreMaterial.emissiveIntensity = settings.engineEmission * (1 + Math.sin(visualTime * 1.6) * 0.035);
    orbitLine.scale.setScalar(radius);
    orbitLine.rotation.x = -THREE.MathUtils.degToRad(settings.orbitInclination);
    updateOrbitTransform(shipPivot, phase, radius, settings.orbitInclination, tangent);
  };
  applyPresentation();

  return {
    root, ship, shipPivot, shipPresentation, orbitLine,
    get planet() { return planet; },
    get radius() { return radius; },
    get shipRadius() { return shipRadius; },
    get phase() { return phase; },
    get visualTime() { return visualTime; },
    setSettings(next: SpaceSceneSettings) {
      if (disposed) return;
      if (next.seed !== settings.seed || next.family !== settings.family || next.regeneration !== settings.regeneration) {
        const replacement = createLabPlanet(planetSettings(next));
        root.remove(planet.root);
        disposeLabObject(planet.root);
        planet = replacement;
        planet.root.name = 'Procedural planet';
        root.add(planet.root);
        planet.root.rotation.y = visualTime * DEFAULT_PLANET_LAB_SETTINGS.planetRotationSpeed;
        planet.cloudLayer.rotation.y = visualTime * DEFAULT_PLANET_LAB_SETTINGS.planetRotationSpeed * 1.35;
      }
      settings = next;
      applyPresentation();
    },
    update(delta: number) {
      if (!Number.isFinite(delta) || delta < 0) throw new RangeError('Invalid visual delta');
      if (disposed || settings.paused) return;
      visualTime += delta;
      phase = (phase + delta * settings.orbitSpeed) % (Math.PI * 2);
      planet.root.rotation.y = visualTime * DEFAULT_PLANET_LAB_SETTINGS.planetRotationSpeed;
      planet.cloudLayer.rotation.y = visualTime * DEFAULT_PLANET_LAB_SETTINGS.planetRotationSpeed * 1.35;
      updateOrbitTransform(shipPivot, phase, radius, settings.orbitInclination, tangent);
      ship.coreMaterial.emissiveIntensity = settings.engineEmission * (1 + Math.sin(visualTime * 1.6) * 0.035);
    },
    setLightDirection(direction: THREE.Vector3) { planet.atmosphere.material.uniforms.uLight.value.copy(direction); },
    dispose() {
      if (disposed) return;
      disposed = true;
      disposeLabObject(planet.root);
      ship.dispose();
      orbitLine.geometry.dispose();
      orbitLine.material.dispose();
      root.clear();
    },
  };
}
