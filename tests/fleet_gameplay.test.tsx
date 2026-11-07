import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { ShipyardView } from '../frontend/src/views/ShipyardView';
import { FleetsView } from '../frontend/src/views/FleetsView';
import { buildConfiguration } from '../frontend/src/components/ships/buildConfiguration';
import { SHIP_DESIGNS, designForHull } from '../frontend/src/visual/ShipDesignRegistry';
import { createVisualDescriptor } from '../frontend/src/visual-state/VisualStateAdapter';
import { homeworld, systemWithFleet } from './fixtures/visualState';
import captured from './fixtures/fleet-api-catalog.json';
import type { Catalog } from '../frontend/src/types/game';
vi.mock('../frontend/src/components/ships/ShipPreview', () => ({ ShipPreview: ({ hull }: { hull?: { name: string } }) => <div data-testid="preview">{hull?.name}</div> }));
afterEach(cleanup);
const catalog = captured as Catalog;
function ready() { const state = homeworld(); state.districts.orbital_shipyard = 1; state.capacities.shipyard_slots_available = 1; state.research.completed = ['orbital_engineering', 'nuclear_propulsion']; state.unlocked_content = ['nuclear_drive', 'fusion_fuel']; state.stocks = { refined_alloy: 10000, components: 10000, ion_fuel: 10000, fusion_fuel: 10000 }; state.population.available = 1000; return state; }
const execute = vi.fn(async () => ({}));
function view(element: React.ReactNode, state = ready()) { return render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><Routes><Route element={<Outlet context={{ catalog, state, execute, busy: false }} />}><Route path="/" element={element} /></Route></Routes></MemoryRouter></QueryClientProvider>); }
it('maps exactly eleven visual designs and ten gameplay hulls without Stargrave or substitution', () => {
  expect(SHIP_DESIGNS).toHaveLength(11); expect(catalog.ships).toHaveLength(10);
  for (const hull of catalog.ships) { expect(designForHull(hull)).not.toBeNull(); expect(designForHull({ ...hull, role: 'wrong' })).toBeNull(); }
  expect(catalog.ships.some(h => h.name.includes('Stargrave'))).toBe(false);
});
it('filters and migrates propulsion/fuel with a coherent build payload and real planet ID', () => {
  view(<ShipyardView />); fireEvent.click(screen.getByRole('button', { name: /Dominion/ }));
  expect((screen.getByLabelText('Propulsão') as HTMLSelectElement).value).toBe('nuclear_drive');
  expect((screen.getByLabelText('Combustível') as HTMLSelectElement).value).toBe('fusion_fuel');
  fireEvent.click(screen.getByRole('button', { name: 'Construir nave' }));
  expect(execute).toHaveBeenLastCalledWith('build-ship', { planet_id: ready().active_planet!.id, hull_id: 'dominion_hull', propulsion_id: 'nuclear_drive', fuel_id: 'fusion_fuel' });
  fireEvent.click(screen.getByRole('button', { name: /Wayfarer/ })); expect((screen.getByLabelText('Propulsão') as HTMLSelectElement).value).toBe('chemical_drive');
});
it('explains locked requirements and blocks insufficient resources, crew, fuel and slots', () => {
  const state = ready(); state.research.completed = []; view(<ShipyardView />, state); fireEvent.click(screen.getByRole('button', { name: /Dominion/ }));
  expect(screen.getByRole('button', { name: 'Construir nave' })).toBeDisabled(); expect(screen.getAllByText(/Modelo bloqueado/).length).toBeGreaterThan(0);
  for (const mutate of [(s: typeof state) => { s.stocks.components = 0; }, (s: typeof state) => { s.population.available = 0; }, (s: typeof state) => { s.capacities.shipyard_slots_available = 0; }, (s: typeof state) => { s.stocks.fusion_fuel = 0; }]) {
    const s = ready(); mutate(s); expect(buildConfiguration(catalog, s, catalog.ships.find(h => h.id === 'dominion_hull'), 'chemical_drive', 'ion_fuel').valid).toBe(false);
  }
});
it.each(catalog.ships)('grounds $name only in the local system and excludes transit/unknown designs', hull => {
  const state = systemWithFleet(); state.ships = state.ships!.map(ship => ({ ...ship, hull_id: hull.id }));
  const d = createVisualDescriptor(state, catalog); expect(d.ships.entities[0]).toMatchObject({ visible: true, design: `${designForHull(hull)}-prototype` });
  state.fleets = state.fleets!.map(f => ({ ...f, status: 'TRANSIT' })); expect(createVisualDescriptor(state, catalog).ships.visibleCount).toBe(0);
});
it('inspects actual ships by ID without changing fleet status, mission or location', () => {
  const state = ready(), source = systemWithFleet(); state.ships = source.ships as typeof state.ships; state.fleets = source.fleets as typeof state.fleets;
  state.ships[0].hull_id = 'atlas_hull'; view(<FleetsView />, state);
  fireEvent.click(screen.getByRole('button', { name: /Atlas.*ID/ })); expect(screen.getByTestId('preview')).toHaveTextContent('Atlas'); expect(screen.getByText('ARRIVED')).toBeInTheDocument(); expect(screen.getByText('MOVE')).toBeInTheDocument(); expect(screen.getByText('0:0')).toBeInTheDocument(); expect(screen.getByText(/modo NORMAL/)).toBeInTheDocument();
});
