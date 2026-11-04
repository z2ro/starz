import type { Campaign } from '../../campaign/types';
import { NavLink } from 'react-router-dom';
import { Icon } from '../ui/Icon';
import type { View } from '../../types/game';
import type { IconName } from '../../visual/IconRegistry';

const views: Array<{ id: View; label: string; icon: IconName }> = [
  { id: 'overview', label: 'Visão geral', icon: 'overview' }, { id: 'planet', label: 'Planeta', icon: 'planet' },
  { id: 'economy', label: 'Economia', icon: 'economy' }, { id: 'research', label: 'Pesquisa', icon: 'research' },
  { id: 'shipyard', label: 'Estaleiro', icon: 'shipyard' }, { id: 'fleets', label: 'Frotas', icon: 'fleets' }, { id: 'galaxy', label: 'Galáxia', icon: 'galaxy' },
];

export function Sidebar({ state }: { state: { persistent?:boolean; campaign?: Campaign | null; system: { x: number; y: number; name: string } } }) {
  const persistentLinks = [
    ['/universe','Central','overview'],['/development','Construir','operations'],['/economy','Recursos','economy'],['/research','Tecnologias','research'],['/shipyard','Criar naves','shipyard'],['/fleets','Minhas frotas','fleets'],['/galaxy','Explorar mapa','galaxy'],['/missions','Enviar missão','fleets'],['/relations','Diplomacia','system'],['/planet','Planeta','planet'],['/overview','Império','overview'],
  ] as const;
  if(state.persistent)return <nav className="sidebar ux-sidebar" aria-label="Navegação principal"><div className="sidebar-label">SEUS OBJETIVOS</div><div className="nav-list">{persistentLinks.map(([path,title,icon])=><NavLink key={path} to={path} className={({isActive})=>`nav-item ${isActive?'selected':''}`}><span className="nav-mark"><Icon name={icon} className="ui-icon nav-icon"/></span><span>{title}</span></NavLink>)}</div><div className="sidebar-foot"><small>PLANETA ATUAL</small><strong>{state.system.x}:{state.system.y}</strong><span>{state.system.name}</span></div></nav>;
  return <nav className="sidebar" aria-label="Navegação principal"><div className="sidebar-label">IMPÉRIO</div><div className="nav-list">{state.persistent && <NavLink className="nav-item" to="/universe"><Icon name="overview" className="ui-icon nav-icon" /><span>Universo</span></NavLink>}{state.campaign && <NavLink className="nav-item" to="/campaign"><Icon name="overview" className="ui-icon nav-icon" /><span>Campanha</span></NavLink>}{views.map(view => <NavLink key={view.id} to={`/${view.id}`} className={({ isActive }) => `nav-item ${isActive ? 'selected' : ''}`}><span className="nav-mark"><Icon name={view.icon} className="ui-icon nav-icon" /></span><span>{view.label}</span></NavLink>)}</div><div className="sidebar-foot"><div className="sidebar-label">HOME SYSTEM</div><strong>{state.system.x}:{state.system.y}</strong><span>{state.system.name}</span><p>Build an empire.<br />Change the universe.</p><div className="sidebar-rule" /><b>STARZ</b><small>v0.1.0</small></div></nav>;
}
