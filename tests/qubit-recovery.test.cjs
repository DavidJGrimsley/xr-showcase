const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  canGuessQubit,
  QubitRoundController,
} = require('../src/features/guess-the-qubit/qubit-round-controller.ts');
const {
  QubitConnectionController,
} = require('../src/features/guess-the-qubit/qubit-connection-controller.ts');
const {
  QubitJobCleanup,
  QUBIT_PENDING_JOBS_KEY,
} = require('../src/features/guess-the-qubit/qubit-job-cleanup.ts');
const {
  qubitPresentation,
  PLACEMENT_CAPTION,
  HARDWARE_CAPTION,
  TRACKING_CAPTION,
} = require('../src/features/guess-the-qubit/qubit-presentation.ts');

const flush = () => new Promise((resolve) => setImmediate(resolve));
function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function clock() {
  let now = 0;
  const pending = new Map();
  return {
    now: () => now,
    pending,
    schedule(fn, delay) {
      const id = Symbol();
      pending.set(id, { fn, at: now + delay });
      return id;
    },
    cancel: (id) => pending.delete(id),
    advance(ms) {
      now += ms;
      for (const [id, task] of [...pending])
        if (task.at <= now) {
          pending.delete(id);
          task.fn();
        }
    },
  };
}
function storage(initial = []) {
  let stored = JSON.stringify(initial);
  return {
    getItem: async (key) => {
      assert.equal(key, QUBIT_PENDING_JOBS_KEY);
      return stored;
    },
    setItem: async (key, value) => {
      assert.equal(key, QUBIT_PENDING_JOBS_KEY);
      stored = value;
    },
    ids: () => JSON.parse(stored),
  };
}
function harness(overrides = {}, saved = storage()) {
  const time = clock();
  const calls = [];
  const defaults = {
    health: async () => 'qiskit',
    checkHardware: async () => {},
    measure: async () => 0,
    submit: async () => ({ jobId: 'game-job', status: 'queued' }),
    status: async (jobId) => ({ jobId, status: 'running' }),
    result: async () => 0,
    cancel: async (jobId) => ({ jobId, status: 'cancelled' }),
  };
  const api = Object.fromEntries(
    Object.keys(defaults).map((name) => [
      name,
      (...args) => {
        calls.push({ name, args });
        return (overrides[name] ?? defaults[name])(...args);
      },
    ])
  );
  const cleanup = new QubitJobCleanup(saved, time);
  const rounds = new QubitRoundController(() => api, time, cleanup);
  rounds.attach(1);
  rounds.setPlaced(1, true);
  rounds.setTracking(1, true);
  const connection = new QubitConnectionController(api, rounds, cleanup, time);
  return {
    time,
    calls,
    api,
    cleanup,
    rounds,
    connection,
    saved,
    count: (name) => calls.filter((call) => call.name === name).length,
  };
}

test('only the exact caption is presented before placement, even on connection failure', () => {
  const h = harness();
  h.rounds.setPlaced(1, false);
  const display = qubitPresentation(h.rounds.getSnapshot(), 'Reconnecting…', true, 0);
  assert.equal(
    display.caption,
    'Move slowly, then tap a highlighted flat surface to place a Bloch Sphere.'
  );
  assert.equal(display.caption, PLACEMENT_CAPTION);
  assert.equal(display.status, '');
  assert.equal(display.spinning, false);
  assert.equal(display.guessHint, '');
});

test('lost tracking explains disabled idle choices and recovers with the same placed sphere', async () => {
  const h = harness();
  h.connection.start();
  await flush();
  const display = () => qubitPresentation(h.rounds.getSnapshot(), '', false, h.time.now());
  assert.equal(canGuessQubit(h.rounds.getSnapshot(), h.time.now()), true);
  assert.equal(display().guessHint, '');
  for (const mode of ['simulator', 'hardware']) {
    h.rounds.setMode(mode);
    h.rounds.setTracking(1, false);
    assert.equal(canGuessQubit(h.rounds.getSnapshot(), h.time.now()), false);
    assert.equal(display().guessHint, TRACKING_CAPTION);
    h.rounds.guess(0);
    assert.equal(h.count('measure') + h.count('submit'), 0);
    h.rounds.setTracking(2, true);
    assert.equal(display().guessHint, TRACKING_CAPTION);
    h.rounds.setTracking(1, true);
    assert.equal(canGuessQubit(h.rounds.getSnapshot(), h.time.now()), true);
    assert.equal(display().guessHint, '');
    assert.equal(h.rounds.getSnapshot().placed, true);
  }
  h.rounds.setMode('simulator');
  h.rounds.guess(0);
  h.rounds.setTracking(1, false);
  assert.equal(display().guessHint, '');
  h.rounds.reset();
  assert.equal(display().guessHint, TRACKING_CAPTION);
  h.rounds.setPlaced(1, false);
  assert.equal(display().guessHint, '');
  h.connection.stop();
  h.rounds.detach(1);
  await flush();
});

test('placed simulator has no caption; hardware has one caption and one concise status', async () => {
  const h = harness();
  h.connection.start();
  await flush();
  assert.equal(qubitPresentation(h.rounds.getSnapshot(), '', false, 0).caption, '');
  assert.equal(qubitPresentation(h.rounds.getSnapshot(), '', false, 0).status, '');
  h.rounds.setMode('hardware');
  h.rounds.guess(1);
  assert.equal(qubitPresentation(h.rounds.getSnapshot(), '', false, 0).status, 'Submitting…');
  await flush();
  const display = qubitPresentation(h.rounds.getSnapshot(), '', false, 0);
  assert.equal(display.caption, HARDWARE_CAPTION);
  assert.equal(display.status, 'Queued…');
  assert.equal(display.spinning, true);
  h.connection.stop();
  h.rounds.detach(1);
  await flush();
});

test('unknown submission is one yellow message, without duplicate guess/job copy', async () => {
  const h = harness({
    submit: async () => {
      throw { code: 'timeout' };
    },
  });
  h.connection.start();
  await flush();
  h.rounds.setMode('hardware');
  h.rounds.guess(0);
  await flush();
  const display = qubitPresentation(h.rounds.getSnapshot(), 'another error', true, 0);
  assert.equal(display.warning, true);
  assert.equal(display.spinning, false);
  assert.equal(
    display.status,
    'Submission interrupted before confirmation. The job may still run. Reset Qubit to retry.'
  );
  assert.equal(display.status.includes('Your guess'), false);
  h.rounds.setMode('simulator');
  assert.equal(qubitPresentation(h.rounds.getSnapshot(), '', false, 0).status, '');
  h.connection.stop();
});

test('offline connection automatically retries without overlapping health requests', async () => {
  let attempt = 0;
  const pending = deferred();
  const h = harness({
    health: () => (++attempt === 1 ? Promise.reject({ code: 'network' }) : pending.promise),
  });
  h.connection.start();
  h.connection.start();
  await flush();
  assert.equal(h.connection.getSnapshot().message, 'Reconnecting…');
  assert.equal(h.rounds.canGuess(), false);
  h.time.advance(15000);
  await flush();
  assert.equal(h.count('health'), 2);
  h.time.advance(90000);
  await flush();
  assert.equal(h.count('health'), 2);
  pending.resolve('qiskit');
  await flush();
  assert.equal(h.rounds.canGuess(), true);
  assert.equal(h.time.pending.size, 0);
  h.connection.stop();
});

test('backend Retry-After gates both new rounds and automatic reconnection', async () => {
  let attempt = 0;
  const h = harness({
    checkHardware: async () => {
      if (++attempt === 1) throw { code: 'rate_limit', retryAt: 60000 };
    },
  });
  h.connection.start();
  await flush();
  h.rounds.guess(0);
  assert.equal(h.count('measure'), 0);
  h.time.advance(59999);
  await flush();
  assert.equal(h.count('checkHardware'), 1);
  h.time.advance(1);
  await flush();
  assert.equal(h.count('checkHardware'), 2);
  assert.equal(h.rounds.canGuess(), true);
  h.connection.stop();
});

test('unavailable hardware leaves simulator usable and reconnects hardware automatically', async () => {
  let attempt = 0;
  const h = harness({
    checkHardware: async () => {
      if (++attempt === 1) throw { code: 'unavailable' };
    },
  });
  h.connection.start();
  await flush();
  assert.equal(h.rounds.canGuess(), true);
  h.rounds.setMode('hardware');
  assert.equal(h.rounds.canGuess(), false);
  h.time.advance(15000);
  await flush();
  assert.equal(h.rounds.canGuess(), true);
  h.connection.stop();
});

test('credential failure disables both modes and retries automatically', async () => {
  let attempt = 0;
  const h = harness({
    checkHardware: async () => {
      if (++attempt === 1) throw { code: 'credentials' };
    },
  });
  h.connection.start();
  await flush();
  assert.equal(h.rounds.getSnapshot().simulatorReady, false);
  assert.equal(h.rounds.getSnapshot().hardwareReady, false);
  h.time.advance(15000);
  await flush();
  assert.equal(h.rounds.canGuess(), true);
  h.connection.stop();
});

test('stop aborts connection checks, clears timers and rejects stale completion on reopen', async () => {
  const pending = deferred();
  let attempt = 0;
  const h = harness({
    health: () => (++attempt === 1 ? pending.promise : Promise.resolve('qiskit')),
  });
  h.connection.start();
  await flush();
  const signal = h.calls.find((call) => call.name === 'health').args[0];
  h.connection.stop();
  assert.equal(signal.aborted, true);
  h.connection.start();
  await flush();
  assert.equal(h.rounds.canGuess(), true);
  pending.resolve('qiskit');
  await flush();
  assert.equal(h.count('checkHardware'), 1);
  assert.equal(h.time.pending.size, 0);
  h.connection.stop();
});

test('reopen cancels saved unfinished jobs before enabling hardware and never resumes them', async () => {
  const pending = deferred();
  const h = harness({ cancel: () => pending.promise }, storage(['old-job']));
  h.connection.start();
  await flush();
  assert.equal(h.count('cancel'), 1);
  assert.equal(h.count('health'), 0);
  assert.equal(h.rounds.getSnapshot().hardwareReady, false);
  pending.resolve({ jobId: 'old-job', status: 'cancelled' });
  await flush();
  assert.deepEqual(h.saved.ids(), []);
  assert.equal(h.rounds.getSnapshot().hardwareReady, true);
  assert.equal(h.count('status'), 0);
  assert.equal(h.count('result'), 0);
  assert.equal(h.count('submit'), 0);
  h.connection.stop();
});

test('failed cancellation persists only job IDs and reconnect retries until confirmed', async () => {
  let attempt = 0;
  const h = harness(
    {
      cancel: async (jobId) => {
        if (++attempt === 1) throw { code: 'network', message: 'private body' };
        return { jobId, status: 'cancelled' };
      },
    },
    storage(['old-job'])
  );
  h.connection.start();
  await flush();
  assert.deepEqual(h.saved.ids(), ['old-job']);
  assert.equal(h.rounds.getSnapshot().simulatorReady, true);
  assert.equal(h.rounds.getSnapshot().hardwareReady, false);
  assert.equal(h.connection.getSnapshot().message, 'Finishing cancellation…');
  h.time.advance(15000);
  await flush();
  assert.equal(h.count('cancel'), 2);
  assert.deepEqual(h.saved.ids(), []);
  assert.equal(h.rounds.getSnapshot().hardwareReady, true);
  h.connection.stop();
});

test('cancellation Retry-After delays recovery calls and never submits another job', async () => {
  let attempt = 0;
  const h = harness(
    {
      cancel: async (jobId) => {
        if (++attempt === 1) throw { code: 'rate_limit', retryAt: 60000 };
        return { jobId, status: 'cancelled' };
      },
    },
    storage(['old-job'])
  );
  h.connection.start();
  await flush();
  h.time.advance(59999);
  await flush();
  assert.equal(h.count('cancel'), 1);
  assert.equal(h.count('health'), 0);
  h.time.advance(1);
  await flush();
  assert.equal(h.count('cancel'), 2);
  assert.equal(h.rounds.getSnapshot().hardwareReady, true);
  assert.equal(h.count('submit'), 0);
  h.connection.stop();
});

for (const leave of ['reset', 'restart', 'background', 'navigation', 'surface-loss'])
  test(`${leave} cancels a known job independently, removes it from storage and stops polling`, async () => {
    const h = harness();
    h.connection.start();
    await flush();
    h.rounds.setMode('hardware');
    h.rounds.guess(0);
    await flush();
    assert.deepEqual(h.saved.ids(), ['game-job']);
    if (['background', 'navigation'].includes(leave)) h.connection.stop();
    if (leave === 'reset') h.rounds.reset();
    else if (leave === 'restart') h.rounds.attach(2);
    else if (leave === 'surface-loss') h.rounds.setPlaced(1, false);
    else h.rounds.detach(1);
    await flush();
    assert.equal(h.count('cancel'), 1);
    assert.deepEqual(h.saved.ids(), []);
    assert.equal(h.calls.find((call) => call.name === 'submit').args[0].aborted, true);
    h.connection.stop();
    h.time.advance(60000);
    await flush();
    assert.equal(h.count('status'), 0);
    assert.equal(h.count('result'), 0);
  });

test('late acknowledgement clears ambiguity and queues cancellation recovery if still cancelling', async () => {
  let late;
  let attempt = 0;
  const h = harness({
    submit: async (_, callback) => {
      late = callback;
      throw { code: 'timeout' };
    },
    cancel: async (jobId) => ({ jobId, status: ++attempt === 1 ? 'cancelling' : 'cancelled' }),
  });
  h.connection.start();
  await flush();
  h.rounds.setMode('hardware');
  h.rounds.guess(0);
  await flush();
  h.rounds.reset();
  late({ jobId: 'late-job', status: 'queued' });
  await flush();
  assert.equal(h.rounds.getSnapshot().uncertainSubmission, false);
  assert.equal(h.rounds.getSnapshot().hardwareReady, false);
  assert.deepEqual(h.saved.ids(), ['late-job']);
  h.time.advance(15000);
  await flush();
  assert.equal(h.count('cancel'), 2);
  assert.equal(h.rounds.getSnapshot().hardwareReady, true);
  assert.equal(h.count('submit'), 1);
  assert.equal(h.count('result'), 0);
  h.connection.stop();
});

test('duplicate cleanup attempts share one bounded network cancellation', async () => {
  const h = harness();
  const pending = deferred();
  h.api.cancel = (jobId) => {
    h.calls.push({ name: 'cancel', args: [jobId] });
    return pending.promise;
  };
  const job = { jobId: 'job', status: 'queued' };
  const first = h.cleanup.cancel(h.api, job);
  assert.equal(h.cleanup.cancel(h.api, job), first);
  await flush();
  assert.equal(h.count('cancel'), 1);
  pending.resolve({ jobId: 'job', status: 'cancelled' });
  await first;
  assert.deepEqual(h.saved.ids(), []);
});

test('mismatched cancellation acknowledgement keeps the original job for recovery', async () => {
  const h = harness({ cancel: async () => ({ jobId: 'other', status: 'cancelled' }) });
  await assert.rejects(h.cleanup.cancel(h.api, { jobId: 'original', status: 'queued' }));
  assert.deepEqual(h.saved.ids(), ['original']);
});

test('expired server job is removed from the cancellation journal', async () => {
  const h = harness(
    {
      cancel: async () => {
        throw { status: 404 };
      },
    },
    storage(['expired'])
  );
  await h.cleanup.recover(h.api);
  assert.deepEqual(h.saved.ids(), []);
});

test('journal write failure cancels the job and prevents normal polling', async () => {
  const saved = storage();
  saved.setItem = async () => {
    throw Error('private storage details');
  };
  const h = harness({}, saved);
  h.connection.start();
  await flush();
  h.rounds.setMode('hardware');
  h.rounds.guess(0);
  await flush();
  assert.equal(h.rounds.getSnapshot().phase, 'error');
  assert.equal(h.rounds.getSnapshot().message.includes('private'), false);
  assert.equal(h.count('cancel'), 1);
  h.time.advance(15000);
  assert.equal(h.count('status'), 0);
  h.connection.stop();
});

test('slow local storage cannot delay the remote cancellation request', async () => {
  const pending = deferred();
  const saved = storage();
  saved.setItem = () => pending.promise;
  const h = harness({}, saved);
  const cancellation = h.cleanup.cancel(h.api, { jobId: 'job', status: 'running' });
  await flush();
  assert.equal(h.count('cancel'), 1);
  pending.resolve();
  await cancellation;
});

test('journal read failures are sanitized, block hardware and recover automatically', async () => {
  let attempt = 0;
  const saved = storage();
  saved.getItem = async () => {
    if (++attempt === 1) throw Error('private');
    return '[]';
  };
  const h = harness({}, saved);
  h.connection.start();
  await flush();
  assert.equal(h.rounds.getSnapshot().hardwareReady, false);
  assert.equal(h.connection.getSnapshot().message.includes('private'), false);
  h.time.advance(15000);
  await flush();
  assert.equal(h.rounds.getSnapshot().hardwareReady, true);
  h.connection.stop();
});

test('a round error reconnects automatically but never repeats the measurement', async () => {
  const h = harness({
    measure: async () => {
      throw { code: 'network' };
    },
  });
  h.connection.start();
  await flush();
  h.rounds.guess(0);
  await flush();
  assert.equal(h.rounds.getSnapshot().phase, 'error');
  assert.equal(h.rounds.getSnapshot().simulatorReady, false);
  h.time.advance(15000);
  await flush();
  assert.equal(h.rounds.getSnapshot().simulatorReady, true);
  assert.equal(h.rounds.getSnapshot().phase, 'error');
  assert.equal(h.count('measure'), 1);
  h.rounds.reset();
  assert.equal(h.rounds.canGuess(), true);
  h.connection.stop();
});

test('a fatal round error keeps retrying failed cancellation even before Reset', async () => {
  let attempt = 0;
  const h = harness({
    status: async () => ({ jobId: 'wrong-job', status: 'succeeded' }),
    cancel: async (jobId) => {
      if (++attempt === 1) throw { code: 'network' };
      return { jobId, status: 'cancelled' };
    },
  });
  h.connection.start();
  await flush();
  h.rounds.setMode('hardware');
  h.rounds.guess(0);
  await flush();
  h.time.advance(15000);
  await flush();
  assert.equal(h.rounds.getSnapshot().phase, 'error');
  assert.equal(h.count('cancel'), 1);
  assert.deepEqual(h.saved.ids(), ['game-job']);
  h.time.advance(15000);
  await flush();
  assert.equal(h.count('cancel'), 2);
  assert.equal(h.rounds.getSnapshot().phase, 'error');
  assert.deepEqual(h.saved.ids(), []);
  assert.equal(h.count('submit'), 1);
  assert.equal(h.count('result'), 0);
  h.connection.stop();
});
