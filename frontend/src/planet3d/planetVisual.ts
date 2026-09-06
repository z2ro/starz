export type Vector3Like = { x: number; y: number; z: number };

export type PlanetVisualConfig = {
  oceanColor: string;
  landColor: string;
  landAccent: string;
  iceColor: string;
  atmosphereColor: string;
  atmosphereOpacity: number;
  cloudOpacity: number;
};

export type StarVisualConfig = {
  color: string;
  intensity: number;
  radius: number;
  haloOpacity: number;
};

export type StarfieldLayer = {
  positions: Vector3Like[];
  size: number;
  opacity: number;
  color: string;
};

export type DistrictPlacement = {
  latitude: number;
  longitude: number;
  scale: number;
};

export function seededRandom(seed: string, purpose: string, index = 0): number {
  let hash = 2166136261;
  const value = `${seed}:${purpose}:${index}`;
  for (let offset = 0; offset < value.length; offset += 1) {
    hash ^= value.charCodeAt(offset);
    hash = Math.imul(hash, 16777619);
  }
  hash += hash << 13;
  hash ^= hash >>> 7;
  hash += hash << 3;
  hash ^= hash >>> 17;
  hash += hash << 5;
  return (hash >>> 0) / 4294967296;
}

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

const smooth = (value: number) => value * value * (3 - 2 * value);

export function valueNoise2D(seed: string, x: number, y: number, purpose = 'noise'): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smooth(x - x0);
  const ty = smooth(y - y0);
  const sample = (ix: number, iy: number) => seededRandom(seed, `${purpose}:${ix}:${iy}`);
  const a = sample(x0, y0);
  const b = sample(x0 + 1, y0);
  const c = sample(x0, y0 + 1);
  const d = sample(x0 + 1, y0 + 1);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}

export function fbmNoise2D(seed: string, x: number, y: number, octaves = 4, purpose = 'fbm'): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let weight = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    value += valueNoise2D(seed, x * frequency, y * frequency, `${purpose}:${octave}`) * amplitude;
    weight += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value / weight;
}

export function planetVisualConfig(planet: { temperature: number; atmosphere: string; water: number; geological_activity: number }): PlanetVisualConfig {
  const water = clamp(planet.water / 100, 0, 1);
  const temperature = planet.temperature;
  const cold = clamp((250 - temperature) / 80, 0, 1);
  const heat = clamp((temperature - 315) / 120, 0, 1);
  const geological = clamp(planet.geological_activity, 0, 1);
  const atmosphere = planet.atmosphere.toLowerCase();
  const dense = atmosphere.includes('dense') ? 0.08 : atmosphere.includes('thin') ? -0.03 : 0;
  return {
    oceanColor: heat > 0.55 ? '#263b45' : cold > 0.55 ? '#28465b' : '#20526a',
    landColor: heat > 0.55 ? '#9a694c' : cold > 0.55 ? '#8799a4' : '#527e68',
    landAccent: geological > 0.65 ? '#b16d58' : heat > 0.55 ? '#c39158' : '#86a875',
    iceColor: cold > 0.15 ? '#d8edf1' : '#bcd4d2',
    atmosphereColor: heat > 0.55 ? '#cf986d' : cold > 0.55 ? '#98c9dd' : '#8fc4c6',
    atmosphereOpacity: clamp(0.12 + water * 0.08 + dense, 0.04, 0.28),
    cloudOpacity: clamp(0.05 + water * 0.24 + (1 - heat) * 0.04, 0.03, 0.3),
  };
}

export function starVisualConfig(star: { stellar_class: string; luminosity: number }): StarVisualConfig {
  const colors: Record<string, string> = {
    O: '#b9d4ff', B: '#c8dcff', A: '#e4ebff', F: '#fff4d5', G: '#ffe0a6', K: '#ffb66f', M: '#e47b69',
  };
  const luminosity = Math.max(0.1, star.luminosity);
  return {
    color: colors[star.stellar_class.toUpperCase()] ?? '#ffe0a6',
    intensity: clamp(0.78 + Math.log10(luminosity) * 0.62, 0.42, 2.1),
    radius: clamp(0.78 + Math.log10(luminosity) * 0.1, 0.68, 1.08),
    haloOpacity: clamp(0.08 + Math.log10(luminosity) * 0.025, 0.055, 0.13),
  };
}

export function latLonToVector3(latitude: number, longitude: number, radius: number): Vector3Like {
  const phi = (90 - latitude) * Math.PI / 180;
  const theta = (longitude + 180) * Math.PI / 180;
  return {
    x: -radius * Math.sin(phi) * Math.cos(theta),
    y: radius * Math.cos(phi),
    z: radius * Math.sin(phi) * Math.sin(theta),
  };
}

export function districtPlacement(seed: string, districtId: string, index: number, level: number): DistrictPlacement {
  const identity = `${seed}:district:${districtId}:${index}`;
  return {
    latitude: -52 + seededRandom(identity, 'latitude') * 104,
    longitude: -180 + seededRandom(identity, 'longitude') * 360,
    scale: 0.7 + clamp(level, 1, 3) * 0.14,
  };
}

export function starfieldPositions(seed: string, count = 180, layer = 0): Vector3Like[] {
  return Array.from({ length: count }, (_, index) => {
    const theta = seededRandom(seed, `star-theta-${layer}`, index) * Math.PI * 2;
    const z = seededRandom(seed, `star-z-${layer}`, index) * 2 - 1;
    const radius = 28 + seededRandom(seed, `star-radius-${layer}`, index) * 18;
    const planar = Math.sqrt(1 - z * z);
    return { x: radius * planar * Math.cos(theta), y: radius * z, z: radius * planar * Math.sin(theta) };
  });
}

export function starfieldLayers(seed: string): StarfieldLayer[] {
  return [
    { positions: starfieldPositions(seed, 150, 0), size: 0.025, opacity: 0.42, color: '#7890a8' },
    { positions: starfieldPositions(seed, 80, 1), size: 0.045, opacity: 0.62, color: '#b5c7dc' },
    { positions: starfieldPositions(seed, 18, 2), size: 0.075, opacity: 0.9, color: '#e2d8bc' },
  ];
}

export function fleetIsInSystem(fleet: { status: string; x: number; y: number }, systemX: number, systemY: number): boolean {
  return fleet.status === 'ARRIVED' && fleet.x === systemX && fleet.y === systemY;
}

export function hasShipyard(shipyardSlots: number): boolean {
  return shipyardSlots > 0;
}

export function autoRotationEnabled(reducedMotion: boolean): boolean {
  return !reducedMotion;
}
