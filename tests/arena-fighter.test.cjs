const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  ArenaController,
  ARENA_RULES,
} = require('../src/features/arena-fighter/arena-controller.ts');
const { updateHeldTouches } = require('../src/features/arena-fighter/arena-touch-input.ts');

function harness(rules = {}, ready = true, random = () => 0) {
  const controller = new ArenaController(
    { cpuEnabled: false, punchHitstop: 0, uppercutHitstop: 0, ...rules },
    random
  );
  let token = controller.attachSession(1);
  const tick = (seconds) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) controller.tick(token, 1 / 60);
  };
  const load = () => {
    controller.setLandscape(true);
    controller.setTracking(token, true);
    controller.setPlacement(token, true);
    const version = controller.getSnapshot().placementVersion;
    for (const asset of ['arena', 'blue', 'red']) controller.assetLoaded(token, version, asset);
    tick(0.5);
  };
  load();
  if (ready) assert.equal(controller.ready(), true);
  return {
    controller,
    tick,
    load,
    get token() {
      return token;
    },
    replace() {
      token = controller.attachSession(2);
    },
    snapshot: () => controller.getSnapshot(),
    near() {
      controller.setMovement('advance', true);
      tick(1.5);
      controller.setMovement('advance', false);
    },
  };
}
const close = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);

test('one native multi-touch batch keeps each hold control independent', () => {
  const advance = new Set();
  const retreat = new Set();
  const batch = [
    { identifier: 'a', target: '10' },
    { identifier: 'b', target: '20' },
  ];
  assert.equal(updateHeldTouches(advance, batch, 10, true), true);
  assert.equal(updateHeldTouches(retreat, batch, 20, true), true);
  assert.deepEqual([...advance], ['a']);
  assert.deepEqual([...retreat], ['b']);
  assert.equal(updateHeldTouches(advance, [batch[0]], null, false), false);
  assert.equal(updateHeldTouches(retreat, [batch[0]], null, false), true);
  assert.equal(updateHeldTouches(retreat, [batch[1]], null, false), false);
});

test('a control stays held until its last finger releases or cancels', () => {
  const active = new Set();
  const fingers = [
    { identifier: 'a', target: '10' },
    { identifier: 'b', target: '10' },
  ];
  updateHeldTouches(active, fingers, 10, true);
  assert.equal(updateHeldTouches(active, [fingers[0]], null, false), true);
  assert.equal(updateHeldTouches(active, [fingers[1]], null, false), false);
  assert.equal(updateHeldTouches(active, fingers, null, true), false);
});

test('Ready waits for all assets, placement, landscape and half a second of normal tracking', () => {
  const controller = new ArenaController();
  const token = controller.attachSession(1);
  controller.setLandscape(true);
  controller.setTracking(token, true);
  controller.setPlacement(token, true);
  const version = controller.getSnapshot().placementVersion;
  controller.assetLoaded(token, version, 'arena');
  controller.assetLoaded(token, version, 'blue');
  for (let i = 0; i < 29; i++) controller.tick(token, 1 / 60);
  assert.equal(controller.ready(), false);
  controller.assetLoaded(token, version, 'red');
  assert.equal(controller.ready(), false);
  controller.tick(token, 1 / 60);
  assert.equal(controller.getSnapshot().canReady, true);
  controller.setLandscape(false);
  assert.equal(controller.ready(), false);
  controller.setLandscape(true);
  assert.equal(controller.ready(), false);
  for (let i = 0; i < 30; i++) controller.tick(token, 1 / 60);
  controller.setPlacement(token, false);
  assert.equal(controller.ready(), false);
});

test('advance uses arena coordinates, 8cm/s, bounds and minimum separation', () => {
  const h = harness();
  h.controller.command('jump-back');
  h.tick(0.65);
  h.controller.command('jump-back');
  h.tick(0.4);
  close(h.controller.getTransform('blue').x, -ARENA_RULES.boundary);
  h.controller.setMovement('advance', true);
  h.tick(4);
  close(h.controller.getTransform('red').x - h.controller.getTransform('blue').x, 0.055);
  close(h.controller.getTransform('red').x, 0.095);
  assert.equal(h.snapshot().blue.clip, 'IdleAggro');
});
test('swapped sides reverse Advance and Jump Back while arena rotation keeps movement local', () => {
  const h = harness({}, false);
  h.controller.swapSides();
  h.controller.rotateArena();
  h.controller.ready();
  assert.equal(h.controller.getTransform('blue').yaw, -90);
  h.controller.command('jump-back');
  h.tick(0.65);
  h.controller.command('jump-back');
  h.tick(0.4);
  close(h.controller.getTransform('blue').x, ARENA_RULES.boundary);
  h.controller.setMovement('advance', true);
  h.tick(4);
  close(h.controller.getTransform('blue').x - h.controller.getTransform('red').x, 0.055);
  assert.equal(h.snapshot().arenaYaw, 90);
});

test('movement stops during attacks, resumes a still-held touch afterward and idles on release', () => {
  const h = harness();
  h.controller.setMovement('advance', true);
  h.controller.attack('punch');
  h.tick(0.5);
  close(h.controller.getTransform('blue').x, -0.095);
  h.tick(0.2);
  assert.ok(h.controller.getTransform('blue').x > -0.095);
  assert.equal(h.snapshot().blue.clip, 'WalkForward');
  h.controller.setMovement('advance', false);
  h.tick(1 / 60);
  assert.equal(h.snapshot().blue.clip, 'IdleAggro');
});

test('punch hands are sampled independently when an attack starts and held movement never repeats an attack', () => {
  const samples = [0.9, 0.8, 0.1, 0.7, 0.2, 0.3, 0.6, 0.4];
  let calls = 0;
  const h = harness({}, true, () => samples[calls++]);
  const hands = [];
  for (let i = 0; i < 8; i++) {
    assert.equal(h.controller.attack('punch'), true);
    hands.push(h.snapshot().blue.clip);
    h.tick(0.65);
  }
  assert.deepEqual(
    hands,
    ['R', 'R', 'L', 'R', 'L', 'L', 'R', 'L'].map((hand) => `Combo_Punch${hand}`)
  );
  assert.equal(calls, 8);
  h.tick(2);
  assert.equal(h.snapshot().blue.mode, 'idle');
  assert.equal(h.snapshot().red.health, 100);
});

test('buffered punches choose their random hand only when they start', () => {
  let samples = 0;
  const h = harness({}, true, () => (samples++ % 2 ? 0.9 : 0.1));
  h.controller.attack('punch');
  assert.equal(samples, 1);
  assert.equal(h.controller.attack('punch'), true);
  assert.equal(samples, 1);
  assert.equal(h.controller.attack('punch'), false);
  h.tick(0.65);
  assert.equal(samples, 2);
  assert.equal(h.snapshot().blue.clip, 'Combo_PunchR');
});

test('reach is checked at the hit event: Jump Back can turn a started attack into a miss', () => {
  const h = harness({ spawn: 0.04 });
  h.controller.attack('punch', 'red');
  h.controller.command('jump-back');
  h.tick(0.3);
  assert.equal(h.snapshot().blue.health, 100);
  h.tick(1);
  assert.equal(h.snapshot().blue.health, 100);
});

test('hits due in the same step damage both fighters independent of attack command order', () => {
  for (const order of [
    ['blue', 'red'],
    ['red', 'blue'],
  ]) {
    const h = harness({ spawn: 0.04 });
    for (const id of order) h.controller.attack('punch', id);
    h.tick(0.3);
    assert.equal(h.snapshot().blue.health, 92);
    assert.equal(h.snapshot().red.health, 92);
    assert.equal(h.snapshot().blue.mode, 'hit');
    assert.equal(h.snapshot().red.mode, 'hit');
  }
});

test('simultaneous lethal attacks produce a draw, stop combat and settle both defeated poses', () => {
  const h = harness({ spawn: 0.04, health: 8 });
  h.controller.attack('punch');
  h.controller.attack('punch', 'red');
  h.tick(0.3);
  assert.equal(h.snapshot().outcome, 'draw');
  assert.equal(h.snapshot().phase, 'ending');
  assert.equal(h.controller.attack('punch'), false);
  h.tick(1);
  assert.equal(h.snapshot().blue.clip, 'DefeatedLoop');
  assert.equal(h.snapshot().red.clip, 'DefeatedLoop');
  assert.equal(h.snapshot().canRematch, true);
});

test('lethal punch waits for defeat, two stretches and a full Uppercut before results and Rematch', () => {
  const h = harness({ spawn: 0.04, health: 8 });
  h.controller.attack('punch');
  h.tick(0.3);
  assert.equal(h.snapshot().red.clip, 'Defeat');
  assert.equal(h.snapshot().blue.clip, 'IdleAggro');
  assert.doesNotMatch(h.snapshot().message, /won/i);
  close(h.controller.getTransform('red').lift, 0);
  assert.equal(h.controller.rematch(), false);
  h.tick(0.8833333333);
  assert.equal(h.snapshot().blue.clip, 'IdleAggro');
  h.tick(1 / 60);
  assert.equal(h.snapshot().red.clip, 'DefeatedLoop');
  assert.equal(h.snapshot().blue.clip, 'Victory');
  const firstDance = h.snapshot().blue.animationId;
  h.tick(2.3);
  assert.equal(h.snapshot().blue.clip, 'Victory');
  assert.notEqual(h.snapshot().blue.animationId, firstDance);
  assert.doesNotMatch(h.snapshot().message, /won/i);
  h.tick(2.2833333333);
  assert.equal(h.snapshot().canRematch, false);
  h.tick(1 / 60);
  assert.equal(h.snapshot().blue.clip, 'VictoryUppercut');
  assert.equal(h.snapshot().canRematch, false);
  assert.equal(h.controller.rematch(), false);
  assert.doesNotMatch(h.snapshot().message, /won/i);
  const health = h.snapshot().red.health;
  const impacts = h.snapshot().impacts;
  assert.equal(h.controller.attack('punch'), false);
  assert.equal(h.controller.attack('uppercut'), false);
  h.tick(119 / 60);
  assert.equal(h.snapshot().blue.clip, 'VictoryUppercut');
  assert.equal(h.snapshot().canRematch, false);
  assert.equal(h.snapshot().red.health, health);
  assert.deepEqual(h.snapshot().impacts, impacts);
  h.tick(1 / 60);
  assert.equal(h.snapshot().blue.clip, 'IdleAggro');
  assert.equal(h.snapshot().red.clip, 'DefeatedLoop');
  assert.equal(h.snapshot().canRematch, true);
  assert.match(h.snapshot().message, /won/i);
});

test('background or direct session replacement keeps health/positions but requires fresh assets, placement and Resume', () => {
  const h = harness();
  h.near();
  h.controller.attack('punch');
  h.tick(0.3);
  const oldToken = h.token;
  const oldVersion = h.snapshot().placementVersion;
  const x = h.controller.getTransform('blue').x;
  h.replace();
  assert.equal(h.snapshot().phase, 'paused');
  assert.equal(h.snapshot().assetsLoaded, 0);
  assert.equal(h.snapshot().placed, false);
  assert.equal(h.controller.resume(), false);
  h.controller.assetLoaded(oldToken, oldVersion, 'blue');
  assert.equal(h.controller.assetFailed(oldToken, oldVersion, 'red'), false);
  h.controller.setTracking(oldToken, true);
  h.controller.setPlacement(oldToken, true);
  h.controller.tick(oldToken, 1 / 60);
  assert.equal(h.snapshot().assetsLoaded, 0);
  assert.equal(h.snapshot().error, null);
  h.load();
  assert.equal(h.controller.resume(), true);
  h.tick(1);
  assert.equal(h.snapshot().red.health, 92);
  close(h.controller.getTransform('blue').x, x);
});

test('plane removal rejects stale asset callbacks; failures recover only after scene Retry', () => {
  const h = harness();
  const oldVersion = h.snapshot().placementVersion;
  h.controller.setPlacement(h.token, false);
  assert.equal(h.snapshot().phase, 'paused');
  assert.equal(h.snapshot().animationsRunning, false);
  assert.equal(h.controller.assetFailed(h.token, oldVersion, 'arena'), false);
  h.controller.assetLoaded(h.token, oldVersion, 'red');
  assert.equal(h.snapshot().assetsLoaded, 0);
  const version = h.snapshot().placementVersion;
  assert.equal(h.controller.assetFailed(h.token, version, 'red'), true);
  assert.match(h.snapshot().error, /Red fighter/);
  h.controller.assetLoaded(h.token, version, 'red');
  assert.equal(h.snapshot().assetsLoaded, 0);
  h.replace();
  h.load();
  assert.equal(h.snapshot().error, null);
  assert.equal(h.controller.resume(), true);
});

test('CPU approaches using the same line and stops walking when in reach', () => {
  const h = harness({ cpuEnabled: true });
  h.tick(0.5);
  assert.equal(h.snapshot().red.clip, 'WalkForward');
  close(h.controller.getTransform('red').x, 0.055);
  h.tick(1.05);
  assert.ok(
    Math.abs(h.controller.getTransform('red').x - h.controller.getTransform('blue').x) <=
      ARENA_RULES.reach
  );
  assert.equal(h.snapshot().red.clip, 'IdleAggro');
  assert.equal(h.snapshot().blue.health, 100);
});

test('leaving and re-entering reach cannot bypass CPU recovery', () => {
  const h = harness({ cpuEnabled: true, spawn: 0.04, cpuFirstDelay: 0, cpuRecovery: 0.9 });
  h.tick(1 / 60);
  h.controller.command('jump-back');
  h.tick(0.65);
  assert.equal(h.snapshot().blue.health, 100);
  const until = h.controller.cpuRecoveryUntil;
  h.controller.fighters.blue.x = h.controller.fighters.red.x - 0.07;
  h.controller.setMovement('advance', false);
  h.tick(0.2);
  assert.notEqual(h.snapshot().red.mode, 'attack');
  assert.equal(h.controller.cpuRecoveryUntil, until);
  h.tick(Math.max(0, until - h.controller.clock) + 0.04);
  assert.equal(h.snapshot().red.mode, 'attack');
});

test('a close punch flinches the CPU for 200ms before its readable recovery', () => {
  const h = harness({ cpuEnabled: true, spawn: ARENA_RULES.separation / 2 });
  h.controller.attack('punch');
  h.tick(0.3);
  assert.equal(h.snapshot().red.health, 92);
  assert.equal(h.snapshot().red.clip, 'HitFrontFast');
  const hitPosition = h.controller.getTransform('red').x;
  h.tick(0.18);
  close(h.controller.getTransform('red').x, hitPosition);
  assert.equal(h.snapshot().red.mode, 'hit');
  h.tick(0.02);
  assert.ok(['idle', 'walk'].includes(h.snapshot().red.mode));
  assert.equal(h.snapshot().blue.health, 100);
});

test('medium CPU allows ordinary punches to land and loses to sustained close-range pressure', () => {
  const h = harness({ cpuEnabled: true, spawn: 0.04 });
  for (let frame = 0; frame < 60 * 20 && h.snapshot().phase === 'fighting'; frame++) {
    h.controller.attack('punch');
    h.tick(1 / 60);
  }
  assert.equal(h.snapshot().outcome, 'blue');
  assert.equal(h.snapshot().red.health, 0);
});

test('medium CPU still defeats a passive opponent using ordinary damage and health', () => {
  const h = harness({ cpuEnabled: true, spawn: 0.04 });
  h.tick(20);
  assert.equal(h.snapshot().outcome, 'red');
  assert.equal(h.snapshot().blue.health, 0);
  assert.equal(h.snapshot().red.health, ARENA_RULES.health);
});

test('clip tester changes either loaded model without fighting, and interruption restores idle', () => {
  const h = harness({}, false);
  assert.equal(h.controller.previewClip('red', 'Victory'), true);
  assert.equal(h.controller.ready(), false);
  assert.equal(h.snapshot().red.clip, 'Victory');
  h.tick(2.3);
  assert.equal(h.snapshot().red.clip, 'IdleAggro');
  h.controller.previewClip('blue', 'WalkForward');
  h.tick(3);
  close(h.controller.getTransform('blue').x, -0.095);
  h.controller.setTracking(h.token, false);
  assert.equal(h.snapshot().preview, null);
  assert.equal(h.snapshot().blue.clip, 'IdleAggro');
  assert.equal(h.controller.previewClip('red', 'missing'), false);
});

test('ordinary movement ticks keep the HUD snapshot stable; frame sampling reports observed cadence', () => {
  const h = harness();
  let updates = 0;
  h.controller.subscribe(() => updates++);
  h.controller.setMovement('advance', true);
  h.tick(0.5);
  assert.equal(updates, 1);
  for (let i = 0; i < 60; i++) h.controller.recordFrame(h.token, 1 / 30);
  assert.equal(h.snapshot().fps, 30);
  assert.equal(h.snapshot().frameSamples, 60);
  h.controller.dispose();
  assert.equal(h.controller.attack('punch'), false);
  h.controller.assetLoaded(h.token, h.snapshot().placementVersion, 'blue');
  assert.equal(h.snapshot().assetsLoaded, 0);
});
