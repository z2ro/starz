import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShipyardView } from '../frontend/src/views/ShipyardView';
import { SHIP_DESIGNS } from '../frontend/src/visual/ShipArtworkRegistry';
import type { ShellContext } from '../frontend/src/components/shell/AppShell';
import type { Catalog, State } from '../frontend/src/types/game';

const catalog: Catalog = {
  resources: [
    { id: 'refined_alloy', name: 'Liga refinada', category: 'material', description: '', cost: {}, requires: [] },
    { id: 'components', name: 'Componentes', category: 'component', description: '', cost: {}, requires: [] },
  ],
  districts: [{ id: 'orbital_shipyard', name: 'Estaleiro orbital', category: 'orbital', description: '', cost: {}, requires: [], duration: 1, workforce: 0, energy_generation: 0, energy_consumption: 0, production: {}, processing: {}, research_rate: 0, population_capacity: 0, industrial_capacity: 0, construction_slots: 0, shipyard_slots: 1 }],
  technologies: [],
  ships: [
    { id: 'scout_hull', name: 'Horizon', category: 'naval', description: 'Corveta de exploração.', cost: { refined_alloy: 4 }, requires: [], classification: 'corvette', role: 'exploration', mass: 10, crew: 3, duration: 30, compatible_propulsion: ['chemical_drive'] },
    { id: 'wayfarer', name: 'Wayfarer', category: 'naval', description: 'Modelo de teste.', cost: { refined_alloy: 4 }, requires: [], classification: 'freighter', role: 'logistics', mass: 20, crew: 2, duration: 60, compatible_propulsion: ['nuclear_drive'] },
  ],
  propulsion: [
    { id: 'chemical_drive', name: 'Propulsão química', category: 'propulsion', description: '', cost: {}, requires: [], compatible_fuels: ['ion_fuel'], speed_factor: 1, fuel_efficiency: .8, thermal_load: .2, signature: .3 },
    { id: 'nuclear_drive', name: 'Propulsão nuclear', category: 'propulsion', description: '', cost: {}, requires: [], compatible_fuels: ['fusion_fuel'], speed_factor: 1.5, fuel_efficiency: 1.1, thermal_load: .4, signature: .5 },
  ],
  fuels: [
    { id: 'ion_fuel', name: 'Combustível iônico', category: 'fuel', description: '', cost: {}, requires: [], energy_density: 1, storage_factor: 1 },
    { id: 'fusion_fuel', name: 'Combustível de fusão', category: 'fuel', description: '', cost: {}, requires: [], energy_density: 2, storage_factor: .7 },
  ],
  travel_modes: [],
};

const state: State = {
  system: { name: 'Asterion', x: 2, y: -1, star: { stellar_class: 'G', mass: 1, luminosity: 1, age: 4, activity: .2 }, planet: { name: 'Gaia', mass: 1, radius: 1, gravity: 1, orbital_distance: 1, temperature: 288, atmosphere: 'nitrogen', radiation: .2, magnetic_field: 1, water: 60, geological_activity: .2, mineral_profile: {}, usable_surface: 70 } },
  stocks: { refined_alloy: 20, ion_fuel: 2, fusion_fuel: 2 }, capacities: { energy_generation: 10, energy_consumption: 4, energy_coverage: 1, industrial_capacity: 1, construction_slots: 1, construction_slots_available: 1, shipyard_slots: 2, shipyard_slots_available: 1, effective_research_rate: 0, workforce_supply: 8, workforce_demand: 1, workforce_coverage: 1, crew_committed: 0 }, population: { total: 10, available: 8, capacity: 20 }, districts: { orbital_shipyard: 1 }, construction: [], research: { active: null, complete_at: null, completed: [], remaining_work: 0 }, active_planet: { id: 'home', planet_index: 0, home: true }, planets: [{ id: 'home', name: 'Gaia', x: 2, y: -1, planet_index: 0, population_total: 10, home: true }], fleets: [], ships: [], travel_modes: [], notices: [], unlocked_content: [],
};

function renderShipyard(nextState: State = state, nextCatalog: Catalog = catalog) {
  const execute = vi.fn().mockResolvedValue({});
  const context: ShellContext = { catalog: nextCatalog, state: nextState, activePlanetId: 'home', setActivePlanetId: vi.fn(), execute, busy: false, setFeedback: vi.fn() };
  render(<MemoryRouter initialEntries={['/shipyard']}><Routes><Route element={<Outlet context={context} />}><Route path="/shipyard" element={<ShipyardView />} /></Route></Routes></MemoryRouter>);
  return { execute };
}

afterEach(cleanup);

describe('Ship Command', () => {
  it('renders the real local yard context, catalog and capacity', () => {
    renderShipyard();
    expect(screen.getByText('ORBITAL SHIPYARD')).toBeInTheDocument();
    expect(screen.getByText('Gaia · Asterion · 2:-1')).toBeInTheDocument();
    expect(screen.getByText('1 / 2 livres')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Selecionar nave Horizon' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Selecionar nave Wayfarer' })).toBeInTheDocument();
    expect(screen.getByLabelText('Apresentação visual da nave')).toHaveTextContent('Horizon');
  });

  it('keeps the propulsion-to-fuel compatibility chain valid when the hull changes', () => {
    renderShipyard();
    const inspector = screen.getByLabelText('Inspector de nave');
    expect(within(inspector).getByText('Propulsão química')).toBeInTheDocument();
    expect(within(inspector).getByText('Combustível iônico')).toBeInTheDocument();
    expect(within(inspector).queryByText('Propulsão nuclear')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar nave Wayfarer' }));
    expect(within(screen.getByLabelText('Inspector de nave')).getByText('CONCEITO')).toBeInTheDocument();
    expect(within(screen.getByLabelText('Inspector de nave')).queryByText('Construir nave')).not.toBeInTheDocument();
  });

  it('exposes design classifications as real filters and keeps filtered selection deterministic', () => {
    renderShipyard();
    const filters = screen.getByRole('group', { name: 'Classificação naval' });
    expect(within(filters).getByRole('button', { name: 'Corvette' })).toBeInTheDocument();
    fireEvent.click(within(filters).getByRole('button', { name: 'Freighter' }));
    expect(screen.getByRole('button', { name: 'Selecionar nave Wayfarer' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: 'Selecionar nave Horizon' })).not.toBeInTheDocument();
  });

  it('sends the exact domain payload with the active planet and selected configuration', () => {
    const { execute } = renderShipyard();
    fireEvent.click(screen.getByRole('button', { name: 'Construir nave' }));
    expect(execute).toHaveBeenCalledWith('build-ship', { planet_id: 'home', hull_id: 'scout_hull', propulsion_id: 'chemical_drive', fuel_id: 'ion_fuel' });
  });

  it('blocks construction when yard capacity, cost or crew is unavailable', () => {
    renderShipyard({ ...state, capacities: { ...state.capacities, shipyard_slots_available: 0 }, stocks: { refined_alloy: 0, ion_fuel: 0 }, population: { ...state.population, available: 1 } });
    expect(screen.getByRole('button', { name: 'Construir nave' })).toBeDisabled();
    expect(screen.getByText('Não há slots de estaleiro disponíveis.')).toBeInTheDocument();
    expect(screen.getByText('Recursos locais insuficientes.')).toBeInTheDocument();
    expect(screen.getByText('População disponível insuficiente para a tripulação.')).toBeInTheDocument();
  });

  it('shows only active construction for the selected planet and has no fake queue controls', () => {
    const now = Date.now() / 1000;
    renderShipyard({ ...state, ships: [{ id: 'local-build', hull_id: 'scout_hull', propulsion_id: 'chemical_drive', fuel_id: 'ion_fuel', crew: 3, mass: 10, ready_at: now + 30, origin_planet_id: 'home' }, { id: 'remote-build', hull_id: 'wayfarer', propulsion_id: 'nuclear_drive', fuel_id: 'fusion_fuel', crew: 2, mass: 20, ready_at: now + 30, origin_planet_id: 'colony' }] });
    const operations = screen.getByLabelText('Operações do estaleiro');
    expect(operations).toHaveTextContent('Horizon');
    expect(operations).not.toHaveTextContent('Wayfarer');
    expect(operations).not.toHaveTextContent('Pausar');
    expect(operations).not.toHaveTextContent('Cancelar');
  });

  it('keeps the visual design catalog available when the gameplay catalog is empty', () => {
    renderShipyard(state, { ...catalog, ships: [] });
    expect(screen.getByRole('button', { name: 'Selecionar nave Horizon' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Selecionar nave Stargrave-class' })).toBeInTheDocument();
    expect(within(screen.getByLabelText('Inspector de nave')).getByText('CONCEITO')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Construir nave' })).not.toBeInTheDocument();
  });

  it('renders all approved classes as visual concepts without exposing strike craft as hulls', () => {
    expect(SHIP_DESIGNS).toHaveLength(11);
    renderShipyard();
    for (const name of ['Horizon', 'Wayfarer', 'Vanguard', 'Sentinel', 'Odyssey', 'Aegis', 'Spearhead', 'Leviathan', 'Atlas', 'Dominion', 'Stargrave-class']) expect(screen.getByRole('button', { name: `Selecionar nave ${name}` })).toBeInTheDocument();
    for (const name of ['Interceptor', 'Fighter', 'Bomber']) expect(screen.queryByRole('button', { name: `Selecionar nave ${name}` })).not.toBeInTheDocument();
  });

  it('shows concept artwork without fake gameplay fields and treats Stargrave as a titan', () => {
    renderShipyard();
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar nave Stargrave-class' }));
    expect(screen.getByLabelText('Apresentação visual da nave')).toHaveTextContent('CONCEITO');
    expect(screen.getByLabelText('Inspector de nave')).toHaveTextContent('Stellar Siege Titan');
    expect(screen.getByLabelText('Inspector de nave')).not.toHaveTextContent('Construir nave');
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar nave Atlas' }));
    expect(screen.getByLabelText('Inspector de nave')).toHaveTextContent('Interceptor · Fighter · Bomber');
  });

  it('swaps the selected runtime presentation and falls back to the technical schematic on load failure', () => {
    renderShipyard();
    expect(screen.getByRole('img', { name: 'Nave Horizon' })).toHaveAttribute('src', '/static/ships/presentation/horizon.webp');
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar nave Wayfarer' }));
    const presentation = screen.getByRole('img', { name: 'Nave Wayfarer' });
    expect(presentation).toHaveAttribute('src', '/static/ships/presentation/wayfarer.webp');
    fireEvent.error(presentation);
    expect(screen.getByText('+Z FORWARD · TECHNICAL SCHEMATIC')).toBeInTheDocument();
  });
});

