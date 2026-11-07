import type {ReactNode} from 'react';
import {Link} from 'react-router-dom';
import type {State} from '../../types/game';
import {PixelIcon,type PixelIconName} from '../PixelIcon';
import {planetArtworkFor} from '../../visual/PlanetArtworkRegistry';
import {PixelButton} from './MasterUI';
const groupIcons:Record<string,PixelIconName>={'Visão geral':'overview',Planeta:'build',Tecnologia:'research',Espaço:'ship','Império':'empire'};
export function SidebarNavigation({state,name,groups,links,onMenu,menu,onLogout,error}:{state:State;name:string;groups:string[][];links:(path:string)=>ReactNode;onMenu:()=>void;menu:boolean;onLogout:()=>void;error:string}) {
 return <nav className="px-nav sidebar-navigation" aria-label="Navegação principal"><header className="civilization-header"><Link className="master-logo" to="/universe" aria-label="STARZ — Visão geral">STAR<span>Z</span></Link><div className="civilization-identity"><PixelIcon name="planet"/><div><span>CIVILIZAÇÃO</span><strong>{name}</strong><small><PixelIcon name="sector"/>SETOR {state.system.x}:{state.system.y}</small></div><img src={planetArtworkFor(state.system.planet).path} alt="" className="civilization-world"/></div></header><button className="px-nav-toggle" aria-expanded={menu} onClick={onMenu}><PixelIcon name="overview"/>Todos os setores</button><div className="px-nav-links">{groups.map(([label,...paths])=><section className="strategy-nav-group" key={label} aria-label={label}><h2><PixelIcon name={groupIcons[label]}/>{label}<span aria-hidden="true">⌄</span></h2>{paths.map(links)}</section>)}</div><div className="px-nav-foot"><div className="universe-status"><PixelIcon name="universe"/><div><strong>UNIVERSO PERSISTENTE</strong><span>Setor {state.system.x}:{state.system.y} · {state.planets?.length??1} mundo(s)</span></div></div><PixelButton onClick={onLogout}><PixelIcon name="logout"/>Sair da conta</PixelButton>{error&&<p role="alert">{error}</p>}</div></nav>;
}
