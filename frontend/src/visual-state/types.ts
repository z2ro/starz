import type { Catalog, Fleet, Planet, Ship, State } from '../types/game';
import type { PlanetFamily, PlanetGenerationParameters } from '../planetlab/planetLabTypes';

type OptionalFields<T> = { [K in keyof T]?: T[K] | null };
export type VisualShipInput = OptionalFields<Ship> & { origin_planet_id?: string | null; system_x?: number | null; system_y?: number | null };
/** Also accepts the sparse subset of /api/state needed by offline fixtures. */
export type VisualStateInput = {
  system?: { id?: string | null; name?: string; x?: number | null; y?: number | null; planet?: OptionalFields<Planet> & { id?: string | null }; star?: OptionalFields<State['system']['star']> };
  active_planet?: OptionalFields<NonNullable<State['active_planet']>>;
  planets?: State['planets']; population?: OptionalFields<State['population']>;
  districts?: State['districts']; ships?: readonly VisualShipInput[]; fleets?: readonly OptionalFields<Fleet>[];
};
export type VisualCatalogInput = Partial<Pick<Catalog, 'ships' | 'districts'>>;
export type Provenance = 'GROUNDED' | 'HEURISTIC' | 'DEFAULT' | 'UNKNOWN';
export type Decision = { field: string; sources: string[]; rule: string; result: string | number | boolean | null; status: Provenance };
export type Presence = 'PRESENT' | 'ABSENT' | 'UNKNOWN';
export type VisualShipDescriptor = {
  id: string; hullId: string | null; fleetId: string | null; quantity: 1;
  presence: 'LOCAL_SYSTEM' | 'REMOTE_SYSTEM' | 'TRANSIT' | 'UNKNOWN';
  context: 'SYSTEM_ONLY' | 'ORIGIN_PLANET' | 'UNKNOWN';
  design: 'horizon-prototype' | 'UNKNOWN_DESIGN'; visible: boolean; reason: string;
};
export type SpaceSceneDescriptor = {
  version: 1;
  identity: { systemKey: string | null; planetKey: string | null; seed: string | null };
  planet: {
    family: PlanetFamily | null; parameters: PlanetGenerationParameters;
    environment: { [K in keyof Omit<Planet, 'name' | 'mineral_profile'>]: Planet[K] | null } & { mineral_profile: Record<string, number> | null };
    atmosphere: { visible: boolean; color: string; strength: number };
  };
  star: { stellarClass: string | null; mass: number | null; luminosity: number | null; age: number | null; activity: number | null };
  civilization: { presence: Presence; population: number | null; infrastructureLevels: number | null; lightsEnabled: boolean; intensity: number };
  ships: { coverage: 'KNOWN' | 'UNKNOWN'; entities: VisualShipDescriptor[]; visibleCount: number };
  infrastructure: { evidence: Array<{ districtId: string; level: number }>; station: { presence: 'UNKNOWN'; visible: false; model: null } };
  moon: { presence: 'UNKNOWN'; visible: false };
  presentation: { planetEnabled: boolean; fallbackFamily: PlanetFamily; starAzimuth: number; starElevation: number; lightIntensity: number; shipLength: number; scaleMeaning: 'LAB_UNITS_NOT_PHYSICAL' };
  diagnostics: Decision[];
};
