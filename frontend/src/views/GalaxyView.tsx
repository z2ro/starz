import {WorkspaceHeader, PixelButton, PixelTabs} from '../pixel-command/master/MasterUI';
import {ContentPages} from '../pixel-command/ContentPages';
import {useUniverse} from '../universe/useUniverse';
import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useGalaxyQuery } from '../api/queries';
import { Badge } from '../components/ui/Badge';
import { duration, fmt, term, remaining } from '../app/format';
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
  const [preview, setPreview] = useState<Record<string, TravelPreview>>();
  const systems = galaxy?.systems.map(authorizedSystem) ?? [];
  const selected = systems.find(item => systemKey(item) === selectedId) ?? systems.find(item => item.home) ?? systems[0];
  const key = selected ? systemKey(selected) : '';
  useEffect(() => { setPlanetIndex(undefined); setPreview(undefined); setLevel('galaxy'); setDetail('system'); setSelectedFleet(undefined); }, [key]);
  const selectSystem = (system: System) => { setSelectedId(systemKey(system)); };
  const selectPlanet = (index: number) => { setPlanetIndex(index); setPreview(undefined); setDetail('planet'); };
  const selectFleet = (id: string) => { setSelectedFleet(id); setDetail('fleets'); };
  const surveyed = selected?.knowledge_level === 'SURVEYED';
  const planet = surveyed ? selected?.planets?.find(p => p.planet_index === planetIndex) : undefined;
  const ownedPlanet = selected && planetIndex !== undefined ? state.planets?.find(p => p.x === selected.x && p.y === selected.y && p.planet_index === planetIndex) : undefined;
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
      <span className="galaxy-current">{selected.name ?? 'Localização não identificada'} · {key}</span>
      {surveyed && level === 'galaxy' && <PixelButton onClick={() => setLevel('system')}>Abrir sistema</PixelButton>}
    </nav>
    <div className="galaxy-layout galaxy-spatial-layout">
      <div className="galaxy-visual-workspace">
        <div className="galaxy-strategic-layer" hidden={level !== 'galaxy'}><SpatialGalaxyMap systems={systems} center={galaxy.center} fleets={state.fleets} observedAt={state.observed_at} selected={selected} onSelect={selectSystem} onOpen={() => setLevel('system')}/></div>
        {level === 'system' && surveyed && <OrbitalSystemScene system={selected} state={state} catalog={catalog} selectedIndex={planetIndex} onPlanet={selectPlanet} onFleet={selectFleet}/>}
      </div>
      <aside className="system-detail galaxy-spatial-detail" aria-label="Inspetor do sistema">
        <header><h2>{selected.name ?? 'Localização não identificada'}</h2><Badge tone={surveyed ? 'good' : 'warn'}>{surveyed ? 'Mapeado' : 'Não identificado'}</Badge><p><span>{key}</span><span className="system-center-distance"> · {fmt(selected.distance, 2)} unidades do centro consultado</span></p></header>
        <PixelTabs label="Informação do sistema" items={[{id:'system',label:'Sistema'},{id:'planet',label:'Planeta'},{id:'fleets',label:`Frotas (${fleets.length})`}]} value={detail} onChange={setDetail}/>
        <ContentPages label="Sistema e missão" resetKey={`${key}:${detail}:${planetIndex}:${selectedFleet}`}>
          {detail === 'system' && <>{selected.star && <div className="px-stellar-data"><span>Classe estelar <b>{selected.star.stellar_class}</b></span><span>Luminosidade <b>{fmt(selected.star.luminosity,2)}</b></span></div>}{selected.civilization && <p>Território soberano · {selected.civilization}</p>}{!surveyed ? <p>Localização não identificada. Faça um levantamento para revelar a estrela e seus planetas.</p> : <><p>{selected.planets?.length ?? 0} planetas conhecidos · órbitas ilustrativas.</p>{selected.planets?.map(p => <button key={p.planet_index} className="galaxy-planet" onClick={() => selectPlanet(p.planet_index)}><b>{p.name}</b><span>{term(p.viability)} · {fmt(p.temperature)} K · água {fmt(p.water)}%</span></button>)}</>}</>}
          {detail === 'planet' && (planet ? <><h3>{planet.name}</h3><div className="galaxy-planet-facts"><span>Gravidade <b>{fmt(planet.gravity,2)} g</b></span><span>Temperatura <b>{fmt(planet.temperature)} K</b></span><span>Água <b>{fmt(planet.water)}%</b></span><span>Radiação <b>{fmt(planet.radiation,2)}</b></span></div><p>{term(planet.viability)} · {planet.ownership === 'OWNED' ? 'Mundo do império' : planet.ownership === 'OCCUPIED' ? 'Já ocupado' : planet.colonization.reason ?? 'Disponível para colonização'}</p><div>{ownedPlanet && <Link className="button" to="/planet" onClick={() => setActivePlanetId(ownedPlanet.id)}>Abrir planeta e instalações</Link>}<label>Planeta<select aria-label="Planeta do sistema" value={planetIndex} onChange={e => selectPlanet(Number(e.target.value))}>{selected.planets?.map(p => <option value={p.planet_index} key={p.planet_index}>{p.name}</option>)}</select></label></div></> : <p>{surveyed ? 'Selecione um planeta no sistema ou na lista.' : 'Planetas ainda não identificados.'}</p>)}
          {detail === 'fleets' && (fleets.length ? fleets.filter(f => !selectedFleet || f.id === selectedFleet).map(f => <section key={f.id}><h3>{f.name}</h3><p>{f.status === 'TRANSIT' ? `Em viagem · destino ${f.destination_x}:${f.destination_y} · ${remaining(f.arrival_at)}` : `Chegada em ${f.x}:${f.y}`} · {f.operation ?? f.mission}</p>{fleetComposition(f,state,catalog).map(h => <p key={h.id}>{h.count} × {h.name}</p>)}<a className="button" href={`#/fleets?fleet=${encodeURIComponent(f.id)}`}>Inspecionar frota</a>{selectedFleet && <PixelButton onClick={() => setSelectedFleet(undefined)}>Todas as frotas</PixelButton>}</section>) : <p>Nenhuma frota própria presente ou a caminho. Ausência de informação não comprova ausência de frotas estrangeiras.</p>)}
        </ContentPages>
        <TravelPlanner targetIndex={planetIndex} state={state} selected={selected} subject={subject} setSubject={setSubject} mode={mode} setMode={setMode} preview={preview} onPreview={travel} onSend={send}/>
      </aside>
    </div>
  </section>;
}

function TravelPlanner({ targetIndex,state, selected, subject, setSubject, mode, setMode, preview, onPreview, onSend }: { targetIndex?:number;state: ShellContext['state']; selected: System; subject: string; setSubject: (value: string) => void; mode: string; setMode: (value: string) => void; preview?: Record<string, TravelPreview>; onPreview: () => void; onSend: () => void }) {
  if (state.persistent) return <PersistentTravelPlanner state={state} selected={selected} targetIndex={targetIndex}/>;
  return <div className="travel-planner"><label>Frota ou nave<select id="travel-subject" value={subject} onChange={event => setSubject(event.target.value)}><option value="">Selecionar</option>{state.fleets.filter(fleet => fleet.status === 'ARRIVED').map(fleet => <option value={`fleet:${fleet.id}`} key={fleet.id}>{fleet.name}</option>)}{state.ships.filter(ship => ship.ready_at <= (state.observed_at ?? Date.now() / 1000)).map(ship => <option value={`ship:${ship.id}`} key={ship.id}>{ship.id}</option>)}</select></label><label>Modo<select id="travel-mode" value={mode} onChange={event => setMode(event.target.value)}>{state.travel_modes.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><button className="action secondary" disabled={!subject} onClick={onPreview}>Comparar rota</button>{preview && <div className="preview-list">{Object.entries(preview).map(([id, item]) => <div className="preview-row" key={id}><b>{id}</b><span>{duration(item.eta_seconds)} · combustível {fmt(item.fuel_cost)}</span></div>)}</div>}<button className="action primary" disabled={!subject || !preview} onClick={onSend}>{selected.knowledge_level === 'UNKNOWN' ? 'Explorar sistema' : 'Enviar frota'}</button></div>;
}

function PersistentTravelPlanner({state,selected,targetIndex}:{state:ShellContext['state'];selected:System;targetIndex?:number}){
 const q=useUniverse(state.active_planet?.id??undefined);const owner=q.data?.players?.find(p=>p.planets.some(w=>w.x===selected.x&&w.y===selected.y&&w.index===targetIndex));const target=owner?.planets.find(w=>w.x===selected.x&&w.y===selected.y&&w.index===targetIndex);
 const mission=target?(owner?.self?'REINFORCE':'RECON'):targetIndex!==undefined?'COLONIZE':selected.knowledge_level==='UNKNOWN'?'SURVEY':'MOVE';
 return <div className="travel-planner"><p>Destino {selected.x}:{selected.y}{targetIndex!==undefined?` · planeta ${targetIndex+1}`:" · sistema"}.</p><a className="button" href={`#/fleets?plan=1&x=${selected.x}&y=${selected.y}&mission=${mission}${target?`&target=${target.id}`:targetIndex!==undefined?`&planet_index=${targetIndex}`:''}`}>Planejar missão para {selected.x}:{selected.y}</a><small>Seleção e rascunho preservados. Custos e ETA conferidos pelo servidor.</small></div>;
}
