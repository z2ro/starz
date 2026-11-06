import { Link } from 'react-router-dom';
import type { Catalog,State,Technology } from '../types/game';
import { label } from '../app/format';
import { PixelIcon } from './PixelIcon';

export function TechnologyPath({tech,state,catalog,nextLevel,onSelect}:{tech:Technology;state:State;catalog:Catalog;nextLevel:number;onSelect:(id:string)=>void}){
 const requirements=[...new Set([...tech.requires,...Object.keys(tech.level_requires??{}),...Object.keys(tech.infrastructure??{})])];
 return <section className="px-tech-path" aria-label="Caminho da tecnologia"><div><h3>Pré-requisitos</h3>{requirements.length?requirements.map(id=>{
 const technological=catalog.technologies.some(t=>t.id===id);const level=technological?state.empire_levels?.[id]??0:state.districts[id]??0;const required=technological?tech.level_requires?.[id]??1:tech.infrastructure?.[id]??1;
 const text=<><PixelIcon name={technological?'research':'build'}/><span>{label(catalog,id)}<small>Nível {level} / {required} · {level>=required?'Atendido':'Pendente'}</small></span></>;
 return technological?<button key={id} onClick={()=>onSelect(id)}>{text}</button>:<Link key={id} to={`/development?building=${encodeURIComponent(id)}`}>{text}</Link>;
 }):<p>Início da linha · sem pré-requisito</p>}</div><span className="px-path-arrow" aria-hidden>→</span><div className="px-tech-target"><PixelIcon name="research"/><h3>{tech.name}</h3><strong>Nível {state.empire_levels?.[tech.id]??0} → {nextLevel}</strong><small>{state.research.active===tech.id?'Programa em andamento':'Próximo avanço'}</small></div><span className="px-path-arrow" aria-hidden>→</span><div><h3>Primeiro nível libera</h3>{tech.unlocks.length?tech.unlocks.map(id=><p key={id}>{label(catalog,id)}</p>):<p>Melhoria contínua dos sistemas. Veja os efeitos abaixo.</p>}</div></section>;
}
