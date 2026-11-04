import type { Hull } from '../types/game';

// Presentation identity only. Stargrave has no conventional gameplay hull.
export const SHIP_DESIGNS = [
  ['horizon', 'scout_hull', 'corvette', 'exploration'],
  ['wayfarer', 'wayfarer_hull', 'freighter', 'logistics'],
  ['vanguard', 'vanguard_hull', 'frigate', 'escort'],
  ['sentinel', 'sentinel_hull', 'destroyer', 'defense'],
  ['odyssey', 'odyssey_hull', 'science_cruiser', 'science'],
  ['aegis', 'aegis_hull', 'cruiser', 'line_combat'],
  ['spearhead', 'spearhead_hull', 'battlecruiser', 'power_projection'],
  ['leviathan', 'leviathan_hull', 'battleship', 'capital'],
  ['atlas', 'atlas_hull', 'carrier', 'carrier_operations'],
  ['dominion', 'dominion_hull', 'dreadnought', 'command'],
  ['stargrave', null, 'stellar_siege_titan', 'megastructure'],
] as const;
export type ShipDesignId = typeof SHIP_DESIGNS[number][0];
export type ProceduralShipDesign = `${ShipDesignId}-prototype`;
export function designForHull(hull: Pick<Hull, 'id' | 'classification' | 'role'> | undefined): ShipDesignId | null {
  return hull ? SHIP_DESIGNS.find(([, id, classification, role]) => id !== null && id === hull.id && classification === hull.classification && role === hull.role)?.[0] ?? null : null;
}
export function modelForDescriptor(design: ProceduralShipDesign | 'UNKNOWN_DESIGN'): ShipDesignId | null {
  return SHIP_DESIGNS.find(([id, hull]) => hull !== null && `${id}-prototype` === design)?.[0] ?? null;
}
