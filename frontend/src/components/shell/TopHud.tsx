import { resourceIcon } from '../../visual/IconRegistry';
import { fmt, nominalRate, strategicResources, label } from '../../app/format';
import type { Catalog, State } from '../../types/game';
import { HUDMetric } from '../ui/HUDMetric';
import { IconButton } from '../ui/IconButton';

export function TopHud({ catalog, state, noticeOpen, settingsOpen, onNotice, onSettings }: { catalog: Catalog; state: State; noticeOpen: boolean; settingsOpen: boolean; onNotice: () => void; onSettings: () => void }) {
  const resources = strategicResources(catalog, state);
  const margin = state.capacities.energy_generation - state.capacities.energy_consumption;
  const research = state.research.active ? label(catalog, state.research.active) : 'Inativa';
  return <header className="top-hud">
    <a className="brand" href="#/overview" aria-label="StarZ início"><span>STARZ</span><small>IMPERIAL COMMAND</small></a>
    <div className="hud-metrics">{resources.map(item => { const rate = nominalRate(catalog, state, item.id); return <HUDMetric key={item.id} icon={resourceIcon(item.id)} label={item.name} value={fmt(state.stocks[item.id], 1)} detail={rate > 0 ? `+${fmt(rate * 60, 1)}/h nom.` : 'estoque local'} tone="default" />; })}</div>
    <HUDMetric icon="energy" label="Energia" value={`${fmt(state.capacities.energy_generation)} / ${fmt(state.capacities.energy_consumption)}`} detail={`${margin >= 0 ? '+' : ''}${fmt(margin)} margem`} tone={margin >= 0 ? 'positive' : 'warning'} />
    <div className="hud-quick"><HUDMetric icon="population" label="População" value={fmt(state.population.total)} detail={`${fmt(state.population.available)} livre`} /><HUDMetric icon="research" label="Pesquisa" value={research} detail={state.research.active ? 'programa ativo' : 'sem programa ativo'} tone={state.research.active ? 'research' : 'default'} /><HUDMetric icon="fleets" label="Frotas" value={fmt(state.fleets.length)} detail={`${fmt(state.fleets.filter(fleet => fleet.status === 'ARRIVED').length)} estacionada(s)`} /></div>
    <HUDMetric icon="system" label="Sistema" value={state.system.name} detail={`${state.system.x}:${state.system.y}`} />
    <div className="hud-actions"><IconButton icon="notifications" label="Abrir registros" data-action="notice" onClick={onNotice} />{state.notices.length > 0 && <span className="notice-badge" aria-hidden="true" />}<div className="settings-wrap"><IconButton icon="settings" label="Abrir configurações" data-action="settings" onClick={onSettings} />{settingsOpen && <div className="settings-popover"><span>Interface</span><strong>Modo estratégico</strong><small>Dados sincronizados da API · atualização automática ativa.</small></div>}</div></div>
    {noticeOpen && <div className="notice-popover"><div className="context-heading"><span>REGISTRO RECENTE</span><b>{state.notices.length}</b></div>{state.notices.length ? state.notices.map(message => <div className="notice" key={message}><i /><span>{message}</span></div>) : <span className="muted">Sem novos registros.</span>}</div>}
  </header>;
}
