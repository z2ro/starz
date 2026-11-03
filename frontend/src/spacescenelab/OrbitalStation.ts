import * as THREE from 'three';
import { GeometryBuilder } from '../shipgeometrylab/GeometryBuilder';

/** Batched, connected service outpost; no gameplay identity or construction contract. */
export function createOrbitalStation() {
  const root = new THREE.Group(); root.name = 'Experimental orbital service outpost';
  const structure = new GeometryBuilder(), panels = new GeometryBuilder(), lights = new GeometryBuilder();
  structure.cylinder([0, 0, 0], 0.2, 1.35, '#8098a8', 0.2, 12);
  structure.cylinder([0, 0, -0.6], 0.26, 0.12, '#bccbd0', 0.26, 12);
  structure.cylinder([0, 0, 0.6], 0.26, 0.12, '#bccbd0', 0.26, 12);
  for (const side of [-1, 1]) {
    structure.beam([0, 0, 0], [side * 0.65, 0, 0], 0.1, '#526d80');
    structure.cylinder([side * 0.47, 0, 0], 0.14, 0.65, '#9cabb1', 0.14, 8);
    structure.beam([0, 0, 0.35], [side * 0.65, 0, 0.55], 0.055, '#8095a1');
    structure.cylinder([side * 0.65, 0, 0.65], 0.1, 0.2, '#b1c7ce', 0.1, 8);
    lights.cylinder([side * 0.65, 0, 0.76], 0.06, 0.018, '#a5dce5', 0.06, 8);
    structure.beam([0, 0, -0.25], [side * 1.12, 0, -0.25], 0.055, '#758a98');
    for (let row = 0; row < 4; row++) {
      panels.box([side * 0.99, 0, -0.79 + row * 0.27], [0.58, 0.035, 0.245], row % 2 ? '#234459' : '#304e63');
      structure.beam([side * 0.7, 0.025, -0.9 + row * 0.27], [side * 1.28, 0.025, -0.9 + row * 0.27], 0.015, '#738f9f');
    }
    lights.box([side * 1.28, 0.04, -0.9], [0.045, 0.045, 0.045], '#b2d6de');
  }
  structure.beam([0, 0, -0.5], [0, 0.4, -0.5], 0.035, '#9eb3be');
  structure.box([0, 0.4, -0.5], [0.25, 0.06, 0.12], '#526f82');
  const add = (builder: GeometryBuilder, material: THREE.MeshStandardMaterial) => {
    const mesh = new THREE.Mesh(builder.build(), material); mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh);
  };
  add(structure, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.28, flatShading: true }));
  add(panels, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.3 }));
  const navigation = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: '#80b5bd', emissiveIntensity: 0.8, roughness: 0.7 });
  add(lights, navigation);
  const bounds = new THREE.Box3().setFromObject(root), center = bounds.getCenter(new THREE.Vector3());
  for (const mesh of root.children) mesh.position.sub(center);
  bounds.translate(center.negate());
  return { root, navigation, bounds };
}
