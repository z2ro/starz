import { createRef } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { ResearchConnections, researchConnector } from '../frontend/src/universe/ResearchConnections';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const box = (x: number, y: number) => ({ x, y, width: 208, height: 112 });
it('connects actual side ports with orthogonal paths in gutters and routes long links below cards', () => {
  expect(researchConnector(box(0, 80), box(240, 208), 448, 0)).toBe('M208,136 H216 V264 H240');
  expect(researchConnector(box(0, 80), box(0, 208), 448, 0)).toBe('M208,136 H216 V264 H208');
  expect(researchConnector(box(0, 80), box(720, 208), 448, 1)).toBe('M208,136 H220 V470 H712 V264 H720');
});
it('measures ports in the same local coordinate space across zoom, scroll, resize and unmount', () => {
  let scale = 1, offset = 120;
  const disconnect = vi.fn();
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect = disconnect; });
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1200);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function(this: HTMLElement) {
    const b = this.dataset.techId === 'a' ? box(0, 80) : this.dataset.techId === 'b' ? box(240, 208) : { x: 0, y: 0, width: 1200, height: 500 };
    return { left: offset + b.x * scale, top: offset + b.y * scale, width: b.width * scale, height: b.height * scale } as DOMRect;
  });
  const container = createRef<HTMLDivElement>();
  const tree = () => <div ref={container}><button data-tech-id="a"/><button data-tech-id="b"/><ResearchConnections container={container} edges={[{ from: 'a', to: 'b', className: 'chain' }]}/></div>;
  const view = render(tree());
  expect(document.querySelector('path')?.getAttribute('d')).toBe('M208,136 H216 V264 H240');
  scale = 1.7; offset = -300; view.rerender(tree());
  const path = document.querySelector('path')!;
  const coordinates = path.getAttribute('d')!.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
  coordinates.forEach((value, i) => expect(value).toBeCloseTo([208,136,216,264,240][i]));
  expect(path).toHaveClass('chain');
  view.unmount(); expect(disconnect).toHaveBeenCalled();
});
