const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ArenaController } = require('../src/features/arena-fighter/arena-controller.ts');
const { ArenaPresentation } = require('../src/features/arena-fighter/arena-presentation.ts');

function harness(outcome = 'blue', launched = [], matchVictory = true) {
  const base = new ArenaController().getSnapshot();
  const presentation = new ArenaPresentation(
    { id: 'celebration', outcome, launched, matchVictory },
    base
  );
  function apply(id) {
    presentation.applied(id, presentation.get(id).animationId);
  }
  function tick(seconds, applied = true) {
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      if (applied) for (const id of ['blue', 'red']) apply(id);
      presentation.tick(1 / 60);
    }
  }
  return { presentation, tick, apply };
}

for (const winner of ['blue', 'red']) {
  const loser = winner === 'blue' ? 'red' : 'blue';
  for (const launched of [false, true]) {
    test(`${winner} waits for ${launched ? 'launched' : 'grounded'} defeat, then plays two stretches and one Uppercut`, () => {
      const h = harness(winner, launched ? [loser] : []);
      assert.equal(h.presentation.get(winner).clip, 'IdleAggro');
      h.tick(launched ? 1.7 : 0.9);
      assert.equal(h.presentation.get(loser).clip, 'DefeatedLoop');
      assert.equal(h.presentation.get(winner).clip, 'IdleAggro');
      assert.equal(h.presentation.done, false);
      h.tick(1 / 60);
      const first = h.presentation.get(winner).animationId;
      assert.equal(h.presentation.get(winner).clip, 'Victory');
      h.tick(2.3);
      const second = h.presentation.get(winner).animationId;
      assert.notEqual(second, first);
      assert.equal(h.presentation.get(winner).clip, 'Victory');
      assert.equal(h.presentation.done, false);
      // A dispatched repeat must receive its own renderer acknowledgment before time advances.
      h.tick(3, false);
      assert.equal(h.presentation.get(winner).elapsed, 0);
      h.tick(2.2833333333);
      assert.equal(h.presentation.get(winner).animationId, second);
      assert.equal(h.presentation.done, false);
      h.tick(1 / 60);
      assert.equal(h.presentation.get(winner).clip, 'VictoryUppercut');
      const uppercut = h.presentation.get(winner).animationId;
      assert.notEqual(uppercut, second);
      assert.equal(h.presentation.done, false);
      h.tick(4, false);
      assert.equal(h.presentation.get(winner).elapsed, 0);
      h.presentation.applied(winner, second); // A stale dance ack cannot start the finisher.
      h.tick(1, false);
      assert.equal(h.presentation.get(winner).elapsed, 0);
      h.tick(119 / 60);
      assert.equal(h.presentation.get(winner).clip, 'VictoryUppercut');
      assert.equal(h.presentation.done, false);
      h.tick(1 / 60);
      assert.equal(h.presentation.get(winner).clip, 'IdleAggro');
      assert.equal(h.presentation.done, false);
      h.tick(1 / 60);
      assert.equal(h.presentation.done, true);
      const settled = h.presentation.get(winner).animationId;
      h.tick(5);
      assert.equal(h.presentation.get(winner).animationId, settled);
    });
  }
}

test('an unapplied opponent knockout blocks Victory despite elapsed host time', () => {
  const h = harness();
  h.apply('blue');
  h.tick(10, false);
  assert.equal(h.presentation.get('blue').clip, 'IdleAggro');
  assert.equal(h.presentation.get('red').clip, 'Defeat');
  assert.equal(h.presentation.done, false);
  h.tick(0.9);
  assert.equal(h.presentation.get('blue').clip, 'IdleAggro');
  h.tick(1 / 60);
  assert.equal(h.presentation.get('blue').clip, 'Victory');
});

test('renderer recreation during the second dance resumes that play without adding a third', () => {
  const h = harness();
  h.tick(0.9 + 1 / 60 + 2.3 + 0.5);
  assert.equal(h.presentation.get('blue').clip, 'Victory');
  h.presentation.remounted();
  h.tick(4, false);
  assert.equal(h.presentation.done, false);
  h.tick(2.3);
  assert.equal(h.presentation.get('blue').clip, 'VictoryUppercut');
  h.tick(2);
  assert.equal(h.presentation.get('blue').clip, 'IdleAggro');
  h.tick(1 / 60);
  assert.equal(h.presentation.done, true);
});

test('renderer recreation during the Uppercut restarts only the finisher and waits for its full playback', () => {
  const h = harness();
  h.tick(0.9 + 1 / 60 + 4.6 + 0.5);
  assert.equal(h.presentation.get('blue').clip, 'VictoryUppercut');
  const before = h.presentation.get('blue').animationId;
  h.presentation.remounted();
  assert.notEqual(h.presentation.get('blue').animationId, before);
  h.tick(10, false);
  assert.equal(h.presentation.get('blue').elapsed, 0);
  h.tick(119 / 60);
  assert.equal(h.presentation.get('blue').clip, 'VictoryUppercut');
  assert.equal(h.presentation.done, false);
  h.tick(2 / 60);
  assert.equal(h.presentation.done, true);
  assert.equal(h.presentation.get('blue').clip, 'IdleAggro');
});

test('double knockout settles without starting a Victory clip', () => {
  const h = harness('draw', ['blue', 'red']);
  h.tick(2);
  assert.equal(h.presentation.get('blue').clip, 'DefeatedLoop');
  assert.equal(h.presentation.get('red').clip, 'DefeatedLoop');
  assert.equal(h.presentation.done, true);
});

for (const winner of ['blue', 'red']) {
  for (const launched of [false, true]) {
    test(`${winner}'s round win plays one stretch after ${launched ? 'launched' : 'grounded'} defeat, without a finisher`, () => {
      const loser = winner === 'blue' ? 'red' : 'blue';
      const h = harness(winner, launched ? [loser] : [], false);
      h.tick((launched ? 1.7 : 0.9) + 1 / 60);
      const stretch = h.presentation.get(winner).animationId;
      assert.equal(h.presentation.get(winner).clip, 'Victory');
      h.tick(2.2833333333);
      assert.equal(h.presentation.get(winner).animationId, stretch);
      assert.equal(h.presentation.done, false);
      h.tick(1 / 60);
      assert.equal(h.presentation.get(winner).clip, 'IdleAggro');
      assert.equal(h.presentation.done, false);
      h.tick(1 / 60);
      assert.equal(h.presentation.done, true);
      const idle = h.presentation.get(winner).animationId;
      h.tick(5);
      assert.equal(h.presentation.get(winner).animationId, idle);
    });
  }
}

test('remounting an ordinary round stretch restarts just that stretch and still waits for acknowledgment', () => {
  const h = harness('blue', [], false);
  h.tick(1.5);
  h.presentation.remounted();
  h.tick(5, false);
  assert.equal(h.presentation.done, false);
  assert.equal(h.presentation.get('blue').elapsed, 0);
  h.tick(2.3 + 1 / 60);
  assert.equal(h.presentation.done, true);
  assert.equal(h.presentation.get('blue').clip, 'IdleAggro');
});
