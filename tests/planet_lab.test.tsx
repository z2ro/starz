import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as THREE from 'three';
import { samplePlanet, seedNumber } from '../frontend/src/planetlab/planetGenerator';
import { DEFAULT_PLANET_LAB_SETTINGS as defaults, isPixelSize, PLANET_PRESETS } from '../frontend/src/planetlab/planetLabTypes';
import { disposeLabObject, planetLabPaletteSize } from '../frontend/src/planetlab/PlanetLabRenderer';
import { PlanetLabView } from '../frontend/src/planetlab/PlanetLabView';
import { readFileSync } from 'node:fs';

describe('procedural planet generator', () => {
  it('reproduces samples from a seed and changes with another seed', () => {
    const direction = { x: 0.6, y: 0, z: 0.8 };
    expect(samplePlanet(direction, defaults)).toEqual(samplePlanet(direction, { ...defaults }));
    expect(seedNumber('aurelia')).not.toBe(seedNumber('borealis'));
    expect(samplePlanet(direction, defaults)).not.toEqual(samplePlanet(direction, { ...defaults, seed: 'borealis' }));
  });
  it('samples the same normalized position across the longitude seam', () => {
    const left = samplePlanet({ x: -1, y: 0, z: 0 }, defaults);
    const right = samplePlanet({ x: -1, y: 0, z: Math.sin(Math.PI * 2) }, defaults);
    expect(left.elevation).toBeCloseTo(right.elevation, 10);
    expect(left.moisture).toBeCloseTo(right.moisture, 10);
  });
  it('keeps geographic samples finite and makes water/temperature controls effective', () => {
    let dryLand = 0, wetLand = 0;
    for (let index = 0; index < 100; index++) {
      const y = 1 - (index + 0.5) * 2 / 100;
      const radius = Math.sqrt(1 - y * y);
      const direction = { x: Math.cos(index * 2.39996) * radius, y, z: Math.sin(index * 2.39996) * radius };
      const sample = samplePlanet(direction, defaults);
      for (const value of [sample.elevation, sample.moisture, sample.temperature]) expect(value).toBeGreaterThanOrEqual(0);
      for (const value of [sample.elevation, sample.moisture, sample.temperature]) expect(value).toBeLessThanOrEqual(1);
      dryLand += Number(samplePlanet(direction, { ...defaults, waterCoverage: 0.35 }).land);
      wetLand += Number(samplePlanet(direction, { ...defaults, waterCoverage: 0.75 }).land);
    }
    expect(dryLand).toBeGreaterThan(wetLand);
    expect(samplePlanet({ x: 1, y: 0, z: 0 }, { ...defaults, temperature: 0.9 }).temperature).toBeGreaterThan(samplePlanet({ x: 1, y: 0, z: 0 }, { ...defaults, temperature: 0.3 }).temperature);
  });
  it('allows only the six requested pixel sizes and uses a fixed 48-color palette', () => {
    expect([1, 2, 3, 4, 5, 6].every(isPixelSize)).toBe(true);
    expect(isPixelSize(0)).toBe(false);
    expect(isPixelSize(2.5)).toBe(false);
    expect(planetLabPaletteSize()).toBe(48);
  });
});

it('disposes shared geometry, materials and textures once', () => {
  const group = new THREE.Group();
  const geometry = new THREE.BoxGeometry();
  const texture = new THREE.Texture();
  const material = new THREE.MeshStandardMaterial({ map: texture, roughnessMap: texture });
  group.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material));
  const disposeGeometry = vi.spyOn(geometry, 'dispose');
  const disposeMaterial = vi.spyOn(material, 'dispose');
  const disposeTexture = vi.spyOn(texture, 'dispose');
  disposeLabObject(group);
  expect(disposeGeometry).toHaveBeenCalledTimes(1);
  expect(disposeMaterial).toHaveBeenCalledTimes(1);
  expect(disposeTexture).toHaveBeenCalledTimes(1);
  expect(group.children).toHaveLength(0);
});

describe('isolated planet lab controls', () => {
  beforeEach(() => { cleanup(); vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
  it('opens without gameplay shell and reports unsupported graphics', () => {
    render(<MemoryRouter><PlanetLabView /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Planet Lab 02' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('WebGL não disponível');
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Voltar ao STARZ/ })).toBeInTheDocument();
  });
  it('updates rendering, animation and planet controls', () => {
    render(<MemoryRouter><PlanetLabView /></MemoryRouter>);
    fireEvent.click(screen.getByLabelText('RAW 3D'));
    expect(screen.getByLabelText('RAW 3D')).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
    const water = screen.getByRole('slider', { name: /Water level/ });
    fireEvent.change(water, { target: { value: '0.4' } });
    expect(water).toHaveValue('0.4');
    fireEvent.click(screen.getByRole('button', { name: 'polar' }));
    expect(screen.getByRole('button', { name: 'polar' })).toHaveAttribute('aria-pressed', 'true');
  });
  it('registers a lazy route outside AppShell and keeps sidebar unchanged', () => {
    const router = readFileSync('frontend/src/app/router.tsx', 'utf8');
    expect(router.indexOf('path="/planet-lab"')).toBeLessThan(router.indexOf('element={<AppShell'));
    expect(router).toContain("import('../planetlab/PlanetLabView')");
    expect(readFileSync('frontend/src/components/shell/Sidebar.tsx', 'utf8')).not.toContain('planet-lab');
  });
  it('applies family presets while preserving the current seed and render mode', () => {
    render(<MemoryRouter><PlanetLabView /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'STARZ-003' }));
    fireEvent.click(screen.getByLabelText('RAW 3D'));
    fireEvent.click(screen.getByRole('button', { name: 'OCEANIC' }));
    expect(screen.getByRole('button', { name: 'OCEANIC' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'STARZ-003' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('slider', { name: 'Water level' })).toHaveValue(String(PLANET_PRESETS.oceanic.parameters.waterCoverage));
    expect(screen.getByRole('slider', { name: 'Continent scale' })).toHaveValue(String(PLANET_PRESETS.oceanic.parameters.continentScale));
    expect(screen.getByLabelText('RAW 3D')).toBeChecked();
    fireEvent.change(screen.getByRole('slider', { name: 'Water level' }), { target: { value: '0.65' } });
    expect(screen.getByRole('slider', { name: 'Water level' })).toHaveValue('0.65');
    fireEvent.click(screen.getByRole('button', { name: 'FROZEN' }));
    expect(screen.getByRole('slider', { name: 'Temperature' })).toHaveValue(String(PLANET_PRESETS.frozen.parameters.temperature));
    expect(screen.getByRole('button', { name: 'STARZ-003' })).toHaveAttribute('aria-pressed', 'true');
  });
  it('navigates fixed seeds and applies an explicit custom seed without changing the family', () => {
    render(<MemoryRouter><PlanetLabView /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'DESERT' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next seed' }));
    expect(screen.getByRole('button', { name: 'STARZ-001' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Previous seed' }));
    expect(screen.getByRole('button', { name: 'STARZ-005' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.change(screen.getByLabelText('Seed'), { target: { value: 'my-world' } });
    fireEvent.click(screen.getByRole('button', { name: 'regenerate' }));
    expect(screen.getByText('DESERT · SEED my-world')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'DESERT' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('region', { name: 'Planet generation diagnostics' })).toHaveTextContent('Area-weighted');
  });
});
