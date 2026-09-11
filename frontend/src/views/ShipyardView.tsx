import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Panel } from '../components/ui/Panel';
import { Badge } from '../components/ui/Badge';
import { fmt, hullRole } from '../app/format';
import type { ShellContext } from '../components/shell/AppShell';

export function ShipyardView() {
  const { catalog, state, execute } = useOutletContext<ShellContext>();
  const [hull, setHull] = useState(catalog.ships[0]?.id ?? '');
  const [propulsion, setPropulsion] = useState(catalog.propulsion[0]?.id ?? '');
  const selected = catalog.ships.find(item => item.id === hull);
  const fuels = catalog.fuels.filter(item => !selected || selected.compatible_propulsion.some(id => id === propulsion));
  const [fuel, setFuel] = useState(fuels[0]?.id ?? '');
  return <><header className="page-header"><div><div className="eyebrow">ORBITAL SHIPYARD · {state.system.planet.name}</div><h1>Estaleiro</h1><p>Slots totais {state.capacities.shipyard_slots} · disponíveis {state.capacities.shipyard_slots_available}</p></div></header><div className="ship-builder"><Panel title="Montagem" eyebrow="SHIPYARD"><label>Casco<select id="hull-select" value={hull} onChange={event => setHull(event.target.value)}>{catalog.ships.map(item => <option value={item.id} key={item.id}>{item.name} · {hullRole(item)}</option>)}</select></label><label>Propulsão<select id="propulsion-select" value={propulsion} onChange={event => setPropulsion(event.target.value)}>{catalog.propulsion.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Combustível<select id="fuel-select" value={fuel} onChange={event => setFuel(event.target.value)}>{fuels.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><button className="action primary" disabled={!state.capacities.shipyard_slots_available || !selected} onClick={() => void execute('build-ship', { planet_id: state.active_planet?.id, hull_id: hull, propulsion_id: propulsion, fuel_id: fuel })}>Construir nave</button></Panel><Panel title="Slots totais" eyebrow="CAPACITY"><div className="stat-grid"><div className="stat"><span>Ocupados</span><strong>{fmt(state.capacities.shipyard_slots - state.capacities.shipyard_slots_available)}</strong></div><div className="stat"><span>Livres</span><strong>{fmt(state.capacities.shipyard_slots_available)}</strong></div></div>{selected && <div className="metric-line"><span>{selected.name}</span><Badge tone="blue">{hullRole(selected)}</Badge></div>}</Panel></div></>;
}
