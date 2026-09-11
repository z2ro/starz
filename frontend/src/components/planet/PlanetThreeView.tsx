import { useEffect, useRef, useState } from 'react';
import { PlanetRenderer } from '../../planet3d/PlanetRenderer';
import type { PlanetVisualState } from '../../planet3d/types';
import type { Catalog, State } from '../../types/game';

function cssFallback(state: State, catalog: Catalog) {
  const markers = catalog.districts.filter(item => (state.districts[item.id] ?? 0) > 0).map((item, index) => <span className={`surface-marker marker-${item.category.toLowerCase()} marker-${index % 6}`} title={item.category} key={item.id} />);
  const arrived = state.fleets.some(fleet => fleet.status === 'ARRIVED' && fleet.x === state.system.x && fleet.y === state.system.y);
  return <div className="planet-stage planet-large" aria-label={`Representação de ${state.system.planet.name}`}><div className="distant-star" /><div className="orbit-line orbit-a" /><div className="orbit-line orbit-b" /><div className="planet-sphere"><div className="planet-clouds" /><div className="city-lights" />{markers}</div>{state.capacities.shipyard_slots > 0 && <div className="orbital-station" title="Estaleiro orbital" />}{arrived && <div className="fleet-marker" title="Presença de frota ARRIVED">▸</div>}</div>;
}

export function PlanetThreeView({ state, catalog, mode }: { state: State; catalog: Catalog; mode: 'image' | '3d' }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<PlanetRenderer | null>(null);
  const [failed, setFailed] = useState(false);
  const shouldRender3d = mode === '3d' || failed;
  const visualState: PlanetVisualState = {
    seed: `${state.system.name}:${state.system.x}:${state.system.y}:${state.active_planet?.planet_index ?? 0}`,
    systemX: state.system.x, systemY: state.system.y, planetIndex: state.active_planet?.planet_index ?? 0,
    planet: state.system.planet, star: { stellar_class: state.system.star.stellar_class, luminosity: state.system.star.luminosity },
    districts: catalog.districts.filter(item => (state.districts[item.id] ?? 0) > 0).map(item => ({ id: item.id, category: item.category, level: state.districts[item.id] ?? 0 })),
    capacities: { shipyard_slots: state.capacities.shipyard_slots },
    fleets: state.fleets.map(fleet => ({ status: fleet.status, x: fleet.x, y: fleet.y, hullId: state.ships.find(ship => fleet.ship_ids.includes(ship.id))?.hull_id })),
  };
  useEffect(() => {
    if (!shouldRender3d || !containerRef.current) { rendererRef.current?.dispose(); rendererRef.current = null; return; }
    try { rendererRef.current ??= new PlanetRenderer(containerRef.current); }
    catch { rendererRef.current?.dispose(); rendererRef.current = null; }
    return () => { rendererRef.current?.dispose(); rendererRef.current = null; };
  }, [shouldRender3d]);
  useEffect(() => {
    if (shouldRender3d) rendererRef.current?.update(visualState);
  }, [shouldRender3d, state]);
  return <div ref={containerRef} id="planet-3d-stage" className="planet-stage planet-3d-stage" data-visual-mode={shouldRender3d ? '3d' : 'image'}>{!shouldRender3d && <div className="planet-fallback-visual">{cssFallback(state, catalog)}</div>}</div>;
}
