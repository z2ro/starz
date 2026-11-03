import * as THREE from 'three';
import { PLANET_OUTER_RADIUS } from '../planetlab/PlanetModel';

export function presentationScale(bounds: THREE.Box3, length: number) {
  const size = bounds.getSize(new THREE.Vector3());
  if (!Number.isFinite(length) || length <= 0 || length > 1.2 || !size.toArray().every(value => Number.isFinite(value) && value > 0)) throw new RangeError('Invalid ship presentation scale');
  const scale = length / size.z;
  return { scale, radius: size.length() * scale / 2 };
}

export function safeOrbitRadius(requested: number, shipRadius: number) {
  if (!Number.isFinite(requested) || !Number.isFinite(shipRadius) || requested <= 0 || shipRadius <= 0) throw new RangeError('Invalid orbit radius');
  return Math.max(requested, PLANET_OUTER_RADIUS + shipRadius + 0.12);
}

export function updateOrbitTransform(object: THREE.Object3D, phase: number, radius: number, inclination: number, tangent: THREE.Vector3) {
  if (![phase, radius, inclination].every(Number.isFinite) || radius <= 0) throw new RangeError('Invalid orbit');
  const tilt = THREE.MathUtils.degToRad(inclination);
  const cosine = Math.cos(phase), sine = Math.sin(phase);
  object.position.set(radius * cosine, radius * sine * Math.sin(tilt), radius * sine * Math.cos(tilt));
  tangent.set(-sine, cosine * Math.sin(tilt), cosine * Math.cos(tilt)).normalize();
  // Keep dorsal +Y aligned to the orbital normal; no roll flips across a full orbit.
  object.rotation.set(-tilt, Math.PI - phase, 0, 'XYZ');
}

/** Diagnostic for the ship center; actual mesh occlusion is handled by the depth buffer. */
export function shipCenterOccluded(position: THREE.Vector3, cameraDirection: THREE.Vector3, planetRadius: number) {
  const alongView = position.dot(cameraDirection);
  return alongView < 0 && position.lengthSq() - alongView * alongView < planetRadius * planetRadius;
}

export function orbitCameraSpan(radius: number, shipRadius: number, inclination: number, aspect: number, direction: THREE.Vector3, overview = false) {
  if (aspect <= 0 || !Number.isFinite(aspect) || direction.lengthSq() < 1e-12) throw new RangeError('Invalid scene framing');
  const forward = direction.clone().normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), forward).normalize();
  if (right.lengthSq() < 0.5) right.set(1, 0, 0);
  const up = new THREE.Vector3().crossVectors(forward, right).normalize();
  const tilt = THREE.MathUtils.degToRad(inclination);
  const v = new THREE.Vector3(0, Math.sin(tilt), Math.cos(tilt));
  const x = radius * Math.hypot(right.x, right.dot(v)) + shipRadius;
  const y = radius * Math.hypot(up.x, up.dot(v)) + shipRadius;
  const margin = overview ? 0.75 : 0.9;
  return Math.max(PLANET_OUTER_RADIUS / 0.61, y / margin, x / (aspect * margin));
}
