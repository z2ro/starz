import { useState } from 'react';
import { planetArtworkFor } from '../../visual/PlanetArtworkRegistry';
import { Icon } from '../ui/Icon';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { Progress } from '../ui/Progress';
import { duration, fmt, label, remaining } from '../../app/format';
import { PlanetThreeView } from './PlanetThreeView';
import type { Catalog, State } from '../../types/game';

function mode(): 'image' | '3d' { return typeof window !== 'undefined' && /(^|[?&])planet_visual=3d(&|$)/.test(window.location.search) ? '3d' : 'image'; }
function Selector({ state, onChange }: { state: State; onChange: (id: string) => void }) { return <label className="planet-picker"><span className="sr-only">PLANETA ATIVO</span><span>{state.system.name} · Planeta {(state.active_planet?.planet_index ?? 0) + 1}</span><select aria-label="Selecionar planeta" value={state.active_planet?.id ?? ''} onChange={event => onChange(event.target.value)}>{(state.planets ?? []).map(world => <option value={world.id} key={world.id}>{world.home ? 'Homeworld' : 'Colônia'} · {world.name}</option>)}</select><i aria-hidden="true" /></label>; }

export function PlanetHero({ catalog, state, tab, onTab, onPlanetChange, onNavigate }: { catalog: Catalog; state: State; tab: string; onTab: (tab: 'overview' | 'districts' | 'orbit' | 'data') => void; onPlanetChange: (id: string) => void; onNavigate: (path: string) => void }) {
  const [failed, setFailed] = useState(false);
  const artwork = planetArtworkFor(state.system.planet);
  const visualMode = mode();
  const currentMode = visualMode === '3d' || failed ? '3d' : 'image';
  const job = state.construction[0];
  const research = state.research.active ? catalog.technologies.find(item => item.id === state.research.active) : undefined;
  const arrived = state.fleets.filter(fleet => fleet.status === 'ARRIVED' && fleet.x === state.system.x && fleet.y === state.system.y).length;
  return <section className="planet-hero"><div className="planet-art-layer"><img className="hero-image" hidden={currentMode === '3d'} src={artwork.path} alt="" decoding="async" fetchPriority="high" onError={() => setFailed(true)} />{currentMode === 'image' ? <div className="hero-shade" /> : <PlanetThreeView state={state} catalog={catalog} mode="3d" />}</div><div className="hero-header"><div className="hero-title"><div className="hero-kicker"><Icon name="planet" className="ui-icon kicker-icon" /> PLANET VIEW</div><h1>{state.system.planet.name}</h1><Selector state={state} onChange={onPlanetChange} /></div></div><div className="hero-overlays"><section className="overlay-panel build-panel"><div className="overlay-heading"><div><div className="eyebrow">CONSTRUCTION QUEUE</div><h3>Fila de Construção</h3></div><span className="queue-count">{state.construction.length} / {state.capacities.construction_slots}</span></div>{job ? <><div className="overlay-primary"><span>{label(catalog, job.id)}</span><b>Nível {(state.districts[job.id] ?? 0) + 1}</b></div><Progress value={100 * (Date.now() / 1000 - job.started_at) / Math.max(1, job.complete_at - job.started_at)} text={`${remaining(job.complete_at)} restantes`} /></> : <div className="overlay-empty">Nenhuma obra em andamento.<button className="overlay-link" onClick={() => onNavigate('/planet')}>Gerenciar infraestrutura →</button></div>}</section><div className="overlay-stack"><section className="overlay-panel research-panel"><div className="overlay-heading"><div><div className="eyebrow">ACTIVE RESEARCH</div><h3>Pesquisa Atual</h3></div><Icon name="research" className="ui-icon overlay-icon" /></div>{research ? <><div className="overlay-primary"><span>{research.name}</span><b>{remaining(state.research.complete_at)}</b></div><Progress value={100 * (1 - state.research.remaining_work / Math.max(1, research.duration))} text="progresso" /></> : <div className="overlay-empty">Diretoria científica em espera.<button className="overlay-link" onClick={() => onNavigate('/research')}>Abrir pesquisa →</button></div>}</section><section className="overlay-panel fleet-panel"><div><div className="eyebrow">SYSTEM OPERATIONS</div><h3>Frotas no Sistema</h3><span><span className="fleet-pip" /> {arrived} {arrived === 1 ? 'frota presente' : 'frotas presentes'}</span></div><button onClick={() => onNavigate('/fleets')}>Ver Frotas <span>→</span></button></section></div></div></section>;
}
