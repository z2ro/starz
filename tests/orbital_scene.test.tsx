import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { OrbitalSystemScene } from '../frontend/src/galaxy/OrbitalSystemScene';
import { planetSnapshot, planetCatalog } from './fixtures/planetIntegration';
import type { GalaxySystem } from '../frontend/src/types/game';
const gpu = vi.hoisted(() => ({ construct: vi.fn(), dispose: vi.fn(), setSystem: vi.fn(), select: vi.fn(), setPaused: vi.fn() }));
vi.mock('../frontend/src/galaxy/OrbitalSystemRenderer', () => ({ OrbitalSystemRenderer: class {
  canvas = document.createElement('canvas');
  constructor(host: HTMLElement, ...args: unknown[]) { this.canvas.className = 'orbital-canvas'; host.append(this.canvas); gpu.construct(host, ...args); }
  setSystem = gpu.setSystem; select = gpu.select; setPaused = gpu.setPaused;
  dispose() { this.canvas.remove(); gpu.dispose(); }
} }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const system: GalaxySystem = { id: 'known', x: 0, y: 0, distance: 0, home: true, knowledge_level: 'SURVEYED', planets: [] };
it('retains one renderer across selection and snapshot updates, then releases it on close', async () => {
  const state = planetSnapshot(), props = { system, state, catalog: planetCatalog, onPlanet: vi.fn(), onFleet: vi.fn() };
  const view = render(<OrbitalSystemScene {...props}/>);
  await waitFor(() => expect(gpu.construct).toHaveBeenCalledTimes(1)); const canvas = document.querySelector('canvas');
  view.rerender(<OrbitalSystemScene {...props} selectedIndex={0} state={{ ...state, stocks: { ...state.stocks, components: 50 }, population: { ...state.population, total: 0 } }}/>);
  expect(document.querySelector('canvas')).toBe(canvas); expect(gpu.construct).toHaveBeenCalledTimes(1); expect(gpu.select).toHaveBeenLastCalledWith(0);
  view.unmount(); expect(gpu.dispose).toHaveBeenCalledTimes(1); expect(document.querySelector('canvas')).toBeNull();
});
it('reports renderer failure and disposes without retaining an interactive canvas', async () => {
  render(<OrbitalSystemScene system={system} state={planetSnapshot()} catalog={planetCatalog} onPlanet={vi.fn()} onFleet={vi.fn()}/>);
  await waitFor(() => expect(gpu.construct).toHaveBeenCalledTimes(1));
  act(() => gpu.construct.mock.calls[0][3](new Error('WebGL indisponível')));
  expect(screen.getByRole('alert')).toHaveTextContent('WebGL indisponível'); expect(gpu.dispose).toHaveBeenCalledTimes(1); expect(document.querySelector('canvas')).toBeNull();
});
