const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ArenaJoinIntent } = require('../src/features/arena-fighter/arena-join-intent.ts');
const {
  ARENA_PROTOCOL,
  joinLink,
  parseJoinLink,
} = require('../src/features/arena-fighter/arena-protocol.ts');

test('a scanned invitation waits for scanner teardown and landscape, then joins only once', () => {
  const intent = new ArenaJoinIntent();
  assert.ok(intent.offer('ABC234'));
  assert.equal(intent.take(true, true), null);
  assert.equal(intent.take(false, false), null);
  assert.equal(intent.take(true, false), 'ABC234');
  assert.equal(intent.take(true, false), null);
  assert.equal(intent.offer('ABC234'), false);
});
test('a failed invitation can be rescanned, while Back cancels a pending portrait join', () => {
  const intent = new ArenaJoinIntent();
  intent.offer('ABC234');
  intent.cancel();
  assert.equal(intent.take(true, false), null);
  intent.beginScan();
  assert.ok(intent.offer('ABC234'));
  assert.equal(intent.take(true, false), 'ABC234');
});
test('version twelve invites contain only a code and protocol; older invites are rejected', () => {
  assert.equal(ARENA_PROTOCOL, 12);
  assert.equal(parseJoinLink(joinLink('ABC234')), 'ABC234');
  const url = new URL(joinLink('ABC234'));
  assert.deepEqual([...url.searchParams.keys()], ['join', 'v']);
  assert.equal(parseJoinLink('xr-showcase://arena-fighter?join=ABC234&v=1'), null);
  assert.equal(parseJoinLink('xr-showcase://arena-fighter?join=ABC234&v=2'), null);
  assert.equal(parseJoinLink('xr-showcase://arena-fighter?join=ABC234&v=3'), null);
});

test('older invitations cannot bypass the three-hit Uppercut rules', () => {
  for (const version of [4, 5, 6, 7, 8, 9, 10, 11])
    assert.equal(parseJoinLink(`xr-showcase://arena-fighter?join=ABC234&v=${version}`), null);
});
