import {ContentPages} from './ContentPages';
import {IntelligenceReport} from '../universe/IntelligenceReport';
import {BattleDetails} from '../universe/BattleDetails';
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
import {ViewportWorkspace} from './ViewportWorkspace';
import {WorkspaceDialog} from './WorkspaceDialog';
import './viewport-workspace.css';
import './compact-workspace.css';
import { Activities,activityJobs } from '../universe/ExperienceUI';

export const pixelDestinations: [string,string,PixelIconName][] = [
 ['/universe','Visão geral','command'],['/development','Instalações','build'],['/research','Pesquisa','research'],['/shipyard','Estaleiro','ship'],['/fleets','Frotas','ship'],['/galaxy','Galáxia','map'],['/economy','Produção','ore'],['/defenses','Defesas','shield'],['/relations','Diplomacia','people'],['/relations?tab=market','Mercado','alloy'],['/overview','Colônias','command'],
];
const resourceIcons: Record<string,PixelIconName>={raw_ore:'ore',volatiles:'fuel',refined_alloy:'alloy',components:'parts',ion_fuel:'fuel',fusion_fuel:'fuel'};
export function PixelShell({state,catalog,planetId,onPlanet,children}:{state:State;catalog:Catalog;planetId?:string;onPlanet?:(id:string)=>void;children:ReactNode}){
 const location=useLocation();const q=useUniverse(planetId);
 const [operations,setOperations]=useState(false),[help,setHelp]=useState(false),[records,setRecords]=useState(false),[menu,setMenu]=useState(false),[resourcesOpen,setResourcesOpen]=useState(false);
 const [logoutError,setLogoutError]=useState('');
 useEffect(()=>{setMenu(false);setOperations(false);setRecords(false);setResourcesOpen(false);setHelp(new URLSearchParams(location.search).get('guide')==='1');},[location.pathname,location.search,planetId]);
 const resources=[...catalog.resources,...catalog.fuels].filter(r=>r.id in state.stocks);
 const linkFor=(destination:typeof pixelDestinations[number])=>{const [path,title,icon]=destination;const [pathname,search]=path.split('?');const selected=location.pathname===pathname&&(pathname!=='/relations'||(new URLSearchParams(location.search).get('tab')??'diplomacy')===(new URLSearchParams(search).get('tab')??'diplomacy'));return <Link key={path} to={path} onClick={()=>setMenu(false)} aria-current={selected?'page':undefined}><PixelIcon name={icon}/><span>{title}</span></Link>;};
 const groups=[['Visão geral','/universe'],['Planeta','/development','/economy','/defenses'],['Tecnologia','/research'],['Espaço','/shipyard','/fleets','/galaxy'],['Império','/overview','/relations','/relations?tab=market']];
 async function logout(){try{await apiRequest('/api/auth/logout',{method:'POST'});window.location.reload();}catch(e){setLogoutError(e instanceof Error?e.message:'Não foi possível sair. Tente novamente.');}}
 return <PixelTheme.Provider value={true}><a href="#command-content" className="px-skip" onClick={e=>{e.preventDefault();document.getElementById('command-content')?.focus();}}>Ir para o conteúdo</a>
 <header className="px-masthead"><Link className="px-brand" to="/universe">STAR<span>Z</span><small>COMANDO IMPERIAL</small></Link><div className="px-identity"><small>CIVILIZAÇÃO</small><strong>{q.data?.name??'Sincronizando…'}</strong></div><label className="strategy-planet-picker">Planeta atual<select aria-label="Planeta atual" value={state.active_planet?.id??''} disabled={!onPlanet} onChange={e=>onPlanet?.(e.target.value)}>{state.planets?.map(p=><option key={p.id} value={p.id}>{p.name} · {p.x}:{p.y}</option>)}</select></label><div className="px-header-actions"><button aria-expanded={records} onClick={()=>setRecords(!records)}><PixelIcon name="log"/>Registros{state.notices.length>0&&<b>{state.notices.length}</b>}</button><button aria-expanded={help} onClick={()=>setHelp(!help)}><PixelIcon name="help"/>Ajuda</button></div></header>
 <section className="px-resources" data-expanded={resourcesOpen} aria-label={`Estoque local de ${state.system.planet.name}`}>{resources.map(r=><div className="px-resource" key={r.id}><PixelIcon name={resourceIcons[r.id]??'ore'}/><div><span>{r.name}</span><strong>{fmt(state.stocks[r.id],1)}</strong><small className="strategy-resource-rate">+{fmt(nominalRate(catalog,state,r.id),1)}/min nom.</small></div></div>)}<div className={`px-resource px-power ${state.capacities.energy_coverage<1?'px-warning':''}`}><PixelIcon name="energy"/><div><span>Energia</span><strong>{fmt(state.capacities.energy_generation)} <small>/ {fmt(state.capacities.energy_consumption)}</small></strong><small>{fmt(state.capacities.energy_coverage*100)}% da demanda</small></div></div></section>
 <button className="px-resource-toggle" aria-label="Produção e detalhes dos recursos" aria-expanded={resourcesOpen} onClick={()=>setResourcesOpen(!resourcesOpen)}>{resourcesOpen?'Recolher detalhes':'Produção e detalhes dos recursos'}<span className={`mobile-energy ${state.capacities.energy_coverage<1?'ux-warning':''}`}> · energia livre {fmt(state.capacities.energy_generation-state.capacities.energy_consumption)}</span></button>
 {resourcesOpen&&<WorkspaceDialog title="Produção e estoques locais" onClose={()=>setResourcesOpen(false)}><ContentPages label="Recursos locais">{resources.map(r=><p key={r.id}><b>{r.name}: {fmt(state.stocks[r.id],1)}</b> · +{fmt(nominalRate(catalog,state,r.id),1)}/min nominal</p>)}<p>Taxas antes de consumo, energia e trabalhadores. Energia: {fmt(state.capacities.energy_generation)} / {fmt(state.capacities.energy_consumption)} · cobertura {fmt(state.capacities.energy_coverage*100)}%.</p><Link to="/economy" onClick={()=>setResourcesOpen(false)}>Consultar produção efetiva e cadeia de recursos →</Link></ContentPages></WorkspaceDialog>}
 <div className="px-layout"><nav className="px-nav" aria-label="Navegação principal" data-open={false}><button className="px-nav-toggle" aria-expanded={menu} onClick={()=>setMenu(!menu)}><PixelIcon name="command"/>Todos os setores</button><small>SETORES DO IMPÉRIO</small><div className="px-nav-links">{groups.map(([name,...paths])=><section className="strategy-nav-group" key={name} aria-label={name}><h2>{name}</h2>{paths.map(path=>pixelDestinations.find(d=>d[0]===path)).filter((d):d is typeof pixelDestinations[number]=>!!d).map(linkFor)}</section>)}</div><div className="px-nav-foot">SETOR {state.system.x}:{state.system.y}<span>Universo persistente</span><button onClick={()=>void logout()}>Sair da conta</button>{logoutError&&<p role="alert">{logoutError}</p>}</div></nav>
 <main id="command-content" tabIndex={-1} className={`px-page px-page-${location.pathname.slice(1)}`}>
 {records&&<WorkspaceDialog title="Registros recentes" onClose={()=>setRecords(false)}><section className="px-records" aria-label="Registros recentes"><ContentPages label="Registros recentes"><Link className="button" to="/relations?tab=reports" onClick={()=>setRecords(false)}>Inteligência e batalhas →</Link>{q.data?.intelligence?.slice(0,3).map(r=><IntelligenceReport key={r.id} report={r} catalog={catalog}/>)}{q.data?.battles?.slice(0,3).map((b,i)=><BattleDetails key={i} battle={b} catalog={catalog}/>)}<h2>Diário de comando</h2><button onClick={()=>setRecords(false)}>Fechar registros</button>{state.notices.length?state.notices.map((n,i)=><p key={i}>{n}</p>):<p>Nenhum novo registro.</p>}</ContentPages></section></WorkspaceDialog>}
 {help&&<WorkspaceDialog title="Ajuda de comando" onClose={()=>setHelp(false)}><section className="px-panel px-help" aria-label="Ajuda de comando"><div className="px-panel-title"><h2>Manual de bordo</h2><button onClick={()=>setHelp(false)}>Fechar ajuda</button></div><p>Extraia recursos, processe materiais e invista em instalações, tecnologia e naves. Os estoques pertencem ao planeta selecionado. O universo continua enquanto você está offline.</p>{q.data&&<FirstSessionGuide state={state} empireId={q.data.empire_id}/>}</section></WorkspaceDialog>}
 {q.data&&<div className="viewport-return"><ReturnSummary key={q.data.empire_id} state={state} catalog={catalog} empireId={q.data.empire_id}/></div>}
 <div className="viewport-operations"><button aria-expanded={operations} onClick={()=>setOperations(!operations)}>Operações · {activityJobs(catalog,state).length} em andamento</button></div>{operations&&<WorkspaceDialog title="Operações em andamento" onClose={()=>setOperations(false)}><Activities state={state} catalog={catalog}/></WorkspaceDialog>}<ViewportWorkspace>{children}</ViewportWorkspace></main></div>
 {menu&&<WorkspaceDialog title="Setores do império" onClose={()=>setMenu(false)}><nav className="mobile-sector-links" aria-label="Navegação de setores"><ContentPages label="Setores do império">{groups.map(([name,...paths])=><section className="strategy-nav-group" key={name}><h2>{name}</h2>{paths.map(path=>pixelDestinations.find(d=>d[0]===path)).filter((d):d is typeof pixelDestinations[number]=>!!d).map(linkFor)}</section>)}</ContentPages></nav></WorkspaceDialog>}
 <nav className="px-mobile-dock" aria-label="Acesso rápido mobile">{pixelDestinations.filter(d=>['/universe','/development','/fleets','/galaxy'].includes(d[0])).map(([path,title,icon])=><NavLink key={path} to={path}><PixelIcon name={icon}/><span>{title}</span></NavLink>)}</nav>
 </PixelTheme.Provider>;
}
