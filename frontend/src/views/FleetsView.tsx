import {WorkspaceHeader} from '../pixel-command/master/MasterUI';
import {WorkspaceDialog} from '../pixel-command/WorkspaceDialog';
import {ContentPages} from '../pixel-command/ContentPages';
import {apiRequest} from '../api/client';
import {useQueryClient} from '@tanstack/react-query';
import { Progress } from '../components/ui/Progress';
import { Icon } from '../components/ui/Icon';
import { OperationsView } from '../universe/OperationsView';
import { Link, useSearchParams } from 'react-router-dom';
import { missionNames } from '../universe/experience';
import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Panel } from '../components/ui/Panel';
import { Badge } from '../components/ui/Badge';
import { duration, label } from '../app/format';
import { ShipPreview } from '../components/ships/ShipPreview';
import type { ShellContext } from '../components/shell/AppShell';

export function FleetWorkspace(){
 const {state,activePlanetId}=useOutletContext<ShellContext>();const [params]=useSearchParams();
 if(!state.persistent)return <FleetsView/>;
 const planning=params.get('plan')==='1';const to=(plan:boolean)=>{const next=new URLSearchParams(params);if(plan)next.set('plan','1');else next.delete('plan');return '/fleets?'+next;};
 return <>{!planning&&<nav className="universe-tabs fleet-mode-nav" aria-label="Frotas e missões"><Link to={to(false)} aria-current={!planning?'page':undefined}>Frotas</Link><Link to={to(true)} aria-current={planning?'page':undefined}>Planejar missão</Link></nav>}{planning?<OperationsView key={`${activePlanetId??state.active_planet?.id}:${params.toString()}`}/>:<FleetsView/>}</>;
}

export function FleetsView() {
  const { catalog, state,activePlanetId,setFeedback } = useOutletContext<ShellContext>();
  const client=useQueryClient(),[recalling,setRecalling]=useState(false);
  async function recall(fleet_id:string){setRecalling(true);try{await apiRequest('/api/universe/recall',{method:'POST',body:JSON.stringify({planet_id:activePlanetId,fleet_id})});await Promise.all([client.invalidateQueries({queryKey:['state']}),client.invalidateQueries({queryKey:['universe']})]);setFeedback({kind:'success',message:'Retorno ordenado. Acompanhe a chegada à origem.'});}catch(e){setFeedback({kind:'error',message:(e as Error).message});}finally{setRecalling(false);}}
  const [selectedId, select] = useState(''),[operation,setOperation]=useState(''),[details,setDetails]=useState(false);
  const ships = [...new Map(state.ships.map(ship => [ship.id, ship])).values()];
  const attached = new Set(state.fleets.flatMap(fleet => fleet.ship_ids));
  const fleet=state.fleets.find(f=>f.id===operation)??(operation==='free'?undefined:state.fleets[0]);
  const selected = ships.find(ship => ship.id === selectedId) ?? ships.find(s=>fleet?fleet.ship_ids.includes(s.id):!attached.has(s.id))??ships[0];
  const row = (id: string) => {
    const ship = ships.find(item => item.id === id);
    return <button className="naval-ship-row" title={id} key={id} disabled={!ship} aria-pressed={selected?.id === id} onClick={() => {select(id);setDetails(false);}}>{ship ? label(catalog, ship.hull_id) : 'Nave não disponível neste snapshot'}<small>{state.persistent&&ship&&` · Casco ${Math.ceil(state.ship_health?.[id]??catalog.ships.find(h=>h.id===ship.hull_id)?.hull_points??0)} / ${catalog.ships.find(h=>h.id===ship.hull_id)?.hull_points??0} HP`} · ID {id.slice(0,8)}{state.campaign ? ` · integridade ${state.campaign.health[id] ?? 100}%` : ''}</small></button>;
  };
  const operationDetails = fleet && <>{fleet.status==='TRANSIT'&&<Progress value={100*((state.observed_at??Date.now()/1000)-fleet.departure_at)/Math.max(1,fleet.arrival_at-fleet.departure_at)} text="Progresso da viagem"/>}<div className="strategy-composition" aria-label="Composição da frota">{catalog.ships.map(h=>{const count=[...new Set(fleet.ship_ids)].filter(id=>ships.find(s=>s.id===id)?.hull_id===h.id).length;return count?<span key={h.id}><Icon name="fleets"/>{count} × {h.name}</span>:null;})}</div>{state.persistent&&fleet.status==='ARRIVED'&&<Link className="button" to={`/fleets?plan=1&fleet=${encodeURIComponent(fleet.id)}&x=${fleet.x}&y=${fleet.y}`}>Nova missão com esta frota</Link>}<div className="metric-line"><span>Status</span><Badge tone={fleet.status === 'ARRIVED' ? 'good' : 'blue'}>{state.persistent?(fleet.status==='ARRIVED'?'No sistema':'Em viagem'):fleet.status}</Badge></div><div className="metric-line"><span>Missão</span><b>{state.persistent?missionNames[fleet.operation??fleet.mission]??fleet.mission:fleet.operation??fleet.mission}</b></div><div className="metric-line"><span>Propulsão</span><b>{label(catalog, fleet.propulsion)}</b></div><div className="metric-line"><span>ETA</span><b>{fleet.status === 'TRANSIT' ? duration(fleet.eta) : 'Chegada'}</b></div>{fleet.fuel_reserve !== undefined && <div className="metric-line"><span>Reserva de combustível</span><b>{fleet.fuel_reserve.toFixed(1)}</b></div>}<small>{fleet.ship_ids.length} nave(s) · modo {fleet.mode}</small>{fleet.status === 'TRANSIT' && <p>Destino {fleet.destination_x}:{fleet.destination_y}</p>}{[...new Set(fleet.ship_ids)].map(row)}</>;
  return <><header className="page-header"><div><div className="eyebrow">OPERAÇÕES ESPACIAIS</div><WorkspaceHeader as="div" title="Frotas" icon="ship"/><p>Posição operacional, missão e tempo estimado. O preview é uma inspeção do modelo. Cascos danificados recuperam 2 HP/s por nível do estaleiro local, partilhados entre as naves estacionadas e limitados por energia e trabalhadores.</p></div></header><div className="naval-fleets"><section className="fleet-list">
 {ships.length>0&&<label className="fleet-operation-picker">Operação<select aria-label="Selecionar operação de frota" value={fleet?.id??'free'} onChange={e=>{setOperation(e.target.value);select('');setDetails(false);}}>{state.fleets.map(f=><option key={f.id} value={f.id}>{missionNames[f.operation??f.mission]??f.name} · {f.ship_ids.length} nave(s) · {f.x}:{f.y}</option>)}{ships.some(s=>!attached.has(s.id))&&<option value="free">Naves disponíveis · {ships.filter(s=>!attached.has(s.id)).length}</option>}</select></label>}
 {fleet?<Panel title={`${missionNames[fleet.operation??fleet.mission]??fleet.name} · ${fleet.ship_ids.length} nave(s)`} eyebrow={fleet.status==='TRANSIT'?'EM VIAGEM':'NO SISTEMA'} className="fleet-operation-card"><div className="px-fleet-route"><Icon name="fleets"/><strong>{fleet.x}:{fleet.y}</strong><span aria-hidden>→</span><strong>{fleet.status==='TRANSIT'?`${fleet.destination_x}:${fleet.destination_y}`:'No sistema'}</strong><small>{fleet.ship_ids.length} nave(s)</small><b>{fleet.status==='TRANSIT'?duration(fleet.eta):'No sistema'}</b></div>
 <div className="fleet-details-inline"><ContentPages label="Dados da operação" resetKey={fleet.id}>{operationDetails}</ContentPages></div>
 <div className="fleet-action-row"><button onClick={()=>setDetails(true)}>Detalhes da operação</button>{state.persistent&&<button disabled={recalling||['RETURN','COLONIZE'].includes(fleet.operation??fleet.mission)} onClick={()=>void recall(fleet.id)}>{fleet.status==='TRANSIT'?'Recolher frota':'Retornar à origem'}</button>}{state.persistent&&['RETURN','COLONIZE'].includes(fleet.operation??fleet.mission)&&<small>{(fleet.operation??fleet.mission)==='RETURN'?'Retorno já em andamento.':'Colonização comprometida: recall indisponível.'}</small>}</div>
 {details&&<WorkspaceDialog title="Operação da frota" onClose={()=>setDetails(false)}><ContentPages label="Operação da frota"><div className="px-fleet-route"><Icon name="fleets"/><strong>{fleet.x}:{fleet.y}</strong><span aria-hidden>→</span><strong>{fleet.status==='TRANSIT'?`${fleet.destination_x}:${fleet.destination_y}`:'No sistema'}</strong><small>{fleet.ship_ids.length} nave(s)</small><b>{fleet.status==='TRANSIT'?duration(fleet.eta):'No sistema'}</b></div>{operationDetails}{state.persistent&&<button disabled={recalling||['RETURN','COLONIZE'].includes(fleet.operation??fleet.mission)} onClick={()=>void recall(fleet.id)}>{fleet.status==='TRANSIT'?'Recolher frota':'Retornar à origem'}</button>}{state.persistent&&['RETURN','COLONIZE'].includes(fleet.operation??fleet.mission)&&<small>{(fleet.operation??fleet.mission)==='RETURN'?'Retorno já em andamento.':'Colonização comprometida: recall indisponível.'}</small>}</ContentPages></WorkspaceDialog>}</Panel>:ships.length?<Panel title="Naves disponíveis" eyebrow="INVENTÁRIO REAL" className="fleet-inventory"><ContentPages label="Naves disponíveis"><p>Selecione uma nave para inspecionar o modelo; o inventário não implica presença neste sistema.</p>{ships.filter(s=>!attached.has(s.id)).map(ship=>row(ship.id))}</ContentPages><Link className="button" to="/fleets?plan=1">Planejar missão</Link></Panel>:<Panel title="Nenhuma frota" className="fleet-empty"><p>Construa uma Horizon e selecione as naves prontas para formar sua primeira missão.</p><Link className="button" to="/shipyard">Construir minha primeira nave</Link></Panel>}
 </section>
      {selected&&<div><ShipPreview hull={catalog.ships.find(item => item.id === selected?.hull_id)} />{selected && <p>Inspecionando ID {selected.id} · {label(catalog, selected.propulsion_id)} · {label(catalog, selected.fuel_id)}</p>}</div>}
    </div></>;
}
