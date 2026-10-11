const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  ArenaController,
  ARENA_RULES,
} = require('../src/features/arena-fighter/arena-controller.ts');
const {
  distance,
  inCone,
  interpolateYaw,
} = require('../src/features/arena-fighter/arena-combat-motion.ts');
const {
  combatControlLayout,
  COMBAT_CONTROLS,
} = require('../src/features/arena-fighter/arena-control-layout.ts');

function harness(rules = {}, swapped = false) {
  const c = new ArenaController(
    {
      cpuEnabled: false,
      spawn: 0.04,
      punchHitstop: 0,
      uppercutHitstop: 0,
      blockHitstop: 0,
      ...rules,
    },
    () => 0
  );
  const token = c.attachSession(1);
  c.setLandscape(true);
  c.setTracking(token, true);
  c.setPlacement(token, true);
  for (const a of ['arena', 'blue', 'red'])
    c.assetLoaded(token, c.getSnapshot().placementVersion, a);
  const step = (s) => {
    while (s > 1e-8) {
      const dt = Math.min(s, 1 / 60);
      c.tick(token, dt);
      s -= dt;
    }
  };
  step(0.5);
  if (swapped) c.swapSides();
  assert.equal(c.ready(), true);
  return {
    c,
    token,
    step,
    s: () => c.getSnapshot(),
    cmd: (kind, id = 'blue') => c.command(kind, id),
    earn: (id = 'blue') => {
      for (let i = 0; i < ARENA_RULES.punchStringLength; i++) {
        assert.equal(c.attack('punch', id), true);
        step(0.65);
      }
    },
  };
}
function near(a, b, tolerance = 1e-6) {
  assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
}
function reward(h, id = 'blue', seconds = 2) {
  h.c.fighters[id].punchProgress = ARENA_RULES.punchStringLength;
  h.c.fighters[id].uppercutWindowUntil = h.c.clock + seconds;
  h.c.publish();
}

for (const defender of ['blue', 'red'])
  for (const swapped of [false, true]) {
    test(`frontal guard absorbs contact, preserves both partial combos, grants no third-hit reward: ${defender}, swapped=${swapped}`, () => {
      const h = harness({}, swapped),
        attacker = defender === 'blue' ? 'red' : 'blue';
      h.c.fighters[defender].punchProgress = 2;
      h.c.fighters[attacker].punchProgress = 2;
      assert.ok(h.cmd('block-down', defender));
      h.step(0.1);
      assert.equal(h.s()[defender].guardState, 'holding');
      h.cmd('punch', attacker);
      h.step(0.3);
      assert.equal(h.s()[defender].health, 100);
      assert.equal(h.s()[defender].punchProgress, 2);
      assert.equal(h.s()[attacker].punchProgress, 2);
      assert.equal(h.s()[attacker].uppercutReady, false);
      assert.equal(h.s()[defender].impact.outcome, 'blocked');
      assert.equal(h.c.fighters[defender].staggerUntil, 0);
      assert.equal(h.s()[defender].clip, 'BlockHit');
      h.step(0.15);
      assert.equal(h.s()[defender].clip, 'BlockHold');
    });
  }
test('guard startup takes 100ms; a punch arriving at 80ms causes ordinary damage', () => {
  const h = harness();
  h.cmd('punch');
  h.step(0.22);
  h.cmd('block-down', 'red');
  h.step(0.08);
  assert.equal(h.s().red.health, 92);
  assert.equal(h.s().red.guardState, 'off');
});
test('holding guard rejects attacks and hops; release allows exactly one buffered action', () => {
  const h = harness();
  h.cmd('block-down');
  h.step(0.1);
  assert.equal(h.cmd('punch'), false);
  assert.equal(h.cmd('uppercut'), false);
  assert.equal(h.cmd('jump-back'), false);
  h.cmd('block-up');
  assert.equal(h.s().blue.clip, 'BlockExit');
  assert.equal(h.cmd('punch'), true);
  assert.equal(h.cmd('jump-back'), false);
  h.step(0.09);
  assert.equal(h.s().blue.mode, 'guard-exit');
  h.step(0.01);
  assert.equal(h.s().blue.mode, 'attack');
  assert.equal(h.s().blue.clip, 'Combo_PunchL');
});
test('earned Uppercut replaces a buffered Punch during lowering and is reserved exactly once', () => {
  const h = harness();
  reward(h);
  h.cmd('block-down');
  h.step(0.1);
  h.cmd('block-up');
  assert.ok(h.cmd('punch'));
  assert.ok(h.cmd('uppercut'));
  assert.equal(h.cmd('uppercut'), false);
  assert.equal(h.s().blue.punchProgress, 0);
  h.step(0.1);
  assert.equal(h.s().blue.clip, 'Combo_UppercutL');
  h.step(0.48);
  assert.equal(h.s().red.health, 85);
  assert.equal(h.s().red.mode, 'launch');
});
test('a queued hop is not replaced by an Uppercut; guarding never extends a reward timer', () => {
  const h = harness();
  reward(h, 'blue', 0.3);
  h.cmd('block-down');
  h.step(0.1);
  h.cmd('block-up');
  assert.ok(h.cmd('jump-back'));
  assert.equal(h.cmd('uppercut'), false);
  h.step(0.1);
  assert.equal(h.s().blue.mode, 'hop');
  h.step(0.15);
  assert.equal(h.s().blue.uppercutReady, false);
  assert.equal(h.s().blue.punchProgress, 0);
});
test('blocking preserves an earned reward until its original deadline while disallowing its use', () => {
  const h = harness();
  reward(h, 'blue', 0.3);
  h.cmd('block-down');
  h.step(0.2);
  assert.equal(h.s().blue.uppercutReady, true);
  assert.equal(h.cmd('uppercut'), false);
  h.step(0.1);
  assert.equal(h.s().blue.uppercutReady, false);
  assert.equal(h.s().blue.guardState, 'holding');
});
test('exhausting punch is absorbed, guard drops, subsequent damage resets combo; release is required', () => {
  const h = harness({ guardCapacity: 35 });
  h.c.fighters.red.punchProgress = 2;
  h.cmd('block-down', 'red');
  h.step(0.1);
  h.cmd('punch');
  h.step(0.3);
  assert.equal(h.s().red.health, 100);
  assert.equal(h.s().red.punchProgress, 2);
  assert.equal(h.s().red.guardState, 'exhausted');
  assert.equal(h.s().red.impact.outcome, 'guard-break');
  assert.equal(h.cmd('block-down', 'red'), false);
  h.step(0.65);
  h.cmd('punch');
  h.step(0.3);
  assert.equal(h.s().red.health, 92);
  assert.equal(h.s().red.punchProgress, 0);
  h.step(2);
  assert.equal(h.cmd('block-down', 'red'), false);
  h.cmd('block-up', 'red');
  assert.equal(h.cmd('block-down', 'red'), true);
});
test('stamina drains while held and regenerates only after the grounded release delay', () => {
  const h = harness();
  h.cmd('block-down');
  h.step(1);
  near(h.c.fighters.blue.guardStamina, 85);
  h.cmd('block-up');
  h.step(0.59);
  near(h.c.fighters.blue.guardStamina, 85);
  h.step(0.11);
  near(h.c.fighters.blue.guardStamina, 88.5);
  h.step(1);
  near(h.s().blue.guardStamina, 100);
  h.c.fighters.blue.guardStamina = 24;
  assert.equal(h.cmd('block-down'), false);
});
test('guarded Advance and circling use 40 percent speed without moving the opponent', () => {
  const h = harness({ spawn: 0.09 });
  h.cmd('block-down');
  h.step(0.1);
  const before = h.c.getTransform('blue'),
    other = h.c.getTransform('red');
  h.c.setMovement('advance', true);
  h.step(0.2);
  near(distance(before, h.c.getTransform('blue')), 0.08 * 0.4 * 0.2);
  assert.deepEqual(h.c.getTransform('red'), other);
  assert.equal(h.s().blue.clip, 'BlockAdvance');
  h.c.setMovement('advance', false);
  h.c.setMovement('strafeLeft', true);
  h.step(0.1);
  assert.equal(h.s().blue.clip, 'BlockStrafeLeft');
});
for (const mode of ['attack', 'hit', 'launch', 'landing', 'hop', 'settling', 'guard-break']) {
  test(`Block-down rejects ${mode}, does not cancel or queue`, () => {
    const h = harness();
    const f = h.c.fighters.blue;
    f.mode = mode;
    f.clip = 'HitFront';
    h.c.publish();
    assert.equal(h.cmd('block-down'), false);
    assert.equal(f.mode, mode);
    assert.equal(f.buffered, null);
    assert.equal(f.guardHeld, false);
  });
}
for (const hand of [0, 1])
  test(`Uppercut ${hand ? 'R' : 'L'} breaks through effective guard and launches`, () => {
    const h = harness();
    h.c.fighters.blue.uppercutIndex = hand;
    reward(h);
    h.cmd('block-down', 'red');
    h.step(0.1);
    h.cmd('uppercut');
    h.step(0.48);
    assert.equal(h.s().red.health, 85);
    assert.equal(h.s().red.mode, 'launch');
    assert.equal(h.s().red.impact.outcome, 'hit');
    assert.equal(h.s().red.guardHeld, false);
  });
for (const id of ['blue', 'red'])
  for (const swapped of [false, true])
    test(`one backward hop captures direction, lift and recovery: ${id}, swapped=${swapped}`, () => {
      const h = harness({}, swapped),
        start = h.c.getTransform(id);
      assert.ok(h.cmd('jump-back', id));
      assert.equal(h.cmd('jump-back', id), false);
      assert.equal(h.cmd('punch', id), false);
      assert.equal(h.cmd('block-down', id), false);
      h.step(2 / 30);
      near(distance(start, h.c.getTransform(id)), 0);
      near(h.c.getTransform(id).lift, 0);
      h.step(4 / 30);
      near(h.c.getTransform(id).lift, 0.025);
      near(distance(start, h.c.getTransform(id)), 0.06 * 0.875);
      h.c.setMovement('advance', true, undefined, id);
      h.c.setMovement('strafeLeft', true, undefined, id);
      h.step(0.2);
      near(distance(start, h.c.getTransform(id)), 0.06);
      near(h.c.getTransform(id).lift, 0);
      assert.equal(h.s()[id].mode, 'idle');
      assert.equal(h.cmd('jump-back', id), false);
      h.step(0.25);
      assert.ok(h.cmd('jump-back', id));
    });
test('hop clamps along its captured path at a circular boundary and rejects under one cm', () => {
  const h = harness();
  h.c.fighters.blue.x = -0.12;
  h.c.fighters.blue.z = 0.04;
  h.c.fighters.red.x = 0.0;
  h.c.fighters.red.z = 0.04;
  assert.ok(h.cmd('jump-back'));
  h.step(0.4);
  near(Math.hypot(h.c.getTransform('blue').x, h.c.getTransform('blue').z), 0.14);
  h.step(0.25);
  assert.equal(h.cmd('jump-back'), false);
});
for (const lethal of [false, true])
  test(`a punch interrupts an airborne hop, settles for 100ms, then ${lethal ? 'Defeat' : 'HitFrontFast'}`, () => {
    const h = harness({ hopTravel: 0.012, reach: 0.12 });
    if (lethal) h.c.fighters.red.health = 8;
    h.cmd('punch');
    h.step(0.17);
    h.cmd('jump-back', 'red');
    h.step(0.13);
    assert.equal(h.s().red.mode, 'settling');
    const initial = h.c.getTransform('red');
    assert.ok(initial.lift > 0);
    h.step(0.05);
    const mid = h.c.getTransform('red');
    near(mid.x, initial.x);
    assert.ok(mid.lift < initial.lift && mid.lift > 0);
    h.step(0.05);
    near(h.c.getTransform('red').lift, 0);
    assert.equal(h.s().red.mode, lethal ? 'defeat' : 'hit');
    if (!lethal) {
      h.step(0.19);
      assert.equal(h.s().red.mode, 'hit');
      h.step(0.01);
      assert.equal(h.s().red.mode, 'idle');
    }
  });
test('an Uppercut hit during a hop starts launch at the current lift without snapping', () => {
  const h = harness({ hopTravel: 0.012 });
  reward(h);
  h.cmd('uppercut');
  h.step(0.41);
  h.cmd('jump-back', 'red');
  h.step(0.07);
  assert.equal(h.s().red.mode, 'launch');
  const lift = h.c.getTransform('red').lift;
  assert.ok(lift > 0);
  near(lift, h.s().red.motionInitialLift);
  h.step(1 / 60);
  assert.ok(h.c.getTransform('red').lift > lift);
  h.step(0.8);
  assert.equal(h.s().red.mode, 'landing');
});
for (const both of [false, true])
  for (const direction of ['strafeLeft', 'strafeRight'])
    test(`unconstrained ${direction} maintains spacing, both=${both}`, () => {
      const h = harness();
      const original = distance(h.c.getTransform('blue'), h.c.getTransform('red')),
        red = h.c.getTransform('red');
      h.c.setMovement(direction, true);
      if (both) h.c.setMovement(direction, true, undefined, 'red');
      h.step(0.5);
      near(distance(h.c.getTransform('blue'), h.c.getTransform('red')), original);
      if (!both) {
        near(h.c.getTransform('red').x, red.x);
        near(h.c.getTransform('red').z, red.z);
      }
      assert.ok(Math.abs(h.c.getTransform('blue').z) > 0.01);
    });
test('opposite held strafe inputs cancel; combined Advance spirals inward at capped speed', () => {
  const h = harness({ spawn: 0.07 }),
    before = h.c.getTransform('blue');
  h.c.setMovement('strafeLeft', true);
  h.c.setMovement('strafeRight', true);
  h.step(0.2);
  assert.deepEqual(h.c.getTransform('blue'), before);
  h.c.setMovement('strafeRight', false);
  h.c.setMovement('advance', true);
  h.step(1 / 60);
  const after = h.c.getTransform('blue');
  assert.ok(distance(before, after) <= 0.08 / 60 + 1e-6);
  assert.ok(distance(after, h.c.getTransform('red')) < 0.14);
  assert.ok(after.z !== 0);
});
test('two fighters circle at minimum spacing for sustained motion without expanding the orbit', () => {
  const h = harness({ spawn: 0.0275 });
  h.c.setMovement('strafeLeft', true);
  h.c.setMovement('strafeLeft', true, undefined, 'red');
  for (let i = 0; i < 600; i++) {
    h.step(1 / 60);
    near(distance(h.c.getTransform('blue'), h.c.getTransform('red')), 0.055);
  }
});
test('boundary-constrained spirals remain in the circle and never push a stationary opponent', () => {
  const h = harness({ spawn: 0.09 });
  const red = h.c.getTransform('red');
  h.c.setMovement('strafeLeft', true);
  h.c.setMovement('advance', true);
  for (let i = 0; i < 600; i++) {
    h.step(1 / 60);
    for (const id of ['blue', 'red'])
      assert.ok(Math.hypot(h.c.getTransform(id).x, h.c.getTransform(id).z) <= 0.14 + 1e-7);
    assert.ok(distance(h.c.getTransform('blue'), h.c.getTransform('red')) >= 0.055 - 1e-7);
  }
  near(h.c.getTransform('red').x, red.x);
  near(h.c.getTransform('red').z, red.z);
});
for (const attacker of ['blue', 'red'])
  test(`circling exits a committed ${attacker} center cone but visible contact counts while facing stays locked`, () => {
    const h = harness({ spawn: 0.0275 }),
      defender = attacker === 'blue' ? 'red' : 'blue';
    h.cmd('punch', attacker);
    const yaw = h.c.getTransform(attacker).yaw;
    h.c.setMovement('strafeLeft', true, undefined, defender);
    h.step(0.3);
    near(h.c.getTransform(attacker).yaw, yaw);
    assert.equal(h.s()[defender].health, 92);
    assert.equal(inCone(h.c.getTransform(attacker), h.c.getTransform(defender), yaw, 20), false);
  });
test('Uppercut stepping follows captured facing when the target circles away', () => {
  const h = harness({ spawn: 0.0275 });
  reward(h);
  h.cmd('uppercut');
  const start = h.c.getTransform('blue');
  h.c.setMovement('strafeLeft', true, undefined, 'red');
  h.step(0.4);
  near(h.c.getTransform('blue').z, start.z);
  near(h.c.getTransform('blue').yaw, start.yaw);
  h.step(0.08);
  assert.equal(h.s().red.health, 100);
});
test('portrait freezes guard stamina and exhaustion; interruptions preserve remaining hop and settling', () => {
  const h = harness();
  h.cmd('block-down');
  h.step(0.2);
  const stamina = h.s().blue.guardStamina;
  h.c.setLandscape(false);
  h.step(3);
  near(h.s().blue.guardStamina, stamina);
  h.c.setLandscape(true);
  h.step(0.5);
  assert.equal(h.s().blue.mode, 'guard-exit');
  h.step(0.1);
  h.cmd('jump-back');
  h.step(0.2);
  const motion = h.c.getTransform('blue'),
    elapsed = h.s().blue.motionElapsed;
  h.c.setTracking(h.token, false);
  h.step(2);
  assert.deepEqual(h.c.getTransform('blue'), motion);
  near(h.s().blue.motionElapsed, elapsed);
  h.c.setTracking(h.token, true);
  h.step(0.5);
  assert.ok(h.c.resume());
  h.step(0.2);
  assert.equal(h.s().blue.mode, 'idle');
});
test('guard contact uses its distinct configurable 20ms hitstop', () => {
  const h = harness({ blockHitstop: 0.02 });
  h.cmd('block-down', 'red');
  h.step(0.1);
  h.cmd('punch');
  h.step(0.3);
  near(h.s().impactPauseRemaining, 0.02);
  const stamina = h.s().red.guardStamina;
  h.step(0.02);
  near(h.s().red.guardStamina, stamina);
});
test('all seven target rectangles fit safe viewport space and never overlap across font scales', () => {
  for (const [w, h] of [
    [568, 320],
    [667, 375],
    [844, 390],
    [932, 430],
    [1024, 768],
  ])
    for (const scale of [1, 1.3, 1.5, 2, 3]) {
      const availableW = w - 24,
        availableH = h - 20 - Math.max(84, Math.ceil(28 * scale) + 60);
      const layout = combatControlLayout(scale, availableW, availableH);
      const rects = COMBAT_CONTROLS.map((k) => layout.rectangles[k]);
      assert.equal(rects.length, 7);
      assert.ok(layout.panelHeight <= availableH + 1e-7);
      for (const r of rects) {
        assert.ok(r.width >= 44 && r.height >= 44);
        assert.ok(r.left >= 0 && r.top >= 0);
        assert.ok(r.left + r.width <= availableW + 1e-7);
        assert.ok(r.top + r.height <= layout.controlsHeight + 1e-7);
      }
      for (let i = 0; i < rects.length; i++)
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i],
            b = rects[j];
          assert.ok(
            a.left + a.width <= b.left ||
              b.left + b.width <= a.left ||
              a.top + a.height <= b.top ||
              b.top + b.height <= a.top
          );
        }
      if (scale === 1) {
        near(layout.width, 56);
        near(layout.height, 56);
      }
    }
});

test('CPU guards occasional visible punches after 150ms using shared stamina', () => {
  const h = harness({ cpuEnabled: true, cpuFirstDelay: 10 });
  h.c.cpuThreats = 2;
  h.cmd('punch');
  h.step(0.15);
  assert.equal(h.s().red.guardHeld, false);
  h.step(0.05);
  assert.equal(h.s().red.guardState, 'raising');
  h.step(0.1);
  assert.equal(h.s().red.health, 100);
  assert.equal(h.s().red.impact.outcome, 'blocked');
  assert.ok(h.s().red.guardStamina < 70);
  h.step(0.4);
  assert.equal(h.s().red.guardHeld, false);
});
test('CPU occasionally evades a visible Uppercut after 270ms and never hops while attacking', () => {
  const h = harness({ cpuEnabled: true, cpuFirstDelay: 10 });
  h.c.cpuThreats = 3;
  reward(h);
  h.cmd('uppercut');
  h.step(0.27);
  assert.notEqual(h.s().red.mode, 'hop');
  h.step(0.04);
  assert.equal(h.s().red.mode, 'hop');
  h.step(0.2);
  assert.equal(h.s().red.health, 100);
  assert.equal(h.s().red.impact, null);
});
test('CPU alternates readable circling beats during recovery', () => {
  const h = harness({ cpuEnabled: true, cpuFirstDelay: 0 });
  h.step(0.7);
  assert.ok(h.c.clock < h.c.cpuRecoveryUntil);
  assert.ok(['StrafeLeft', 'StrafeRight'].includes(h.s().red.clip));
  assert.ok(Math.abs(h.c.getTransform('red').z) > 0);
});
test('portrait and interruptions freeze remaining exhaustion recovery; a rematch restores stamina', () => {
  const h = harness({ guardCapacity: 35 });
  h.cmd('block-down');
  h.step(0.1);
  h.cmd('punch', 'red');
  h.step(0.3);
  const recovery = h.s().blue.guardRecoveryRemaining;
  h.c.setLandscape(false);
  h.step(2);
  near(h.s().blue.guardRecoveryRemaining, recovery);
  h.c.setLandscape(true);
  h.step(0.5);
  h.c.setTracking(h.token, false);
  const left = h.s().blue.guardRecoveryRemaining;
  h.step(2);
  near(h.s().blue.guardRecoveryRemaining, left);
  h.c.setTracking(h.token, true);
  h.step(0.5);
  h.c.resume();
  h.step(left);
  assert.equal(h.s().blue.mode, 'idle');
  h.c.fighters.red.health = 8;
  h.cmd('punch');
  h.step(8);
  assert.equal(h.s().phase, 'ended');
  assert.ok(h.c.rematch());
  near(h.s().blue.guardStamina, 35);
});
test('simultaneous Uppercut steps split the available gap fairly from one pre-step state', () => {
  const h = harness({ spawn: 0.045 });
  reward(h, 'blue');
  reward(h, 'red');
  h.cmd('uppercut');
  h.cmd('uppercut', 'red');
  h.step(0.4);
  near(h.c.getTransform('blue').x, -0.0275);
  near(h.c.getTransform('red').x, 0.0275);
});

test('interruptions discard a buffered hop direction while preserving an active hop', () => {
  const h = harness();
  h.cmd('block-down');
  h.step(0.1);
  h.cmd('block-up');
  h.cmd('jump-back');
  assert.ok(h.c.fighters.blue.hop);
  h.c.pauseRound();
  assert.equal(h.c.fighters.blue.hop, null);
  assert.equal(h.c.fighters.blue.buffered, null);
  h.c.resume();
  h.c.fighters.red.x = h.c.fighters.blue.x;
  h.c.fighters.red.z = 0.1;
  h.cmd('jump-back');
  h.step(0.2);
  assert.ok(h.c.getTransform('blue').z < 0);
  near(h.c.getTransform('blue').x, -0.04);
});
test('free facing interpolates the short arc after repeated circles and angle wrap', () => {
  near(interpolateYaw(179, -179, 0.5), -180);
  near(interpolateYaw(539, -179, 0.5), -180);
  near(interpolateYaw(-539, 179, 0.5), -180);
  near(interpolateYaw(90, -90, 1), -90);
});

test('grounded unguarded attack and landing regenerate stamina after the guard delay', () => {
  const h = harness({ spawn: 0.09 });
  h.c.fighters.blue.guardStamina = 50;
  h.cmd('punch');
  h.step(0.2);
  near(h.c.fighters.blue.guardStamina, 57);
  const red = h.c.fighters.red;
  red.guardStamina = 50;
  red.mode = 'landing';
  red.elapsed = 0;
  red.clip = 'HitFront';
  h.step(0.2);
  near(red.guardStamina, 57);
});
test('a hop pauses airborne regeneration and resumes grounded regeneration without adding a guard delay', () => {
  const h = harness();
  h.c.fighters.blue.guardStamina = 50;
  h.cmd('jump-back');
  h.step(0.4);
  near(h.c.fighters.blue.guardStamina, 50);
  h.step(0.1);
  near(h.c.fighters.blue.guardStamina, 53.5);
});
test('a buffered hop retains its accepted direction but starts travel at the end of lowering', () => {
  const h = harness({ spawn: 0.09 });
  h.cmd('block-down');
  h.step(0.1);
  h.cmd('block-up');
  h.cmd('jump-back');
  const direction = { ...h.c.fighters.blue.hop.direction };
  h.c.setMovement('strafeLeft', true);
  h.step(0.1);
  const start = h.c.getTransform('blue');
  h.step(0.2);
  const middle = h.c.getTransform('blue');
  near((middle.x - start.x) * direction.z - (middle.z - start.z) * direction.x, 0);
  near(distance(start, middle), Math.min(0.06, h.c.fighters.blue.hop.travel) * 0.875);
});
