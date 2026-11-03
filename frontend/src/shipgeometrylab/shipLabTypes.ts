export const SHIP_CAMERAS = ['3/4 Front', 'Side', 'Top', 'Rear', '3/4 Rear'] as const;
export type ShipCamera = typeof SHIP_CAMERAS[number];
export type ShipLabSettings = {
  hullOnly: boolean; armor: boolean; engines: boolean; details: boolean; boundingBox: boolean;
  silhouette: boolean; paused: boolean; azimuth: number; elevation: number; intensity: number;
  hullTone: number; armorContrast: number; engineEmission: number;
  pixelSize: number; outlines: boolean; dither: boolean; raw: boolean;
};
export const DEFAULT_SHIP_SETTINGS: ShipLabSettings = {
  hullOnly: false, armor: true, engines: true, details: true, boundingBox: false,
  silhouette: false, paused: false, azimuth: 225, elevation: 50, intensity: 3.2,
  hullTone: 1, armorContrast: 1, engineEmission: 1.6,
  pixelSize: 3, outlines: true, dither: true, raw: false,
};
export type ShipLabStats = { fps: number; frameTime: number; triangles: number; drawCalls: number; meshes: number; bounds: [number, number, number]; resolution: string };
