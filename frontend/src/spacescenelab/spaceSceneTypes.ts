import { DEFAULT_PLANET_LAB_SETTINGS, type PlanetFamily } from '../planetlab/planetLabTypes';

export const SPACE_CAMERAS = ['Cinematic', 'Planet Focus', 'Ship Focus', 'Orbit Overview', 'Moon Focus', 'Station Focus'] as const;
export type SpaceCamera = typeof SPACE_CAMERAS[number];
export type SpaceSceneSettings = {
  family: PlanetFamily; seed: string; regeneration: number;
  shipVisible: boolean; shipLength: number; engineEmission: number;
  moonVisible: boolean; moonSpeed: number; moonScale: number;
  stationVisible: boolean; stationSpeed: number; stationScale: number;
  cityVisible: boolean; cityIntensity: number;
  orbitSpeed: number; orbitInclination: number; orbitRadius: number; paused: boolean;
  starAzimuth: number; starElevation: number; intensity: number;
  pixelSize: number; outlines: boolean; dither: boolean; raw: boolean;
};
export const DEFAULT_SPACE_SETTINGS: SpaceSceneSettings = {
  family: 'terran', seed: DEFAULT_PLANET_LAB_SETTINGS.seed, regeneration: 0,
  shipVisible: true, shipLength: 1, engineEmission: 1.6,
  moonVisible: true, moonSpeed: 0.035, moonScale: 0.24,
  stationVisible: true, stationSpeed: 0.065, stationScale: 0.18,
  cityVisible: true, cityIntensity: 1.2,
  orbitSpeed: 0.22, orbitInclination: 10, orbitRadius: 2.05, paused: false,
  starAzimuth: DEFAULT_PLANET_LAB_SETTINGS.starAzimuth, starElevation: DEFAULT_PLANET_LAB_SETTINGS.starElevation,
  intensity: DEFAULT_PLANET_LAB_SETTINGS.lightIntensity,
  pixelSize: 3, outlines: true, dither: true, raw: false,
};
export type SpaceSceneStats = {
  fps: number; frameTime: number; triangles: number; drawCalls: number; resolution: string;
  orbitPhase: number; shipCenterOccluded: boolean; visualTime: number; safeRadius: number;
};
