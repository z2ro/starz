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
  return {
    color: colors[star.stellar_class.toUpperCase()] ?? '#ffe0a6',
    intensity: clamp(0.65 + Math.log10(Math.max(0.1, star.luminosity)) * 0.55, 0.35, 1.8),
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

export function starfieldPositions(seed: string, count = 180): Vector3Like[] {
  return Array.from({ length: count }, (_, index) => {
    const theta = seededRandom(seed, 'star-theta', index) * Math.PI * 2;
    const z = seededRandom(seed, 'star-z', index) * 2 - 1;
    const radius = 28 + seededRandom(seed, 'star-radius', index) * 18;
    const planar = Math.sqrt(1 - z * z);
    return { x: radius * planar * Math.cos(theta), y: radius * z, z: radius * planar * Math.sin(theta) };
  });
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
