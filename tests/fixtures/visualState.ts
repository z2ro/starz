import type { Catalog, District, Hull, State } from '../../frontend/src/types/game';
import type { VisualStateInput } from '../../frontend/src/visual-state/types';

export const HOME_ID = '11111111-1111-4111-8111-111111111111';
export const COLONY_ID = '22222222-2222-4222-8222-222222222222';
const district = (id: string, name: string, extras: Partial<District> = {}): District => ({ id, name, description: 'Test fixture from current district catalog', category: 'Civil', cost: {}, requires: [], duration: 25, workforce: 0, energy_generation: 0, energy_consumption: 0, production: {}, processing: {}, research_rate: 0, population_capacity: 0, industrial_capacity: 0, construction_slots: 0, shipyard_slots: 0, ...extras });
export const HORIZON: Hull = { id: 'scout_hull', name: 'Horizon', description: 'Corveta leve projetada para reconhecimento e levantamento de sistemas.', category: 'hull', classification: 'corvette', role: 'exploration', mass: 10, crew: 3, cost: { refined_alloy: 16, components: 8 }, duration: 30, compatible_propulsion: ['chemical_drive', 'nuclear_drive'], requires: ['orbital_shipyard'] };
export const visualCatalog: Catalog = {
  resources: [], technologies: [], propulsion: [], fuels: [], travel_modes: [], ships: [HORIZON],
  districts: [district('civil_district', 'Distrito civil', { population_capacity: 80, construction_slots: 1 }), district('solar_field', 'Campo solar', { category: 'Energy', energy_generation: 8 }), district('orbital_shipyard', 'Estaleiro orbital', { category: 'Logistics', shipyard_slots: 1 })],
};

export function homeworld(): VisualStateInput {
  const system = { id: 'system-0-0', name: 'Asterion +0:+0', x: 0, y: 0, star: { stellar_class: 'G', mass: 1, luminosity: 1.2, age: 4, activity: 0.2 }, planet: { id: 'planet-0-0-0', name: 'A100-0 1', mass: 1, radius: 1, gravity: 1, orbital_distance: 1, temperature: 288, atmosphere: 'temperate nitrogen', radiation: 0.2, magnetic_field: 1, water: 60, geological_activity: 0.3, mineral_profile: { raw_ore: 1.1, volatiles: 0.9 }, usable_surface: 75 } };
  const snapshot: State = {
    system, stocks: {}, capacities: { energy_generation: 8, energy_consumption: 2, energy_coverage: 1, industrial_capacity: 0, construction_slots: 2, construction_slots_available: 2, shipyard_slots: 0, shipyard_slots_available: 0, effective_research_rate: 0, workforce_supply: 100, workforce_demand: 5, workforce_coverage: 1, crew_committed: 0 },
    population: { total: 100, available: 100, capacity: 180 }, districts: { civil_district: 1, solar_field: 1 }, construction: [], research: { active: null, complete_at: null, completed: [], remaining_work: 0 },
    active_planet: { id: HOME_ID, planet_index: 0, home: true }, planets: [{ id: HOME_ID, name: system.planet.name, x: 0, y: 0, planet_index: 0, population_total: 100, home: true }],
    ships: [], fleets: [], notices: [], unlocked_content: [], travel_modes: [],
  };
  return { ...snapshot, system };
}

export function uninhabited(): VisualStateInput { return { ...homeworld(), population: { total: 0 }, planets: [], districts: {} }; }
export function colony(): VisualStateInput {
  return { ...homeworld(), active_planet: { id: COLONY_ID, planet_index: 1, home: false }, population: { total: 20 }, districts: { civil_district: 1, solar_field: 1 }, planets: [{ id: HOME_ID, name: 'Home', x: 0, y: 0, planet_index: 0, population_total: 100, home: true }, { id: COLONY_ID, name: 'Colony', x: 0, y: 0, planet_index: 1, population_total: 20, home: false }], system: { ...homeworld().system, planet: { ...homeworld().system?.planet, id: 'planet-0-0-1' } } };
}
export function hostile(): VisualStateInput { return { ...uninhabited(), system: { ...homeworld().system, planet: { ...homeworld().system?.planet, temperature: 420, water: 20, radiation: 1.1, atmosphere: 'thin nitrogen' } } }; }
export function systemWithFleet(): VisualStateInput {
  return { ...homeworld(), ships: [{ id: '33333333-3333-4333-8333-333333333333', hull_id: 'scout_hull', propulsion_id: 'chemical_drive', fuel_id: 'ion_fuel', mass: 10, crew: 3, ready_at: 30, origin_planet_id: HOME_ID, system_x: 0, system_y: 0 }], fleets: [{ id: '44444444-4444-4444-8444-444444444444', name: 'Fleet 01', ship_ids: ['33333333-3333-4333-8333-333333333333'], status: 'ARRIVED', mission: 'MOVE', x: 0, y: 0, destination_x: 0, destination_y: 0, departure_at: 40, arrival_at: 60, eta: 0, propulsion: 'chemical_drive', mode: 'NORMAL', fuel_cost: 2 }] };
}
// A synthetic future catalog entry, never registered in game_data or runtime UI.
export const unmappedCatalog: Catalog = { ...visualCatalog, ships: [...visualCatalog.ships, { ...HORIZON, id: 'fixture_unmapped_hull', name: 'Unmapped fixture model' }] };
export function unmappedHull(): VisualStateInput { const state = systemWithFleet(); return { ...state, ships: state.ships!.map(ship => ({ ...ship, hull_id: 'fixture_unmapped_hull' })) }; }
export const incomplete: VisualStateInput = { system: { planet: { name: 'Incomplete observation' } } };
export const scenarios = { homeworld, uninhabited, colony, hostile, systemWithFleet, systemWithoutFleet: homeworld, unmappedHull, incomplete: () => incomplete };
