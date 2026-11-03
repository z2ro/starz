import * as THREE from 'three';
import { seedNumber } from '../planetlab/planetGenerator';

export type Crater = { center: THREE.Vector3; radius: number; depth: number };

export function moonCraters(seed: string): Crater[] {
  let state = seedNumber(`${seed}:moon`);
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  return Array.from({ length: 64 }, () => {
    const y = random() * 2 - 1, angle = random() * Math.PI * 2, r = Math.sqrt(1 - y * y);
    return { center: new THREE.Vector3(r * Math.cos(angle), y, r * Math.sin(angle)), radius: 0.065 + random() ** 2 * 0.3, depth: 0.014 + random() * 0.035 };
  });
}

export function moonSurface(direction: THREE.Vector3, craters: Crater[], seed: number) {
  const mineral = Math.sin(direction.x * 5 + seed % 101) * Math.sin(direction.z * 4 - direction.y * 3);
  let height = Math.sin(direction.x * 13 + direction.z * 7) * Math.cos(direction.y * 11) * 0.002;
  let shade = 0.4 + mineral * 0.055;
  for (const crater of craters) {
    const distance = direction.distanceTo(crater.center) / crater.radius;
    if (distance > 1.3) continue;
    const bowl = Math.max(0, 1 - distance * distance);
    const rim = Math.exp(-(((distance - 0.98) / 0.12) ** 2));
    height += crater.depth * (-bowl + rim * 0.38);
    shade += -bowl * 0.19 + rim * 0.14;
  }
  return { height: THREE.MathUtils.clamp(height, -0.08, 0.025), shade: THREE.MathUtils.clamp(shade, 0.18, 0.8) };
}

export function createMoon(seed: string) {
  const craters = moonCraters(seed), hash = seedNumber(`${seed}:moon`);
  const geometry = new THREE.SphereGeometry(1, 96, 64);
  const positions = geometry.getAttribute('position'), colors = new Float32Array(positions.count * 3);
  const direction = new THREE.Vector3(), color = new THREE.Color();
  for (let index = 0; index < positions.count; index++) {
    direction.fromBufferAttribute(positions, index).normalize();
    const sample = moonSurface(direction, craters, hash);
    positions.setXYZ(index, direction.x * (1 + sample.height), direction.y * (1 + sample.height), direction.z * (1 + sample.height));
    color.setRGB(sample.shade * 0.65, sample.shade * 0.78, sample.shade * 0.95);
    colors.set(color.toArray(), index * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 }));
  mesh.name = 'Procedural rocky moon'; mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}
