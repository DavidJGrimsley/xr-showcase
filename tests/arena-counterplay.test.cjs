const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  ArenaController,
  ARENA_RULES,
} = require('../src/features/arena-fighter/arena-controller.ts');
const { sweptContact } = require('../src/features/arena-fighter/arena-contact.ts');

function harness(rules = {}, hand = 'L') {
  const c = new ArenaController(
    {
      cpuEnabled: false,
      spawn: 0.04,
      punchHitstop: 0,
      uppercutHitstop: 0,
      blockHitstop: 0,
      ...rules,
    },
    () => (hand === 'L' ? 0 : 1)
  );
  const token = c.attachSession(1);
  const step = (seconds, dt = 1 / 60) => {
    while (seconds > 1e-8) {
      const slice = Math.min(seconds, dt);
      c.tick(token, slice);
      seconds -= slice;
    }
  };
  c.setLandscape(true);
  c.setTracking(token, true);
  c.setPlacement(token, true);
  for (const a of ['arena', 'blue', 'red'])
    c.assetLoaded(token, c.getSnapshot().placementVersion, a);
  step(0.5);
  c.ready();
  return { c, token, step, s: c.getSnapshot, cmd: (kind, id = 'blue') => c.command(kind, id) };
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test('one Punch removes 8 HP and leaves only a 200ms defense lock', () => {
  const h = harness();
  h.cmd('punch');
  h.step(0.3);
  assert.equal(h.s().red.health, 92);
  assert.equal(h.s().red.clip, 'HitFrontFast');
  near(h.s().red.defenseLockRemaining, 0.2);
  near(h.s().red.punchRecoveryRemaining, 0.35);
  assert.equal(h.s().red.canBlock, true);
  assert.equal(h.s().red.canJumpBack, false);
  assert.equal(h.s().red.canPunch, false);
  h.step(0.2);
  assert.equal(h.s().red.mode, 'idle');
  assert.equal(h.s().red.canJumpBack, true);
  assert.equal(h.s().red.canPunch, true);
});

test('held Block defeats continuous Punch taps and never drains during pending flinch', () => {
  const h = harness();
  h.cmd('punch');
  h.cmd('punch');
  h.step(0.3);
  assert.equal(h.cmd('block-down', 'red'), true);
  assert.equal(h.s().red.pendingBlock, true);
  const stamina = h.s().red.guardStamina;
  h.step(0.19);
  near(h.s().red.guardStamina, stamina);
  h.step(0.01);
  assert.equal(h.s().red.guardState, 'raising');
  h.step(0.1);
  assert.equal(h.s().red.guardState, 'holding');
  h.step(0.36);
  assert.equal(h.s().red.health, 92);
  assert.equal(h.s().red.impact.outcome, 'blocked');
  assert.equal(h.s().blue.punchProgress, 1);
});

test('release cancels pending guard; repeated damage preserves held intent, with a new flinch', () => {
  const h = harness();
  h.cmd('punch');
  h.step(0.3);
  h.cmd('block-down', 'red');
  h.step(0.1);
  h.cmd('block-up', 'red');
  h.step(0.1);
  assert.equal(h.s().red.guardState, 'off');
  assert.equal(h.s().red.pendingBlock, false);
  h.cmd('block-down', 'red');
  h.c.fighters.red.guardElapsed = 0;
  h.c.fighters.red.elapsed = 0;
  h.c.fighters.blue.attack = null;
  h.c.setAnimation(h.c.fighters.blue, 'idle', 'IdleAggro');
  h.cmd('punch');
  h.step(0.3);
  // Simulate startup damage with a fresh rising guard, not an effective block.
  const second = harness();
  second.cmd('punch');
  second.step(0.25);
  second.cmd('block-down', 'red');
  second.step(0.05);
  assert.equal(second.s().red.health, 92);
  assert.equal(second.s().red.guardHeld, true);
  assert.equal(second.s().red.pendingBlock, true);
  second.step(0.3);
  assert.equal(second.s().red.guardState, 'holding');
});

test('early Jump Back is discarded; a fresh press after 200ms escapes the next Punch with room', () => {
  const h = harness();
  h.cmd('punch');
  h.cmd('punch');
  h.step(0.3);
  assert.equal(h.cmd('jump-back', 'red'), false);
  h.step(0.2);
  assert.equal(h.s().red.mode, 'idle');
  assert.equal(h.cmd('jump-back', 'red'), true);
  h.step(0.5);
  assert.equal(h.s().red.health, 92);
  assert.ok(h.c.getTransform('red').x > 0.09);
});

test('one counterpunch buffers in the last 150ms and starts exactly after 350ms', () => {
  const h = harness();
  h.cmd('punch');
  h.step(0.3);
  assert.equal(h.cmd('punch', 'red'), false);
  h.step(0.199);
  assert.equal(h.cmd('punch', 'red'), false);
  h.step(0.001);
  assert.equal(h.cmd('punch', 'red'), true);
  assert.equal(h.cmd('punch', 'red'), false);
  assert.equal(h.s().red.counterpunchBuffered, true);
  h.step(0.149);
  assert.notEqual(h.s().red.mode, 'attack');
  h.step(0.001);
  assert.equal(h.s().red.mode, 'attack');
  near(h.c.fighters.red.attack.elapsed, 0);
});

test('held guard overrides a buffered counterpunch, and subsequent damage clears that buffer', () => {
  for (const guard of [true, false]) {
    const h = harness();
    h.cmd('punch');
    h.step(0.5);
    assert.ok(h.cmd('punch', 'red'));
    if (guard) {
      assert.ok(h.cmd('block-down', 'red'));
      assert.equal(h.s().red.counterpunchBuffered, false);
      h.step(0.2);
      assert.equal(h.s().red.mode, 'guard');
    } else {
      h.c.fighters.blue.attack = null;
      h.c.setAnimation(h.c.fighters.blue, 'idle', 'IdleAggro');
      h.cmd('punch');
      h.c.fighters.blue.attack.elapsed = 0.29;
      h.c.fighters.blue.elapsed = 0.29;
      h.step(0.01);
      assert.equal(h.s().red.counterpunchBuffered, false);
      assert.equal(h.c.fighters.red.buffered, null);
    }
  }
});

test('third hit clears a queued Punch, grants a short Uppercut, and preserves the rest after reservation/damage', () => {
  const h = harness();
  for (let i = 0; i < 2; i++) {
    h.cmd('punch');
    h.step(0.65);
  }
  h.cmd('punch');
  h.cmd('punch');
  h.step(0.3);
  assert.equal(h.c.fighters.blue.buffered, null);
  assert.equal(h.s().blue.uppercutReady, true);
  assert.equal(h.s().blue.canPunch, false);
  assert.equal(h.s().blue.canUppercut, true);
  near(h.s().red.defenseLockRemaining, 0.2);
  near(h.s().blue.punchRestRemaining, 0.95);
  assert.ok(h.cmd('uppercut'));
  assert.equal(h.cmd('uppercut'), false);
  h.step(0.35);
  assert.equal(h.s().blue.clip, 'Combo_UppercutL');
  near(h.s().blue.punchRestRemaining, 0.6);
  h.c.clearReward(h.c.fighters.blue);
  near(h.s().blue.punchRestRemaining, 0.6);
});

test('450ms input deadline and 600ms Punch rest run independently', () => {
  const h = harness();
  for (let i = 0; i < 3; i++) {
    h.cmd('punch');
    h.step(0.65);
  }
  near(h.s().blue.uppercutWindowRemaining, 0.45);
  h.step(0.45);
  assert.equal(h.s().blue.uppercutReady, false);
  assert.equal(h.cmd('punch'), false);
  h.step(0.15);
  assert.equal(h.cmd('punch'), true);
});

test('portrait freezes new timers; interruption clears intent/buffer but preserves Punch rest', () => {
  const h = harness();
  for (let i = 0; i < 3; i++) {
    h.cmd('punch');
    h.step(0.65);
  }
  h.c.setLandscape(false);
  const before = h.s().blue;
  h.step(3);
  assert.equal(h.s().blue.punchRestRemaining, before.punchRestRemaining);
  h.c.pauseRound();
  h.c.setTracking(h.token, false);
  h.c.setLandscape(true);
  h.c.setTracking(h.token, true);
  h.step(0.5);
  assert.equal(h.s().blue.punchProgress, 0);
  assert.equal(h.s().blue.guardHeld, false);
  assert.equal(h.s().blue.counterpunchBuffered, false);
  near(h.s().blue.punchRestRemaining, before.punchRestRemaining);
  assert.ok(h.c.resume());
  h.step(0.6);
  assert.equal(h.s().blue.canPunch, true);
});

for (const hand of ['L', 'R'])
  for (const yaw of [0, 90, -90, 180])
    for (const dt of [1 / 30, 1 / 60, 1 / 120, 0.1]) {
      test(`fitted side contact, off-path miss and swept motion: ${hand}, yaw=${yaw}, dt=${dt}`, () => {
        const angle = (yaw * Math.PI) / 180,
          side = hand === 'L' ? 25 : -25;
        const pose = (theta, d) => ({
          x: Math.sin(((yaw + theta) * Math.PI) / 180) * d,
          z: Math.cos(((yaw + theta) * Math.PI) / 180) * d,
          lift: 0,
          yaw: yaw + theta + 180,
          clip: 'IdleAggro',
          elapsed: 0.3,
        });
        const a = { x: 0, z: 0, lift: 0, yaw, clip: `Combo_Punch${hand}`, elapsed: 0.3 };
        assert.ok(
          sweptContact(
            { ...a, elapsed: 0.29 },
            a,
            pose(side, 0.055),
            pose(side, 0.055),
            0.3,
            0.3,
            hand
          )
        );
        assert.equal(
          sweptContact({ ...a, elapsed: 0.29 }, a, pose(80, 0.08), pose(80, 0.08), 0.3, 0.3, hand),
          null
        );
        const h = harness({}, hand);
        h.c.fighters.blue.x = 0;
        h.c.fighters.blue.z = 0;
        h.c.fighters.red.x = Math.sin(angle) * 0.085;
        h.c.fighters.red.z = Math.cos(angle) * 0.085;
        h.cmd('punch');
        h.step(0.4, dt);
        assert.equal(h.s().red.health, 92);
        const id = h.s().red.impact.id;
        h.step(0.2, dt);
        assert.equal(h.s().red.health, 92);
        assert.equal(h.s().red.impact.id, id);
      });
    }

test('relative sweep catches a body crossing the glove between samples and honors lift', () => {
  const a = { x: 0, z: 0, lift: 0, yaw: 0, clip: 'Combo_PunchL', elapsed: 0.367 };
  const b = { x: 0.055, z: 0.08, lift: 0, yaw: 180, clip: 'IdleAggro', elapsed: 0.367 };
  assert.ok(
    sweptContact({ ...a, elapsed: 0.3 }, a, { ...b, x: -0.055, elapsed: 0.3 }, b, 0.3, 0.367, 'L')
  );
  assert.equal(
    sweptContact(
      { ...a, elapsed: 0.3 },
      a,
      { ...b, x: 0, lift: 0.18, elapsed: 0.3 },
      { ...b, x: 0, lift: 0.18 },
      0.3,
      0.367,
      'L'
    ),
    null
  );
});

test('the tuning keeps Uppercut damage at 15 and three Punches plus Uppercut at 39', () => {
  assert.equal(ARENA_RULES.uppercutDamage, 15);
  assert.equal(ARENA_RULES.punchDamage * 3 + ARENA_RULES.uppercutDamage, 39);
});

test('lowering guard cannot execute a buffered counterpunch before the 350ms deadline', () => {
  const h = harness();
  h.cmd('punch');
  h.step(0.3);
  h.cmd('block-down', 'red');
  h.step(0.2);
  h.cmd('block-up', 'red');
  assert.ok(h.cmd('punch', 'red'));
  h.step(0.1);
  assert.equal(h.s().red.mode, 'idle');
  assert.equal(h.s().red.counterpunchBuffered, true);
  h.step(0.05);
  assert.equal(h.s().red.mode, 'attack');
  near(h.c.fighters.red.attack.elapsed, 0);
});

test('a counterpunch interrupts the earned Uppercut before contact instead of receiving extended stun', () => {
  const h = harness();
  for (let i = 0; i < 2; i++) {
    h.cmd('punch');
    h.step(0.65);
  }
  h.cmd('punch');
  h.step(0.3);
  h.cmd('uppercut');
  h.step(0.2);
  assert.ok(h.cmd('punch', 'red'));
  h.step(0.45);
  assert.equal(h.s().blue.health, 92);
  assert.equal(h.s().red.health, 76);
  assert.equal(h.s().blue.mode, 'hit');
  assert.equal(h.s().blue.uppercutReady, false);
  assert.equal(h.c.fighters.blue.attack, null);
  assert.ok(h.s().blue.punchRestRemaining > 0);
});

test('expired counterpunch never starts later after a conflicting action', () => {
  const h = harness();
  h.cmd('punch');
  h.step(0.5);
  h.cmd('punch', 'red');
  // A host-owned hop/airborne motion makes the counter buffer inapplicable.
  const f = h.c.fighters.red;
  f.mode = 'settling';
  f.elapsed = -0.5;
  f.motionInitialLift = 0.02;
  h.step(0.4);
  assert.equal(f.counterpunchBuffered, false);
  assert.equal(f.buffered, null);
});
