import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RenderLabView } from '../frontend/src/renderlab/RenderLabView';
import { CAMERA_PRESETS, DEFAULT_RENDER_LAB_OPTIONS, HORIZON_ASSET_PATH, hasWebGPU } from '../frontend/src/renderlab/renderLabTypes';

afterEach(cleanup);

describe('Render Lab foundation', () => {
  it('keeps a deterministic Horizon asset path and camera presets', () => {
    expect(HORIZON_ASSET_PATH).toBe('/static/models/horizon.glb');
    expect(CAMERA_PRESETS).toEqual(['3/4 FRONT', 'SIDE', 'REAR', 'TOP']);
    expect(DEFAULT_RENDER_LAB_OPTIONS.materialMode).toBe('experimental');
  });

  it('shows an explicit unsupported WebGPU state without creating a renderer', () => {
    expect(hasWebGPU()).toBe(false);
    render(<RenderLabView />);
    expect(screen.getByText('WebGPU não disponível neste navegador.')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Render Lab WebGPU da Horizon' })).not.toBeInTheDocument();
  });
});
