const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { test } = require('node:test');
const { clean } = require('../scripts/medical-mesh-clean.cjs');
const provenance = require('../assets/medical/skull-provenance.json');
const calibration = require('../assets/medical/skull-labels.json');

const bytes = fs.readFileSync(path.join(__dirname, '../assets/medical/skull.glb'));
assert.equal(bytes.readUInt32LE(0), 0x46546c67);
assert.equal(bytes.readUInt32LE(4), 2);
assert.equal(bytes.readUInt32LE(8), bytes.length);
assert.equal(bytes.readUInt32LE(16), 0x4e4f534a);
const jsonEnd = 20 + bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.toString('utf8', 20, jsonEnd));
assert.equal(bytes.readUInt32LE(jsonEnd + 4), 0x004e4942);
const binaryStart = jsonEnd + 8;
function accessor(index) {
  const a = gltf.accessors[index],
    view = gltf.bufferViews[a.bufferView];
  const size = a.componentType === 5123 ? 2 : 4;
  const width = a.type === 'VEC3' ? 3 : 1;
  const start = binaryStart + (view.byteOffset || 0) + (a.byteOffset || 0);
  const stride = view.byteStride || size * width;
  const data = [];
  for (let i = 0; i < a.count; i++) {
    const row = [];
    for (let k = 0; k < width; k++) {
      const offset = start + i * stride + k * size;
      row.push(
        a.componentType === 5126
          ? bytes.readFloatLE(offset)
          : size === 2
            ? bytes.readUInt16LE(offset)
            : bytes.readUInt32LE(offset)
      );
    }
    data.push(width === 1 ? row[0] : row);
  }
  return data;
}
const primitive = gltf.meshes[0].primitives[0];
const positions = accessor(primitive.attributes.POSITION);
const normals = accessor(primitive.attributes.NORMAL);
const indices = accessor(primitive.indices);
const sub = (a, b) => a.map((x, i) => x - b[i]);
const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
function segmentDistance(p, a, b) {
  const d = sub(b, a);
  if (dot(d, d) === 0) return Math.hypot(...sub(p, a));
  const t = Math.max(0, Math.min(1, dot(sub(p, a), d) / dot(d, d)));
  return Math.hypot(
    ...sub(
      p,
      a.map((x, i) => x + t * d[i])
    )
  );
}
function triangleDistance(p, a, b, c) {
  const u = sub(b, a),
    v = sub(c, a),
    w = sub(p, a);
  const uu = dot(u, u),
    uv = dot(u, v),
    vv = dot(v, v),
    wu = dot(w, u),
    wv = dot(w, v);
  const determinant = uu * vv - uv * uv;
  if (determinant > 1e-25) {
    const s = (wu * vv - wv * uv) / determinant,
      t = (wv * uu - wu * uv) / determinant;
    if (s >= 0 && t >= 0 && s + t <= 1)
      return Math.hypot(...w.map((x, i) => x - s * u[i] - t * v[i]));
  }
  return Math.min(segmentDistance(p, a, b), segmentDistance(p, b, c), segmentDistance(p, c, a));
}

test('packaged skull meets triangle/size budgets and matches its provenance hash', () => {
  assert.ok(bytes.length <= 10 * 1024 * 1024);
  assert.equal(bytes.length, provenance.bytes);
  assert.equal(indices.length % 3, 0);
  assert.equal(indices.length / 3, provenance.triangles);
  assert.ok(provenance.triangles <= 150000);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), provenance.sha256);
  assert.equal(
    provenance.cleaning.sourceSha256,
    'f3b2629424b65d5d251c6dda1f085184236b33834a602ab1366c18919510403b'
  );
  assert.ok(!gltf.extensionsRequired?.includes('KHR_draco_mesh_compression'));
});
test('geometry has valid indices, finite positions and normalized normals', () => {
  assert.equal(normals.length, positions.length);
  for (const p of positions) assert.ok(p.every(Number.isFinite));
  for (const n of normals)
    assert.ok(n.every(Number.isFinite) && Math.abs(Math.hypot(...n) - 1) < 0.01);
  for (const index of indices) assert.ok(index < positions.length);
  for (let i = 0; i < indices.length; i += 3) {
    const a = positions[indices[i]],
      b = positions[indices[i + 1]],
      c = positions[indices[i + 2]];
    const u = sub(b, a),
      v = sub(c, a);
    const cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    assert.ok(Math.hypot(...cross) > 0, `Degenerate triangle ${i / 3}`);
  }
});
test('skull is centred, grounded, opaque and exported without additional resources', () => {
  assert.deepEqual(gltf.nodes, [{ mesh: 0, name: 'Skull' }]);
  const a = gltf.accessors[primitive.attributes.POSITION];
  assert.ok(Math.abs(a.min[1]) < 1e-6);
  assert.ok(Math.abs(a.min[0] + a.max[0]) < 1e-4);
  assert.ok(Math.abs(a.min[2] + a.max[2]) < 1e-4);
  const expected = [0.168, 0.211, 0.219];
  expected.forEach((size, i) => assert.ok(Math.abs(a.max[i] - a.min[i] - size) < 0.003));
  const matrix = provenance.lpsToModelMatrix;
  assert.equal(matrix[0][0], 0.001);
  assert.equal(matrix[1][2], 0.001);
  assert.equal(matrix[2][1], -0.001);
  for (const material of gltf.materials) {
    assert.equal(material.alphaMode || 'OPAQUE', 'OPAQUE');
    assert.equal(material.pbrMetallicRoughness.baseColorFactor[3], 1);
  }
  assert.equal(gltf.images?.length || 0, 0);
  assert.ok(gltf.buffers.every((buffer) => !buffer.uri));
  const files = fs.readdirSync(path.join(__dirname, '../assets/medical'));
  assert.ok(files.every((file) => /\.(glb|json)$/.test(file)));
});
test('four named labels are calibrated on the actual exported surface', () => {
  assert.deepEqual(
    calibration.labels.map((label) => label.name),
    ['Frontal bone', 'Parietal bone', 'Zygomatic bone', 'Mandible']
  );
  for (const label of calibration.labels) {
    assert.ok([...label.anchor, ...label.position].every(Number.isFinite));
    let distance = Infinity;
    for (let i = 0; i < indices.length; i += 3) {
      distance = Math.min(
        distance,
        triangleDistance(
          label.anchor,
          positions[indices[i]],
          positions[indices[i + 1]],
          positions[indices[i + 2]]
        )
      );
      if (distance < 1e-7) break;
    }
    assert.ok(distance < 1e-5, `${label.name} is ${distance} metres from the surface`);
  }
});
test('cleaning retains separate anatomical components while dropping subresolution debris and degenerate faces', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'medical-clean-test-'));
  try {
    const vertices = [],
      faces = [];
    for (const [offset, size] of [
      [0, 10],
      [30, 2],
      [50, 0.02],
    ]) {
      const base = vertices.length + 1;
      vertices.push([offset, 0, 0], [offset + size, 0, 0], [offset, size, 0], [offset, 0, size]);
      for (const f of [
        [0, 1, 2],
        [0, 3, 1],
        [0, 2, 3],
        [1, 3, 2],
      ])
        faces.push(f.map((i) => i + base));
    }
    faces.push([1, 1, 2]);
    const source = path.join(directory, 'source.obj');
    fs.writeFileSync(
      source,
      [...vertices.map((p) => `v ${p.join(' ')}`), ...faces.map((p) => `f ${p.join(' ')}`)].join(
        '\n'
      )
    );
    const stats = await clean(source, path.join(directory, 'output'));
    assert.equal(stats.sourceComponents, 3);
    assert.equal(stats.retainedComponents, 2);
    assert.equal(stats.retainedVertices, 8);
    assert.equal(stats.retainedTriangles, 8);
    assert.equal(stats.degenerateFacesRemoved, 1);
    assert.deepEqual(stats.boundsLpsMm, [0, 0, 0, 32, 10, 10]);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
