export const CAMERA_PRESETS = ['cinematic', 'equatorial', 'polar', 'full-orbit'] as const;
export type CameraPreset = typeof CAMERA_PRESETS[number];
export const PIXEL_SIZES = [1, 2, 3, 4, 5, 6] as const;
export type PixelSize = typeof PIXEL_SIZES[number];

export type PlanetLabSettings = {
  seed: string;
  waterCoverage: number;
  temperature: number;
  mountainIntensity: number;
  cloudCoverage: number;
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
};

export const DEFAULT_PLANET_LAB_SETTINGS: PlanetLabSettings = {
  seed: 'aurelia-01',
  waterCoverage: 0.58,
  temperature: 0.68,
  mountainIntensity: 0.72,
  cloudCoverage: 0.55,
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
