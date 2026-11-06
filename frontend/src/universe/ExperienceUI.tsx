import { Icon } from '../components/ui/Icon';
import { resourceIcon } from '../visual/IconRegistry';
import { Link } from 'react-router-dom';
import { duration, fmt, label } from '../app/format';
import type { Catalog, State } from '../types/game';
import { Progress } from '../components/ui/Progress';
import { shortage, missionNames } from './experience';
export function Costs({catalog,state,values}:{catalog:Catalog;state:State;values:Record<string,number>}){return <ul className="ux-costs" aria-label="Custo no planeta atual">{Object.entries(values).map(([r,n])=><li key={r} className={(state.stocks[r]??0)<n?'ux-missing':''}><Icon name={resourceIcon(r)??'economy'}/><span>{label(catalog,r)}</span><strong>{fmt(n,1)}</strong><small>{(state.stocks[r]??0)<n?`Faltam ${fmt(n-(state.stocks[r]??0),1)}`:`${fmt(state.stocks[r]??0,1)} disponíveis`}</small></li>)}</ul>;}
export function CostBlock({catalog,state,values}:{catalog:Catalog;state:State;values:Record<string,number>}){const missing=shortage(state.stocks,values);return missing.length?<p className="ux-warning">Recursos insuficientes: {missing.map(r=>`${label(catalog,r.id)} (${fmt(r.missing,1)} faltando)`).join(' · ')}. <Link to="/development">Ampliar produção</Link></p>:null;}
export function activityJobs(catalog:Catalog,state:State){
 const now=state.observed_at??Date.now()/1000;
 const jobs=[...state.construction.map(j=>({key:`build-${j.id}-${j.started_at}`,name:label(catalog,j.id),kind:'Construção',end:j.complete_at,progress:100*(now-j.started_at)/Math.max(1,j.complete_at-j.started_at),path:'/development'})),...Object.values(state.research_domains??{legacy:state.research}).filter(j=>j.active).map(j=>({key:`research-${j.active}`,name:label(catalog,j.active!),kind:'Pesquisa',end:j.complete_at,progress:100*(1-j.remaining_work/Math.max(1,('total_work' in j?j.total_work:undefined)??state.research_work??j.remaining_work)),path:`/research?tech=${encodeURIComponent(j.active!)}`})),...state.ships.filter(s=>s.ready_at>now).map(s=>({key:s.id,name:label(catalog,s.hull_id),kind:'Montagem naval',end:s.ready_at,progress:undefined,path:'/shipyard'})),...state.fleets.filter(f=>f.status==='TRANSIT').map(f=>({key:f.id,name:`${missionNames[f.operation??f.mission]??f.name} → ${f.destination_x}:${f.destination_y}`,kind:`${f.ship_ids.length} nave(s)`,end:f.arrival_at,progress:100*(now-f.departure_at)/Math.max(1,f.arrival_at-f.departure_at),path:'/fleets'}))];
 return jobs.sort((a,b)=>(a.end??Infinity)-(b.end??Infinity)||a.key.localeCompare(b.key));
}
export function Activities({catalog,state,compact=false}:{catalog:Catalog;state:State;compact?:boolean}){
 const now=state.observed_at??Date.now()/1000;const jobs=activityJobs(catalog,state);
 const row=(j:ReturnType<typeof activityJobs>[number])=><Link className="ux-activity" to={j.path} key={j.key}><span><small>{j.kind}</small><strong>{j.name}</strong></span><b>{j.end===null?'Aguardando capacidade':duration(Math.max(0,(j.end??now)-now))}{typeof j.end==='number'&&<small><time dateTime={new Date(j.end*1000).toISOString()}>{new Date(j.end*1000).toLocaleTimeString('pt-BR')}</time></small>}</b>{j.progress!==undefined&&<Progress value={j.progress} text={`Progresso de ${j.name}`} />}</Link>;
 return <section className={`ux-activities ${compact?'strategy-operations':''}`} aria-label="Atividades em andamento" data-active={jobs.length>0}>
 <div className="ux-section-title"><h2>{compact?'Operações':'Em andamento'}</h2><span>{jobs.length?`${jobs.length} em andamento`:'Nenhuma ordem em andamento'}</span>{!jobs.length&&<Link to="/development">Construir instalação →</Link>}</div>
 <div className="strategy-job-list">{(compact?jobs.slice(0,3):jobs).map(row)}</div>{compact&&jobs.length>3&&<details><summary>Mais {jobs.length-3} operações</summary>{jobs.slice(3).map(row)}</details>}
 </section>;
}
