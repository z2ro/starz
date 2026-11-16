import {WorkspaceHeader} from '../pixel-command/master/MasterUI';
import {ContentPages} from '../pixel-command/ContentPages';
import { useRef, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { duration, fmt, label, nominalRate } from '../app/format';
import { DataRow } from '../components/ui/DataRow';
import { EmptyState } from '../components/ui/EmptyState';
import { Icon } from '../components/ui/Icon';
import { Inspector, InspectorSection } from '../components/ui/Inspector';
import { Progress } from '../components/ui/Progress';
import type { ShellContext } from '../components/shell/AppShell';
import type { Content, District } from '../types/game';
import { resourceIcon } from '../visual/IconRegistry';
import { ResearchConnections } from '../universe/ResearchConnections';
import { buildingArt } from '../universe/buildingArt';

type Selection = { kind: 'resource'; item: Content } | { kind: 'district'; item: District };
const rate = (value: number) => value > 0 ? `+${fmt(value, 2)}/min nom.` : '—';
const signed = (value: number) => `${value >= 0 ? '+' : '−'}${fmt(Math.abs(value), 2)}/min`;
const flowEntries = (catalog: ShellContext['catalog'], values: Record<string, number>, level: number) => Object.entries(values).map(([id, amount]) => ({ id, name: label(catalog, id), value: amount * level }));
/** Nominal consumption of a resource by every active processor on the planet. */
const consumptionRate = (catalog: ShellContext['catalog'], state: ShellContext['state'], id: string) => catalog.districts.reduce((total, district) => total + (state.districts[district.id] ?? 0) * (district.processing[id] ?? 0), 0);
const layerTitles = ['Extração', 'Recursos', 'Processamento', 'Produtos'];

/** Longest-path layers of the local chain: extractors, what they yield, processors, then their products. */
export function economyLayers(districts: District[], resources: Content[]) {
  const depth = new Map<string, number>(), known = new Set(resources.map(item => item.id));
  const visit = (key: string, path: string[]): number => {
    if (depth.has(key)) return depth.get(key)!;
    if (path.includes(key)) return 0; // A recipe loop stops here instead of recursing forever.
    const id = key.slice(key.indexOf(':') + 1), next = [...path, key];
    const value = key.startsWith('district:')
      ? Math.max(-1, ...Object.keys(districts.find(item => item.id === id)!.processing).filter(input => known.has(input)).map(input => visit(`resource:${input}`, next))) + 1
      : Math.max(0, ...districts.filter(item => id in item.production).map(item => visit(`district:${item.id}`, next))) + 1;
    depth.set(key, value);
    return value;
  };
  const nodes: Selection[] = [...districts.map(item => ({ kind: 'district' as const, item })), ...resources.map(item => ({ kind: 'resource' as const, item }))];
  const layers: Selection[][] = [];
  for (const node of nodes) (layers[visit(`${node.kind}:${node.item.id}`, [])] ??= []).push(node);
  return Array.from(layers, layer => layer ?? []);
}

export function EconomyView() {
  const { catalog: sourceCatalog, state } = useOutletContext<ShellContext>();
  const catalog = state.economic_districts ? { ...sourceCatalog, districts: state.economic_districts } : sourceCatalog;
  const navigate = useNavigate(), map = useRef<HTMLDivElement>(null);
  const localResources = [...catalog.resources, ...catalog.fuels].filter(item => item.id in state.stocks);
  const economicDistricts = catalog.districts.filter(district => (state.districts[district.id] ?? 0) > 0 && (Object.keys(district.processing).length > 0 || Object.keys(district.production).length > 0));
  const selectionCandidates: Selection[] = [...localResources.map(item => ({ kind: 'resource' as const, item })), ...economicDistricts.map(item => ({ kind: 'district' as const, item }))];
  const [selectionId, setSelectionId] = useState(selectionCandidates[0] ? `${selectionCandidates[0].kind}:${selectionCandidates[0].item.id}` : '');
  const selected = selectionCandidates.find(item => `${item.kind}:${item.item.id}` === selectionId) ?? selectionCandidates[0];
  const selectedKey = selected ? `${selected.kind}:${selected.item.id}` : '';
  const energyMargin = state.capacities.energy_generation - state.capacities.energy_consumption;
  const energyTone = state.capacities.energy_coverage >= 1 ? 'positive' : 'warning';
  const workforceTone = state.capacities.workforce_coverage >= 1 ? 'positive' : 'warning';
  const layers = economyLayers(economicDistricts, localResources);
  // An input with less than one unit in stock cannot feed its processor.
  const missing = (district: District) => Object.keys(district.processing).filter(id => (state.stocks[id] ?? 0) < 1);
  const local = new Set(localResources.map(item => item.id));
  const edges = economicDistricts.flatMap(district => {
    const key = `district:${district.id}`, tone = missing(district).length ? 'locked' : 'met';
    return [...Object.keys(district.processing).filter(id => local.has(id)).map(id => ({ from: `resource:${id}`, to: key })), ...Object.keys(district.production).filter(id => local.has(id)).map(id => ({ from: key, to: `resource:${id}` }))]
      .map(edge => ({ ...edge, className: `${tone} ${edge.from === selectedKey || edge.to === selectedKey ? 'chain' : ''}` }));
  });

  return <div className="economy-command economy-board">
    <header className="economy-command-header"><div><span className="eyebrow">REDE INDUSTRIAL LOCAL</span><WorkspaceHeader as="div" title="Produção" icon="ore"/><p>{state.system.planet.name} · {state.system.name} · {state.system.x}:{state.system.y}. Recursos existem fisicamente neste planeta.</p></div><button className="button button-ghost" onClick={() => navigate(state.persistent?'/development?section=population':'/planet')}>Gerenciar planeta →</button></header>

    <section className="economy-capacity-strip" aria-label="Capacidade local"><div className={`capacity-module tone-${energyTone}`}><Icon name="energy" className="ui-icon" /><div><strong>Energia</strong><DataRow label="Geração" value={fmt(state.capacities.energy_generation)} /><DataRow label="Demanda" value={fmt(state.capacities.energy_consumption)} /><DataRow label="Margem" value={`${energyMargin >= 0 ? '+' : ''}${fmt(energyMargin)}`} tone={energyTone} /><Progress value={state.capacities.energy_coverage * 100} text={`Cobertura: ${fmt(state.capacities.energy_coverage * 100)}%`} tone={energyTone} /></div></div><div className={`capacity-module tone-${workforceTone}`}><Icon name="population" className="ui-icon" /><div><strong>Trabalhadores</strong><DataRow label="Oferta" value={fmt(state.capacities.workforce_supply)} /><DataRow label="Demanda" value={fmt(state.capacities.workforce_demand)} /><Progress value={state.capacities.workforce_coverage * 100} text={`Cobertura: ${fmt(state.capacities.workforce_coverage * 100)}%`} tone={workforceTone} /></div></div><div className="capacity-module"><Icon name="economy" className="ui-icon" /><div><strong>Capacidade industrial</strong><DataRow label="Capacidade nominal" value={fmt(state.capacities.industrial_capacity)} /><DataRow label="Construção" value={`${fmt(state.capacities.construction_slots_available)} / ${fmt(state.capacities.construction_slots)} livre(s)`} />{state.capacities.shipyard_slots > 0 && <DataRow label="Estaleiro" value={`${fmt(state.capacities.shipyard_slots_available)} / ${fmt(state.capacities.shipyard_slots)} livre(s)`} />}</div></div></section>

    <div className="economy-workspace"><section className="economy-flow" aria-label="Rede industrial local">
      {!economicDistricts.length && <EmptyState title="Nenhuma cadeia industrial ativa" icon="operations">Construa infraestrutura no planeta para iniciar extração ou processamento.</EmptyState>}
      <div ref={map} className="economy-flow-map" style={{ paddingBottom: edges.length * 6 + 40 }}><ResearchConnections container={map} edges={edges} />{layers.map((layer, depth) => <div className="economy-layer" key={depth}><h2>{layerTitles[depth] ?? (depth % 2 ? 'Produtos avançados' : 'Processamento avançado')}</h2>{layer.map(node => { const key = `${node.kind}:${node.item.id}`, pressed = key === selectedKey;
        if (node.kind === 'resource') { const gross = nominalRate(catalog, state, node.item.id), used = consumptionRate(catalog, state, node.item.id), net = gross - used;
          return <button type="button" key={key} data-tech-id={key} className="economy-node economy-resource" data-net={net < 0 ? 'negative' : net > 0 ? 'positive' : 'flat'} aria-pressed={pressed} aria-label={`Selecionar recurso ${node.item.name}`} onClick={() => setSelectionId(key)}><Icon resourceId={node.item.id} name={resourceIcon(node.item.id) ?? 'economy'} className="ui-icon" /><strong>{node.item.name}</strong><b>{fmt(state.stocks[node.item.id], 1)}</b><em>{rate(gross)}</em>{used > 0 && <em>−{fmt(used, 2)}/min</em>}<span className="economy-net" aria-label={`Saldo de ${node.item.name}`}>{gross || used ? signed(net) : 'sem fluxo'}</span></button>; }
        const level = state.districts[node.item.id] ?? 0, short = missing(node.item);
        return <button type="button" key={key} data-tech-id={key} className="economy-node economy-district" data-category={node.item.category} data-starved={short.length > 0} aria-pressed={pressed} aria-label={`Selecionar infraestrutura ${node.item.name}`} onClick={() => setSelectionId(key)}>{buildingArt[node.item.id] ? <img src={buildingArt[node.item.id]} alt="" /> : <Icon name="operations" className="ui-icon" />}<strong>{node.item.name}</strong><small>Nível {level}</small><em>{short.length ? `Sem ${short.map(id => label(catalog, id)).join(', ')}` : Object.keys(node.item.processing).length ? 'Processando' : 'Extraindo'}</em></button>; })}</div>)}</div>
    </section>
      <div className="economy-inspection"><EconomyDetail catalog={catalog} state={state} selection={selected} /></div>
    </div>
  </div>;
}

function EconomyDetail({ catalog, state, selection }: { catalog: ShellContext['catalog']; state: ShellContext['state']; selection?: Selection }) {
  if (!selection) return <Inspector label="Detalhe econômico" className="economy-detail" state="empty"><EmptyState title="Nenhum detalhe disponível" icon="economy">Selecione um recurso ou infraestrutura local.</EmptyState></Inspector>;
  if (selection.kind === 'resource') {
    const resource = selection.item;
    const producers = catalog.districts.filter(district => (state.districts[district.id] ?? 0) > 0 && resource.id in district.production);
    const consumers = catalog.districts.filter(district => (state.districts[district.id] ?? 0) > 0 && resource.id in district.processing);
    const used = consumptionRate(catalog, state, resource.id), net = nominalRate(catalog, state, resource.id) - used;
    return <Inspector label="Detalhe do recurso" className="economy-detail" header={<div className="economy-detail-header"><Icon resourceId={resource.id} name={resourceIcon(resource.id) ?? 'economy'} className="ui-icon" /><div><span className="eyebrow">RECURSO LOCAL</span><strong>{resource.name}</strong></div></div>}><ContentPages label="Fluxo do recurso"><div className="economy-detail-summary"><DataRow label="Estoque local" value={fmt(state.stocks[resource.id], 1)} /><DataRow label="Produção nominal" value={rate(nominalRate(catalog, state, resource.id))} /><DataRow label="Consumo nominal" value={used > 0 ? `−${fmt(used, 2)}/min` : '—'} /><DataRow label="Saldo nominal" value={signed(net)} tone={net < 0 ? 'warning' : 'positive'} />{net < 0 && <DataRow label="Esgota em" value={`~${duration((state.stocks[resource.id] ?? 0) / -net * 60)}`} tone="warning" />}</div><InspectorSection title="Produtores">{producers.length ? producers.map(district => <DataRow key={district.id} label={district.name} value={rate((district.production[resource.id] ?? 0) * (state.districts[district.id] ?? 0))} />) : <span className="muted">Nenhum produtor ativo.</span>}</InspectorSection><InspectorSection title="Processadores">{consumers.length ? consumers.map(district => <DataRow key={district.id} label={district.name} value={`−${fmt((district.processing[resource.id] ?? 0) * (state.districts[district.id] ?? 0), 2)}/min`} />) : <span className="muted">Nenhum processamento ativo.</span>}</InspectorSection></ContentPages></Inspector>;
  }
  const district = selection.item;
  const level = state.districts[district.id] ?? 0;
  return <Inspector label="Detalhe da infraestrutura" className="economy-detail" header={<div className="economy-detail-header"><Icon name="operations" className="ui-icon" /><div><span className="eyebrow">INFRAESTRUTURA LOCAL</span><strong>{district.name}</strong><small>Nível {level}</small></div></div>}><ContentPages label="Fluxo da instalação"><p className="economy-detail-description">{district.description}</p><InspectorSection title="Fluxo">{flowEntries(catalog, district.processing, level).map(entry => <DataRow key={`in-${entry.id}`} label={entry.name} value={`−${fmt(entry.value, 2)}/min`} />)}{flowEntries(catalog, district.production, level).map(entry => <DataRow key={`out-${entry.id}`} label={entry.name} value={rate(entry.value)} tone="positive" />)}</InspectorSection><InspectorSection title="Impacto local"><DataRow label="Trabalhadores" value={fmt(district.workforce * level)} /><DataRow label="Energia" value={district.energy_generation ? `+${fmt(district.energy_generation * level)}` : `−${fmt(district.energy_consumption * level)}`} tone={district.energy_generation ? 'positive' : 'default'} />{district.industrial_capacity > 0 && <DataRow label="Capacidade industrial" value={fmt(district.industrial_capacity * level)} />}</InspectorSection><Link to={`/development?building=${district.id}`}>Ampliar em Instalações →</Link></ContentPages></Inspector>;
}
