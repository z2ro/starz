import {ContentPages} from '../pixel-command/ContentPages';
import {WorkspaceDialog} from '../pixel-command/WorkspaceDialog';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmt,label } from '../app/format';
import type { Catalog,State } from '../types/game';
import { changesSince,readLocal,visitSnapshot,writeLocal,type Visit } from './experience';
export function ReturnSummary({state,catalog,empireId}:{state:State;catalog:Catalog;empireId:string}){
 const key=`starz.last-visit.v1.${empireId}`;const previous=useRef<Visit|null>(readLocal(key,null));const latest=useRef(state);latest.current=state;
 const [open,setOpen]=useState(false),[dismissed,dismiss]=useState(false);const [events,setEvents]=useState<string[]>([]);const [returning,setReturning]=useState(false);
 useEffect(()=>{const before=previous.current;if(before){const found=changesSince(before,state,catalog);if(found.length){setEvents(old=>[...new Set([...old,...found])].slice(-12));dismiss(false);setReturning(Date.now()/1000-before.at>20);}}previous.current=visitSnapshot(state);if(!document.hidden)writeLocal(key,previous.current);},[state,key]);
 useEffect(()=>{const save=()=>{writeLocal(key,visitSnapshot(latest.current));};window.addEventListener('pagehide',save);return()=>{window.removeEventListener('pagehide',save);save();};},[key]);
 const before=useRef(readLocal<Visit|null>(key,null)).current;
 if(!events.length||dismissed)return null;
 const gains=before?.planet===state.active_planet?.id?Object.entries(state.stocks).filter(([r,n])=>n>(before?.stocks[r]??n)+1).slice(0,3):[];
 return <><button className="return-open" onClick={()=>setOpen(true)}>{returning?"Enquanto você estava fora":"Novidades do império"} · {events.length}</button>{open&&<WorkspaceDialog title="Novidades do império" onClose={()=>setOpen(false)}><ContentPages label="Novidades"><section className="ux-return" role="status"><div className="ux-section-title"><h2>{returning?'Enquanto você estava fora':'Novidades do seu império'}</h2><button onClick={()=>dismiss(true)}>Marcar como lido</button></div></section>{events.map(e=><p key={e}>{e}</p>)}{returning&&gains.length>0&&<p>Variação de estoque desde sua visita (inclui produção, gastos e entregas): {gains.map(([r,n])=>`${label(catalog,r)} +${fmt(n-(before?.stocks[r]??n),1)}`).join(' · ')}</p>}<Link to="/universe">Ver atividades e próximos passos</Link></ContentPages></WorkspaceDialog>}</>;
}
