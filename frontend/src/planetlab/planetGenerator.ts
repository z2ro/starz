export type PlanetGenerationSettings = Pick<
  import('./planetLabTypes').PlanetLabSettings,
  'seed' | 'waterCoverage' | 'temperature' | 'mountainIntensity' | 'cloudCoverage'
>;

export type PlanetSample = { land: boolean; elevation: number; oceanDepth: number; temperature: number; moisture: number };

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

export function samplePlanet(direction: { x: number; y: number; z: number }, settings: PlanetGenerationSettings): PlanetSample {
  const seed = seedNumber(settings.seed);
  const warpX = (fbm(direction.x * 2.1 + 4, direction.y * 2.1, direction.z * 2.1, seed + 11, 3) - 0.5) * 0.38;
  const warpY = (fbm(direction.x * 2.1, direction.y * 2.1 + 8, direction.z * 2.1, seed + 23, 3) - 0.5) * 0.38;
  const warpZ = (fbm(direction.x * 2.1, direction.y * 2.1, direction.z * 2.1 + 13, seed + 37, 3) - 0.5) * 0.38;
  const x = direction.x + warpX, y = direction.y + warpY, z = direction.z + warpZ;
  const continental = fbm(x * 1.55, y * 1.55, z * 1.55, seed, 5);
  const ridged = 1 - Math.abs(fbm(x * 3.3 + 7, y * 3.3, z * 3.3, seed + 71, 4) * 2 - 1);
  const seaLevel = 0.25 + settings.waterCoverage * 0.42;
  const land = continental > seaLevel;
  const elevation = land ? clamp((continental - seaLevel) / (1 - seaLevel) * 1.65 + Math.pow(ridged, 5) * settings.mountainIntensity * 0.48) : 0;
  const regional = (fbm(x * 2.8 - 19, y * 2.8 + 3, z * 2.8 + 5, seed + 101, 3) - 0.5) * 0.2;
  const temperature = clamp(settings.temperature * (1 - Math.abs(direction.y) * 0.82) + regional - elevation * 0.16);
  const moisture = clamp(fbm(x * 3.9 + 2, y * 3.9 - 4, z * 3.9 + 9, seed + 151, 4) * 0.85 + (1 - Math.abs(direction.y)) * 0.12);
  return { land, elevation, oceanDepth: clamp((seaLevel - continental) * 6), temperature, moisture };
}

export type GeneratedPlanetTextures = { color: HTMLCanvasElement; roughness: HTMLCanvasElement; clouds: HTMLCanvasElement };

const color = (context: CanvasRenderingContext2D, x: number, y: number, r: number, g: number, b: number, a = 255) => {
  context.fillStyle = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
  context.fillRect(x, y, 1, 1);
};

export function generatePlanetTextures(settings: PlanetGenerationSettings, width = 512, height = 256): GeneratedPlanetTextures {
  const colorCanvas = document.createElement('canvas');
  const roughnessCanvas = document.createElement('canvas');
  const cloudsCanvas = document.createElement('canvas');
  colorCanvas.width = roughnessCanvas.width = cloudsCanvas.width = width;
  colorCanvas.height = roughnessCanvas.height = cloudsCanvas.height = height;
  const colorContext = colorCanvas.getContext('2d');
  const roughnessContext = roughnessCanvas.getContext('2d');
  const cloudContext = cloudsCanvas.getContext('2d');
  if (!colorContext || !roughnessContext || !cloudContext) throw new Error('Canvas 2D não disponível');
  const seed = seedNumber(settings.seed);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const lon = x / width * Math.PI * 2;
    const lat = (0.5 - y / height) * Math.PI;
    const direction = { x: -Math.cos(lat) * Math.cos(lon), y: Math.sin(lat), z: Math.cos(lat) * Math.sin(lon) };
    const sample = samplePlanet(direction, settings);
    let r = 8, g = 32, b = 57;
    if (sample.land) {
      if (sample.temperature < 0.16) [r, g, b] = [185, 213, 216];
      else if (sample.elevation > 0.76) [r, g, b] = [93, 94, 90];
      else if (sample.temperature > 0.48 && sample.moisture < 0.47) [r, g, b] = [166, 135, 78];
      else if (sample.moisture > 0.65) [r, g, b] = [43, 105, 74];
      else if (sample.temperature < 0.32) [r, g, b] = [91, 119, 94];
      else [r, g, b] = [91, 133, 78];
      const shade = Math.round(sample.elevation * 24);
      r = clamp(r + shade, 0, 255); g = clamp(g + shade, 0, 255); b = clamp(b + shade, 0, 255);
    } else {
      const shallow = 1 - sample.oceanDepth;
      [r, g, b] = [7 + Math.round(shallow * 8), 32 + Math.round(shallow * 39), 60 + Math.round(shallow * 29)];
    }
    if (sample.temperature < 0.15) [r, g, b] = [185, 213, 216];
    color(colorContext, x, y, r, g, b);
    const roughness = sample.land ? 190 + Math.round(sample.elevation * 40) : 55;
    color(roughnessContext, x, y, roughness, roughness, roughness);
    const cloudNoise = fbm(direction.x * 4.2 + 3, direction.y * 4.2 - 7, direction.z * 4.2 + 11, seed + 401, 4);
    const cloud = smooth((cloudNoise - (0.75 - settings.cloudCoverage * 0.42)) * 8);
    const density = Math.round(cloud * 255);
    color(cloudContext, x, y, density, density, density);
  }
  return { color: colorCanvas, roughness: roughnessCanvas, clouds: cloudsCanvas };
}
