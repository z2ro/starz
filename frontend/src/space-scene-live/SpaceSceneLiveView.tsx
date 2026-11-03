import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCatalogQuery, useStateQuery } from '../api/queries';
import { createVisualDescriptor } from '../visual-state/VisualStateAdapter';
import type { SpaceSceneDescriptor } from '../visual-state/types';
import { LiveSceneRenderer, type LiveRenderOptions, type LiveSceneStats } from './LiveSceneRenderer';
import { LIVE_PRESENTATION_DIAGNOSTICS, representativeShip } from './livePresentation';
import '../shipgeometrylab/ship-geometry-lab.css';
import './space-scene-live.css';

function LiveCanvas({ descriptor, options, revision, onStats }: { descriptor: SpaceSceneDescriptor | null; options: LiveRenderOptions; revision: number; onStats: (stats: LiveSceneStats) => void }) {
  const host = useRef<HTMLDivElement>(null), renderer = useRef<LiveSceneRenderer | null>(null);
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (!host.current) return;
    try {
      const probe = document.createElement('canvas').getContext('webgl2');
      if (!probe) throw new Error('WebGL 2 não disponível neste navegador.');
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      renderer.current = new LiveSceneRenderer(host.current, onStats);
      renderer.current.start(); renderer.current.setOptions(options); renderer.current.setDescriptor(descriptor);
    } catch (failure) {
      renderer.current?.dispose(); renderer.current = null;
      setError(failure instanceof Error ? failure.message : 'Falha ao iniciar a cena.');
    }
    return () => { renderer.current?.dispose(); renderer.current = null; };
  }, []);
  useLayoutEffect(() => {
    try { renderer.current?.setDescriptor(descriptor); }
    catch (failure) { renderer.current?.dispose(); renderer.current = null; setError(failure instanceof Error ? failure.message : 'Falha ao atualizar cena.'); }
  }, [descriptor]);
  useEffect(() => { renderer.current?.setOptions(options); }, [options]);
  useEffect(() => { renderer.current?.resetCamera(); }, [revision]);
  return <div className="ship-lab-stage" ref={host} data-planet-key={descriptor?.identity.planetKey ?? ''}>{error && <div className="ship-lab-error" role="alert">{error}</div>}</div>;
}

export function SpaceSceneLiveView() {
  const [selectedId, setSelectedId] = useState<string>();
  const catalogQuery = useCatalogQuery(), stateQuery = useStateQuery(selectedId);
  const [roster, setRoster] = useState<Array<{ id: string; name: string }>>([]);
  const [options, setOptions] = useState<LiveRenderOptions>(() => ({ raw: false, paused: window.matchMedia('(prefers-reduced-motion: reduce)').matches }));
  const [revision, setRevision] = useState(0), [stats, setStats] = useState<LiveSceneStats | null>(null);
  const error = catalogQuery.error ?? stateQuery.error;
  const mismatch = !!stateQuery.data && selectedId !== undefined && stateQuery.data.active_planet?.id !== selectedId;
  const accepted = !error && !mismatch && !!catalogQuery.data && !!stateQuery.data;
  const descriptor = useMemo(() => accepted ? createVisualDescriptor(stateQuery.data!, catalogQuery.data!) : null, [accepted, stateQuery.data, catalogQuery.data]);
  useEffect(() => {
    if (accepted && stateQuery.data?.planets) setRoster(stateQuery.data.planets.map(({ id, name }) => ({ id, name })));
  }, [accepted, stateQuery.data]);
  const ship = representativeShip(descriptor);
  const validPlanet = descriptor?.presentation.planetEnabled && descriptor.planet.family !== null;
  const currentName = accepted ? stateQuery.data?.system?.planet?.name : undefined;
  const message = error ? `Falha ao sincronizar: ${error.message}` : mismatch ? 'Snapshot incompatível com o planeta solicitado; cena ocultada.' : !descriptor ? 'Carregando snapshot do planeta…' : !validPlanet ? 'Identidade ou família insuficiente: planeta oculto (UNKNOWN).' : null;
  const decisions = descriptor ? [...descriptor.diagnostics, ...LIVE_PRESENTATION_DIAGNOSTICS] : [];
  const provenance = (field: string) => descriptor?.diagnostics.find(item => item.field === field)?.status ?? 'UNKNOWN';
  return <main className="ship-lab-shell space-scene-live" data-active-planet={descriptor?.identity.planetKey ?? ''}>
    <header className="ship-lab-header"><div><p>STARZ / GAMEPLAY → VISUAL DESCRIPTOR</p><h1>Space Scene Live 01</h1></div><div className="live-links"><Link to="/space-scene-lab">Comparar Lab 02</Link><Link to="/overview">Voltar ao STARZ</Link></div></header>
    <div className="ship-lab-layout">
      <section className="ship-lab-viewport" aria-label="Cena baseada no snapshot selecionado" aria-busy={!accepted && !error}>
        <LiveCanvas descriptor={descriptor} options={options} revision={revision} onStats={setStats} />
        {message ? <div className="live-state-message" role={error || mismatch ? 'alert' : 'status'}>{message}{(error || mismatch) && <button onClick={() => { void stateQuery.refetch(); void catalogQuery.refetch(); }}>Tentar novamente</button>}</div> : <div className="ship-lab-identity"><span>{descriptor?.planet.family?.toUpperCase()} / HEURISTIC</span><h2>{currentName ?? 'Planeta selecionado'}</h2><p>{descriptor?.identity.systemKey} · Procedural, orientado pelo gameplay</p></div>}
        {validPlanet && <div className="ship-lab-caption"><span>{options.raw ? 'RAW 3D' : 'PIXEL / 3px'}</span><span>APRESENTAÇÃO EXPERIMENTAL</span><p>{ship ? 'Horizon Prototype · presença no sistema; posição ilustrativa DEFAULT, sem órbita conhecida.' : 'Nenhuma nave representável comprovadamente presente neste sistema.'}</p></div>}
      </section>
      <aside className="ship-lab-panel" aria-label="Diagnóstico do estado visual">
        <section><h2>Snapshot / planeta</h2><label className="ship-lab-select">Planeta<select aria-label="Planeta selecionado" value={selectedId ?? stateQuery.data?.active_planet?.id ?? ''} onChange={event => setSelectedId(event.target.value)}><option value="" disabled>Selecione um planeta</option>{roster.map(planet => <option value={planet.id} key={planet.id}>{planet.name}</option>)}</select></label><p className="live-note" role="status">{accepted ? stateQuery.isFetching ? 'Atualizando o mesmo planeta…' : 'Snapshot sincronizado' : 'Cena sem snapshot válido'}</p></section>
        <section className="live-facts"><h2>Identidade / ambiente</h2><dl><dt>Planeta · {provenance('identity.planetKey')}</dt><dd>{descriptor?.identity.planetKey ?? 'UNKNOWN'}</dd><dt>Sistema · {provenance('identity.systemKey')}</dt><dd>{descriptor?.identity.systemKey ?? 'UNKNOWN'}</dd><dt>Família · {provenance('planet.family')}</dt><dd>{descriptor?.planet.family ?? 'UNKNOWN'}</dd><dt>Seed · {provenance('identity.seed')}</dt><dd>{descriptor?.identity.seed ?? 'UNKNOWN'}</dd><dt>População local · {provenance('civilization.population')}</dt><dd>{descriptor?.civilization.population ?? 'UNKNOWN'}</dd><dt>Luzes permitidas · {provenance('civilization.lightsEnabled')}</dt><dd>{descriptor ? `${descriptor.civilization.lightsEnabled ? 'SIM' : 'NÃO'} · ${descriptor.civilization.presence}` : 'UNKNOWN'}</dd></dl><p className="live-note">População conhecida é um fato local. Distribuição e intensidade das luzes são heurísticas; não são cidades persistidas. Defaults não são fatos físicos.</p></section>
        <section><h2>Presença naval</h2><p className="live-note">{descriptor ? `${descriptor.ships.visibleCount} nave(s) representável(is) no sistema. Inventário: ${descriptor.ships.coverage}.` : 'UNKNOWN'}</p>{ship && <p className="live-note">Representante 1 de {descriptor!.ships.visibleCount}: {ship.id}. Modelo experimental, escala e posição DEFAULT.</p>}<ul className="live-entities">{descriptor?.ships.entities.map(entity => <li key={entity.id}><b>{entity.hullId ?? 'UNKNOWN_DESIGN'}</b><span>{entity.id}</span><span>{entity.presence} · {entity.design}</span><small>{entity.reason}</small></li>)}</ul><p className="live-note">Sem tempo de snapshot na API: naves livres sem prontidão comprovada permanecem ocultas.</p></section>
        <section><h2>Infraestrutura / satélites</h2>{descriptor?.infrastructure.evidence.map(item => <p className="live-note" key={item.districtId}>{item.districtId} · nível {item.level} · GROUNDED</p>)}<p className="live-note">Estação: UNKNOWN — sem entidade ou modelo correspondente comprovado.</p><p className="live-note">Lua: UNKNOWN — contrato de satélites ausente. Ambas ocultas.</p></section>
        <section><h2>Apresentação</h2><div className="ship-lab-camera-grid"><button onClick={() => setRevision(value => value + 1)}>Reset camera</button><button aria-pressed={options.paused} onClick={() => setOptions(value => ({ ...value, paused: !value.paused }))}>{options.paused ? 'Resume' : 'Pause'}</button></div><label className="ship-lab-toggle"><input type="checkbox" checked={options.raw} onChange={event => setOptions(value => ({ ...value, raw: event.target.checked }))} />RAW 3D</label><p className="live-note">Luz, câmera, rotação e escala são DEFAULT de apresentação; não há posições orbitais reais fornecidas pela API.</p></section>
        <section><h2>Proveniência</h2><p className="live-note">GROUNDED: fato · HEURISTIC: interpretação · DEFAULT: apresentação · UNKNOWN: indisponível.</p><details><summary>Decisões do adapter ({decisions.length})</summary>{decisions.map(decision => <div className="live-decision" key={decision.field}><b>{decision.field}</b><span>{decision.status} · {JSON.stringify(decision.result)}</span><small>{decision.sources.join(', ') || 'Sem fonte de gameplay'}</small><p>{decision.rule}</p></div>)}</details></section>
        <section className="ship-lab-stats"><h2>Render / debug</h2><dl><div><dt>FPS</dt><dd>{stats?.fps ?? '—'}</dd></div><div><dt>Frame time</dt><dd>{stats ? `${stats.frameTime.toFixed(1)} ms` : '—'}</dd></div><div><dt>Triangles (passes)</dt><dd>{stats?.triangles ?? '—'}</dd></div><div><dt>Draw calls</dt><dd>{stats?.drawCalls ?? '—'}</dd></div><div><dt>Gerações geográficas</dt><dd data-testid="generation-count">{stats?.generationCount ?? 0}</dd></div><div><dt>Resolução</dt><dd>{stats?.renderResolution ?? '—'}</dd></div></dl></section>
      </aside>
    </div>
  </main>;
}
