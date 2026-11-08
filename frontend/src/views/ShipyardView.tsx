import {WorkspaceHeader} from '../pixel-command/master/MasterUI';
import {ContentPages} from '../pixel-command/ContentPages';
import { Costs, CostBlock } from '../universe/ExperienceUI';
import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Panel } from '../components/ui/Panel';
import { cost, duration, fmt, hullRole, label, meetsRequirements } from '../app/format';
import { ShipPreview } from '../components/ships/ShipPreview';
import { buildConfiguration } from '../components/ships/buildConfiguration';
import type { ShellContext } from '../components/shell/AppShell';

export function ShipyardView() {
  const { catalog, state, execute, busy, snapshotReady = true } = useOutletContext<ShellContext>();
  const [hullId, setHull] = useState(''), [propulsionId, setPropulsion] = useState(''), [fuelId, setFuel] = useState('');
  const hull = catalog.ships.find(item => item.id === hullId) ?? catalog.ships.find(item => meetsRequirements(catalog, state, item)) ?? catalog.ships[0];
  const config = buildConfiguration(catalog, state, hull, propulsionId, fuelId);
  const assemblyRate = state.persistent ? 1 + catalog.technologies.reduce((n,t)=>n+(t.effects?.ship_speed??0)*(state.empire_levels?.[t.id]??0),0) : 1;
  const visibleHulls = state.persistent ? [...catalog.ships].sort((a,b)=>Number(meetsRequirements(catalog,state,b))-Number(meetsRequirements(catalog,state,a))) : catalog.ships;
  const allowed = hull && meetsRequirements(catalog, state, hull);
  return <><header className="page-header"><div><div className="eyebrow">ESTALEIRO ORBITAL · {state.system.planet.name}</div><WorkspaceHeader as="div" title="Estaleiro" icon="ship"/><p>Slots totais {state.capacities.shipyard_slots} · disponíveis {state.capacities.shipyard_slots_available}</p><small>{state.campaign || state.persistent ? 'Poder militar, carga, ciência e alas têm efeitos reais no jogo. Construa uma Horizon para começar a explorar.' : 'Novas classes: balanceamento provisório. Funções militares não incluem simulação de combate.'}</small></div></header>
    <div className="naval-command"><section className="naval-catalog" aria-label="Catálogo naval"><ContentPages label="Modelos navais" resetKey={hull?.id}>{visibleHulls.map(item => <button key={item.id} aria-pressed={item.id === hull?.id} onClick={() => { setHull(item.id); setPropulsion(''); setFuel(''); }}><strong>{item.name}</strong><small>{hullRole(item)}</small><small>{meetsRequirements(catalog, state, item) ? 'DISPONÍVEL' : 'BLOQUEADA'}</small><span className="strategy-hull-cost">{duration(item.duration/assemblyRate)} · {item.crew} tripulantes<small>{state.ships.filter(s=>s.hull_id===item.id).length} no inventário</small></span></button>)}<Link to="/stellar">Engenharia estelar · projetos e Stargrave →</Link></ContentPages></section>
    <div className="strategy-ship-stage"><ShipPreview hull={hull} /><details className="strategy-ship-comparison"><summary>Comparar classes · atributos-base</summary><ContentPages label="Comparação de modelos">{visibleHulls.map(item=><p key={item.id}><b>{item.name}</b> · {item.crew} tripulantes · carga {item.cargo_capacity} · armas/casco/escudo {item.weapon_damage}/{item.hull_points}/{item.shield_points} · {duration(item.duration/assemblyRate)}</p>)}</ContentPages></details></div>
    <Panel title={hull?.name ?? 'Nenhum modelo disponível'} eyebrow="CONFIGURAÇÃO NAVAL" className="naval-inspector">{hull && <ContentPages label="Montagem e especificações" resetKey={`${state.active_planet?.id}:${hull.id}`}>
      <p>{hullRole(hull)}</p><p>{hull.description}</p>
      <p className="ux-ship-summary">Tripulação: {fmt(hull.crew)} · Montagem: {duration(hull.duration/assemblyRate)}</p><h3>Especificações técnicas e função</h3><div className="metric-line"><span>Massa</span><b>{fmt(hull.mass)}</b></div><div className="metric-line"><span>Tripulação</span><b>{fmt(hull.crew)}</b></div><div className="metric-line"><span>Construção</span><b>{duration(hull.duration/assemblyRate)}</b></div>
      {(state.campaign || state.persistent) && <><div className="metric-line"><span>{state.persistent?'Armas / casco / escudo base':'Poder militar nominal'}</span><b>{state.persistent?`${hull.weapon_damage} / ${hull.hull_points} / ${hull.shield_points}`:fmt(hull.combat_power)}</b></div><div className="metric-line"><span>Capacidade de carga</span><b>{fmt(hull.cargo_capacity)}</b></div><div className="metric-line"><span>Bônus científico</span><b>{fmt(hull.science_bonus)}</b></div><div className="metric-line"><span>Alas embarcadas (+5 poder cada)</span><b>{fmt(hull.carrier_capacity)}</b></div></>}
            <label>Propulsão<select value={config.propulsion?.id ?? ''} onChange={e => { setPropulsion(e.target.value); setFuel(''); }}>{config.propulsions.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
      <label>Combustível<select value={config.fuel?.id ?? ''} onChange={e => setFuel(e.target.value)}>{config.fuels.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
      {!config.propulsion && <p>Nenhuma propulsão compatível desbloqueada.</p>}{!config.fuel && <p>Nenhum combustível compatível desbloqueado.</p>}
      {config.fuel && (state.stocks[config.fuel.id] ?? 0) < 1 && <p>Necessário pelo menos 1 de combustível no estoque local.</p>}
      {config.missingCost.length > 0 && <p>Recursos insuficientes: {config.missingCost.map(id => label(catalog, id)).join(', ')}.</p>}
      {state.population.available < hull.crew && <p>Tripulação disponível insuficiente.</p>}
      {state.capacities.shipyard_slots_available < 1 && <p>Nenhum slot disponível neste planeta.</p>}
      <ul aria-label="Requisitos">{hull.requires.map(id => <li key={id}>{label(catalog, id)} · {state.research.completed.includes(id) || (state.districts[id] ?? 0) > 0 ? 'Atendido' : 'Pendente'}</li>)}</ul>
      {!allowed && <p role="status">Modelo bloqueado por requisitos ou desbloqueios de pesquisa.</p>}
<section className="build-review"><strong>{hull.name}</strong><p>{config.propulsion?.name??"Sem propulsão"} · {config.fuel?.name??"Sem combustível"}</p><p>Montagem {duration(hull.duration/assemblyRate)} · {hull.crew} tripulantes</p>{state.persistent?<><Costs catalog={catalog} state={state} values={hull.cost}/><CostBlock catalog={catalog} state={state} values={hull.cost}/></>:<p>Custo local: {cost(catalog, hull.cost)}</p>}
      <p>{allowed?"Requisitos tecnológicos atendidos.":"Modelo bloqueado. Consulte os requisitos nas páginas anteriores."}</p>      <button className="action primary" disabled={busy || !snapshotReady || !config.valid} onClick={() => { if (config.valid && config.propulsion && config.fuel) void execute('build-ship', { planet_id: state.active_planet?.id, hull_id: hull.id, propulsion_id: config.propulsion.id, fuel_id: config.fuel.id }).catch(() => undefined); }}>Construir nave</button></section>
    </ContentPages>}</Panel></div>{state.persistent&&<><p>Após a montagem, a nave estará disponível para selecionar em uma missão. <Link className="button" to="/galaxy">Escolher destino no mapa</Link> · <Link to="/fleets?plan=1">Planejar missão</Link></p></>}</>;
}
