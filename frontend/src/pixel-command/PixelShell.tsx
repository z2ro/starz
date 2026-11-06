import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import type { Catalog, State } from '../types/game';
import { fmt, nominalRate } from '../app/format';
import { apiRequest } from '../api/client';
import { useUniverse } from '../universe/useUniverse';
import { FirstSessionGuide } from '../universe/FirstSessionGuide';
import { ReturnSummary } from '../universe/ReturnSummary';
import { PixelIcon, PixelTheme, type PixelIconName } from './PixelIcon';
import './pixel-command.css';
import './pixel-game.css';
import './strategy-experience.css';
import { Activities } from '../universe/ExperienceUI';

export const pixelDestinations: [string,string,PixelIconName][] = [
 ['/universe','Comando','command'],['/development','Construção','build'],['/research','Pesquisa','research'],['/shipyard','Estaleiro','ship'],['/fleets','Frotas','ship'],['/galaxy','Mapa estelar','map'],['/economy','Recursos','ore'],['/missions','Enviar missão','map'],['/relations','Diplomacia','people'],['/relations?tab=market','Mercado','alloy'],['/planet','Administração','planet'],['/overview','Colônias','command'],
];
const resourceIcons: Record<string,PixelIconName>={raw_ore:'ore',volatiles:'fuel',refined_alloy:'alloy',components:'parts',ion_fuel:'fuel',fusion_fuel:'fuel'};
export function PixelShell({state,catalog,planetId,onPlanet,children}:{state:State;catalog:Catalog;planetId?:string;onPlanet?:(id:string)=>void;children:ReactNode}){
 const location=useLocation();const q=useUniverse(planetId);
 const [help,setHelp]=useState(false),[records,setRecords]=useState(false),[menu,setMenu]=useState(false),[resourcesOpen,setResourcesOpen]=useState(false);
 const [logoutError,setLogoutError]=useState('');
 useEffect(()=>{setMenu(false);if(new URLSearchParams(location.search).get('guide')==='1')setHelp(true);},[location.pathname,location.search]);
 const resources=[...catalog.resources,...catalog.fuels].filter(r=>r.id in state.stocks);
 const linkFor=(destination:typeof pixelDestinations[number])=>{const [path,title,icon]=destination;const [pathname,search]=path.split('?');const selected=location.pathname===pathname&&(pathname!=='/relations'||(new URLSearchParams(location.search).get('tab')??'diplomacy')===(new URLSearchParams(search).get('tab')??'diplomacy'));return <Link key={path} to={path} aria-current={selected?'page':undefined}><PixelIcon name={icon}/><span>{title}</span></Link>;};
 const groups=[['Planeta','/universe','/development','/economy','/planet'],['Tecnologia','/research'],['Espaço','/shipyard','/fleets','/galaxy','/missions'],['Império','/overview','/relations','/relations?tab=market']];
 async function logout(){try{await apiRequest('/api/auth/logout',{method:'POST'});window.location.reload();}catch(e){setLogoutError(e instanceof Error?e.message:'Não foi possível sair. Tente novamente.');}}
 return <PixelTheme.Provider value={true}><a href="#command-content" className="px-skip" onClick={e=>{e.preventDefault();document.getElementById('command-content')?.focus();}}>Ir para o conteúdo</a>
 <header className="px-masthead"><Link className="px-brand" to="/universe">STAR<span>Z</span><small>COMANDO IMPERIAL</small></Link><div className="px-identity"><small>CIVILIZAÇÃO</small><strong>{q.data?.name??'Sincronizando…'}</strong></div><label className="strategy-planet-picker">Planeta atual<select aria-label="Planeta atual" value={state.active_planet?.id??''} disabled={!onPlanet} onChange={e=>onPlanet?.(e.target.value)}>{state.planets?.map(p=><option key={p.id} value={p.id}>{p.name} · {p.x}:{p.y}</option>)}</select></label><div className="px-header-actions"><button aria-expanded={records} onClick={()=>setRecords(!records)}><PixelIcon name="log"/>Registros{state.notices.length>0&&<b>{state.notices.length}</b>}</button><button aria-expanded={help} onClick={()=>setHelp(!help)}><PixelIcon name="help"/>Ajuda</button></div></header>
 <section className="px-resources" data-expanded={resourcesOpen} aria-label={`Estoque local de ${state.system.planet.name}`}>{resources.map(r=><div className="px-resource" key={r.id}><PixelIcon name={resourceIcons[r.id]??'ore'}/><div><span>{r.name}</span><strong>{fmt(state.stocks[r.id],1)}</strong><small className="strategy-resource-rate">+{fmt(nominalRate(catalog,state,r.id),1)}/min nom.</small></div></div>)}<div className={`px-resource px-power ${state.capacities.energy_coverage<1?'px-warning':''}`}><PixelIcon name="energy"/><div><span>Energia</span><strong>{fmt(state.capacities.energy_generation)} <small>/ {fmt(state.capacities.energy_consumption)}</small></strong><small>{fmt(state.capacities.energy_coverage*100)}% da demanda</small></div></div></section>
 <button className="px-resource-toggle" aria-expanded={resourcesOpen} onClick={()=>setResourcesOpen(!resourcesOpen)}>{resourcesOpen?'Recolher detalhes':'Produção e detalhes dos recursos'} · {state.system.planet.name}</button>
 {resourcesOpen&&<p className="strategy-resource-help">Taxas nominais das instalações, antes de consumo, energia e trabalhadores. <Link to="/economy">Consultar produção efetiva e cadeia de recursos →</Link></p>}
 <div className="px-layout"><nav className="px-nav" aria-label="Navegação principal" data-open={menu}><button className="px-nav-toggle" aria-expanded={menu} onClick={()=>setMenu(!menu)}><PixelIcon name="command"/>Todos os setores</button><small>SETORES DO IMPÉRIO</small><div className="px-nav-links">{groups.map(([name,...paths])=><section className="strategy-nav-group" key={name} aria-label={name}><h2>{name}</h2>{paths.map(path=>pixelDestinations.find(d=>d[0]===path)).filter((d):d is typeof pixelDestinations[number]=>!!d).map(linkFor)}</section>)}</div><div className="px-nav-foot">SETOR {state.system.x}:{state.system.y}<span>Universo persistente</span><button onClick={()=>void logout()}>Sair da conta</button>{logoutError&&<p role="alert">{logoutError}</p>}</div></nav>
 <main id="command-content" tabIndex={-1} className={`px-page px-page-${location.pathname.slice(1)}`}>
 {records&&<section className="px-panel px-records" aria-label="Registros recentes"><div className="px-panel-title"><h2>Diário de comando</h2><button onClick={()=>setRecords(false)}>Fechar registros</button></div>{state.notices.length?state.notices.map((n,i)=><p key={i}>{n}</p>):<p>Nenhum novo registro.</p>}</section>}
 {help&&<section className="px-panel px-help" aria-label="Ajuda de comando"><div className="px-panel-title"><h2>Manual de bordo</h2><button onClick={()=>setHelp(false)}>Fechar ajuda</button></div><p>Extraia recursos, processe materiais e invista em instalações, tecnologia e naves. Os estoques pertencem ao planeta selecionado. O universo continua enquanto você está offline.</p>{q.data&&<FirstSessionGuide state={state} empireId={q.data.empire_id}/>}</section>}
 {q.data&&<ReturnSummary key={q.data.empire_id} state={state} catalog={catalog} empireId={q.data.empire_id}/>}
 <Activities state={state} catalog={catalog} compact/>{children}</main></div>
 <nav className="px-mobile-dock" aria-label="Acesso rápido mobile">{pixelDestinations.filter(d=>['/universe','/development','/fleets','/galaxy'].includes(d[0])).map(([path,title,icon])=><NavLink key={path} to={path}><PixelIcon name={icon}/><span>{title}</span></NavLink>)}</nav>
 </PixelTheme.Provider>;
}
