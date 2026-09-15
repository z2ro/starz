import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FleetsView } from '../frontend/src/views/FleetsView';
import type { Catalog, State } from '../frontend/src/types/game';
import type { ShellContext } from '../frontend/src/components/shell/AppShell';

const catalog: Catalog = { resources: [], districts: [], technologies: [], ships: [{ id: 'hull', name: 'Horizon', category: 'naval', description: '', cost: {}, requires: [], classification: 'corvette', role: 'exploration', mass: 1, crew: 1, duration: 1, compatible_propulsion: ['drive'] }], propulsion: [{ id: 'drive', name: 'Propulsor químico', category: 'propulsion', description: '', cost: {}, requires: [], compatible_fuels: ['fuel'], speed_factor: 1, fuel_efficiency: 1, thermal_load: 1, signature: 1 }], fuels: [{ id: 'fuel', name: 'Combustível iônico', category: 'fuel', description: '', cost: {}, requires: [], energy_density: 1, storage_factor: 1 }], travel_modes: [{ id: 'ECONOMY', name: 'Economy', category: 'travel', description: '', cost: {}, requires: [], travel_time_modifier: 1, fuel_modifier: 1, thermal_modifier: 1, signature_modifier: 1 }, { id: 'NORMAL', name: 'Normal', category: 'travel', description: '', cost: {}, requires: [], travel_time_modifier: 1, fuel_modifier: 1, thermal_modifier: 1, signature_modifier: 1 }, { id: 'FORCED', name: 'Forced', category: 'travel', description: '', cost: {}, requires: [], travel_time_modifier: 1, fuel_modifier: 1, thermal_modifier: 1, signature_modifier: 1 }] };
const baseState: State = { system: { name: 'Asterion', x: 2, y: -1, star: { stellar_class: 'G', mass: 1, luminosity: 1, age: 4, activity: .2 }, planet: { name: 'Gaia', mass: 1, radius: 1, gravity: 1, orbital_distance: 1, temperature: 288, atmosphere: 'nitrogen', radiation: .2, magnetic_field: 1, water: 60, geological_activity: .2, mineral_profile: {}, usable_surface: 70 } }, stocks: {}, capacities: { energy_generation: 0, energy_consumption: 0, energy_coverage: 1, industrial_capacity: 0, construction_slots: 0, construction_slots_available: 0, shipyard_slots: 0, shipyard_slots_available: 0, effective_research_rate: 0, workforce_supply: 0, workforce_demand: 0, workforce_coverage: 1, crew_committed: 0 }, population: { total: 0, available: 0, capacity: 0 }, districts: {}, construction: [], research: { active: null, complete_at: null, completed: [], remaining_work: 0 }, active_planet: { id: 'origin-a', planet_index: 0, home: true }, planets: [{ id: 'origin-a', name: 'Asterion Prime', x: 2, y: -1, planet_index: 0, population_total: 0, home: true }, { id: 'origin-b', name: 'Vesper', x: 3, y: -1, planet_index: 1, population_total: 0, home: false }], fleets: [], ships: [], travel_modes: [], notices: [], unlocked_content: [] };
const fleets = [{ id: 'one', name: 'Asterion Guard', status: 'ARRIVED' as const, mission: 'MOVE' as const, x: 2, y: -1, destination_x: 4, destination_y: 1, ship_ids: ['d3af48ef12345678'], eta: 0, propulsion: 'drive', mode: 'NORMAL', fuel_cost: 3, fuel_reserve: 12.5, departure_at: 1000, arrival_at: 1100 }, { id: 'two', name: 'Survey Wing', status: 'TRANSIT' as const, mission: 'SURVEY' as const, x: 2, y: -1, destination_x: 7, destination_y: 3, ship_ids: ['a1b2c3d4ef567890'], eta: 125, propulsion: 'drive', mode: 'FORCED', fuel_cost: 5, fuel_reserve: 8, departure_at: 1000, arrival_at: 1125 }];
const ships = [{ id: 'd3af48ef12345678', hull_id: 'hull', propulsion_id: 'drive', fuel_id: 'fuel', crew: 4, mass: 20, ready_at: 900, origin_planet_id: 'origin-a' }, { id: 'a1b2c3d4ef567890', hull_id: 'hull', propulsion_id: 'drive', fuel_id: 'fuel', crew: 3, mass: 30, ready_at: 900, origin_planet_id: 'origin-b' }];

function renderFleets(state: State = { ...baseState, fleets, ships }, currentCatalog: Catalog = catalog) {
  const context: ShellContext = { catalog: currentCatalog, state, activePlanetId: 'home', setActivePlanetId: vi.fn(), execute: vi.fn(), busy: false, setFeedback: vi.fn() };
  render(<MemoryRouter initialEntries={['/fleets']}><Routes><Route element={<Outlet context={context} />}><Route path="/fleets" element={<FleetsView />} /></Route></Routes></MemoryRouter>);
}

afterEach(cleanup);

describe('Fleet Command Center', () => {
  it('renders two fleets and selects the first initially', () => {
    renderFleets();
    expect(screen.getByRole('button', { name: /Asterion Guard/ })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: /Survey Wing/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Inspector de frota')).toHaveTextContent('Asterion Guard');
  });

  it('updates the inspector when selecting the second fleet', () => {
    renderFleets();
    fireEvent.click(screen.getByRole('button', { name: /Survey Wing/ }));
    expect(screen.getByLabelText('Inspector de frota')).toHaveTextContent('Survey Wing');
    expect(screen.getByLabelText('Inspector de frota')).toHaveTextContent('7:3');
  });

  it('resolves composition and calculates read-only aggregates', () => {
    renderFleets();
    const inspector = screen.getByLabelText('Inspector de frota');
    expect(inspector).toHaveTextContent('ID d3af48ef');
    expect(inspector).toHaveTextContent('Horizon');
    expect(inspector).toHaveTextContent('Propulsor químico');
    expect(inspector).toHaveTextContent('Combustível iônico');
    expect(inspector).toHaveTextContent('TRIPULAÇÃO TOTAL');
    expect(inspector).toHaveTextContent('4');
    expect(inspector).toHaveTextContent('MASSA TOTAL');
    expect(inspector).toHaveTextContent('20');
    expect(inspector).toHaveTextContent('ORIGEM');
    expect(inspector).toHaveTextContent('Asterion Prime');
    expect(inspector).not.toHaveTextContent('d3af48ef12345678');
    expect(inspector).not.toHaveTextContent('HULL_ID');
    expect(inspector).not.toHaveTextContent('PROPULSION_ID');
    expect(inspector).not.toHaveTextContent('FUEL_ID');
  });

  it('shows transit destination and ETA, while arrived keeps destination neutral', () => {
    renderFleets();
    const arrived = screen.getByLabelText('Inspector de frota');
    expect(screen.queryByText('ARRIVED')).not.toBeInTheDocument();
    expect(screen.queryByText('TRANSIT')).not.toBeInTheDocument();
    expect(screen.getAllByText('EM POSIÇÃO').length).toBeGreaterThan(0);
    expect(within(arrived).getByText('SISTEMA ATUAL').nextElementSibling).toHaveTextContent('2:-1');
    const destinationLabel = within(arrived).getAllByText('DESTINO').find(element => element.classList.contains('data-label'));
    expect(destinationLabel?.nextElementSibling).toHaveTextContent('—');
    fireEvent.click(screen.getByRole('button', { name: /Survey Wing/ }));
    const transit = screen.getByLabelText('Inspector de frota');
    expect(screen.getAllByText('EM TRÂNSITO').length).toBeGreaterThan(0);
    expect(transit).toHaveTextContent('7:3');
    expect(transit).toHaveTextContent('3min');
    expect(transit).toHaveTextContent('Forçado');
  });

  it('uses singular quantities and safely falls back to unresolved catalog IDs', () => {
    renderFleets();
    expect(screen.getByText('2 unidades')).toBeInTheDocument();
    expect(screen.getAllByText('1 nave').length).toBeGreaterThan(0);
    expect(screen.queryByText('1 nave / 1 nave')).not.toBeInTheDocument();
    expect(screen.queryByText(/\(s\)|\(is\)/)).not.toBeInTheDocument();
    cleanup();
    const unknownFleet = { ...fleets[0], ship_ids: ['unknown-ship'] };
    const unknownShip = { ...ships[0], id: 'unknown-ship', hull_id: 'unknown_hull', propulsion_id: 'unknown_drive', fuel_id: 'unknown_fuel' };
    renderFleets({ ...baseState, fleets: [unknownFleet], ships: [unknownShip] }, { ...catalog, ships: [], propulsion: [], fuels: [] });
    const inspector = screen.getByLabelText('Inspector de frota');
    expect(inspector).toHaveTextContent('unknown_hull');
    expect(inspector).toHaveTextContent('unknown_drive');
    expect(inspector).toHaveTextContent('unknown_fuel');
  });

  it('shows plural composition and only uses partial wording for missing ships', () => {
    const fullFleet = { ...fleets[0], ship_ids: ships.map(ship => ship.id) };
    renderFleets({ ...baseState, fleets: [fullFleet], ships });
    const fullInspector = screen.getByLabelText('Inspector de frota');
    expect(within(fullInspector).getByText('2 naves')).toBeInTheDocument();
    expect(screen.queryByText('2 naves / 2 naves')).not.toBeInTheDocument();
    cleanup();
    renderFleets({ ...baseState, fleets: [{ ...fullFleet, ship_ids: [ships[0].id, 'missing-ship'] }], ships });
    expect(within(screen.getByLabelText('Inspector de frota')).getByText('1 de 2 naves carregadas')).toBeInTheDocument();
  });

  it('uses a short origin fallback when the planet is unavailable', () => {
    const originId = 'ec3005ca-1234-5678-9abc-def012345678';
    const unknownOrigin = { ...ships[0], origin_planet_id: originId };
    renderFleets({ ...baseState, planets: [], ships: [unknownOrigin], fleets: [{ ...fleets[0], ship_ids: [unknownOrigin.id] }] });
    const inspector = screen.getByLabelText('Inspector de frota');
    expect(inspector).toHaveTextContent('Planeta ec3005ca');
    expect(inspector).not.toHaveTextContent(originId);
  });

  it('renders fleet fuel reserve and explains the empty state', () => {
    renderFleets();
    expect(screen.getByLabelText('Inspector de frota')).toHaveTextContent('12,5');
    cleanup();
    renderFleets({ ...baseState, fleets: [], ships: [] });
    expect(screen.getByText('Nenhuma frota')).toBeInTheDocument();
    expect(screen.getByText(/primeira missão para formar uma frota/)).toBeInTheDocument();
  });
});
