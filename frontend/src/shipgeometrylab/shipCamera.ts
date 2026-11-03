import * as THREE from 'three';
import type { ShipCamera } from './shipLabTypes';

export const SHIP_CAMERA_DIRECTIONS: Record<ShipCamera, readonly [number, number, number]> = {
  '3/4 Front': [-1.25, 0.85, -1.1], Side: [-1, 0.06, 0], Top: [0, 1, 0.001], Rear: [0, 0.08, 1], '3/4 Rear': [-1.2, 0.7, 1.25],
};

export function shipFraming(bounds: THREE.Box3, aspect: number, direction: THREE.Vector3) {
  if (bounds.isEmpty() || !Number.isFinite(aspect) || aspect <= 0 || !direction.toArray().every(Number.isFinite) || direction.lengthSq() < 1e-12) throw new Error('Invalid camera framing');
  const center = bounds.getCenter(new THREE.Vector3());
  const forward = direction.clone().normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), forward).normalize();
  if (right.lengthSq() < 0.5) right.set(1, 0, 0);
  const up = new THREE.Vector3().crossVectors(forward, right).normalize();
  let horizontal = 0, vertical = 0;
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    const corner = new THREE.Vector3(x, y, z).sub(center);
    horizontal = Math.max(horizontal, Math.abs(corner.dot(right)));
    vertical = Math.max(vertical, Math.abs(corner.dot(up)));
  }
  const halfHeight = Math.max(vertical / 0.72, horizontal / aspect / 0.72);
  const distance = bounds.getSize(new THREE.Vector3()).length() * 3;
  return { center, position: center.clone().addScaledVector(forward, distance), halfHeight, distance };
}
