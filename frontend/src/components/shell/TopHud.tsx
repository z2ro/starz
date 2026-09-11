import { Icon } from '../ui/Icon';
import { resourceIcon } from '../../visual/IconRegistry';
import { fmt, nominalRate, strategicResources, label } from '../../app/format';
import type { Catalog, State } from '../../types/game';

export function TopHud({ catalog, state, noticeOpen, settingsOpen, onNotice, onSettings }: { catalog: Catalog; state: State; noticeOpen: boolean; settingsOpen: boolean; onNotice: () => void; onSettings: () => void }) {
  const resources = strategicResources(catalog, state);
  const margin = state.capacities.energy_generation - state.capacities.energy_consumption;
  const research = state.research.active ? label(catalog, state.research.active) : 'Inativa';
  return <header className="top-hud">
    <a className="brand" href="#/overview" aria-label="StarZ início"><span>STARZ</span><small>COMMAND</small></a>
    <div className="hud-resources">{resources.map((item, index) => { const resource = resourceIcon(item.id); return <div className="metric" key={item.id}><span className={`metric-icon ${['pink', 'mint', 'green', 'amber'][index % 4]}`}>{resource && <Icon name={resource} className="ui-icon metric-pictogram" />}</span><div><span className="metric-label">{item.name}</span><div className="metric-value">{fmt(state.stocks[item.id], 1)}</div><span className="metric-detail">{nominalRate(catalog, state, item.id) > 0 ? `+${fmt(nominalRate(catalog, state, item.id) * 60, 1)}/h` : 'estoque local'}</span></div></div>; })}</div>
    <div className="metric energy-metric" data-energy-coverage={state.capacities.energy_coverage} data-energy-state={margin >= 0 ? 'stable' : 'warning'}><span className="metric-icon amber"><Icon name="energy" className="ui-icon metric-pictogram" /></span><div><span className="metric-label">ENERGIA</span><div className="metric-value">{fmt(state.capacities.energy_generation)} / {fmt(state.capacities.energy_consumption)}</div><span className={`metric-detail ${margin < 0 ? 'warning-text' : ''}`}>{margin >= 0 ? '+' : ''}{fmt(margin)} margem</span></div></div>
    <div className="hud-quick"><div><Icon name="population" className="ui-icon hud-quick-icon" /><span className="metric-label">POPULAÇÃO</span><strong>{fmt(state.population.total)}</strong><small>{fmt(state.population.available)} livre</small></div><div><Icon name="research" className="ui-icon hud-quick-icon" /><span className="metric-label">PESQUISA</span><strong>{research}</strong><small>{state.research.active ? 'programa ativo' : 'sem programa ativo'}</small></div><div><Icon name="fleets" className="ui-icon hud-quick-icon" /><span className="metric-label">FROTAS</span><strong>{fmt(state.fleets.length)}</strong><small>{fmt(state.fleets.filter(fleet => fleet.status === 'ARRIVED').length)} estacionada(s)</small></div></div>
    <div className="system-status"><Icon name="system" className="ui-icon system-pictogram" /><span>SYSTEM</span><small>{state.system.name} · {state.system.x}:{state.system.y}</small></div>
    <button className="icon-button" data-action="notice" aria-label="Abrir registros" onClick={onNotice}><Icon name="notifications" className="ui-icon button-pictogram" />{state.notices.length > 0 && <span className="notice-badge" aria-hidden="true" />}</button>
    <div className="settings-wrap"><button className="icon-button" data-action="settings" aria-label="Abrir configurações" onClick={onSettings}><Icon name="settings" className="ui-icon button-pictogram" /></button>{settingsOpen && <div className="settings-popover"><span>Interface</span><strong>Modo estratégico</strong><small>Dados sincronizados da API · atualização automática ativa.</small></div>}</div>
    {noticeOpen && <div className="notice-popover"><div className="context-heading"><span>REGISTRO RECENTE</span><b>{state.notices.length}</b></div>{state.notices.length ? state.notices.map(message => <div className="notice" key={message}><i /><span>{message}</span></div>) : <span className="muted">Sem novos registros.</span>}</div>}
  </header>;
}
