import { PLANET_PRESETS, type PlanetFamily } from '../planetlab/planetLabTypes';
import type { Decision, SpaceSceneDescriptor, VisualStateInput } from './types';

export const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
export const nonnegative = (value: unknown): value is number => finite(value) && value >= 0;
export const count = (value: unknown): value is number => nonnegative(value) && Number.isSafeInteger(value);
export const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
export const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));

export function derivePlanetFamily(temperature: number | null, water: number | null): PlanetFamily | null {
  temperature = finite(temperature) && temperature > 0 ? temperature : null;
  water = nonnegative(water) && water <= 100 ? water : null;
  if (temperature !== null && temperature < 273.15) return 'frozen';
  if (temperature === null || water === null) return null;
  return water >= 75 ? 'oceanic' : water <= 20 ? 'desert' : 'terran';
}

export function derivePlanetVisual(physical: NonNullable<VisualStateInput['system']>['planet'], diagnostics: Decision[]): SpaceSceneDescriptor['planet'] {
  const source = 'state.system.planet.';
  const numeric = (key: Exclude<keyof NonNullable<typeof physical>, 'id' | 'name' | 'atmosphere' | 'mineral_profile'>, max = Infinity, positive = false) => {
    const value = physical?.[key];
    const valid = nonnegative(value) && value <= max && (!positive || value > 0);
    diagnostics.push({ field: `planet.environment.${key}`, sources: [source + key], status: valid ? 'GROUNDED' : 'UNKNOWN', rule: `finite ${positive ? 'positive' : 'nonnegative'} value${max === Infinity ? '' : ` <= ${max}`}; invalid/missing -> null`, result: valid ? value : null });
    return valid ? value : null;
  };
  const environment: SpaceSceneDescriptor['planet']['environment'] = {
    mass: numeric('mass', Infinity, true), radius: numeric('radius', Infinity, true), gravity: numeric('gravity', Infinity, true), orbital_distance: numeric('orbital_distance', Infinity, true),
    temperature: numeric('temperature', Infinity, true), water: numeric('water', 100), geological_activity: numeric('geological_activity', 1),
    radiation: numeric('radiation'), magnetic_field: numeric('magnetic_field'), usable_surface: numeric('usable_surface', 100),
    atmosphere: text(physical?.atmosphere) ? physical.atmosphere : null,
    mineral_profile: physical?.mineral_profile && Object.values(physical.mineral_profile).every(nonnegative) ? Object.fromEntries(Object.entries(physical.mineral_profile).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : null,
  };
  for (const key of ['atmosphere', 'mineral_profile'] as const) diagnostics.push({ field: `planet.environment.${key}`, sources: [source + key], status: environment[key] === null ? 'UNKNOWN' : 'GROUNDED', rule: 'preserve valid profile; no inferred chemistry or mineral units', result: environment[key] === null ? null : key === 'atmosphere' ? environment.atmosphere : 'profile retained' });
  const family = derivePlanetFamily(environment.temperature, environment.water);
  diagnostics.push({ field: 'planet.family', sources: [source + 'temperature', source + 'water'], status: family ? 'HEURISTIC' : 'UNKNOWN', rule: 'precedence: T < 273.15 K frozen; otherwise require T + water; water >= 75 oceanic, <= 20 desert, else terran; visual taxonomy, not viability', result: family });
  const preset = PLANET_PRESETS[family ?? 'terran'];
  const parameters = { ...preset.parameters };
  for (const key of Object.keys(parameters) as Array<keyof typeof parameters>) {
    let mapped = false, sources: string[] = [], rule = 'family preset; no measured physical counterpart';
    if (key === 'waterCoverage' && environment.water !== null) { parameters[key] = clamp(environment.water / 100); mapped = true; sources = [source + 'water']; rule = 'water percent / 100 -> visual sea-level control, NOT measured ocean fraction'; }
    if (key === 'temperature' && environment.temperature !== null) { parameters[key] = clamp((environment.temperature - 180) / 160); if (family === 'frozen') parameters[key] = Math.min(0.28, parameters[key]); mapped = true; sources = [source + 'temperature']; rule = 'clamp((Kelvin - 180) / 160, 0, 1); frozen capped at 0.28 for ice readability; artistic transfer'; }
    if (key === 'mountainIntensity' && environment.geological_activity !== null) { parameters[key] = clamp(0.25 + environment.geological_activity * 0.65); mapped = true; sources = [source + 'geological_activity']; rule = '0.25 + 0.65 * activity; artistic relief cue, not measured altitude'; }
    diagnostics.push({ field: `planet.parameters.${key}`, sources, status: mapped ? 'HEURISTIC' : 'DEFAULT', rule, result: parameters[key] });
  }
  const strengths = new Map<string, number>([['thin nitrogen', 0.45], ['temperate nitrogen', 1], ['dense methane', 0.8]]);
  const strength = environment.atmosphere === null ? undefined : strengths.get(environment.atmosphere);
  const atmosphere = { visible: strength !== undefined, color: preset.atmosphereColor, strength: strength ?? 0 };
  diagnostics.push({ field: 'planet.atmosphere.visible', sources: [source + 'atmosphere'], status: strength !== undefined ? 'HEURISTIC' : 'UNKNOWN', rule: 'explicit known profile presentation only; unsupported profile hidden, not proof of vacuum', result: atmosphere.visible });
  diagnostics.push({ field: 'planet.atmosphere.strength', sources: [source + 'atmosphere'], status: strength !== undefined ? 'HEURISTIC' : 'UNKNOWN', rule: 'thin nitrogen .45, temperate nitrogen 1, dense methane .8; artistic opacity, not pressure', result: atmosphere.strength });
  diagnostics.push({ field: 'planet.atmosphere.color', sources: [], status: 'DEFAULT', rule: 'existing family palette, not spectral scattering', result: atmosphere.color });
  return { family, parameters, environment, atmosphere };
}
