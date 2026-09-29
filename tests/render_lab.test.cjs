const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const router = fs.readFileSync(path.join(root, 'frontend/src/app/router.tsx'), 'utf8');
const sidebar = fs.readFileSync(path.join(root, 'frontend/src/components/shell/Sidebar.tsx'), 'utf8');

assert.match(router, /path="\/render-lab"/);
assert.doesNotMatch(sidebar, /render-lab/);
assert.ok(fs.statSync(path.join(root, 'frontend/assets/models/horizon.glb')).size > 1024);
for (const shader of ['hull-surface.wgsl', 'engine-emissive.wgsl']) {
  const source = fs.readFileSync(path.join(root, 'frontend/src/renderlab/shaders', shader), 'utf8');
  assert.match(source, /export fn/);
}
console.log('render lab asset/route tests passed');
