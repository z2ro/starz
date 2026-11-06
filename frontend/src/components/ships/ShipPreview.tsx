import { lazy, Suspense } from 'react';
import { designForHull } from '../../visual/ShipDesignRegistry';
import type { Hull } from '../../types/game';
import './ships.css';
const Scene = lazy(() => import('./ShipPreviewScene').catch(() => ({ default: () => <p role="status">Preview 3D indisponível.</p> })));
export function ShipPreview({ hull }: { hull?: Hull }) {
  const design = designForHull(hull);
  return <section className="naval-preview" aria-label={`Preview de ${hull?.name ?? 'modelo desconhecido'}`}>
    <div className="eyebrow">PROJETO NAVAL · PIXEL</div><h2>{hull?.name ?? 'Modelo desconhecido'}</h2>
    {design ? <Suspense fallback={<p role="status">Carregando modelo…</p>}><Scene design={design} /></Suspense> : <p>Modelo procedural não disponível para este casco.</p>}
    <small>Inspeção do design · sem posição, formação ou escala física de gameplay.</small>
  </section>;
}
