import { useNavigate, useOutletContext } from 'react-router-dom';
import { fmt, label } from '../app/format';
import { HomeworldBadge } from '../components/planet/HomeworldBadge';
import { EmptyState } from '../components/ui/EmptyState';
import { Icon } from '../components/ui/Icon';
import { Metric } from '../components/ui/Metric';
import { SectionHeader } from '../components/ui/SectionHeader';
import type { ShellContext } from '../components/shell/AppShell';
import type { IconName } from '../visual/IconRegistry';

type StrategicAction = { title: string; detail: string; to: string; icon: IconName; tone?: 'warning' | 'research' | 'active' };

export function OverviewView() {
  const { catalog, state, activePlanetId, setActivePlanetId } = useOutletContext<ShellContext>();
  const navigate = useNavigate();
  const worlds = state.planets ?? [];
  const imperialPopulation = worlds.reduce((total, world) => total + world.population_total, 0);
  const arrived = state.fleets.filter(fleet => fleet.status === 'ARRIVED').length;
  const transit = state.fleets.filter(fleet => fleet.status === 'TRANSIT').length;
  const assembling = state.ships.filter(ship => ship.ready_at > Date.now() / 1000).length;
  const activeOperations = state.construction.length + (state.research.active ? 1 : 0) + transit + assembling;
  const selectedWorldId = activePlanetId ?? state.active_planet?.id;
  const actions: StrategicAction[] = [];
  if (!state.research.active) actions.push({ title: 'Pesquisa inativa', detail: 'Nenhum programa científico está em andamento.', to: '/research', icon: 'research', tone: 'research' });
  if (state.capacities.construction_slots_available > 0) actions.push({ title: 'Capacidade de construção disponível', detail: `${fmt(state.capacities.construction_slots_available)} slot(s) livre(s) no planeta atual.`, to: '/planet', icon: 'operations', tone: 'active' });
  if (state.capacities.shipyard_slots_available > 0) actions.push({ title: 'Estaleiro disponível', detail: `${fmt(state.capacities.shipyard_slots_available)} slot(s) de montagem livre(s).`, to: '/shipyard', icon: 'shipyard', tone: 'active' });
  if (transit > 0) actions.push({ title: 'Movimento em andamento', detail: `${fmt(transit)} frota(s) em trânsito.`, to: '/fleets', icon: 'fleets', tone: 'warning' });
  else if (arrived > 0) actions.push({ title: 'Frota disponível para ordens', detail: `${fmt(arrived)} frota(s) estacionada(s).`, to: '/fleets', icon: 'fleets', tone: 'active' });
  if (actions.length < 4 && worlds.length > 1) actions.push({ title: 'Gerenciar mundos', detail: `${fmt(worlds.length)} mundos sob controle imperial.`, to: '/planet', icon: 'planetActive', tone: 'active' });
  const visibleActions = actions.slice(0, 4);

  return <div className="overview-command">
    <header className="overview-command-header">
      <div><span className="eyebrow">COMANDO IMPERIAL</span><h1>Estado do império</h1><p>{state.system.name} · {state.system.x}:{state.system.y} · {fmt(worlds.length)} mundo{worlds.length === 1 ? '' : 's'} controlado{worlds.length === 1 ? '' : 's'}</p></div>
      <div className="overview-command-context"><Icon name="planetActive" className="ui-icon" /><span>PLANETA ATUAL</span><strong>{state.system.planet.name}</strong></div>
    </header>

    <div className="overview-command-main">
      <section className="overview-editorial" aria-label="Contexto do planeta atual">
        <img src="/static/planet-command-hero.png" alt="" />
        <div className="overview-editorial-shade" aria-hidden="true" />
        <div className="overview-editorial-content"><span className="eyebrow">CONTEXTO ATUAL</span><div><Icon name="planetActive" className="ui-icon" /><strong>{state.system.planet.name}</strong>{state.active_planet?.home && <HomeworldBadge />}</div><p>{state.system.name} · setor {state.system.x}:{state.system.y} · planeta {(state.active_planet?.planet_index ?? 0) + 1}</p><button className="button button-ghost" onClick={() => navigate('/planet')}>Gerenciar planeta →</button></div>
      </section>

      <section className="empire-summary" aria-label="Resumo imperial">
        <SectionHeader title="Resumo imperial" eyebrow="ESTADO ATUAL" />
        <div className="empire-summary-metrics"><Metric label="Mundos controlados" value={fmt(worlds.length)} detail={worlds.length === 1 ? 'mundo imperial' : 'mundos imperiais'} tone="active" /><Metric label="População imperial" value={worlds.length ? fmt(imperialPopulation) : '—'} detail="soma dos mundos" tone="positive" /><Metric label="Frotas" value={fmt(state.fleets.length)} detail={`${fmt(arrived)} estacionada(s) · ${fmt(transit)} em trânsito`} tone={transit ? 'warning' : 'default'} /><Metric label="Naves" value={fmt(state.ships.length)} detail={assembling ? `${fmt(assembling)} em montagem` : 'sem montagem ativa'} /></div>
        <div className="empire-research-status"><Icon name="research" className="ui-icon" /><div><span>Pesquisa</span><strong>{state.research.active ? label(catalog, state.research.active) : 'Pesquisa inativa'}</strong></div></div>
      </section>
    </div>

    <div className="overview-command-secondary">
      <section className="overview-worlds" aria-label="Mundos imperiais">
        <SectionHeader title="Mundos imperiais" eyebrow="WORLD ROSTER" count={worlds.length} />
        {worlds.length ? <div className="world-roster">{worlds.map(world => {
          const selected = world.id === selectedWorldId;
          return <button className={`world-row ${selected ? 'selected' : ''}`} type="button" key={world.id} onClick={() => setActivePlanetId(world.id)} aria-pressed={selected} aria-label={`Selecionar planeta ${world.name}`}><span className="world-row-icon"><Icon name={selected ? 'planetActive' : 'planet'} className="ui-icon" /></span><span className="world-row-name"><strong>{world.name}</strong><small>{world.x}:{world.y} · planeta {world.planet_index + 1}</small></span><span className="world-row-population"><span>POPULAÇÃO</span><strong>{fmt(world.population_total)}</strong></span>{world.home && <HomeworldBadge />}<span className="world-row-chevron" aria-hidden="true">→</span></button>;
        })}</div> : <EmptyState title="Sem mundos materializados" icon="planet">Os mundos sob controle aparecerão aqui.</EmptyState>}
      </section>

      <div className="overview-side-stack">
        <section className="overview-actions" aria-label="Ações estratégicas">
          <SectionHeader title="Ações estratégicas" eyebrow="PRÓXIMOS FLUXOS" count={visibleActions.length} />
          {visibleActions.length ? <div>{visibleActions.map(action => <button type="button" className={`strategic-action tone-${action.tone ?? 'default'}`} key={action.title} onClick={() => navigate(action.to)}><Icon name={action.icon} className="ui-icon" /><span><strong>{action.title}</strong><small>{action.detail}</small></span><i aria-hidden="true">→</i></button>)}</div> : <EmptyState title="Sem ação pendente" icon="operations">Não há fluxo operacional disponível neste contexto.</EmptyState>}
        </section>
        <section className="overview-operations" aria-label="Resumo de operações">
          <SectionHeader title="Operações em andamento" eyebrow="ATIVIDADE" count={activeOperations} />
          {activeOperations ? <div className="overview-operation-list">{state.construction.length > 0 && <span>{fmt(state.construction.length)} construção(ões)</span>}{state.research.active && <span>1 pesquisa ativa</span>}{transit > 0 && <span>{fmt(transit)} em trânsito</span>}{assembling > 0 && <span>{fmt(assembling)} nave(s) em montagem</span>}</div> : <EmptyState title="Operações estáveis" icon="operations">Detalhes temporais permanecem no painel operacional.</EmptyState>}
          {activeOperations > 0 && <p className="overview-operation-note">Detalhes temporais no painel operacional.</p>}
        </section>
      </div>
    </div>
  </div>;
}
