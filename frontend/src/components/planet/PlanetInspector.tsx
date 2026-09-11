import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { DataRow } from '../ui/DataRow';
import { EmptyState } from '../ui/EmptyState';
import { Icon } from '../ui/Icon';
import { Inspector, InspectorSection } from '../ui/Inspector';
import { Metric } from '../ui/Metric';
import { Progress } from '../ui/Progress';
import { Tabs } from '../ui/Tabs';
import { HomeworldBadge } from './HomeworldBadge';
import { fmt, label, nominalRate, strategicResources, term } from '../../app/format';
import type { Catalog, PlanetTab, State } from '../../types/game';

const ratio = (value: number, maximum: number) => maximum > 0 ? Math.min(100, Math.max(0, 100 * value / maximum)) : 0;

export function PlanetInspector({ catalog, state, tab, onTab, onNavigate }: { catalog: Catalog; state: State; tab: PlanetTab; onTab: (tab: PlanetTab) => void; onNavigate: (path: string) => void }) {
  const planet = state.system.planet;
  const active = state.active_planet;
  const localFleets = state.fleets.filter(fleet => fleet.x === state.system.x && fleet.y === state.system.y);
  const districts = catalog.districts.filter(district => (state.districts[district.id] ?? 0) > 0);
  const minerals = Object.entries(planet.mineral_profile).filter(([, amount]) => amount > 0);
  const resources = strategicResources(catalog, state);
  const tabs: Array<[PlanetTab, string]> = [['overview', 'Visão geral'], ['districts', 'Distritos'], ['orbit', 'Órbita'], ['data', 'Dados']];
  const physical = [
    ['Gravidade', `${fmt(planet.gravity, 2)} g`], ['Temperatura', `${fmt(planet.temperature)} K`], ['Água', `${fmt(planet.water, 1)}%`], ['Atmosfera', planet.atmosphere],
    ['Radiação', fmt(planet.radiation, 2)], ['Campo magnético', fmt(planet.magnetic_field, 2)], ['Superfície útil', `${fmt(planet.usable_surface, 1)}%`], ['Atividade geológica', fmt(planet.geological_activity, 2)],
  ];
  const development = [
    { label: 'População', value: `${fmt(state.population.total)} / ${fmt(state.population.capacity)}`, progress: ratio(state.population.total, state.population.capacity), tone: 'positive' as const },
    { label: 'Workforce', value: `${fmt(state.capacities.workforce_supply)} / ${fmt(state.capacities.workforce_demand)}`, progress: state.capacities.workforce_coverage * 100, tone: 'active' as const },
    { label: 'Energia', value: `${fmt(state.capacities.energy_generation)} / ${fmt(state.capacities.energy_consumption)}`, progress: state.capacities.energy_coverage * 100, tone: state.capacities.energy_coverage < 1 ? 'warning' as const : 'positive' as const },
    { label: 'Capacidade industrial', value: fmt(state.capacities.industrial_capacity), progress: undefined, tone: 'default' as const },
    { label: 'Slots de construção', value: `${fmt(state.capacities.construction_slots - state.capacities.construction_slots_available)} / ${fmt(state.capacities.construction_slots)}`, progress: ratio(state.capacities.construction_slots - state.capacities.construction_slots_available, state.capacities.construction_slots), tone: 'active' as const },
    { label: 'Slots de estaleiro', value: `${fmt(state.capacities.shipyard_slots - state.capacities.shipyard_slots_available)} / ${fmt(state.capacities.shipyard_slots)}`, progress: ratio(state.capacities.shipyard_slots - state.capacities.shipyard_slots_available, state.capacities.shipyard_slots), tone: 'active' as const },
  ];
  const overview = <>
    <InspectorSection title="Características físicas" action={<Icon name="planet" className="ui-icon orbit-glyph" />}><div className="spec-grid">{physical.map(([name, value]) => <DataRow label={name} value={value} key={name} />)}</div></InspectorSection>
    <InspectorSection title="Desenvolvimento" action={<Icon name="operations" className="ui-icon orbit-glyph" />}><div className="development-list">{development.map(item => <DataRow key={item.label} label={item.label} value={item.value} tone={item.tone} visualization={item.progress === undefined ? undefined : <Progress value={item.progress} text={`${item.label}: ${fmt(item.progress)}%`} tone={item.tone} />} />)}</div></InspectorSection>
    {resources.length > 0 && <InspectorSection title="Produção local"><div className="production-list">{resources.map(item => <DataRow label={item.name} value={nominalRate(catalog, state, item.id) > 0 ? `+${fmt(nominalRate(catalog, state, item.id) * 60, 1)}/h nom.` : '—'} tone="positive" key={item.id} />)}</div><small className="muted">Taxas nominais · antes de limitações operacionais.</small></InspectorSection>}
    <InspectorSection title="Ações"><div className="planet-actions"><Button variant="secondary" onClick={() => onNavigate('/research')}>Abrir pesquisa</Button>{state.capacities.shipyard_slots > 0 && <Button variant="secondary" onClick={() => onNavigate('/shipyard')}>Abrir estaleiro</Button>}{localFleets.length > 0 && <Button variant="ghost" onClick={() => onNavigate('/fleets')}>Ver frotas no sistema</Button>}</div></InspectorSection>
  </>;
  const body = tab === 'districts' ? <InspectorSection title="Distritos ativos">{districts.length ? <div className="entity-list">{districts.map(district => <DataRow key={district.id} label={district.name} value={`Nível ${state.districts[district.id]}`} status={district.description} />)}</div> : <EmptyState title="Sem distritos ativos" icon="operations">A infraestrutura aparecerá aqui quando construída.</EmptyState>}</InspectorSection> : tab === 'orbit' ? <InspectorSection title="Presença orbital">{state.capacities.shipyard_slots > 0 && <DataRow label="Estaleiro orbital" value={`${fmt(state.capacities.shipyard_slots_available)} / ${fmt(state.capacities.shipyard_slots)} slots livres`} status={<Badge tone="positive">ATIVO</Badge>} />}{localFleets.map(fleet => <DataRow key={fleet.id} label={fleet.name} value={term(fleet.status)} status={`${term(fleet.mission)} · ${fleet.status === 'TRANSIT' ? `→ ${fleet.destination_x}:${fleet.destination_y}` : `${fleet.x}:${fleet.y}`}`} tone={fleet.status === 'ARRIVED' ? 'positive' : 'active'} />)}{!state.capacities.shipyard_slots && !localFleets.length && <EmptyState title="Sem presença orbital" icon="shipyard">Nenhum estaleiro ou frota está associado a este sistema.</EmptyState>}</InspectorSection> : tab === 'data' ? <><InspectorSection title="Contexto astronômico"><div className="data-list"><DataRow label="Coordenadas" value={`${state.system.x}:${state.system.y}`} /><DataRow label="Classe estelar" value={state.system.star.stellar_class} /><DataRow label="Luminosidade" value={fmt(state.system.star.luminosity, 2)} /><DataRow label="Atividade estelar" value={fmt(state.system.star.activity, 2)} /></div></InspectorSection>{minerals.length > 0 && <InspectorSection title="Informações minerais"><div className="data-list">{minerals.map(([id, amount]) => <DataRow key={id} label={label(catalog, id)} value={fmt(amount, 2)} />)}</div></InspectorSection>}</> : overview;
  const header = <><div className="planet-inspector-header"><span className="planet-active-icon" aria-hidden="true"><Icon name="planetActive" className="ui-icon" /></span><div><span className="eyebrow">PLANETA SELECIONADO</span><strong>{planet.name}</strong><small>{state.system.name} · {state.system.x}:{state.system.y}</small></div>{active?.home && <HomeworldBadge />}</div><Tabs items={tabs.map(([id, name]) => ({ id, label: name }))} value={tab} onChange={onTab} label="Seções do planeta" /></>;
  const summary = <div className="planet-inspector-summary"><div className="planet-summary-art" aria-hidden="true" /><div className="planet-summary-metrics"><Metric label="População" value={fmt(state.population.total)} detail={`/ ${fmt(state.population.capacity)} capacidade`} /><Metric label="Energia" value={`${fmt(state.capacities.energy_coverage * 100)}%`} detail="cobertura" tone={state.capacities.energy_coverage < 1 ? 'warning' : 'positive'} /><Metric label="Indústria" value={fmt(state.capacities.industrial_capacity)} detail="capacidade local" /></div></div>;
  return <Inspector label="Informações do planeta" className="planet-inspector" header={header} summary={summary}>{body}</Inspector>;
}
