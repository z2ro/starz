import '@testing-library/jest-dom/vitest';

Object.defineProperty(window, 'matchMedia', { writable: true, value: (query: string) => ({ matches: false, media: query, onchange: null, addListener: () => undefined, removeListener: () => undefined, addEventListener: () => undefined, removeEventListener: () => undefined, dispatchEvent: () => false }) });

// Browser lifecycle APIs absent in jsdom; real dialog focus/viewport behavior is checked in Chromium.
class TestResizeObserver {observe(){} unobserve(){} disconnect(){}}
globalThis.ResizeObserver=TestResizeObserver as unknown as typeof ResizeObserver;
HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
