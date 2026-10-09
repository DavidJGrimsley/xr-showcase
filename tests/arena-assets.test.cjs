const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const manifest = require('../assets/arena/fighter-animation-manifest.json');
const { ARENA_LAYOUT } = require('../src/features/arena-fighter/arena-controller.ts');

const directory = path.resolve(__dirname, '../assets/arena');
const files = [
  {
    file: 'Fight_Arena.glb',
    bytes: 6583212,
    sha256: 'a02bdcce1731f00381511dbf9e9d796d6707a536b771480eef8ce43f7b895735',
  },
  ...manifest.files,
  {
    file: 'fighter-animation-manifest.json',
    bytes: 11861,
    sha256: 'c4de9f109460d7ee9bc7cd42168eb23d67b471bec46dc67217e88434a28228bc',
  },
];
function readGLB(file) {
  const bytes = fs.readFileSync(path.join(directory, file));
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const jsonLength = bytes.readUInt32LE(12);
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const binHeader = 20 + jsonLength;
  assert.equal(bytes.readUInt32LE(binHeader + 4), 0x004e4942);
  const binary = bytes.subarray(binHeader + 8, binHeader + 8 + bytes.readUInt32LE(binHeader));
  return { json, binary };
}

test('all curated assets and the original manifest retain their exact byte lengths and SHA-256 hashes', () => {
  for (const expected of files) {
    const bytes = fs.readFileSync(path.join(directory, expected.file));
    assert.equal(bytes.length, expected.bytes, expected.file);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected.sha256, expected.file);
  }
});

for (const { file } of files.filter(({ file }) => file.endsWith('.glb'))) {
  test(`${file}: every model buffer and image is embedded and within its BIN chunk`, () => {
    const { json, binary } = readGLB(file);
    assert.equal(json.buffers.length, 1);
    assert.equal(json.buffers[0].uri, undefined);
    assert.ok(json.buffers[0].byteLength <= binary.length);
    for (const view of json.bufferViews) {
      assert.equal(view.buffer, 0);
      assert.ok((view.byteOffset || 0) + view.byteLength <= binary.length);
    }
    for (const image of json.images) {
      assert.equal(image.uri, undefined);
      assert.ok(Number.isInteger(image.bufferView));
      assert.ok(['image/png', 'image/jpeg'].includes(image.mimeType));
    }
  });
}

for (const { file } of manifest.files) {
  test(`${file}: all 23 named clips, timing, LINEAR interpolation and 86-joint skin are preserved`, () => {
    const { json } = readGLB(file);
    const names = manifest.clips.map(({ name }) => name).sort();
    assert.equal(names.length, 23);
    assert.equal(new Set(names).size, 23);
    assert.deepEqual(json.animations.map(({ name }) => name).sort(), names);
    assert.equal(json.skins.length, 1);
    assert.equal(json.skins[0].joints.length, 86);
    assert.equal(json.accessors[json.skins[0].inverseBindMatrices].count, 86);
    for (const animation of json.animations) {
      const clip = manifest.clips.find(({ name }) => name === animation.name);
      for (const sampler of animation.samplers) {
        assert.equal(sampler.interpolation, 'LINEAR');
        const timeline = json.accessors[sampler.input];
        assert.ok(Math.abs(timeline.max[0] - clip.durationSeconds) < 0.00001, animation.name);
      }
      for (const channel of animation.channels) assert.ok(json.nodes[channel.target.node]);
    }
  });

  test(`${file}: FLOAT normalized weights and unlit LED/lens material repairs are intact`, () => {
    const { json, binary } = readGLB(file);
    for (const primitive of json.meshes.flatMap((mesh) => mesh.primitives)) {
      const weights = json.accessors[primitive.attributes.WEIGHTS_0];
      assert.equal(weights.componentType, 5126);
      assert.equal(weights.type, 'VEC4');
      assert.notEqual(weights.normalized, true);
      const view = json.bufferViews[weights.bufferView];
      const start = (view.byteOffset || 0) + (weights.byteOffset || 0);
      for (let i = 0; i < weights.count; i++) {
        let sum = 0;
        for (let j = 0; j < 4; j++) {
          const value = binary.readFloatLE(start + i * (view.byteStride || 16) + j * 4);
          assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
          sum += value;
        }
        assert.ok(Math.abs(sum - 1) < 0.0001);
      }
    }
    const led = json.materials.find(({ name }) => name === 'Mike_Body_LED_Native_Fallback');
    const lens = json.materials.find(({ name }) => name.includes('Lens'));
    for (const material of [led, lens]) {
      assert.ok(material.extensions.KHR_materials_unlit);
      assert.equal(material.pbrMetallicRoughness.metallicFactor, 0);
      assert.equal(material.pbrMetallicRoughness.roughnessFactor, 1);
      const texture = json.textures[material.pbrMetallicRoughness.baseColorTexture.index];
      assert.ok(json.images[texture.source].bufferView !== undefined);
    }
    assert.equal(lens.alphaMode, 'OPAQUE');
    const triangles = json.meshes
      .flatMap((mesh) => mesh.primitives)
      .reduce((count, primitive) => count + json.accessors[primitive.indices].count / 3, 0);
    assert.equal(triangles, 28930);
  });
}

test('arena retains its baked axis conversion and 200,000 triangles; placement puts its base at zero and normalizes to 60cm', () => {
  const { json } = readGLB('Fight_Arena.glb');
  const root = json.nodes[json.scenes[0].nodes[0]];
  const meshNode = json.nodes[root.children[0]];
  assert.equal(root.name, 'RecenterOffset');
  assert.ok(Math.abs(meshNode.rotation[0] - Math.SQRT1_2) < 1e-6);
  assert.ok(Math.abs(meshNode.rotation[3] - Math.SQRT1_2) < 1e-6);
  const position = json.accessors[json.meshes[meshNode.mesh].primitives[0].attributes.POSITION];
  assert.ok(Math.abs((position.max[1] - position.min[1]) * ARENA_LAYOUT.arenaScale - 0.6) < 1e-6);
  assert.ok(
    Math.abs(root.translation[1] * ARENA_LAYOUT.arenaScale + ARENA_LAYOUT.arenaBaseOffset) < 1e-6
  );
  assert.ok(Math.abs(ARENA_LAYOUT.fighterScale * 1.59857170559 - 0.12) < 1e-6);
  assert.ok(ARENA_LAYOUT.floorHeight > 0 && ARENA_LAYOUT.floorHeight < 0.15);
  assert.equal(json.accessors[json.meshes[0].primitives[0].indices].count / 3, 200000);
});
