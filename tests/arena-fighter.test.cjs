const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  ArenaController,
  ARENA_RULES,
} = require('../src/features/arena-fighter/arena-controller.ts');
const { updateHeldTouches } = require('../src/features/arena-fighter/arena-touch-input.ts');

function harness(rules = {}, ready = true) {
  const controller = new ArenaController({ cpuEnabled: false, ...rules });
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

test('movement uses held input, arena X, 8cm/s, bounds and minimum separation', () => {
  const h = harness();
  h.tick(1);
  close(h.controller.getTransform('blue').x, -0.095);
  h.controller.setMovement('retreat', true);
  h.tick(0.5);
  close(h.controller.getTransform('blue').x, -0.135);
  assert.equal(h.snapshot().blue.clip, 'WalkBackward');
  h.tick(1);
  close(h.controller.getTransform('blue').x, -0.14);
  assert.equal(h.snapshot().blue.clip, 'IdleAggro');
  h.controller.setMovement('advance', true);
  h.tick(1);
  close(h.controller.getTransform('blue').x, -0.14);
  h.controller.setMovement('retreat', false);
  h.tick(4);
  close(h.controller.getTransform('red').x - h.controller.getTransform('blue').x, 0.055);
  close(h.controller.getTransform('red').x, 0.095);
  assert.equal(h.snapshot().blue.clip, 'IdleAggro');
});

test('swapped sides reverse advance/retreat and facing while arena rotation leaves the fighting line local', () => {
  const h = harness({}, false);
  h.controller.swapSides();
  h.controller.rotateArena();
  assert.equal(h.snapshot().arenaYaw, 90);
  close(h.controller.getTransform('blue').x, 0.095);
  assert.equal(h.controller.getTransform('blue').yaw, -90);
  assert.equal(h.controller.getTransform('red').yaw, 90);
  h.controller.ready();
  h.controller.setMovement('retreat', true);
  h.tick(2);
  close(h.controller.getTransform('blue').x, 0.14);
  h.controller.setMovement('retreat', false);
  h.controller.setMovement('advance', true);
  h.tick(4);
  close(h.controller.getTransform('blue').x - h.controller.getTransform('red').x, 0.055);
  h.controller.rotateArena();
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

test('jab hands repeat left left right left right right and held movement never repeats an attack', () => {
  const h = harness();
  const hands = [];
  for (let i = 0; i < 8; i++) {
    assert.equal(h.controller.attack('punch'), true);
    hands.push(h.snapshot().blue.clip);
    h.tick(0.65);
  }
  assert.deepEqual(
    hands,
    ['L', 'L', 'R', 'L', 'R', 'R', 'L', 'L'].map((hand) => `Combo_Punch${hand}`)
  );
  h.tick(2);
  assert.equal(h.snapshot().blue.mode, 'idle');
  assert.equal(h.snapshot().red.health, 100);
});

test('uppercut hands alternate independently and its three-second cooldown starts on misses', () => {
  const h = harness();
  assert.equal(h.controller.attack('uppercut'), true);
  assert.equal(h.snapshot().blue.clip, 'Combo_UppercutL');
  assert.equal(h.snapshot().blue.uppercutRemaining, 3);
  h.tick(0.9);
  assert.equal(h.snapshot().blue.mode, 'idle');
  assert.equal(h.controller.attack('uppercut'), false);
  assert.equal(h.controller.attack('punch'), true);
  assert.equal(h.snapshot().blue.clip, 'Combo_PunchL');
  h.tick(2.0833333333);
  assert.equal(h.controller.attack('uppercut'), false);
  h.tick(1 / 60);
  assert.equal(h.controller.attack('uppercut'), true);
  assert.equal(h.snapshot().blue.clip, 'Combo_UppercutR');
  assert.equal(h.snapshot().red.health, 100);
});

test('one buffered move is first-wins, starts after the current clip and rejects unavailable uppercuts', () => {
  const h = harness();
  h.controller.attack('punch');
  assert.equal(h.controller.attack('uppercut'), true);
  assert.equal(h.controller.attack('punch'), false);
  h.tick(0.65);
  assert.equal(h.snapshot().blue.clip, 'Combo_UppercutL');
  assert.equal(h.controller.attack('uppercut'), false);
  assert.equal(h.controller.attack('punch'), true);
  h.tick(0.9);
  assert.equal(h.snapshot().blue.clip, 'Combo_PunchL');
  h.tick(0.65);
  assert.equal(h.snapshot().blue.mode, 'idle');
});

test('damage is timed once per clip and an uppercut deals 1.5 times punch damage without lifting on nonlethal hits', () => {
  const h = harness();
  h.near();
  h.controller.attack('punch');
  h.tick(17 / 60);
  assert.equal(h.snapshot().red.health, 100);
  h.tick(1 / 60);
  assert.equal(h.snapshot().red.health, 90);
  h.tick(0.7);
  assert.equal(h.snapshot().red.health, 90);
  h.controller.attack('uppercut');
  h.tick(28 / 60);
  assert.equal(h.snapshot().red.health, 90);
  h.tick(1 / 60);
  assert.equal(h.snapshot().red.health, 75);
  close(h.controller.getTransform('red').lift, 0);
  assert.equal(h.snapshot().red.clip, 'HitFront');
});

test('reach is checked at the hit event: retreat can turn a started attack into a miss', () => {
  const h = harness({ spawn: 0.04 });
  h.controller.attack('punch', 'red');
  h.controller.setMovement('retreat', true);
  h.tick(0.3);
  assert.equal(h.snapshot().blue.health, 100);
  h.tick(1);
  assert.equal(h.snapshot().blue.health, 100);
});

test('a hit cancels staggered attacks and buffered input, preserving an interrupted uppercut cooldown', () => {
  const h = harness({ spawn: 0.04 });
  h.controller.attack('uppercut', 'red');
  h.controller.attack('punch', 'red');
  h.controller.attack('punch');
  h.tick(0.3);
  assert.equal(h.snapshot().red.health, 90);
  assert.equal(h.snapshot().red.mode, 'hit');
  assert.equal(h.controller.attack('punch', 'red'), false);
  h.tick(1);
  assert.equal(h.snapshot().blue.health, 100);
  assert.equal(h.snapshot().red.mode, 'idle');
  assert.ok(h.snapshot().red.uppercutRemaining > 0);
  h.tick(1.7);
  assert.equal(h.snapshot().red.clip, 'IdleAggro');
  assert.equal(h.controller.attack('uppercut', 'red'), true);
  assert.equal(h.snapshot().red.clip, 'Combo_UppercutR');
});

test('hits due in the same step damage both fighters independent of attack command order', () => {
  for (const order of [
    ['blue', 'red'],
    ['red', 'blue'],
  ]) {
    const h = harness({ spawn: 0.04 });
    for (const id of order) h.controller.attack('punch', id);
    h.tick(0.3);
    assert.equal(h.snapshot().blue.health, 90);
    assert.equal(h.snapshot().red.health, 90);
    assert.equal(h.snapshot().blue.mode, 'hit');
    assert.equal(h.snapshot().red.mode, 'hit');
  }
});

test('simultaneous lethal attacks produce a draw, stop combat and settle both defeated poses', () => {
  const h = harness({ spawn: 0.04, health: 10 });
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

test('lethal punch stays grounded, plays defeat and one 2.3-second victory before enabling Rematch', () => {
  const h = harness({ spawn: 0.04, health: 10 });
  h.controller.attack('punch');
  h.tick(0.3);
  assert.equal(h.snapshot().red.clip, 'Defeat');
  assert.equal(h.snapshot().blue.clip, 'Victory');
  close(h.controller.getTransform('red').lift, 0);
  assert.equal(h.controller.rematch(), false);
  h.tick(2.2833333333);
  assert.equal(h.snapshot().canRematch, false);
  h.tick(1 / 60);
  assert.equal(h.snapshot().blue.clip, 'IdleAggro');
  assert.equal(h.snapshot().red.clip, 'DefeatedLoop');
  assert.equal(h.snapshot().canRematch, true);
});

test('only a finishing uppercut launches through a 0.8-second arc with an 18cm apex then lands and defeats', () => {
  const h = harness({ spawn: 0.04, health: 15 });
  h.controller.attack('uppercut');
  h.tick(29 / 60);
  assert.equal(h.snapshot().red.mode, 'launch');
  h.tick(0.4);
  close(h.controller.getTransform('red').lift, 0.18);
  h.tick(0.4);
  close(h.controller.getTransform('red').lift, 0);
  assert.equal(h.snapshot().red.clip, 'Defeat');
  h.tick(0.9);
  assert.equal(h.snapshot().red.clip, 'DefeatedLoop');
  assert.equal(h.snapshot().canRematch, false);
  h.tick(0.6);
  assert.equal(h.snapshot().canRematch, true);
});

test('rematch resets health, spawn, hands, cooldown, buffers and outcome while retaining side and placement', () => {
  const h = harness({ spawn: 0.04, health: 15 }, false);
  h.controller.swapSides();
  h.controller.rotateArena();
  h.controller.ready();
  const original = h.snapshot();
  h.controller.attack('uppercut');
  h.controller.attack('punch');
  h.tick(29 / 60);
  h.tick(2.4);
  assert.equal(h.controller.rematch(), true);
  assert.equal(h.snapshot().blue.health, 15);
  assert.equal(h.snapshot().red.health, 15);
  assert.equal(h.snapshot().blue.uppercutRemaining, 0);
  assert.equal(h.snapshot().outcome, null);
  assert.equal(h.snapshot().placed, true);
  assert.equal(h.snapshot().placementVersion, original.placementVersion);
  assert.equal(h.snapshot().arenaYaw, 90);
  close(h.controller.getTransform('blue').x, 0.04);
  assert.ok(h.snapshot().blue.animationId > original.blue.animationId);
  assert.equal(h.controller.attack('punch', 'blue', original.roundId), false);
  h.controller.setMovement('advance', true, original.roundId);
  h.tick(1);
  close(h.controller.getTransform('blue').x, 0.04);
  h.controller.attack('uppercut');
  assert.equal(h.snapshot().blue.clip, 'Combo_UppercutL');
});

test('tracking loss freezes combat/cooldowns, cancels pending damage and input, and requires explicit stable Resume', () => {
  const h = harness({ spawn: 0.04 });
  h.controller.attack('uppercut');
  h.controller.attack('punch');
  h.controller.setMovement('advance', true);
  h.tick(0.2);
  const remaining = h.snapshot().blue.uppercutRemaining;
  h.controller.setTracking(h.token, false);
  assert.equal(h.snapshot().phase, 'paused');
  assert.equal(h.snapshot().animationsRunning, false);
  assert.equal(h.snapshot().blue.clip, 'IdleAggro');
  h.tick(10);
  assert.equal(h.snapshot().blue.uppercutRemaining, remaining);
  assert.equal(h.snapshot().red.health, 100);
  h.controller.setTracking(h.token, true);
  h.tick(29 / 60);
  assert.equal(h.controller.resume(), false);
  h.tick(1 / 60);
  assert.equal(h.snapshot().animationsRunning, false);
  assert.equal(h.controller.resume(), true);
  h.tick(0.7);
  assert.equal(h.snapshot().red.health, 100);
  close(h.controller.getTransform('blue').x, -0.04);
  assert.equal(h.snapshot().blue.clip, 'IdleAggro');
});

test('tracking loss and background replacement preserve an unfinished knockout until Resume', () => {
  const h = harness({ spawn: 0.04, health: 15 });
  h.controller.attack('uppercut');
  h.tick(29 / 60);
  h.tick(0.2);
  const lift = h.controller.getTransform('red').lift;
  h.controller.setTracking(h.token, false);
  h.tick(5);
  close(h.controller.getTransform('red').lift, lift);
  h.controller.setTracking(h.token, true);
  h.tick(0.5);
  h.controller.resume();
  h.tick(0.2);
  close(h.controller.getTransform('red').lift, 0.18);
  h.controller.detachSession(h.token);
  assert.equal(h.snapshot().phase, 'paused');
  close(h.controller.getTransform('red').lift, 0.18);
  h.replace();
  h.load();
  assert.equal(h.snapshot().outcome, 'blue');
  assert.equal(h.snapshot().canRematch, false);
  assert.equal(h.controller.resume(), true);
  h.tick(3);
  assert.equal(h.snapshot().canRematch, true);
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
  assert.equal(h.snapshot().red.health, 90);
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

test('CPU applies pressure after a short opening beat, varies recovery and obeys uppercut cooldown', () => {
  const h = harness({ cpuEnabled: true, spawn: 0.04 });
  const attacks = [];
  let elapsed = 0;
  let lastMode = 'idle';
  while (attacks.length < 7 && elapsed < 8) {
    h.tick(1 / 60);
    elapsed += 1 / 60;
    const mode = h.snapshot().red.mode;
    if (mode === 'attack' && lastMode !== 'attack')
      attacks.push({ time: elapsed, clip: h.snapshot().red.clip });
    lastMode = mode;
  }
  assert.equal(attacks.length, 7);
  assert.ok(attacks[0].time >= ARENA_RULES.cpuFirstDelay);
  assert.ok(attacks[0].time <= ARENA_RULES.cpuFirstDelay + 2 / 60);
  const firstGap = attacks[1].time - attacks[0].time;
  const secondGap = attacks[2].time - attacks[1].time;
  assert.ok(firstGap >= 0.65 + ARENA_RULES.cpuRecovery - 1 / 60 && firstGap < 1.3);
  assert.ok(secondGap >= 0.65 && secondGap < firstGap);
  assert.deepEqual(
    attacks.slice(0, 3).map((entry) => entry.clip),
    ['Combo_PunchL', 'Combo_PunchL', 'Combo_UppercutL']
  );
  const uppercuts = attacks.filter((entry) => entry.clip.includes('Uppercut'));
  assert.equal(uppercuts.length, 2);
  assert.ok(uppercuts[1].time - uppercuts[0].time >= ARENA_RULES.uppercutCooldown);
  assert.equal(uppercuts[1].clip, 'Combo_UppercutR');
  assert.equal(h.snapshot().red.health, 100);
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

test('leaving and re-entering reach cannot bypass the CPU recovery delay', () => {
  const h = harness({ cpuEnabled: true, spawn: 0.04, cpuFirstDelay: 0, cpuRecovery: 0.9 });
  h.tick(1 / 60);
  assert.equal(h.snapshot().red.mode, 'attack');
  h.controller.setMovement('retreat', true);
  h.tick(0.5);
  assert.ok(
    Math.abs(h.controller.getTransform('red').x - h.controller.getTransform('blue').x) >
      ARENA_RULES.reach
  );
  assert.equal(h.snapshot().blue.health, 100);
  h.controller.setMovement('retreat', false);
  h.tick(8 / 60);
  assert.equal(h.snapshot().red.mode, 'idle');
  h.controller.setMovement('advance', true);
  h.tick(14 / 60);
  h.controller.setMovement('advance', false);
  assert.ok(
    Math.abs(h.controller.getTransform('red').x - h.controller.getTransform('blue').x) <=
      ARENA_RULES.reach
  );
  h.tick(0.8);
  assert.equal(h.snapshot().red.mode, 'idle');
  h.tick(0.25);
  assert.equal(h.snapshot().red.mode, 'attack');
});

test('CPU reacts to a telegraphed uppercut after a visible delay and punishes the miss', () => {
  const h = harness({ cpuEnabled: true, spawn: 0.038 });
  h.controller.attack('uppercut');
  const start = h.controller.getTransform('red').x;
  h.tick(ARENA_RULES.cpuReaction);
  close(h.controller.getTransform('red').x, start);
  h.tick(2 / 60);
  assert.equal(h.snapshot().red.clip, 'WalkBackward');
  assert.ok(h.controller.getTransform('red').x > start);
  h.tick(16 / 60);
  assert.equal(h.snapshot().red.health, 100);
  h.tick(4 / 60);
  assert.equal(h.snapshot().red.clip, 'Combo_PunchL');
  h.tick(0.3);
  assert.equal(h.snapshot().blue.health, 90);
  assert.equal(h.snapshot().red.health, 100);
  assert.ok(h.snapshot().blue.uppercutRemaining > 2);
});

test('a close punch can catch the CPU and its stagger prevents moving or attacking', () => {
  const h = harness({ cpuEnabled: true, spawn: ARENA_RULES.separation / 2 });
  h.controller.attack('punch');
  h.tick(0.3);
  assert.equal(h.snapshot().red.health, 90);
  assert.equal(h.snapshot().red.clip, 'HitFront');
  const hitPosition = h.controller.getTransform('red').x;
  h.tick(0.4);
  close(h.controller.getTransform('red').x, hitPosition);
  assert.equal(h.snapshot().red.mode, 'hit');
  assert.equal(h.snapshot().blue.health, 100);
});

test('CPU protects its spacing when approached and keeps speed, bounds and separation on either side', () => {
  for (const swapped of [false, true]) {
    const h = harness({ cpuEnabled: true, spawn: 0.04 }, false);
    if (swapped) h.controller.swapSides();
    h.controller.ready();
    h.controller.setMovement('advance', true);
    let previous = h.controller.getTransform('red').x;
    h.tick(10 / 60);
    assert.equal(h.snapshot().red.clip, 'WalkBackward');
    assert.ok(
      swapped
        ? h.controller.getTransform('red').x < previous
        : h.controller.getTransform('red').x > previous
    );
    previous = h.controller.getTransform('red').x;
    for (let frame = 0; frame < 60 * 10; frame++) {
      if (frame % 90 === 0) h.controller.attack('uppercut');
      h.tick(1 / 60);
      const red = h.controller.getTransform('red').x;
      const blue = h.controller.getTransform('blue').x;
      assert.ok(Math.abs(red - previous) <= ARENA_RULES.speed / 60 + 1e-7);
      assert.ok(Math.abs(red) <= ARENA_RULES.boundary + 1e-7);
      assert.ok(Math.abs(red - blue) >= ARENA_RULES.separation - 1e-7);
      previous = red;
    }
  }
});

test('CPU uses an available uppercut to finish 11-15 health and a fast punch for 10 health', () => {
  for (const health of [10, 15]) {
    const h = harness({ cpuEnabled: true, spawn: 0.04, health });
    h.tick(32 / 60);
    assert.equal(h.snapshot().red.clip, health === 15 ? 'Combo_UppercutL' : 'Combo_PunchL');
    h.tick(0.5);
    assert.equal(h.snapshot().outcome, 'red');
    assert.equal(h.snapshot().blue.health, 0);
    assert.equal(h.snapshot().red.health, health);
  }
});

test('a cornered CPU counters rather than waiting forever for room to evade', () => {
  const h = harness({ cpuEnabled: true, spawn: ARENA_RULES.boundary, cpuRecovery: 0.5 });
  // Keep Red busy at its starting boundary while Blue closes the initial gap.
  h.controller.setMovement('advance', true);
  for (let frame = 0; frame < 195; frame++) {
    h.controller.attack('punch', 'red');
    h.tick(1 / 60);
  }
  h.controller.setMovement('advance', false);
  for (
    let frame = 0;
    frame < 60 && (h.snapshot().red.mode === 'attack' || h.snapshot().blue.mode === 'hit');
    frame++
  )
    h.tick(1 / 60);
  close(h.controller.getTransform('red').x, ARENA_RULES.boundary);
  assert.equal(h.controller.attack('uppercut'), true);
  h.tick(0.35);
  close(h.controller.getTransform('red').x, ARENA_RULES.boundary);
  assert.equal(h.snapshot().red.mode, 'attack');
  assert.ok(h.snapshot().red.clip.includes('Punch'));
});

test('medium CPU allows ordinary punches to land and loses to sustained close-range pressure', () => {
  const h = harness({ cpuEnabled: true, spawn: 0.04 });
  for (let frame = 0; frame < 60 * 20 && h.snapshot().phase === 'fighting'; frame++) {
    h.controller.attack('punch'); h.tick(1 / 60);
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

test('CPU reaction and attack scheduling freeze on tracking loss and restart fairly on Resume/rematch', () => {
  const h = harness({ cpuEnabled: true, spawn: 0.04, health: 15 });
  h.controller.attack('uppercut');
  h.tick(0.1);
  h.controller.setTracking(h.token, false);
  const cpuPosition = h.controller.getTransform('red').x;
  h.tick(5);
  assert.equal(h.snapshot().red.mode, 'idle');
  close(h.controller.getTransform('red').x, cpuPosition);
  assert.equal(h.snapshot().blue.health, 15);
  h.controller.setTracking(h.token, true);
  h.tick(0.5);
  h.controller.resume();
  h.tick(0.5);
  assert.equal(h.snapshot().red.mode, 'idle');
  h.tick(1 / 60);
  assert.equal(h.snapshot().red.clip, 'Combo_UppercutL');
  h.tick(0.5);
  assert.equal(h.snapshot().outcome, 'red');
  h.tick(2.4);
  assert.equal(h.controller.rematch(), true);
  h.tick(32 / 60);
  assert.equal(h.snapshot().red.clip, 'Combo_UppercutL');
  assert.equal(h.snapshot().red.health, 15);
  assert.equal(h.snapshot().blue.health, 15);
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
