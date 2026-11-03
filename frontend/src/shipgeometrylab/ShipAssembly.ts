import * as THREE from 'three';
import { GeometryBuilder } from './GeometryBuilder';
import type { ShipLabSettings } from './shipLabTypes';

export type ShipBuilders = Record<'hull' | 'armor' | 'engines' | 'nozzles' | 'emission' | 'details' | 'windows' | 'lights', GeometryBuilder>;

/** Shared batching, materials and lifecycle; recipes retain ownership of shape. */
export function assembleShip(builders: ShipBuilders, name: string) {
  const { hull, armor, engines, nozzles, emission, details, windows, lights } = builders;
  const root = new THREE.Group(); root.name = name;
  const hullMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.68, metalness: 0.28 });
  const armorMaterial = hullMaterial.clone();
  const darkMaterial = hullMaterial.clone();
  const engineMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.5, metalness: 0.4 });
  const coreMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: '#64c9e5', emissiveIntensity: 1.6, roughness: 0.55, metalness: 0.1 });
  const windowMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: '#41899e', emissiveIntensity: 0.4, roughness: 0.35, metalness: 0.15 });
  const lightMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
  const layers = { hull: new THREE.Group(), armor: new THREE.Group(), engines: new THREE.Group(), details: new THREE.Group() };
  const add = (layer: keyof typeof layers, builder: GeometryBuilder, material: THREE.Material, name: string) => {
    const mesh = new THREE.Mesh(builder.build(), material);
    mesh.name = name;
    layers[layer].add(mesh);
  };
  add('hull', hull, hullMaterial, 'Continuous hull / command / structural roots');
  add('armor', armor, armorMaterial, 'Thick armor panels');
  add('engines', engines, engineMaterial, 'Engine housings');
  add('engines', nozzles, darkMaterial, 'Nozzle lips and interiors');
  add('engines', emission, coreMaterial, 'Recessed engine cores');
  add('details', details, darkMaterial, 'Mechanical / sensors / vents');
  add('details', windows, windowMaterial, 'Command observation band');
  add('details', lights, lightMaterial, 'Navigation lights');
  for (const [name, group] of Object.entries(layers)) { group.name = name; root.add(group); }
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const silhouetteMaterial = new THREE.MeshBasicMaterial({ color: '#bed3df' });
  const originalMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  root.traverse(object => { if (object instanceof THREE.Mesh) originalMaterials.set(object, object.material); });
  let disposed = false;

  return {
    root, layers, bounds, coreMaterial,
    update(settings: ShipLabSettings) {
      layers.armor.visible = !settings.hullOnly && settings.armor;
      layers.engines.visible = !settings.hullOnly && settings.engines;
      layers.details.visible = !settings.hullOnly && settings.details;
      hullMaterial.color.setRGB(settings.hullTone, settings.hullTone, settings.hullTone);
      armorMaterial.color.setRGB(settings.armorContrast, settings.armorContrast, settings.armorContrast);
      coreMaterial.emissiveIntensity = settings.engineEmission;
      originalMaterials.forEach((material, mesh) => { mesh.material = settings.silhouette ? silhouetteMaterial : material; });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      const materials = new Set<THREE.Material>([silhouetteMaterial]);
      const geometries = new Set<THREE.BufferGeometry>();
      originalMaterials.forEach((material, mesh) => {
        geometries.add(mesh.geometry);
        for (const item of Array.isArray(material) ? material : [material]) materials.add(item);
      });
      materials.forEach(material => material.dispose());
      geometries.forEach(geometry => geometry.dispose());
      originalMaterials.clear();
      root.clear();
    },
  };
}
