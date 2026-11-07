import {WorkspaceDialog} from './WorkspaceDialog';
import {PixelPanel,PixelButton,WorkspaceHeader} from './master/MasterUI';
import {PlanetaryStatus} from './master/PlanetaryStatus';
import {GameStatusBar} from './master/GameStatusBar';
import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import type { ShellContext } from '../components/shell/AppShell';
import { PlanetProceduralView } from '../components/planet/PlanetProceduralView';
import { planetArtworkFor } from '../visual/PlanetArtworkRegistry';
import { useUniverse } from '../universe/useUniverse';
import { readLocal, writeLocal } from '../universe/experience';
import { PixelIcon } from './PixelIcon';

export function PixelCommand() {
 const {state,catalog,activePlanetId,setActivePlanetId,snapshotReady}=useOutletContext<ShellContext>();
 const q=useUniverse(activePlanetId);const [failed,setFailed]=useState(false),[imageMode,setImageMode]=useState(false),[suggestions,setSuggestions]=useState(true),[situation,setSituation]=useState(false);
 const preference=`starz.suggestions.${q.data?.empire_id??''}`;
 useEffect(()=>{if(q.data)setSuggestions(readLocal(preference,true));},[preference,!!q.data]);
 const toggleSuggestions=(enabled:boolean)=>{setSuggestions(enabled);if(q.data)writeLocal(preference,enabled);};
 useEffect(()=>setSituation(false),[activePlanetId]);
 const p=state.system.planet,c=state.capacities;
 const mission=c.energy_coverage<1||c.workforce_coverage<1
 ? {title:'Restabeleça a produção',text:'Verifique energia e trabalhadores antes de expandir.',path:'/development',cta:'Desenvolver planeta'}
 : !state.research.active?{title:'Laboratório disponível',text:'O próximo nível de pesquisa pode melhorar a produção, as viagens ou a expansão.',path:'/research',cta:'Escolher pesquisa'}
 : !state.ships.length?{title:'Prepare a primeira exploradora',text:'Uma Horizon permite explorar os sistemas vizinhos.',path:'/shipyard',cta:'Abrir estaleiro'}
 : {title:'Novos destinos à vista',text:'Compare os sistemas conhecidos e planeje sua próxima missão.',path:'/galaxy',cta:'Explorar mapa'};
 return <div className="strategy-command master-overview">
 <WorkspaceHeader title="Visão geral" icon="planet"/>
 <PixelPanel className="strategy-world master-planet-hero" label="Planeta atual">
 <div className="strategy-world-scene" data-visual-mode={!failed&&!imageMode?'procedural':'image'}><img src={planetArtworkFor(p).path} className="px-fallback" alt=""/>{!failed&&!imageMode&&<PlanetProceduralView state={state} catalog={catalog} snapshotReady={snapshotReady??true} orbitGuide onReady={()=>undefined} onFailure={()=>setFailed(true)}/>}</div>
 <header className="strategy-world-identity"><span className="px-kicker">{state.active_planet?.home?'MUNDO NATAL':'COLÔNIA'} · {state.system.x}:{state.system.y}</span><h2>{p.name}</h2><span>{state.system.name} · planeta {(state.active_planet?.planet_index??0)+1}</span></header>
 <PlanetaryStatus state={state}/>
 <button className="short-situation" onClick={()=>setSituation(true)}>Abrir situação do planeta em tela cheia →</button>{situation&&<WorkspaceDialog title={p.name} onClose={()=>setSituation(false)}><PlanetaryStatus state={state}/></WorkspaceDialog>}
 <div className="strategy-world-modes"><PixelButton aria-pressed={!imageMode&&!failed} disabled={failed} onClick={()=>setImageMode(false)}>Procedural</PixelButton><PixelButton aria-pressed={imageMode||failed} onClick={()=>setImageMode(true)}>Imagem</PixelButton></div>
 {failed&&<p className="master-render-failure" role="status">Visualização procedural indisponível. Imagem de referência ativa.</p>}
 </PixelPanel>
 <GameStatusBar state={state} onPlanet={setActivePlanetId} limit={q.data?.colony_limit} recommendation={suggestions?<aside className="strategy-transmission" aria-label="Missão recomendada"><details><summary aria-label={`Transmissão · ${mission.title}`}><PixelIcon name="log"/><span className="transmission-label">Transmissão · {mission.title}</span></summary><p>{mission.text} <Link to={mission.path}>{mission.cta} →</Link></p><button onClick={()=>toggleSuggestions(false)}>Ocultar recomendações</button></details></aside>:<button className="strategy-restore" onClick={()=>toggleSuggestions(true)}>Ativar recomendações contextuais</button>}/>
 </div>;
}
