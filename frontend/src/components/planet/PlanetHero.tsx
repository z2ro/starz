import { useState } from 'react';
import { planetArtworkFor } from '../../visual/PlanetArtworkRegistry';
import { Icon } from '../ui/Icon';
import { EmptyState } from '../ui/EmptyState';
import { OperationsColumn, OperationsDeck, QueueItem } from '../ui/OperationsDeck';
import { Button } from '../ui/Button';
import { label, remaining } from '../../app/format';
import { PlanetThreeView } from './PlanetThreeView';
import type { Catalog, State } from '../../types/game';

function mode(): 'image' | '3d' { return typeof window !== 'undefined' && /(^|[?&])planet_visual=3d(&|$)/.test(window.location.search) ? '3d' : 'image'; }
function Selector({ state, onChange }: { state: State; onChange: (id: string) => void }) { return <label className="planet-picker"><span className="sr-only">PLANETA ATIVO</span><span>{state.system.name} · Planeta {(state.active_planet?.planet_index ?? 0) + 1}</span><select aria-label="Selecionar planeta" value={state.active_planet?.id ?? ''} onChange={event => onChange(event.target.value)}>{(state.planets ?? []).map(world => <option value={world.id} key={world.id}>{world.home ? 'Homeworld' : 'Colônia'} · {world.name}</option>)}</select><i aria-hidden="true" /></label>; }

export function PlanetHero({ catalog, state, onPlanetChange, onNavigate }: { catalog: Catalog; state: State; onPlanetChange: (id: string) => void; onNavigate: (path: string) => void }) {
  const [failed, setFailed] = useState(false);
  const artwork = planetArtworkFor(state.system.planet);
  const visualMode = mode();
  const currentMode = visualMode === '3d' || failed ? '3d' : 'image';
  const job = state.construction[0];
  const research = state.research.active ? catalog.technologies.find(item => item.id === state.research.active) : undefined;
  const arrived = state.fleets.filter(fleet => fleet.status === 'ARRIVED' && fleet.x === state.system.x && fleet.y === state.system.y);
  return <section className="planet-hero"><div className="planet-art-layer"><img className="hero-image" hidden={currentMode === '3d'} src={artwork.path} alt="" decoding="async" fetchPriority="high" onError={() => setFailed(true)} />{currentMode === 'image' ? <div className="hero-shade" /> : <PlanetThreeView state={state} catalog={catalog} mode="3d" />}</div><div className="hero-header"><div className="hero-title"><div className="hero-kicker"><Icon name="planet" className="ui-icon kicker-icon" /> PLANET VIEW</div><h1>{state.system.planet.name}</h1><Selector state={state} onChange={onPlanetChange} /></div></div><OperationsDeck className="hero-overlays"><OperationsColumn icon="operations" title="Construção" count={state.construction.length}>{job ? <QueueItem title={label(catalog, job.id)} meta={`Nível ${(state.districts[job.id] ?? 0) + 1}`} progress={100 * (Date.now() / 1000 - job.started_at) / Math.max(1, job.complete_at - job.started_at)} eta={`${remaining(job.complete_at)} restantes`} status="EM CONSTRUÇÃO" /> : <EmptyState title="Sem construção" icon="operations">Nenhuma obra em andamento.</EmptyState>}</OperationsColumn><OperationsColumn icon="research" title="Pesquisa" count={state.research.active ? 1 : 0} action={!research ? <Button variant="ghost" onClick={() => onNavigate('/research')}>Abrir</Button> : undefined}>{research ? <QueueItem title={research.name} meta="Programa científico ativo" progress={100 * (1 - state.research.remaining_work / Math.max(1, research.duration))} eta={remaining(state.research.complete_at)} status="PESQUISANDO" tone="research" /> : <EmptyState title="Pesquisa inativa" icon="research">Selecione uma tecnologia disponível.</EmptyState>}</OperationsColumn><OperationsColumn icon="fleets" title="Frotas" count={arrived.length} action={<Button variant="ghost" onClick={() => onNavigate('/fleets')}>Ver todas</Button>}>{arrived.length ? <QueueItem title={arrived.length === 1 ? arrived[0].name : `${arrived.length} frotas no sistema`} meta={`${state.system.x}:${state.system.y}`} status="ESTACIONADAS" tone="positive" /> : <EmptyState title="Sem frotas no sistema" icon="fleets">Construa uma nave no estaleiro para iniciar operações orbitais.</EmptyState>}</OperationsColumn></OperationsDeck></section>;
}
