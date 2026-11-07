import {fmt} from '../app/format';
import type { GalaxyPlanet, GalaxySystem, State } from '../types/game';

export const PLANET_STATES = {
  home: { label: 'Mundo natal', path: 'M1 7h2V5h2V3h2V1h2v2h2v2h2v2h2v2h-2v6H3V9H1zM6 10v5h4v-5z' },
  owned: { label: 'Colônia própria', path: 'M2 1h2v14H2zM4 2h10v7H4zM5 3v5h8V3z' },
  unclaimed: { label: 'Não colonizado', path: 'M5 1h6v2h2v2h2v6h-2v2h-2v2H5v-2H3v-2H1V5h2V3h2zM5 3v2H3v6h2v2h6v-2h2V5h-2V3z' },
  occupied: { label: 'Ocupado por outro império', path: 'M2 1h12v9l-2 2-4 4-4-4-2-2zM4 3v6l4 4 4-4V3zM7 5h2v5H7z' },
  unknown: { label: 'Estado desconhecido', path: 'M4 1h8v2h2v4h-2v2H9v2H6V7h4V4H6v2H2V3h2zM6 13h3v3H6z' },
} as const;
export type PlanetState = keyof typeof PLANET_STATES;
export function planetIdentity(system: GalaxySystem, planet: GalaxyPlanet, roster: State['planets']) {
  const row = roster?.find(p => p.x === system.x && p.y === system.y && p.planet_index === planet.planet_index);
  let kind: PlanetState = 'unknown';
  if (system.knowledge_level === 'SURVEYED') {
    if (planet.ownership === 'OWNED') kind = row?.home === true ? 'home' : 'owned';
    else if (!row && planet.ownership === 'UNCLAIMED') kind = 'unclaimed';
    else if (!row && planet.ownership === 'OCCUPIED') kind = 'occupied';
  }
  return { kind, ...PLANET_STATES[kind], index: planet.planet_index, ordinal: planet.planet_index + 1,
    ownedId: (kind === 'home' || kind === 'owned') ? row?.id : undefined,
    canColonize: kind === 'unclaimed' && planet.colonization?.eligible === true };
}
export function systemPlanetSummary(system: GalaxySystem, roster: State['planets']) {
  if (system.knowledge_level !== 'SURVEYED' || !Array.isArray(system.planets)) return { known: null, owned: null, confirmedOwned: null };
  const states = system.planets.map(p => planetIdentity(system, p, roster));
  const confirmedOwned=states.filter(p=>p.kind==='home'||p.kind==='owned').length;
  return { known: states.length, owned: states.some(p => p.kind === 'unknown') ? null : confirmedOwned, confirmedOwned };
}

export const knownPlanetValue=(value:unknown,unit='',digits=0)=>typeof value==='number'&&Number.isFinite(value)?`${fmt(value,digits)}${unit?` ${unit}`:''}`:'Não informado';
