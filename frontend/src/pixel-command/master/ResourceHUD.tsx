import type {ReactNode} from 'react';
import type {Catalog,State} from '../../types/game';
import {fmt} from '../../app/format';
import {PixelIcon,resourcePixelIcons} from '../PixelIcon';
export function ResourceIndicator({id,name,value}:{id:string;name:string;value:number}) {
 const shortName=id==='fusion_fuel'?'Fusão':id==='ion_fuel'?'Iônico':undefined;
 return <div className={`resource-indicator resource-${id}`}><PixelIcon name={resourcePixelIcons[id]??(id==='energy'?'energy':'parts')}/><div><span className="resource-name"><span className="resource-full">{name}</span>{shortName&&<span className="resource-short" aria-hidden="true">{shortName}</span>}</span><strong>{fmt(value,1)}</strong></div></div>;
}
export function ResourceHUD({state,catalog,onPlanet,actions,onDetails,expanded}:{state:State;catalog:Catalog;onPlanet?:(id:string)=>void;actions:ReactNode;onDetails:()=>void;expanded:boolean}) {
 const order=['components','raw_ore','refined_alloy','volatiles','fusion_fuel','ion_fuel'];
 const selected=state.planets?.find(p=>p.id===state.active_planet?.id);
 const resources=[...catalog.resources,...catalog.fuels].filter(r=>r.id in state.stocks).sort((a,b)=>(order.indexOf(a.id)<0?order.length:order.indexOf(a.id))-(order.indexOf(b.id)<0?order.length:order.indexOf(b.id)));
 return <header className="resource-hud"><div className="resource-hud-controls"><LinkBrand/><label className="strategy-planet-picker"><span>Planeta atual</span><strong>{selected?.name??state.system.planet.name} {state.system.x}:{state.system.y}</strong><select aria-label="Planeta atual" value={state.active_planet?.id??''} disabled={!onPlanet} onChange={e=>onPlanet?.(e.target.value)}>{state.planets?.map(p=><option key={p.id} value={p.id}>{p.name} · {p.x}:{p.y}</option>)}</select></label>{actions}</div><section className="px-resources" aria-label={`Estoque local de ${state.system.planet.name}`} data-expanded={expanded}>{resources.map(r=><ResourceIndicator key={r.id} id={r.id} name={r.name} value={state.stocks[r.id]}/>)}<ResourceIndicator id="energy" name="Energia" value={state.capacities.energy_generation}/></section><button className="hud-details" aria-label="Produção e detalhes dos recursos" aria-expanded={expanded} onClick={onDetails}>Produção e detalhes dos recursos</button></header>;
}
function LinkBrand(){return <span className="master-mobile-brand" aria-label="STARZ">STAR<span>Z</span></span>;}
