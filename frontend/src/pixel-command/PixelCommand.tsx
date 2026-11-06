import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import type { ShellContext } from '../components/shell/AppShell';
import { PlanetProceduralView } from '../components/planet/PlanetProceduralView';
import { planetArtworkFor } from '../visual/PlanetArtworkRegistry';
import { fmt } from '../app/format';
import { useUniverse } from '../universe/useUniverse';
import { readLocal, writeLocal } from '../universe/experience';
import { PixelIcon } from './PixelIcon';

export function PixelCommand() {
 const {state,catalog,activePlanetId,setActivePlanetId,snapshotReady}=useOutletContext<ShellContext>();
 const q=useUniverse(activePlanetId);const [failed,setFailed]=useState(false),[imageMode,setImageMode]=useState(false),[suggestions,setSuggestions]=useState(true);
 const preference=`starz.suggestions.${q.data?.empire_id??''}`;
 useEffect(()=>{if(q.data)setSuggestions(readLocal(preference,true));},[preference,!!q.data]);
 const toggleSuggestions=(enabled:boolean)=>{setSuggestions(enabled);if(q.data)writeLocal(preference,enabled);};
 const p=state.system.planet,c=state.capacities;
 const mission=c.energy_coverage<1||c.workforce_coverage<1
 ? {title:'Restabeleça a produção',text:'Verifique energia e trabalhadores antes de expandir.',path:'/development',cta:'Desenvolver planeta'}
 : !state.research.active?{title:'Laboratório disponível',text:'O próximo nível de pesquisa pode melhorar a produção, as viagens ou a expansão.',path:'/research',cta:'Escolher pesquisa'}
 : !state.ships.length?{title:'Prepare a primeira exploradora',text:'Uma Horizon permite explorar os sistemas vizinhos.',path:'/shipyard',cta:'Abrir estaleiro'}
 : {title:'Novos destinos à vista',text:'Compare os sistemas conhecidos e planeje sua próxima missão.',path:'/galaxy',cta:'Explorar mapa'};
 return <div className="strategy-command">
 <header className="strategy-command-title"><h1>Centro de comando</h1><span>{q.data?.name??'Império'} · {state.planets?.length??1} mundo(s)</span></header>
 <section className="strategy-world" aria-label="Planeta atual">
 <div className="strategy-world-scene"><img src={planetArtworkFor(p).path} className="px-fallback" alt=""/>{!failed&&!imageMode&&<PlanetProceduralView state={state} catalog={catalog} snapshotReady={snapshotReady??true} onReady={()=>undefined} onFailure={()=>setFailed(true)}/>}</div>
 <header className="strategy-world-identity"><span className="px-kicker">{state.active_planet?.home?'MUNDO NATAL':'COLÔNIA'} · {state.system.x}:{state.system.y}</span><h2>{p.name}</h2><span>{state.system.name} · planeta {(state.active_planet?.planet_index??0)+1}</span></header>
 <div className="strategy-world-dossier" aria-label="Situação do planeta">
 <h3>Desenvolvimento planetário</h3><dl>
 <div><dt><PixelIcon name="people"/>População</dt><dd>{fmt(state.population.total)} <small>/ {fmt(state.population.capacity)}</small></dd></div>
 <div className={c.energy_coverage<1?'ux-warning':''}><dt><PixelIcon name="energy"/>Energia livre</dt><dd>{fmt(c.energy_generation-c.energy_consumption)} <small>{c.energy_coverage<1?'Déficit':'de margem'}</small></dd></div>
 <div className={c.workforce_coverage<1?'ux-warning':''}><dt>Trabalhadores</dt><dd>{fmt(c.workforce_supply)} / {fmt(c.workforce_demand)}<small> oferta / demanda</small></dd></div>
 <div><dt>Construção</dt><dd>{c.construction_slots_available} / {c.construction_slots}<small> vagas livres</small></dd></div>
 <div><dt>Estaleiro</dt><dd>{c.shipyard_slots_available} / {c.shipyard_slots}<small> vagas livres</small></dd></div>
 </dl><div className="strategy-physical"><span>{fmt(p.temperature)} K</span><span>{fmt(p.gravity,2)} g</span><span>{fmt(p.water,1)}% água</span></div>
 <nav aria-label="Ordens rápidas"><Link className="px-button px-primary" to="/development"><PixelIcon name="build"/>Instalações</Link><Link to="/research"><PixelIcon name="research"/>Pesquisa</Link><Link to="/shipyard"><PixelIcon name="ship"/>Estaleiro</Link><Link to="/galaxy"><PixelIcon name="map"/>Exploração</Link></nav>
 <Link to="/planet" className="strategy-admin">Administrar planeta e consultar características →</Link>
 </div><div className="strategy-world-modes"><button aria-pressed={!imageMode&&!failed} disabled={failed} onClick={()=>setImageMode(false)}>Procedural</button><button aria-pressed={imageMode||failed} onClick={()=>setImageMode(true)}>Imagem</button></div>
 </section>{failed&&<p role="status">Visualização procedural indisponível. Imagem de referência ativa.</p>}
 <div className="strategy-worlds"><span>Mundos do império <b>{state.planets?.length??1} / {q.data?.colony_limit??'—'}</b></span>{state.planets?.map(world=><button key={world.id} aria-pressed={world.id===state.active_planet?.id} onClick={()=>setActivePlanetId(world.id)}><PixelIcon name="planet"/><span>{world.name}<small>{world.x}:{world.y} · {fmt(world.population_total)} habitantes</small></span></button>)}<Link to="/overview">Administrar colônias →</Link></div>
 {suggestions?<aside className="strategy-transmission" aria-label="Missão recomendada"><details><summary><PixelIcon name="log"/>Transmissão · {mission.title}</summary><p>{mission.text} <Link to={mission.path}>{mission.cta} →</Link></p><button onClick={()=>toggleSuggestions(false)}>Ocultar recomendações</button></details></aside>:<button className="strategy-restore" onClick={()=>toggleSuggestions(true)}>Ativar recomendações contextuais</button>}
 </div>;
}
