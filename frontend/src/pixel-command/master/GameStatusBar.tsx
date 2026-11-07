import type {ReactNode} from 'react';
import {Link} from 'react-router-dom';
import type {State} from '../../types/game';
import {fmt} from '../../app/format';
import {PixelIcon} from '../PixelIcon';
export function GameStatusBar({state,onPlanet,limit,recommendation}:{state:State;onPlanet:(id:string)=>void;limit?:number;recommendation?:ReactNode}) {
 const worlds=state.planets??[],selected=worlds.find(p=>p.id===state.active_planet?.id)??worlds[0];
 return <footer className="game-status-bar"><div className="colony-count">Mundos do império<strong>{worlds.length} / {limit??'—'}</strong></div>{selected&&<label className="colony-selector"><PixelIcon name="planet"/><span><strong>{selected.name}</strong><small>{selected.x}:{selected.y} · {fmt(selected.population_total)}<span className="colony-unit-full"> habitantes</span><span className="colony-unit-short" aria-hidden="true"> hab.</span></small></span><select aria-label="Selecionar colônia" value={selected.id} onChange={e=>onPlanet(e.target.value)}>{worlds.map(w=><option key={w.id} value={w.id}>{w.name} · {w.x}:{w.y}</option>)}</select></label>}<div className="master-footer-actions"><Link to="/development?section=population" aria-label="Gerenciar população e trabalhadores"><PixelIcon name="people"/><span className="admin-label">Gerenciar população e trabalhadores</span><span className="admin-arrow" aria-hidden="true">→</span></Link>{recommendation}</div></footer>;
}
