import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SpaceSceneLabView } from '../frontend/src/spacescenelab/SpaceSceneLabView';
import type { SpaceSceneStats } from '../frontend/src/spacescenelab/spaceSceneTypes';

const renderer = vi.hoisted(() => ({ construct: vi.fn(), start: vi.fn(), setSettings: vi.fn(), setCamera: vi.fn(), dispose: vi.fn() }));
vi.mock('../frontend/src/spacescenelab/SpaceSceneRenderer', () => ({ SpaceSceneRenderer: class {
  constructor(...args: unknown[]) { renderer.construct(...args); }
  start = renderer.start; setSettings = renderer.setSettings; setCamera = renderer.setCamera; dispose = renderer.dispose;
} }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ getExtension: () => ({ loseContext: () => undefined }) } as unknown as WebGL2RenderingContext);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('mounts outside gameplay and propagates family, seed, orbital and render controls', () => {
  render(<MemoryRouter><SpaceSceneLabView /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: 'Space Scene Lab 01' })).toBeInTheDocument();
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Voltar ao STARZ' })).toHaveAttribute('href', '/overview');
  fireEvent.click(screen.getByRole('button', { name: 'OCEANIC' }));
  expect(screen.getByRole('button', { name: 'OCEANIC' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.change(screen.getByRole('textbox', { name: 'Seed' }), { target: { value: 'STARZ-004' } });
  fireEvent.click(screen.getByRole('button', { name: 'Regenerate' }));
  fireEvent.change(screen.getByRole('slider', { name: 'Orbit speed' }), { target: { value: '0.7' } });
  fireEvent.change(screen.getByRole('slider', { name: 'Orbit inclination' }), { target: { value: '60' } });
  fireEvent.change(screen.getByRole('slider', { name: 'Orbit radius' }), { target: { value: '3' } });
  fireEvent.change(screen.getByRole('slider', { name: 'Apparent ship size' }), { target: { value: '1.1' } });
  fireEvent.change(screen.getByRole('slider', { name: 'Engine emission' }), { target: { value: '2' } });
  fireEvent.change(screen.getByRole('slider', { name: 'Star azimuth' }), { target: { value: '200' } });
  fireEvent.change(screen.getByRole('slider', { name: 'Star elevation' }), { target: { value: '50' } });
  fireEvent.change(screen.getByRole('slider', { name: 'Light intensity' }), { target: { value: '3' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Pixel size' }), { target: { value: '6' } });
  for (const label of ['Ship visibility', 'RAW 3D', 'Outline', 'Dither']) fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
  expect(renderer.setSettings).toHaveBeenLastCalledWith(expect.objectContaining({
    family: 'oceanic', seed: 'STARZ-004', regeneration: 1, shipVisible: false, raw: true, outlines: false, dither: false,
    paused: true, orbitSpeed: 0.7, orbitInclination: 60, orbitRadius: 3, shipLength: 1.1, engineEmission: 2,
    starAzimuth: 200, starElevation: 50, intensity: 3, pixelSize: 6,
  }));
  expect(renderer.construct).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Resume' })).toHaveAttribute('aria-pressed', 'true');
});

it('keeps camera controls available while paused and resets an active preset', () => {
  render(<MemoryRouter><SpaceSceneLabView /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
  fireEvent.click(screen.getByRole('button', { name: 'Ship Focus', exact: true }));
  expect(renderer.setCamera).toHaveBeenLastCalledWith('Ship Focus');
  fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
  const count = renderer.setCamera.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
  expect(renderer.setCamera.mock.calls.length).toBe(count + 1);
  expect(renderer.setCamera).toHaveBeenLastCalledWith('Cinematic');
});

it('refreshes debug output without reconstructing the renderer and disposes on unmount', () => {
  const view = render(<MemoryRouter><SpaceSceneLabView /></MemoryRouter>);
  const report = renderer.construct.mock.calls[0][2] as (stats: SpaceSceneStats) => void;
  act(() => report({ fps: 42, frameTime: 23.8, triangles: 48000, drawCalls: 18, resolution: '400 × 240', orbitPhase: 2, shipCenterOccluded: false, visualTime: 1, safeRadius: 2.05 }));
  expect(screen.getByText('400 × 240')).toBeInTheDocument();
  expect(renderer.construct).toHaveBeenCalledTimes(1);
  expect(renderer.start).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(renderer.dispose).toHaveBeenCalledTimes(1);
});

it('shows unsupported WebGL and releases a renderer that fails during startup', () => {
  vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
  const view = render(<MemoryRouter><SpaceSceneLabView /></MemoryRouter>);
  expect(screen.getByRole('alert')).toHaveTextContent('WebGL 2 não disponível');
  expect(renderer.construct).not.toHaveBeenCalled();
  view.unmount();
  vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue({ getExtension: () => null } as unknown as WebGL2RenderingContext);
  renderer.start.mockImplementationOnce(() => { throw new Error('Startup failed'); });
  render(<MemoryRouter><SpaceSceneLabView /></MemoryRouter>);
  expect(screen.getByRole('alert')).toHaveTextContent('Startup failed');
  expect(renderer.dispose).toHaveBeenCalledTimes(1);
});
