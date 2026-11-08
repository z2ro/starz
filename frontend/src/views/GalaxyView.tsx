import {PlanetStatus,SystemIdentity} from '../galaxy/PlanetStatus';
import {planetIdentity,knownPlanetValue} from '../galaxy/planetIdentity';
import {WorkspaceDialog} from '../pixel-command/WorkspaceDialog';
import {Costs} from '../universe/ExperienceUI';
import {WorkspaceHeader, PixelButton, PixelTabs} from '../pixel-command/master/MasterUI';
import {ContentPages} from '../pixel-command/ContentPages';
import {useUniverse} from '../universe/useUniverse';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useGalaxyQuery } from '../api/queries';
import { Badge } from '../components/ui/Badge';
import { duration, fmt, term, remaining, formatTemperatureKelvin } from '../app/format';
import type { ShellContext } from '../components/shell/AppShell';
import type { GalaxySystem as System, TravelPreview } from '../types/game';
import { SpatialGalaxyMap } from '../galaxy/SpatialGalaxyMap';
import { OrbitalSystemScene } from '../galaxy/OrbitalSystemScene';
import { authorizedSystem, fleetComposition, systemKey, galaxyCenter } from '../galaxy/galaxyPresentation';
import '../galaxy/galaxy.css';

export function GalaxyView() {
  const { state, catalog, execute, setActivePlanetId } = useOutletContext<ShellContext>();
  const [center, setCenter] = useState<[number, number] | undefined>();
  const queryCenter = galaxyCenter(state, center);
  const galaxyQuery = useGalaxyQuery(queryCenter), galaxy = galaxyQuery.data;
  useEffect(() => { if(center && (!queryCenter || center[0] !== queryCenter[0] || center[1] !== queryCenter[1]))setCenter(undefined); }, [center,queryCenter?.[0],queryCenter?.[1]]);
  const [selectedId, setSelectedId] = useState<string>();
  const [level, setLevel] = useState<'galaxy'|'system'>('galaxy');
  const [detail, setDetail] = useState<'system'|'planet'|'fleets'>('system');
  const [selectedFleet, setSelectedFleet] = useState<string>();
  const [subject, setSubject] = useState('');
  const [mode, setMode] = useState(state.travel_modes[0]?.id ?? '');
  const [planetIndex, setPlanetIndex] = useState<number>();
  const [requirementsOpen,setRequirementsOpen]=useState(false);

  const [preview, setPreview] = useState<Record<string, TravelPreview>>();
  const systems = galaxy?.systems.map(authorizedSystem) ?? [];
  const selected = systems.find(item => systemKey(item) === selectedId) ?? systems.find(item => item.home) ?? systems[0];
  const key = selected ? systemKey(selected) : '';
  useEffect(() => { setPlanetIndex(undefined); setPreview(undefined); setLevel('galaxy'); setDetail('system'); setSelectedFleet(undefined); }, [key]);
  useEffect(()=>setRequirementsOpen(false),[key,planetIndex]);
  const selectSystem = (system: System) => { if(systemKey(system)!==key){setPlanetIndex(undefined);setPreview(undefined);setDetail('system');setLevel('galaxy');} setSelectedId(systemKey(system)); };
  const selectPlanet = (index: number) => { setPlanetIndex(index); setPreview(undefined); setDetail('planet'); };
  const selectFleet = (id: string) => { setSelectedFleet(id); setDetail('fleets'); };
  const surveyed = selected?.knowledge_level === 'SURVEYED';
  const planet = surveyed ? selected?.planets?.find(p => p.planet_index === planetIndex) : undefined;
  const identity=selected&&planet?planetIdentity(selected,planet,state.planets):undefined;
  const ownedPlanet=identity?.ownedId?state.planets?.find(p=>p.id===identity.ownedId):undefined;
  const contextAction=ownedPlanet?<Link className="button" aria-label="Abrir planeta e instalações" to="/planet" onClick={()=>setActivePlanetId(ownedPlanet.id)}>Administrar</Link>:identity?.kind==='unclaimed'?<PixelButton aria-label="Ver requisitos de colonização" onClick={()=>setRequirementsOpen(true)}>Requisitos</PixelButton>:undefined;
  const fleets = selected ? state.fleets.filter(f => f.status === 'ARRIVED' ? f.x === selected.x && f.y === selected.y : f.destination_x === selected.x && f.destination_y === selected.y) : [];
  const travelPayload = () => {
    if (!selected || !subject) return null;
    const [kind, id] = subject.split(':');
    const source = kind === 'fleet' ? state.fleets.find(item => item.id === id) : state.ships.find(item => item.id === id);
    return { planet_id: state.active_planet?.id, target_x: selected.x, target_y: selected.y, target_planet_index: planetIndex, propulsion_id: kind === 'fleet' ? source && 'propulsion' in source ? source.propulsion : undefined : source && 'propulsion_id' in source ? source.propulsion_id : undefined, mode, [kind === 'fleet' ? 'fleet_id' : 'ship_id']: id, mission: selected.knowledge_level === 'UNKNOWN' ? 'SURVEY' : planetIndex === undefined ? 'MOVE' : 'COLONIZE' };
  };
  const travel = async () => { const payload = travelPayload(); if (!payload) return; try { setPreview(await execute('travel-preview', payload) as Record<string, TravelPreview>); } catch { /* feedback belongs to shell */ } };
  const send = async () => { const payload = travelPayload(); if (!payload) return; try { await execute('travel', payload); setPreview(undefined); } catch { /* feedback belongs to shell */ } };
  if (galaxyQuery.isError) return <section role="alert"><h2>Mapa indisponível</h2><p>Não foi possível consultar os sistemas autorizados.</p><PixelButton onClick={() => void galaxyQuery.refetch()}>Tentar novamente</PixelButton></section>;
  if (galaxyQuery.isPending || !galaxy) return <p role="status">Consultando sistemas conhecidos…</p>;
  if (!selected) return <p>Nenhum sistema disponível nesta região.</p>;
  return <section className="galaxy-command" aria-label={level==='system'?'Sistema estelar':'Mapa da galáxia'} data-level={level}>
    <WorkspaceHeader title={level === 'system' ? 'Sistema estelar' : 'Galáxia'} icon="map"/>
    <nav className="galaxy-navigation" aria-label="Navegação espacial">
      {level === 'system' ? <PixelButton onClick={() => setLevel('galaxy')}>← Galáxia</PixelButton> : <PixelButton onClick={() => { setCenter(undefined); }}>Mundo natal</PixelButton>}
      <label>Região<select aria-label="Região do mapa" value={center?.join(':') ?? 'home'} onChange={e => { setCenter(e.target.value === 'home' ? undefined : e.target.value.split(':').map(Number) as [number, number]); setLevel('galaxy'); }}><option value="home">Mundo natal · {galaxy.home.join(':')}</option>{[...new Map(state.fleets.filter(f => f.status === 'ARRIVED').map(f => [`${f.x}:${f.y}`, f])).values()].map(f => <option key={`${f.x}:${f.y}`} value={`${f.x}:${f.y}`}>Frota · {f.x}:{f.y}</option>)}</select></label>
      <span className="galaxy-current" hidden={level==='system'}>{selected.name ?? 'Localização não identificada'} · {key}</span>
      {surveyed && level === 'galaxy' && <PixelButton onClick={() => setLevel('system')}>Abrir sistema</PixelButton>}
    </nav>
    <div className="galaxy-layout galaxy-spatial-layout">
      <div className="galaxy-visual-workspace">
        <div className="galaxy-strategic-layer" hidden={level !== 'galaxy'}><SpatialGalaxyMap systems={systems} center={galaxy.center} roster={state.planets} fleets={state.fleets} observedAt={state.observed_at} selected={selected} onSelect={selectSystem} onOpen={() => setLevel('system')}/></div>
        {level === 'system' && surveyed && <OrbitalSystemScene system={selected} state={state} catalog={catalog} selectedIndex={planetIndex} onPlanet={selectPlanet} onFleet={selectFleet}/>}
      </div>
      <aside className="system-detail galaxy-spatial-detail" aria-label="Inspetor do sistema">
        <header><SystemIdentity system={selected} roster={state.planets}/><Badge tone={surveyed ? 'good' : 'warn'}>{surveyed ? 'Mapeado' : 'Não identificado'}</Badge></header>
        <PixelTabs label="Informação do sistema" items={[{id:'system',label:'Sistema'},{id:'planet',label:'Planeta'},{id:'fleets',label:`Frotas (${fleets.length})`}]} value={detail} onChange={setDetail}/>
        {detail==='planet'&&planet&&identity&&<div className="selected-planet-heading"><h3>P{planet.planet_index+1} · {planet.name}</h3><PlanetStatus kind={identity.kind}/></div>}
        <ContentPages label="Sistema e missão" resetKey={`${key}:${detail}:${planetIndex}:${selectedFleet}`}>
          {detail === 'system' && <>{selected.star && <div className="px-stellar-data"><span>Classe estelar <b>{selected.star.stellar_class}</b></span><span>Luminosidade <b>{fmt(selected.star.luminosity,2)}</b></span></div>}{selected.civilization && <p>Território soberano · {selected.civilization}</p>}{!surveyed ? <p>Localização não identificada. Faça um levantamento para revelar a estrela e seus planetas.</p> : <><p>{selected.planets?.length ?? 0} planetas conhecidos · órbitas ilustrativas.</p>{selected.planets?.map(p => <button key={p.planet_index} className="galaxy-planet" onClick={() => selectPlanet(p.planet_index)}><b>P{p.planet_index+1} · {p.name}</b><PlanetStatus kind={planetIdentity(selected,p,state.planets).kind}/><span>{p.viability?term(p.viability):'Viabilidade não informada'} · {formatTemperatureKelvin(p.temperature)} · água {knownPlanetValue(p.water,'%')}</span></button>)}</>}</>}
          {detail === 'planet' && (planet ? <><div className="galaxy-planet-facts"><span>Gravidade <b>{knownPlanetValue(planet.gravity,'g',2)}</b></span><span>Temperatura <b>{formatTemperatureKelvin(planet.temperature)}</b></span><span>Água <b>{knownPlanetValue(planet.water,'%')}</b></span><span>Radiação <b>{knownPlanetValue(planet.radiation,'',2)}</b></span></div><p>{planet.viability?term(planet.viability):'Viabilidade não informada'}{identity?.kind==='unclaimed'?` · ${planet.colonization?.reason??(identity.canColonize?'Elegibilidade confirmada pelo servidor.':'Elegibilidade não informada.')}`:identity?.kind==='unknown'?' · Posse não confirmada.':''}</p><div><label>Planeta<select aria-label="Planeta do sistema" value={planetIndex} onChange={e => selectPlanet(Number(e.target.value))}>{selected.planets?.map(p => <option value={p.planet_index} key={p.planet_index}>{`P${p.planet_index+1} · ${p.name} · ${planetIdentity(selected,p,state.planets).label}`}</option>)}</select></label></div></> : <p>{surveyed ? 'Selecione um planeta no sistema ou na lista.' : 'Planetas ainda não identificados.'}</p>)}
          {detail === 'fleets' && (fleets.length ? fleets.filter(f => !selectedFleet || f.id === selectedFleet).map(f => <section key={f.id}><h3>{f.name}</h3><p>{f.status === 'TRANSIT' ? `Em viagem · destino ${f.destination_x}:${f.destination_y} · ${remaining(f.arrival_at)}` : `Chegada em ${f.x}:${f.y}`} · {f.operation ?? f.mission}</p>{fleetComposition(f,state,catalog).map(h => <p key={h.id}>{h.count} × {h.name}</p>)}<a className="button" href={`#/fleets?fleet=${encodeURIComponent(f.id)}`}>Inspecionar frota</a>{selectedFleet && <PixelButton onClick={() => setSelectedFleet(undefined)}>Todas as frotas</PixelButton>}</section>) : <p>Nenhuma frota própria presente ou a caminho. Ausência de informação não comprova ausência de frotas estrangeiras.</p>)}
        </ContentPages>
        <TravelPlanner contextAction={contextAction} targetIndex={planet?.planet_index} state={state} selected={selected} subject={subject} setSubject={setSubject} mode={mode} setMode={setMode} preview={preview} onPreview={travel} onSend={send}/>
      </aside>
    </div>
    {requirementsOpen&&planet&&identity?.kind==='unclaimed'&&<WorkspaceDialog title={`Colonização · ${planet.name}`} onClose={()=>setRequirementsOpen(false)}><ContentPages label="Requisitos de colonização"><p>{selected.name} · Sistema {key} · planeta {planet.planet_index+1}</p><p>{identity.canColonize?'Elegibilidade confirmada nesta consulta. A missão ainda exige naves, combustível e recursos válidos.':planet.colonization?.reason??'Elegibilidade não informada pelo servidor.'}</p>{planet.colonization?.cost&&<Costs state={state} catalog={catalog} values={planet.colonization.cost}/>} {planet.colonization?.population!==undefined&&<p>População da expedição: {fmt(planet.colonization.population)}.</p>}<p>Consulta de requisitos. Nenhum envio ou gasto automático.</p></ContentPages></WorkspaceDialog>}
  </section>;
}

function TravelPlanner({ contextAction,targetIndex,state, selected, subject, setSubject, mode, setMode, preview, onPreview, onSend }: { contextAction?:ReactNode;targetIndex?:number;state: ShellContext['state']; selected: System; subject: string; setSubject: (value: string) => void; mode: string; setMode: (value: string) => void; preview?: Record<string, TravelPreview>; onPreview: () => void; onSend: () => void }) {
  if (state.persistent) return <PersistentTravelPlanner contextAction={contextAction} state={state} selected={selected} targetIndex={targetIndex}/>;
  return <div className="travel-planner"><label>Frota ou nave<select id="travel-subject" value={subject} onChange={event => setSubject(event.target.value)}><option value="">Selecionar</option>{state.fleets.filter(fleet => fleet.status === 'ARRIVED').map(fleet => <option value={`fleet:${fleet.id}`} key={fleet.id}>{fleet.name}</option>)}{state.ships.filter(ship => ship.ready_at <= (state.observed_at ?? Date.now() / 1000)).map(ship => <option value={`ship:${ship.id}`} key={ship.id}>{ship.id}</option>)}</select></label><label>Modo<select id="travel-mode" value={mode} onChange={event => setMode(event.target.value)}>{state.travel_modes.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><button className="action secondary" disabled={!subject} onClick={onPreview}>Comparar rota</button>{preview && <div className="preview-list">{Object.entries(preview).map(([id, item]) => <div className="preview-row" key={id}><b>{id}</b><span>{duration(item.eta_seconds)} · combustível {fmt(item.fuel_cost)}</span></div>)}</div>}<button className="action primary" disabled={!subject || !preview} onClick={onSend}>{selected.knowledge_level === 'UNKNOWN' ? 'Explorar sistema' : 'Enviar frota'}</button></div>;
}

function PersistentTravelPlanner({contextAction,state,selected,targetIndex}:{contextAction?:ReactNode;state:ShellContext['state'];selected:System;targetIndex?:number}){
 const q=useUniverse(state.active_planet?.id??undefined);const owner=q.data?.players?.find(p=>p.planets.some(w=>w.x===selected.x&&w.y===selected.y&&w.index===targetIndex));const target=owner?.planets.find(w=>w.x===selected.x&&w.y===selected.y&&w.index===targetIndex);
 const planet=selected.knowledge_level==='SURVEYED'?selected.planets?.find(p=>p.planet_index===targetIndex):undefined;
 const identity=planet?planetIdentity(selected,planet,state.planets):undefined;
 const ownTarget=identity?.ownedId;
 const targetId=ownTarget??(identity?.kind==='occupied'&&!owner?.self?target?.id:undefined);
 const mission=ownTarget?'REINFORCE':targetId?'RECON':identity?.canColonize?'COLONIZE':selected.knowledge_level==='UNKNOWN'?'SURVEY':'MOVE';
 return <div className="travel-planner"><p>Destino {selected.x}:{selected.y}{targetIndex!==undefined?` · planeta ${targetIndex+1}`:" · sistema"}.</p><div className="planet-order-buttons">{contextAction}<a className="button" aria-label={`Planejar missão para ${selected.x}:${selected.y}`} href={`#/fleets?plan=1&x=${selected.x}&y=${selected.y}&mission=${mission}${targetId?`&target=${targetId}`:targetIndex!==undefined?`&planet_index=${targetIndex}`:''}`}>Planejar missão</a></div><small>Seleção e rascunho preservados. Custos e ETA conferidos pelo servidor.</small></div>;
}
