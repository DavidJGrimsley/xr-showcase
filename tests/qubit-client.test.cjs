const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  QuantumApiClient,
  QuantumError,
  QUANTUM_API_BASE,
  parseMeasurement,
  parseHardwareResult,
  parseJob,
} = require('../src/services/quantum-api.ts');
const {
  QubitConfiguration,
  QUBIT_CONFIG_KEY,
} = require('../src/features/guess-the-qubit/qubit-configuration.ts');

const credentials = {
  apiKey: 'synthetic-test-key',
  backend: 'test-backend',
  profile: 'test-profile',
};
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
function clock() {
  let now = 1000;
  const pending = new Map();
  return {
    pending,
    now: () => now,
    schedule(fn, delay) {
      const id = Symbol();
      pending.set(id, { fn, at: now + delay });
      return id;
    },
    cancel: (id) => pending.delete(id),
    advance(ms) {
      now += ms;
      for (const [id, item] of [...pending])
        if (item.at <= now) {
          pending.delete(id);
          item.fn();
        }
    },
  };
}
const response = (body, status = 200, headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (key) => headers[key] ?? null },
  json: async () => body,
});
const hardware = (counts, overrides = {}) => ({
  job_id: 'job-1',
  status: 'succeeded',
  result: { num_qubits: 1, shots: 1, counts },
  ...overrides,
});

test('simulator accepts only integer bits and ignores the service success flag', () => {
  assert.equal(parseMeasurement({ measurement: 0, success: true }), 0);
  assert.equal(parseMeasurement({ measurement: 1, success: false }), 1);
  for (const value of [
    null,
    {},
    { measurement: '0' },
    { measurement: true },
    { measurement: 2 },
    { measurement: -1 },
    { measurement: 0.5 },
  ])
    assert.throws(() => parseMeasurement(value), QuantumError);
});
test('hardware accepts one-shot circuit counts and rejects malformed or unrelated results', () => {
  for (const [counts, bit] of [
    [{ 0: 1 }, 0],
    [{ 1: 1 }, 1],
    [{ 0: 0, 1: 1 }, 1],
  ])
    assert.equal(parseHardwareResult(hardware(counts), 'job-1'), bit);
  for (const counts of [
    {},
    { 0: 0 },
    { 0: 1, 1: 1 },
    { 0: -1, 1: 2 },
    { 0: '1' },
    { 0: true },
    { '00': 1 },
    { 2: 1 },
    { 0: 0.5, 1: 0.5 },
    null,
    [],
  ])
    assert.throws(() => parseHardwareResult(hardware(counts), 'job-1'), QuantumError);
  for (const data of [
    hardware({ 0: 1 }, { job_id: 'wrong' }),
    hardware({ 0: 1 }, { status: 'running' }),
    hardware({ 0: 1 }, { status: undefined }),
    hardware({ 0: 1 }, { result: { num_qubits: 2, shots: 1, counts: { 0: 1 } } }),
    hardware({ 0: 1 }, { result: { num_qubits: 1, shots: 2, counts: { 0: 1 } } }),
    hardware({ 0: 1 }, { result: { value: 0, source: 'ibm-hardware' } }),
  ])
    assert.throws(() => parseHardwareResult(data, 'job-1'), QuantumError);
});
test('job parsing validates identity and every normalized status', () => {
  for (const status of ['queued', 'running', 'cancelling', 'succeeded', 'failed', 'cancelled'])
    assert.deepEqual(parseJob({ job_id: 'j', status }, 'j'), { jobId: 'j', status });
  for (const value of [
    { job_id: '', status: 'queued' },
    { job_id: 'j', status: 'unknown' },
    { job_id: 'different', status: 'running' },
  ])
    assert.throws(() => parseJob(value, 'j'), QuantumError);
});
test('requests use the exact production paths, authentication and one-shot ry payload', async () => {
  const calls = [];
  const c = clock();
  const client = new QuantumApiClient(
    async (url, init) => {
      calls.push({ url, init });
      return response(
        url.endsWith('/gates/run')
          ? { measurement: 1, success: false }
          : { job_id: 'job-1', status: 'queued' }
      );
    },
    credentials,
    c
  );
  assert.equal(await client.measure(new AbortController().signal), 1);
  await client.submit(new AbortController().signal, () => {});
  assert.equal(calls[0].url, `${QUANTUM_API_BASE}/gates/run`);
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    gate_type: 'rotation',
    rotation_angle_rad: Math.PI / 2,
  });
  assert.equal(calls[1].url, `${QUANTUM_API_BASE}/jobs/circuits`);
  assert.equal(calls[1].init.headers['X-API-Key'], credentials.apiKey);
  assert.deepEqual(JSON.parse(calls[1].init.body), {
    provider: 'ibm',
    backend_name: credentials.backend,
    ibm_profile: credentials.profile,
    shots: 1,
    circuit: { num_qubits: 1, operations: [{ gate: 'ry', target: 0, theta: Math.PI / 2 }] },
  });
  assert.equal(c.pending.size, 0);
});
test('health is public; hardware discovery must find an actual hardware backend', async () => {
  const calls = [];
  let list = [
    { name: credentials.backend, is_hardware: true, is_simulator: false, num_qubits: 10 },
  ];
  const client = new QuantumApiClient(async (url, init) => {
    calls.push({ url, init });
    return response(
      url.endsWith('/health')
        ? { status: 'healthy', runtime_mode: 'classical-fallback' }
        : { backends: list }
    );
  }, credentials);
  assert.equal(await client.health(new AbortController().signal), 'classical-fallback');
  assert.deepEqual(calls[0].init.headers, {});
  await client.checkHardware(new AbortController().signal);
  assert.match(calls[1].url, /list_backends\?provider=ibm/);
  assert.match(calls[1].url, /ibm_profile=test-profile/);
  list = [{ name: credentials.backend, is_hardware: false, is_simulator: true, num_qubits: 10 }];
  await assert.rejects(client.checkHardware(new AbortController().signal), { code: 'unavailable' });
});
for (const [status, code] of [
  [401, 'credentials'],
  [403, 'credentials'],
  [429, 'rate_limit'],
  [503, 'unavailable'],
  [422, 'request_failed'],
]) {
  test(`HTTP ${status} is sanitized and never automatically retries`, async () => {
    let calls = 0;
    const c = clock();
    const client = new QuantumApiClient(
      async () => {
        calls++;
        return response({ message: credentials.apiKey }, status, { 'Retry-After': '45' });
      },
      credentials,
      c
    );
    await assert.rejects(client.measure(new AbortController().signal), (error) => {
      assert.equal(error.code, code);
      assert.equal(error.message.includes(credentials.apiKey), false);
      if (status === 429) assert.equal(error.retryAt, 46000);
      return true;
    });
    assert.equal(calls, 1);
    assert.equal(c.pending.size, 0);
  });
}
test('rate limits accept HTTP dates and use a 15 second minimum when missing or malformed', async () => {
  for (const retry of [undefined, 'garbage', '0', 'Thu, 01 Jan 1970 00:01:00 GMT']) {
    const c = clock();
    const client = new QuantumApiClient(
      async () => response({}, 429, { 'Retry-After': retry }),
      credentials,
      c
    );
    await assert.rejects(client.measure(new AbortController().signal), (error) => {
      assert.equal(error.retryAt, retry?.includes('GMT') ? 60000 : 16000);
      return true;
    });
  }
});
test('network errors and non-JSON successes expose no raw private text', async () => {
  const client = new QuantumApiClient(async () => {
    throw new Error(credentials.apiKey);
  }, credentials);
  await assert.rejects(
    client.measure(new AbortController().signal),
    (error) => error.code === 'network' && !error.message.includes(credentials.apiKey)
  );
  const invalid = new QuantumApiClient(
    async () => ({
      ...response({}),
      json: async () => {
        throw new Error(credentials.apiKey);
      },
    }),
    credentials
  );
  await assert.rejects(invalid.measure(new AbortController().signal), { code: 'invalid_result' });
});
test('timeouts abort transport and preserve a late submission ID for cancellation', async () => {
  const pending = deferred();
  const c = clock();
  const late = [];
  let calls = 0;
  let signal;
  const client = new QuantumApiClient(
    async (_, init) => {
      calls++;
      signal = init.signal;
      return pending.promise;
    },
    credentials,
    c
  );
  const result = client.submit(new AbortController().signal, (job) => late.push(job));
  const rejection = assert.rejects(result, { code: 'timeout' });
  c.advance(30000);
  await rejection;
  assert.equal(signal.aborted, true);
  pending.resolve(response({ job_id: 'late', status: 'queued' }));
  await flush();
  assert.deepEqual(late, [{ jobId: 'late', status: 'queued' }]);
  assert.equal(calls, 1);
  assert.equal(c.pending.size, 0);
});
test('external abort works before a request and during delayed JSON parsing', async () => {
  const json = deferred();
  const late = [];
  const outer = new AbortController();
  let calls = 0;
  const client = new QuantumApiClient(async () => {
    calls++;
    return { ...response({}), json: () => json.promise };
  }, credentials);
  const promise = client.submit(outer.signal, (job) => late.push(job));
  await flush();
  outer.abort();
  await assert.rejects(promise, { code: 'aborted' });
  json.resolve({ job_id: 'late-json', status: 'running' });
  await flush();
  assert.equal(late[0].jobId, 'late-json');
  await assert.rejects(client.measure(outer.signal), { code: 'aborted' });
  assert.equal(calls, 1);
});
test('status/result/cancel URL-encode IDs; cancellation has its own bounded signal', async () => {
  const calls = [];
  const client = new QuantumApiClient(async (url, init) => {
    calls.push({ url, init });
    return response(
      url.endsWith('/result')
        ? hardware({ 1: 1 }, { job_id: 'a/b' })
        : { job_id: 'a/b', status: 'succeeded' }
    );
  }, credentials);
  await client.status('a/b', new AbortController().signal);
  assert.equal(await client.result('a/b', new AbortController().signal), 1);
  await client.cancel('a/b');
  assert.ok(calls.every((call) => call.url.includes('/jobs/a%2Fb')));
  assert.equal(calls[2].init.signal.aborted, false);
  assert.equal(calls[2].init.method, 'POST');
  const c = clock();
  const hanging = new QuantumApiClient(() => new Promise(() => {}), credentials, c);
  const stopped = assert.rejects(hanging.cancel('a/b'), { code: 'timeout' });
  c.advance(8000);
  await stopped;
});

function storageHarness() {
  const values = new Map();
  let fail = false;
  const storage = {
    async getItemAsync(key) {
      if (fail) throw Error(credentials.apiKey);
      return values.get(key) ?? null;
    },
    async setItemAsync(key, value) {
      if (fail) throw Error(credentials.apiKey);
      values.set(key, value);
    },
    async deleteItemAsync(key) {
      if (fail) throw Error(credentials.apiKey);
      values.delete(key);
    },
  };
  return {
    config: new QubitConfiguration(storage),
    values,
    setFail(value) {
      fail = value;
    },
  };
}
test('private storage supports save, masked summary, reload, key retention and deletion', async () => {
  const h = storageHarness();
  await h.config.load();
  assert.equal(h.config.summary().configured, false);
  await h.config.save(credentials.apiKey, 'backend', 'profile');
  assert.equal(JSON.stringify(h.config.summary()).includes(credentials.apiKey), false);
  await h.config.save('', 'new-backend', 'new-profile');
  await h.config.load();
  assert.equal(h.config.forTransport().apiKey, credentials.apiKey);
  assert.equal(h.config.summary().backend, 'new-backend');
  await h.config.remove();
  assert.equal(h.config.forTransport(), null);
  assert.equal(h.values.size, 0);
});
test('SecureStore failures preserve previous writes, suppress secret errors, and reject corrupt data', async () => {
  const h = storageHarness();
  await h.config.save(credentials.apiKey, 'original', 'profile');
  h.setFail(true);
  for (const action of [() => h.config.save('replacement', 'new', 'new'), () => h.config.remove()])
    await assert.rejects(action(), (error) => !error.message.includes(credentials.apiKey));
  assert.equal(h.config.summary().backend, 'original');
  await assert.rejects(h.config.load());
  assert.equal(h.config.forTransport(), null);
  h.setFail(false);
  h.values.set(QUBIT_CONFIG_KEY, '{bad json');
  await assert.rejects(h.config.load());
  h.values.set(QUBIT_CONFIG_KEY, JSON.stringify({ apiKey: '', backend: 'b', profile: 'p' }));
  await assert.rejects(h.config.load());
});
test('concurrent configuration writes are rejected without overwriting pending work', async () => {
  const pending = deferred();
  let writes = 0;
  const config = new QubitConfiguration({
    getItemAsync: async () => null,
    setItemAsync: async () => {
      writes++;
      await pending.promise;
    },
    deleteItemAsync: async () => {},
  });
  const save = config.save('first-test-key', 'b', 'p');
  await assert.rejects(config.save('second-test-key', 'b', 'p'));
  await assert.rejects(config.remove());
  pending.resolve();
  await save;
  assert.equal(writes, 1);
  assert.equal(config.forTransport().apiKey, 'first-test-key');
});
