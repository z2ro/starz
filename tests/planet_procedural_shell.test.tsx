import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRouter } from '../frontend/src/app/router';
import { PLANET_VISUAL_PREFERENCE_KEY } from '../frontend/src/components/planet/planetVisualPreference';
import { planetCatalog, planetPair, SECOND_PLANET_ID } from './fixtures/planetIntegration';

const gpu = vi.hoisted(() => ({ construct: vi.fn(), setDescriptor: vi.fn(), dispose: vi.fn() }));
vi.mock('../frontend/src/space-scene-live/LiveSceneRenderer', () => ({ LiveSceneRenderer: class {
  canvas: HTMLCanvasElement;
  constructor(host: HTMLElement) { gpu.construct(); this.canvas = document.createElement('canvas'); host.appendChild(this.canvas); }
  start() {} setOptions() {} setHeroInsets() {} setDescriptor = gpu.setDescriptor;
  dispose() { this.canvas.remove(); gpu.dispose(); }
} }));
const clients: QueryClient[] = [];
const response = (body: unknown) => ({ ok: true, json: async () => body }) as Response;
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); localStorage.setItem(PLANET_VISUAL_PREFERENCE_KEY, 'procedural');
  window.location.hash = '#/planet';
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ getExtension: () => null } as unknown as WebGL2RenderingContext);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});
afterEach(() => { cleanup(); clients.forEach(client => client.clear()); clients.length = 0; vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); window.history.replaceState({}, '', '/'); });
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }); clients.push(client);
  return { client, ...render(<QueryClientProvider client={client}><AppRouter /></QueryClientProvider>) };
}

it('retains the real Planet View canvas across selection, hides old HUD/inspector and makes no additional API requests', async () => {
  const { home, other } = planetPair(); let resolveOther!: (value: Response) => void;
  const requests: string[] = [];
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    requests.push(url);
    return url.includes(SECOND_PLANET_ID) ? new Promise<Response>(resolve => { resolveOther = resolve; }) : Promise.resolve(response(url.includes('/api/catalog') ? planetCatalog : home));
  }));
  const view = mount();
  await waitFor(() => expect(document.querySelector('.planet-hero')).toHaveAttribute('data-visual-mode', 'procedural'));
  const canvas = document.querySelector('canvas'); expect(canvas).not.toBeNull();
  fireEvent.change(screen.getByLabelText('Selecionar planeta'), { target: { value: SECOND_PLANET_ID } });
  expect(screen.getByText('Sincronizando planeta selecionado…')).toBeInTheDocument();
  expect(document.querySelector('.shell-snapshot-content')).toHaveAttribute('inert');
  expect(gpu.setDescriptor).toHaveBeenLastCalledWith(null); expect(document.querySelector('canvas')).toBe(canvas);
  await waitFor(() => expect(resolveOther).toBeDefined());
  await act(async () => resolveOther(response(other)));
  await screen.findByRole('heading', { name: other.system.planet.name });
  expect(screen.queryByText('Sincronizando planeta selecionado…')).not.toBeInTheDocument();
  expect(document.querySelector('.shell-snapshot-content')).not.toHaveAttribute('inert');
  expect(gpu.setDescriptor.mock.calls.at(-1)![0].identity.planetKey).toBe(SECOND_PLANET_ID);
  expect(gpu.construct).toHaveBeenCalledTimes(1); expect(document.querySelector('canvas')).toBe(canvas);
  expect(requests.sort()).toEqual(['/api/catalog', '/api/state', `/api/state?planet_id=${SECOND_PLANET_ID}`].sort());
  view.unmount(); expect(gpu.dispose).toHaveBeenCalledTimes(1);
});

it('covers errors during a selected-planet load and recovers without reviving an old snapshot', async () => {
  const { home, other } = planetPair(); let failing = true;
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes(SECOND_PLANET_ID)) { if (failing) throw new Error('Fixture offline'); return response(other); }
    return response(url.includes('/api/catalog') ? planetCatalog : home);
  }));
  mount(); await waitFor(() => expect(gpu.construct).toHaveBeenCalledTimes(1)); const canvas = document.querySelector('canvas');
  fireEvent.change(screen.getByLabelText('Selecionar planeta'), { target: { value: SECOND_PLANET_ID } });
  await screen.findByText('Não foi possível sincronizar o planeta.');
  expect(gpu.setDescriptor).toHaveBeenLastCalledWith(null); expect(document.querySelector('canvas')).toBe(canvas);
  failing = false; fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  await screen.findByRole('heading', { name: other.system.planet.name });
  expect(gpu.construct).toHaveBeenCalledTimes(1); expect(document.querySelector('canvas')).toBe(canvas);
});
