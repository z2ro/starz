export const CAMERA_PRESETS = ['cinematic', 'equatorial', 'polar', 'full-orbit'] as const;
export type CameraPreset = typeof CAMERA_PRESETS[number];
export const PIXEL_SIZES = [1, 2, 3, 4, 5, 6] as const;
export type PixelSize = typeof PIXEL_SIZES[number];

export const PLANET_FAMILIES = ['terran', 'oceanic', 'desert', 'frozen'] as const;
export type PlanetFamily = typeof PLANET_FAMILIES[number];
export type PlanetGenerationParameters = {
  waterCoverage: number;
  temperature: number;
  mountainIntensity: number;
  cloudCoverage: number;
  continentScale: number;
  warpStrength: number;
  moistureBias: number;
};
export type PlanetPreset = { family: PlanetFamily; parameters: PlanetGenerationParameters; atmosphereColor: string; atmosphereStrength: number };

export const PLANET_PRESETS: Record<PlanetFamily, PlanetPreset> = {
  terran: { family: 'terran', parameters: { waterCoverage: 0.58, temperature: 0.68, mountainIntensity: 0.72, cloudCoverage: 0.55, continentScale: 1.55, warpStrength: 0.38, moistureBias: 0 }, atmosphereColor: '#65cbe6', atmosphereStrength: 1 },
  oceanic: { family: 'oceanic', parameters: { waterCoverage: 0.83, temperature: 0.72, mountainIntensity: 0.58, cloudCoverage: 0.68, continentScale: 2.6, warpStrength: 0.48, moistureBias: 0.16 }, atmosphereColor: '#8bd3e4', atmosphereStrength: 0.9 },
  desert: { family: 'desert', parameters: { waterCoverage: 0.08, temperature: 0.88, mountainIntensity: 0.92, cloudCoverage: 0.18, continentScale: 1.8, warpStrength: 0.28, moistureBias: -0.38 }, atmosphereColor: '#c1a682', atmosphereStrength: 0.45 },
  frozen: { family: 'frozen', parameters: { waterCoverage: 0.62, temperature: 0.22, mountainIntensity: 0.88, cloudCoverage: 0.32, continentScale: 1.35, warpStrength: 0.32, moistureBias: -0.06 }, atmosphereColor: '#a8c8d8', atmosphereStrength: 0.65 },
};

export const TEST_SEEDS = ['STARZ-001', 'STARZ-002', 'STARZ-003', 'STARZ-004', 'STARZ-005'] as const;

export function adjacentTestSeed(seed: string, direction: -1 | 1): string {
  const index = TEST_SEEDS.findIndex(value => value === seed);
  if (index < 0) return direction === 1 ? TEST_SEEDS[0] : TEST_SEEDS[TEST_SEEDS.length - 1];
  return TEST_SEEDS[(index + direction + TEST_SEEDS.length) % TEST_SEEDS.length];
}

export type PlanetGenerationDiagnostics = {
  waterCoverage: number;
  openWaterCoverage: number;
  iceCoverage: number;
  coastalCoverage: number;
  biomeCount: number;
  biomes: Record<string, number>;
  elevationMin: number;
  elevationMax: number;
  temperatureMin: number;
  temperatureMax: number;
  generationMs: number;
  width: number;
  height: number;
};

export type PlanetLabSettings = PlanetGenerationParameters & {
  family: PlanetFamily;
  seed: string;
  axialTilt: number;
  starAzimuth: number;
  starElevation: number;
  lightIntensity: number;
  planetRotationSpeed: number;
  shipOrbitSpeed: number;
  paused: boolean;
  pixelSize: PixelSize;
  outline: boolean;
  dither: boolean;
  raw3d: boolean;
  regeneration: number;
};

export type PlanetLabStats = {
  fps: number;
  frameTime: number;
  triangles: number;
  drawCalls: number;
  seed: string;
  renderResolution: string;
  generation?: PlanetGenerationDiagnostics;
};

export const DEFAULT_PLANET_LAB_SETTINGS: PlanetLabSettings = {
  seed: 'aurelia-01',
  family: 'terran',
  ...PLANET_PRESETS.terran.parameters,
  axialTilt: 18,
  starAzimuth: 135,
  starElevation: 34,
  lightIntensity: 2.2,
  planetRotationSpeed: 0.035,
  shipOrbitSpeed: 0.22,
  paused: false,
  pixelSize: 3,
  outline: true,
  dither: true,
  raw3d: false,
  regeneration: 0,
};

export const isPixelSize = (value: number): value is PixelSize => (PIXEL_SIZES as readonly number[]).includes(value);
