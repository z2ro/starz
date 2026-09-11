const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const registrySource = fs.readFileSync(path.join(root, 'frontend/src/visual/IconRegistry.ts'), 'utf8');
const sidebarSource = fs.readFileSync(path.join(root, 'frontend/src/components/shell/Sidebar.tsx'), 'utf8');
const hudSource = fs.readFileSync(path.join(root, 'frontend/src/components/shell/TopHud.tsx'), 'utf8');
const stylesSource = fs.readFileSync(path.join(root, 'frontend/styles.css'), 'utf8');
const iconBlock = registrySource.match(/export const ICONS = \{([\s\S]*?)\} as const;/)?.[1] ?? '';
const registryEntries = Object.fromEntries([...iconBlock.matchAll(/^\s+(\w+): '([^']+)'/gm)].map(match => [match[1], match[2]]));

test('all approved Stellar Atlas SVGs exist and are safe monochrome assets', () => {
  assert.equal(Object.keys(registryEntries).length, 17);
  for (const [name, url] of Object.entries(registryEntries)) {
    const file = path.join(root, 'frontend', url.replace(/^\/static\//, ''));
    assert.ok(fs.existsSync(file), `${name} points to a missing asset: ${file}`);
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /viewBox="0 0 24 24"/);
    assert.match(source, /stroke="currentColor"/);
    assert.doesNotMatch(source.replace('xmlns="http://www.w3.org/2000/svg"', ''), /<script|<image|data:|https?:\/\//i);
    assert.doesNotMatch(source, /<font|@font-face/i);
  }
});

test('registry keeps semantic resource mapping tied to catalog IDs', () => {
  assert.match(registrySource, /raw_ore:\s*'rawOre'/);
  assert.match(registrySource, /refined_alloy:\s*'refinedAlloy'/);
  assert.match(registrySource, /components:\s*'components'/);
  assert.match(registrySource, /fusion_fuel:\s*'fusionFuel'/);
  assert.match(registrySource, /ion_fuel:\s*'fusionFuel'/);
  assert.match(registrySource, /resourceId\.endsWith\('\_fuel'\)/);
});

test('sidebar, HUD and action controls use the registry helper', () => {
  for (const name of ['overview', 'planet', 'economy', 'research', 'shipyard', 'fleets', 'galaxy']) {
    assert.match(sidebarSource, new RegExp(`icon: '${name}'`));
  }
  for (const name of ['energy', 'population', 'research', 'fleets', 'system', 'notifications', 'settings']) {
    assert.match(hudSource, new RegExp(`icon=\"${name}\"`));
  }
  assert.match(hudSource, /resourceIcon\(item\.id\)/);
});

test('CSS preserves currentColor mask behavior and state styling', () => {
  assert.match(stylesSource, /background-color:\s*currentColor/);
  assert.match(stylesSource, /-webkit-mask-image:\s*var\(--icon\)/);
  assert.match(stylesSource, /mask-image:\s*var\(--icon\)/);
  assert.match(stylesSource, /\.nav-item:hover/);
  assert.match(stylesSource, /\.nav-item\.selected/);
  assert.match(stylesSource, /\.notice-badge/);
});
