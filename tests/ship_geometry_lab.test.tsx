import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ShipGeometryLabView } from '../frontend/src/shipgeometrylab/ShipGeometryLabView';

const renderer = vi.hoisted(() => ({ construct: vi.fn(), start: vi.fn(), setSettings: vi.fn(), setCamera: vi.fn(), setSelection: vi.fn(), dispose: vi.fn() }));
vi.mock('../frontend/src/shipgeometrylab/ShipLabRenderer', () => ({ ShipLabRenderer: class {
  constructor(...args: unknown[]) { renderer.construct(...args); }
  start = renderer.start;
  setSettings = renderer.setSettings;
  setCamera = renderer.setCamera;
  setSelection = renderer.setSelection;
  dispose = renderer.dispose;
} }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ getExtension: () => ({ loseContext: () => undefined }) } as unknown as WebGL2RenderingContext);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('isolated ship geometry lab', () => {
  it('mounts one renderer and propagates functional geometry, material and rendering controls', () => {
    render(<MemoryRouter><ShipGeometryLabView /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Ship Geometry Lab 03 · Imperial Fleet' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar ao STARZ' })).toHaveAttribute('href', '/overview');
    expect(renderer.construct).toHaveBeenCalledTimes(1);
    expect(renderer.start).toHaveBeenCalledTimes(1);
    for (const name of ['Show hull only', 'SILHOUETTE', 'RAW 3D', 'Show bounding box']) fireEvent.click(screen.getByLabelText(name));
    fireEvent.change(screen.getByRole('slider', { name: 'Hull tone' }), { target: { value: '0.8' } });
    fireEvent.change(screen.getByRole('slider', { name: 'Star azimuth' }), { target: { value: '125' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Pixel size' }), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(renderer.setSettings).toHaveBeenLastCalledWith(expect.objectContaining({ hullOnly: true, silhouette: true, raw: true, boundingBox: true, hullTone: 0.8, azimuth: 125, pixelSize: 6, paused: true }));
    expect(renderer.construct).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Resume' })).toHaveAttribute('aria-pressed', 'true');
  });
  it('selects camera presets and resets an already active preset', () => {
    render(<MemoryRouter><ShipGeometryLabView /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Rear', exact: true }));
    expect(renderer.setCamera).toHaveBeenLastCalledWith('Rear');
    expect(screen.getByRole('button', { name: 'Rear', exact: true })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(renderer.setCamera).toHaveBeenLastCalledWith('3/4 Front');
    const count = renderer.setCamera.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(renderer.setCamera.mock.calls.length).toBe(count + 1);
  });
  it('selects three real procedural recipes and a comparative gallery on the same renderer', () => {
    render(<MemoryRouter><ShipGeometryLabView /></MemoryRouter>);
    for (const name of ['Horizon', 'Wayfarer', 'Vanguard']) {
      fireEvent.click(screen.getByRole('button', { name }));
      expect(renderer.setSelection).toHaveBeenLastCalledWith(name.toLowerCase());
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'true');
    }
    fireEvent.click(screen.getByRole('button', { name: 'Comparar frota' }));
    expect(renderer.setSelection).toHaveBeenLastCalledWith('fleet');
    expect(screen.getByLabelText('Naves em comparação')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Wayfarer' }));
    expect(renderer.setSelection).toHaveBeenLastCalledWith('wayfarer');
    expect(renderer.construct).toHaveBeenCalledTimes(1);
    expect(renderer.dispose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Comparar escala' }));
    expect(renderer.setSelection).toHaveBeenLastCalledWith('scale');
    expect(renderer.setCamera).toHaveBeenLastCalledWith('Top');
  });
  it('disposes the renderer on unmount', () => {
    const view = render(<MemoryRouter><ShipGeometryLabView /></MemoryRouter>);
    view.unmount();
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
  });
  it('handles unsupported WebGL and startup errors visibly', () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
    const view = render(<MemoryRouter><ShipGeometryLabView /></MemoryRouter>);
    expect(screen.getByRole('alert')).toHaveTextContent('WebGL 2 não disponível');
    expect(renderer.construct).not.toHaveBeenCalled();
    view.unmount();
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue({ getExtension: () => null } as unknown as WebGL2RenderingContext);
    renderer.start.mockImplementationOnce(() => { throw new Error('Test startup error'); });
    render(<MemoryRouter><ShipGeometryLabView /></MemoryRouter>);
    expect(screen.getByRole('alert')).toHaveTextContent('Test startup error');
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
  });
});
