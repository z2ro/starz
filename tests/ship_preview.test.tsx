import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
const renderer = vi.hoisted(() => ({ construct: vi.fn(), start: vi.fn(), setSelection: vi.fn(), setCamera: vi.fn(), dispose: vi.fn() }));
vi.mock('../frontend/src/shipgeometrylab/ShipLabRenderer', () => ({ ShipLabRenderer: class { constructor() { renderer.construct(); } start = renderer.start; setSelection = renderer.setSelection; setCamera = renderer.setCamera; dispose = renderer.dispose; } }));
import Scene from '../frontend/src/components/ships/ShipPreviewScene';
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it('retains one renderer through model changes and releases it on unmount', () => {
  const view = render(<Scene design="horizon" />); view.rerender(<Scene design="atlas" />);
  expect(renderer.construct).toHaveBeenCalledTimes(1); expect(renderer.setSelection).toHaveBeenLastCalledWith('atlas');
  fireEvent.click(screen.getByRole('button', { name: 'Popa' })); expect(renderer.setCamera).toHaveBeenLastCalledWith('Rear');
  view.unmount(); expect(renderer.dispose).toHaveBeenCalledTimes(1);
});
it('degrades explicitly when WebGL cannot initialize', () => {
  renderer.construct.mockImplementationOnce(() => { throw new Error('No WebGL'); }); render(<Scene design="vanguard" />);
  expect(screen.getByRole('status')).toHaveTextContent('Os dados e a construção continuam disponíveis');
});
