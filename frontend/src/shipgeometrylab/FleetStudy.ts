import * as THREE from 'three';
import { createPrototypeShip } from './ShipGeometry';
import { createWayfarerShip } from './WayfarerGeometry';
import { createVanguardShip } from './VanguardGeometry';
import { shipFraming } from './shipCamera';

export const FLEET_DESIGNS = [
  { id: 'horizon', name: 'Horizon', role: 'Exploration Corvette', summary: 'Casco leve · sensores · três motores', create: createPrototypeShip },
  { id: 'wayfarer', name: 'Wayfarer', role: 'Freighter', summary: 'Espinha industrial · oito módulos de carga', create: createWayfarerShip },
  { id: 'vanguard', name: 'Vanguard', role: 'Frigate', summary: 'Proa blindada · casamatas · propulsão protegida', create: createVanguardShip },
] as const;
export type FleetDesign = typeof FLEET_DESIGNS[number]['id'];
export type FleetSelection = FleetDesign | 'fleet';

/** Three lab-only recipes; never a gameplay hull registry. One allocation per design. */
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
    layout(next: FleetSelection, direction: THREE.Vector3) {
      selection = next;
      const right = new THREE.Vector3(0, 1, 0).cross(direction).normalize();
      if (right.lengthSq() < 0.5) right.set(1, 0, 0);
      // Separate projected extents, not arbitrary world-axis slots (Side/Top must also work).
      const widths = entries.map(({ ship }) => {
        let min = Infinity, max = -Infinity;
        for (const x of [ship.bounds.min.x, ship.bounds.max.x]) for (const y of [ship.bounds.min.y, ship.bounds.max.y]) for (const z of [ship.bounds.min.z, ship.bounds.max.z]) {
          const p = new THREE.Vector3(x, y, z).dot(right); min = Math.min(min, p); max = Math.max(max, p);
        }
        return max - min;
      });
      const gap = 1.5, total = widths.reduce((a, b) => a + b, 0) + gap * 2;
      let cursor = -total / 2;
      bounds.makeEmpty(); meshCount = 0;
      entries.forEach(({ design, ship, display, meshes }, i) => {
        display.visible = next === 'fleet' || next === design.id;
        display.position.set(0, 0, 0);
        if (next === 'fleet') display.position.copy(right).multiplyScalar(cursor + widths[i] / 2).sub(ship.bounds.getCenter(new THREE.Vector3()));
        cursor += widths[i] + gap;
        if (display.visible) { bounds.union(ship.bounds.clone().translate(display.position)); meshCount += meshes; }
      });
      root.updateMatrixWorld(true);
      return bounds;
    },
    framing(aspect: number, direction: THREE.Vector3) {
      const frame = shipFraming(bounds, aspect, direction);
      if (selection !== 'fleet') return frame;
      const forward = direction.clone().normalize(), right = new THREE.Vector3(0, 1, 0).cross(forward).normalize();
      if (right.lengthSq() < 0.5) right.set(1, 0, 0);
      const up = forward.clone().cross(right).normalize();
      let horizontal = 0, vertical = 0;
      // Project the real component boxes; the combined world AABB wastes space at 3/4 angles.
      entries.forEach(({ ship, display }) => {
        for (const x of [ship.bounds.min.x, ship.bounds.max.x]) for (const y of [ship.bounds.min.y, ship.bounds.max.y]) for (const z of [ship.bounds.min.z, ship.bounds.max.z]) {
          const p = new THREE.Vector3(x, y, z).add(display.position).sub(frame.center);
          horizontal = Math.max(horizontal, Math.abs(p.dot(right))); vertical = Math.max(vertical, Math.abs(p.dot(up)));
        }
      });
      frame.halfHeight = Math.max(vertical / 0.64, horizontal / aspect / 0.84);
      return frame;
    },
    dispose() { entries.forEach(({ ship }) => ship.dispose()); root.clear(); },
  };
}
