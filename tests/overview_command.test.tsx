import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OverviewView } from '../frontend/src/views/OverviewView';
import type { ShellContext } from '../frontend/src/components/shell/AppShell';
import type { Catalog, State } from '../frontend/src/types/game';

const catalog: Catalog = { resources: [], fuels: [], districts: [], technologies: [{ id: 'orbital_engineering', name: 'Engenharia orbital', category: 'science', description: '', cost: {}, requires: [], duration: 100, unlocks: [] }], ships: [], propulsion: [], travel_modes: [] };
const state: State = {
  system: { name: 'Asterion', x: 2, y: -1, star: { stellar_class: 'G', mass: 1, luminosity: 1, age: 4, activity: .2 }, planet: { name: 'Gaia', mass: 1, radius: 1, gravity: 1, orbital_distance: 1, temperature: 288, atmosphere: 'nitrogen', radiation: .2, magnetic_field: 1, water: 60, geological_activity: .2, mineral_profile: {}, usable_surface: 70 } },
  stocks: { raw_ore: 99 }, capacities: { energy_generation: 10, energy_consumption: 4, energy_coverage: 1, industrial_capacity: 1, construction_slots: 2, construction_slots_available: 1, shipyard_slots: 1, shipyard_slots_available: 1, effective_research_rate: 1, workforce_supply: 4, workforce_demand: 1, workforce_coverage: 1, crew_committed: 0 }, population: { total: 100, available: 90, capacity: 140 }, districts: {}, construction: [{ id: 'orbital_engineering', started_at: 0, complete_at: 100 }], research: { active: 'orbital_engineering', complete_at: 100, completed: [], remaining_work: 50 }, active_planet: { id: 'home', planet_index: 0, home: true }, planets: [{ id: 'home', name: 'Gaia', x: 2, y: -1, planet_index: 0, population_total: 100, home: true }, { id: 'colony', name: 'Aurelia', x: 3, y: -1, planet_index: 1, population_total: 20, home: false }], fleets: [{ id: 'ready', name: 'Pronta', status: 'ARRIVED', mission: 'MOVE', x: 2, y: -1, destination_x: 2, destination_y: -1, ship_ids: [], eta: 0, propulsion: 'ion', mode: 'NORMAL', fuel_cost: 0, departure_at: 0, arrival_at: 0 }, { id: 'transit', name: 'Em rota', status: 'TRANSIT', mission: 'SURVEY', x: 2, y: -1, destination_x: 3, destination_y: -1, ship_ids: [], eta: 30, propulsion: 'ion', mode: 'NORMAL', fuel_cost: 1, departure_at: 0, arrival_at: 100 }], ships: [{ id: 'ship', hull_id: 'scout_hull', propulsion_id: 'ion', fuel_id: 'ion_fuel', crew: 1, mass: 1, ready_at: 0 }], travel_modes: [], notices: ['Registro existente'], unlocked_content: [],
};

function renderOverview(nextState: State = state) {
  const setActivePlanetId = vi.fn();
  const context: ShellContext = { catalog, state: nextState, activePlanetId: nextState.active_planet?.id ?? undefined, setActivePlanetId, execute: vi.fn(), busy: false, setFeedback: vi.fn() };
  render(<MemoryRouter initialEntries={['/overview']}><Routes><Route element={<Outlet context={context} />}><Route path="/overview" element={<OverviewView />} /><Route path="/research" element={<span>Pesquisa aberta</span>} /><Route path="/fleets" element={<span>Frotas abertas</span>} /><Route path="/planet" element={<span>Planeta aberto</span>} /><Route path="/shipyard" element={<span>Estaleiro aberto</span>} /></Route></Routes></MemoryRouter>);
  return { setActivePlanetId };
}

afterEach(cleanup);

describe('Imperial Command Overview', () => {
  it('aggregates real empire state and keeps local stocks out of the overview', () => {
    renderOverview();
    expect(screen.getByText('COMANDO IMPERIAL')).toBeInTheDocument();
    expect(screen.getByText('Mundos controlados')).toBeInTheDocument();
    expect(screen.getByText('População imperial')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('1 estacionada(s) · 1 em trânsito')).toBeInTheDocument();
    expect(screen.getByText('Engenharia orbital')).toBeInTheDocument();
    expect(screen.getByLabelText('Contexto do planeta atual').querySelector('img')).toHaveAttribute('src', '/static/planet-command-hero.png');
    expect(screen.queryByText('Recursos essenciais')).not.toBeInTheDocument();
    expect(screen.queryByText('REGISTRO RECENTE')).not.toBeInTheDocument();
  });

  it('renders real worlds, marks homeworld and selects through the shell context', () => {
    const { setActivePlanetId } = renderOverview();
    expect(screen.getAllByLabelText('Homeworld — mundo principal do império')).toHaveLength(2);
    const homeworld = screen.getByRole('button', { name: 'Selecionar planeta Gaia' });
    expect(homeworld).toHaveAttribute('aria-pressed', 'true');
    expect(homeworld.querySelector('.ui-icon')).toHaveStyle({ '--icon': "url('/static/icons/stellar-atlas/icon-planet-active.svg')" });
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar planeta Aurelia' }));
    expect(setActivePlanetId).toHaveBeenCalledWith('colony');
  });

  it('derives strategic actions from live state and routes them to real flows', () => {
    renderOverview({ ...state, research: { ...state.research, active: null } });
    expect(screen.getAllByText('Pesquisa inativa')).toHaveLength(2);
    expect(screen.getByText('Capacidade de construção disponível')).toBeInTheDocument();
    expect(screen.getByText('Movimento em andamento')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Pesquisa inativa/ }));
    expect(screen.getByText('Pesquisa aberta')).toBeInTheDocument();
  });
});
