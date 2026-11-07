import {useEffect,useState,type ReactNode} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {Tabs} from '../components/ui/Tabs';
const panels:Record<string,{id:string;label:string}[]>={
 '/universe':[{id:'main',label:'Planeta'},{id:'detail',label:'Situação e ordens'}],
 '/development':[{id:'main',label:'Instalações'},{id:'detail',label:'Ampliação'},{id:'population',label:'População'}],
 '/research':[{id:'main',label:'Árvore'},{id:'detail',label:'Pesquisa e plano'}],
 '/shipyard':[{id:'main',label:'Modelos'},{id:'stage',label:'Nave'},{id:'detail',label:'Montagem'}],
 '/galaxy':[{id:'main',label:'Mapa'},{id:'detail',label:'Sistema e missão'}],

 '/fleets':[{id:'main',label:'Operações'},{id:'detail',label:'Inspecionar nave'}],
};
export function ViewportWorkspace({children}:{children:ReactNode}){
 const location=useLocation(),[panel,setPanel]=useState('main');
 useEffect(()=>setPanel(location.search.includes('section=population')?'population':location.search.includes('building=')||location.search.includes('tech=')?'detail':'main'),[location.pathname,location.search]);
 const planning=new URLSearchParams(location.search).get('plan')==='1';const missionParams=new URLSearchParams(location.search);missionParams.set('plan','1');
 const choices=location.pathname==='/fleets'&&planning?undefined:panels[location.pathname];
 return <><div className="viewport-panel-tabs">{choices&&<Tabs label="Áreas da tela" items={choices} value={panel} onChange={setPanel}/>} {location.pathname==='/fleets'&&!planning&&<Link className="viewport-mission-link" to={`/fleets?${missionParams}`}>Nova missão</Link>}</div><div className="px-view" data-panel={panel} onClick={e=>{if((e.target as HTMLElement).closest('.naval-catalog .page-item button'))setPanel('stage');else if((e.target as HTMLElement).closest('.ux-choice-list .page-item button,.research-node,.system-node,.naval-ship-row,.resource-metric,.processor-list button'))setPanel('detail');}}>{children}</div></>;
}
