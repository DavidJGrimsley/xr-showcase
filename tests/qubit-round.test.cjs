const assert = require('node:assert/strict');
const { test } = require('node:test');
const { qubitMotion } = require('../src/features/guess-the-qubit/qubit-motion.ts');
const {
  QubitRoundController,
  MIN_SPHERE_SCALE,
  MAX_SPHERE_SCALE,
  canGuessQubit,
  canManipulateQubit,
  DEFAULT_SPHERE_HEIGHT,
} = require('../src/features/guess-the-qubit/qubit-round-controller.ts');
const {
  BLOCH_RADIUS,
  BASIS_LABELS,
  blochToWorld,
  ringPoints,
  blochSpherePosition,
} = require('../src/features/guess-the-qubit/qubit-geometry.ts');
const flush = () => new Promise((resolve) => setImmediate(resolve));
const transformScope = (controller) => {
  const { sessionId, placementRevision, roundId } = controller.getSnapshot();
  return { sessionId, placementRevision, roundId };
};
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
function harness(overrides = {}, mode = 'simulator') {
  let now = 0;
  const pending = new Map();
  const calls = { measure: [], submit: [], status: [], result: [], cancel: [] };
  const clock = {
    now: () => now,
    schedule(fn, delay) {
      const id = Symbol();
      pending.set(id, { fn, at: now + delay });
      return id;
    },
    cancel: (id) => pending.delete(id),
  };
  const defaults = {
    measure: async () => 0,
    submit: async () => ({ jobId: 'job-1', status: 'queued' }),
    status: async () => ({ jobId: 'job-1', status: 'running' }),
    result: async () => 0,
    cancel: async (jobId) => ({ jobId, status: 'cancelled' }),
  };
  const runtime = Object.fromEntries(
    Object.keys(defaults).map((name) => [
      name,
      (...args) => {
        calls[name].push(args);
        return (overrides[name] ?? defaults[name])(...args);
      },
    ])
  );
  const controller = new QubitRoundController(() => runtime, clock);
  controller.attach(1);
  controller.setPlaced(1, true);
  controller.setTracking(1, true);
  controller.setAvailability(true, true);
  controller.setMode(mode);
  return {
    controller,
    calls,
    pending,
    advance(ms) {
      now += ms;
      for (const [id, task] of [...pending])
        if (task.at <= now) {
          pending.delete(id);
          task.fn();
        }
    },
    intro() {
      controller.finishIntro(1, controller.getSnapshot().roundId);
    },
    collapse() {
      controller.finishCollapse(1, controller.getSnapshot().roundId);
    },
  };
}

for (const mode of ['simulator', 'hardware']) {
  test(`${mode}: subscribed guess availability updates through waiting, result and Reset with the same controller`, async () => {
    const result = deferred();
    const h = harness(
      {
        measure: () => result.promise,
        submit: async () => ({ jobId: 'job-1', status: 'succeeded' }),
        result: () => result.promise,
      },
      mode
    );
    const controller = h.controller;
    const initial = controller.getSnapshot();
    const eligibility = [];
    const stop = controller.subscribe(() =>
      eligibility.push(canGuessQubit(controller.getSnapshot(), 0))
    );
    assert.equal(canGuessQubit(initial, 0), true);
    controller.guess(0);
    assert.equal(canGuessQubit(controller.getSnapshot(), 0), false);
    h.intro();
    assert.equal(canGuessQubit(controller.getSnapshot(), 0), false);
    result.resolve(0);
    await flush();
    assert.equal(controller.getSnapshot().phase, 'collapsing');
    assert.equal(canGuessQubit(controller.getSnapshot(), 0), false);
    h.collapse();
    assert.equal(controller.getSnapshot().phase, 'complete');
    assert.equal(canGuessQubit(controller.getSnapshot(), 0), false);
    assert.equal(
      eligibility.every((value) => value === false),
      true
    );
    controller.reset();
    assert.equal(canGuessQubit(controller.getSnapshot(), 0), true);
    assert.equal(eligibility.at(-1), true);
    assert.notEqual(controller.getSnapshot(), initial);
    assert.equal(canGuessQubit(initial, 0), true);
    assert.equal(h.controller, controller);
    stop();
  });
}

test('guess availability reacts to the retry clock even when the snapshot does not change', () => {
  const h = harness();
  h.controller.deferUntil(2000);
  const state = h.controller.getSnapshot();
  assert.equal(canGuessQubit(state, 1999), false);
  h.advance(2000);
  assert.equal(h.controller.getSnapshot(), state);
  assert.equal(canGuessQubit(state, 2000), true);
  assert.equal(h.controller.canGuess(), true);
});

test('guess availability follows placement, tracking, connection and submission uncertainty', () => {
  const submission = deferred();
  const h = harness({ submit: () => submission.promise }, 'hardware');
  const available = () => canGuessQubit(h.controller.getSnapshot(), 0);
  h.controller.setPlaced(1, false);
  assert.equal(available(), false);
  h.controller.setPlaced(1, true);
  h.controller.setTracking(1, false);
  assert.equal(available(), false);
  h.controller.setTracking(1, true);
  h.controller.setAvailability(true, false);
  assert.equal(available(), false);
  h.controller.setAvailability(true, true);
  assert.equal(available(), true);
  h.controller.guess(0);
  h.controller.reset();
  assert.equal(h.controller.getSnapshot().uncertainSubmission, true);
  assert.equal(available(), false);
  h.controller.detach(1);
  assert.equal(available(), false);
});

for (const mode of ['simulator', 'hardware'])
  for (const guess of [0, 1])
    for (const measurement of [0, 1])
      for (const fast of [true, false]) {
        test(`${mode}: guess ${guess}, result ${measurement}, ${fast ? 'fast' : 'slow'} response waits for intro before collapse`, async () => {
          const result = deferred();
          const h = harness(
            {
              measure: () => result.promise,
              submit: async () => ({ jobId: 'job-1', status: 'succeeded' }),
              result: () => result.promise,
            },
            mode
          );
          h.controller.guess(guess);
          if (fast) {
            result.resolve(measurement);
            await flush();
            assert.equal(h.controller.getSnapshot().phase, 'intro');
            h.intro();
          } else {
            h.intro();
            assert.equal(h.controller.getSnapshot().phase, 'waiting');
            result.resolve(measurement);
            await flush();
          }
          assert.equal(h.controller.getSnapshot().phase, 'collapsing');
          assert.equal(h.controller.getSnapshot().outcome, null);
          h.collapse();
          assert.equal(h.controller.getSnapshot().outcome, guess === measurement ? 'won' : 'lost');
          assert.equal(h.controller.getSnapshot().phase, 'complete');
          assert.equal(h.pending.size, 0);
          h.controller.reset();
          assert.equal(h.controller.getSnapshot().placed, true);
          assert.equal(h.controller.getSnapshot().measurement, null);
        });
      }
test('placement, tracking, configuration and one active round gate all guesses', async () => {
  const h = harness({ measure: () => new Promise(() => {}) });
  h.controller.setPlaced(1, false);
  h.controller.guess(0);
  assert.equal(h.calls.measure.length, 0);
  h.controller.setPlaced(1, true);
  h.controller.setTracking(1, false);
  h.controller.guess(0);
  assert.equal(h.calls.measure.length, 0);
  h.controller.setTracking(1, true);
  h.controller.setAvailability(false, false);
  h.controller.guess(0);
  assert.equal(h.calls.measure.length, 0);
  h.controller.setAvailability(true, true);
  h.controller.guess(0);
  h.controller.guess(1);
  h.controller.setMode('hardware');
  assert.equal(h.calls.measure.length, 1);
  assert.equal(h.controller.getSnapshot().mode, 'simulator');
  h.controller.detach(1);
  assert.equal(h.calls.measure[0][0].aborted, true);
});
test('hardware polls every 15 seconds without overlapping requests and fetches only successful results', async () => {
  const status = deferred();
  const h = harness({ status: () => status.promise }, 'hardware');
  h.controller.guess(1);
  await flush();
  h.intro();
  assert.equal(h.controller.getSnapshot().jobStatus, 'queued');
  h.advance(14999);
  assert.equal(h.calls.status.length, 0);
  h.advance(1);
  assert.equal(h.calls.status.length, 1);
  h.advance(60000);
  assert.equal(h.calls.status.length, 1);
  assert.equal(h.calls.result.length, 0);
  status.resolve({ jobId: 'job-1', status: 'succeeded' });
  await flush();
  assert.equal(h.calls.result.length, 1);
  assert.equal(h.controller.getSnapshot().phase, 'collapsing');
  assert.equal(h.pending.size, 0);
});
for (const status of ['running', 'cancelling', 'failed', 'cancelled'])
  test(`hardware handles ${status} explicitly`, async () => {
    const h = harness({ status: async () => ({ jobId: 'job-1', status }) }, 'hardware');
    h.controller.guess(0);
    await flush();
    h.advance(15000);
    await flush();
    assert.equal(h.controller.getSnapshot().jobStatus, status);
    assert.equal(h.calls.result.length, 0);
    assert.equal(h.pending.size, ['running', 'cancelling'].includes(status) ? 1 : 0);
    if (['failed', 'cancelled'].includes(status)) {
      assert.equal(h.controller.getSnapshot().phase, 'error');
      h.intro();
      assert.equal(h.controller.getSnapshot().phase, 'error');
    }
    h.controller.reset();
    assert.equal(h.pending.size, 0);
  });
test('failed polling reconnects automatically to the same job and respects Retry-After', async () => {
  let attempt = 0;
  const h = harness(
    {
      status: async () => {
        if (++attempt === 1) throw { code: 'rate_limit', retryAt: 60000 };
        return { jobId: 'job-1', status: 'succeeded' };
      },
    },
    'hardware'
  );
  h.controller.guess(0);
  await flush();
  h.intro();
  h.advance(15000);
  await flush();
  assert.equal(h.controller.getSnapshot().phase, 'paused');
  assert.equal(h.pending.size, 1);
  h.controller.resume();
  assert.equal(h.calls.status.length, 1);
  h.advance(45000);
  await flush();
  assert.equal(h.calls.status.length, 2);
  assert.equal(h.calls.submit.length, 1);
  assert.equal(h.controller.getSnapshot().phase, 'collapsing');
});
test('result retrieval failure resumes without submitting a new hardware job', async () => {
  let attempt = 0;
  const h = harness(
    {
      submit: async () => ({ jobId: 'job-1', status: 'succeeded' }),
      status: async () => ({ jobId: 'job-1', status: 'succeeded' }),
      result: async () => {
        if (++attempt === 1) throw { code: 'network' };
        return 1;
      },
    },
    'hardware'
  );
  h.controller.guess(1);
  await flush();
  h.intro();
  assert.equal(h.controller.getSnapshot().phase, 'paused');
  h.controller.resume();
  await flush();
  assert.equal(h.calls.submit.length, 1);
  assert.equal(h.controller.getSnapshot().measurement, 1);
});
for (const code of ['credentials', 'network', 'timeout', 'invalid_result'])
  test(`simulator ${code} stays recoverable and never collapses`, async () => {
    const h = harness({
      measure: async () => {
        throw { code, message: 'untrusted private text' };
      },
    });
    h.controller.guess(0);
    await flush();
    h.intro();
    h.collapse();
    assert.equal(h.controller.getSnapshot().phase, 'error');
    assert.equal(h.controller.getSnapshot().outcome, null);
    assert.equal(h.controller.getSnapshot().message.includes('untrusted'), false);
    h.controller.reset();
    assert.equal(h.controller.canGuess(), code === 'invalid_result');
    h.controller.setAvailability(true, true);
    assert.equal(h.controller.canGuess(), true);
  });
test('mismatched hardware status is rejected and the original job remains cancellable', async () => {
  const h = harness({ status: async () => ({ jobId: 'other', status: 'succeeded' }) }, 'hardware');
  h.controller.guess(0);
  await flush();
  h.advance(15000);
  await flush();
  assert.equal(h.controller.getSnapshot().phase, 'error');
  assert.equal(h.calls.result.length, 0);
  h.controller.reset();
  assert.equal(h.calls.cancel[0][0], 'job-1');
});
test('known submission rejection does not turn into an unknown-outcome warning after Reset', async () => {
  const h = harness(
    {
      submit: async () => {
        throw { code: 'credentials' };
      },
    },
    'hardware'
  );
  h.controller.guess(0);
  await flush();
  h.controller.reset();
  assert.equal(h.controller.getSnapshot().uncertainSubmission, false);
  assert.equal(h.controller.canGuess(), false);
  h.controller.setAvailability(true, true);
  assert.equal(h.controller.canGuess(), true);
});
test('ambiguous submission failure never retries and needs explicit acknowledgement after Reset', async () => {
  const h = harness(
    {
      submit: async () => {
        throw { code: 'timeout' };
      },
    },
    'hardware'
  );
  h.controller.guess(0);
  await flush();
  h.advance(60000);
  h.controller.resume();
  assert.equal(h.calls.submit.length, 1);
  h.controller.reset();
  h.controller.guess(1);
  assert.equal(h.calls.submit.length, 1);
  assert.equal(h.controller.getSnapshot().uncertainSubmission, true);
  h.controller.setAvailability(true, true);
  assert.equal(h.controller.canGuess(), false);
  h.controller.acknowledgeUnknown();
  assert.equal(h.controller.canGuess(), true);
});
for (const teardown of ['reset', 'home', 'background', 'replacement', 'surface-loss'])
  test(`${teardown} during polling aborts requests, stops timers, cancels once and rejects late results`, async () => {
    const status = deferred();
    const h = harness(
      {
        status: () => status.promise,
        cancel: async () => {
          throw Error('offline');
        },
      },
      'hardware'
    );
    h.controller.guess(0);
    await flush();
    const oldRound = h.controller.getSnapshot().roundId;
    h.advance(15000);
    if (teardown === 'reset') h.controller.reset();
    else if (teardown === 'replacement') h.controller.attach(2);
    else if (teardown === 'surface-loss') h.controller.setPlaced(1, false);
    else h.controller.detach(1);
    assert.equal(h.calls.status[0][1].aborted, true);
    assert.equal(h.pending.size, 0);
    assert.equal(h.calls.cancel.length, 1);
    status.resolve({ jobId: 'job-1', status: 'succeeded' });
    await flush();
    h.controller.finishIntro(1, oldRound);
    h.controller.finishCollapse(1, oldRound);
    h.controller.detach(1);
    assert.equal(h.calls.result.length, 0);
    assert.equal(h.controller.getSnapshot().measurement, null);
    assert.equal(h.calls.cancel.length, 1);
  });
for (const teardown of ['reset', 'home', 'background', 'replacement', 'surface-loss'])
  test(`${teardown} during submission cancels the eventual job ID without accepting it`, async () => {
    const submission = deferred();
    const h = harness({ submit: () => submission.promise }, 'hardware');
    h.controller.guess(0);
    if (teardown === 'reset') h.controller.reset();
    else if (teardown === 'replacement') h.controller.attach(2);
    else if (teardown === 'surface-loss') h.controller.setPlaced(1, false);
    else h.controller.detach(1);
    assert.equal(h.calls.submit[0][0].aborted, true);
    submission.resolve({ jobId: 'late-job', status: 'queued' });
    await flush();
    assert.equal(h.calls.cancel[0][0], 'late-job');
    assert.equal(h.calls.status.length, 0);
    assert.equal(h.controller.getSnapshot().jobId, null);
  });
test('client late-acknowledgement callback cancels even after its submit promise already rejected', async () => {
  let late;
  const h = harness(
    {
      submit: async (_, callback) => {
        late = callback;
        throw { code: 'timeout' };
      },
    },
    'hardware'
  );
  h.controller.guess(0);
  await flush();
  h.controller.detach(1);
  late({ jobId: 'late-callback', status: 'running' });
  late({ jobId: 'late-callback', status: 'running' });
  await flush();
  assert.equal(h.calls.cancel.length, 1);
  assert.equal(h.controller.getSnapshot().jobId, null);
});
test('late simulator responses and animation callbacks cannot affect a fresh round', async () => {
  const first = deferred();
  let attempt = 0;
  const h = harness({ measure: () => (++attempt === 1 ? first.promise : Promise.resolve(1)) });
  h.controller.guess(0);
  const old = h.controller.getSnapshot().roundId;
  h.controller.reset();
  h.controller.guess(1);
  await flush();
  first.resolve(0);
  await flush();
  h.controller.finishIntro(1, old);
  h.controller.finishCollapse(1, old);
  assert.equal(h.controller.getSnapshot().measurement, 1);
  assert.equal(h.controller.getSnapshot().phase, 'intro');
  h.intro();
  h.collapse();
  assert.equal(h.controller.getSnapshot().outcome, 'won');
});
test('reduced motion preserves the equator and measured pole while disabling animation and pulse', async () => {
  const result = deferred();
  const h = harness({ measure: () => result.promise });
  h.controller.guess(1);
  const intro = qubitMotion(h.controller.getSnapshot(), false);
  assert.equal(intro.angle, 0);
  assert.equal(intro.run, true);
  assert.equal(qubitMotion(h.controller.getSnapshot(), true).run, false);
  h.intro();
  assert.equal(qubitMotion(h.controller.getSnapshot(), false).pulse, true);
  const waiting = qubitMotion(h.controller.getSnapshot(), true);
  assert.equal(waiting.angle, -90);
  assert.equal(waiting.pulse, false);
  result.resolve(1);
  await flush();
  const collapse = qubitMotion(h.controller.getSnapshot(), false);
  assert.equal(collapse.name, 'qubitOne');
  assert.equal(collapse.angle, -90);
  assert.notEqual(collapse.key, intro.key);
  assert.equal(qubitMotion(h.controller.getSnapshot(), true).angle, -180);
  h.collapse();
  assert.equal(qubitMotion(h.controller.getSnapshot(), false).angle, -180);
  h.controller.reset();
  assert.equal(qubitMotion(h.controller.getSnapshot(), false).angle, 0);
});

test('connection-check rate limits gate new rounds across Reset and mode changes', () => {
  const h = harness();
  h.controller.deferUntil(45000);
  h.controller.reset();
  h.controller.setMode('hardware');
  h.controller.guess(0);
  assert.equal(h.calls.submit.length, 0);
  h.advance(45000);
  assert.equal(h.controller.canGuess(), true);
});

test('tabletop geometry preserves Bloch poles, handedness and closed 0.25m rings', () => {
  assert.deepEqual(blochToWorld([0, 0, 1]), [0, 1, -0]);
  assert.deepEqual(blochToWorld([0, 1, 0]), [0, 0, -1]);
  assert.equal(BASIS_LABELS.length, 6);
  assert.ok(BASIS_LABELS.find((label) => label.text === '|0>').position[1] > 0);
  for (const plane of ['xy', 'xz', 'yz']) {
    const points = ringPoints(plane);
    assert.equal(points.length, 97);
    for (const point of points) assert.ok(Math.abs(Math.hypot(...point) - BLOCH_RADIUS) < 1e-10);
    assert.ok(Math.hypot(...points[0].map((v, i) => v - points[96][i])) < 1e-10);
  }
});

test('transform defaults to two feet, clamps size and height, and rejects invalid values', () => {
  const h = harness(),
    c = h.controller,
    token = transformScope(c);
  assert.equal(c.getSnapshot().sphereHeight, 0.6096);
  assert.equal(DEFAULT_SPHERE_HEIGHT, 0.6096);
  assert.equal(c.getSnapshot().sphereScale, 1);
  assert.equal(c.getSnapshot().sphereYaw, 0);
  c.setSphereScale(token, 100);
  assert.equal(c.getSnapshot().sphereScale, MAX_SPHERE_SCALE);
  c.setSphereScale(token, -1);
  assert.equal(c.getSnapshot().sphereScale, MIN_SPHERE_SCALE);
  c.setSphereHeight(token, 100);
  assert.equal(c.getSnapshot().sphereHeight, 1.524);
  c.setSphereHeight(token, -1);
  assert.equal(c.getSnapshot().sphereHeight, 0);
  c.setSphereHeight(token, 0.8);
  const before = c.getSnapshot();
  for (const bad of [NaN, Infinity, -Infinity]) {
    c.setSphereScale(token, bad);
    c.setSphereHeight(token, bad);
    c.setSphereYaw(token, bad);
  }
  assert.equal(c.getSnapshot(), before);
  assert.equal(h.calls.submit.length + h.calls.measure.length, 0);
});

test('pinch starts from slider size and uses consecutive gesture baselines without compounding', () => {
  const c = harness().controller,
    token = transformScope(c);
  c.setSphereScale(token, 2);
  c.pinchSphere(token, 1, 1);
  c.pinchSphere(token, 2, 1.2);
  assert.equal(c.getSnapshot().sphereScale, 2.4);
  c.pinchSphere(token, 2, 1.4);
  assert.equal(c.getSnapshot().sphereScale, 2.8);
  c.pinchSphere(token, 3, 1.3);
  assert.equal(c.getSnapshot().sphereScale, 2.6);
  c.pinchSphere(token, 2, 0.5);
  assert.equal(c.getSnapshot().sphereScale, 2.6);
  c.pinchSphere(token, 1, 1);
  c.pinchSphere(token, 3, 0.5);
  assert.equal(c.getSnapshot().sphereScale, 1.3);
  c.pinchSphere(token, 1, 1);
  c.pinchSphere(token, 3, 100);
  assert.equal(c.getSnapshot().sphereScale, MAX_SPHERE_SCALE);
  c.pinchSphere(token, 1, 1);
  c.pinchSphere(token, 3, 0.01);
  assert.equal(c.getSnapshot().sphereScale, MIN_SPHERE_SCALE);
});

test('yaw sliders and native rotation wrap full turns without changing the circuit', () => {
  const h = harness(),
    c = h.controller,
    token = transformScope(c);
  c.setSphereYaw(token, 450);
  assert.equal(c.getSnapshot().sphereYaw, 90);
  c.rotateSphere(token, 1, 0);
  c.rotateSphere(token, 2, 45);
  c.rotateSphere(token, 3, 90);
  assert.equal(c.getSnapshot().sphereYaw, 0);
  c.rotateSphere(token, 1, 0);
  c.rotateSphere(token, 3, 450);
  assert.equal(c.getSnapshot().sphereYaw, -90);
  c.rotateSphere(token, 1, 0);
  c.rotateSphere(token, 3, -900);
  assert.equal(c.getSnapshot().sphereYaw, 90);
  c.setSphereYaw(token, 360);
  assert.equal(c.getSnapshot().sphereYaw, 0);
  assert.equal(c.getSnapshot().phase, 'idle');
  assert.equal(h.calls.measure.length + h.calls.submit.length, 0);
});

test('sliders defer to active gestures and Reset discards their stale completions', () => {
  const c = harness().controller,
    token = transformScope(c);
  c.pinchSphere(token, 1, 1);
  c.rotateSphere(token, 1, 0);
  c.pinchSphere(token, 2, 1.5);
  c.setSphereScale(token, 3);
  c.setSphereYaw(token, 90);
  assert.equal(c.getSnapshot().sphereScale, 1.5);
  assert.equal(c.getSnapshot().sphereYaw, 0);
  c.pinchSphere(token, 3, 2);
  c.rotateSphere(token, 3, 45);
  c.setSphereScale(token, 1.75);
  c.setSphereHeight(token, 0.9);
  c.pinchSphere(token, 1, 1);
  c.rotateSphere(token, 1, 0);
  c.reset();
  c.pinchSphere(token, 3, 0.5);
  c.rotateSphere(token, 3, 90);
  c.pinchSphere(transformScope(c), 3, 0.5);
  assert.equal(c.getSnapshot().sphereScale, 1.75);
  assert.equal(c.getSnapshot().sphereYaw, -45);
  assert.equal(c.getSnapshot().sphereHeight, 0.9);
  assert.equal(c.getSnapshot().pinching, false);
  assert.equal(c.getSnapshot().rotating, false);
});

test('sphere base height is independent of scale and defaults to two feet', () => {
  for (const height of [0, DEFAULT_SPHERE_HEIGHT, 1.524]) {
    for (const scale of [MIN_SPHERE_SCALE, 1, MAX_SPHERE_SCALE]) {
      const position = blochSpherePosition(scale, height);
      assert.deepEqual([position[0], position[2]], [0, 0]);
      assert.ok(Math.abs(position[1] - BLOCH_RADIUS * scale - height) < 1e-12);
    }
  }
});

test('Reposition and background preserve display pose; Restart AR and a later visit restore defaults', () => {
  const c = harness().controller,
    token = transformScope(c);
  c.setSphereScale(token, 2);
  c.setSphereYaw(token, 90);
  c.setSphereHeight(token, 0.9);
  c.reposition(token);
  assert.equal(c.getSnapshot().placed, false);
  assert.ok(c.getSnapshot().placementRevision > token.placementRevision);
  c.setPlaced(1, true);
  c.detach(1);
  c.attach(2);
  assert.equal(c.getSnapshot().sphereScale, 2);
  assert.equal(c.getSnapshot().sphereYaw, 90);
  assert.equal(c.getSnapshot().sphereHeight, 0.9);
  c.restart(1);
  assert.equal(c.getSnapshot().sessionId, 2);
  c.restart(2);
  c.attach(3);
  assert.equal(c.getSnapshot().sphereScale, 1);
  assert.equal(c.getSnapshot().sphereYaw, 0);
  assert.equal(c.getSnapshot().sphereHeight, DEFAULT_SPHERE_HEIGHT);
  assert.equal(c.getSnapshot().placed, false);
  assert.equal(
    new QubitRoundController(() => null).getSnapshot().sphereHeight,
    DEFAULT_SPHERE_HEIGHT
  );
});

test('stale transforms and surface callbacks cannot affect a reselected plane or resumed session', () => {
  const c = harness().controller,
    old = transformScope(c);
  c.setSphereScale(old, 1.25);
  const stale = (token) => {
    c.setSphereScale(token, 3);
    c.setSphereYaw(token, 90);
    c.setSphereHeight(token, 1);
    c.pinchSphere(token, 1, 1);
    c.pinchSphere(token, 3, 2);
    c.rotateSphere(token, 1, 0);
    c.rotateSphere(token, 3, 90);
    c.reposition(token);
    c.setPlaced(token.sessionId, false, token.placementRevision);
  };
  c.reposition(old);
  c.setPlaced(1, true);
  const replaced = c.getSnapshot();
  stale(old);
  assert.equal(c.getSnapshot(), replaced);
  const previousSession = transformScope(c);
  c.detach(1);
  c.attach(2);
  c.setTracking(2, true);
  c.setPlaced(2, true);
  const resumed = c.getSnapshot();
  stale(previousSession);
  assert.equal(c.getSnapshot(), resumed);
  c.detach(2);
  const detached = c.getSnapshot();
  stale(transformScope(c));
  assert.equal(c.getSnapshot(), detached);
});

test('tracking loss blocks manipulation and interrupts gestures without resetting the pose', () => {
  const c = harness().controller,
    token = transformScope(c);
  c.setSphereHeight(token, 0.8);
  c.pinchSphere(token, 1, 1);
  c.rotateSphere(token, 1, 0);
  c.setTracking(1, false);
  c.setSphereScale(token, 2);
  c.setSphereHeight(token, 1);
  c.setSphereYaw(token, 90);
  c.pinchSphere(token, 3, 2);
  c.rotateSphere(token, 3, 90);
  assert.equal(canManipulateQubit(c.getSnapshot()), false);
  assert.equal(c.getSnapshot().sphereScale, 1);
  assert.equal(c.getSnapshot().sphereYaw, 0);
  assert.equal(c.getSnapshot().sphereHeight, 0.8);
  assert.equal(c.getSnapshot().pinching, false);
  assert.equal(c.getSnapshot().rotating, false);
  c.setTracking(1, true);
  c.pinchSphere(token, 3, 2);
  c.rotateSphere(token, 3, 90);
  assert.equal(c.getSnapshot().sphereScale, 1);
  c.setSphereScale(token, 2);
  assert.equal(c.getSnapshot().sphereScale, 2);
});

test('invalid and out-of-order gesture values are ignored; malformed ends release controls', () => {
  const c = harness().controller,
    token = transformScope(c);
  for (const factor of [NaN, Infinity, -Infinity, 0, -1]) c.pinchSphere(token, 1, factor);
  c.rotateSphere(token, 1, NaN);
  c.pinchSphere(token, 2, 2);
  c.rotateSphere(token, 2, 90);
  c.pinchSphere(token, 99, 2);
  assert.equal(c.getSnapshot().sphereScale, 1);
  assert.equal(c.getSnapshot().sphereYaw, 0);
  c.pinchSphere(token, 1, 1);
  c.rotateSphere(token, 1, 0);
  c.pinchSphere(token, 3, NaN);
  c.rotateSphere(token, 3, Infinity);
  assert.equal(c.getSnapshot().pinching, false);
  assert.equal(c.getSnapshot().rotating, false);
  c.setSphereScale(token, 2);
  c.setSphereYaw(token, 45);
  assert.equal(c.getSnapshot().sphereScale, 2);
  assert.equal(c.getSnapshot().sphereYaw, 45);
});

test('transforms during measurement preserve the guess, animation identity and outcome', async () => {
  const h = harness(),
    c = h.controller;
  c.guess(0);
  await flush();
  const token = transformScope(c),
    motion = qubitMotion(c.getSnapshot(), false);
  c.setSphereScale(token, 1.25);
  c.setSphereHeight(token, 1);
  c.setSphereYaw(token, 90);
  c.pinchSphere(token, 1, 1);
  c.pinchSphere(token, 3, 1.4);
  c.rotateSphere(token, 1, 0);
  c.rotateSphere(token, 3, 45);
  assert.equal(c.getSnapshot().roundId, token.roundId);
  assert.equal(qubitMotion(c.getSnapshot(), false).key, motion.key);
  assert.equal(c.getSnapshot().guess, 0);
  assert.equal(h.calls.measure.length, 1);
  h.intro();
  h.collapse();
  assert.equal(c.getSnapshot().outcome, 'won');
  assert.equal(c.getSnapshot().sphereHeight, 1);
});

test('transforming a queued hardware round does not submit, cancel or restart polling', async () => {
  const h = harness({}, 'hardware'),
    c = h.controller;
  c.guess(1);
  await flush();
  h.advance(10000);
  const token = transformScope(c);
  c.setSphereScale(token, 0.75);
  c.setSphereHeight(token, 1);
  c.setSphereYaw(token, 90);
  c.pinchSphere(token, 1, 1);
  c.pinchSphere(token, 3, 1.5);
  c.guess(0);
  assert.equal(c.canGuess(), false);
  assert.equal(c.getSnapshot().guess, 1);
  assert.equal(c.getSnapshot().roundId, token.roundId);
  assert.equal(h.calls.submit.length, 1);
  assert.equal(h.calls.cancel.length, 0);
  h.advance(5000);
  await flush();
  assert.equal(h.calls.status.length, 1);
  assert.equal(c.getSnapshot().jobStatus, 'running');
  c.detach(1);
});

test('Reposition cancels a queued hardware round once while preserving the display pose', async () => {
  const h = harness({}, 'hardware'),
    c = h.controller;
  c.guess(1);
  await flush();
  const token = transformScope(c);
  c.setSphereScale(token, 2);
  c.setSphereHeight(token, 1);
  c.setSphereYaw(token, 90);
  c.reposition(token);
  c.reposition(token);
  await flush();
  assert.equal(c.getSnapshot().placed, false);
  assert.equal(c.getSnapshot().phase, 'idle');
  assert.equal(c.getSnapshot().sphereScale, 2);
  assert.equal(c.getSnapshot().sphereYaw, 90);
  assert.equal(c.getSnapshot().sphereHeight, 1);
  assert.equal(h.calls.cancel.length, 1);
  h.advance(60000);
  await flush();
  assert.equal(h.calls.status.length, 0);
  c.setPlaced(1, true);
  c.setSphereScale(token, 0.5);
  assert.equal(c.getSnapshot().sphereScale, 2);
});

test('Reposition during submission cancels a late hardware acknowledgement without accepting its result', async () => {
  const submission = deferred();
  const h = harness({ submit: () => submission.promise }, 'hardware'),
    c = h.controller;
  c.guess(0);
  c.reposition(transformScope(c));
  c.setPlaced(1, true);
  assert.equal(c.getSnapshot().uncertainSubmission, true);
  submission.resolve({ jobId: 'late-reposition', status: 'running' });
  await flush();
  assert.equal(h.calls.cancel.length, 1);
  assert.equal(c.getSnapshot().jobId, null);
  assert.equal(c.getSnapshot().measurement, null);
  assert.equal(h.calls.submit.length, 1);
});
