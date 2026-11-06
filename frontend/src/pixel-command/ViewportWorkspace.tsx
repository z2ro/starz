import {useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {useLocation} from 'react-router-dom';
import {Tabs} from '../components/ui/Tabs';
const panels:Record<string,{id:string;label:string}[]>={
 '/universe':[{id:'main',label:'Planeta'},{id:'detail',label:'Situação e ordens'}],
 '/development':[{id:'main',label:'Instalações'},{id:'detail',label:'Ampliação'},{id:'population',label:'População'}],
 '/research':[{id:'main',label:'Árvore'},{id:'detail',label:'Pesquisa e plano'}],
 '/shipyard':[{id:'main',label:'Modelos'},{id:'stage',label:'Nave'},{id:'detail',label:'Montagem'}],
 '/galaxy':[{id:'main',label:'Mapa'},{id:'detail',label:'Sistema e missão'}],
 '/economy':[{id:'main',label:'Estoques'},{id:'flow',label:'Produção'},{id:'detail',label:'Capacidade e detalhe'}],
 '/fleets':[{id:'main',label:'Operações'},{id:'detail',label:'Inspecionar nave'}],
};
export function ViewportWorkspace({children}:{children:ReactNode}){
 const location=useLocation(),[panel,setPanel]=useState('main');const root=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{const viewport=root.current;if(!viewport)return;let frame=0;const measure=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{const desktop=matchMedia('(min-width:701px)').matches;viewport.querySelectorAll<HTMLElement>('.ux-inspector,.naval-inspector,.system-detail,.ux-choice-list,.naval-catalog,.map-viewport,.defense-catalog').forEach(el=>{if(!desktop){el.style.removeProperty('max-height');return;}if(!el.getClientRects().length)return;const top=el.getBoundingClientRect().top-viewport.getBoundingClientRect().top+viewport.scrollTop;const available=Math.max(140,viewport.clientHeight-top-12);el.style.maxHeight=available+'px';});});};const resize=new ResizeObserver(measure);resize.observe(viewport);const changes=new MutationObserver(measure);changes.observe(viewport,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});measure();return()=>{cancelAnimationFrame(frame);resize.disconnect();changes.disconnect();};},[location.pathname]);
 useEffect(()=>setPanel(location.search.includes('section=population')?'population':location.search.includes('building=')||location.search.includes('tech=')?'detail':'main'),[location.pathname,location.search]);
 const choices=location.pathname==='/fleets'&&location.search.includes('plan=1')?undefined:panels[location.pathname];
 return <><div className="viewport-panel-tabs">{choices&&<Tabs label="Áreas da tela" items={choices} value={panel} onChange={setPanel}/>}</div><div ref={root} className="px-view" data-panel={panel} onClick={e=>{if((e.target as HTMLElement).closest('.defense-catalog button'))e.currentTarget.scrollTop=0;if((e.target as HTMLElement).closest('.naval-catalog button'))setPanel('stage');else if((e.target as HTMLElement).closest('.ux-choice-list button,.research-node,.system-node,.naval-ship-row,.resource-metric,.processor-list button'))setPanel('detail');}}>{children}</div></>;
}
