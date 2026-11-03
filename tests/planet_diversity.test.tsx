import { describe, expect, it } from 'vitest';
import { generatePlanetData, planetSurfaceColor, sampleCloud, samplePlanet } from '../frontend/src/planetlab/planetGenerator';
import { adjacentTestSeed, PLANET_FAMILIES, PLANET_PRESETS, TEST_SEEDS, type PlanetFamily } from '../frontend/src/planetlab/planetLabTypes';

const settingsFor = (family: PlanetFamily, seed: string = TEST_SEEDS[0]) => ({ family, seed, ...PLANET_PRESETS[family].parameters });
const cases = PLANET_FAMILIES.flatMap(family => TEST_SEEDS.map(seed => ({ family, seed, data: generatePlanetData(settingsFor(family, seed), 128, 64) })));

it('defines four valid family presets and five fixed gallery seeds', () => {
  expect(PLANET_FAMILIES).toEqual(['terran', 'oceanic', 'desert', 'frozen']);
  expect(TEST_SEEDS).toHaveLength(5);
  for (const family of PLANET_FAMILIES) {
    const preset = PLANET_PRESETS[family];
    expect(preset.family).toBe(family);
    for (const [key, value] of Object.entries(preset.parameters)) {
      expect(Number.isFinite(value), key).toBe(true);
      expect(value).toBeGreaterThanOrEqual(key === 'moistureBias' ? -0.5 : 0);
      expect(value).toBeLessThanOrEqual(key === 'continentScale' ? 3.5 : 1);
    }
  }
});

describe.each(cases)('$family / $seed', ({ family, seed, data }) => {
  it('has finite, non-uniform geography and consistent area-weighted diagnostics', () => {
    const d = data.diagnostics;
    const fractions = [d.waterCoverage, d.openWaterCoverage, d.iceCoverage, d.coastalCoverage];
    for (const value of fractions) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    expect(d.openWaterCoverage).toBeLessThanOrEqual(d.waterCoverage);
    expect(Object.values(d.biomes).reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 10);
    expect(d.waterCoverage).toBeCloseTo((d.biomes.ocean ?? 0) + (d.biomes.shelf ?? 0) + (d.biomes['sea-ice'] ?? 0), 10);
    expect(d.iceCoverage).toBeCloseTo((d.biomes.ice ?? 0) + (d.biomes['sea-ice'] ?? 0), 10);
    expect(d.biomeCount).toBeGreaterThanOrEqual(4);
    expect(d.biomeCount).toBe(Object.values(d.biomes).filter(value => value > 0.001).length);
    expect(d.elevationMin).toBeGreaterThanOrEqual(0);
    expect(d.elevationMax).toBeLessThanOrEqual(1);
    expect(d.elevationMax).toBeGreaterThan(d.elevationMin);
    expect(d.temperatureMin).toBeGreaterThanOrEqual(0);
    expect(d.temperatureMax).toBeLessThanOrEqual(1);
    expect(d.temperatureMax).toBeGreaterThan(d.temperatureMin);
    expect(d.generationMs).toBeGreaterThanOrEqual(0);
    expect(d.coastalCoverage).toBeGreaterThan(0);
    expect(new Set(data.color).size).toBeGreaterThan(20);
    const peer = cases.find(entry => entry.family === family && entry.seed === TEST_SEEDS[(TEST_SEEDS.indexOf(seed) + 1) % TEST_SEEDS.length])!;
    expect(data.roughness).not.toEqual(peer.data.roughness);
    expect(data.clouds).not.toEqual(peer.data.clouds);
  });
});

it.each(TEST_SEEDS)('has ocean-dominant, arid and frozen families for %s', seed => {
  const metrics = (family: PlanetFamily) => cases.find(entry => entry.family === family && entry.seed === seed)!.data.diagnostics;
  expect(metrics('oceanic').waterCoverage).toBeGreaterThan(metrics('terran').waterCoverage);
  expect(metrics('oceanic').waterCoverage).toBeGreaterThan(0.7);
  expect(metrics('desert').waterCoverage).toBeLessThan(metrics('terran').waterCoverage);
  expect(metrics('desert').waterCoverage).toBeLessThan(0.05);
  expect(metrics('frozen').iceCoverage).toBeGreaterThan(metrics('terran').iceCoverage);
  expect(metrics('frozen').iceCoverage).toBeGreaterThan(0.5);
  expect(metrics('frozen').iceCoverage).toBeLessThan(0.95);
});

it.each(PLANET_FAMILIES)('reproduces geometry, biomes and initial clouds without longitude seams: %s', family => {
  const settings = settingsFor(family);
  const first = generatePlanetData(settings, 32, 16);
  const second = generatePlanetData({ ...settings }, 32, 16);
  expect(first.color).toEqual(second.color);
  expect(first.roughness).toEqual(second.roughness);
  expect(first.clouds).toEqual(second.clouds);
  expect({ ...first.diagnostics, generationMs: 0 }).toEqual({ ...second.diagnostics, generationMs: 0 });
  for (const latitude of [-0.8, 0, 0.8]) {
    const radius = Math.sqrt(1 - latitude * latitude);
    const a = { x: -radius, y: latitude, z: 0 };
    const b = { ...a, z: Math.sin(2 * Math.PI) * radius };
    const left = samplePlanet(a, settings), right = samplePlanet(b, settings);
    expect(left.biome).toBe(right.biome);
    expect(left.elevation).toBeCloseTo(right.elevation, 10);
    expect(left.temperature).toBeCloseTo(right.temperature, 10);
    expect(sampleCloud(a, settings)).toBeCloseTo(sampleCloud(b, settings), 10);
  }
});

it('responds to geographic parameters and has opaque, non-uniform frozen colors', () => {
  const settings = settingsFor('terran');
  const data = generatePlanetData(settings, 32, 16);
  for (const override of [{ continentScale: 3 }, { warpStrength: 0.75 }, { moistureBias: -0.4 }, { mountainIntensity: 0.1 }, { temperature: 0.2 }]) {
    expect(generatePlanetData({ ...settings, ...override }, 32, 16).color).not.toEqual(data.color);
  }
  const clearClouds = generatePlanetData({ ...settings, cloudCoverage: 0 }, 32, 16).clouds;
  expect(Array.from(clearClouds).every((value, index) => value === (index % 4 === 3 ? 255 : 0))).toBe(true);
  expect(generatePlanetData({ ...settings, cloudCoverage: 0.8 }, 32, 16).clouds).not.toEqual(clearClouds);
  const frozen = settingsFor('frozen');
  const iceA = samplePlanet({ x: 0, y: 1, z: 0 }, frozen);
  const iceB = samplePlanet({ x: 0, y: -1, z: 0 }, frozen);
  expect(iceA.ice).toBe(true);
  expect(iceB.ice).toBe(true);
  expect(planetSurfaceColor(iceA)).not.toEqual(planetSurfaceColor(iceB));
});

it('rejects invalid texture dimensions and navigates gallery deterministically', () => {
  expect(() => generatePlanetData(settingsFor('terran'), 0, 64)).toThrow(RangeError);
  expect(() => generatePlanetData(settingsFor('terran'), 16.5, 64)).toThrow(RangeError);
  expect(adjacentTestSeed('STARZ-001', -1)).toBe('STARZ-005');
  expect(adjacentTestSeed('STARZ-005', 1)).toBe('STARZ-001');
  expect(adjacentTestSeed('custom', 1)).toBe('STARZ-001');
  expect(adjacentTestSeed('custom', -1)).toBe('STARZ-005');
});
