import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { fmt, label, nominalRate } from '../app/format';
import { DataRow } from '../components/ui/DataRow';
import { EmptyState } from '../components/ui/EmptyState';
import { Icon } from '../components/ui/Icon';
import { Inspector, InspectorSection } from '../components/ui/Inspector';
import { Progress } from '../components/ui/Progress';
import { SectionHeader } from '../components/ui/SectionHeader';
import type { ShellContext } from '../components/shell/AppShell';
import type { Content, District } from '../types/game';
import { resourceIcon } from '../visual/IconRegistry';

type Selection = { kind: 'resource'; item: Content } | { kind: 'district'; item: District };
const rate = (value: number) => value > 0 ? `+${fmt(value, 2)}/min nom.` : '—';
const flowEntries = (catalog: ShellContext['catalog'], values: Record<string, number>, level: number) => Object.entries(values).map(([id, amount]) => ({ id, name: label(catalog, id), value: amount * level }));

export function EconomyView() {
  const { catalog, state } = useOutletContext<ShellContext>();
  const navigate = useNavigate();
  const localResources = [...catalog.resources, ...catalog.fuels].filter(item => item.id in state.stocks);
  const economicDistricts = catalog.districts.filter(district => (state.districts[district.id] ?? 0) > 0 && (Object.keys(district.processing).length > 0 || Object.keys(district.production).length > 0));
  const selectionCandidates: Selection[] = [...localResources.map(item => ({ kind: 'resource' as const, item })), ...economicDistricts.map(item => ({ kind: 'district' as const, item }))];
  const [selectionId, setSelectionId] = useState(selectionCandidates[0] ? `${selectionCandidates[0].kind}:${selectionCandidates[0].item.id}` : '');
  const selected = selectionCandidates.find(item => `${item.kind}:${item.item.id}` === selectionId) ?? selectionCandidates[0];
  const energyMargin = state.capacities.energy_generation - state.capacities.energy_consumption;
  const energyTone = state.capacities.energy_coverage >= 1 ? 'positive' : 'warning';
  const workforceTone = state.capacities.workforce_coverage >= 1 ? 'positive' : 'warning';
  const select = (kind: Selection['kind'], id: string) => setSelectionId(`${kind}:${id}`);

  return <div className="economy-command">
    <header className="economy-command-header"><div><span className="eyebrow">INDUSTRIAL COMMAND NETWORK</span><h1>Economia local</h1><p>{state.system.planet.name} · {state.system.name} · {state.system.x}:{state.system.y}. Recursos existem fisicamente neste planeta.</p></div><button className="button button-ghost" onClick={() => navigate('/planet')}>Gerenciar planeta →</button></header>

    <section className="economy-resource-strip" aria-label="Estoque local"><SectionHeader title="Estoque local" eyebrow="PLANETA ATUAL" count={localResources.length} />
      {localResources.length ? <div className="resource-metrics">{localResources.map(item => <button type="button" className={`resource-metric ${selected?.kind === 'resource' && selected.item.id === item.id ? 'selected' : ''}`} key={item.id} onClick={() => select('resource', item.id)} aria-pressed={selected?.kind === 'resource' && selected.item.id === item.id} aria-label={`Selecionar recurso ${item.name}`}><Icon name={resourceIcon(item.id) ?? 'economy'} className="ui-icon" /><span><small>{item.category}</small><strong>{item.name}</strong><b>{fmt(state.stocks[item.id], 1)}</b><em>{rate(nominalRate(catalog, state, item.id))}</em></span></button>)}</div> : <EmptyState title="Estoque local vazio" icon="economy">Nenhum recurso físico está registrado neste planeta.</EmptyState>}</section>

    <section className="industrial-flow-network" aria-label="Rede industrial local"><SectionHeader title="Rede industrial" eyebrow="INPUT → PROCESSAMENTO → OUTPUT" count={economicDistricts.length} />
      {economicDistricts.length ? <div className="industrial-flow-list">{economicDistricts.map(district => { const level = state.districts[district.id] ?? 0; const inputs = flowEntries(catalog, district.processing, level); const outputs = flowEntries(catalog, district.production, level); return <div className="industrial-flow" key={district.id}><div className="flow-side">{inputs.length ? inputs.map(entry => <span className="flow-node" key={entry.id}>{entry.name}<b>−{fmt(entry.value, 2)}/min</b></span>) : <span className="flow-node muted">Produção direta</span>}</div><span className="flow-connector" aria-hidden="true">→</span><div className="flow-processor"><Icon name="operations" className="ui-icon" /><strong>{district.name}</strong><small>Nível {level}</small></div><span className="flow-connector" aria-hidden="true">→</span><div className="flow-side output">{outputs.map(entry => <span className="flow-node" key={entry.id}>{entry.name}<b>+{fmt(entry.value, 2)}/min nom.</b></span>)}</div></div>; })}</div> : <EmptyState title="Nenhuma cadeia industrial ativa" icon="operations">Construa infraestrutura no planeta para iniciar extração ou processamento.</EmptyState>}</section>

    <section className="economy-capacity-strip" aria-label="Capacidade local"><SectionHeader title="Capacidade local" eyebrow="SISTEMAS PLANETÁRIOS" />
      <div className="capacity-modules"><div className={`capacity-module tone-${energyTone}`}><Icon name="energy" className="ui-icon" /><div><strong>Energia</strong><DataRow label="Geração" value={fmt(state.capacities.energy_generation)} /><DataRow label="Demanda" value={fmt(state.capacities.energy_consumption)} /><DataRow label="Margem" value={`${energyMargin >= 0 ? '+' : ''}${fmt(energyMargin)}`} tone={energyTone} /><Progress value={state.capacities.energy_coverage * 100} text={`Cobertura: ${fmt(state.capacities.energy_coverage * 100)}%`} tone={energyTone} /></div></div><div className={`capacity-module tone-${workforceTone}`}><Icon name="population" className="ui-icon" /><div><strong>Workforce</strong><DataRow label="Oferta" value={fmt(state.capacities.workforce_supply)} /><DataRow label="Demanda" value={fmt(state.capacities.workforce_demand)} /><Progress value={state.capacities.workforce_coverage * 100} text={`Cobertura: ${fmt(state.capacities.workforce_coverage * 100)}%`} tone={workforceTone} /></div></div><div className="capacity-module"><Icon name="economy" className="ui-icon" /><div><strong>Capacidade industrial</strong><DataRow label="Capacidade nominal" value={fmt(state.capacities.industrial_capacity)} /><DataRow label="Construção" value={`${fmt(state.capacities.construction_slots_available)} / ${fmt(state.capacities.construction_slots)} livre(s)`} />{state.capacities.shipyard_slots > 0 && <DataRow label="Estaleiro" value={`${fmt(state.capacities.shipyard_slots_available)} / ${fmt(state.capacities.shipyard_slots)} livre(s)`} />}</div></div></div>
    </section>

    <div className="economy-detail-layout"><section className="economy-processors" aria-label="Infraestrutura econômica"><SectionHeader title="Infraestrutura econômica" eyebrow="DISTRITOS ATIVOS" count={economicDistricts.length} />{economicDistricts.length ? <div className="processor-list">{economicDistricts.map(district => { const level = state.districts[district.id] ?? 0; return <button type="button" className={`processor-row ${selected?.kind === 'district' && selected.item.id === district.id ? 'selected' : ''}`} key={district.id} onClick={() => select('district', district.id)} aria-pressed={selected?.kind === 'district' && selected.item.id === district.id} aria-label={`Selecionar infraestrutura ${district.name}`}><Icon name="operations" className="ui-icon" /><span><strong>{district.name}</strong><small>Nível {level} · {district.description}</small></span><b>{Object.keys(district.processing).length ? 'PROCESSA' : 'PRODUZ'}</b><i aria-hidden="true">→</i></button>; })}</div> : <EmptyState title="Sem infraestrutura econômica" icon="operations">Os distritos ativos com extração ou processamento aparecerão aqui.</EmptyState>}</section>
      <EconomyDetail catalog={catalog} state={state} selection={selected} />
    </div>
  </div>;
}

function EconomyDetail({ catalog, state, selection }: { catalog: ShellContext['catalog']; state: ShellContext['state']; selection?: Selection }) {
  if (!selection) return <Inspector label="Detalhe econômico" className="economy-detail" state="empty"><EmptyState title="Nenhum detalhe disponível" icon="economy">Selecione um recurso ou infraestrutura local.</EmptyState></Inspector>;
  if (selection.kind === 'resource') {
    const resource = selection.item;
    const producers = catalog.districts.filter(district => (state.districts[district.id] ?? 0) > 0 && resource.id in district.production);
    const consumers = catalog.districts.filter(district => (state.districts[district.id] ?? 0) > 0 && resource.id in district.processing);
    return <Inspector label="Detalhe do recurso" className="economy-detail" header={<div className="economy-detail-header"><Icon name={resourceIcon(resource.id) ?? 'economy'} className="ui-icon" /><div><span className="eyebrow">RECURSO LOCAL</span><strong>{resource.name}</strong><small>{resource.category}</small></div></div>} summary={<div className="economy-detail-summary"><DataRow label="Estoque local" value={fmt(state.stocks[resource.id], 1)} /><DataRow label="Produção nominal" value={rate(nominalRate(catalog, state, resource.id))} /></div>}><InspectorSection title="Produtores">{producers.length ? producers.map(district => <DataRow key={district.id} label={district.name} value={rate((district.production[resource.id] ?? 0) * (state.districts[district.id] ?? 0))} />) : <span className="muted">Nenhum produtor ativo.</span>}</InspectorSection><InspectorSection title="Processadores">{consumers.length ? consumers.map(district => <DataRow key={district.id} label={district.name} value={`−${fmt((district.processing[resource.id] ?? 0) * (state.districts[district.id] ?? 0), 2)}/min`} />) : <span className="muted">Nenhum processamento ativo.</span>}</InspectorSection></Inspector>;
  }
  const district = selection.item;
  const level = state.districts[district.id] ?? 0;
  return <Inspector label="Detalhe da infraestrutura" className="economy-detail" header={<div className="economy-detail-header"><Icon name="operations" className="ui-icon" /><div><span className="eyebrow">INFRAESTRUTURA LOCAL</span><strong>{district.name}</strong><small>Nível {level}</small></div></div>} summary={<p className="economy-detail-description">{district.description}</p>}><InspectorSection title="Fluxo">{flowEntries(catalog, district.processing, level).map(entry => <DataRow key={`in-${entry.id}`} label={entry.name} value={`−${fmt(entry.value, 2)}/min`} />)}{flowEntries(catalog, district.production, level).map(entry => <DataRow key={`out-${entry.id}`} label={entry.name} value={rate(entry.value)} tone="positive" />)}</InspectorSection><InspectorSection title="Impacto local"><DataRow label="Workforce" value={fmt(district.workforce * level)} /><DataRow label="Energia" value={district.energy_generation ? `+${fmt(district.energy_generation * level)}` : `−${fmt(district.energy_consumption * level)}`} tone={district.energy_generation ? 'positive' : 'default'} />{district.industrial_capacity > 0 && <DataRow label="Capacidade industrial" value={fmt(district.industrial_capacity * level)} />}</InspectorSection></Inspector>;
}
