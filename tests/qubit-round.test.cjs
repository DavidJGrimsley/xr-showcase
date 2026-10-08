const assert = require('node:assert/strict');
const { test } = require('node:test');
const { qubitMotion } = require('../src/features/guess-the-qubit/qubit-motion.ts');
const {
  QubitRoundController,
  MIN_SPHERE_SCALE,
  MAX_SPHERE_SCALE,
} = require('../src/features/guess-the-qubit/qubit-round-controller.ts');
const {
  BLOCH_RADIUS,
  BASIS_LABELS,
  blochToWorld,
  ringPoints,
} = require('../src/features/guess-the-qubit/qubit-geometry.ts');
const flush = () => new Promise((resolve) => setImmediate(resolve));
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

test('size buttons clamp to usable bounds and preserve size across round Reset', () => {
  const h = harness();
  assert.equal(h.controller.getSnapshot().sphereScale, 1);
  for (let i = 0; i < 20; i++) h.controller.adjustSphereScale(1, -1);
  assert.equal(h.controller.getSnapshot().sphereScale, MIN_SPHERE_SCALE);
  for (let i = 0; i < 20; i++) h.controller.adjustSphereScale(1, 1);
  assert.equal(h.controller.getSnapshot().sphereScale, MAX_SPHERE_SCALE);
  h.controller.reset();
  assert.equal(h.controller.getSnapshot().sphereScale, MAX_SPHERE_SCALE);
  assert.equal(h.calls.submit.length + h.calls.measure.length, 0);
});

test('pinch uses the shared button size as its baseline and never compounds move events', () => {
  const h = harness();
  for (let i = 0; i < 4; i++) h.controller.adjustSphereScale(1, 1);
  h.controller.pinchSphere(1, 1, 1);
  h.controller.pinchSphere(1, 2, 1.2);
  assert.equal(h.controller.getSnapshot().sphereScale, 2.4);
  h.controller.pinchSphere(1, 2, 1.4);
  assert.equal(h.controller.getSnapshot().sphereScale, 2.8);
  h.controller.pinchSphere(1, 3, 1.3);
  assert.equal(h.controller.getSnapshot().sphereScale, 2.6);
  h.controller.pinchSphere(1, 2, 0.5);
  assert.equal(h.controller.getSnapshot().sphereScale, 2.6);
  h.controller.pinchSphere(1, 1, 1);
  h.controller.pinchSphere(1, 2, 100);
  assert.equal(h.controller.getSnapshot().sphereScale, MAX_SPHERE_SCALE);
  h.controller.pinchSphere(1, 3, 0.01);
  assert.equal(h.controller.getSnapshot().sphereScale, MIN_SPHERE_SCALE);
});

test('buttons supersede an active pinch and Reset discards its stale completions', () => {
  const h = harness();
  h.controller.pinchSphere(1, 1, 1);
  h.controller.pinchSphere(1, 2, 1.5);
  h.controller.adjustSphereScale(1, 1);
  h.controller.pinchSphere(1, 3, 2);
  assert.equal(h.controller.getSnapshot().sphereScale, 1.75);
  h.controller.pinchSphere(1, 1, 1);
  h.controller.reset();
  h.controller.pinchSphere(1, 2, 0.5);
  h.controller.pinchSphere(1, 3, 0.5);
  assert.equal(h.controller.getSnapshot().sphereScale, 1.75);
});

test('surface loss, background and replacement reject stale size callbacks', () => {
  const h = harness();
  h.controller.adjustSphereScale(1, 1);
  h.controller.pinchSphere(1, 1, 1);
  h.controller.attach(2);
  h.controller.adjustSphereScale(2, 1);
  h.controller.pinchSphere(1, 3, 2);
  assert.equal(h.controller.getSnapshot().sphereScale, 1.25);
  h.controller.setPlaced(2, true);
  h.controller.pinchSphere(2, 1, 1);
  h.controller.adjustSphereScale(1, 1);
  h.controller.pinchSphere(2, 2, 2);
  assert.equal(h.controller.getSnapshot().sphereScale, 2.5);
  h.controller.setPlaced(2, false);
  h.controller.setPlaced(2, true);
  h.controller.pinchSphere(2, 3, 0.5);
  assert.equal(h.controller.getSnapshot().sphereScale, 2.5);
  h.controller.detach(2);
  h.controller.adjustSphereScale(2, -1);
  h.controller.pinchSphere(2, 1, 1);
  h.controller.pinchSphere(2, 3, 0.5);
  assert.equal(h.controller.getSnapshot().sphereScale, 2.5);
});

test('invalid gesture values never introduce an invalid or negative transform', () => {
  const h = harness();
  for (const factor of [NaN, Infinity, -Infinity, 0, -1]) {
    h.controller.pinchSphere(1, 1, factor);
    h.controller.pinchSphere(1, 2, factor);
    h.controller.pinchSphere(1, 3, factor);
  }
  h.controller.pinchSphere(1, 2, 2);
  h.controller.pinchSphere(1, 99, 2);
  h.controller.adjustSphereScale(1, NaN);
  assert.equal(h.controller.getSnapshot().sphereScale, 1);
});

test('resizing during measurement preserves the guess, animation identity and outcome', async () => {
  const h = harness();
  h.controller.guess(0);
  await flush();
  const round = h.controller.getSnapshot().roundId;
  const motion = qubitMotion(h.controller.getSnapshot(), false);
  h.controller.adjustSphereScale(1, 1);
  h.controller.pinchSphere(1, 1, 1);
  h.controller.pinchSphere(1, 3, 1.4);
  assert.equal(h.controller.getSnapshot().roundId, round);
  assert.equal(qubitMotion(h.controller.getSnapshot(), false).key, motion.key);
  assert.equal(h.calls.measure.length, 1);
  h.intro();
  h.collapse();
  assert.equal(h.controller.getSnapshot().outcome, 'won');
});

test('resizing a queued hardware round does not submit, cancel or restart polling', async () => {
  const h = harness({}, 'hardware');
  h.controller.guess(1);
  await flush();
  h.advance(10000);
  h.controller.adjustSphereScale(1, -1);
  h.controller.pinchSphere(1, 1, 1);
  h.controller.pinchSphere(1, 3, 1.5);
  h.controller.guess(0);
  assert.equal(h.controller.canGuess(), false);
  assert.equal(h.controller.getSnapshot().guess, 1);
  assert.equal(h.calls.submit.length, 1);
  assert.equal(h.calls.cancel.length, 0);
  h.advance(5000);
  await flush();
  assert.equal(h.calls.status.length, 1);
  assert.equal(h.controller.getSnapshot().jobStatus, 'running');
  h.controller.detach(1);
});
