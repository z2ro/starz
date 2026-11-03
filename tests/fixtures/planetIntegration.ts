import captured from './live-api-state.json';
import { liveCatalog } from './liveSnapshots';
import type { Catalog, State } from '../../frontend/src/types/game';

export const planetCatalog: Catalog = { resources: [], fuels: [], technologies: [], propulsion: [], travel_modes: [], ships: liveCatalog.ships!, districts: liveCatalog.districts! };
export function planetSnapshot(): State {
  return {
    ...structuredClone(captured), fleets: structuredClone(captured.fleets) as State['fleets'],
    stocks: {}, capacities: { energy_generation: 32, energy_consumption: 10, energy_coverage: 1, industrial_capacity: 4, construction_slots: 3, construction_slots_available: 3, shipyard_slots: 1, shipyard_slots_available: 1, effective_research_rate: 2, workforce_supply: 94, workforce_demand: 54, workforce_coverage: 1, crew_committed: 6 },
    construction: [], research: { active: null, completed: [], complete_at: null, remaining_work: 0 }, notices: [], unlocked_content: [], travel_modes: [],
  };
}
export const SECOND_PLANET_ID = '22222222-2222-4222-8222-222222222222';
export function planetPair() {
  const home = planetSnapshot(), other = planetSnapshot();
  const row = { id: SECOND_PLANET_ID, name: 'Controlled colony', x: home.system.x, y: home.system.y, planet_index: 1, population_total: 20, home: false };
  home.planets = [...home.planets!, row]; other.planets = home.planets;
  other.active_planet = { id: SECOND_PLANET_ID, planet_index: 1, home: false };
  other.system = { ...other.system, planet: { ...other.system.planet, name: row.name } };
  other.population = { ...other.population, total: 20 };
  return { home, other };
}
