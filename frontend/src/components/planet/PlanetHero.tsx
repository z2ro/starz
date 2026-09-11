import { useState } from 'react';
import { planetArtworkFor } from '../../visual/PlanetArtworkRegistry';
import { Icon } from '../ui/Icon';
import { EmptyState } from '../ui/EmptyState';
import { OperationsColumn, OperationsDeck, QueueItem } from '../ui/OperationsDeck';
import { Button } from '../ui/Button';
import { duration, label, remaining, term } from '../../app/format';
import { PlanetThreeView } from './PlanetThreeView';
import { PlanetHeader } from './PlanetHeader';
import type { Catalog, State } from '../../types/game';

function mode(): 'image' | '3d' { return typeof window !== 'undefined' && /(^|[?&])planet_visual=3d(&|$)/.test(window.location.search) ? '3d' : 'image'; }

export function PlanetHero({ catalog, state, onPlanetChange, onNavigate }: { catalog: Catalog; state: State; onPlanetChange: (id: string) => void; onNavigate: (path: string) => void }) {
  const [failed, setFailed] = useState(false);
  const artwork = planetArtworkFor(state.system.planet);
  const visualMode = mode();
  const currentMode = visualMode === '3d' || failed ? '3d' : 'image';
  const job = state.construction[0];
  const research = state.research.active ? catalog.technologies.find(item => item.id === state.research.active) : undefined;
  const systemFleets = state.fleets.filter(fleet => fleet.x === state.system.x && fleet.y === state.system.y);
  const arrived = systemFleets.filter(fleet => fleet.status === 'ARRIVED');
  const fleet = systemFleets.find(item => item.status === 'TRANSIT') ?? systemFleets[0];
  return <section className="planet-hero">
    <div className="planet-art-layer"><img className="hero-image" hidden={currentMode === '3d'} src={artwork.path} alt="" decoding="async" fetchPriority="high" onError={() => setFailed(true)} />{currentMode === 'image' ? <div className="hero-shade" /> : <PlanetThreeView state={state} catalog={catalog} mode="3d" />}</div>
    <div className="hero-header"><PlanetHeader state={state} onPlanetChange={onPlanetChange} /></div>
    <div className="hero-markers" aria-label="Presença orbital do sistema">
      {state.capacities.shipyard_slots > 0 && <span><Icon name="shipyard" className="ui-icon" /> Estaleiro orbital</span>}
      {arrived.length > 0 && <span><Icon name="fleets" className="ui-icon" /> {arrived.length} {arrived.length === 1 ? 'frota no sistema' : 'frotas no sistema'}</span>}
    </div>
    <OperationsDeck className="hero-overlays">
      <OperationsColumn icon="operations" title="Construção" count={state.construction.length}>{job ? <QueueItem title={label(catalog, job.id)} meta={`Nível ${(state.districts[job.id] ?? 0) + 1}`} progress={100 * (Date.now() / 1000 - job.started_at) / Math.max(1, job.complete_at - job.started_at)} eta={`${remaining(job.complete_at)} restantes`} status="EM CONSTRUÇÃO" /> : <EmptyState title="Sem construção" icon="operations">Nenhuma obra em andamento.</EmptyState>}</OperationsColumn>
      <OperationsColumn icon="research" title="Pesquisa" count={state.research.active ? 1 : 0} action={<Button variant="ghost" onClick={() => onNavigate('/research')}>Abrir</Button>}>{research ? <QueueItem title={research.name} meta="Programa científico ativo" progress={100 * (1 - state.research.remaining_work / Math.max(1, research.duration))} eta={remaining(state.research.complete_at)} status="PESQUISANDO" tone="research" /> : <EmptyState title="Pesquisa inativa" icon="research">Selecione uma tecnologia disponível.</EmptyState>}</OperationsColumn>
      <OperationsColumn icon="fleets" title="Operações de frota" count={systemFleets.length} action={<Button variant="ghost" onClick={() => onNavigate('/fleets')}>Ver todas</Button>}>{fleet ? <QueueItem title={fleet.name} meta={fleet.status === 'TRANSIT' ? `${term(fleet.mission)} → ${fleet.destination_x}:${fleet.destination_y}` : `${term(fleet.mission)} · ${fleet.x}:${fleet.y}`} eta={fleet.status === 'TRANSIT' ? duration(fleet.eta) : 'No sistema'} status={`${term(fleet.status)} · ${term(fleet.mission)}`} tone={fleet.status === 'ARRIVED' ? 'positive' : 'active'} /> : <EmptyState title="Sem frotas no sistema" icon="fleets">Construa uma nave no estaleiro para iniciar operações orbitais.</EmptyState>}</OperationsColumn>
    </OperationsDeck>
  </section>;
}
