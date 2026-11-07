import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { PixelCommand } from '../frontend/src/pixel-command/PixelCommand';
import { planetSnapshot, planetCatalog } from './fixtures/planetIntegration';
const gpu = vi.hoisted(() => ({ mount: vi.fn(), dispose: vi.fn() }));
vi.mock('../frontend/src/universe/useUniverse', () => ({ useUniverse: () => ({}) }));
vi.mock('../frontend/src/components/planet/PlanetProceduralView', async () => {
  const { useEffect } = await import('react');
  return { PlanetProceduralView: ({ orbitGuide }: { orbitGuide?: boolean }) => {
    useEffect(() => { gpu.mount(); return gpu.dispose; }, []);
    return <div className="planet-procedural-stage"><canvas/>{orbitGuide && <div className="master-orbit-guide"/>}</div>;
  } };
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it('keeps Overview visual mode, interactive mount and contained guide synchronized through repeated switches', () => {
  render(<MemoryRouter><Routes><Route element={<Outlet context={{ state: planetSnapshot(), catalog: planetCatalog, snapshotReady: true }}/> }><Route path="/" element={<PixelCommand/>}/></Route></Routes></MemoryRouter>);
  const scene = document.querySelector('.strategy-world-scene')!;
  expect(scene).toHaveAttribute('data-visual-mode', 'procedural');
  expect(scene.querySelector('.master-orbit-guide')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Imagem', exact: true }));
  expect(scene).toHaveAttribute('data-visual-mode', 'image'); expect(scene.querySelector('canvas')).toBeNull();
  expect(screen.getByRole('button', { name: 'Imagem', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(gpu.dispose).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Procedural', exact: true }));
  expect(scene).toHaveAttribute('data-visual-mode', 'procedural'); expect(scene.querySelector('canvas')).toBeTruthy();
  expect(gpu.mount).toHaveBeenCalledTimes(2);
});
