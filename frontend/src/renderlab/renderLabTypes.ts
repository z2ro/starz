export const HORIZON_ASSET_PATH = '/static/models/horizon.glb';

export const CAMERA_PRESETS = ['3/4 FRONT', 'SIDE', 'REAR', 'TOP'] as const;
export type CameraPreset = (typeof CAMERA_PRESETS)[number];

export type RenderLabOptions = {
  cameraPreset: CameraPreset;
  starAzimuth: number;
  starElevation: number;
  starIntensity: number;
  exposure: number;
  environmentIntensity: number;
  baseRoughness: number;
  surfaceVariation: number;
  metalness: number;
  engineEmission: number;
  materialMode: 'experimental' | 'original';
  showBounds: boolean;
  showAxes: boolean;
};

export const DEFAULT_RENDER_LAB_OPTIONS: RenderLabOptions = {
  cameraPreset: '3/4 FRONT',
  starAzimuth: 42,
  starElevation: 28,
  starIntensity: 3.2,
  exposure: 1.05,
  environmentIntensity: 0.42,
  baseRoughness: 0.52,
  surfaceVariation: 0.075,
  metalness: 0.82,
  engineEmission: 2.4,
  materialMode: 'experimental',
  showBounds: false,
  showAxes: false,
};

export function hasWebGPU(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator && !!navigator.gpu;
}

export function formatBounds(bounds: [number, number, number]): string {
  return bounds.map(value => value.toFixed(2)).join(' × ');
}
