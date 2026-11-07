import {SystemIdentity} from './PlanetStatus';
import {planetIdentity} from './planetIdentity';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Catalog, GalaxySystem, State } from '../types/game';
import type { OrbitalSystemRenderer } from './OrbitalSystemRenderer';
import { PixelButton } from '../pixel-command/master/MasterUI';

export function OrbitalSystemScene({ system, state, catalog, selectedIndex, onPlanet, onFleet }: { system: GalaxySystem; state: State; catalog: Catalog; selectedIndex?: number; onPlanet: (index: number) => void; onFleet: (id: string) => void }) {
  const host = useRef<HTMLDivElement>(null), renderer = useRef<OrbitalSystemRenderer | null>(null);
  const latest = useRef({ system, state, catalog, selectedIndex, onPlanet, onFleet }); latest.current = { system, state, catalog, selectedIndex, onPlanet, onFleet };
  const [error, setError] = useState(''), [ready, setReady] = useState(false), [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const pausedRef = useRef(paused); pausedRef.current = paused;
  const fail = (failure: unknown) => { renderer.current?.dispose(); renderer.current = null; setError(failure instanceof Error ? failure.message : 'Vista orbital indisponível.'); };
  useLayoutEffect(() => {
    if (!renderer.current) return;
    try { renderer.current.setSystem(system, state, catalog); renderer.current.select(selectedIndex); } catch (error) { fail(error); }
  }, [system, state, catalog, selectedIndex]);
  useEffect(() => {
    let cancelled = false;
    void import('./OrbitalSystemRenderer').then(({ OrbitalSystemRenderer }) => {
      if (cancelled || !host.current) return;
      try {
        renderer.current = new OrbitalSystemRenderer(host.current, index => latest.current.onPlanet(index), id => latest.current.onFleet(id), failure => { if (!cancelled) fail(failure); });
        const value = latest.current; renderer.current.setSystem(value.system, value.state, value.catalog); renderer.current.select(value.selectedIndex); renderer.current.setPaused(pausedRef.current); setReady(true);
      } catch (error) { fail(error); }
    }).catch(error => { if (!cancelled) fail(error); });
    return () => { cancelled = true; renderer.current?.dispose(); renderer.current = null; };
  }, []);
  useEffect(() => { renderer.current?.setPaused(paused); }, [paused]);
  return <section className="orbital-system" aria-label="Vista orbital do sistema">
    <header className="orbital-system-identity"><SystemIdentity system={system} roster={state.planets}/></header>
    <nav className="spatial-toolbar" aria-label="Câmera orbital"><PixelButton disabled={!ready || !!error} aria-label="Enquadrar sistema" onClick={() => renderer.current?.resetCamera()}><span className="orbital-reset-word">Enquadrar</span><span className="orbital-reset-symbol" aria-hidden="true">↺</span></PixelButton><PixelButton aria-label="Reduzir vista orbital" disabled={!ready || !!error} onClick={() => renderer.current?.zoom(1 / 1.25)}>−</PixelButton><PixelButton aria-label="Ampliar vista orbital" disabled={!ready || !!error} onClick={() => renderer.current?.zoom(1.25)}>+</PixelButton><PixelButton aria-pressed={paused} onClick={() => setPaused(p => !p)}>{paused ? 'Animar' : 'Pausar'}</PixelButton><select aria-label="Selecionar planeta na órbita" value={selectedIndex??''} onChange={e=>onPlanet(Number(e.target.value))}><option value="" disabled>Planeta…</option>{system.planets?.map(p=><option key={p.planet_index} value={p.planet_index}>{`P${p.planet_index+1} · ${p.name} · ${planetIdentity(system,p,state.planets).label}`}</option>)}</select></nav>
    <div className="orbital-host" ref={host}/>
    {!ready && !error && <p className="orbital-notice" role="status">Gerando planetas conhecidos…</p>}
    {error && <p className="orbital-notice" role="alert">{error} O mapa e o inspetor continuam disponíveis.</p>}
    <footer className="spatial-legend">Sem escala · órbitas e frotas ilustrativas.</footer>
  </section>;
}
