const { test } = require('node:test');
const assert = require('node:assert/strict');
const { scanGuidance } = require('../src/features/arena-fighter/arena-scan.ts');

test('a 40/2 scan with omitted optional flags can finish and never exceeds 100 percent', () => {
  const scan = scanGuidance(
    { available: true, scanning: true, keyframes: 40, minKeyframes: 2 },
    20
  );
  assert.equal(scan.canFinish, true);
  assert.equal(scan.progress, 1);
  assert.match(scan.message, /Tap Create room/);
});

test('all reported gates still apply and each missing coverage measure explains how to improve it', () => {
  const base = { available: true, keyframes: 40, minKeyframes: 2 };
  const sideways = scanGuidance({ ...base, meetsViewpointPairs: false }, 20);
  assert.equal(sideways.canFinish, false);
  assert.match(sideways.message, /sideways/);
  const spread = scanGuidance({ ...base, meetsSpread: false }, 20);
  assert.equal(spread.canFinish, false);
  assert.match(spread.message, /farther/);
  const points = scanGuidance({ ...base, triangulatedPoints: 212, minTriangulatedPoints: 300 }, 20);
  assert.equal(points.canFinish, false);
  assert.match(points.message, /textured/);
  assert.ok(points.progress < 1);
});

test('numeric coverage thresholds work without boolean flags and sufficient frames alone cannot bypass them', () => {
  const base = {
    available: true,
    keyframes: 40,
    minKeyframes: 2,
    viewpointPairs: 1,
    minViewpointPairs: 2,
    cameraSpreadMeters: 0.1,
    minSpreadMeters: 0.2,
  };
  assert.equal(scanGuidance(base, 20).canFinish, false);
  const spread = scanGuidance({ ...base, viewpointPairs: 4 }, 20);
  assert.equal(spread.canFinish, false);
  assert.match(spread.message, /farther/);
  assert.equal(
    scanGuidance({ ...base, viewpointPairs: 4, cameraSpreadMeters: 0.3 }, 20).canFinish,
    true
  );
});

test('scan gating follows Studio minimum views and time fallback only when no quality is reported', () => {
  assert.equal(
    scanGuidance({ available: true, keyframes: 2, minKeyframes: 2 }, 20).canFinish,
    false
  );
  assert.equal(scanGuidance({ available: true }, 9).canFinish, false);
  assert.equal(scanGuidance({ available: true }, 10).canFinish, true);
  assert.equal(scanGuidance({ available: false }, 20).canFinish, false);
  assert.equal(scanGuidance({ available: true, scanning: false }, 20).canFinish, false);
  assert.equal(scanGuidance({ available: true, keyframes: Number.NaN }, 20).canFinish, true);
});
