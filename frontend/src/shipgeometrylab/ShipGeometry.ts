import * as THREE from 'three';
import { GeometryBuilder, type Point3 } from './GeometryBuilder';
import { appendHull, HULL_SECTIONS, hullSectionAt, sectionRing } from './HullGenerator';
import type { ShipLabSettings } from './shipLabTypes';

function armorPanel(builder: GeometryBuilder, points: Point3[], color: string) {
  const vectors = points.map(point => new THREE.Vector3(...point));
  const normal = new THREE.Vector3().crossVectors(vectors[1].clone().sub(vectors[0]), vectors[2].clone().sub(vectors[0])).normalize();
  const outer = vectors.map(vertex => vertex.clone().addScaledVector(normal, 0.038).toArray() as [number, number, number]);
  builder.quad(outer[0], outer[1], outer[2], outer[3], color);
  for (let index = 0; index < 4; index++) {
    const next = (index + 1) % 4;
    builder.quad(points[index], points[next], outer[next], outer[index], '#344657');
  }
}

/** One experimental design. Geometry is fixed; controls only change visibility/materials. */
export function createPrototypeShip() {
  const root = new THREE.Group();
  root.name = 'Horizon Prototype — Exploration Corvette';
  const hull = appendHull(new GeometryBuilder(), HULL_SECTIONS, '#526e84');
  const armor = new GeometryBuilder(), engines = new GeometryBuilder(), nozzles = new GeometryBuilder();
  const emission = new GeometryBuilder(), details = new GeometryBuilder(), windows = new GeometryBuilder(), lights = new GeometryBuilder();

  // The command module intersects the main hull; its fore windows stay corvette-scale.
  appendHull(hull, [
    { z: -3.45, width: 0.58, height: 0.22, y: 0.39, bevel: 0.3 },
    { z: -2.7, width: 0.88, height: 0.38, y: 0.58, bevel: 0.25 },
    { z: -1.45, width: 0.86, height: 0.32, y: 0.65, bevel: 0.25 },
    { z: -0.95, width: 0.6, height: 0.2, y: 0.55, bevel: 0.25 },
  ], '#455e74');
  windows.quad([-0.22, 0.61, -3.16], [-0.29, 0.70, -2.91], [0.29, 0.70, -2.91], [0.22, 0.61, -3.16], '#76d4e5');
  details.beam([0, 0.616, -3.16], [0, 0.711, -2.9], 0.025, '#162b3b');
  details.taperedBox([0, 0.84, -1.9], [0.52, 0.16, 0.5], 0.36, 0.34, '#a7b9c6');

  const bands = [[-4.8, -3.65], [-3.38, -1.8], [-1.5, 0.3], [0.62, 2.2], [2.55, 3.38]];
  for (const [start, end] of bands) {
    const a = sectionRing(hullSectionAt(start)), b = sectionRing(hullSectionAt(end));
    for (const face of [0, 1, 3, 5, 6, 7]) {
      const next = (face + 1) % 8;
      const tone = face === 7 ? (start < -3.5 || start > 2 ? '#a5b7c4' : '#748c9f') : face === 0 || face === 6 ? '#7e97aa' : '#677e90';
      armorPanel(armor, [a[face], a[next], b[next], b[face]], tone);
    }
  }

  // Substantial lateral roots, not free-floating wings; short aft strakes define the rear silhouette.
  for (const side of [-1, 1]) {
    hull.beam([side * 0.78, -0.08, 1.8], [side * 1.35, -0.14, 3.48], 0.38, '#263e53');
    hull.push(new THREE.Matrix4().makeTranslation(side * 1.18, -0.18, 0));
    appendHull(hull, [
      { z: 0.8, width: 0.18, height: 0.2, y: 0, bevel: 0.25 },
      { z: 2.0, width: 0.62, height: 0.64, y: 0, bevel: 0.25 },
      { z: 3.8, width: 0.72, height: 0.72, y: 0, bevel: 0.3 },
      { z: 4.15, width: 0.64, height: 0.64, y: 0, bevel: 0.25 },
    ], '#405c73');
    hull.pop();
    armor.taperedBox([side * 1.22, 0.19, 2.8], [0.48, 0.13, 1.9], 0.4, 1.65, '#90a6b6');
    for (let index = 0; index < 6; index++) {
      details.box([side * 1.23, 0.271, 2.2 + index * 0.19], [0.28, 0.025, 0.065], '#172c3c');
    }
    // Dorsal radiator/sensor strake, kept close to its hull root.
    const finA: Point3 = [side * 0.82, 0.22, 2.45], finB: Point3 = [side * 1.82, 0.56, 3.9];
    hull.beam(finA, finB, 0.16, '#435e73');
    const fin: Point3[] = [[side * 0.86, 0.28, 2.5], [side * 1.86, 0.60, 3.9], [side * 1.86, 0.60, 4.17], [side * 1.03, 0.3344, 3.72]];
    armorPanel(hull, side < 0 ? fin : fin.reverse(), '#435e73');
    armor.beam([side * 0.9, 0.35, 2.52], [side * 1.74, 0.64, 3.87], 0.055, '#a4b8c6');
    for (let index = 0; index < 3; index++) {
      const z = -0.7 + index * 0.29;
      const section = hullSectionAt(z);
      details.box([side * (section.width / 2 + 0.018), -0.13, z], [0.03, 0.12, 0.14], '#121f2b');
      lights.box([side * (section.width / 2 + 0.038), -0.08, z], [0.018, 0.045, 0.09], '#b0dfec');
    }
    details.beam([side * 0.45, 0.65, 0.72], [side * 0.62, 1.04, 1.1], 0.04, '#899eac');
    details.box([side * 0.62, 1.04, 1.1], [0.14, 0.08, 0.22], '#213749');
    const service = hullSectionAt(-2.45);
    details.box([side * (service.width / 2 + 0.04), -0.04, -2.45], [0.035, 0.19, 0.5], '#172a3a');
    for (let index = 0; index < 3; index++) details.box([side * (service.width / 2 + 0.065), -0.04, -2.6 + index * 0.15], [0.02, 0.1, 0.03], '#8ea3b3');
    lights.box([side * 1.79, 0.57, 3.88], [0.055, 0.055, 0.14], '#c7e1e7');
  }
  details.taperedBox([0, -0.53, -0.3], [0.7, 0.2, 1.75], 0.55, 1.5, '#22394c');
  for (let index = 0; index < 8; index++) {
    details.box([0, 0.655, 0.1 + index * 0.23], [0.5, 0.025, 0.055], '#1a2b3b');
  }
  details.taperedBox([0, 0.68, 2.0], [0.34, 0.07, 0.55], 0.29, 0.48, '#243b50');
  details.beam([0.33, 0.63, 1.3], [0.33, 1.18, 1.4], 0.025, '#a2b4bd');
  details.cylinder([0, -0.17, -5.84], 0.075, 0.12, '#192f42', 0.075, 8);
  lights.cylinder([0, -0.17, -5.905], 0.045, 0.015, '#b8ecf4', 0.045, 8);

  // Three attached housings, with open nozzle lips, interior walls and recessed emissive cores.
  for (const [x, y, radius] of [[-0.91, -0.22, 0.47], [0.91, -0.22, 0.47], [0, 0.52, 0.41]]) {
    engines.cylinder([x, y, 3.93], radius * 0.85, 0.85, '#334d62', radius, 12);
    engines.cylinder([x, y, 4.45], radius * 1.04, 0.25, '#8498a7', radius * 1.04, 12);
    engines.cylinder([x, y, 4.92], radius, 0.7, '#253b4c', radius * 0.88, 12, false);
    for (let segment = 0; segment < 12; segment++) {
      const a = segment / 12 * Math.PI * 2, b = (segment + 1) / 12 * Math.PI * 2;
      const ring = (angle: number, r: number, z: number): Point3 => [x + Math.cos(angle) * r, y + Math.sin(angle) * r, z];
      nozzles.quad(ring(a, radius * 0.88, 5.27), ring(b, radius * 0.88, 5.27), ring(b, radius * 0.69, 5.27), ring(a, radius * 0.69, 5.27), '#7b94a5');
      nozzles.quad(ring(a, radius * 0.69, 5.27), ring(b, radius * 0.69, 5.27), ring(b, radius * 0.46, 4.86), ring(a, radius * 0.46, 4.86), '#122736');
    }
    emission.cylinder([x, y, 4.86], radius * 0.46, 0.028, '#9cdde7', radius * 0.46, 16);
    nozzles.cylinder([x, y, 4.9], radius * 0.15, 0.04, '#152c3c', radius * 0.15, 8);
    for (let spoke = 0; spoke < 4; spoke++) {
      const angle = spoke * Math.PI / 2;
      nozzles.beam([x, y, 4.91], [x + Math.cos(angle) * radius * 0.44, y + Math.sin(angle) * radius * 0.44, 4.91], 0.018, '#345263');
    }
    for (let index = 0; index < 4; index++) {
      const angle = index * Math.PI / 2;
      engines.beam([x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, 4.36], [x + Math.cos(angle) * radius * 0.94, y + Math.sin(angle) * radius * 0.94, 4.98], 0.045, '#99aebb');
    }
  }

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
