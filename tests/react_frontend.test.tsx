import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../frontend/src/app/App';

const catalog = { resources: [{ id: 'raw_ore', name: 'Ferrita', category: 'natural', description: '', cost: {}, requires: [] }], fuels: [{ id: 'ion_fuel', name: 'Combustível', category: 'fuel', description: '', cost: {}, requires: [], energy_density: 1, storage_factor: 1 }], districts: [], technologies: [], ships: [], propulsion: [], travel_modes: [{ id: 'NORMAL', name: 'Normal', description: '', category: 'travel', cost: {}, requires: [], travel_time_modifier: 1, fuel_modifier: 1, thermal_modifier: 1, signature_modifier: 1 }] };
const state = { system: { name: 'Asterion', x: 0, y: 0, star: { stellar_class: 'G', mass: 1, luminosity: 1, age: 4, activity: .2 }, planet: { name: 'Gaia', mass: 1, radius: 1, gravity: 1, orbital_distance: 1, temperature: 288, atmosphere: 'nitrogen', radiation: .2, magnetic_field: 1, water: 60, geological_activity: .2, mineral_profile: {}, usable_surface: 70 } }, stocks: { raw_ore: 10, ion_fuel: 4 }, capacities: { energy_generation: 10, energy_consumption: 4, energy_coverage: 1, industrial_capacity: 1, construction_slots: 1, construction_slots_available: 1, shipyard_slots: 0, shipyard_slots_available: 0, effective_research_rate: 0, workforce_supply: 4, workforce_demand: 1, workforce_coverage: 1, crew_committed: 0 }, population: { total: 10, available: 9, capacity: 20 }, districts: {}, construction: [], research: { active: null, complete_at: null, completed: [], remaining_work: 0 }, active_planet: { id: 'home', planet_index: 0, home: true }, planets: [{ id: 'home', name: 'Gaia', x: 0, y: 0, planet_index: 0, population_total: 10, home: true, stocks: { raw_ore: 10 } }], fleets: [], ships: [], travel_modes: catalog.travel_modes, notices: [], unlocked_content: [] };
const galaxy = { center: [0, 0], home: [0, 0], radius: 2, systems: [{ id: '0:0', name: 'Asterion', x: 0, y: 0, distance: 0, home: true, knowledge_level: 'SURVEYED', star: { stellar_class: 'G', luminosity: 1, activity: .2 }, planet: { name: 'Gaia', gravity: 1, temperature: 288, water: 60, radiation: .2 } }, { id: '1:0', x: 1, y: 0, distance: 1, home: false, knowledge_level: 'UNKNOWN' }] };

beforeEach(() => { vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => url.includes('/catalog') ? catalog : url.includes('/galaxy') ? galaxy : state })) ); window.location.hash = '#/overview'; });
afterEach(() => cleanup());

describe('React frontend parity', () => {
  it('mounts the app, renders HUD and exposes all routes', async () => {
    render(<App />);
    await screen.findByText('COMANDO IMPERIAL');
    expect(screen.getAllByText('Ferrita').length).toBeGreaterThan(0);
    for (const route of ['Visão geral', 'Planeta', 'Economia', 'Pesquisa', 'Estaleiro', 'Frotas', 'Galáxia']) expect(screen.getAllByText(route).length).toBeGreaterThan(0);
  });

  it('navigates to Planet and keeps image mode by default', async () => {
    render(<App />);
    await screen.findByText('COMANDO IMPERIAL');
    fireEvent.click(screen.getByText('Planeta'));
    await waitFor(() => expect(screen.getByText('COMANDO PLANETÁRIO')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Planeta' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByAltText('')).toHaveAttribute('src', '/static/planet-command-hero.png');
    expect(screen.getByRole('tab', { name: 'Visão geral' })).toHaveAttribute('aria-selected', 'true');
  });

  it('opens notification and settings icon actions with accessible labels', async () => {
    render(<App />);
    await screen.findByText('COMANDO IMPERIAL');
    fireEvent.click(screen.getByLabelText('Abrir registros'));
    expect(screen.getAllByText('REGISTRO RECENTE')).toHaveLength(2);
    fireEvent.click(screen.getByLabelText('Abrir configurações'));
    expect(screen.getByText('Modo estratégico')).toBeInTheDocument();
  });

  it('renders the Galaxy unknown state without physical details', async () => {
    render(<App />);
    await screen.findByText('COMANDO IMPERIAL');
    fireEvent.click(screen.getByText('Galáxia'));
    await screen.findByRole('button', { name: /Sistema desconhecido, coordenadas 1:0/ });
    fireEvent.click(screen.getByRole('button', { name: /Sistema desconhecido, coordenadas 1:0/ }));
    expect(screen.getByText('Sistema não mapeado')).toBeInTheDocument();
    expect(screen.getByText('UNKNOWN')).toBeInTheDocument();
    expect(screen.queryByText('Gravidade')).not.toBeInTheDocument();
  });
});
