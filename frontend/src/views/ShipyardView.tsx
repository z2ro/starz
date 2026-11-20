import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { cost, duration, fmt, hullRole, label, meetsRequirements, remaining } from '../app/format';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { DataRow } from '../components/ui/DataRow';
import { EmptyState } from '../components/ui/EmptyState';
import { Icon } from '../components/ui/Icon';
import { Inspector, InspectorSection } from '../components/ui/Inspector';
import { Progress } from '../components/ui/Progress';
import { SectionHeader } from '../components/ui/SectionHeader';
import type { ShellContext } from '../components/shell/AppShell';
import type { Fuel, Hull, Propulsion } from '../types/game';
import { SHIP_DESIGNS, type ShipDesignEntry } from '../visual/ShipArtworkRegistry';
import { compatibleFuels, compatiblePropulsions, firstBuildableHull, hasLocalCost } from './shipyardConfig';

type DesignState = 'available' | 'locked' | 'concept';
const designState = (catalog: ShellContext['catalog'], state: ShellContext['state'], design: ShipDesignEntry): DesignState => {
  const hull = design.gameplayHullId && catalog.ships.find(item => item.id === design.gameplayHullId);
  return !hull ? 'concept' : meetsRequirements(catalog, state, hull) ? 'available' : 'locked';
};
const stateLabel: Record<DesignState, string> = { available: 'DISPONÍVEL', locked: 'BLOQUEADA', concept: 'CONCEITO' };

export function ShipyardView() {
  const { catalog, state, execute, busy } = useOutletContext<ShellContext>();
  const firstHull = firstBuildableHull(catalog, state);
  const defaultDesign = SHIP_DESIGNS.find(design => design.gameplayHullId === firstHull?.id) ?? SHIP_DESIGNS[0];
  const [designId, setDesignId] = useState(defaultDesign.id);
  const selectedDesign = SHIP_DESIGNS.find(design => design.id === designId) ?? defaultDesign;
  const selectedHull = selectedDesign.gameplayHullId ? catalog.ships.find(item => item.id === selectedDesign.gameplayHullId) : undefined;
  const propulsions = compatiblePropulsions(catalog, state, selectedHull);
  const [propulsionId, setPropulsionId] = useState(propulsions[0]?.id ?? '');
  const selectedPropulsion = propulsions.find(item => item.id === propulsionId) ?? propulsions[0];
  const fuels = compatibleFuels(catalog, state, selectedPropulsion);
  const [fuelId, setFuelId] = useState(fuels[0]?.id ?? '');
  const selectedFuel = fuels.find(item => item.id === fuelId) ?? fuels[0];
  const hullAvailable = !!selectedHull && meetsRequirements(catalog, state, selectedHull);
  const localCostAvailable = !!selectedHull && hasLocalCost(state, selectedHull.cost);
  const crewAvailable = !!selectedHull && state.population.available >= selectedHull.crew;
  const configurationValid = !!state.active_planet?.id && !!selectedHull && hullAvailable && crewAvailable && !!selectedPropulsion && !!selectedFuel && state.capacities.shipyard_slots_available > 0 && localCostAvailable && (state.stocks[selectedFuel.id] ?? 0) >= 1;
  const chooseDesign = (id: string) => {
    const design = SHIP_DESIGNS.find(item => item.id === id) ?? defaultDesign;
    const hull = design.gameplayHullId ? catalog.ships.find(item => item.id === design.gameplayHullId) : undefined;
    const propulsion = compatiblePropulsions(catalog, state, hull)[0];
    setDesignId(design.id); setPropulsionId(propulsion?.id ?? ''); setFuelId(compatibleFuels(catalog, state, propulsion)[0]?.id ?? '');
  };
  const choosePropulsion = (id: string) => { const propulsion = propulsions.find(item => item.id === id); setPropulsionId(id); setFuelId(compatibleFuels(catalog, state, propulsion)[0]?.id ?? ''); };
  const activeBuilds = state.ships.filter(ship => ship.ready_at > Date.now() / 1000 && ship.origin_planet_id === state.active_planet?.id);
  const occupied = state.capacities.shipyard_slots - state.capacities.shipyard_slots_available;

  return <div className="shipyard-command"><ShipyardHeader state={state} /><div className="shipyard-command-layout"><ShipCatalog catalog={catalog} state={state} selectedId={selectedDesign.id} onSelect={chooseDesign} /><ShipPresentation design={selectedDesign} hull={selectedHull} propulsion={selectedPropulsion} fuel={selectedFuel} /><ShipInspector catalog={catalog} state={state} design={selectedDesign} hull={selectedHull} propulsion={selectedPropulsion} fuel={selectedFuel} propulsions={propulsions} fuels={fuels} hullAvailable={hullAvailable} crewAvailable={crewAvailable} configurationValid={configurationValid} localCostAvailable={localCostAvailable} busy={busy} onPropulsion={choosePropulsion} onFuel={setFuelId} execute={execute} /></div><ShipyardOperations catalog={catalog} state={state} activeBuilds={activeBuilds} occupied={occupied} /></div>;
}

function ShipyardHeader({ state }: { state: ShellContext['state'] }) { return <header className="shipyard-command-header"><div><span className="eyebrow">ORBITAL SHIPYARD</span><h1>Comando de naves</h1><p>{state.system.planet.name} · {state.system.name} · {state.system.x}:{state.system.y}</p></div><div className="shipyard-capacity-summary"><Icon name="shipyard" className="ui-icon" /><div><span>CAPACIDADE DO ESTALEIRO</span><strong>{fmt(state.capacities.shipyard_slots_available)} / {fmt(state.capacities.shipyard_slots)} livres</strong><small>{fmt(state.capacities.shipyard_slots - state.capacities.shipyard_slots_available)} ocupados</small></div></div></header>; }

function ShipCatalog({ catalog, state, selectedId, onSelect }: { catalog: ShellContext['catalog']; state: ShellContext['state']; selectedId: string; onSelect: (id: string) => void }) {
  const classes = useMemo(() => [...new Set(SHIP_DESIGNS.map(design => design.classification))], []);
  const [classification, setClassification] = useState('all');
  const visible = classification === 'all' ? SHIP_DESIGNS : SHIP_DESIGNS.filter(design => design.classification === classification);
  useEffect(() => { if (visible.length && !visible.some(design => design.id === selectedId)) onSelect(visible[0].id); }, [onSelect, selectedId, visible]);
  return <section className="ship-catalog" aria-label="Catálogo de naves"><SectionHeader title="Design Catalog" eyebrow="11 CLASSES NAVAIS" count={visible.length} />{classes.length > 1 && <div className="ship-catalog-filters" role="group" aria-label="Classificação naval"><button type="button" aria-pressed={classification === 'all'} className={classification === 'all' ? 'active' : ''} onClick={() => setClassification('all')}>TODAS</button>{classes.map(item => <button type="button" aria-pressed={classification === item} className={classification === item ? 'active' : ''} key={item} onClick={() => setClassification(item)}>{item}</button>)}</div>}<div className="ship-list">{visible.map(design => { const status = designState(catalog, state, design); return <button type="button" className={`ship-row ${design.id === selectedId ? 'selected' : ''} ${status !== 'available' ? 'locked' : ''}`} aria-pressed={design.id === selectedId} aria-label={`Selecionar nave ${design.name}`} key={design.id} onClick={() => onSelect(design.id)}><ShipThumbnail design={design} /><span><strong>{design.name}</strong><small>{design.classification} · {design.role}</small></span><em>{stateLabel[status]}</em></button>; })}</div></section>;
}

function ShipThumbnail({ design }: { design: ShipDesignEntry }) {
  const [loaded, setLoaded] = useState(true);
  useEffect(() => setLoaded(true), [design.id]);
  return <span className="ship-thumbnail">{loaded ? <img src={design.assets.thumbnail} alt={`Miniatura da classe ${design.name}`} loading="lazy" decoding="async" onError={() => setLoaded(false)} /> : <Icon name="fleets" className="ui-icon" />}</span>;
}

function ShipPresentation({ design, hull, propulsion, fuel }: { design: ShipDesignEntry; hull?: Hull; propulsion?: Propulsion; fuel?: Fuel }) {
  const [loaded, setLoaded] = useState(true);
  useEffect(() => setLoaded(true), [design.id]);
  return <section className={`ship-presentation ${design.special === 'stargrave' ? 'stargrave-presentation' : ''}`} aria-label="Apresentação visual da nave"><div className="ship-presentation-heading"><span className="eyebrow">{hull ? 'TECHNICAL PRESENTATION' : 'DESIGN REFERENCE'}</span><strong>{design.name}</strong><small>{design.classification} · {design.role}</small></div><div className="ship-art-stage">{loaded ? <img src={design.assets.presentation} alt={`Nave ${design.name}`} loading="eager" decoding="async" onError={() => setLoaded(false)} /> : <TechnicalSchematic />}</div><div className="ship-presentation-caption"><span>{hull ? 'MODELO COM CONFIGURAÇÃO DE GAMEPLAY' : 'CONCEITO · CONFIGURAÇÃO DE GAMEPLAY NÃO IMPLEMENTADA'}</span><p>{design.description}</p>{design.special === 'stargrave' && <b>TITAN / STELLAR SIEGE TITAN · MEGASTRUCTURA MÓVEL</b>}</div>{hull && <div className="ship-presentation-meta"><DataRow label="Modelo" value={hull.name} /><DataRow label="Classe / função" value={hullRole(hull)} /><DataRow label="Massa" value={fmt(hull.mass)} /><DataRow label="Tripulação" value={fmt(hull.crew)} /><DataRow label="Duração" value={duration(hull.duration)} />{propulsion && <DataRow label="Propulsão" value={propulsion.name} />}{fuel && <DataRow label="Combustível" value={fuel.name} />}</div>}</section>;
}

function TechnicalSchematic() { return <div className="ship-schematic"><div className="schematic-grid" /><div className="schematic-frame"><span className="schematic-wing schematic-wing-left" /><span className="schematic-body" /><span className="schematic-wing schematic-wing-right" /><span className="schematic-sensor" /><span className="schematic-engine schematic-engine-left" /><span className="schematic-engine schematic-engine-right" /></div><span className="schematic-axis">+Z FORWARD · TECHNICAL SCHEMATIC</span></div>; }

function ShipInspector({ catalog, state, design, hull, propulsion, fuel, propulsions, fuels, hullAvailable, crewAvailable, configurationValid, localCostAvailable, busy, onPropulsion, onFuel, execute }: { catalog: ShellContext['catalog']; state: ShellContext['state']; design: ShipDesignEntry; hull?: Hull; propulsion?: Propulsion; fuel?: Fuel; propulsions: Propulsion[]; fuels: Fuel[]; hullAvailable: boolean; crewAvailable: boolean; configurationValid: boolean; localCostAvailable: boolean; busy: boolean; onPropulsion: (id: string) => void; onFuel: (id: string) => void; execute: ShellContext['execute'] }) {
  const status = designState(catalog, state, design);
  if (!hull) return <Inspector label="Inspector de nave" className="ship-inspector" state="unavailable" header={<div className="ship-inspector-header"><Icon name="fleets" className="ui-icon" /><div><span className="eyebrow">DESIGN CATALOG</span><strong>{design.name}</strong><small>{design.classification} · {design.role}</small></div><Badge tone="default">CONCEITO</Badge></div>}><InspectorSection title="Identidade"><DataRow label="Classificação" value={design.classification} /><DataRow label="Função" value={design.role} /><p className="ship-concept-description">{design.description}</p>{design.subordinateStrikeCraft && <p className="ship-concept-note">Strike craft subordinadas: {design.subordinateStrikeCraft.join(' · ')}. Não são classes construíveis independentes.</p>}</InspectorSection><InspectorSection title="Estado"><p className="ship-concept-note">Esta classe ainda não possui configuração de gameplay.</p></InspectorSection></Inspector>;
  const requirements = hull.requires;
  return <Inspector label="Inspector de nave" className="ship-inspector" header={<div className="ship-inspector-header"><Icon name="fleets" className="ui-icon" /><div><span className="eyebrow">GAMEPLAY CATALOG · {status === 'locked' ? 'REQUISITOS' : 'MODELO NAVAL'}</span><strong>{design.name}</strong><small>{hullRole(hull)}</small></div><Badge tone={hullAvailable ? 'positive' : 'warning'}>{stateLabel[status]}</Badge></div>}><InspectorSection title="Especificações"><DataRow label="Classe" value={label(catalog, hull.classification)} /><DataRow label="Função" value={label(catalog, hull.role)} /><DataRow label="Massa" value={fmt(hull.mass)} /><DataRow label="Tripulação" value={fmt(hull.crew)} /><DataRow label="Duração" value={duration(hull.duration)} /></InspectorSection><InspectorSection title="Propulsão">{propulsions.length ? propulsions.map(item => <button type="button" className={`config-option ${item.id === propulsion?.id ? 'selected' : ''}`} aria-pressed={item.id === propulsion?.id} key={item.id} onClick={() => onPropulsion(item.id)}><span><strong>{item.name}</strong><small>Fator {fmt(item.speed_factor, 2)} · eficiência {fmt(item.fuel_efficiency, 2)}</small></span><i>{item.id === propulsion?.id ? 'SELECIONADA' : 'SELECIONAR'}</i></button>) : <EmptyState title="Sem propulsão compatível" icon="shipyard">Este modelo não possui uma configuração disponível.</EmptyState>}</InspectorSection><InspectorSection title="Combustível">{fuels.length ? fuels.map(item => <button type="button" className={`config-option ${item.id === fuel?.id ? 'selected' : ''}`} aria-pressed={item.id === fuel?.id} key={item.id} onClick={() => onFuel(item.id)}><span><strong>{item.name}</strong><small>Densidade {fmt(item.energy_density, 2)} · armazenamento {fmt(item.storage_factor, 2)}</small></span><i>{item.id === fuel?.id ? 'SELECIONADO' : 'SELECIONAR'}</i></button>) : <EmptyState title="Sem combustível compatível" icon="shipyard">Selecione uma propulsão com combustível disponível.</EmptyState>}</InspectorSection>{requirements.length > 0 && <InspectorSection title="Requisitos">{requirements.map(id => { const satisfied = state.research.completed.includes(id) || (state.districts[id] ?? 0) > 0; return <DataRow key={id} label={label(catalog, id)} value={satisfied ? 'Atendido' : 'Pendente'} tone={satisfied ? 'positive' : 'warning'} />; })}</InspectorSection>}<InspectorSection title="Custo e construção"><DataRow label="Custo" value={cost(catalog, hull.cost)} />{!localCostAvailable && <p className="ship-action-note">Recursos locais insuficientes.</p>}{!crewAvailable && <p className="ship-action-note">População disponível insuficiente para a tripulação.</p>}<Button variant="primary" disabled={!configurationValid} loading={busy} onClick={() => void execute('build-ship', { planet_id: state.active_planet?.id, hull_id: hull.id, propulsion_id: propulsion?.id, fuel_id: fuel?.id })}>Construir nave</Button>{!state.capacities.shipyard_slots_available && <p className="ship-action-note">Não há slots de estaleiro disponíveis.</p>}{!hullAvailable && <p className="ship-action-note">Requisitos do modelo ainda não atendidos.</p>}</InspectorSection></Inspector>;
}

function ShipyardOperations({ catalog, state, activeBuilds, occupied }: { catalog: ShellContext['catalog']; state: ShellContext['state']; activeBuilds: ShellContext['state']['ships']; occupied: number }) { return <section className="shipyard-operations" aria-label="Operações do estaleiro"><SectionHeader title="Operações do estaleiro" eyebrow="MONTAGENS NAVAIS" count={activeBuilds.length} /><div className="shipyard-operations-summary"><DataRow label="Slots totais" value={fmt(state.capacities.shipyard_slots)} /><DataRow label="Ocupados" value={fmt(occupied)} /><DataRow label="Livres" value={fmt(state.capacities.shipyard_slots_available)} /></div>{activeBuilds.length ? <div className="ship-build-list">{activeBuilds.map(ship => { const hull = catalog.ships.find(item => item.id === ship.hull_id); const start = ship.ready_at - (hull?.duration ?? 0); return <div className="ship-build-row" key={ship.id}><Icon name="fleets" className="ui-icon" /><div><strong>{label(catalog, ship.hull_id)}</strong><small>{label(catalog, ship.propulsion_id)} · {label(catalog, ship.fuel_id)}</small><Progress value={100 * (Date.now() / 1000 - start) / Math.max(1, hull?.duration ?? 1)} text={`${remaining(ship.ready_at)} restantes`} /></div></div>; })}</div> : <EmptyState title="Nenhuma construção naval ativa" icon="shipyard">Slots livres aguardam uma ordem de construção.</EmptyState>}</section>; }

