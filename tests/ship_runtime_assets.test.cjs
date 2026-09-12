const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const ids = ['horizon', 'wayfarer', 'vanguard', 'sentinel', 'odyssey', 'aegis', 'spearhead', 'leviathan', 'atlas', 'dominion', 'stargrave-class'];

const registrySource = fs.readFileSync('frontend/src/visual/ShipArtworkRegistry.ts', 'utf8');
const registryEntries = [...registrySource.matchAll(/\{ id: '([^']+)'[^\n]+assets: assets\('([^']+)'\)[^\n]*\}/g)];

function assertWebp(path) {
  const bytes = fs.readFileSync(path);
  assert.equal(bytes.subarray(0, 4).toString('ascii'), 'RIFF', `${path} is not a RIFF image`);
  assert.equal(bytes.subarray(8, 12).toString('ascii'), 'WEBP', `${path} is not a WebP image`);
  return bytes.length;
}

test('the eleven runtime designs expose dedicated presentation and thumbnail assets', () => {
  assert.equal(registryEntries.length, 11);
  assert.match(registrySource, /presentation\/\$\{id\}\.webp/);
  assert.match(registrySource, /thumbnail\/\$\{id\}\.webp/);
  assert.doesNotMatch(registrySource, /presentation\/\$\{id\}-concept/);

  for (const id of ids) {
    const entry = registryEntries.find(([, , assetId]) => assetId === id);
    assert.ok(entry, `${id} has no registry entry`);
    assert.ok(assertWebp(`frontend/assets/ships/presentation/${id}.webp`) > 8_000, `${id} presentation is unexpectedly small`);
    assert.ok(assertWebp(`frontend/assets/ships/thumbnail/${id}.webp`) > 1_000, `${id} thumbnail is unexpectedly small`);
  }
});

test('gameplay mappings remain explicit and design-only classes do not receive fake hulls', () => {
  assert.match(registrySource, /id: 'horizon'[^\n]+gameplayHullId: 'scout_hull'/);
  assert.doesNotMatch(registrySource, /id: 'wayfarer'[^\n]+gameplayHullId/);
  assert.doesNotMatch(registrySource, /id: 'stargrave'[^\n]+gameplayHullId/);
  assert.match(registrySource, /id: 'stargrave'[^\n]+special: 'stargrave'/);
});

