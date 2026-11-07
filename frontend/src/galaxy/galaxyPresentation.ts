import type { Catalog, Fleet, GalaxySystem, State } from '../types/game';
import { seedNumber } from '../planetlab/planetGenerator';
import { derivePlanetVisual } from '../visual-state/planetVisualMapping';
import { DEFAULT_PLANET_LAB_SETTINGS } from '../planetlab/planetLabTypes';

// Coordinates are the stable system identity exposed before AND after discovery.
export const systemKey = (system: Pick<GalaxySystem, 'x' | 'y'>) => `${system.x}:${system.y}`;
export function visualPosition(system: Pick<GalaxySystem, 'x' | 'y'>) {
  const key = `starz:galaxy-layout:v1:${systemKey(system)}`;
  return { x: system.x * 320 + system.y * 120 + Math.sin(system.y * 1.1 + system.x * .5) * 80 + (seedNumber(key + ':x') / 0xffffffff - .5) * 100,
    y: system.y * 300 + system.x * 20 + Math.cos(system.x * .6 - system.y * .4) * 80 + (seedNumber(key + ':y') / 0xffffffff - .5) * 90 };
}
export function authorizedSystem(system: GalaxySystem): GalaxySystem {
  if (system.knowledge_level === 'SURVEYED') return system;
  const { x, y, distance, home } = system;
  return { id: `${x}:${y}`, x, y, distance, home, knowledge_level: 'UNKNOWN' };
}
export function fleetVisualPosition(fleet: Fleet, observedAt: number | undefined) {
  const from = visualPosition(fleet);
  if (fleet.status !== 'TRANSIT') return from;
  const to = visualPosition({ x: fleet.destination_x, y: fleet.destination_y });
  if (!Number.isFinite(observedAt) || !Number.isFinite(fleet.departure_at) || !Number.isFinite(fleet.arrival_at) || fleet.arrival_at <= fleet.departure_at) return null;
  const fraction = Math.max(0, Math.min(1, (observedAt! - fleet.departure_at) / (fleet.arrival_at - fleet.departure_at)));
  return { x: from.x + (to.x - from.x) * fraction, y: from.y + (to.y - from.y) * fraction };
}
export function knownLocalFleets(system: GalaxySystem, fleets: Fleet[]) {
  return fleets.filter(f => f.status === 'ARRIVED' && f.x === system.x && f.y === system.y);
}
export function orbitalPosition(system: GalaxySystem, index: number, seconds: number, slot: number) {
  const phase = seedNumber(`starz:orbit:v1:${systemKey(system)}:${index}`) / 0xffffffff * Math.PI * 2;
  const radius = 2.25 + slot * 1.65;
  const angle = phase + seconds * .022 / (slot + 1);
  return { x: Math.cos(angle) * radius, y: 0, z: Math.sin(angle) * radius, radius };
}
export function orbitalPlanets(system: GalaxySystem) {
  if (system.knowledge_level !== 'SURVEYED') return [];
  return [...(system.planets ?? [])].sort((a, b) => a.planet_index - b.planet_index).map(planet => {
    const visual = derivePlanetVisual(planet, []);
    return { planet, settings: { ...DEFAULT_PLANET_LAB_SETTINGS, ...visual.parameters, family: visual.family ?? 'terran', seed: `starz:orbital-planet:v1:${systemKey(system)}:${planet.planet_index}` }, atmosphere: visual.atmosphere };
  });
}
export function fleetComposition(fleet: Fleet, state: State, catalog: Catalog) {
  const ids = new Set(fleet.ship_ids);
  const groups = new Map<string, { id: string; name: string; count: number }>();
  for (const ship of state.ships.filter(s => ids.has(s.id))) {
    const hull = catalog.ships.find(h => h.id === ship.hull_id);
    const group = groups.get(ship.hull_id) ?? { id: ship.hull_id, name: hull?.name ?? 'Design não identificado', count: 0 };
    group.count++; groups.set(group.id, group);
  }
  return [...groups.values()];
}

export function visibleGalaxyLabels(nodes: { system: GalaxySystem; x: number; y: number }[], camera: { x: number; y: number; zoom: number; width: number; height: number }, selected: string) {
  const placed: { left: number; right: number; top: number; bottom: number }[] = [], visible = new Set<string>();
  const priority = (node: typeof nodes[number]) => systemKey(node.system) === selected ? 0 : node.system.home ? 1 : node.system.knowledge_level === 'SURVEYED' ? 2 : 3;
  for (const node of [...nodes].sort((a, b) => priority(a) - priority(b) || systemKey(a.system).localeCompare(systemKey(b.system)))) {
    if (camera.zoom < .65 && priority(node) > 1) continue;
    const x = node.x * camera.zoom + camera.x, y = node.y * camera.zoom + camera.y;
    const box = { left: x - 85, right: x + 85, top: y + 24, bottom: y + 59 };
    if (box.left < 4 || box.right > camera.width - 4 || box.top < 4 || box.bottom > camera.height - 4) continue;
    if (placed.some(b => box.left < b.right + 8 && box.right > b.left - 8 && box.top < b.bottom + 6 && box.bottom > b.top - 6)) continue;
    if (nodes.some(other => other !== node && Math.abs(other.x * camera.zoom + camera.x - x) < 99 && other.y * camera.zoom + camera.y > box.top - 14 && other.y * camera.zoom + camera.y < box.bottom + 14)) continue;
    placed.push(box); visible.add(systemKey(node.system));
  }
  return visible;
}

export function galaxyCenter(state: State, requested?: [number, number]): [number, number] | undefined {
  const home = state.planets?.find(p => p.home) ?? (state.active_planet?.home ? state.system : undefined);
  if (requested && ((home && requested[0] === home.x && requested[1] === home.y) || state.fleets.some(f => f.status === 'ARRIVED' && f.x === requested[0] && f.y === requested[1]))) return requested;
  return home ? [home.x, home.y] : undefined;
}

export function fleetMapMarkers(fleets: Fleet[], observedAt: number | undefined) {
  const groups = new Map<string, { key: string; x: number; y: number; fleets: Fleet[] }>(), seen = new Set<string>();
  for (const fleet of fleets) {
    if (seen.has(fleet.id)) continue; seen.add(fleet.id);
    const point = fleetVisualPosition(fleet, observedAt); if (!point) continue;
    const key = `${point.x.toFixed(3)}:${point.y.toFixed(3)}`;
    const group = groups.get(key) ?? { key, ...point, fleets: [] }; group.fleets.push(fleet); groups.set(key, group);
  }
  return [...groups.values()];
}
