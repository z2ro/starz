import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import type { ShellContext } from '../components/shell/AppShell';
import { PlanetProceduralView } from '../components/planet/PlanetProceduralView';
import { planetArtworkFor } from '../visual/PlanetArtworkRegistry';
import { fmt } from '../app/format';
import { pixelDestinations } from './PixelShell';
import { Activities } from '../universe/ExperienceUI';
import { useUniverse } from '../universe/useUniverse';
import { PixelIcon } from './PixelIcon';
import './pixel-command.css';

export function PixelCommand() {
  const {state,catalog,activePlanetId,setActivePlanetId,snapshotReady}=useOutletContext<ShellContext>();
  const q=useUniverse(activePlanetId);
  const [failed,setFailed]=useState(false);
  const [imageMode,setImageMode]=useState(false);
  const energy=state.capacities.energy_coverage;
  const workforce=state.capacities.workforce_coverage;
  const mission=energy<1||workforce<1
    ? {title:'Restabeleça a produção',text:'Seu planeta precisa de energia ou trabalhadores. Resolva a capacidade antes de expandir.',path:'/development',cta:'Desenvolver planeta',icon:'energy' as const}
    : !state.research.active
    ? {title:'Dê o próximo salto tecnológico',text:'O laboratório está livre. Escolha uma melhoria e mantenha sua civilização avançando.',path:'/research',cta:'Escolher pesquisa',icon:'research' as const}
    : !state.ships.length
    ? {title:'Prepare a primeira exploradora',text:'Construa uma Horizon para conhecer os recursos e mundos dos sistemas vizinhos.',path:'/shipyard',cta:'Abrir estaleiro',icon:'ship' as const}
    : {title:'Há um universo além da órbita',text:'Escolha um destino e confira as naves, o combustível e a duração antes de enviar uma missão.',path:'/galaxy',cta:'Explorar mapa',icon:'map' as const};
  return <div className="px-workspace">
      <div className="px-command-title"><div><span className="px-kicker">PONTE DE COMANDO</span><h1>Centro de comando</h1></div><label>Planeta atual<select value={state.active_planet?.id??''} onChange={e=>setActivePlanetId(e.target.value)}>{state.planets?.map(p=><option key={p.id} value={p.id}>{p.name} · {p.x}:{p.y}</option>)}</select></label></div>
      <div className="px-command-grid">
        <section className="px-panel px-world" aria-label="Planeta atual"><div className="px-panel-title"><span><PixelIcon name="planet"/> {state.system.planet.name}</span><span className="px-coordinate">{state.system.x}:{state.system.y}</span></div>
          <div className="px-viewport"><img src={planetArtworkFor(state.system.planet).path} className="px-fallback" alt=""/>{!failed&&!imageMode&&<PlanetProceduralView state={state} catalog={catalog} snapshotReady={snapshotReady??true} onReady={()=>undefined} onFailure={()=>setFailed(true)}/>}<div className="px-planet-label"><small>{state.system.name}</small><strong>{state.active_planet?.home?'MUNDO NATAL':'COLÔNIA'}</strong></div><div className="px-mode"><button aria-pressed={!imageMode&&!failed} disabled={failed} onClick={()=>setImageMode(false)}>Procedural</button><button aria-pressed={imageMode||failed} onClick={()=>setImageMode(true)}>Imagem</button></div></div>
          <div className="px-world-footer"><span><PixelIcon name="people"/><b>{fmt(state.population.total)}</b> habitantes</span><Link to="/planet">Inspecionar planeta →</Link></div>{failed&&<p role="status">Visualização procedural indisponível. Imagem de referência ativa.</p>}
        </section>
        <aside className="px-panel px-status" aria-label="Situação do planeta"><div className="px-panel-title"><h2>Suporte planetário</h2></div><div className="px-instrument"><PixelIcon name="energy"/><div><span>Rede de energia</span><b>{energy>=1?'Demanda atendida':'Capacidade insuficiente'}</b><meter min={0} max={1} value={Math.min(1,energy)} aria-label="Cobertura de energia"/><small>{fmt(state.capacities.energy_generation-state.capacities.energy_consumption)} de margem</small></div></div><div className="px-instrument"><PixelIcon name="people"/><div><span>Força de trabalho</span><b>{fmt(state.capacities.workforce_supply)} / {fmt(state.capacities.workforce_demand)}</b><meter min={0} max={1} value={Math.min(1,workforce)} aria-label="Cobertura de trabalhadores"/><small>Disponível / demanda</small></div></div><dl className="px-capacities"><div><dt>Vagas de construção</dt><dd>{state.capacities.construction_slots_available}</dd></div><div><dt>Vagas no estaleiro</dt><dd>{state.capacities.shipyard_slots_available}</dd></div><div><dt>Mundos colonizados</dt><dd>{state.planets?.length??'—'} / {q.data?.colony_limit??'—'}</dd></div></dl><Link className="px-button" to="/development">Desenvolver planeta</Link></aside>
        <section className="px-panel px-orders"><Activities state={state} catalog={catalog}/><div className="px-orders-note"><PixelIcon name="log"/><span>Construção, pesquisa e viagens continuam enquanto você está offline.</span></div></section>
      </div>
      <section className="px-mission" aria-label="Missão recomendada"><div className="px-mission-emblem"><PixelIcon name={mission.icon}/></div><div><span className="px-kicker">TRANSMISSÃO · PRÓXIMO PASSO</span><h2>{mission.title}</h2><p>{mission.text}</p></div><Link className="px-button px-primary" to={mission.path}>{mission.cta} →</Link></section>
      <nav className="px-shortcuts" aria-label="Ordens rápidas">{pixelDestinations.filter(d=>['/development','/research','/shipyard','/galaxy'].includes(d[0])).map(([path,title,icon],i)=><Link to={path} key={path}><span className="px-shortcut-number">0{i+1}</span><PixelIcon name={icon}/><span>{title}</span><b aria-hidden>→</b></Link>)}</nav>
      <footer className="px-bottom"><span>ESTOQUES LOCAIS · {state.system.planet.name}</span><details className="px-tooltip"><summary>Como ler as taxas?</summary><p>Produção nominal declarada pelas instalações, antes de limitações de energia, trabalhadores ou insumos. Consulte <Link to="/economy">Recursos</Link> para ver o processamento e o consumo.</p></details><Link to="/economy">Abrir rede de recursos</Link></footer>
  </div>;
}
