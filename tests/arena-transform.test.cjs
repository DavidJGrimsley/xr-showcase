const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_ARENA_TRANSFORM,
  boundedArenaTransform,
  validArenaTransform,
  arenaOffsetPosition,
} = require('../src/features/arena-fighter/arena-transform.ts');

test('position offsets clamp in both horizontal directions and remain valid protocol data', () => {
  const transform = boundedArenaTransform({ scale: 1, yaw: 450, height: -1, x: 10, z: -10 });
  assert.deepEqual(transform, { scale: 1, yaw: 90, height: 0, x: 1.524, z: -1.524 });
  assert.ok(validArenaTransform(transform));
  assert.equal(validArenaTransform({ ...transform, x: Infinity }), false);
  assert.equal(validArenaTransform({ ...transform, z: -2 }), false);
  assert.equal(validArenaTransform({ scale: 1, yaw: 0, height: 0 }), false);
});

test('position follows fixed placement axes, so rotation, size and camera viewing position cannot move it', () => {
  const position = { ...DEFAULT_ARENA_TRANSFORM, x: 0.2, height: 0.3, z: -0.1, yaw: 90 };
  for (const scale of [0.5, 1, 3])
    for (const yaw of [-180, 0, 90])
      assert.deepEqual(arenaOffsetPosition({ ...position, scale, yaw }), [0.2, 0.3, -0.1]);
  assert.deepEqual(arenaOffsetPosition(DEFAULT_ARENA_TRANSFORM), [0, 0, 0]);
});
