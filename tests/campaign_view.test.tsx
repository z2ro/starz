import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { CampaignView } from '../frontend/src/campaign/CampaignView';
import { CampaignStrip } from '../frontend/src/campaign/CampaignStrip';
import type { Campaign } from '../frontend/src/campaign/types';
import type { Catalog } from '../frontend/src/types/game';
import captured from './fixtures/fleet-api-catalog.json';
import { homeworld } from './fixtures/visualState';
vi.mock('../frontend/src/components/planet/PlanetProceduralView', () => ({ PlanetProceduralView: () => <div>Procedural scene</div> }));
vi.mock('../frontend/src/api/client', () => ({ apiRequest: async () => [] }));
const clients: QueryClient[] = [];
afterEach(() => { cleanup(); clients.forEach(c => c.clear()); clients.length = 0; });
function campaign(): Campaign { return { turn: 0, orders: 4, phase: 'PLAYING', integrity: 100, discoveries: 0, deliveries: 0, deadline: 60, turn_seconds: 300, project: 0, project_started: false, outcome: null, tutorial: 'Indústria sustentável', fleet_power: 0, health: {}, rivals: [], event: null, objectives: Array.from({ length: 7 }, (_, i) => ({ title: `Objetivo ${i}`, done: false })), sector: [{ x: 1, y: 1, kind: 'colony_signal', surveyed: false, planet_index: null }], log: [], jobs: [] }; }
function view(c: Campaign) {
  const state = { ...homeworld(), campaign: c, observed_at: 1000 }, execute = vi.fn(async () => ({}));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client);
  render(<QueryClientProvider client={client}><MemoryRouter><Routes><Route element={<Outlet context={{ state, catalog: captured as Catalog, execute, busy: false, setActivePlanetId: vi.fn() }} />}><Route path="/" element={<CampaignView />} /></Route></Routes></MemoryRouter></QueryClientProvider>);
  return execute;
}
it('guides the opening and sends real construction commands in the selected world', () => {
  const execute = view(campaign()); expect(screen.getByText('Construir processador')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar construção · 1 ordem' }));
  expect(execute).toHaveBeenCalledWith('build', { id: 'processor', planet_id: homeworld().active_planet!.id });
  expect(screen.getByRole('button', { name: 'Iniciar contenção · 1 ordem' })).toBeDisabled();
});
it('executes consequential event choices through the backend', () => {
  const c = campaign(); c.event = { id: 'relic', title: 'Arquivo', text: 'Decida.', choices: ['preserve', 'salvage'] }; const execute = view(c);
  fireEvent.click(screen.getByRole('button', { name: /Desmontar · \+80/ }));
  expect(execute).toHaveBeenCalledWith('campaign/order', expect.objectContaining({ action: 'event', choice: 'salvage' }));
});
it('shows the persisted ending and keeps a replay entry point', () => {
  const c = campaign(); c.phase = 'DEFEAT'; c.outcome = 'Homeworld perdido.'; view(c);
  expect(screen.getByText('Homeworld perdido.')).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Iniciar nova campanha' })).toBeEnabled();
});
it('prevents advancing until a pending event is resolved', () => {
  const c = campaign(); c.event = { id: 'flare', title: 'Frente', text: 'Escolha', choices: ['risk'] };
  render(<MemoryRouter><CampaignStrip campaign={c} busy={false} end={vi.fn()} /></MemoryRouter>);
  expect(screen.getByRole('button', { name: /Encerrar turno/ })).toBeDisabled();
});
