import { NavLink } from 'react-router-dom';
import { Icon } from '../ui/Icon';
import type { View } from '../../types/game';
import type { IconName } from '../../visual/IconRegistry';

const views: Array<{ id: View; label: string; icon: IconName }> = [
  { id: 'overview', label: 'Visão geral', icon: 'overview' }, { id: 'planet', label: 'Planeta', icon: 'planet' },
  { id: 'economy', label: 'Economia', icon: 'economy' }, { id: 'research', label: 'Pesquisa', icon: 'research' },
  { id: 'shipyard', label: 'Estaleiro', icon: 'shipyard' }, { id: 'fleets', label: 'Frotas', icon: 'fleets' }, { id: 'galaxy', label: 'Galáxia', icon: 'galaxy' },
];

export function Sidebar({ state }: { state: { system: { x: number; y: number; name: string } } }) {
  return <nav className="sidebar" aria-label="Navegação principal"><div className="sidebar-label">IMPÉRIO</div><div className="nav-list">{views.map(view => <NavLink key={view.id} to={`/${view.id}`} className={({ isActive }) => `nav-item ${isActive ? 'selected' : ''}`}><span className="nav-mark"><Icon name={view.icon} className="ui-icon nav-icon" /></span><span>{view.label}</span></NavLink>)}</div><div className="sidebar-foot"><div className="sidebar-label">HOME SYSTEM</div><strong>{state.system.x}:{state.system.y}</strong><span>{state.system.name}</span><p>Build an empire.<br />Change the universe.</p><div className="sidebar-rule" /><b>STARZ</b><small>v0.1.0</small></div></nav>;
}
