const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const esbuild = require('esbuild');

const compiled = esbuild.transformSync(readFileSync('frontend/src/planet3d/planetVisual.ts', 'utf8'), { loader: 'ts', format: 'cjs', platform: 'node', target: 'es2021' }).code;
const visual = { exports: {} };
new Function('module', 'exports', compiled)(visual, visual.exports);

const planet = { temperature: 288, atmosphere: 'temperate nitrogen', water: 66, geological_activity: 0.4 };

test('planet visual configuration and district placement are deterministic', () => {
  assert.deepEqual(visual.exports.planetVisualConfig(planet), visual.exports.planetVisualConfig(planet));
  assert.deepEqual(visual.exports.districtPlacement('Asterion:1:2:0', 'ore_extractor', 0, 1), visual.exports.districtPlacement('Asterion:1:2:0', 'ore_extractor', 0, 1));
  assert.deepEqual(visual.exports.starfieldPositions('Asterion:1:2:0', 8), visual.exports.starfieldPositions('Asterion:1:2:0', 8));
});

test('different physical planets produce different visual configuration', () => {
  const cold = visual.exports.planetVisualConfig({ ...planet, temperature: 190, water: 8 });
  const hot = visual.exports.planetVisualConfig({ ...planet, temperature: 420, water: 92 });
  assert.notDeepEqual(cold, hot);
  assert.notDeepEqual(visual.exports.starfieldPositions('Asterion:1:2:0', 8), visual.exports.starfieldPositions('Asterion:1:2:1', 8));
});

test('pure scene decisions respect shipyards, fleets and reduced motion', () => {
  assert.equal(visual.exports.hasShipyard(0), false);
  assert.equal(visual.exports.hasShipyard(1), true);
  assert.equal(visual.exports.fleetIsInSystem({ status: 'ARRIVED', x: 1, y: 2 }, 1, 2), true);
  assert.equal(visual.exports.fleetIsInSystem({ status: 'TRANSIT', x: 1, y: 2 }, 1, 2), false);
  assert.equal(visual.exports.fleetIsInSystem({ status: 'ARRIVED', x: 2, y: 2 }, 1, 2), false);
  assert.equal(visual.exports.autoRotationEnabled(false), true);
  assert.equal(visual.exports.autoRotationEnabled(true), false);
});
