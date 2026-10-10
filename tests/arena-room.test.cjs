const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ArenaRoom } = require('../src/features/arena-fighter/arena-room-controller.ts');
const { ArenaMatch } = require('../src/features/arena-fighter/arena-match.ts');
const { shouldActivateAR } = require('../src/features/ar/ar-activation.ts');

const flush = () => new Promise((resolve) => setImmediate(resolve));
function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const roomResult = {
  success: true,
  room: { roomId: 'room', cloudAnchorId: 'anchor', frameKind: 'cloud_anchor', joinCode: 'ABC234' },
};
function harness(mode = 'host', overrides = {}) {
  const calls = { start: 0, cancel: 0, connect: 0, disconnect: 0, scanStatus: 0 };
  let alive = true;
  const entities = new Map(),
    listeners = new Set();
  const port = {
    state: 'disconnected',
    localPeerId: 'device',
    error: null,
    get: (id) => entities.get(id),
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    connect() {
      calls.connect++;
      this.state = 'synced';
      listeners.forEach((fn) => fn());
    },
    disconnect() {
      calls.disconnect++;
      this.state = 'disconnected';
    },
    claim(id) {
      entities.set(id, { owner: this.localPeerId, fields: {}, version: 0 });
      listeners.forEach((fn) => fn());
    },
    set(id, fields) {
      const old = entities.get(id);
      entities.set(id, { ...old, fields: { ...old.fields, ...fields }, version: old.version + 1 });
      listeners.forEach((fn) => fn());
    },
    release() {},
  };
  const services = {
    createReplicationClient: () => port,
    lookupColocationRoom: async () => roomResult,
    createColocationRoom: async () => roomResult,
    normaliseJoinCode: (code) => code,
    formatJoinCode: (code) => code,
    cloudAnchorFrameSource: (id) => ({
      key: id,
      name: 'test frame',
      support: { ok: true },
      acquire: async () => ({ success: false, error: 'test' }),
    }),
    parseLocationTransform: () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    ...overrides,
  };
  const nav = {
    startScan() {
      if (!alive) throw new Error('Unable to find node on an unmounted component.');
      calls.start++;
    },
    cancelCloudAnchorOperations() {
      calls.cancel++;
      if (!alive) throw new Error('Unable to find node on an unmounted component.');
    },
    async getScanStatus() {
      calls.scanStatus++;
      return {
        available: true,
        meetsKeyframes: true,
        meetsViewpointPairs: true,
        meetsSpread: true,
      };
    },
    async finishScan() {
      return { success: true, cloudAnchorId: 'anchor', locationTransform: 'frame' };
    },
  };
  const match = new ArenaMatch(mode);
  const room = new ArenaRoom(match, { apiKey: 'test', projectId: 'test' }, 'ABC234', services);
  return {
    room,
    match,
    nav,
    calls,
    dead() {
      alive = false;
    },
    alive() {
      alive = true;
    },
  };
}

test('multiplayer retains AR for a permission dialog, releases it for background, and preserves other defaults', () => {
  assert.equal(shouldActivateAR(true, true, 'inactive', true), true);
  assert.equal(shouldActivateAR(true, true, 'background', true), false);
  assert.equal(shouldActivateAR(true, true, 'inactive'), false);
  assert.equal(shouldActivateAR(false, true, 'inactive', true), false);
  assert.equal(shouldActivateAR(true, false, 'inactive', true), false);
  assert.equal(shouldActivateAR(true, true, 'active'), true);
});

test('sharing shows native and invite stages, elapsed time, and handles a delayed native result', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setInterval', 'setTimeout'], now: 1000 });
  const anchor = deferred(), invite = deferred();
  const events = [];
  const h = harness('host', { createColocationRoom: () => invite.promise, observeHosting: event => events.push(event) });
  h.nav.finishScan = () => anchor.promise;
  h.room.attach(h.nav); h.room.tracking(true); h.room.place([1, 0, 2]); h.room.start();
  t.mock.timers.tick(1050); await flush();
  const finish = h.room.finishScan();
  assert.equal(h.room.getSnapshot().hostStep, 'anchor');
  t.mock.timers.tick(65000); await flush();
  assert.equal(h.room.getSnapshot().status, 'hosting');
  assert.equal(h.room.getSnapshot().hostSeconds, 65);
  anchor.resolve({ success: true, cloudAnchorId: 'anchor', locationTransform: 'frame' });
  await flush();
  assert.equal(h.room.getSnapshot().hostStep, 'invite');
  assert.match(h.room.getSnapshot().message, /Creating your invite code/);
  invite.resolve(roomResult); await finish;
  assert.equal(h.room.getSnapshot().status, 'ready');
  assert.deepEqual(events.map(event => [event.step, event.result]), [['anchor', 'started'], ['anchor', 'completed'], ['invite', 'started'], ['invite', 'completed']]);
  h.room.dispose();
});

test('sharing timeout retains placement and rejects a late native result', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setInterval', 'setTimeout'], now: 1000 });
  const anchor = deferred();
  const h = harness(); h.nav.finishScan = () => anchor.promise;
  h.room.attach(h.nav); h.room.tracking(true); h.room.place([1, 0, 2]); h.room.start();
  t.mock.timers.tick(1050); await flush();
  const finish = h.room.finishScan();
  t.mock.timers.tick(120000); await finish;
  assert.equal(h.room.getSnapshot().status, 'error');
  assert.match(h.room.getSnapshot().message, /took too long/);
  assert.deepEqual(h.room.getSnapshot().preview.position, [1, 0, 2]);
  anchor.resolve({ success: true, cloudAnchorId: 'anchor', locationTransform: 'frame' }); await flush();
  assert.equal(h.calls.connect, 0);
  h.room.dispose();
});

test('cancelling sharing ignores its late result and leaves the preview available to retry', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setInterval', 'setTimeout'], now: 1000 });
  const anchor = deferred(); const h = harness(); h.nav.finishScan = () => anchor.promise;
  h.room.attach(h.nav); h.room.tracking(true); h.room.place([1, 0, 2]); h.room.start();
  t.mock.timers.tick(1050); await flush();
  const finish = h.room.finishScan(); h.room.cancelHosting();
  assert.match(h.room.getSnapshot().message, /cancelled/);
  anchor.resolve({ success: true, cloudAnchorId: 'old', locationTransform: 'frame' }); await finish;
  assert.equal(h.calls.connect, 0);
  h.room.retry();
  assert.equal(h.room.getSnapshot().status, 'scanning');
  assert.deepEqual(h.room.getSnapshot().preview.position, [1, 0, 2]);
  h.room.dispose();
});

test('retrying a relay connection retains the localized shared frame without rescanning', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setInterval', 'setTimeout'], now: 1000 });
  const h = harness();
  h.room.attach(h.nav); h.room.tracking(true); h.room.place([1, 0, 2]); h.room.start();
  t.mock.timers.tick(1050); await flush(); await h.room.finishScan();
  const frame = h.room.getSnapshot().frame;
  const source = h.room.getSnapshot().source;
  const cancelled = h.calls.cancel;
  h.room.retry();
  assert.equal(h.room.getSnapshot().status, 'ready');
  assert.equal(h.room.getSnapshot().frame, frame);
  assert.equal(h.room.getSnapshot().source, source);
  assert.equal(h.calls.cancel, cancelled);
  assert.equal(h.calls.start, 1);
  h.room.dispose();
});

test('early detach cancels once while the view exists; late scene cleanup and dispose are safe', () => {
  const h = harness();
  const cleanup = h.room.attach(h.nav);
  h.room.detach();
  assert.equal(h.calls.cancel, 1);
  h.dead();
  assert.doesNotThrow(cleanup);
  assert.doesNotThrow(() => h.room.dispose());
  assert.equal(h.calls.cancel, 1);
});

test('an already unmounted native view cannot abort socket and timer cleanup', async () => {
  const h = harness('guest');
  const cleanup = h.room.attach(h.nav);
  h.room.start();
  await flush();
  assert.equal(h.calls.connect, 1);
  h.dead();
  assert.doesNotThrow(() => h.room.dispose());
  assert.doesNotThrow(cleanup);
  assert.equal(h.calls.cancel, 1);
  assert.equal(h.calls.disconnect, 1);
  assert.doesNotThrow(() => h.room.dispose());
  assert.equal(h.calls.disconnect, 1);
  h.room.start();
  h.room.retry();
  assert.equal(h.calls.connect, 1);
});

test('hosting waits for tracking and a synchronous native startup error remains recoverable', async () => {
  const h = harness();
  h.room.attach(h.nav);
  assert.equal(h.calls.start, 0);
  h.dead();
  h.room.tracking(true);
  assert.equal(h.room.getSnapshot().status, 'placing');
  assert.equal(h.room.place([1, 0, 2]), true);
  await flush();
  assert.equal(h.room.getSnapshot().status, 'error');
  h.alive();
  h.room.retry();
  await flush();
  assert.equal(h.room.getSnapshot().status, 'scanning');
  assert.equal(h.calls.start, 1);
  h.room.dispose();
});

test('a system permission prompt defers scan startup and polling until the app is active', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setInterval', 'setTimeout'], now: 1000 });
  const h = harness();
  h.match.setAppActive(false);
  h.room.attach(h.nav);
  h.room.start();
  h.room.tracking(true);
  t.mock.timers.tick(1050);
  await flush();
  assert.equal(h.calls.start, 0);
  assert.equal(h.calls.scanStatus, 0);
  h.match.setAppActive(true);
  t.mock.timers.tick(50);
  await flush();
  assert.equal(h.calls.start, 0);
  assert.equal(h.room.getSnapshot().status, 'placing');
  assert.equal(h.room.place([1, 0, 2]), true);
  t.mock.timers.tick(50);
  await flush();
  assert.equal(h.calls.start, 1);
  assert.equal(h.calls.scanStatus, 1);
  assert.equal(h.room.getSnapshot().canFinish, true);
  h.match.setAppActive(false);
  t.mock.timers.tick(1050);
  await flush();
  await h.room.finishScan();
  assert.equal(h.calls.scanStatus, 1);
  assert.equal(h.calls.connect, 0);
  h.room.dispose();
});

test('old attachment cleanup cannot detach the replacement native navigator', () => {
  const h = harness();
  const oldCleanup = h.room.attach(h.nav);
  const newNav = { ...h.nav };
  const newCleanup = h.room.attach(newNav);
  assert.equal(h.calls.cancel, 1);
  oldCleanup();
  assert.equal(h.calls.cancel, 1);
  h.room.tracking(true);
  assert.equal(h.room.place([1, 0, 2]), true);
  assert.equal(h.calls.start, 1);
  newCleanup();
  assert.equal(h.calls.cancel, 2);
  h.room.dispose();
});

test('the host places first, then a valid scan creates a room at that spot without a second tap', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setInterval', 'setTimeout'], now: 1000 });
  const h = harness();
  h.nav.getScanStatus = async () => ({
    available: true,
    scanning: true,
    keyframes: 40,
    minKeyframes: 2,
    viewpointPairs: 100,
    minViewpointPairs: 5,
    cameraSpreadMeters: 1.5,
    minSpreadMeters: 1,
    triangulatedPoints: 523,
    minTriangulatedPoints: 300,
  });
  h.room.attach(h.nav);
  h.room.tracking(true);
  h.room.start();
  assert.equal(h.calls.start, 0);
  assert.equal(h.room.getSnapshot().status, 'placing');
  assert.equal(h.match.placement, null);
  await h.room.finishScan();
  assert.equal(h.calls.connect, 0);
  assert.equal(h.room.place([1, 0, 2]), true);
  assert.deepEqual(h.room.getSnapshot().preview.position, [1, 0, 2]);
  assert.equal(h.room.getSnapshot().status, 'scanning');
  assert.equal(h.calls.start, 1);
  assert.equal(h.room.place([5, 0, 8]), false);
  t.mock.timers.tick(1050);
  await flush();
  assert.equal(h.room.getSnapshot().canFinish, true);
  await h.room.finishScan();
  assert.equal(h.calls.connect, 1);
  assert.deepEqual(h.match.placement.position, [1, 0, 2]);
  assert.equal(h.room.getSnapshot().status, 'ready');
  h.room.dispose();
});

test('a room lookup finishing after detach cannot connect or restore an old frame', async () => {
  const lookup = deferred();
  const h = harness('guest', { lookupColocationRoom: () => lookup.promise });
  const cleanup = h.room.attach(h.nav);
  cleanup();
  lookup.resolve(roomResult);
  await flush();
  assert.equal(h.calls.connect, 0);
  assert.equal(h.room.getSnapshot().source, null);
  h.room.dispose();
});

test('retry invalidates old lookup work without losing the attachment cleanup lease', async () => {
  const first = deferred(),
    second = deferred();
  let calls = 0;
  const h = harness('guest', {
    lookupColocationRoom: () => (++calls === 1 ? first.promise : second.promise),
  });
  const cleanup = h.room.attach(h.nav);
  h.room.retry();
  second.resolve(roomResult);
  await flush();
  first.resolve({ success: false, error: 'Old request failed' });
  await flush();
  assert.equal(h.room.getSnapshot().status, 'aligning');
  assert.equal(h.calls.connect, 1);
  cleanup();
  assert.equal(h.calls.cancel, 2);
  assert.equal(h.room.getSnapshot().source, null);
  h.room.dispose();
});

test('native host rejection still shows Retry even when cancellation throws', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setInterval', 'setTimeout'], now: 1000 });
  const h = harness();
  h.nav.finishScan = async () => {
    throw new Error('Hosting failed');
  };
  h.nav.cancelCloudAnchorOperations = () => {
    h.calls.cancel++;
    throw new Error('Unable to find node on an unmounted component.');
  };
  h.room.attach(h.nav);
  h.room.tracking(true);
  h.room.start();
  h.room.place([1, 0, 2]);
  t.mock.timers.tick(1050);
  await flush();
  assert.equal(h.room.getSnapshot().canFinish, true);
  await h.room.finishScan();
  assert.equal(h.room.getSnapshot().status, 'error');
  assert.match(h.room.getSnapshot().message, /retry/);
  assert.doesNotMatch(h.room.getSnapshot().message, /took too long/);
  h.room.dispose();
});

test('sharing converts the preview into a rotated location frame while preserving its world position', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setInterval', 'setTimeout'], now: 1000 });
  const frame = [0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 10, 2, 4, 1];
  const h = harness('host', { parseLocationTransform: () => frame });
  h.room.attach(h.nav);
  h.room.tracking(true);
  h.room.place([11, 2.5, 6]);
  h.room.start();
  t.mock.timers.tick(1050);
  await flush();
  await h.room.finishScan();
  assert.deepEqual(h.match.placement.position, [-2, 0.5, 1]);
  h.match.placement.rotation.forEach((value, i) => assert.ok(Math.abs(value - [0, -90, 0][i]) < 1e-9));
  assert.deepEqual(h.room.getSnapshot().preview.position, [11, 2.5, 6]);
  assert.equal(h.room.getSnapshot().status, 'ready');
  assert.equal(h.room.place([0, 0, 0]), false);
  h.room.reposition();
  assert.equal(h.room.getSnapshot().status, 'ready');
  h.room.dispose();
});

test('placement rejects inactive, untracked, nonfinite and guest taps without starting capture', () => {
  const h = harness();
  h.room.attach(h.nav);
  assert.equal(h.room.place([1, 0, 2]), false);
  h.room.tracking(true);
  h.match.setAppActive(false);
  assert.equal(h.room.place([1, 0, 2]), false);
  h.match.setAppActive(true);
  assert.equal(h.room.place([Number.NaN, 0, 2]), false);
  assert.equal(h.calls.start, 0);
  h.room.dispose();
  const guest = harness('guest');
  guest.room.attach(guest.nav);
  guest.room.tracking(true);
  assert.equal(guest.room.place([1, 0, 2]), false);
  assert.equal(guest.calls.start, 0);
  guest.room.dispose();
});

test('retry preserves the chosen spot but a new native session requires fresh placement', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setInterval', 'setTimeout'], now: 1000 });
  const h = harness();
  h.nav.finishScan = async () => ({ success: false, error: 'More detail needed' });
  h.room.attach(h.nav);
  h.room.tracking(true);
  h.room.place([1, 0, 2]);
  h.room.start();
  t.mock.timers.tick(1050);
  await flush();
  await h.room.finishScan();
  assert.equal(h.room.getSnapshot().status, 'error');
  h.room.retry();
  assert.equal(h.room.getSnapshot().status, 'scanning');
  assert.deepEqual(h.room.getSnapshot().preview.position, [1, 0, 2]);
  assert.equal(h.calls.start, 2);
  h.room.detach();
  h.room.attach({ ...h.nav });
  h.room.tracking(true);
  assert.equal(h.room.getSnapshot().preview, null);
  assert.equal(h.room.getSnapshot().status, 'placing');
  assert.equal(h.calls.start, 2);
  h.room.dispose();
});

test('moving the arena invalidates pending hosting and requires a new placement and scan', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setInterval', 'setTimeout'], now: 1000 });
  const hosted = deferred();
  const h = harness();
  h.nav.finishScan = () => hosted.promise;
  h.room.attach(h.nav);
  h.room.tracking(true);
  h.room.place([1, 0, 2]);
  h.room.start();
  t.mock.timers.tick(1050);
  await flush();
  const oldFinish = h.room.finishScan();
  h.room.reposition();
  assert.equal(h.room.getSnapshot().status, 'placing');
  assert.equal(h.room.getSnapshot().preview, null);
  h.room.place([3, 0, 4]);
  hosted.resolve({ success: true, cloudAnchorId: 'old-anchor', locationTransform: 'old-frame' });
  await oldFinish;
  assert.equal(h.calls.connect, 0);
  assert.equal(h.match.placement, null);
  assert.equal(h.room.getSnapshot().status, 'scanning');
  assert.deepEqual(h.room.getSnapshot().preview.position, [3, 0, 4]);
  assert.equal(h.room.getSnapshot().canFinish, false);
  h.room.dispose();
});
