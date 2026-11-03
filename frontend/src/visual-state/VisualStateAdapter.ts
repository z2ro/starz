import { DEFAULT_PLANET_LAB_SETTINGS } from '../planetlab/planetLabTypes';
import { count, finite, nonnegative, text, derivePlanetVisual } from './planetVisualMapping';
import { deriveOrbitalInfrastructure, deriveShipPresence } from './orbitalVisualMapping';
import type { Decision, SpaceSceneDescriptor, VisualCatalogInput, VisualStateInput } from './types';

export function derivePlanetIdentity(state: VisualStateInput, diagnostics: Decision[] = []): SpaceSceneDescriptor['identity'] {
  const system = state.system, active = state.active_planet;
  const coordinates = Number.isSafeInteger(system?.x) && Number.isSafeInteger(system?.y) ? `${system!.x}:${system!.y}` : null;
  const systemKey = text(system?.id) ? system.id : coordinates;
  const physicalId = system?.planet?.id;
  const planetKey = text(active?.id) ? active.id : text(physicalId) ? physicalId : count(active?.planet_index) && coordinates ? `${coordinates}:${active.planet_index}` : null;
  const rows = text(active?.id) ? state.planets?.filter(planet => planet.id === active.id) ?? [] : [];
  const inconsistent = rows.some(row => row.x !== system?.x || row.y !== system?.y || (count(active?.planet_index) && row.planet_index !== active.planet_index));
  const identity = { systemKey, planetKey: inconsistent ? null : planetKey, seed: systemKey && planetKey && !inconsistent ? `starz:visual:v1:${JSON.stringify([systemKey, planetKey])}` : null };
  diagnostics.push({ field: 'identity.systemKey', sources: ['state.system.id', 'state.system.x/y'], status: systemKey ? 'GROUNDED' : 'UNKNOWN', rule: 'API procedural system ID, else integer coordinates; neither is a database universe UUID', result: systemKey });
  diagnostics.push({ field: 'identity.planetKey', sources: ['state.active_planet.id', 'state.system.planet.id', 'state.active_planet.planet_index', 'state.planets'], status: identity.planetKey ? 'GROUNDED' : 'UNKNOWN', rule: 'persistent planet UUID > procedural planet ID > coordinates + planet_index; contradictory roster -> unknown', result: identity.planetKey });
  diagnostics.push({ field: 'identity.seed', sources: ['identity.systemKey', 'identity.planetKey'], status: identity.seed ? 'HEURISTIC' : 'UNKNOWN', rule: 'versioned injective JSON tuple, consumed by existing generator hash; no display name, clock or list index', result: identity.seed });
  return identity;
}

export function deriveCivilizationVisual(state: VisualStateInput, catalog: VisualCatalogInput, scoped: boolean, diagnostics: Decision[]): SpaceSceneDescriptor['civilization'] {
  const rows = scoped && text(state.active_planet?.id) ? state.planets?.filter(item => item.id === state.active_planet?.id) ?? [] : [];
  const row = rows.length && rows.every(item => item.population_total === rows[0].population_total) ? rows[0] : undefined;
  const direct = state.population?.total;
  const population = scoped ? count(direct) ? direct : direct === undefined || direct === null ? count(row?.population_total) ? row.population_total : null : null : null;
  const knownDistricts = catalog.districts;
  const infrastructureLevels = scoped && state.districts && knownDistricts ? Object.entries(state.districts).filter(([id, level]) => count(level) && knownDistricts.some(item => item.id === id)).reduce((sum, [, level]) => Math.min(1000, sum + level), 0) : null;
  const presence = population === null ? 'UNKNOWN' : population > 0 ? 'PRESENT' : 'ABSENT';
  const lightsEnabled = presence === 'PRESENT';
  const intensity = lightsEnabled ? Math.min(1.2, 0.08 + 0.85 * population! / (population! + 100) + 0.15 * (infrastructureLevels ?? 0) / ((infrastructureLevels ?? 0) + 5)) : 0;
  diagnostics.push({ field: 'civilization.population', sources: ['state.population.total', 'state.active_planet', 'state.planets.population_total'], status: population === null ? 'UNKNOWN' : 'GROUNDED', rule: 'active snapshot total, else matching roster row only if total absent; no imperial sum', result: population });
  diagnostics.push({ field: 'civilization.presence', sources: ['civilization.population'], status: population === null ? 'UNKNOWN' : 'GROUNDED', rule: 'unknown != zero; positive count proves inhabitants, not urbanization', result: presence });
  diagnostics.push({ field: 'civilization.infrastructureLevels', sources: ['state.districts', 'catalog.districts'], status: infrastructureLevels === null ? 'UNKNOWN' : 'HEURISTIC', rule: 'sum known valid local levels, capped 1000; visual support signal, not urban district count', result: infrastructureLevels });
  diagnostics.push({ field: 'civilization.lightsEnabled', sources: ['civilization.presence'], status: lightsEnabled ? 'HEURISTIC' : population === null ? 'UNKNOWN' : 'GROUNDED', rule: 'inhabited permits sparse simulated lights; generator eligibility still applies, frozen may have none', result: lightsEnabled });
  diagnostics.push({ field: 'civilization.intensity', sources: ['civilization.population', 'civilization.infrastructureLevels'], status: lightsEnabled ? 'HEURISTIC' : population === null ? 'UNKNOWN' : 'GROUNDED', rule: 'positive: min(1.2, .08 + .85*p/(p+100) + .15*d/(d+5)); unknown/zero: hide with 0; not city count', result: intensity });
  return { presence, population, infrastructureLevels, lightsEnabled, intensity };
}

export function createVisualDescriptor(state: VisualStateInput, catalog: VisualCatalogInput = {}, options: { observedAt?: number } = {}): SpaceSceneDescriptor {
  const diagnostics: Decision[] = [];
  const identity = derivePlanetIdentity(state, diagnostics);
  const active = state.active_planet;
  const scoped = identity.seed !== null && (text(active?.id) || count(active?.planet_index));
  const planet = derivePlanetVisual(state.system?.planet, diagnostics);
  const sourceStar = state.system?.star;
  const starValue = (key: 'mass' | 'luminosity' | 'age' | 'activity') => {
    const value = sourceStar?.[key];
    const valid = nonnegative(value) && (key !== 'mass' || value > 0);
    diagnostics.push({ field: `star.${key}`, sources: [`state.system.star.${key}`], status: valid ? 'GROUNDED' : 'UNKNOWN', rule: 'preserve finite domain scalar; physical unit not declared by backend; no lighting formula', result: valid ? value : null });
    return valid ? value : null;
  };
  const stellarClass = text(sourceStar?.stellar_class) ? sourceStar.stellar_class : null;
  const star = { stellarClass, mass: starValue('mass'), luminosity: starValue('luminosity'), age: starValue('age'), activity: starValue('activity') };
  diagnostics.push({ field: 'star.stellarClass', sources: ['state.system.star.stellar_class'], status: stellarClass ? 'GROUNDED' : 'UNKNOWN', rule: 'preserve class; no invented spectral color/temperature', result: stellarClass });
  const civilization = deriveCivilizationVisual(state, catalog, scoped, diagnostics);
  const ships = deriveShipPresence(state, catalog, finite(options.observedAt) && options.observedAt >= 0 ? options.observedAt : undefined, diagnostics);
  const infrastructure = deriveOrbitalInfrastructure(state, catalog, scoped, diagnostics);
  const presentation: SpaceSceneDescriptor['presentation'] = { planetEnabled: identity.seed !== null, fallbackFamily: 'terran', starAzimuth: DEFAULT_PLANET_LAB_SETTINGS.starAzimuth, starElevation: DEFAULT_PLANET_LAB_SETTINGS.starElevation, lightIntensity: DEFAULT_PLANET_LAB_SETTINGS.lightIntensity, shipLength: 1, scaleMeaning: 'LAB_UNITS_NOT_PHYSICAL' };
  for (const [field, result] of Object.entries(presentation)) diagnostics.push({ field: `presentation.${field}`, sources: field === 'planetEnabled' ? ['identity.seed'] : [], status: field === 'planetEnabled' ? identity.seed ? 'HEURISTIC' : 'UNKNOWN' : 'DEFAULT', rule: field === 'planetEnabled' ? 'hide until stable identity exists' : 'lab presentation only; no measured distance, azimuth or physical scale', result });
  diagnostics.push({ field: 'moon', sources: [], status: 'UNKNOWN', rule: 'no natural satellite entity in API, backend universe generator or relational models; presentation hidden', result: false });
  return { version: 1, identity, planet, star, civilization, ships, infrastructure, moon: { presence: 'UNKNOWN', visible: false }, presentation, diagnostics };
}
