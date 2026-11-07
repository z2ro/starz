import data from './galaxyIdentity.json';
import type {GalaxySystem,State} from '../../frontend/src/types/game';
export const identityRoster=data.roster as NonNullable<State['planets']>;
export const identityFixtures=data.systems as unknown as Record<'one'|'two'|'multiple'|'occupied'|'unknown',GalaxySystem>;
