import { useEffect, useRef, useState } from 'react';
import { ShipRenderer, type DebugStats } from './ShipRenderer';
import { hasWebGPU, type RenderLabOptions } from './renderLabTypes';

export function ShipRenderLab({ options, onStats, resetToken }: { options: RenderLabOptions; onStats: (stats: DebugStats) => void; resetToken: number }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<ShipRenderer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supported = hasWebGPU();

  useEffect(() => {
    if (!supported || !hostRef.current) return;
    const renderer = new ShipRenderer(options, onStats);
    rendererRef.current = renderer;
    let active = true;
    void renderer.mount(hostRef.current).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : 'Falha ao inicializar WebGPU.');
    });
    return () => {
      active = false;
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [onStats, supported]);

  useEffect(() => { rendererRef.current?.setOptions(options); }, [options]);
  useEffect(() => { rendererRef.current?.resetCamera(); }, [resetToken]);

  if (!supported) return <div className="render-lab-unavailable"><strong>WebGPU não disponível neste navegador.</strong><span>Abra o laboratório em um navegador com suporte a WebGPU para iniciar o renderer.</span></div>;
  if (error) return <div className="render-lab-unavailable"><strong>Não foi possível iniciar o WebGPU.</strong><span>{error}</span></div>;
  return <div ref={hostRef} className="render-lab-stage" aria-label="Viewport do Render Lab" />;
}
