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
  const allowed = hull && meetsRequirements(catalog, state, hull);
  return <><header className="page-header"><div><div className="eyebrow">ORBITAL SHIPYARD · {state.system.planet.name}</div><h1>Estaleiro</h1><p>Slots totais {state.capacities.shipyard_slots} · disponíveis {state.capacities.shipyard_slots_available}</p><small>{state.campaign ? 'Poder militar, carga, ciência e alas têm efeitos reais na campanha. Balanceamento experimental.' : 'Novas classes: balanceamento provisório. Funções militares não incluem simulação de combate.'}</small></div></header>
    <div className="naval-command"><section className="naval-catalog" aria-label="Catálogo naval">{catalog.ships.map(item => <button key={item.id} aria-pressed={item.id === hull?.id} onClick={() => { setHull(item.id); setPropulsion(''); setFuel(''); }}><strong>{item.name}</strong><small>{hullRole(item)}</small><small>{meetsRequirements(catalog, state, item) ? 'DISPONÍVEL' : 'BLOQUEADA'}</small></button>)}<Link to="/ship-geometry-lab">Galeria experimental · Stargrave não construível</Link></section>
    <ShipPreview hull={hull} />
    <Panel title={hull?.name ?? 'Nenhum modelo disponível'} eyebrow="SHIP INSPECTOR" className="naval-inspector">{hull && <>
      <p>{hullRole(hull)}</p><p>{hull.description}</p>
      <div className="metric-line"><span>Massa (valor de domínio)</span><b>{fmt(hull.mass)}</b></div><div className="metric-line"><span>Tripulação</span><b>{fmt(hull.crew)}</b></div><div className="metric-line"><span>Construção</span><b>{duration(hull.duration)}</b></div>
      {state.campaign && <><div className="metric-line"><span>Poder militar nominal</span><b>{fmt(hull.combat_power)}</b></div><div className="metric-line"><span>Capacidade de carga</span><b>{fmt(hull.cargo_capacity)}</b></div><div className="metric-line"><span>Descobertas por análise</span><b>{fmt(hull.science_bonus)}</b></div><div className="metric-line"><span>Alas embarcadas (+5 poder cada)</span><b>{fmt(hull.carrier_capacity)}</b></div></>}
      <p>Custo local: {cost(catalog, hull.cost)}</p>
      <ul aria-label="Requisitos">{hull.requires.map(id => <li key={id}>{label(catalog, id)} · {state.research.completed.includes(id) || (state.districts[id] ?? 0) > 0 ? 'Atendido' : 'Pendente'}</li>)}</ul>
      {!allowed && <p role="status">Modelo bloqueado por requisitos ou desbloqueios de pesquisa.</p>}
      <label>Propulsão<select value={config.propulsion?.id ?? ''} onChange={e => { setPropulsion(e.target.value); setFuel(''); }}>{config.propulsions.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
      <label>Combustível<select value={config.fuel?.id ?? ''} onChange={e => setFuel(e.target.value)}>{config.fuels.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
      {!config.propulsion && <p>Nenhuma propulsão compatível desbloqueada.</p>}{!config.fuel && <p>Nenhum combustível compatível desbloqueado.</p>}
      {config.fuel && (state.stocks[config.fuel.id] ?? 0) < 1 && <p>Necessário pelo menos 1 de combustível no estoque local.</p>}
      {config.missingCost.length > 0 && <p>Recursos insuficientes: {config.missingCost.map(id => label(catalog, id)).join(', ')}.</p>}
      {state.population.available < hull.crew && <p>Tripulação disponível insuficiente.</p>}
      {state.capacities.shipyard_slots_available < 1 && <p>Nenhum slot disponível neste planeta.</p>}
      <button className="action primary" disabled={busy || !snapshotReady || !config.valid} onClick={() => { if (config.valid && config.propulsion && config.fuel) void execute('build-ship', { planet_id: state.active_planet?.id, hull_id: hull.id, propulsion_id: config.propulsion.id, fuel_id: config.fuel.id }).catch(() => undefined); }}>Construir nave</button>
    </>}</Panel></div></>;
}
