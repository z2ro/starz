import { StrictMode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PlanetHero } from '../frontend/src/components/planet/PlanetHero';
import { PLANET_VISUAL_PREFERENCE_KEY, readPlanetVisualPreference } from '../frontend/src/components/planet/planetVisualPreference';
import { geographicKey } from '../frontend/src/space-scene-live/livePresentation';
import { heroFrustum } from '../frontend/src/space-scene-live/heroFraming';
import { planetCatalog, planetPair, planetSnapshot } from './fixtures/planetIntegration';

const gpu = vi.hoisted(() => ({ construct: vi.fn(), start: vi.fn(), setDescriptor: vi.fn(), setOptions: vi.fn(), setHeroInsets: vi.fn(), dispose: vi.fn(), disconnected: vi.fn() }));
vi.mock('../frontend/src/space-scene-live/LiveSceneRenderer', () => ({ LiveSceneRenderer: class {
  canvas: HTMLCanvasElement; disposed = false;
  constructor(host: HTMLElement, ...args: unknown[]) { gpu.construct(host, ...args); this.canvas = document.createElement('canvas'); host.appendChild(this.canvas); }
  start = gpu.start; setDescriptor = gpu.setDescriptor; setOptions = gpu.setOptions; setHeroInsets = gpu.setHeroInsets;
  dispose() { if (this.disposed) return; this.disposed = true; this.canvas.remove(); gpu.dispose(); }
} }));
const props = () => ({ state: planetSnapshot(), catalog: planetCatalog, onPlanetChange: vi.fn(), onNavigate: vi.fn() });
const context = () => ({ getExtension: () => ({ loseContext: () => undefined }) }) as unknown as WebGL2RenderingContext;
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context());
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect = gpu.disconnected; });
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); window.history.replaceState({}, '', '/'); });

it('starts with IMAGE, switches accessibly, persists preference and disposes when returning to IMAGE', async () => {
  const first = render(<PlanetHero {...props()} />);
  expect(screen.getByRole('button', { name: 'IMAGE' })).toHaveAttribute('aria-pressed', 'true');
  expect(gpu.construct).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'PROCEDURAL' }));
  await waitFor(() => expect(document.querySelector('.planet-hero')).toHaveAttribute('data-visual-mode', 'procedural'));
  expect(localStorage.getItem(PLANET_VISUAL_PREFERENCE_KEY)).toBe('procedural');
  expect(screen.getByAltText('')).not.toBeVisible();
  expect(fetch).not.toHaveBeenCalled();
  first.unmount(); expect(gpu.dispose).toHaveBeenCalledTimes(1);
  render(<PlanetHero {...props()} />);
  await waitFor(() => expect(gpu.construct).toHaveBeenCalledTimes(2));
  expect(screen.getByRole('button', { name: 'PROCEDURAL' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'IMAGE' }));
  expect(screen.getByAltText('')).toBeVisible(); expect(gpu.dispose).toHaveBeenCalledTimes(2);
  expect(document.querySelector('canvas')).toBeNull(); expect(localStorage.getItem(PLANET_VISUAL_PREFERENCE_KEY)).toBe('image');
});

it('updates population/fleets and planet selection on the same renderer and clears suspended snapshots', async () => {
  localStorage.setItem(PLANET_VISUAL_PREFERENCE_KEY, 'procedural');
  const value = props(), view = render(<PlanetHero {...value} />);
  await waitFor(() => expect(gpu.construct).toHaveBeenCalledTimes(1));
  const canvas = document.querySelector('canvas'), first = gpu.setDescriptor.mock.calls.at(-1)![0];
  view.rerender(<PlanetHero {...value} state={{ ...value.state, population: { ...value.state.population, total: 0 } }} />);
  const updated = gpu.setDescriptor.mock.calls.at(-1)![0];
  expect(updated.civilization.lightsEnabled).toBe(false); expect(geographicKey(updated)).toBe(geographicKey(first));
  const local = { ...value.state, fleets: value.state.fleets.map(fleet => ({ ...fleet, x: value.state.system.x, y: value.state.system.y })) };
  view.rerender(<PlanetHero {...value} state={local} />);
  expect(gpu.setDescriptor.mock.calls.at(-1)![0].ships.visibleCount).toBe(1);
  view.rerender(<PlanetHero {...value} snapshotReady={false} />); expect(gpu.setDescriptor).toHaveBeenLastCalledWith(null);
  const { other } = planetPair(); view.rerender(<PlanetHero {...value} state={other} />);
  expect(gpu.setDescriptor.mock.calls.at(-1)![0].identity.planetKey).toBe(other.active_planet!.id);
  expect(document.querySelector('canvas')).toBe(canvas); expect(gpu.construct).toHaveBeenCalledTimes(1); expect(fetch).not.toHaveBeenCalled();
});

it('falls back on unsupported WebGL, preserves requested preference and allows explicit retry', async () => {
  vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
  const view = render(<PlanetHero {...props()} />); fireEvent.click(screen.getByRole('button', { name: 'PROCEDURAL' }));
  expect(await screen.findByText('Procedural indisponível. Exibindo imagem.')).toBeInTheDocument();
  expect(document.querySelector('.planet-hero')).toHaveAttribute('data-visual-mode', 'image'); expect(screen.getByAltText('')).toBeVisible();
  expect(gpu.construct).not.toHaveBeenCalled(); expect(localStorage.getItem(PLANET_VISUAL_PREFERENCE_KEY)).toBe('procedural');
  view.rerender(<PlanetHero {...props()} />); expect(gpu.construct).not.toHaveBeenCalled();
  vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(context());
  fireEvent.click(screen.getByRole('button', { name: 'PROCEDURAL' }));
  await waitFor(() => expect(document.querySelector('.planet-hero')).toHaveAttribute('data-visual-mode', 'procedural'));
});

it('falls back and releases resources on startup, rendering failure and lost context', async () => {
  localStorage.setItem(PLANET_VISUAL_PREFERENCE_KEY, 'procedural'); gpu.start.mockImplementationOnce(() => { throw new Error('startup'); });
  const view = render(<PlanetHero {...props()} />);
  await screen.findByText('Procedural indisponível. Exibindo imagem.'); expect(gpu.dispose).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'PROCEDURAL' }));
  await waitFor(() => expect(gpu.construct).toHaveBeenCalledTimes(2));
  act(() => gpu.construct.mock.calls.at(-1)![2](new Error('frame failed')));
  expect(screen.getByAltText('')).toBeVisible(); expect(gpu.dispose).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('button', { name: 'PROCEDURAL' })); await waitFor(() => expect(gpu.construct).toHaveBeenCalledTimes(3));
  fireEvent(document.querySelector('canvas')!, new Event('webglcontextlost', { cancelable: true }));
  expect(screen.getByAltText('')).toBeVisible(); expect(gpu.dispose).toHaveBeenCalledTimes(3);
  view.unmount(); expect(gpu.disconnected).toHaveBeenCalled();
});

it('survives blocked storage and ignores invalid preference values', async () => {
  localStorage.setItem(PLANET_VISUAL_PREFERENCE_KEY, 'invalid'); expect(readPlanetVisualPreference()).toBe('image');
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
  render(<PlanetHero {...props()} />); fireEvent.click(screen.getByRole('button', { name: 'PROCEDURAL' }));
  await waitFor(() => expect(document.querySelector('.planet-hero')).toHaveAttribute('data-visual-mode', 'procedural'));
});

it('cancels asynchronous startup in StrictMode and when switching away immediately', async () => {
  localStorage.setItem(PLANET_VISUAL_PREFERENCE_KEY, 'procedural');
  expect(readPlanetVisualPreference()).toBe('procedural');
  const first = render(<StrictMode><PlanetHero {...props()} /></StrictMode>);
  await waitFor(() => expect(gpu.construct, document.querySelector('.planet-visual-notice')?.getAttribute('title') ?? '').toHaveBeenCalledTimes(1)); first.unmount(); expect(gpu.dispose).toHaveBeenCalledTimes(1);
  render(<PlanetHero {...props()} />); fireEvent.click(screen.getByRole('button', { name: 'IMAGE' }));
  await act(async () => {}); expect(gpu.construct).toHaveBeenCalledTimes(1);
});

it('keeps the complete planet in the unoccupied hero area across desktop and mobile targets', () => {
  for (const [width, height, top, bottom] of [[1384, 1026, 145, 185], [958, 846, 145, 170], [904, 714, 140, 145], [390, 920, 170, 390]]) for (const ship of [false, true]) {
    const frame = heroFrustum(width, height, { top, bottom }, ship);
    const scale = height / (frame.top - frame.bottom);
    const x = (0 - frame.left) * scale, y = frame.top * scale;
    expect(x - 1.36 * scale).toBeGreaterThan(0); expect(x + 1.36 * scale).toBeLessThan(width);
    expect(y - 1.36 * scale).toBeGreaterThan(top); expect(y + 1.36 * scale).toBeLessThan(height - bottom);
  }
  expect(() => heroFrustum(NaN, 100, { top: 0, bottom: 0 }, false)).toThrow();
});
