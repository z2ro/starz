import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { duration, fmt, label, term } from '../app/format';
import { Badge } from '../components/ui/Badge';
import { DataRow } from '../components/ui/DataRow';
import { EmptyState } from '../components/ui/EmptyState';
import { Inspector, InspectorSection } from '../components/ui/Inspector';
import type { Fleet, Ship } from '../types/game';
import type { ShellContext } from '../components/shell/AppShell';

const coordinates = (x: number, y: number) => `${x}:${y}`;
const timestamp = (value: number) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value * 1000));
const quantity = (count: number, singular: string, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`;
const originName = (id: string | null | undefined, planets: ShellContext['state']['planets']) => planets?.find(planet => planet.id === id)?.name ?? (id ? `Planeta ${id.slice(0, 8)}` : '—');
const statusLabel = (status: Fleet['status']) => status === 'ARRIVED' ? 'EM POSIÇÃO' : 'EM TRÂNSITO';
const travelModeLabel = (catalog: ShellContext['catalog'], id: string) => ({ ECONOMY: 'Econômico', NORMAL: 'Normal', FORCED: 'Forçado' } as Record<string, string>)[id] ?? label(catalog, id, id);
const catalogLabel = (catalog: ShellContext['catalog'], id: string) => label(catalog, id, id);

export function FleetsView() {
  const { catalog, state } = useOutletContext<ShellContext>();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedId(current => state.fleets.some(fleet => fleet.id === current) ? current : state.fleets[0]?.id ?? null);
  }, [state.fleets]);

  const selectedFleet = state.fleets.find(fleet => fleet.id === selectedId);
  if (!state.fleets.length) return <FleetEmptyState />;

  return <div className="fleet-command"><header className="fleet-command-header"><div><span className="eyebrow">COMANDO IMPERIAL · OPERAÇÕES DE FROTA</span><h1>Centro de comando de frotas</h1><p>Posição operacional, missão e composição das forças em campo.</p></div><div className="fleet-command-count"><span>FROTAS REGISTRADAS</span><strong>{fmt(state.fleets.length)}</strong></div></header><div className="fleet-command-layout"><FleetRoster fleets={state.fleets} selectedId={selectedId} onSelect={setSelectedId} /><FleetInspector fleet={selectedFleet} catalog={catalog} state={state} /></div></div>;
}

function FleetEmptyState() {
  return <div className="fleet-command-empty"><EmptyState title="Nenhuma frota" icon="fleets">Construa uma nave no Estaleiro e envie sua primeira missão para formar uma frota.</EmptyState></div>;
}

function FleetRoster({ fleets, selectedId, onSelect }: { fleets: Fleet[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return <section className="fleet-roster" aria-label="Lista de frotas"><div className="fleet-roster-heading"><div><span className="eyebrow">OPERAÇÕES ORBITAIS</span><h2>Frotas em comando</h2></div><span>{quantity(fleets.length, 'unidade')}</span></div><div className="fleet-roster-list">{fleets.map(fleet => <button type="button" className={`fleet-roster-item ${fleet.id === selectedId ? 'selected' : ''}`} aria-current={fleet.id === selectedId ? 'true' : undefined} aria-pressed={fleet.id === selectedId} key={fleet.id} onClick={() => onSelect(fleet.id)}><span className="fleet-roster-main"><strong>{fleet.name}</strong><small>{coordinates(fleet.x, fleet.y)} · {term(fleet.mission)}</small></span><Badge tone={fleet.status === 'ARRIVED' ? 'good' : 'blue'}>{statusLabel(fleet.status)}</Badge><span className="fleet-roster-meta"><small>{quantity(fleet.ship_ids.length, 'nave')}</small>{fleet.status === 'TRANSIT' && <small>ETA {duration(fleet.eta)}</small>}</span></button>)}</div></section>;
}

function FleetInspector({ fleet, catalog, state }: { fleet?: Fleet; catalog: ShellContext['catalog']; state: ShellContext['state'] }) {
  if (!fleet) return <Inspector label="Inspector de frota" className="fleet-inspector" state="empty"><EmptyState title="Selecione uma frota">Escolha uma unidade no roster para consultar seus dados operacionais.</EmptyState></Inspector>;

  const ships = fleet.ship_ids.map(id => state.ships.find(ship => ship.id === id)).filter((ship): ship is Ship => !!ship);
  const missingShips = fleet.ship_ids.length - ships.length;
  const totalCrew = ships.reduce((total, ship) => total + ship.crew, 0);
  const totalMass = ships.reduce((total, ship) => total + ship.mass, 0);
  const transit = fleet.status === 'TRANSIT';

  return <Inspector label="Inspector de frota" className={`fleet-inspector ${transit ? 'is-transit' : ''}`} header={<div className="fleet-inspector-header"><div><span className="eyebrow">COMANDO DE FROTAS</span><strong>{fleet.name}</strong><small>{term(fleet.mission)} · posição {coordinates(fleet.x, fleet.y)}</small></div><Badge tone={transit ? 'blue' : 'good'}>{statusLabel(fleet.status)}</Badge></div>}><InspectorSection title="Navegação e posição"><div className="fleet-route-summary"><div><span>ATUAL</span><strong>{coordinates(fleet.x, fleet.y)}</strong></div><b aria-hidden="true">→</b><div><span>DESTINO</span><strong>{transit ? coordinates(fleet.destination_x, fleet.destination_y) : '—'}</strong></div></div><DataRow label="SISTEMA ATUAL" value={coordinates(fleet.x, fleet.y)} /><DataRow label="DESTINO" value={transit ? coordinates(fleet.destination_x, fleet.destination_y) : '—'} /><DataRow label="MISSÃO" value={term(fleet.mission)} /><DataRow label="MODO DE VIAGEM" value={fleet.mode ? travelModeLabel(catalog, fleet.mode) : '—'} /><DataRow label="PROPULSÃO" value={fleet.propulsion ? catalogLabel(catalog, fleet.propulsion) : '—'} /><DataRow label="ETA" value={transit ? duration(fleet.eta) : '—'} tone={transit ? 'active' : 'default'} /></InspectorSection><InspectorSection title="Combustível e operações"><DataRow label="Reserva embarcada" value={fleet.fuel_reserve == null ? '—' : fmt(fleet.fuel_reserve, 2)} /><DataRow label="Custo de combustível" value={fmt(fleet.fuel_cost, 2)} /><DataRow label="PARTIDA" value={timestamp(fleet.departure_at)} /><DataRow label="CHEGADA" value={timestamp(fleet.arrival_at)} /></InspectorSection><InspectorSection title="Composição" action={<span className="fleet-section-count">{missingShips ? `${ships.length} de ${fleet.ship_ids.length} naves carregadas` : quantity(ships.length, 'nave')}</span>}><div className="fleet-aggregate"><DataRow label="TRIPULAÇÃO TOTAL" value={fmt(totalCrew)} /><DataRow label="MASSA TOTAL" value={fmt(totalMass)} /></div>{missingShips > 0 && <p className="fleet-missing-note">{quantity(missingShips, 'nave')} {missingShips === 1 ? 'indisponível' : 'indisponíveis'} no estado atual.</p>}{ships.length ? <div className="fleet-composition">{ships.map((ship, index) => <FleetShip key={ship.id} ship={ship} index={index} catalog={catalog} planets={state.planets} />)}</div> : <p className="fleet-muted">Nenhuma nave disponível para esta composição.</p>}</InspectorSection></Inspector>;
}

function FleetShip({ ship, index, catalog, planets }: { ship: Ship; index: number; catalog: ShellContext['catalog']; planets: ShellContext['state']['planets'] }) {
  return <article className="fleet-composition-item"><div className="fleet-composition-heading"><strong>Nave {index + 1}</strong><small title={ship.id}>ID {ship.id.slice(0, 8)}</small></div><DataRow label="CASCO" value={catalogLabel(catalog, ship.hull_id)} /><DataRow label="PROPULSÃO" value={catalogLabel(catalog, ship.propulsion_id)} /><DataRow label="COMBUSTÍVEL" value={catalogLabel(catalog, ship.fuel_id)} /><DataRow label="TRIPULAÇÃO" value={fmt(ship.crew)} /><DataRow label="MASSA" value={fmt(ship.mass)} /><DataRow label="PRONTA EM" value={timestamp(ship.ready_at)} /><DataRow label="ORIGEM" value={originName(ship.origin_planet_id, planets)} /></article>;
}
