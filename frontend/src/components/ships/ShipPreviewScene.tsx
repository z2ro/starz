import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ShipLabRenderer } from '../../shipgeometrylab/ShipLabRenderer';
import { DEFAULT_SHIP_SETTINGS, STELLAR_CAMERA_LABELS, type ShipCamera } from '../../shipgeometrylab/shipLabTypes';
import type { ShipDesignId } from '../../visual/ShipDesignRegistry';

export default function ShipPreviewScene({ design }: { design: ShipDesignId }) {
  const host = useRef<HTMLDivElement>(null), renderer = useRef<ShipLabRenderer | null>(null), latest = useRef(design);
  const [error, setError] = useState<string>();
  useLayoutEffect(() => { latest.current = design; renderer.current?.setSelection(design); }, [design]);
  useEffect(() => {
    const fail = () => { renderer.current?.dispose(); renderer.current = null; setError('Preview WebGL indisponível. Os dados e a construção continuam disponíveis.'); };
    let canvas: HTMLCanvasElement | null = null;
    const lost = (event: Event) => { event.preventDefault(); fail(); };
    try {
      renderer.current = new ShipLabRenderer(host.current!, { ...DEFAULT_SHIP_SETTINGS, paused: true, engineEmission: latest.current === 'stargrave' ? 1.6 : 0 }, () => undefined, latest.current);
      renderer.current.start(); renderer.current.setSelection(latest.current);
      canvas = host.current!.querySelector('canvas'); canvas?.addEventListener('webglcontextlost', lost);
    } catch { fail(); }
    return () => { canvas?.removeEventListener('webglcontextlost', lost); renderer.current?.dispose(); renderer.current = null; };
  }, []);
  return <><div className="naval-canvas" ref={host}>{error && <p role="status">{error}</p>}</div><div className="naval-angles">{(['3/4 Front', 'Side', 'Rear', 'Top'] as ShipCamera[]).map(preset => <button key={preset} onClick={() => renderer.current?.setCamera(preset)}>{design === 'stargrave' ? STELLAR_CAMERA_LABELS[preset] : ({'3/4 Front':'Proa 3/4',Side:'Lateral',Rear:'Popa',Top:'Superior'} as Partial<Record<ShipCamera,string>>)[preset]}</button>)}</div></>;
}
