import { describe, expect, it, vi } from 'vitest';
import { createVisualDescriptor, derivePlanetIdentity } from '../frontend/src/visual-state/VisualStateAdapter';
import { derivePlanetFamily } from '../frontend/src/visual-state/planetVisualMapping';
import type { SpaceSceneDescriptor, VisualStateInput } from '../frontend/src/visual-state/types';
import { COLONY_ID, HOME_ID, HORIZON, colony, homeworld, hostile, incomplete, scenarios, systemWithFleet, uninhabited, unmappedCatalog, unmappedHull, visualCatalog } from './fixtures/visualState';

const adapt = (state: VisualStateInput) => createVisualDescriptor(state, visualCatalog);
const diagnostic = (descriptor: SpaceSceneDescriptor, field: string) => descriptor.diagnostics.find(item => item.field === field)!;

describe('geographic identity', () => {
  it('is stable across names, population, districts and array order, distinct between planets', () => {
    const state = homeworld(), before = adapt(state);
    const changed = adapt({ ...state, system: { ...state.system, name: 'Renamed', planet: { ...state.system?.planet, name: 'Also renamed' } }, population: { total: 200 }, districts: { civil_district: 5 }, planets: [...state.planets!].reverse() });
    expect(changed.identity).toEqual(before.identity);
    expect(changed.planet).toEqual(before.planet);
    expect(adapt(colony()).identity.seed).not.toBe(before.identity.seed);
    expect(before.identity.planetKey).toBe(HOME_ID);
  });
  it('has explicit ID fallbacks and never seeds from display names', () => {
    const physical = derivePlanetIdentity({ system: { id: 'system-1-2', planet: { id: 'planet-1-2-1' } } });
    expect(physical.planetKey).toBe('planet-1-2-1');
    expect(derivePlanetIdentity({ system: { x: 1, y: 2 }, active_planet: { planet_index: 1 } }).seed).toContain('1:2:1');
    expect(derivePlanetIdentity({ system: { name: 'Only names', planet: { name: 'Not identity' } } }).seed).toBeNull();
    expect(adapt(incomplete).presentation.planetEnabled).toBe(false);
  });
  it('rejects contradictory active-planet roster coordinates or index', () => {
    const state = colony(); state.planets![1].x = 7;
    const result = adapt(state);
    expect(result.identity.seed).toBeNull(); expect(result.civilization.presence).toBe('UNKNOWN');
    expect(result.civilization.lightsEnabled).toBe(false);
  });
});

describe('physical interpretation', () => {
  it.each([[250, 90, 'frozen'], [273.149, 0, 'frozen'], [273.15, 75, 'oceanic'], [288, 74.999, 'terran'], [310, 20, 'desert'], [288, 20.001, 'terran'], [null, 90, null], [288, null, null], [NaN, 60, null], [Infinity, 60, null], [-1, 60, null], [288, 101, null]] as const)('maps T=%s / water=%s with explicit precedence', (t, water, expected) => {
    expect(derivePlanetFamily(t, water)).toBe(expected);
  });
  it('normalizes domain values with finite bounded artistic transfers', () => {
    const result = adapt(homeworld());
    expect(result.planet.family).toBe('terran');
    expect(result.planet.parameters.waterCoverage).toBe(0.6);
    expect(result.planet.parameters.temperature).toBeCloseTo(0.675);
    expect(result.planet.parameters.mountainIntensity).toBeCloseTo(0.445);
    expect(diagnostic(result, 'planet.parameters.waterCoverage')).toMatchObject({ status: 'HEURISTIC', sources: ['state.system.planet.water'] });
    expect(diagnostic(result, 'planet.parameters.cloudCoverage').status).toBe('DEFAULT');
    for (const temperature of [1, 170, 250, 273.15, 360, 10000, Number.MAX_VALUE]) {
      const state = homeworld(); state.system!.planet!.temperature = temperature;
      const params = adapt(state).planet.parameters;
      expect(Object.values(params).every(Number.isFinite)).toBe(true);
      expect(params.temperature).toBeGreaterThanOrEqual(0); expect(params.temperature).toBeLessThanOrEqual(1);
    }
  });
  it('marks invalid and absent physical data unknown; defaults remain distinguishable', () => {
    const result = adapt({ system: { planet: { temperature: NaN, water: 120, geological_activity: -2, radius: 0, gravity: Infinity, atmosphere: null, mineral_profile: { raw_ore: NaN } } } });
    expect(result.planet.family).toBeNull(); expect(result.planet.environment.water).toBeNull();
    expect(result.planet.environment.gravity).toBeNull(); expect(result.planet.environment.mineral_profile).toBeNull();
    expect(diagnostic(result, 'planet.environment.water').status).toBe('UNKNOWN');
    expect(diagnostic(result, 'planet.parameters.waterCoverage').status).toBe('DEFAULT');
    expect(result.planet.atmosphere.visible).toBe(false);
    expect(diagnostic(result, 'planet.atmosphere.visible').status).toBe('UNKNOWN');
    expect(Object.values(result.planet.parameters).every(Number.isFinite)).toBe(true);
  });
  it('preserves physical and stellar facts without inventing solar angles or physical units', () => {
    const result = adapt(homeworld());
    expect(result.star).toEqual({ stellarClass: 'G', mass: 1, luminosity: 1.2, age: 4, activity: 0.2 });
    expect(result.planet.environment.atmosphere).toBe('temperate nitrogen');
    expect(result.planet.atmosphere.strength).toBe(1);
    expect(diagnostic(result, 'presentation.starAzimuth').status).toBe('DEFAULT');
    expect(diagnostic(result, 'star.mass').status).toBe('GROUNDED');
    for (const atmosphere of ['toString', '__proto__', 'unmeasured atmosphere']) {
      const descriptor = adapt({ ...homeworld(), system: { ...homeworld().system, planet: { atmosphere } } });
      expect(descriptor.planet.atmosphere).toMatchObject({ visible: false, strength: 0 });
      expect(JSON.parse(JSON.stringify(descriptor))).toEqual(descriptor);
    }
  });
});

describe('local inhabitants', () => {
  it('differentiates inhabited, zero and unknown population', () => {
    expect(adapt(homeworld()).civilization).toMatchObject({ presence: 'PRESENT', population: 100, lightsEnabled: true });
    expect(adapt(uninhabited()).civilization).toMatchObject({ presence: 'ABSENT', population: 0, lightsEnabled: false, intensity: 0 });
    expect(adapt(incomplete).civilization).toMatchObject({ presence: 'UNKNOWN', population: null, lightsEnabled: false, intensity: 0 });
  });
  it('uses only the active colony population, never the empire total or the first roster row', () => {
    const state = colony();
    expect(adapt(state).civilization.population).toBe(20);
    state.population = undefined;
    expect(adapt(state).civilization.population).toBe(20);
    expect(adapt({ ...state, planets: [...state.planets!].reverse() }).civilization.population).toBe(20);
    state.active_planet = undefined;
    expect(adapt(state).civilization.population).toBeNull();
    expect(adapt(hostile()).civilization.lightsEnabled).toBe(false);
  });
  it('bounds intensity, increases gradually with grounded population and local infrastructure', () => {
    const intensities = [0, 1, 20, 100, 1000, Number.MAX_SAFE_INTEGER].map(total => adapt({ ...homeworld(), population: { total } }).civilization.intensity);
    expect([...intensities].sort((a, b) => a - b)).toEqual(intensities);
    expect(intensities.every(value => Number.isFinite(value) && value >= 0 && value <= 1.2)).toBe(true);
    expect(adapt(colony()).civilization.intensity).toBeLessThan(adapt(homeworld()).civilization.intensity);
    expect(adapt({ ...homeworld(), districts: { civil_district: 5 } }).civilization.intensity).toBeGreaterThan(adapt(homeworld()).civilization.intensity);
    for (const total of [-1, NaN, Infinity, 1.5]) expect(adapt({ ...homeworld(), population: { total } }).civilization.population).toBeNull();
  });
});

describe('real ship and fleet context', () => {
  it('represents a real Horizon by explicit ID mapping, once, at system scope only', () => {
    const state = systemWithFleet(); state.ships = [...state.ships!, ...state.ships!];
    const result = adapt(state);
    expect(result.ships.visibleCount).toBe(1); expect(result.ships.entities).toHaveLength(1);
    expect(result.ships.entities[0]).toMatchObject({ hullId: 'scout_hull', design: 'horizon-prototype', quantity: 1, presence: 'LOCAL_SYSTEM', context: 'SYSTEM_ONLY', visible: true });
    expect(result.ships.entities[0].fleetId).toBe(state.fleets![0].id);
    expect(adapt({ ...state, active_planet: { id: COLONY_ID, planet_index: 1 } }).ships.entities[0].context).toBe('SYSTEM_ONLY');
  });
  it('does not treat transit origins or destinations as arrived local presence', () => {
    const state = systemWithFleet(); state.fleets = [{ ...state.fleets![0], status: 'TRANSIT', destination_x: 0, destination_y: 0 }];
    expect(adapt(state).ships.entities[0]).toMatchObject({ presence: 'TRANSIT', visible: false });
    state.fleets = [{ ...state.fleets[0], status: 'ARRIVED', x: 5, y: 1 }];
    expect(adapt(state).ships.entities[0]).toMatchObject({ presence: 'REMOTE_SYSTEM', visible: false });
  });
  it('requires explicit time and persisted coordinates for unattached ships', () => {
    const state = systemWithFleet(); state.fleets = [];
    expect(adapt(state).ships.entities[0]).toMatchObject({ presence: 'UNKNOWN', visible: false });
    expect(createVisualDescriptor(state, visualCatalog, { observedAt: 30 }).ships.entities[0]).toMatchObject({ visible: true, context: 'ORIGIN_PLANET' });
    expect(createVisualDescriptor(state, visualCatalog, { observedAt: 29 }).ships.visibleCount).toBe(0);
    state.ships = [{ ...state.ships![0], system_x: null }];
    expect(createVisualDescriptor(state, visualCatalog, { observedAt: 50 }).ships.visibleCount).toBe(0);
  });
  it('preserves unknown hull entities without drawing a substitute ship', () => {
    const result = createVisualDescriptor(unmappedHull(), unmappedCatalog);
    expect(result.ships.entities).toHaveLength(1);
    expect(result.ships.entities[0]).toMatchObject({ hullId: 'fixture_unmapped_hull', design: 'UNKNOWN_DESIGN', visible: false, presence: 'LOCAL_SYSTEM' });
    expect(createVisualDescriptor(systemWithFleet(), { ships: [{ ...HORIZON, classification: 'carrier' }] }).ships.visibleCount).toBe(0);
    expect(adapt(homeworld()).ships.entities).toEqual([]);
  });
  it('fails closed on missing referenced IDs, conflicting records and multiple fleet assignment', () => {
    const state = systemWithFleet();
    expect(adapt({ ...state, ships: [] }).ships.entities).toEqual([]);
    expect(adapt({ ...state, ships: undefined }).ships.coverage).toBe('UNKNOWN');
    const duplicate = { ...state.ships![0], hull_id: 'another-model' };
    const a = adapt({ ...state, ships: [state.ships![0], duplicate] });
    const b = adapt({ ...state, ships: [duplicate, state.ships![0]] });
    expect(a).toEqual(b); expect(a.ships.visibleCount).toBe(0);
    expect(adapt({ ...state, fleets: [...state.fleets!, { ...state.fleets![0], id: 'second-fleet' }] }).ships.visibleCount).toBe(0);
    expect(adapt({ ...state, ships: [{}] }).ships.entities).toEqual([]);
  });
});

it('never promotes shipyard capability or district evidence into the lab station, or seed into a moon', () => {
  const state = homeworld(); state.districts = { orbital_shipyard: 2 };
  const result = adapt(state);
  expect(result.infrastructure.evidence).toEqual([{ districtId: 'orbital_shipyard', level: 2 }]);
  expect(result.infrastructure.station).toEqual({ presence: 'UNKNOWN', visible: false, model: null });
  expect(result.moon).toEqual({ presence: 'UNKNOWN', visible: false });
  expect(diagnostic(result, 'moon').status).toBe('UNKNOWN');
  expect(adapt(homeworld()).infrastructure.station.presence).toBe('UNKNOWN');
});

it('is serializable, immutable and independent of clock/random across all eight fixtures', () => {
  const clock = vi.spyOn(Date, 'now').mockImplementation(() => { throw new Error('No clock permitted'); });
  const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('No randomness permitted'); });
  const freeze = (value: unknown): void => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } };
  try {
    for (const scenario of Object.values(scenarios)) {
      const state = scenario(), catalog = structuredClone(visualCatalog), original = structuredClone(state);
      freeze(state); freeze(catalog);
      const a = createVisualDescriptor(state, catalog), b = createVisualDescriptor(state, catalog);
      expect(a).toEqual(b); expect(state).toEqual(original);
      expect(JSON.parse(JSON.stringify(a))).toEqual(a);
      const numbersFinite = (value: unknown): boolean => typeof value === 'number' ? Number.isFinite(value) : value !== null && typeof value === 'object' ? Object.values(value).every(numbersFinite) : true;
      expect(numbersFinite(a)).toBe(true);
    }
  } finally { clock.mockRestore(); random.mockRestore(); }
});
