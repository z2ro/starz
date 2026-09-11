import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlanetHeader } from '../frontend/src/components/planet/PlanetHeader';
import { PlanetHero } from '../frontend/src/components/planet/PlanetHero';
import { PlanetInspector } from '../frontend/src/components/planet/PlanetInspector';
import type { Catalog, State } from '../frontend/src/types/game';

vi.mock('../frontend/src/components/planet/PlanetThreeView', () => ({ PlanetThreeView: () => <div data-testid="planet-three-view" /> }));

const now = Date.now() / 1000;
const catalog: Catalog = {
  resources: [{ id: 'raw_ore', name: 'Ferrita', category: 'natural', description: '', cost: {}, requires: [] }],
  fuels: [],
  districts: [{ id: 'ore_extractor', name: 'Extrator', category: 'industrial', description: 'Produção local.', cost: {}, requires: [], duration: 60, workforce: 1, energy_generation: 0, energy_consumption: 1, production: { raw_ore: 2 }, processing: {}, research_rate: 0, population_capacity: 0, industrial_capacity: 1, construction_slots: 0, shipyard_slots: 0 }],
  technologies: [{ id: 'orbital_engineering', name: 'Engenharia orbital', category: 'science', description: 'Pesquisa ativa.', cost: {}, requires: [], duration: 100, unlocks: [] }],
  ships: [], propulsion: [], travel_modes: [],
};
const state: State = {
  system: { name: 'Asterion', x: 2, y: -1, star: { stellar_class: 'G', mass: 1, luminosity: 1, age: 4, activity: .2 }, planet: { name: 'Gaia', mass: 1, radius: 1, gravity: 1, orbital_distance: 1, temperature: 288, atmosphere: 'nitrogen', radiation: .2, magnetic_field: 1, water: 60, geological_activity: .2, mineral_profile: {}, usable_surface: 70 } },
  stocks: { raw_ore: 10 }, capacities: { energy_generation: 10, energy_consumption: 4, energy_coverage: 1, industrial_capacity: 1, construction_slots: 1, construction_slots_available: 0, shipyard_slots: 1, shipyard_slots_available: 1, effective_research_rate: 1, workforce_supply: 4, workforce_demand: 1, workforce_coverage: 1, crew_committed: 0 }, population: { total: 10, available: 9, capacity: 20 }, districts: { ore_extractor: 1 }, construction: [{ id: 'ore_extractor', started_at: now - 30, complete_at: now + 30 }], research: { active: 'orbital_engineering', complete_at: now + 60, completed: [], remaining_work: 50 }, active_planet: { id: 'home', planet_index: 0, home: true }, planets: [{ id: 'home', name: 'Gaia', x: 2, y: -1, planet_index: 0, population_total: 10, home: true }, { id: 'colony', name: 'Aurelia', x: 3, y: -1, planet_index: 1, population_total: 4, home: false }], fleets: [{ id: 'fleet-1', name: 'Expedição Asterion', status: 'ARRIVED', mission: 'MOVE', x: 2, y: -1, destination_x: 2, destination_y: -1, ship_ids: [], eta: 0, propulsion: 'ion', mode: 'NORMAL', fuel_cost: 0, departure_at: now - 60, arrival_at: now - 30 }], ships: [], travel_modes: [], notices: [], unlocked_content: [],
};

afterEach(() => { cleanup(); window.history.replaceState({}, '', '/'); });

describe('Imperial Command Planet view', () => {
  it('uses selected planet data in the header and selector', () => {
    const onChange = vi.fn();
    render(<PlanetHeader state={state} onPlanetChange={onChange} />);
    expect(screen.getByText('Gaia')).toBeInTheDocument();
    expect(screen.getByText('Asterion · 2:-1 · Planeta 1')).toBeInTheDocument();
    expect(screen.getByText('HOMEWORLD')).toBeInTheDocument();
    expect(screen.getByLabelText('Homeworld — mundo principal do império')).toHaveClass('homeworld-badge');
    expect(screen.getByLabelText('Homeworld — mundo principal do império')).not.toHaveClass('badge');
    expect(document.querySelector('.homeworld-badge-wide')).toHaveTextContent('HOMEWORLD');
    expect(document.querySelector('.homeworld-badge-compact')).toHaveTextContent('HOME');
    expect(document.querySelector('.hero-kicker .ui-icon')).toHaveStyle({ '--icon': "url('/static/icons/stellar-atlas/icon-planet-active.svg')" });
    fireEvent.change(screen.getByLabelText('Selecionar planeta'), { target: { value: 'colony' } });
    expect(onChange).toHaveBeenCalledWith('colony');
  });

  it('maps real inspector data, nominal rates and accessible sections without empty mineral data', () => {
    render(<PlanetInspector catalog={catalog} state={state} tab="overview" onTab={vi.fn()} onNavigate={vi.fn()} />);
    expect(screen.getByText('Características físicas')).toBeInTheDocument();
    expect(screen.getByText('Desenvolvimento')).toBeInTheDocument();
    expect(screen.getByText('Produção local')).toBeInTheDocument();
    expect(screen.getByText('+120/h nom.')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Órbita' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('button', { name: 'Abrir estaleiro' })).toBeInTheDocument();
    expect(document.querySelector('.planet-active-icon .ui-icon')).toHaveStyle({ '--icon': "url('/static/icons/stellar-atlas/icon-planet-active.svg')" });
    render(<PlanetInspector catalog={catalog} state={state} tab="data" onTab={vi.fn()} onNavigate={vi.fn()} />);
    expect(screen.getByText('Contexto astronômico')).toBeInTheDocument();
    expect(screen.queryByText('Informações minerais')).not.toBeInTheDocument();
  });

  it('uses live queue, research and local fleet operations in the continuous deck', () => {
    render(<PlanetHero catalog={catalog} state={state} onPlanetChange={vi.fn()} onNavigate={vi.fn()} />);
    expect(screen.getByAltText('')).toHaveAttribute('src', '/static/planet-command-hero.png');
    expect(screen.getByText('Extrator')).toBeInTheDocument();
    expect(screen.getByText('Engenharia orbital')).toBeInTheDocument();
    expect(screen.getByText('Expedição Asterion')).toBeInTheDocument();
    expect(screen.getByText(/Estacionada/)).toBeInTheDocument();
    expect(screen.getByLabelText('Presença orbital do sistema')).toHaveTextContent('Estaleiro orbital');
  });

  it('keeps the explicit 3d and image-error fallback contracts', () => {
    window.history.replaceState({}, '', '/?planet_visual=3d#/planet');
    const threeMode = render(<PlanetHero catalog={catalog} state={{ ...state, research: { ...state.research, active: null, complete_at: null } }} onPlanetChange={vi.fn()} onNavigate={vi.fn()} />);
    expect(screen.getByTestId('planet-three-view')).toBeInTheDocument();
    expect(screen.getByText('Pesquisa inativa')).toBeInTheDocument();
    threeMode.unmount();
    window.history.replaceState({}, '', '/');
    render(<PlanetHero catalog={catalog} state={state} onPlanetChange={vi.fn()} onNavigate={vi.fn()} />);
    fireEvent.error(screen.getByAltText(''));
    expect(screen.getByTestId('planet-three-view')).toBeInTheDocument();
  });
});
