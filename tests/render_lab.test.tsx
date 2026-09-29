import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { RenderLabView } from '../frontend/src/renderlab/RenderLabView';
import { CAMERA_PRESETS, DEFAULT_RENDER_LAB_OPTIONS, HORIZON_ASSET_PATH, hasWebGPU } from '../frontend/src/renderlab/renderLabTypes';
import { collectUniqueResources, countUniqueMaterials, disposeResources, updateMaterialUniforms, type MaterialUniformRecord } from '../frontend/src/renderlab/ShipRenderer';

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

  it('updates the surface variation uniform without rebuilding material records', () => {
    const record = { experimental: { metalness: 0 } as THREE.MeshPhysicalNodeMaterial, roughness: { value: 0.52 }, surfaceVariation: { value: 0.075 }, emission: { value: 2.4 } } satisfies MaterialUniformRecord;
    updateMaterialUniforms([record], { baseRoughness: 0.64, surfaceVariation: 0.16, engineEmission: 3.1, metalness: 0.9 });
    expect(record.surfaceVariation?.value).toBe(0.16);
    expect(record.roughness?.value).toBe(0.64);
    expect(record.experimental.metalness).toBe(0.9);
    expect(record.emission?.value).toBe(3.1);
  });

  it('counts and disposes shared geometry, materials and textures once', () => {
    const geometry = new THREE.BoxGeometry();
    const texture = new THREE.Texture();
    const original = new THREE.MeshStandardMaterial({ map: texture });
    const experimental = new THREE.MeshStandardMaterial({ map: texture });
    const root = new THREE.Group();
    root.add(new THREE.Mesh(geometry, original), new THREE.Mesh(geometry, original));
    const resources = collectUniqueResources(root, [original, experimental]);
    expect(resources.geometries.size).toBe(1);
    expect(resources.materials.size).toBe(2);
    expect(resources.textures.size).toBe(1);
    expect(countUniqueMaterials([original, [original, experimental]])).toBe(2);
    const disposeGeometry = vi.spyOn(geometry, 'dispose');
    const disposeOriginal = vi.spyOn(original, 'dispose');
    const disposeExperimental = vi.spyOn(experimental, 'dispose');
    const disposeTexture = vi.spyOn(texture, 'dispose');
    disposeResources(resources);
    expect(disposeGeometry).toHaveBeenCalledTimes(1);
    expect(disposeOriginal).toHaveBeenCalledTimes(1);
    expect(disposeExperimental).toHaveBeenCalledTimes(1);
    expect(disposeTexture).toHaveBeenCalledTimes(1);
  });
});
