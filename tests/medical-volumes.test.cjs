const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { test } = require('node:test');
const {
  MedicalController,
  canManipulateVolume,
  medicalStatus,
} = require('../src/features/medical-viewer/medical-controller.ts');
const {
  parseMedicalVolumeDataset,
  VOLUME_ATLASES,
  VolumeControlScheduler,
  initialVolumeCrop,
} = require('../src/features/medical-viewer/medical-volumes.ts');
const {
  volumeUniforms,
  volumeExtent,
} = require('../src/features/medical-viewer/medical-volume-uniforms.ts');
const metadata = require('../assets/medical/volumes/metadata.json');
const data = parseMedicalVolumeDataset(metadata);
const scope = (c) => ({
  sessionId: c.getSnapshot().sessionId,
  placementRevision: c.getSnapshot().placementRevision,
  requestId: c.getSnapshot().volume.requestId,
});
function viewer(dataset = data) {
  const c = new MedicalController(undefined, undefined, dataset);
  c.attach(1);
  c.setTracking(1, true);
  c.selectPlane(1, c.getSnapshot().placementRevision, 'table');
  return c;
}
function volume() {
  const c = viewer();
  c.selectViewerMode(1, 'volume');
  ready(c);
  return c;
}
function ready(c) {
  VOLUME_ATLASES.forEach((key) => c.finishVolumeAtlas(scope(c), key, true));
  c.finishVolumeBinding(scope(c), 'ready');
}

test('real volume assets retain source identity, scalar precision, geometry, and bounded atlas sizes', () => {
  assert.equal(data.error, null);
  assert.deepEqual(data.dimensions, [160, 160, 149]);
  assert.equal(data.series.length, 2);
  assert.equal(
    metadata.provenance.sourceSceneSha256,
    '998783662535ddd9619709cfce38b262da9bd3ca4ff588ad80f37b228d96d598'
  );
  assert.equal(metadata.provenance.sourceNodesUnchanged, true);
  let total = 0;
  for (const series of metadata.series) {
    assert.ok(series.quantizationMaxError <= series.scalarScale / 2 + 1e-6);
    assert.equal(series.geometry.parentTransformId === null, series.modality === 'mri');
    for (const key of VOLUME_ATLASES) {
      const image = series.atlases[key],
        bytes = fs.readFileSync(path.join(__dirname, '../assets/medical/volumes', image.filename));
      assert.equal(image.bytes, bytes.length);
      assert.equal(image.sha256, crypto.createHash('sha256').update(bytes).digest('hex'));
      assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], data.atlas.dimensions);
      assert.equal(bytes[25], 6);
      total += bytes.length;
    }
  }
  assert.equal(total, metadata.imageBytes);
  assert.ok(total < 20 * 1024 * 1024);
});
test('malformed volume metadata fails recoverably before native binding', () => {
  for (const mutate of [
    (d) => (d.schemaVersion = 0),
    (d) => (d.atlas.gutter = 0),
    (d) => (d.grid.spacingMm = 0),
    (d) => (d.grid.boundsRasMm[1] = d.grid.boundsRasMm[0]),
    (d) => d.series.push(d.series[0]),
    (d) => (d.series[0].atlases.high.filename = '../bad.png'),
    (d) => (d.series[0].scalarScale = 0),
    (d) => (d.atlas.dimensions[0] = 8192),
  ]) {
    const copy = structuredClone(metadata);
    mutate(copy);
    assert.ok(parseMedicalVolumeDataset(copy).error);
  }
});
test('anatomy Both stays the opening default; 3D Scan starts MRI with a physical left-half cutaway', () => {
  const c = viewer();
  assert.equal(c.getSnapshot().mode, 'anatomy');
  assert.equal(c.getSnapshot().modelId, 'both');
  c.selectViewerMode(1, 'volume');
  assert.equal(c.getSnapshot().volume.modality, 'mri');
  assert.deepEqual(c.getSnapshot().volume.crop, initialVolumeCrop(data.boundsRasMm));
  assert.equal(c.getSnapshot().anchorId, 'table');
  assert.equal(c.getSnapshot().volume.appearance.mri.level, 2671.5);
  assert.equal(c.getSnapshot().volume.yaw, 135);
});
test('all three atlas successes precede binding; failures, deadlines, retry, and stale events stay scoped', () => {
  const c = viewer();
  c.selectViewerMode(1, 'volume');
  const old = scope(c);
  c.finishVolumeBinding(old, 'ready');
  assert.equal(c.getSnapshot().volume.loadStatus, 'loading');
  c.finishVolumeAtlas(old, 'high', true);
  assert.equal(c.getSnapshot().volume.loadStatus, 'loading');
  c.finishVolumeAtlas(old, 'low', false);
  assert.equal(c.getSnapshot().volume.loadStatus, 'error');
  c.retryVolumeLoad(1);
  const retry = scope(c);
  assert.ok(retry.requestId > old.requestId);
  c.finishVolumeAtlas(old, 'validity', true);
  assert.deepEqual(c.getSnapshot().volume.atlasLoads, {});
  ready(c);
  assert.equal(c.getSnapshot().volume.loadStatus, 'ready');
  c.finishVolumeBinding(old, 'error');
  assert.equal(c.getSnapshot().volume.loadStatus, 'ready');
  c.finishVolumeBinding(retry, 'error');
  assert.equal(c.getSnapshot().volume.loadStatus, 'error');
  c.retryVolumeLoad(1);
  c.finishVolumeBinding(scope(c), 'error');
  assert.equal(c.getSnapshot().volume.loadStatus, 'error');
});
test('CT MRI round trips preserve physical crop and transforms with independent appearance settings', () => {
  const c = volume();
  c.setVolumeTransform(scope(c), 'scale', 2);
  c.setVolumeCrop(scope(c), 2, -100);
  c.setVolumeAppearance(scope(c), 'window', 3000);
  const crop = c.getSnapshot().volume.crop;
  c.selectVolumeModality(1, 'ct');
  ready(c);
  assert.equal(c.getSnapshot().volume.appearance.ct.window, 1800);
  c.setVolumePreset(scope(c), 'ct-soft-tissue');
  assert.equal(c.getSnapshot().volume.appearance.ct.level, 40);
  c.setVolumeAppearance(scope(c), 'level', 60);
  c.selectVolumeModality(1, 'mri');
  ready(c);
  assert.equal(c.getSnapshot().volume.appearance.mri.window, 3000);
  assert.equal(c.getSnapshot().volume.scale, 2);
  assert.deepEqual(c.getSnapshot().volume.crop, crop);
  c.selectVolumeModality(1, 'ct');
  assert.equal(c.getSnapshot().volume.appearance.ct.level, 60);
});
test('all six crop boundaries clamp to physical bounds and a one-voxel separation', () => {
  const c = volume();
  c.resetVolumeCrop(1);
  for (let boundary = 0; boundary < 6; boundary++) {
    c.setVolumeCrop(scope(c), boundary, boundary % 2 ? -1e6 : 1e6);
    const b = c.getSnapshot().volume.crop,
      axis = Math.floor(boundary / 2);
    assert.ok(b[axis * 2 + 1] - b[axis * 2] >= data.spacingMm - 1e-8);
    assert.ok(b[axis * 2] >= data.boundsRasMm[axis * 2]);
    assert.ok(b[axis * 2 + 1] <= data.boundsRasMm[axis * 2 + 1]);
  }
  const before = c.getSnapshot();
  c.setVolumeCrop(scope(c), 99, 10);
  c.setVolumeCrop(scope(c), 0, NaN);
  assert.equal(c.getSnapshot(), before);
});
test('appearance bounds, preset isolation, transparency, quality and crop reset have defined defaults', () => {
  const c = volume();
  c.setVolumePreset(scope(c), 'ct-bone');
  assert.equal(c.getSnapshot().volume.appearance.mri.preset, 'mri-grayscale');
  c.setVolumeAppearance(scope(c), 'window', -1);
  assert.equal(c.getSnapshot().volume.appearance.mri.window, 1);
  c.setVolumeAppearance(scope(c), 'opacity', 10);
  assert.equal(c.getSnapshot().volume.appearance.mri.opacity, 2);
  c.configureVolume(scope(c), { cropping: false, quality: 'fast', cropBoxVisible: true });
  assert.deepEqual(
    volumeUniforms(data, c.getVolumeSeries(), c.getSnapshot().volume).u_crop_min,
    [0, 0, 0]
  );
  assert.equal(volumeUniforms(data, c.getVolumeSeries(), c.getSnapshot().volume).u_samples, 96);
  c.resetVolumeScan(1);
  assert.equal(c.getSnapshot().volume.appearance.mri.window, 5589);
  assert.equal(c.getSnapshot().volume.cropping, true);
  c.resetVolumeCrop(1);
  assert.deepEqual(c.getSnapshot().volume.crop, data.boundsRasMm);
});
test('mode switches isolate all transforms and reject callbacks from an earlier representation', () => {
  const c = volume(),
    old = scope(c);
  c.setVolumeTransform(old, 'height', 1);
  c.selectViewerMode(1, 'anatomy');
  c.setVolumeAppearance(old, 'window', 20);
  assert.equal(c.getSnapshot().height, 0.6096);
  c.selectViewerMode(1, 'slices');
  assert.equal(c.getSnapshot().slices.height, 0.6096);
  c.selectViewerMode(1, 'volume');
  ready(c);
  assert.equal(c.getSnapshot().volume.height, 1);
  assert.equal(c.getSnapshot().volume.appearance.mri.window, 5589);
  c.resetVolumeTransform(1);
  assert.equal(c.getSnapshot().volume.height, 0.6096);
});
test('controls sheet, tracking and lifecycle prevent gestures and invalidate pending requests', () => {
  const c = volume();
  assert.ok(canManipulateVolume(c.getSnapshot()));
  c.volumeGesture(scope(c), 'pinch', 1, 1);
  c.volumeGesture(scope(c), 'pinch', 2, 2);
  assert.equal(c.getSnapshot().volume.scale, 2);
  c.openVolumeControls(1, true);
  assert.equal(canManipulateVolume(c.getSnapshot()), false);
  assert.equal(c.getSnapshot().volume.pinching, false);
  c.openVolumeControls(1, false);
  c.setTracking(1, false);
  assert.equal(canManipulateVolume(c.getSnapshot()), false);
  c.setTracking(1, true);
  const old = scope(c);
  c.reposition(1);
  c.finishVolumeBinding(old, 'ready');
  assert.equal(c.getSnapshot().volume.loadStatus, 'idle');
  c.selectPlane(1, c.getSnapshot().placementRevision, 'new-table');
  ready(c);
  c.detach(1);
  c.setVolumeCrop(old, 0, 0);
  assert.equal(c.getSnapshot().sessionId, null);
  assert.equal(c.getSnapshot().volume.controlsOpen, false);
  c.attach(2);
  assert.ok(scope(c).requestId > old.requestId);
  c.restart(2);
  assert.equal(c.getSnapshot().volume.scale, 1);
});
test('missing and unsupported renderers preserve other modes', () => {
  const c = viewer({ ...data, series: [] });
  c.selectViewerMode(1, 'volume');
  assert.equal(c.getSnapshot().volume.loadStatus, 'missing');
  assert.match(medicalStatus(c.getSnapshot()), /unavailable/);
  c.selectViewerMode(1, 'anatomy');
  assert.equal(c.getSnapshot().modelId, 'both');
  const supported = viewer();
  supported.selectViewerMode(1, 'volume');
  supported.finishVolumeBinding(scope(supported), 'unsupported');
  assert.match(medicalStatus(supported.getSnapshot()), /Rebuild/);
});

test('malformed gesture endings retain the other gesture; renderer failure releases both', () => {
  const c = volume(),
    token = scope(c);
  c.volumeGesture(token, 'pinch', 1, 1);
  c.volumeGesture(token, 'rotate', 1, 0);
  c.volumeGesture(token, 'pinch', 3, NaN);
  assert.equal(c.getSnapshot().volume.pinching, false);
  assert.equal(c.getSnapshot().volume.rotating, true);
  c.volumeGesture(token, 'rotate', 3, 30);
  assert.equal(c.getSnapshot().volume.yaw, 105);
  assert.equal(c.getSnapshot().volume.rotating, false);
  c.volumeGesture(token, 'pinch', 1, 1);
  c.volumeGesture(token, 'rotate', 1, 0);
  c.finishVolumeBinding(token, 'error');
  assert.equal(c.getSnapshot().volume.pinching, false);
  assert.equal(c.getSnapshot().volume.rotating, false);
  c.retryVolumeLoad(1);
  ready(c);
  c.volumeGesture(token, 'rotate', 3, 10);
  assert.equal(c.getSnapshot().volume.yaw, 105);
});
test('frame scheduling retains independent controls, coalesces repeats, and cancels on exit', () => {
  const callbacks = new Map(),
    updates = [];
  let next = 0;
  const scheduler = new VolumeControlScheduler(
    (cb) => {
      callbacks.set(++next, cb);
      return next;
    },
    (id) => callbacks.delete(id)
  );
  for (let n = 0; n < 100; n++) scheduler.select('window', () => updates.push(n));
  scheduler.select('crop', () => updates.push('crop'));
  assert.equal(callbacks.size, 1);
  const callback = callbacks.values().next().value;
  callbacks.clear();
  callback();
  assert.deepEqual(updates, [99, 'crop']);
  scheduler.select('level', () => updates.push('late'));
  scheduler.clear();
  assert.equal(callbacks.size, 0);
});
test('proxy box preserves anatomical proportions and the correct 55cm extent', () => {
  const extent = volumeExtent(data);
  assert.equal(Math.max(...extent), 0.55);
  const c = volume(),
    u = volumeUniforms(data, c.getVolumeSeries(), c.getSnapshot().volume);
  assert.deepEqual(u.u_crop_min, [0.5, 0, 0]);
  assert.deepEqual(u.u_crop_max, [1, 1, 1]);
  assert.equal(u.u_flip_y, 0);
});
