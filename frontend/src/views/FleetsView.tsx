import { useOutletContext } from 'react-router-dom';
import { Panel } from '../components/ui/Panel';
import { Badge } from '../components/ui/Badge';
import { duration, label } from '../app/format';
import type { ShellContext } from '../components/shell/AppShell';

export function FleetsView() {
  const { catalog, state } = useOutletContext<ShellContext>();
  return <><header className="page-header"><div><div className="eyebrow">ORBITAL OPERATIONS</div><h1>Frotas</h1><p>Posição operacional, missão e tempo estimado.</p></div></header><div className="fleet-list">{state.fleets.length ? state.fleets.map(fleet => <Panel title={fleet.name} eyebrow={fleet.status === 'ARRIVED' ? 'READY' : 'TRANSIT'} key={fleet.id}><div className="metric-line"><span>Status</span><Badge tone={fleet.status === 'ARRIVED' ? 'good' : 'blue'}>{fleet.status}</Badge></div><div className="metric-line"><span>Posição</span><b>{fleet.x}:{fleet.y}</b></div><div className="metric-line"><span>Missão</span><b>{fleet.mission}</b></div><div className="metric-line"><span>Propulsão</span><b>{label(catalog, fleet.propulsion)}</b></div><div className="metric-line"><span>ETA</span><b>{fleet.status === 'TRANSIT' ? duration(fleet.eta) : 'Chegada'}</b></div><small>{fleet.ship_ids.length} nave(s) · modo {fleet.mode}</small></Panel>) : <Panel title="Nenhuma frota"><p>Construa uma nave no Estaleiro para criar sua primeira frota.</p></Panel>}</div></>;
}
