export type PlanetVisualMode = 'image' | 'procedural';
export const PLANET_VISUAL_PREFERENCE_KEY = 'starz.planet.visual-mode.v1';

export function readPlanetVisualPreference(): PlanetVisualMode {
  try { return window.localStorage.getItem(PLANET_VISUAL_PREFERENCE_KEY) === 'procedural' ? 'procedural' : 'image'; }
  catch { return 'image'; }
}
export function savePlanetVisualPreference(mode: PlanetVisualMode) {
  try { window.localStorage.setItem(PLANET_VISUAL_PREFERENCE_KEY, mode); } catch { /* Storage may be unavailable; the current in-memory selection still works. */ }
}
