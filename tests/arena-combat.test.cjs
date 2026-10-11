const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  ArenaController,
  ARENA_RULES,
} = require('../src/features/arena-fighter/arena-controller.ts');
const { ArenaPresentation } = require('../src/features/arena-fighter/arena-presentation.ts');
const { combatControlLayout } = require('../src/features/arena-fighter/arena-control-layout.ts');
const { launchLift } = require('../src/features/arena-fighter/arena-combat-motion.ts');

function harness(rules = {}, random = () => 0, swapped = false) {
  const controller = new ArenaController(
    { cpuEnabled: false, spawn: 0.04, punchHitstop: 0, uppercutHitstop: 0, ...rules },
    random
  );
  const token = controller.attachSession(1);
  const snapshot = controller.getSnapshot;
  const tick = (seconds) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) controller.tick(token, 1 / 60);
  };
  controller.setLandscape(true);
  controller.setTracking(token, true);
  controller.setPlacement(token, true);
  for (const asset of ['arena', 'blue', 'red'])
    controller.assetLoaded(token, snapshot().placementVersion, asset);
  tick(0.5);
  if (swapped) controller.swapSides();
  controller.ready();
  const earn = (id = 'blue') => {
    for (let i = 0; i < ARENA_RULES.punchStringLength; i++) {
      assert.equal(controller.attack('punch', id), true);
      tick(0.65);
    }
    assert.equal(snapshot()[id].uppercutReady, true);
  };
  return { controller, token, tick, snapshot, earn };
}
const near = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);

test('three connected punches earn one reward; starting or missing attacks earns nothing', () => {
  const h = harness();
  assert.equal(ARENA_RULES.punchStringLength, 3);
  assert.equal(h.controller.attack('uppercut'), false);
  for (let i = 0; i < 3; i++) {
    h.controller.attack('punch');
    assert.equal(h.snapshot().blue.punchProgress, i);
    h.tick(0.3);
    assert.equal(h.snapshot().blue.punchProgress, i + 1);
    assert.equal(h.snapshot().blue.uppercutReady, i === 2);
    h.tick(0.35);
  }
  assert.equal(h.snapshot().red.health, 76);
  assert.equal('uppercutRemaining' in h.snapshot().blue, false);
  assert.equal('uppercutCooldown' in ARENA_RULES, false);
  const miss = harness({ spawn: 0.095 });
  for (let i = 0; i < 8; i++) {
    miss.controller.attack('punch');
    miss.tick(0.65);
  }
  assert.equal(miss.snapshot().blue.punchProgress, 0);
  assert.equal(miss.snapshot().blue.uppercutReady, false);
});

test('misses and idle time preserve partial progress; incoming damage breaks the streak', () => {
  const h = harness();
  h.controller.attack('punch');
  h.tick(0.65);
  h.tick(3);
  assert.equal(h.snapshot().blue.punchProgress, 1);
  h.controller.attack('punch', 'red');
  h.tick(0.3);
  assert.equal(h.snapshot().blue.punchProgress, 0);
  const miss = harness();
  miss.controller.attack('punch');
  miss.tick(0.65);
  miss.controller.command('jump-back');
  miss.tick(1);

  miss.controller.attack('punch');
  miss.tick(0.65);
  assert.equal(miss.snapshot().blue.punchProgress, 1);
});

test('a third connected punch replaces a queued punch with a single reserved Uppercut', () => {
  const h = harness();
  for (let i = 0; i < 2; i++) {
    h.controller.attack('punch');
    h.tick(0.65);
  }
  h.controller.attack('punch');
  assert.equal(h.controller.attack('uppercut'), false);
  assert.equal(h.controller.attack('punch'), true);
  h.tick(0.3);
  assert.equal(h.controller.attack('uppercut'), true);
  assert.equal(h.controller.attack('uppercut'), false);
  assert.equal(h.snapshot().blue.punchProgress, 0);
  h.tick(0.35);
  assert.equal(h.snapshot().blue.clip, 'Combo_UppercutL');
  h.tick(0.55);
  assert.equal(h.snapshot().red.health, 61);
  assert.equal(h.snapshot().red.mode, 'launch');
});

test('the full 450ms window begins after third-punch recovery and expires cleanly', () => {
  const h = harness();
  h.earn();
  near(h.snapshot().blue.uppercutWindowRemaining, 0.45);
  h.tick(0.4);
  assert.equal(h.snapshot().blue.uppercutReady, true);
  h.tick(0.05);
  assert.equal(h.snapshot().blue.uppercutReady, false);
  assert.equal(h.snapshot().blue.punchProgress, 0);
  assert.equal(h.controller.attack('uppercut'), false);
});

for (const side of [false, true])
  for (const id of ['blue', 'red'])
    for (const hand of ['L', 'R'])
      for (const uppercutHand of ['L', 'R']) {
        test(`late ${id} Uppercut${uppercutHand} earned by ${hand} punches connects at maximum range, swapped=${side}`, () => {
          const h = harness({ spawn: ARENA_RULES.reach / 2 }, () => (hand === 'L' ? 0 : 0.9), side);
          const target = id === 'blue' ? 'red' : 'blue';
          // Select the alternating hand's slot; reward earning still uses actual connected punches.
          h.controller.fighters[id].uppercutIndex = uppercutHand === 'L' ? 0 : 1;
          h.earn(id);
          h.tick(0.4);
          assert.equal(h.controller.attack('uppercut', id), true);
          assert.equal(h.snapshot()[id].clip, `Combo_Uppercut${uppercutHand}`);
          h.tick(0.55);
          assert.equal(h.snapshot()[target].health, 61);
          assert.equal(h.snapshot()[target].mode, 'launch');
          const distance = Math.abs(
            h.controller.getTransform(id).x - h.controller.getTransform(target).x
          );
          assert.ok(distance >= ARENA_RULES.separation - 1e-7);
          assert.ok(distance <= ARENA_RULES.uppercutReach + 1e-7);
        });
      }

test('Uppercut hands alternate across separately earned opportunities, without a cooldown', () => {
  const h = harness({ punchDamage: 0 });
  h.earn();
  h.controller.attack('uppercut');
  assert.equal(h.snapshot().blue.clip, 'Combo_UppercutL');
  h.tick(2);
  h.earn();
  assert.equal(h.controller.attack('uppercut'), true);
  assert.equal(h.snapshot().blue.clip, 'Combo_UppercutR');
  h.tick(0.55);
  assert.equal(h.snapshot().red.mode, 'launch');
  assert.equal(h.snapshot().red.health, 70);
});

test('an earned Uppercut miss spends its reward and does not launch or create an impact', () => {
  const h = harness();
  h.earn();
  const lastImpact = h.snapshot().red.impact.id;
  h.controller.command('jump-back', 'red');
  h.tick(0.4);

  assert.equal(h.controller.attack('uppercut'), true);
  h.tick(1);
  assert.equal(h.snapshot().red.health, 76);
  assert.equal(h.snapshot().red.impact.id, lastImpact);
  assert.equal(h.snapshot().blue.punchProgress, 0);
  assert.equal(h.controller.attack('uppercut'), false);
});

for (const startingHealth of [100, 70]) {
  test(`nonlethal Uppercut launches, prevents juggling, and lands from ${startingHealth - 24} HP`, () => {
    const h = harness({ health: startingHealth });
    h.earn();
    h.controller.attack('uppercut');
    h.tick(0.55);
    const health = h.snapshot().red.health;
    assert.equal(h.snapshot().red.mode, 'launch');
    assert.equal(h.controller.attack('punch', 'red'), false);
    h.controller.setMovement('advance', true, undefined, 'red');
    const x = h.controller.getTransform('red').x;
    h.tick(0.4);
    assert.ok(h.controller.getTransform('red').lift > 0.17);
    h.controller.attack('punch');
    h.tick(0.3);
    assert.equal(h.snapshot().red.health, health);
    near(h.controller.getTransform('red').x, x);
    h.tick(0.1);
    assert.equal(h.snapshot().red.mode, 'landing');
    near(h.controller.getTransform('red').lift, 0);
    assert.equal(h.controller.attack('punch', 'red'), false);
    h.controller.attack('punch');
    h.tick(0.3);
    assert.equal(h.snapshot().red.health, health);
    // Do not leave a late active window spanning the end of landing immunity.
    h.controller.fighters.blue.attack = null;
    h.tick(0.3);
    assert.equal(h.snapshot().red.mode, 'idle');
    assert.equal(h.controller.attack('punch', 'red'), true);
  });
}

test('a lethal earned Uppercut retains the complete launch, defeat and victory sequence', () => {
  const h = harness({ health: 39 });
  h.earn();
  h.controller.attack('uppercut');
  h.tick(0.55);
  assert.equal(h.snapshot().red.mode, 'launch');
  assert.equal(h.snapshot().outcome, 'blue');
  h.tick(0.4);
  assert.ok(h.controller.getTransform('red').lift > 0.17);
  h.tick(0.4);
  assert.equal(h.snapshot().red.mode, 'defeat');
  assert.equal(h.snapshot().blue.clip, 'IdleAggro');
  h.tick(0.9);
  assert.equal(h.snapshot().red.mode, 'defeated');
  assert.equal(h.snapshot().blue.clip, 'Victory');
  h.tick(2.3);
  assert.equal(h.snapshot().canRematch, false);
  h.tick(2.3);
  assert.equal(h.snapshot().blue.clip, 'VictoryUppercut');
  assert.equal(h.snapshot().canRematch, false);
  h.tick(2);
  assert.equal(h.snapshot().canRematch, true);
  assert.equal(h.controller.rematch(), true);
  assert.equal(h.snapshot().blue.punchProgress, 0);
  assert.equal(h.snapshot().blue.uppercutReady, false);
  assert.equal(h.snapshot().blue.health, 39);
});

test('simultaneous punches apply both hits and break both streaks independent of ordering', () => {
  for (const order of [
    ['blue', 'red'],
    ['red', 'blue'],
  ]) {
    const h = harness();
    for (let i = 0; i < 4; i++) {
      for (const id of order) h.controller.attack('punch', id);
      h.tick(0.9);
    }
    for (const id of order) {
      assert.equal(h.snapshot()[id].health, 68);
      assert.equal(h.snapshot()[id].punchProgress, 0);
      assert.equal(h.snapshot()[id].uppercutReady, false);
    }
  }
});

test('a launched surviving winner lands and waits for the opponent before Victory', () => {
  const h = harness();
  const presentation = new ArenaPresentation(
    { id: 'winner-flight', outcome: 'blue', launched: ['blue'] },
    h.snapshot()
  );
  assert.equal(presentation.get('blue').mode, 'launch');
  presentation.applied('blue', presentation.get('blue').animationId);
  presentation.tick(0.4);
  near(presentation.get('blue').lift, 0.18);
  presentation.tick(0.4);
  assert.equal(presentation.get('blue').clip, 'IdleAggro');
  presentation.applied('blue', presentation.get('blue').animationId);
  presentation.applied('red', presentation.get('red').animationId);
  presentation.tick(0.9);
  assert.equal(presentation.get('blue').clip, 'IdleAggro');
  presentation.applied('red', presentation.get('red').animationId);
  presentation.tick(1 / 60);
  assert.equal(presentation.get('blue').clip, 'Victory');
  assert.equal(presentation.done, false);
});

test('portrait freezes a reward while genuine interruption resets charge and buffered attacks', () => {
  const h = harness();
  h.earn();
  const window = h.snapshot().blue.uppercutWindowRemaining;
  h.controller.setLandscape(false);
  h.tick(40);
  assert.equal(h.snapshot().blue.uppercutWindowRemaining, window);
  h.controller.setLandscape(true);
  h.tick(0.55);
  h.controller.attack('uppercut');
  h.tick(0.1);
  h.controller.setTracking(h.token, false);
  h.tick(2);
  assert.equal(h.snapshot().blue.punchProgress, 0);
  assert.equal(h.snapshot().blue.uppercutReady, false);
  assert.equal(h.snapshot().red.health, 76);
  h.controller.setTracking(h.token, true);
  h.tick(0.55);
  h.controller.resume();
  h.tick(2);
  assert.equal(h.snapshot().red.health, 76);
});

for (const stage of ['launch', 'landing']) {
  test(`tracking loss freezes and resumes nonlethal ${stage} without replaying damage`, () => {
    const h = harness();
    h.earn();
    h.controller.attack('uppercut');
    h.tick(0.55);
    h.tick(stage === 'launch' ? 0.2 : 0.9);
    assert.equal(h.snapshot().red.mode, stage);
    const transform = h.controller.getTransform('red');
    const elapsed = h.snapshot().red.motionElapsed;
    h.controller.setTracking(h.token, false);
    h.tick(2);
    assert.deepEqual(h.controller.getTransform('red'), transform);
    assert.equal(h.snapshot().red.motionElapsed, elapsed);
    h.controller.setTracking(h.token, true);
    h.tick(0.55);
    h.controller.resume();
    h.tick(2);
    assert.equal(h.snapshot().red.health, 61);
    assert.equal(h.snapshot().red.mode, 'idle');
    near(h.controller.getTransform('red').lift, 0);
  });
}

test('hitstop freezes fighter time while accepting a buffered action and keeping movement held', () => {
  const h = harness({ punchHitstop: 0.035 });
  h.controller.setMovement('advance', true);
  h.controller.attack('punch');
  h.tick(0.3);
  assert.equal(h.snapshot().impactPauseRemaining, 0.035);
  const transform = h.controller.getTransform('blue');
  const impact = h.snapshot().red.impact.id;
  assert.equal(h.controller.attack('punch'), true);
  h.tick(2 / 60);
  assert.deepEqual(h.controller.getTransform('blue'), transform);
  assert.equal(h.snapshot().red.impact.id, impact);
  h.tick(0.4);
  assert.equal(h.snapshot().blue.mode, 'attack');
  h.tick(1);
  assert.equal(h.snapshot().red.health, 84);
  assert.ok(h.controller.getTransform('blue').x > transform.x);
});

test('CPU earns its first Uppercut with three landed punches and remains punishable', () => {
  const h = harness({ cpuEnabled: true });
  const clips = [];
  let last = 0;
  for (let i = 0; i < 1200 && h.snapshot().phase === 'fighting'; i++) {
    h.tick(1 / 60);
    const red = h.snapshot().red;
    if (red.mode === 'attack' && red.animationId !== last) {
      clips.push(red.clip);
      last = red.animationId;
    }
  }
  assert.ok(clips.length >= 4);
  assert.ok(clips.slice(0, 3).every((clip) => clip.includes('Punch')));
  assert.equal(clips[3], 'Combo_UppercutL');
  assert.equal(h.snapshot().red.health, 100);
  assert.equal(h.snapshot().outcome, 'red');
});

test('CPU stops in reachable spacing and an earned three-punch follow-through catches it', () => {
  const h = harness({
    cpuEnabled: true,
    spawn: 0.095,
    cpuFirstDelay: 100,
    cpuGuardReaction: 100,
    cpuReaction: 0.6,
  });
  h.tick(2);
  const distance = Math.abs(
    h.controller.getTransform('blue').x - h.controller.getTransform('red').x
  );
  assert.ok(distance <= 0.071);
  h.earn();
  h.controller.attack('uppercut');
  h.tick(0.55);
  assert.equal(h.snapshot().red.mode, 'launch');
  assert.equal(h.snapshot().red.health, 61);
});

test('control geometry stays constant through progress, availability and disabled transitions', () => {
  const h = harness();
  const geometry = combatControlLayout(1, 700);
  assert.deepEqual(
    {
      width: geometry.width,
      height: geometry.height,
      gap: geometry.gap,
      stacked: geometry.stacked,
      progressHeight: geometry.progressHeight,
    },
    {
      width: 56,
      height: 56,
      gap: 8,
      stacked: false,
      progressHeight: 0,
    }
  );
  for (let i = 0; i < 3; i++) {
    h.controller.attack('punch');
    h.tick(0.65);
    assert.deepEqual(combatControlLayout(1, 700), geometry);
  }
  h.controller.attack('uppercut');
  h.tick(2);
  assert.deepEqual(combatControlLayout(1, 700), geometry);
  const large = combatControlLayout(2, 568);
  assert.equal(large.stacked, false);
  assert.ok(large.width >= 44 && large.width <= 56 && large.height >= 44);
  assert.ok(large.width * 2 + 24 <= 568);
});

test('shared launch curve stays within its height and settles exactly on the floor', () => {
  near(launchLift(0, 0.8, 0.18), 0);
  near(launchLift(0.4, 0.8, 0.18), 0.18);
  near(launchLift(0.8, 0.8, 0.18), 0);
  near(launchLift(1, 0.8, 0.18), 0);
});

for (const swapped of [false, true]) {
  test(`Uppercut stepping does not push a cornered target or cross arena bounds, swapped=${swapped}`, () => {
    const h = harness({}, () => 0, swapped);
    h.controller.setMovement('advance', true);
    h.controller.command('jump-back', 'red');
    h.tick(0.7);
    h.controller.command('jump-back', 'red');
    h.tick(1.25);
    h.controller.setMovement('advance', false);

    const target = h.controller.getTransform('red').x;
    near(Math.abs(target), ARENA_RULES.boundary);
    h.earn();
    h.controller.attack('uppercut');
    for (let i = 0; i < 30; i++) {
      h.tick(1 / 60);
      near(h.controller.getTransform('red').x, target);
      const x = h.controller.getTransform('blue').x;
      assert.ok(Math.abs(x) <= ARENA_RULES.boundary);
      assert.ok(Math.abs(x - target) >= ARENA_RULES.separation - 1e-7);
    }
    assert.equal(h.snapshot().red.mode, 'launch');
  });
}

test('simultaneous earned Uppercut fixtures launch both targets and preserve a double knockout', () => {
  for (const order of [
    ['blue', 'red'],
    ['red', 'blue'],
  ]) {
    const h = harness({ health: 15 });
    // Isolate simultaneous-hit resolution with pre-earned state; normal incoming hits break streaks.
    for (const id of order) {
      h.controller.fighters[id].punchProgress = 3;
      h.controller.fighters[id].uppercutWindowUntil = 1;
      assert.equal(h.controller.attack('uppercut', id), true);
    }
    h.tick(0.4);
    // Both crouched Uppercuts lean off the original center line. Put their
    // committed gauntlets on visibly intersecting head paths at legal spacing.
    h.controller.fighters.red.x = h.controller.fighters.blue.x + Math.sqrt(0.055 ** 2 - 0.02 ** 2);
    h.controller.fighters.red.z = -0.02;
    h.tick(0.15);
    assert.equal(h.snapshot().outcome, 'draw');
    assert.equal(h.snapshot().blue.mode, 'launch');
    assert.equal(h.snapshot().red.mode, 'launch');
    h.tick(2);
    assert.equal(h.snapshot().blue.mode, 'defeated');
    assert.equal(h.snapshot().red.mode, 'defeated');
    assert.equal(h.snapshot().canRematch, true);
  }
});

test('a simultaneous lethal punch and Uppercut launch the surviving winner in authoritative combat', () => {
  const h = harness();
  h.controller.fighters.red.health = 8;
  h.controller.fighters.red.punchProgress = 3;
  h.controller.fighters.red.uppercutWindowUntil = 1;
  h.controller.attack('uppercut', 'red');
  h.tick(11 / 60);
  h.controller.attack('punch');
  h.tick(18 / 60);
  assert.equal(h.snapshot().outcome, 'blue');
  assert.equal(h.snapshot().blue.health, 85);
  assert.equal(h.snapshot().blue.mode, 'launch');
  h.tick(0.8);
  assert.equal(h.snapshot().blue.clip, 'IdleAggro');
  h.tick(0.1);
  assert.equal(h.snapshot().blue.clip, 'Victory');
  h.tick(2.3);
  assert.equal(h.snapshot().canRematch, false);
  h.tick(2.3);
  assert.equal(h.snapshot().blue.clip, 'VictoryUppercut');
  assert.equal(h.snapshot().canRematch, false);
  h.tick(2);
  assert.equal(h.snapshot().canRematch, true);
});

test('simultaneous Uppercuts test contact after both lunges even across a long simulation step', () => {
  const h = harness({ spawn: 0.06 });
  for (const id of ['blue', 'red']) {
    h.controller.fighters[id].punchProgress = 3;
    h.controller.fighters[id].uppercutWindowUntil = 1;
    h.controller.attack('uppercut', id);
  }
  h.tick(0.4);
  h.controller.fighters.red.x = h.controller.fighters.blue.x + Math.sqrt(0.055 ** 2 - 0.02 ** 2);
  h.controller.fighters.red.z = -0.02;
  h.controller.tick(h.token, 0.1);
  assert.equal(h.snapshot().blue.health, 85);
  assert.equal(h.snapshot().red.health, 85);
  assert.equal(h.snapshot().blue.mode, 'launch');
  assert.equal(h.snapshot().red.mode, 'launch');
});
