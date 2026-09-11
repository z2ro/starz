import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResearchView } from '../frontend/src/views/ResearchView';
import { defaultTechnologyId, technologyGraph, technologyState } from '../frontend/src/views/researchMap';
import type { ShellContext } from '../frontend/src/components/shell/AppShell';
import type { Catalog, State, Technology } from '../frontend/src/types/game';

const technologies: Technology[] = [
  { id: 'orbital_engineering', name: 'Engenharia orbital', category: 'orbital', description: 'Estrutura orbital.', cost: { components: 12 }, requires: [], duration: 45, unlocks: ['orbital_shipyard'] },
  { id: 'nuclear_propulsion', name: 'Propulsão nuclear', category: 'propulsion', description: 'Propulsão avançada.', cost: { refined_alloy: 30 }, requires: ['orbital_engineering'], duration: 75, unlocks: [] },
  { id: 'lab_theory', name: 'Teoria de laboratório', category: 'science', description: 'Exige laboratório.', cost: {}, requires: ['research_lab'], duration: 30, unlocks: [] },
  { id: 'survey_theory', name: 'Teoria de levantamento', category: 'science', description: 'Programa disponível.', cost: {}, requires: [], duration: 20, unlocks: [] },
];
const catalog: Catalog = { resources: [{ id: 'components', name: 'Componentes', category: 'component', description: '', cost: {}, requires: [] }, { id: 'refined_alloy', name: 'Liga refinada', category: 'material', description: '', cost: {}, requires: [] }], fuels: [], districts: [{ id: 'research_lab', name: 'Laboratório de pesquisa', category: 'science', description: '', cost: {}, requires: [], duration: 1, workforce: 1, energy_generation: 0, energy_consumption: 1, production: {}, processing: {}, research_rate: 1, population_capacity: 0, industrial_capacity: 0, construction_slots: 0, shipyard_slots: 0 }, { id: 'orbital_shipyard', name: 'Estaleiro orbital', category: 'orbital', description: '', cost: {}, requires: [], duration: 1, workforce: 0, energy_generation: 0, energy_consumption: 0, production: {}, processing: {}, research_rate: 0, population_capacity: 0, industrial_capacity: 0, construction_slots: 0, shipyard_slots: 1 }], technologies, ships: [], propulsion: [], travel_modes: [] };
const state: State = {
  system: { name: 'Asterion', x: 2, y: -1, star: { stellar_class: 'G', mass: 1, luminosity: 1, age: 4, activity: .2 }, planet: { name: 'Gaia', mass: 1, radius: 1, gravity: 1, orbital_distance: 1, temperature: 288, atmosphere: 'nitrogen', radiation: .2, magnetic_field: 1, water: 60, geological_activity: .2, mineral_profile: {}, usable_surface: 70 } },
  stocks: { components: 20, refined_alloy: 40 }, capacities: { energy_generation: 10, energy_consumption: 4, energy_coverage: 1, industrial_capacity: 1, construction_slots: 1, construction_slots_available: 1, shipyard_slots: 0, shipyard_slots_available: 0, effective_research_rate: 2, workforce_supply: 4, workforce_demand: 1, workforce_coverage: 1, crew_committed: 0 }, population: { total: 10, available: 9, capacity: 20 }, districts: { research_lab: 0 }, construction: [], research: { active: 'nuclear_propulsion', complete_at: Date.now() / 1000 + 30, completed: ['orbital_engineering'], remaining_work: 30 }, active_planet: { id: 'home', planet_index: 0, home: true }, planets: [{ id: 'home', name: 'Gaia', x: 2, y: -1, planet_index: 0, population_total: 10, home: true }], fleets: [], ships: [], travel_modes: [], notices: [], unlocked_content: [],
};

function renderResearch(nextState: State = state, nextCatalog: Catalog = catalog) {
  const execute = vi.fn().mockResolvedValue({});
  const context: ShellContext = { catalog: nextCatalog, state: nextState, activePlanetId: 'home', setActivePlanetId: vi.fn(), execute, busy: false, setFeedback: vi.fn() };
  render(<MemoryRouter initialEntries={['/research']}><Routes><Route element={<Outlet context={context} />}><Route path="/research" element={<ResearchView />} /></Route></Routes></MemoryRouter>);
  return { execute };
}

afterEach(cleanup);

describe('Scientific Systems Map', () => {
  it('derives completed, active, available and locked states with the documented precedence', () => {
    renderResearch();
    expect(screen.getByRole('button', { name: 'Engenharia orbital: CONCLUÍDA' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Propulsão nuclear: ATIVA' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Teoria de levantamento: DISPONÍVEL' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Teoria de laboratório: BLOQUEADA' })).toBeInTheDocument();
    expect(screen.getByLabelText('Inspector de tecnologia')).toHaveTextContent('Propulsão nuclear');
    expect(screen.getByLabelText('Pesquisa ativa')).toHaveTextContent('30 unidades restantes');
  });

  it('maps only technology requirements as graph edges and remains finite on cycles', () => {
    const graph = technologyGraph(technologies);
    expect(graph.edges).toEqual([{ from: 'orbital_engineering', to: 'nuclear_propulsion' }]);
    expect(graph.depth.orbital_engineering).toBe(0);
    expect(graph.depth.nuclear_propulsion).toBe(1);
    expect(graph.edges.some(edge => edge.from === 'research_lab' || edge.to === 'research_lab')).toBe(false);
    const cycle = technologyGraph([{ ...technologies[0], requires: ['nuclear_propulsion'] }, technologies[1]]);
    expect(cycle.hasCycle).toBe(true);
    expect(cycle.depth.orbital_engineering).toBeGreaterThanOrEqual(0);
  });

  it('shows real external requirement labels and unlocks in the inspector', () => {
    renderResearch();
    fireEvent.click(screen.getByRole('button', { name: 'Teoria de laboratório: BLOQUEADA' }));
    const inspector = screen.getByLabelText('Inspector de tecnologia');
    expect(within(inspector).getByText('Laboratório de pesquisa')).toBeInTheDocument();
    expect(within(inspector).getByText('Pendente')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Engenharia orbital: CONCLUÍDA' }));
    expect(within(screen.getByLabelText('Inspector de tecnologia')).getByText('Estaleiro orbital')).toBeInTheDocument();
  });

  it('filters by real category and status without changing dependency data', () => {
    renderResearch();
    fireEvent.click(within(screen.getByRole('group', { name: 'Categorias' })).getByRole('button', { name: 'science' }));
    expect(screen.queryByRole('button', { name: 'Propulsão nuclear: ATIVA' })).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('group', { name: 'Estados' })).getByRole('button', { name: 'BLOQUEADA' }));
    expect(screen.getByRole('button', { name: 'Teoria de laboratório: BLOQUEADA' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Teoria de levantamento: DISPONÍVEL' })).not.toBeInTheDocument();
  });

  it('uses deterministic default selection, locks parallel research and starts an available program explicitly', () => {
    expect(defaultTechnologyId(catalog, state)).toBe('nuclear_propulsion');
    expect(technologyState(catalog, state, technologies[1])).toBe('active');
    renderResearch();
    fireEvent.click(screen.getByRole('button', { name: 'Teoria de levantamento: DISPONÍVEL' }));
    expect(screen.getByLabelText('Inspector de tecnologia')).toHaveTextContent('Programa de pesquisa já ativo.');
    const inactive = { ...state, research: { active: null, complete_at: null, completed: ['orbital_engineering'], remaining_work: 0 } };
    const { execute } = renderResearch(inactive);
    fireEvent.click(screen.getAllByRole('button', { name: 'Teoria de levantamento: DISPONÍVEL' }).at(-1)!);
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar pesquisa' }));
    expect(execute).toHaveBeenCalledWith('research', { id: 'survey_theory' });
    expect(screen.queryByText('Próxima fila')).not.toBeInTheDocument();
  });

  it('renders safe empty catalog and inactive console states', () => {
    renderResearch({ ...state, research: { active: null, complete_at: null, completed: [], remaining_work: 0 } }, { ...catalog, technologies: [] });
    expect(screen.getByText('Nenhuma tecnologia catalogada')).toBeInTheDocument();
    renderResearch({ ...state, research: { active: null, complete_at: null, completed: ['orbital_engineering'], remaining_work: 0 } });
    expect(screen.getByText('Nenhum programa em andamento')).toBeInTheDocument();
    expect(screen.getByText('Não existe fila de pesquisa no domínio atual.')).toBeInTheDocument();
  });
});
