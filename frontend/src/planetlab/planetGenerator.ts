import type { PlanetFamily, PlanetGenerationDiagnostics, PlanetGenerationParameters } from './planetLabTypes';

export type PlanetGenerationSettings = PlanetGenerationParameters & { seed: string; family: PlanetFamily };
export type PlanetBiome = 'ocean' | 'shelf' | 'sea-ice' | 'ice' | 'rock' | 'desert' | 'mineral' | 'forest' | 'tundra' | 'grassland';
export type PlanetSample = { land: boolean; elevation: number; oceanDepth: number; temperature: number; moisture: number; geology: number; ice: boolean; coastal: boolean; biome: PlanetBiome };
type Direction = { x: number; y: number; z: number };

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const smooth = (value: number) => { const x = clamp(value); return x * x * (3 - 2 * x); };

export function seedNumber(seed: string): number {
  let value = 2166136261;
  for (let index = 0; index < seed.length; index += 1) value = Math.imul(value ^ seed.charCodeAt(index), 16777619);
  return value >>> 0;
}

const hash3 = (x: number, y: number, z: number, seed: number) => {
  const value = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 0.00017) * 43758.5453123;
  return value - Math.floor(value);
};

function valueNoise(x: number, y: number, z: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = smooth(x - ix), fy = smooth(y - iy), fz = smooth(z - iz);
  const sample = (dx: number, dy: number, dz: number) => hash3(ix + dx, iy + dy, iz + dz, seed);
  const x00 = sample(0, 0, 0) * (1 - fx) + sample(1, 0, 0) * fx;
  const x10 = sample(0, 1, 0) * (1 - fx) + sample(1, 1, 0) * fx;
  const x01 = sample(0, 0, 1) * (1 - fx) + sample(1, 0, 1) * fx;
  const x11 = sample(0, 1, 1) * (1 - fx) + sample(1, 1, 1) * fx;
  return (x00 * (1 - fy) + x10 * fy) * (1 - fz) + (x01 * (1 - fy) + x11 * fy) * fz;
}

function fbm(x: number, y: number, z: number, seed: number, octaves = 4): number {
  let sum = 0, amplitude = 0.5, frequency = 1, total = 0;
  for (let index = 0; index < octaves; index += 1) {
    sum += valueNoise(x * frequency, y * frequency, z * frequency, seed + index * 97) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  return sum / total;
}

export function samplePlanet(direction: Direction, settings: PlanetGenerationSettings): PlanetSample {
  // Keep the approved Terran geography; other families have deterministic independent geography.
  const seed = seedNumber(settings.family === 'terran' ? settings.seed : `${settings.seed}:${settings.family}`);
  const warpX = (fbm(direction.x * 2.1 + 4, direction.y * 2.1, direction.z * 2.1, seed + 11, 3) - 0.5) * settings.warpStrength;
  const warpY = (fbm(direction.x * 2.1, direction.y * 2.1 + 8, direction.z * 2.1, seed + 23, 3) - 0.5) * settings.warpStrength;
  const warpZ = (fbm(direction.x * 2.1, direction.y * 2.1, direction.z * 2.1 + 13, seed + 37, 3) - 0.5) * settings.warpStrength;
  const x = direction.x + warpX, y = direction.y + warpY, z = direction.z + warpZ;
  const continental = fbm(x * settings.continentScale, y * settings.continentScale, z * settings.continentScale, seed, 5);
  const ridged = 1 - Math.abs(fbm(x * 3.3 + 7, y * 3.3, z * 3.3, seed + 71, 4) * 2 - 1);
  const seaLevel = 0.25 + settings.waterCoverage * 0.42;
  const land = continental > seaLevel;
  const elevation = land ? clamp((continental - seaLevel) / (1 - seaLevel) * 1.65 + Math.pow(ridged, 5) * settings.mountainIntensity * 0.48) : 0;
  const regional = (fbm(x * 2.8 - 19, y * 2.8 + 3, z * 2.8 + 5, seed + 101, 3) - 0.5) * 0.2;
  const temperature = clamp(settings.temperature * (1 - Math.abs(direction.y) * 0.82) + regional - elevation * 0.16);
  const moisture = clamp(fbm(x * 3.9 + 2, y * 3.9 - 4, z * 3.9 + 9, seed + 151, 4) * 0.85 + (1 - Math.abs(direction.y)) * 0.12 + settings.moistureBias);
  const geology = fbm(x * 2.4 - 5, y * 2.4 + 12, z * 2.4, seed + 211, 3);
  const oceanDepth = clamp((seaLevel - continental) * 6);
  const ice = temperature < 0.15 && !(land && elevation > 0.58 && geology > 0.52);
  let biome: PlanetBiome;
  if (ice) biome = land ? 'ice' : 'sea-ice';
  else if (!land) biome = oceanDepth < 0.15 ? 'shelf' : 'ocean';
  else if (temperature < 0.16 || elevation > 0.76) biome = 'rock';
  else if (temperature > 0.48 && moisture < 0.47) biome = geology > 0.53 ? 'mineral' : 'desert';
  else if (moisture < 0.28) biome = elevation > 0.5 ? 'rock' : geology > 0.53 ? 'mineral' : 'desert';
  else if (temperature < 0.32) biome = 'tundra';
  else if (moisture > 0.65) biome = 'forest';
  else biome = 'grassland';
  return { land, elevation, oceanDepth, temperature, moisture, geology, ice, coastal: Math.abs(continental - seaLevel) < 0.018, biome };
}

export function sampleCloud(direction: Direction, settings: PlanetGenerationSettings): number {
  if (settings.cloudCoverage <= 0) return 0;
  const seed = seedNumber(settings.seed);
  const cloudNoise = fbm(direction.x * 4.2 + 3, direction.y * 4.2 - 7, direction.z * 4.2 + 11, seed + 401, 4);
  return smooth((cloudNoise - (0.75 - settings.cloudCoverage * 0.42)) * 8);
}

export function planetSurfaceColor(sample: PlanetSample): [number, number, number] {
  if (sample.ice) {
    const variation = sample.geology * 25 + sample.elevation * 16;
    return sample.land ? [176 + variation, 202 + variation, 207 + variation] : [132 + variation, 182 + variation, 205 + variation];
  }
  if (!sample.land) {
    const shallow = 1 - sample.oceanDepth;
    return [12 + shallow * 14, 44 + shallow * 44, 72 + shallow * 32];
  }
  let rgb: [number, number, number];
  switch (sample.biome) {
    case 'rock': rgb = [93, 94, 90]; break;
    case 'desert': rgb = [166, 135, 78]; break;
    case 'mineral': rgb = [106, 87, 64]; break;
    case 'forest': rgb = [43, 105, 74]; break;
    case 'tundra': rgb = [97, 116, 113]; break;
    default: rgb = [91, 133, 78];
  }
  const shade = sample.elevation * 24;
  return rgb.map(value => clamp(value + shade, 0, 255)) as [number, number, number];
}

export type PlanetSurfaceData = { color: Uint8ClampedArray; roughness: Uint8ClampedArray; clouds: Uint8ClampedArray; diagnostics: PlanetGenerationDiagnostics };

export function generatePlanetData(settings: PlanetGenerationSettings, width = 512, height = 256): PlanetSurfaceData {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2) throw new RangeError('Planet texture dimensions must be integers >= 2');
  const started = performance.now();
  const color = new Uint8ClampedArray(width * height * 4);
  const roughness = new Uint8ClampedArray(color.length);
  const clouds = new Uint8ClampedArray(color.length);
  let area = 0, water = 0, openWater = 0, ice = 0, coastal = 0;
  let elevationMin = Infinity, elevationMax = -Infinity, temperatureMin = Infinity, temperatureMax = -Infinity;
  const biomes: Record<string, number> = {};
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const lon = (x + 0.5) / width * Math.PI * 2;
    const lat = (0.5 - (y + 0.5) / height) * Math.PI;
    const direction = { x: -Math.cos(lat) * Math.cos(lon), y: Math.sin(lat), z: Math.cos(lat) * Math.sin(lon) };
    const sample = samplePlanet(direction, settings);
    const index = (y * width + x) * 4;
    const rgb = planetSurfaceColor(sample);
    color.set([...rgb, 255], index);
    const rough = sample.ice ? 155 : sample.land ? 190 + Math.round(sample.elevation * 40) : 55;
    roughness.set([rough, rough, rough, 255], index);
    const density = Math.round(sampleCloud(direction, settings) * 255);
    clouds.set([density, density, density, 255], index);
    // Integrate each latitude row's spherical area, not its equirectangular pixel count.
    const north = Math.min(Math.PI / 2, lat + Math.PI / height / 2);
    const south = Math.max(-Math.PI / 2, lat - Math.PI / height / 2);
    const weight = Math.sin(north) - Math.sin(south);
    area += weight;
    water += sample.land ? 0 : weight;
    openWater += !sample.land && !sample.ice ? weight : 0;
    ice += sample.ice ? weight : 0;
    coastal += sample.coastal ? weight : 0;
    biomes[sample.biome] = (biomes[sample.biome] ?? 0) + weight;
    elevationMin = Math.min(elevationMin, sample.elevation);
    elevationMax = Math.max(elevationMax, sample.elevation);
    temperatureMin = Math.min(temperatureMin, sample.temperature);
    temperatureMax = Math.max(temperatureMax, sample.temperature);
  }
  for (const biome of Object.keys(biomes)) biomes[biome] /= area;
  return { color, roughness, clouds, diagnostics: {
    waterCoverage: water / area, openWaterCoverage: openWater / area, iceCoverage: ice / area, coastalCoverage: coastal / area,
    biomeCount: Object.values(biomes).filter(fraction => fraction > 0.001).length,
    biomes, elevationMin, elevationMax, temperatureMin, temperatureMax,
    generationMs: performance.now() - started, width, height,
  } };
}

export function generatePlanetTextures(settings: PlanetGenerationSettings, width = 512, height = 256) {
  const data = generatePlanetData(settings, width, height);
  const canvasFrom = (pixels: Uint8ClampedArray) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D não disponível');
    const image = context.createImageData(width, height);
    image.data.set(pixels);
    context.putImageData(image, 0, 0);
    return canvas;
  };
  return { color: canvasFrom(data.color), roughness: canvasFrom(data.roughness), clouds: canvasFrom(data.clouds), diagnostics: data.diagnostics };
}
