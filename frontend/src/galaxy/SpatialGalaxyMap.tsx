import {PlanetMark} from './PlanetStatus';
import {systemPlanetSummary} from './planetIdentity';
import { useEffect, useMemo, useRef } from 'react';
import type { Fleet, GalaxySystem, State } from '../types/game';
import { PixelIcon } from '../pixel-command/PixelIcon';
import { PixelButton } from '../pixel-command/master/MasterUI';
import { fleetMapMarkers, systemKey, visualPosition, visibleGalaxyLabels } from './galaxyPresentation';

export function SpatialGalaxyMap({ systems, center, roster, fleets, observedAt, selected, onSelect, onOpen }: {
  systems: GalaxySystem[]; center: number[]; roster: State['planets']; fleets: Fleet[]; observedAt?: number; selected: GalaxySystem; onSelect: (system: GalaxySystem) => void; onOpen: () => void;
}) {
  const host = useRef<SVGSVGElement>(null), layer = useRef<SVGGElement>(null);
  const camera = useRef({ x: 0, y: 0, zoom: 1, width: 1, height: 1 });
  const pointers = useRef(new Map<number, { x: number; y: number }>()), moved = useRef(false), initial = useRef(true);
  const nodes = useMemo(() => systems.map(system => ({ system, ...visualPosition(system) })), [systems]);
  const backgroundCenter = visualPosition({x:center[0],y:center[1]});
  const nodesRef = useRef(nodes); nodesRef.current = nodes;
  const selectedRef = useRef(systemKey(selected)); selectedRef.current = systemKey(selected);
  const apply = () => {
    const c = camera.current;
    layer.current?.setAttribute('transform', `translate(${c.x} ${c.y}) scale(${c.zoom})`);
    host.current?.style.setProperty('--node-scale', String(1 / c.zoom));
    host.current?.setAttribute('data-labels', c.zoom >= .65 ? 'all' : 'selected');
    const labels = visibleGalaxyLabels(nodesRef.current, c, selectedRef.current);
    host.current?.querySelectorAll<SVGGElement>('[data-system-key]').forEach(node => node.dataset.labelVisible = String(labels.has(node.dataset.systemKey!)));
    host.current?.setAttribute('data-camera', `${c.x},${c.y},${c.zoom}`);
  };
  const fit = () => {
    const points = nodesRef.current; if (!points.length) return;
    const c = camera.current;
    const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x));
    const minY = Math.min(...points.map(p => p.y)), maxY = Math.max(...points.map(p => p.y));
    c.zoom = Math.max(.45, Math.min(1, (c.width - 100) / Math.max(1, maxX - minX), (c.height - 100) / Math.max(1, maxY - minY)));
    c.x = c.width / 2 - (minX + maxX) / 2 * c.zoom; c.y = c.height / 2 - (minY + maxY) / 2 * c.zoom; apply();
  };
  const zoom = (factor: number, x = camera.current.width / 2, y = camera.current.height / 2) => {
    const c = camera.current, next = Math.max(.45, Math.min(2.5, c.zoom * factor)), ratio = next / c.zoom;
    c.x = x - (x - c.x) * ratio; c.y = y - (y - c.y) * ratio; c.zoom = next; apply();
  };
  const centerSelection = () => { const point = visualPosition(selected), c = camera.current; c.x = c.width / 2 - point.x * c.zoom; c.y = c.height / 2 - point.y * c.zoom; apply(); };
  useEffect(() => {
    const svg = host.current!;
    const measure = () => { const box = svg.getBoundingClientRect(), c = camera.current; c.x += (box.width - c.width) / 2; c.y += (box.height - c.height) / 2; c.width = box.width; c.height = box.height; svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`); if (initial.current) { fit(); initial.current = false; } else apply(); };
    const observer = new ResizeObserver(measure); observer.observe(svg); measure();
    const wheel = (e: WheelEvent) => { e.preventDefault(); const box = svg.getBoundingClientRect(); zoom(Math.exp(-e.deltaY * .0015), e.clientX - box.left, e.clientY - box.top); };
    svg.addEventListener('wheel', wheel, { passive: false });
    return () => { observer.disconnect(); svg.removeEventListener('wheel', wheel); };
  }, []);
  const region = systems.map(systemKey).sort().join('|');
  useEffect(() => { fit(); }, [region]);
  useEffect(() => { apply(); }, [nodes, selected]);
  const select = (system: GalaxySystem) => { if (!moved.current) onSelect(system); };
  return <section className="spatial-galaxy galaxy-map-scroll" aria-label="Mapa espacial da galáxia">
    <nav className="spatial-toolbar" aria-label="Câmera da galáxia"><PixelButton aria-label="Reduzir mapa espacial" onClick={() => zoom(1 / 1.25)}>−</PixelButton><PixelButton aria-label="Ampliar mapa espacial" onClick={() => zoom(1.25)}>+</PixelButton><PixelButton onClick={fit}>Enquadrar</PixelButton><PixelButton onClick={centerSelection}>Seleção</PixelButton><small>Arraste · roda/pinça · setas</small></nav>
    <svg ref={host} className="galaxy-space" role="group" aria-label="Sistemas próximos" tabIndex={0}
      onKeyDown={e => { if (e.target !== e.currentTarget) return; const c = camera.current; if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) { e.preventDefault(); c.x += e.key === 'ArrowLeft' ? 60 : e.key === 'ArrowRight' ? -60 : 0; c.y += e.key === 'ArrowUp' ? 60 : e.key === 'ArrowDown' ? -60 : 0; apply(); } else if (e.key === '+') zoom(1.25); else if (e.key === '-') zoom(1 / 1.25); else if (e.key === 'Home') fit(); }}
      onPointerDown={e => { moved.current = false; pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); (e.target as Element).setPointerCapture(e.pointerId); }}
      onPointerMove={e => {
        const previous = pointers.current.get(e.pointerId); if (!previous) return;
        const dx = e.clientX - previous.x, dy = e.clientY - previous.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) moved.current = true;
        const other = [...pointers.current.entries()].find(([id]) => id !== e.pointerId)?.[1];
        if (other) { const before = Math.hypot(previous.x - other.x, previous.y - other.y), after = Math.hypot(e.clientX - other.x, e.clientY - other.y); const rect = e.currentTarget.getBoundingClientRect(); if (before > 0) zoom(after / before, (e.clientX + other.x) / 2 - rect.left, (e.clientY + other.y) / 2 - rect.top); }
        else { camera.current.x += dx; camera.current.y += dy; apply(); }
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }} onPointerUp={e => { pointers.current.delete(e.pointerId); }} onPointerCancel={e => { pointers.current.delete(e.pointerId); moved.current = true; }}>
      <g ref={layer}>
        <g className="galaxy-dust" transform={`translate(${backgroundCenter.x} ${backgroundCenter.y})`} aria-hidden="true">{Array.from({ length: 220 }, (_, i) => <rect key={i} x={(i * 269 % 3200) - 1600} y={(i * 541 % 2600) - 1300} width={i % 7 === 0 ? 2 : 1} height={i % 7 === 0 ? 2 : 1}/>)}</g>
        {nodes.map(({ system, x, y }) => <g key={systemKey(system)} transform={`translate(${x} ${y})`}>
          <g className={`spatial-system ${system.knowledge_level === 'SURVEYED' ? 'charted' : 'unknown'} ${systemKey(selected) === systemKey(system) ? 'selected' : ''} ${system.home ? 'home' : ''}`} data-system-key={systemKey(system)} role="button" tabIndex={0} onFocus={() => {const point=visualPosition(system),c=camera.current;if(point.x*c.zoom+c.x<40||point.x*c.zoom+c.x>c.width-40||point.y*c.zoom+c.y<40||point.y*c.zoom+c.y>c.height-70){c.x=c.width/2-point.x*c.zoom;c.y=c.height/2-point.y*c.zoom;apply();}}} aria-pressed={systemKey(selected) === systemKey(system)} aria-label={`${system.name ?? 'Localização não identificada'}, coordenadas ${system.x}:${system.y}, ${system.knowledge_level}`} onClick={e => { if(moved.current)e.stopPropagation(); select(system); }} onDoubleClick={() => { if (system.knowledge_level === 'SURVEYED') { onSelect(system); onOpen(); } }} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(system); } }}>
            <rect className="system-hit" x="-23" y="-23" width="46" height="46"/>
            <circle className="system-selection" r="20"/>
            {system.knowledge_level === 'SURVEYED' ? <path className={`stellar-symbol stellar-${system.star?.stellar_class.toLowerCase() ?? 'g'}`} d="M-3 -12H3V-5H7V-2H12V3H5V7H2V12H-3V5H-7V2H-12V-3H-5V-7H-3Z"/> : <path className="unidentified-symbol" d="M0 -8L8 0L0 8L-8 0Z"/>}
            <text className="system-label" y="39" textAnchor="middle">{(system.name ?? 'Não identificado').slice(0, 22)}</text><text className="system-label system-coordinate" y="55" textAnchor="middle">Sistema {system.x}:{system.y}</text>
            {system.knowledge_level==='SURVEYED'&&<><text className="system-label system-coordinate" y="71" textAnchor="middle">{systemPlanetSummary(system,roster).known??'?'} planetas · {systemPlanetSummary(system,roster).owned??'?'} próprios</text>{(systemPlanetSummary(system,roster).confirmedOwned??0)>0&&<svg x="13" y="-18" width="14" height="14"><PlanetMark kind="owned"/></svg>}</>}
          </g>
        </g>)}
        {fleetMapMarkers(fleets, observedAt).map(marker => <g key={marker.key} transform={`translate(${marker.x} ${marker.y})`}><a className="galaxy-fleet-marker" href={marker.fleets.length === 1 ? `#/fleets?fleet=${encodeURIComponent(marker.fleets[0].id)}` : '#/fleets'} aria-label={marker.fleets.length === 1 ? `Inspecionar ${marker.fleets[0].name}` : `Inspecionar ${marker.fleets.length} frotas`}><g transform="translate(0 -52)"><title>{marker.fleets.map(f => `${f.name} · ${f.status === 'TRANSIT' ? `Em viagem para ${f.destination_x}:${f.destination_y}` : `Em ${f.x}:${f.y}`}`).join(' · ')}</title><rect x="-22" y="-22" width="44" height="44" fill="transparent"/><svg x="-9" y="-9" width="18" height="18"><PixelIcon name="ship"/></svg>{marker.fleets.length > 1 && <text x="10" y="0">{marker.fleets.length}</text>}</g></a></g>)}
      </g>
    </svg>
    <footer className="spatial-legend"><span>✦ Mapeado</span><span>◇ Não identificado</span><span>▴ Suas frotas</span></footer>
  </section>;
}
