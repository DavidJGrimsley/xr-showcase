const { test } = require('node:test');
const assert = require('node:assert/strict');
const { checkArenaConnection, connectionMessage, roomRequestMessage, sharingFailureMessage, RELAY_UNREACHABLE } = require('../src/features/arena-fighter/arena-connection.ts');

function port(next = 'connecting') {
  const listeners = new Set();
  return {
    state: 'idle', error: undefined, disconnects: 0, config: null,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    connect(config) { this.config = config; this.change(next); },
    change(state) { this.state = state; for (const fn of [...listeners]) fn(); },
    disconnect() { this.disconnects++; this.change('idle'); },
    listenerCount() { return listeners.size; },
  };
}
const configuration = { roomId: 'preflight', apiKey: 'test', projectId: 'test' };

test('connection preflight waits for a welcome, then releases its temporary socket and listener', async () => {
  const client = port();
  const pending = checkArenaConnection(client, configuration, new AbortController().signal);
  assert.equal(client.disconnects, 0);
  client.change('synced');
  await pending;
  assert.equal(client.disconnects, 1);
  assert.equal(client.listenerCount(), 0);
  assert.deepEqual(client.config, configuration);
});

test('failed replication reports a useful message without exposing the SDK reconnect error', async () => {
  const client = port('failed');
  client.error = 'replication socket gave up reconnecting';
  await assert.rejects(checkArenaConnection(client, configuration, new AbortController().signal), { message: RELAY_UNREACHABLE });
  assert.equal(client.disconnects, 1);
  assert.equal(client.listenerCount(), 0);
  assert.doesNotMatch(connectionMessage('connecting', client.error), /gave up/);
});

test('a socket that never welcomes times out and cannot complete later', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const client = port();
  const rejected = assert.rejects(checkArenaConnection(client, configuration, new AbortController().signal), { message: RELAY_UNREACHABLE });
  t.mock.timers.tick(20000);
  await rejected;
  client.change('synced');
  assert.equal(client.disconnects, 1);
});

test('leaving during a check cancels it and closes the socket without a late success', async () => {
  const abort = new AbortController();
  const client = port();
  const rejected = assert.rejects(checkArenaConnection(client, configuration, abort.signal), /cancelled/);
  abort.abort();
  await rejected;
  client.change('synced');
  assert.equal(client.disconnects, 1);
  assert.equal(client.listenerCount(), 0);
});

test('authentication, inactive invites and unavailable services have different actionable messages', () => {
  assert.match(connectionMessage('failed', 'these credentials or this plan can no longer join the room'), /access was refused/);
  assert.match(connectionMessage('reconnecting'), /fight is paused/);
  assert.match(roomRequestMessage('join', 404), /no longer active/);
  assert.match(roomRequestMessage('host', 403), /configuration or team access/);
  assert.match(roomRequestMessage('host', 503), /invite service is unavailable/);
  assert.match(roomRequestMessage('join', 429), /Wait a moment/);
  assert.match(sharingFailureMessage('Insufficient scan coverage'), /more captured detail/);
  assert.match(sharingFailureMessage('HTTP 401 Unauthorized'), /access was refused/);
  assert.doesNotMatch(sharingFailureMessage('Upload service failed'), /lighting|capture/);
});
