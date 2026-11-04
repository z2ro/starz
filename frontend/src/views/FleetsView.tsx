import { Link } from 'react-router-dom';
import { missionNames } from '../universe/experience';
import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Panel } from '../components/ui/Panel';
import { Badge } from '../components/ui/Badge';
import { duration, label } from '../app/format';
import { ShipPreview } from '../components/ships/ShipPreview';
import type { ShellContext } from '../components/shell/AppShell';

export function FleetsView() {
  const { catalog, state } = useOutletContext<ShellContext>();
  const [selectedId, select] = useState('');
  const ships = [...new Map(state.ships.map(ship => [ship.id, ship])).values()];
  const selected = ships.find(ship => ship.id === selectedId) ?? ships[0];
  const attached = new Set(state.fleets.flatMap(fleet => fleet.ship_ids));
  const row = (id: string) => {
    const ship = ships.find(item => item.id === id);
    return <button className="naval-ship-row" key={id} disabled={!ship} aria-pressed={selected?.id === id} onClick={() => select(id)}>{ship ? label(catalog, ship.hull_id) : 'Nave não disponível neste snapshot'}<small> · ID {id}{state.campaign ? ` · integridade ${state.campaign.health[id] ?? 100}%` : ''}</small></button>;
  };
  return <><header className="page-header"><div><div className="eyebrow">ORBITAL OPERATIONS</div><h1>Frotas</h1><p>Posição operacional, missão e tempo estimado. O preview é uma inspeção do modelo, sem formação espacial.</p></div></header>{state.persistent && <p><a href="#/missions">Abrir comando de missões multi-nave, transporte, espionagem e ataques →</a></p>}<div className="naval-fleets"><div className="fleet-list">{state.fleets.map(fleet => <Panel title={fleet.name} eyebrow={fleet.status === 'ARRIVED' ? 'READY' : 'TRANSIT'} key={fleet.id}><div className="metric-line"><span>Status</span><Badge tone={fleet.status === 'ARRIVED' ? 'good' : 'blue'}>{state.persistent?(fleet.status==='ARRIVED'?'No sistema':'Em viagem'):fleet.status}</Badge></div><div className="metric-line"><span>Posição</span><b>{fleet.x}:{fleet.y}</b></div><div className="metric-line"><span>Missão</span><b>{state.persistent?missionNames[fleet.operation??fleet.mission]??fleet.mission:fleet.operation??fleet.mission}</b></div><div className="metric-line"><span>Propulsão</span><b>{label(catalog, fleet.propulsion)}</b></div><div className="metric-line"><span>ETA</span><b>{fleet.status === 'TRANSIT' ? duration(fleet.eta) : 'Chegada'}</b></div>{fleet.fuel_reserve !== undefined && <div className="metric-line"><span>Reserva de combustível</span><b>{fleet.fuel_reserve.toFixed(1)}</b></div>}<small>{fleet.ship_ids.length} nave(s) · modo {fleet.mode}</small>{fleet.status === 'TRANSIT' && <p>Destino {fleet.destination_x}:{fleet.destination_y}</p>}{[...new Set(fleet.ship_ids)].map(row)}</Panel>)}
      {ships.some(ship => !attached.has(ship.id)) && <Panel title="Naves sem frota" eyebrow="INVENTORY"><p>Inventário real; não implica presença no sistema selecionado.</p>{ships.filter(ship => !attached.has(ship.id)).map(ship => row(ship.id))}</Panel>}
      {!ships.length && !state.fleets.length && <Panel title="Nenhuma frota"><p>Uma frota se forma quando você seleciona naves prontas e envia uma missão. Comece construindo uma Horizon.</p><Link className="button" to="/shipyard">Construir minha primeira nave</Link></Panel>}</div>
      {selected&&<div><ShipPreview hull={catalog.ships.find(item => item.id === selected?.hull_id)} />{selected && <p>Inspecionando ID {selected.id} · {label(catalog, selected.propulsion_id)} · {label(catalog, selected.fuel_id)}</p>}</div>}
    </div></>;
}
