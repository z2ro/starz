import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SpaceSceneLiveView } from '../frontend/src/space-scene-live/SpaceSceneLiveView';
import { queryKeys } from '../frontend/src/api/queries';
import { geographicKey } from '../frontend/src/space-scene-live/livePresentation';
import type { SpaceSceneDescriptor } from '../frontend/src/visual-state/types';
import { liveCatalog, realSnapshot, localFleetSnapshot, transitSnapshot, incompleteSnapshot } from './fixtures/liveSnapshots';

const gpu = vi.hoisted(() => ({ construct: vi.fn(), start: vi.fn(), setDescriptor: vi.fn(), setOptions: vi.fn(), resetCamera: vi.fn(), dispose: vi.fn() }));
vi.mock('../frontend/src/space-scene-live/LiveSceneRenderer', () => ({ LiveSceneRenderer: class {
  constructor(...args: unknown[]) { gpu.construct(...args); }
  start = gpu.start; setDescriptor = gpu.setDescriptor; setOptions = gpu.setOptions; resetCamera = gpu.resetCamera; dispose = gpu.dispose;
} }));
const clients: QueryClient[] = [];
const reply = (value: unknown) => ({ ok: true, json: async () => value }) as Response;
const HOME = realSnapshot().active_planet!.id!;
const OTHER = '22222222-2222-4222-8222-222222222222';
function snapshots() {
  const home = realSnapshot(), other = realSnapshot();
  const roster = [...home.planets!, { id: OTHER, name: 'Fixture world B', x: home.system!.x!, y: home.system!.y!, planet_index: 1, population_total: 20, home: false }];
  home.planets = roster; other.planets = roster;
  other.active_planet = { id: OTHER, planet_index: 1, home: false }; other.population = { total: 20 };
  other.system = { ...other.system, planet: { ...other.system!.planet, id: 'planet-0-1-1', name: 'Fixture world B' } };
  return { home, other };
}
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }); clients.push(client);
  const view = render(<QueryClientProvider client={client}><MemoryRouter><SpaceSceneLiveView /></MemoryRouter></QueryClientProvider>);
  return { client, ...view };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ getExtension: () => ({ loseContext: () => undefined }) } as unknown as WebGL2RenderingContext);
  vi.stubGlobal('fetch', vi.fn(async (url: string) => reply(url.includes('/api/catalog') ? liveCatalog : realSnapshot())));
});
afterEach(() => { cleanup(); clients.forEach(client => client.clear()); clients.length = 0; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('uses real API hooks, keeps the renderer mounted and clears old snapshot on planet switch', async () => {
  const { home, other } = snapshots(); let resolveOther!: (value: Response) => void;
  vi.stubGlobal('fetch', vi.fn((url: string) => url.includes(OTHER) ? new Promise<Response>(resolve => { resolveOther = resolve; }) : Promise.resolve(reply(url.includes('catalog') ? liveCatalog : home))));
  const view = mount();
  expect(screen.getByText('Carregando snapshot do planeta…')).toBeInTheDocument();
  await screen.findByRole('heading', { name: home.system!.planet!.name! });
  expect(gpu.construct).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByRole('combobox', { name: 'Planeta selecionado' }), { target: { value: OTHER } });
  expect(document.querySelector('main')).toHaveAttribute('data-active-planet', '');
  expect(gpu.setDescriptor).toHaveBeenLastCalledWith(null);
  expect(screen.queryByRole('heading', { name: home.system!.planet!.name! })).not.toBeInTheDocument();
  await act(async () => resolveOther(reply(other)));
  await screen.findByRole('heading', { name: 'Fixture world B' });
  expect(document.querySelector('main')).toHaveAttribute('data-active-planet', OTHER);
  expect(gpu.construct).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledWith(`/api/state?planet_id=${OTHER}`, undefined);
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  view.unmount(); expect(gpu.dispose).toHaveBeenCalledTimes(1);
});

it('does not apply a late response for a planet no longer selected', async () => {
  const { home, other } = snapshots(); let resolveOther!: (value: Response) => void;
  vi.stubGlobal('fetch', vi.fn((url: string) => url.includes(OTHER) ? new Promise<Response>(resolve => { resolveOther = resolve; }) : Promise.resolve(reply(url.includes('catalog') ? liveCatalog : home))));
  mount(); await screen.findByRole('heading', { name: home.system!.planet!.name! });
  const selector = screen.getByRole('combobox', { name: 'Planeta selecionado' });
  fireEvent.change(selector, { target: { value: OTHER } });
  await waitFor(() => expect(resolveOther).toBeDefined());
  fireEvent.change(selector, { target: { value: HOME } });
  await screen.findByRole('heading', { name: home.system!.planet!.name! });
  await act(async () => resolveOther(reply(other)));
  expect(document.querySelector('main')).toHaveAttribute('data-active-planet', HOME);
  expect(gpu.setDescriptor.mock.calls.at(-1)![0].identity.planetKey).toBe(HOME);
});

it('rejects mismatched API planet identity rather than combining its scene and diagnostics', async () => {
  const { home } = snapshots(); vi.stubGlobal('fetch', vi.fn(async (url: string) => reply(url.includes('catalog') ? liveCatalog : home)));
  mount(); await screen.findByRole('heading', { name: home.system!.planet!.name! });
  fireEvent.change(screen.getByRole('combobox', { name: 'Planeta selecionado' }), { target: { value: OTHER } });
  expect(await screen.findByRole('alert')).toHaveTextContent('Snapshot incompatível');
  expect(gpu.setDescriptor).toHaveBeenLastCalledWith(null);
  expect(screen.getByText('População local · UNKNOWN')).toBeInTheDocument();
});

it('applies population and naval updates without remount; preserves geographic identity', async () => {
  const { client } = mount(); await screen.findByText('Snapshot sincronizado');
  const initial = gpu.setDescriptor.mock.calls.at(-1)![0] as SpaceSceneDescriptor;
  const updates = [{ ...realSnapshot(), population: { total: 0 } }, localFleetSnapshot(), transitSnapshot(), { ...localFleetSnapshot(), ships: localFleetSnapshot().ships!.map(ship => ({ ...ship, hull_id: 'unknown-hull' })) }];
  for (const [index, state] of updates.entries()) {
    await act(async () => client.setQueryData(queryKeys.state(), state));
    await waitFor(() => {
      const updated = gpu.setDescriptor.mock.calls.at(-1)![0] as SpaceSceneDescriptor;
      if (index === 0) expect(updated.civilization.population).toBe(0);
      else expect(updated.ships.visibleCount).toBe(index === 1 ? 1 : 0);
    });
    const descriptor = gpu.setDescriptor.mock.calls.at(-1)![0] as SpaceSceneDescriptor;
    expect(geographicKey(descriptor)).toBe(geographicKey(initial));
    if (index === 0) expect(descriptor.civilization.lightsEnabled).toBe(false);
    else expect(descriptor.ships.visibleCount).toBe(index === 1 ? 1 : 0);
  }
  expect(gpu.construct).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByLabelText('RAW 3D')); fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
  expect(gpu.setOptions).toHaveBeenLastCalledWith({ raw: true, paused: true });
  fireEvent.click(screen.getByRole('button', { name: 'Reset camera' })); expect(gpu.resetCamera).toHaveBeenCalled();
  await act(async () => client.setQueryData(queryKeys.state(), incompleteSnapshot()));
  expect(await screen.findByText(/Identidade ou família insuficiente/)).toBeInTheDocument();
  expect(screen.getByText('Família · UNKNOWN')).toBeInTheDocument();
  expect(gpu.construct).toHaveBeenCalledTimes(1);
});

it('handles API failure/retry without a fictional fallback and clears cached scene on refresh failure', async () => {
  let failure = true;
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (!url.includes('catalog') && failure) throw new Error('API offline');
    return reply(url.includes('catalog') ? liveCatalog : realSnapshot());
  }));
  const { client } = mount();
  expect(await screen.findByRole('alert')).toHaveTextContent('API offline'); expect(gpu.setDescriptor).toHaveBeenLastCalledWith(null);
  failure = false; fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  await screen.findByText('Snapshot sincronizado');
  failure = true; await act(async () => { await client.invalidateQueries({ queryKey: queryKeys.state() }); });
  expect(await screen.findByRole('alert')).toHaveTextContent('API offline'); expect(gpu.setDescriptor).toHaveBeenLastCalledWith(null);
  expect(document.querySelector('main')).toHaveAttribute('data-active-planet', '');
  expect(gpu.construct).toHaveBeenCalledTimes(1);
});

it('exposes provenance and missing contracts, and disposes failed renderer startup', async () => {
  gpu.start.mockImplementationOnce(() => { throw new Error('GPU startup failed'); });
  mount(); expect(await screen.findByRole('alert')).toHaveTextContent('GPU startup failed');
  expect(gpu.dispose).toHaveBeenCalledTimes(1);
  await screen.findByText('Snapshot sincronizado');
  expect(screen.getByText(/Estação: UNKNOWN/)).toBeInTheDocument(); expect(screen.getByText(/Lua: UNKNOWN/)).toBeInTheDocument();
  fireEvent.click(screen.getByText(/Decisões do adapter/));
  expect(screen.getByText('runtime.shipPlacement')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Comparar Lab 02' })).toHaveAttribute('href', '/space-scene-lab');
});
