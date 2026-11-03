import * as THREE from 'three';
import { createPrototypeShip } from './ShipGeometry';
import { createWayfarerShip } from './WayfarerGeometry';
import { createVanguardShip } from './VanguardGeometry';
import { shipFraming } from './shipCamera';
import { createSentinelShip } from './SentinelGeometry';
import { createOdysseyShip } from './OdysseyGeometry';
import { createAegisShip } from './AegisGeometry';
import { createSpearheadShip } from './SpearheadGeometry';

export const FLEET_DESIGNS = [
  { id: 'horizon', name: 'Horizon', role: 'Exploration Corvette', summary: 'Casco leve · sensores · três motores', visualLength: 11, create: createPrototypeShip },
  { id: 'wayfarer', name: 'Wayfarer', role: 'Freighter', summary: 'Espinha industrial · oito módulos de carga', visualLength: 16, create: createWayfarerShip },
  { id: 'vanguard', name: 'Vanguard', role: 'Frigate', summary: 'Proa blindada · casamatas · propulsão protegida', visualLength: 18, create: createVanguardShip },
  { id: 'sentinel', name: 'Sentinel', role: 'Destroyer', summary: 'Ombros blindados · sensores protegidos', visualLength: 23, create: createSentinelShip },
  { id: 'odyssey', name: 'Odyssey', role: 'Science Cruiser', summary: 'Observatório · laboratórios · aquisição científica', visualLength: 28, create: createOdysseyShip },
  { id: 'aegis', name: 'Aegis', role: 'Cruiser', summary: 'Plataforma de linha · proteção equilibrada', visualLength: 32, create: createAegisShip },
  { id: 'spearhead', name: 'Spearhead', role: 'Battlecruiser', summary: 'Proa em lança · assalto frontal · seis motores', visualLength: 39, create: createSpearheadShip },
] as const;
export type FleetDesign = typeof FLEET_DESIGNS[number]['id'];
export type FleetSelection = FleetDesign | 'fleet' | 'scale';

/** Lab-only recipes; never a gameplay hull registry. One allocation per design. */
export function createFleetStudy() {
  const root = new THREE.Group();
  const entries = FLEET_DESIGNS.map(design => {
    const ship = design.create(), display = new THREE.Group();
    display.add(ship.root); root.add(display);
    let meshes = 0; ship.root.traverse(object => { if (object instanceof THREE.Mesh) meshes++; });
    return { design, ship, display, meshes };
  });
  const bounds = new THREE.Box3();
  let selection: FleetSelection = 'horizon', meshCount = 0;
  return {
    root, entries, bounds,
    get meshCount() { return meshCount; },
    get selection() { return selection; },
    layout(next: FleetSelection, direction: THREE.Vector3, aspect = 1.6) {
      selection = next;
      const forward = direction.clone().normalize(), right = new THREE.Vector3(0, 1, 0).cross(forward).normalize();
      if (right.lengthSq() < 0.5) right.set(1, 0, 0);
      const up = forward.clone().cross(right).normalize();
      // Separate projected extents, not arbitrary world-axis slots (Side/Top must also work).
      const extents = entries.map(({ design, ship, display }) => {
        const size = ship.bounds.getSize(new THREE.Vector3());
        display.scale.setScalar(next === 'fleet' ? 16 / Math.max(...size.toArray()) : next === 'scale' ? design.visualLength / size.z : 1);
        let min = Infinity, max = -Infinity, low = Infinity, high = -Infinity;
        for (const x of [ship.bounds.min.x, ship.bounds.max.x]) for (const y of [ship.bounds.min.y, ship.bounds.max.y]) for (const z of [ship.bounds.min.z, ship.bounds.max.z]) {
          const point = new THREE.Vector3(x, y, z).multiplyScalar(display.scale.x);
          const p = point.dot(right), v = point.dot(up); min = Math.min(min, p); max = Math.max(max, p); low = Math.min(low, v); high = Math.max(high, v);
        }
        return { width: max - min, height: high - low };
      });
      const gap = 2.5, total = extents.reduce((a, b) => a + b.width, 0) + gap * (entries.length - 1);
      const cellWidth = Math.max(...extents.map(e => e.width)) + gap, cellHeight = Math.max(...extents.map(e => e.height)) + gap + 1;
      let columns = 1, required = Infinity;
      for (let c = 1; c <= entries.length; c++) {
        const span = Math.max(c * cellWidth / (aspect * 0.84), Math.ceil(entries.length / c) * cellHeight / 0.56);
        if (span < required) { required = span; columns = c; }
      }
      const rows = Math.ceil(entries.length / columns);
      let cursor = -total / 2;
      bounds.makeEmpty(); meshCount = 0;
      entries.forEach(({ design, ship, display, meshes }, i) => {
        display.visible = next === 'fleet' || next === 'scale' || next === design.id;
        display.position.set(0, 0, 0);
        if (next === 'fleet') {
          const row = Math.floor(i / columns), count = Math.min(columns, entries.length - row * columns);
          display.position.copy(right).multiplyScalar((i % columns - (count - 1) / 2) * cellWidth).addScaledVector(up, ((rows - 1) / 2 - row) * cellHeight);
        } else if (next === 'scale') display.position.copy(right).multiplyScalar(cursor + extents[i].width / 2).addScaledVector(up, extents[i].height / 2);
        if (next === 'fleet' || next === 'scale') display.position.sub(ship.bounds.getCenter(new THREE.Vector3()).multiplyScalar(display.scale.x));
        cursor += extents[i].width + gap;
        display.updateMatrixWorld(true);
        if (display.visible) { bounds.union(ship.bounds.clone().applyMatrix4(display.matrixWorld)); meshCount += meshes; }
      });
      root.updateMatrixWorld(true);
      return bounds;
    },
    framing(aspect: number, direction: THREE.Vector3) {
      const frame = shipFraming(bounds, aspect, direction);
      if (selection !== 'fleet' && selection !== 'scale') return frame;
      const forward = direction.clone().normalize(), right = new THREE.Vector3(0, 1, 0).cross(forward).normalize();
      if (right.lengthSq() < 0.5) right.set(1, 0, 0);
      const up = forward.clone().cross(right).normalize();
      let horizontal = 0, vertical = 0;
      // Project the real component boxes; the combined world AABB wastes space at 3/4 angles.
      entries.forEach(({ ship, display }) => {
        if (!display.visible) return;
        for (const x of [ship.bounds.min.x, ship.bounds.max.x]) for (const y of [ship.bounds.min.y, ship.bounds.max.y]) for (const z of [ship.bounds.min.z, ship.bounds.max.z]) {
          const p = new THREE.Vector3(x, y, z).applyMatrix4(display.matrixWorld).sub(frame.center);
          horizontal = Math.max(horizontal, Math.abs(p.dot(right))); vertical = Math.max(vertical, Math.abs(p.dot(up)));
        }
      });
      frame.halfHeight = Math.max(vertical / 0.56, horizontal / aspect / 0.84);
      return frame;
    },
    labels(camera: THREE.Camera) {
      return entries.filter(e => e.display.visible).map(({ design, ship, display }) => {
        const center = ship.bounds.getCenter(new THREE.Vector3()).applyMatrix4(display.matrixWorld).project(camera);
        let bottom = Infinity;
        for (const x of [ship.bounds.min.x, ship.bounds.max.x]) for (const y of [ship.bounds.min.y, ship.bounds.max.y]) for (const z of [ship.bounds.min.z, ship.bounds.max.z]) bottom = Math.min(bottom, new THREE.Vector3(x, y, z).applyMatrix4(display.matrixWorld).project(camera).y);
        return { id: design.id, x: (center.x + 1) * 50, y: Math.min(95, (1 - bottom) * 50 + 1) };
      });
    },
    dispose() { entries.forEach(({ ship }) => ship.dispose()); root.clear(); },
  };
}
