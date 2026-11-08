import { PLANET_STATES, systemPlanetSummary, type PlanetState } from './planetIdentity';
import type { GalaxySystem, State } from '../types/game';

export function PlanetMark({ kind }: { kind: PlanetState }) {
  return <svg className={`planet-mark planet-mark-${kind}`} viewBox="0 0 16 16" aria-hidden="true" shapeRendering="crispEdges"><path fill="currentColor" fillRule="evenodd" d={PLANET_STATES[kind].path}/></svg>;
}
export function PlanetStatus({ kind }: { kind: PlanetState }) {
  return <span className={`planet-status planet-status-${kind}`}><PlanetMark kind={kind}/>{PLANET_STATES[kind].label}</span>;
}
export function SystemIdentity({ system, roster }: { system: GalaxySystem; roster: State['planets'] }) {
  const summary = systemPlanetSummary(system, roster);
  return <div className="system-identity"><strong>{system.name ?? 'Localização não identificada'}</strong><span>Sistema {system.x}:{system.y}</span>{system.knowledge_level === 'SURVEYED' && <small>{system.star?.present===false ? `Astro confinado/ausente · classe de origem ${system.star.stellar_class}` : system.star ? `Estrela classe ${system.star.stellar_class}` : 'Classe estelar não informada'} · {summary.known === null ? 'Planetas não informados' : `${summary.known} planeta${summary.known === 1 ? '' : 's'} conhecido${summary.known === 1 ? '' : 's'}`} · {summary.owned === null ? (summary.confirmedOwned ? `${summary.confirmedOwned} própria(s) confirmada(s)` : 'Posse não confirmada') : `${summary.owned} próprio${summary.owned === 1 ? '' : 's'}`}</small>}</div>;
}
