const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const THREE = require('three');
const { GLTFLoader } = require('three/examples/jsm/loaders/GLTFLoader.js');

const files = [
  ['horizon.glb', [0.4, 0.1, 0.3]],
  ['orbital_shipyard.glb', [2, 1, 1]],
];

test('authored StarZ GLBs exist, are non-empty and parse through GLTFLoader', async () => {
  for (const [name, minimumSize] of files) {
    const path = `frontend/assets/models/${name}`;
    const bytes = fs.readFileSync(path);
    assert.ok(bytes.length > 10_000, `${name} is unexpectedly small`);
    assert.equal(bytes.readUInt32LE(0), 0x46546c67, `${name} is not GLB 2.0`);
    const array = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const gltf = await new Promise((resolve, reject) => new GLTFLoader().parse(array, '', resolve, reject));
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = box.getSize(new THREE.Vector3());
    let meshes = 0;
    gltf.scene.traverse(object => { if (object.isMesh) meshes += 1; });
    assert.ok(meshes > 0, `${name} has no meshes`);
    assert.ok(Number.isFinite(size.x) && Number.isFinite(size.y) && Number.isFinite(size.z), `${name} has invalid bounds`);
    assert.ok(size.x >= minimumSize[0] && size.y >= minimumSize[1] && size.z >= minimumSize[2], `${name} has invalid scale`);
  }
});
