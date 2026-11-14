import {useEffect,useState} from 'react';
import environment from '../../assets/buildings/living-colony/environment.png';
import civil from '../../assets/buildings/living-colony/civil_district.png';
import ferrite from '../../assets/buildings/living-colony/ferrite_extractor.png';
import refinery from '../../assets/buildings/living-colony/fuel_refinery.png';

const buildings = [
  {id:'civil_district', name:'Distrito civil', image:civil, x:51, y:44},
  {id:'ore_extractor', name:'Extrator de ferrita', image:ferrite, x:26.5, y:76.5},
  {id:'fuel_refinery', name:'Refinaria de combustível', image:refinery, x:76, y:70},
] as const;

export function LivingColonyScene({levels,onSelect}:{levels:Record<string,number>;onSelect:(id:string)=>void}) {
  const [visible,setVisible]=useState(!document.hidden);
  useEffect(()=>{const update=()=>setVisible(!document.hidden);document.addEventListener('visibilitychange',update);return()=>document.removeEventListener('visibilitychange',update);},[]);
  return <section className="living-colony" data-motion={visible?'active':'paused'} aria-label="Colônia em camadas">
    <div className="living-colony-stage">
      <div className="living-colony-background" style={{backgroundImage:`url(${environment})`}} aria-hidden="true"/>
      <div className="living-colony-terrain" aria-hidden="true"/>
      <div className="living-colony-buildings">{buildings.filter(b=>(levels[b.id]??0)>0).map(b=><button key={b.id} className="living-colony-building" style={{left:`${b.x}%`,top:`${b.y}%`}} onClick={()=>onSelect(b.id)} aria-label={`${b.name}, nível ${levels[b.id]} — inspecionar`}><b className={`living-colony-effects living-colony-effects-${b.id}`} aria-hidden="true"><i/><i/><i/></b><img src={b.image} alt=""/><span>{b.name} · Nv {levels[b.id]}</span></button>)}</div>
      <div className="living-colony-foreground" aria-hidden="true"/>
      <div className="living-colony-effects" aria-hidden="true"/>
    </div>
    <p className="living-colony-notice">Ambientação ilustrativa · selecione uma instalação para inspecionar.</p>
  </section>;
}
