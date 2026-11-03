import captured from './live-api-state.json';
import capturedCatalog from './live-api-catalog.json';
import type { VisualStateInput, VisualCatalogInput } from '../../frontend/src/visual-state/types';

// Local PostgreSQL/API capture; persistent UUIDs remapped, irrelevant stock/notice fields removed.
const numberRecord = (value: object) => Object.fromEntries<number>(Object.entries(value).map(([key, number]: [string, unknown]) => {
  if (typeof number !== 'number' || !Number.isFinite(number)) throw new Error('Invalid numeric catalog fixture');
  return [key, number] as const;
}));
export const liveCatalog: VisualCatalogInput = { ships: capturedCatalog.ships, districts: capturedCatalog.districts.map(item => ({ ...item, production: numberRecord(item.production), processing: numberRecord(item.processing) })) };
export const realSnapshot = () => structuredClone(captured) as VisualStateInput;
export function localFleetSnapshot() {
  const state = realSnapshot();
  state.fleets = state.fleets!.map(fleet => ({ ...fleet, x: state.system!.x!, y: state.system!.y!, destination_x: state.system!.x!, destination_y: state.system!.y! }));
  return state;
}
export function emptySnapshot() { const state = realSnapshot(); return { ...state, population: { total: 0 }, ships: [], fleets: [] }; }
export function transitSnapshot() { const state = localFleetSnapshot(); return { ...state, fleets: state.fleets!.map(fleet => ({ ...fleet, status: 'TRANSIT' as const })) }; }
export function incompleteSnapshot(): VisualStateInput { return { active_planet: { id: captured.active_planet.id }, system: { id: captured.system.id, planet: { name: 'Incomplete snapshot' } } }; }
