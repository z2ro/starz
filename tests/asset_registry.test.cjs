const { test } = require('node:test');
const assert = require('node:assert/strict');
const THREE = require('three');
const esbuild = require('esbuild');

const compiled = esbuild.buildSync({
  entryPoints: ['frontend/src/visual/AssetRegistry.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  write: false,
  target: 'es2021',
}).outputFiles[0].text;
const registryModule = { exports: {} };
new Function('module', 'exports', compiled)(registryModule, registryModule.exports);

test('asset manifest resolves local station and Horizon paths', () => {
  const registry = new registryModule.exports.AssetRegistry({ loadAsync: async () => ({ scene: new THREE.Group() }) });
  assert.equal(registry.definition('orbital_shipyard').path, '/static/assets/models/orbital_shipyard.glb');
  assert.equal(registry.definition('scout_hull').path, '/static/assets/models/horizon.glb');
  assert.ok(registry.definition('orbital_shipyard').scale > 0 && registry.definition('orbital_shipyard').scale < 1);
  assert.ok(registry.definition('scout_hull').scale > 0 && registry.definition('scout_hull').scale < 1);
  assert.equal(registry.definition('missing'), undefined);
});

test('asset registry caches source loads and clones instances', async () => {
  let calls = 0;
  const source = new THREE.Group();
  const registry = new registryModule.exports.AssetRegistry({ loadAsync: async () => { calls += 1; return { scene: source }; } });
  const first = await registry.loadClone('scout_hull');
  const second = await registry.loadClone('scout_hull');
  assert.equal(calls, 1);
  assert.notEqual(first, second);
  assert.notEqual(first, source);
  assert.equal(first.userData.assetInstance, true);
});

test('missing asset falls back without throwing', async () => {
  const registry = new registryModule.exports.AssetRegistry({ loadAsync: async () => { throw new Error('missing'); } });
  assert.equal(await registry.loadClone('orbital_shipyard'), null);
});
