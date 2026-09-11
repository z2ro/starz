import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EconomyView } from '../frontend/src/views/EconomyView';
import type { ShellContext } from '../frontend/src/components/shell/AppShell';
import type { Catalog, State } from '../frontend/src/types/game';

const catalog: Catalog = {
  resources: [{ id: 'raw_ore', name: 'Ferrita bruta', category: 'natural', description: '', cost: {}, requires: [] }, { id: 'volatiles', name: 'Voláteis', category: 'natural', description: '', cost: {}, requires: [] }, { id: 'refined_alloy', name: 'Liga refinada', category: 'material', description: '', cost: {}, requires: [] }, { id: 'components', name: 'Componentes', category: 'component', description: '', cost: {}, requires: [] }],
  fuels: [{ id: 'ion_fuel', name: 'Combustível iônico', category: 'fuel', description: '', cost: {}, requires: [], energy_density: 1, storage_factor: 1 }],
  districts: [{ id: 'ore_extractor', name: 'Extrator de ferrita', category: 'Mining', description: 'Extrai minério.', cost: {}, requires: [], duration: 1, workforce: 4, energy_generation: 0, energy_consumption: 2, production: { raw_ore: 2 }, processing: {}, research_rate: 0, population_capacity: 0, industrial_capacity: 0, construction_slots: 0, shipyard_slots: 0 }, { id: 'processor', name: 'Processador de materiais', category: 'Industrial', description: 'Converte matéria-prima.', cost: {}, requires: [], duration: 1, workforce: 6, energy_generation: 0, energy_consumption: 4, production: { refined_alloy: 1, components: .25 }, processing: { raw_ore: 1.5, volatiles: .5 }, research_rate: 0, population_capacity: 0, industrial_capacity: 2, construction_slots: 0, shipyard_slots: 0 }],
  technologies: [], ships: [], propulsion: [], travel_modes: [],
};
const state: State = {
  system: { name: 'Asterion', x: 2, y: -1, star: { stellar_class: 'G', mass: 1, luminosity: 1, age: 4, activity: .2 }, planet: { name: 'Gaia', mass: 1, radius: 1, gravity: 1, orbital_distance: 1, temperature: 288, atmosphere: 'nitrogen', radiation: .2, magnetic_field: 1, water: 60, geological_activity: .2, mineral_profile: {}, usable_surface: 70 } },
  stocks: { raw_ore: 32, volatiles: 10, refined_alloy: 4, components: 1, ion_fuel: 6 }, capacities: { energy_generation: 10, energy_consumption: 6, energy_coverage: 1, industrial_capacity: 2, construction_slots: 2, construction_slots_available: 1, shipyard_slots: 1, shipyard_slots_available: 1, effective_research_rate: 0, workforce_supply: 20, workforce_demand: 14, workforce_coverage: 1, crew_committed: 0 }, population: { total: 20, available: 6, capacity: 40 }, districts: { ore_extractor: 2, processor: 1 }, construction: [], research: { active: null, complete_at: null, completed: [], remaining_work: 0 }, active_planet: { id: 'home', planet_index: 0, home: true }, planets: [{ id: 'home', name: 'Gaia', x: 2, y: -1, planet_index: 0, population_total: 20, home: true }], fleets: [], ships: [], travel_modes: [], notices: ['Registro que permanece no ContextPanel'], unlocked_content: [],
};

function renderEconomy(nextState: State = state) {
  const context: ShellContext = { catalog, state: nextState, activePlanetId: 'home', setActivePlanetId: vi.fn(), execute: vi.fn(), busy: false, setFeedback: vi.fn() };
  return render(<MemoryRouter initialEntries={['/economy']}><Routes><Route element={<Outlet context={context} />}><Route path="/economy" element={<EconomyView />} /><Route path="/planet" element={<span>Planeta aberto</span>} /></Route></Routes></MemoryRouter>);
}

afterEach(cleanup);

describe('Industrial Command Network', () => {
  it('renders only local stock with nominal production and local capacities', () => {
    renderEconomy();
    expect(screen.getByText('Economia local')).toBeInTheDocument();
    expect(screen.getAllByText('Ferrita bruta').length).toBeGreaterThan(0);
    expect(screen.getAllByText('+4/min nom.').length).toBeGreaterThan(0);
    expect(screen.getByText('Geração')).toBeInTheDocument();
    expect(screen.getAllByText('Demanda')).toHaveLength(2);
    expect(screen.getAllByText('Cobertura: 100%')).toHaveLength(2);
    expect(screen.getByText('Capacidade nominal')).toBeInTheDocument();
    expect(screen.queryByText(/produção efetiva/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/estoque imperial/i)).not.toBeInTheDocument();
    expect(screen.queryByText('REGISTRO RECENTE')).not.toBeInTheDocument();
  });

  it('maps processing inputs and production outputs from active district data', () => {
    renderEconomy();
    const flow = within(screen.getByLabelText('Rede industrial local'));
    expect(flow.getByText('Processador de materiais')).toBeInTheDocument();
    expect(flow.getByText('Voláteis')).toBeInTheDocument();
    expect(flow.getByText('Liga refinada')).toBeInTheDocument();
    expect(flow.getByText('Nível 1')).toBeInTheDocument();
  });

  it('selects resource and processor details without changing routes', () => {
    renderEconomy();
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar recurso Liga refinada' }));
    const resourceDetail = screen.getByLabelText('Detalhe do recurso');
    expect(within(resourceDetail).getByText('Liga refinada')).toBeInTheDocument();
    expect(within(resourceDetail).getByText('Produtores')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar infraestrutura Processador de materiais' }));
    const processorDetail = screen.getByLabelText('Detalhe da infraestrutura');
    expect(within(processorDetail).getByText('Processador de materiais')).toBeInTheDocument();
    expect(within(processorDetail).getByText('Impacto local')).toBeInTheDocument();
  });

  it('keeps the flow stable when no economic district is active', () => {
    renderEconomy({ ...state, districts: { ore_extractor: 0, processor: 0 } });
    expect(screen.getByText('Nenhuma cadeia industrial ativa')).toBeInTheDocument();
    expect(screen.getByText('Sem infraestrutura econômica')).toBeInTheDocument();
  });
});
