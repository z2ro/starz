const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const ids = ['horizon', 'wayfarer', 'odyssey', 'vanguard', 'sentinel', 'aegis', 'spearhead', 'leviathan', 'atlas', 'dominion', 'stargrave-class'];

const registrySource = fs.readFileSync('frontend/src/visual/ShipArtworkRegistry.ts', 'utf8');
const generatorSource = fs.readFileSync('scripts/build_ship_runtime_assets.sh', 'utf8');
const sourceDir = 'frontend/assets/ships/source';
const registryEntries = [...registrySource.matchAll(/\{ id: '([^']+)'[^\n]+assets: assets\('([^']+)'\)[^\n]*\}/g)];

function webpInfo(path) {
  const bytes = fs.readFileSync(path);
  assert.equal(bytes.subarray(0, 4).toString('ascii'), 'RIFF', `${path} is not a RIFF image`);
  assert.equal(bytes.subarray(8, 12).toString('ascii'), 'WEBP', `${path} is not a WebP image`);
  assert.equal(bytes.subarray(12, 16).toString('ascii'), 'VP8 ', `${path} is not an opaque VP8 WebP`);
  assert.equal(bytes.subarray(23, 26).toString('hex'), '9d012a', `${path} has an invalid VP8 frame header`);
  return { bytes: bytes.length, width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
}

test('the eleven runtime designs expose dedicated presentation and thumbnail assets', () => {
  assert.equal(registryEntries.length, 11);
  assert.deepEqual(registryEntries.map(([, , assetId]) => assetId), ids);
  assert.equal(new Set(registryEntries.map(([, , assetId]) => assetId)).size, ids.length);
  assert.match(registrySource, /presentation\/\$\{id\}\.webp/);
  assert.match(registrySource, /thumbnail\/\$\{id\}\.webp/);
  assert.doesNotMatch(registrySource, /concept|concept-sheet/i);

  for (const id of ids) {
    const entry = registryEntries.find(([, , assetId]) => assetId === id);
    assert.ok(entry, `${id} has no registry entry`);
    const sourceId = id === 'stargrave-class' ? 'stargrave' : id;
    assert.ok(fs.existsSync(`${sourceDir}/${sourceId}-runtime.png`), `${id} has no approved source`);
    const presentation = webpInfo(`frontend/assets/ships/presentation/${id}.webp`);
    const thumbnail = webpInfo(`frontend/assets/ships/thumbnail/${id}.webp`);
    assert.ok(presentation.bytes > 8_000, `${id} presentation is unexpectedly small`);
    assert.ok(thumbnail.bytes > 1_000, `${id} thumbnail is unexpectedly small`);
    assert.deepEqual([presentation.width, presentation.height], [2048, 1024], `${id} presentation canvas is invalid`);
    assert.deepEqual([thumbnail.width, thumbnail.height], [320, 180], `${id} thumbnail is not a 16:9 canvas`);
  }
});

test('runtime art is cropped and resized without segmentation or aspect distortion', () => {
  assert.match(generatorSource, /source_dir="\$root\/frontend\/assets\/ships\/source"/);
  assert.doesNotMatch(generatorSource, /handoff|candidate|rejected/i);
  assert.match(generatorSource, /runtime\.png/);
  assert.match(generatorSource, /thumbnail_input|presentation.*thumbnail|presentation.*webp/i);
  assert.doesNotMatch(generatorSource, /concept(?:\.png|-sheet)/i);
  assert.match(generatorSource, /force_original_aspect_ratio=decrease/);
  assert.doesNotMatch(generatorSource, /colorkey|chromakey|alphaextract|alphamerge|floodfill/i);
});

test('gameplay mappings remain explicit and design-only classes do not receive fake hulls', () => {
  assert.match(registrySource, /id: 'horizon'[^\n]+gameplayHullId: 'scout_hull'/);
  assert.doesNotMatch(registrySource, /id: 'wayfarer'[^\n]+gameplayHullId/);
  assert.doesNotMatch(registrySource, /id: 'stargrave'[^\n]+gameplayHullId/);
  assert.match(registrySource, /id: 'stargrave'[^\n]+special: 'stargrave'/);
});

