import { Link } from 'react-router-dom';
import type { Campaign } from './types';
import './campaign.css';
export function CampaignStrip({ campaign: c, busy, end }: { campaign: Campaign; busy: boolean; end: () => void }) {
  return <div className="campaign-strip"><Link to="/campaign">CONCORDAT</Link><span>Turno {c.turn}/{c.deadline}</span><span>{c.orders} ordens</span><span>Homeworld {c.integrity}%</span>{c.event && <Link to="/campaign">DECISÃO PENDENTE</Link>}{c.phase !== 'PLAYING' ? <Link to="/campaign">{c.phase === 'VICTORY' ? 'VITÓRIA' : 'DERROTA'}</Link> : <button disabled={busy || !!c.event} onClick={end}>Encerrar turno · +5min</button>}</div>;
}
