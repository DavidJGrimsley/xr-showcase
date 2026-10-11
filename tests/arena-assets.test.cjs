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

test('Mike impact WAVs retain the source game bytes and standard PCM format', () => {
  const hashes = [
    '27ed011cc994e00a2baa47ecc0239685ebfea10cf3ee52697934ada402cd7f4f',
    '145651ba430534af16da8c0fd902a5e5361dc23199a4a9237f101f73d41ab47b',
    '655c57006e250925e7eb374b2a96dec45fa790a4667632c94dafd7deab130fc9',
  ];
  for (let i = 0; i < 3; i++) {
    const bytes = fs.readFileSync(path.join(directory, 'sounds', `punch_0${i + 1}.wav`));
    assert.equal(bytes.length, 129854);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), hashes[i]);
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
    let format;
    for (let offset = 12; offset + 8 <= bytes.length;) {
      const size = bytes.readUInt32LE(offset + 4);
      if (bytes.toString('ascii', offset, offset + 4) === 'fmt ') format = offset + 8;
      offset += 8 + size + (size % 2);
    }
    assert.ok(format);
    assert.equal(bytes.readUInt16LE(format), 1);
    assert.equal(bytes.readUInt16LE(format + 2), 2);
    assert.equal(bytes.readUInt32LE(format + 4), 48000);
    assert.equal(bytes.readUInt16LE(format + 14), 16);
  }
});

const combatManifest = require('../assets/arena/combat-animation-manifest.json');
const collision = require('../assets/arena/combat-collision-data.json');

test('collision bake has complete 60Hz coverage, finite fitted boxes and matching pack hashes', () => {
  const bytes = fs.readFileSync(path.join(directory, 'combat-collision-data.json'));
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    combatManifest.collisionDataSha256
  );
  assert.equal(collision.sampleRate, 60);
  assert.equal(collision.toleranceMeters, 0.001);
  assert.equal(collision.bothColorsPoseIdentical, true);
  assert.equal(collision.fighterScale, ARENA_LAYOUT.fighterScale);
  for (const f of combatManifest.files) assert.equal(collision.packHashes[f.file], f.sha256);
  for (const clip of [...manifest.clips, ...combatManifest.clips]) {
    const bake = collision.clips[clip.name];
    assert.ok(Math.abs(bake.duration - clip.durationSeconds) < 1e-6);
    const minimum = Math.ceil(bake.duration * 60 - 1e-5) + 1;
    // Include a terminal sample for source float32 durations just beyond a frame.
    assert.ok(bake.frames.length >= minimum && bake.frames.length <= minimum + 1);
    for (const frame of bake.frames) {
      assert.equal(frame.length, collision.groups.length);
      for (const box of frame) {
        assert.equal(box.length, 10);
        assert.ok(box.every(Number.isFinite));
        assert.ok(box.slice(3, 6).every((v) => v >= 0));
        assert.ok(Math.abs(Math.hypot(...box.slice(6)) - 1) < 1e-6);
      }
    }
  }
});

function floatValues(json, binary, index) {
  const a = json.accessors[index],
    v = json.bufferViews[a.bufferView],
    width = { SCALAR: 1, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type];
  const offset = (v.byteOffset || 0) + (a.byteOffset || 0),
    stride = v.byteStride || width * 4;
  return Array.from({ length: a.count }, (_, f) =>
    Array.from({ length: width }, (_, i) => binary.readFloatLE(offset + f * stride + i * 4))
  );
}
for (const { file } of combatManifest.files) {
  test(`${file}: fast reaction ends at IdleAggro and preserves original HitFront`, () => {
    const { json, binary } = readGLB(file);
    const tracks = (name) =>
      new Map(
        json.animations
          .find((a) => a.name === name)
          .channels.map((ch) => {
            const animation = json.animations.find((a) => a.name === name),
              s = animation.samplers[ch.sampler];
            return [ch.target.node + ':' + ch.target.path, floatValues(json, binary, s.output)];
          })
      );
    const idle = tracks('IdleAggro'),
      reaction = tracks('HitFrontFast');
    for (const [name, frames] of reaction) {
      const actual = frames.at(-1),
        expected = idle.get(name)[0];
      const errors = [1, -1].map((sign) =>
        Math.max(...actual.map((v, i) => Math.abs(v - sign * expected[i])))
      );
      assert.ok((name.endsWith(':rotation') ? Math.min(...errors) : errors[0]) < 1e-6, name);
    }
    assert.ok(json.animations.some((a) => a.name === 'HitFront'));
  });

  test(`${file}: fitted head bounds agree with independently skinned source pose samples`, () => {
    const { json, binary } = readGLB(file),
      skin = json.skins[0];
    const multiply = (a, b) =>
      Array.from({ length: 16 }, (_, i) => {
        const row = i % 4,
          col = Math.floor(i / 4);
        return [0, 1, 2, 3].reduce((s, k) => s + a[k * 4 + row] * b[col * 4 + k], 0);
      });
    const matrix = (p, q, s) => {
      const [x, y, z, w] = q;
      return [
        (1 - 2 * (y * y + z * z)) * s[0],
        2 * (x * y + z * w) * s[0],
        2 * (x * z - y * w) * s[0],
        0,
        2 * (x * y - z * w) * s[1],
        (1 - 2 * (x * x + z * z)) * s[1],
        2 * (y * z + x * w) * s[1],
        0,
        2 * (x * z + y * w) * s[2],
        2 * (y * z - x * w) * s[2],
        (1 - 2 * (x * x + y * y)) * s[2],
        0,
        ...p,
        1,
      ];
    };
    const parents = new Map(json.nodes.flatMap((n, i) => (n.children || []).map((c) => [c, i])));
    const inverse = floatValues(json, binary, skin.inverseBindMatrices);
    const cache = new Map();
    const read = (i) => {
      if (!cache.has(i)) cache.set(i, floatValues(json, binary, i));
      return cache.get(i);
    };
    for (const [clip, time] of [
      ['IdleAggro', 0],
      ['Combo_PunchL', 0.3],
      ['Combo_PunchR', 0.3],
      ['Combo_UppercutL', 0.48],
      ['Combo_UppercutR', 0.48],
    ]) {
      const sampleTime = Math.round(time * 60) / 60;
      const trs = json.nodes.map((n) => ({
        translation: n.translation || [0, 0, 0],
        rotation: n.rotation || [0, 0, 0, 1],
        scale: n.scale || [1, 1, 1],
      }));
      const animation = json.animations.find((a) => a.name === clip);
      for (const ch of animation.channels) {
        const sampler = animation.samplers[ch.sampler],
          ts = read(sampler.input).map((v) => v[0]),
          ys = read(sampler.output);
        let hi = ts.findIndex((t) => t > sampleTime);
        if (hi < 0) hi = ts.length - 1;
        const lo = Math.max(0, hi - 1),
          t = hi === lo ? 0 : Math.max(0, Math.min(1, (sampleTime - ts[lo]) / (ts[hi] - ts[lo])));
        let a = ys[lo],
          b = ys[hi],
          value;
        if (ch.target.path === 'rotation') {
          let d = a.reduce((sum, v, i) => sum + v * b[i], 0);
          if (d < 0) {
            b = b.map((v) => -v);
            d = -d;
          }
          const angle = Math.acos(Math.min(1, d));
          value =
            d > 0.9995
              ? a.map((v, i) => v + (b[i] - v) * t)
              : a.map(
                  (v, i) =>
                    (Math.sin((1 - t) * angle) * v + Math.sin(t * angle) * b[i]) / Math.sin(angle)
                );
          const length = Math.hypot(...value);
          value = value.map((v) => v / length);
        } else value = a.map((v, i) => v + (b[i] - v) * t);
        trs[ch.target.node][ch.target.path] = value;
      }
      const world = new Map();
      const pose = (i) => {
        if (world.has(i)) return world.get(i);
        const v = trs[i];
        let m = matrix(v.translation, v.rotation, v.scale);
        if (parents.has(i)) m = multiply(pose(parents.get(i)), m);
        world.set(i, m);
        return m;
      };
      const bones = skin.joints.map((node, i) => multiply(pose(node), inverse[i]));
      const box =
        collision.clips[clip].frames[Math.round(time * 60)][collision.groups.indexOf('head_01')];
      let checked = 0;
      for (const mesh of json.meshes.filter((m) => !m.name.startsWith('Mike_Body_LED')))
        for (const primitive of mesh.primitives) {
          const attrs = primitive.attributes,
            positions = read(attrs.POSITION),
            weights = read(attrs.WEIGHTS_0);
          const a = json.accessors[attrs.JOINTS_0],
            v = json.bufferViews[a.bufferView],
            offset = (v.byteOffset || 0) + (a.byteOffset || 0),
            size = a.componentType === 5121 ? 1 : 2;
          for (let i = 0; i < positions.length; i += 17) {
            const joints = [0, 1, 2, 3].map((k) =>
              size === 1
                ? binary.readUInt8(offset + i * (v.byteStride || 4 * size) + k * size)
                : binary.readUInt16LE(offset + i * (v.byteStride || 4 * size) + k * size)
            );
            const dominant = joints[weights[i].indexOf(Math.max(...weights[i]))];
            if (dominant < 6 || dominant > 39) continue;
            const p = positions[i],
              point = [0, 1, 2].map(
                (row) =>
                  weights[i].reduce((sum, w, k) => {
                    const m = bones[joints[k]];
                    return (
                      sum +
                      w * (m[row] * p[0] + m[4 + row] * p[1] + m[8 + row] * p[2] + m[12 + row])
                    );
                  }, 0) * ARENA_LAYOUT.fighterScale
              );
            for (let k = 0; k < 3; k++)
              assert.ok(Math.abs(point[k] - box[k]) <= box[k + 3] + 1e-6, `${clip} vertex ${i}`);
            checked++;
          }
        }
      assert.ok(checked > 100, clip);
    }
  });
}
for (const file of ['Mike_Player1_Blue_Combat_AR.glb', 'Mike_Player2_RedOrange_Combat_AR.glb']) {
  test(`${file}: derived pack retains every original payload and appends ten clips while preserving all earlier samples`, () => {
    const original = file.replace('_Combat_AR.glb', '_AR.glb'),
      before = readGLB(original),
      after = readGLB(file);
    assert.equal(after.json.animations.length, 33);
    for (const key of [
      'meshes',
      'skins',
      'nodes',
      'materials',
      'textures',
      'images',
      'samplers',
      'scenes',
    ])
      assert.deepEqual(after.json[key], before.json[key]);
    assert.deepEqual(after.json.animations.slice(0, 23), before.json.animations);
    assert.deepEqual(
      after.json.accessors.slice(0, before.json.accessors.length),
      before.json.accessors
    );
    assert.deepEqual(
      after.json.bufferViews.slice(0, before.json.bufferViews.length),
      before.json.bufferViews
    );
    assert.deepEqual(after.binary.subarray(0, before.binary.length), before.binary);
    const metadata = combatManifest.files.find((f) => f.file === file),
      bytes = fs.readFileSync(path.join(directory, file));
    assert.equal(bytes.length, metadata.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), metadata.sha256);
    const accessor = (i) => {
      const a = after.json.accessors[i],
        v = after.json.bufferViews[a.bufferView];
      assert.equal(a.componentType, 5126);
      const width = { SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type];
      return after.binary.subarray(
        (v.byteOffset || 0) + (a.byteOffset || 0),
        (v.byteOffset || 0) + (a.byteOffset || 0) + a.count * width * 4
      );
    };
    for (const entry of combatManifest.clips) {
      const clip = after.json.animations.find((a) => a.name === entry.name);
      assert.ok(clip);
      assert.equal(clip.channels.length, 258);
      const digest = createHash('sha256');
      for (const channel of clip.channels) {
        const sampler = clip.samplers[channel.sampler];
        assert.equal(sampler.interpolation, 'LINEAR');
        digest.update(after.json.nodes[channel.target.node].name + ':' + channel.target.path);
        digest.update(accessor(sampler.input));
        digest.update(accessor(sampler.output));
        const times = accessor(sampler.input);
        assert.ok(Math.abs(times.readFloatLE(times.length - 4) - entry.durationSeconds) < 1e-6);
        const vals = accessor(sampler.output);
        for (let j = 0; j < vals.length; j += 4) assert.ok(Number.isFinite(vals.readFloatLE(j)));
      }
      assert.equal(digest.digest('hex'), entry.sourceSampleSha256, entry.name);
    }
    assert.equal(combatManifest.sourceAssetsByteIdentical, true);
  });
  test(`${file}: victory finisher stays in place and joins the stretch and idle poses`, () => {
    const { json, binary } = readGLB(file);
    const entry = combatManifest.clips.find((c) => c.name === 'VictoryUppercut');
    assert.equal(entry.durationSeconds, 2);
    assert.equal(entry.loopRecommended, false);
    assert.match(entry.sourceAsset, /\/Arena\/AS_Mike_VictoryUppercut$/);
    const clip = (name) => json.animations.find((a) => a.name === name);
    const tracks = (animation) =>
      new Map(
        animation.channels.map((c) => {
          const sampler = animation.samplers[c.sampler];
          const a = json.accessors[sampler.output],
            v = json.bufferViews[a.bufferView];
          const width = { SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type];
          const offset = (v.byteOffset || 0) + (a.byteOffset || 0);
          const frames = Array.from({ length: a.count }, (_, f) =>
            Array.from({ length: width }, (_, i) =>
              binary.readFloatLE(offset + (f * width + i) * 4)
            )
          );
          return [json.nodes[c.target.node].name + ':' + c.target.path, frames];
        })
      );
    const finisher = tracks(clip('VictoryUppercut'));
    for (const [reference, endpoint, frame] of [
      ['Victory', 0, -1],
      ['IdleAggro', -1, 0],
    ]) {
      const expected = tracks(clip(reference));
      for (const [name, frames] of finisher) {
        const actual = frames.at(endpoint),
          target = expected.get(name).at(frame);
        // Unreal's source compression introduces tiny differences from the archival export.
        const distance = (sign) =>
          Math.max(...actual.map((v, i) => Math.abs(v - sign * target[i])));
        const rotation = name.endsWith(':rotation');
        assert.ok(
          (rotation ? Math.min(distance(1), distance(-1)) : distance(1)) <
            (rotation ? 0.001 : 0.0002),
          `${reference}: ${name}`
        );
      }
    }
    for (const name of ['root', 'SK_ZMike']) {
      const frames = finisher.get(name + ':translation');
      for (const frame of frames) assert.deepEqual(frame, frames[0]);
    }
  });
}
test('Metro loads the derived packs and preserves source sound choices and blocked volume', () => {
  const native = fs.readFileSync(
    path.resolve(__dirname, '../src/features/arena-fighter/arena-scene.native.tsx'),
    'utf8'
  );
  for (const f of combatManifest.files)
    assert.ok(native.includes(`require('../../../assets/arena/${f.file}')`));
  for (const file of ['punch_01.wav', 'punch_02.wav', 'punch_03.wav'])
    assert.ok(native.includes(file));
  assert.match(native, /impact.outcome === 'hit' \? 0.8 : 0.4/);
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

test('arena retains its baked axis conversion and 200,000 triangles; its footprint grows to 75cm with the same height and base at zero', () => {
  const { json } = readGLB('Fight_Arena.glb');
  const root = json.nodes[json.scenes[0].nodes[0]];
  const meshNode = json.nodes[root.children[0]];
  assert.equal(root.name, 'RecenterOffset');
  assert.ok(Math.abs(meshNode.rotation[0] - Math.SQRT1_2) < 1e-6);
  assert.ok(Math.abs(meshNode.rotation[3] - Math.SQRT1_2) < 1e-6);
  const position = json.accessors[json.meshes[meshNode.mesh].primitives[0].attributes.POSITION];
  // The baked quarter-turn maps source Y to world Z, and source Z to world Y.
  const horizontalScale = ARENA_LAYOUT.arenaScale * ARENA_LAYOUT.arenaHorizontalScale;
  assert.ok(Math.abs((position.max[1] - position.min[1]) * horizontalScale - 0.75) < 1e-6);
  const originalScale = 0.6 / 1.1391900181770325;
  assert.ok(
    Math.abs(
      (position.max[0] - position.min[0]) * horizontalScale -
        (position.max[0] - position.min[0]) * originalScale * 1.25
    ) < 1e-6
  );
  assert.ok(
    Math.abs(
      (position.max[2] - position.min[2]) * ARENA_LAYOUT.arenaScale -
        (position.max[2] - position.min[2]) * originalScale
    ) < 1e-6
  );
  assert.ok(
    Math.abs(root.translation[1] * ARENA_LAYOUT.arenaScale + ARENA_LAYOUT.arenaBaseOffset) < 1e-6
  );
  assert.ok(Math.abs(ARENA_LAYOUT.fighterScale * 1.59857170559 - 0.12) < 1e-6);
  assert.ok(ARENA_LAYOUT.floorHeight > 0 && ARENA_LAYOUT.floorHeight < 0.15);
  assert.ok(
    Math.abs(ARENA_LAYOUT.floorHeight - (0.14273847315734003 - 0.027) * originalScale) < 1e-6
  );
  assert.equal(json.accessors[json.meshes[0].primitives[0].indices].count / 3, 200000);
});
