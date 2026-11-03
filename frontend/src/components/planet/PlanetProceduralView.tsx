import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { createVisualDescriptor } from '../../visual-state/VisualStateAdapter';
import { liveGeneration } from '../../space-scene-live/livePresentation';
import type { LiveSceneRenderer } from '../../space-scene-live/LiveSceneRenderer';
import type { Catalog, State } from '../../types/game';

let rendererModule: Promise<typeof import('../../space-scene-live/LiveSceneRenderer')> | undefined;
function loadRenderer() {
  return rendererModule ??= import('../../space-scene-live/LiveSceneRenderer').catch(error => { rendererModule = undefined; throw error; });
}

export function PlanetProceduralView({ state, catalog, snapshotReady, onReady, onFailure }: {
  state: State; catalog: Catalog; snapshotReady: boolean; onReady: () => void; onFailure: (message: string) => void;
}) {
  const descriptor = useMemo(() => snapshotReady ? createVisualDescriptor(state, catalog) : null, [state, catalog, snapshotReady]);
  const latest = useRef(descriptor), host = useRef<HTMLDivElement>(null), renderer = useRef<LiveSceneRenderer | null>(null);
  const callbacks = useRef({ onReady, onFailure }); callbacks.current = { onReady, onFailure };
  const fail = (error: unknown) => { renderer.current?.dispose(); renderer.current = null; callbacks.current.onFailure(error instanceof Error ? error.message : 'Visualização procedural indisponível.'); };
  useLayoutEffect(() => {
    latest.current = descriptor;
    if (!renderer.current) return;
    try {
      if (descriptor && !liveGeneration(descriptor)) throw new Error('Dados do planeta insuficientes para a visualização procedural.');
      renderer.current.setDescriptor(descriptor);
    } catch (error) { fail(error); }
  }, [descriptor]);
  useEffect(() => {
    let cancelled = false, observer: ResizeObserver | undefined, canvas: HTMLCanvasElement | null = null;
    const lost = (event: Event) => { event.preventDefault(); if (!cancelled) fail(new Error('Conexão com a visualização procedural interrompida.')); };
    const measure = () => {
      if (!renderer.current || !host.current) return;
      const rect = host.current.getBoundingClientRect(), hero = host.current.closest('.planet-hero');
      const header = hero?.querySelector('.hero-header')?.getBoundingClientRect(), deck = hero?.querySelector('.hero-overlays')?.getBoundingClientRect();
      try { renderer.current.setHeroInsets({ top: header ? header.bottom - rect.top + 16 : 0, bottom: deck ? rect.bottom - deck.top + 12 : 0 }); }
      catch (error) { fail(error); }
    };
    void loadRenderer().then(({ LiveSceneRenderer }) => {
      if (cancelled || !host.current) return;
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) throw new Error('WebGL não disponível para a visualização procedural.');
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        if (latest.current && !liveGeneration(latest.current)) throw new Error('Dados do planeta insuficientes para a visualização procedural.');
        renderer.current = new LiveSceneRenderer(host.current, () => undefined, error => { if (!cancelled) fail(error); });
        renderer.current.start();
        renderer.current.setOptions({ raw: false, paused: window.matchMedia('(prefers-reduced-motion: reduce)').matches });
        renderer.current.setDescriptor(latest.current);
        canvas = host.current.querySelector('canvas'); canvas?.addEventListener('webglcontextlost', lost);
        observer = new ResizeObserver(measure);
        for (const element of [host.current, host.current.closest('.planet-hero')?.querySelector('.hero-header'), host.current.closest('.planet-hero')?.querySelector('.hero-overlays')]) if (element) observer.observe(element);
        measure();
        if (renderer.current) callbacks.current.onReady();
      } catch (error) { fail(error); }
    }).catch(error => { if (!cancelled) fail(error); });
    return () => { cancelled = true; observer?.disconnect(); canvas?.removeEventListener('webglcontextlost', lost); renderer.current?.dispose(); renderer.current = null; };
  }, []);
  return <div className="planet-procedural-stage" ref={host} data-planet-key={descriptor?.identity.planetKey ?? ''} />;
}
