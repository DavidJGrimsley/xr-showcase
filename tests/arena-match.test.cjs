const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ArenaMatch } = require('../src/features/arena-fighter/arena-match.ts');
const { ArenaNetwork } = require('../src/features/arena-fighter/arena-network.ts');
const {
  validInput,
  validPacket,
  joinLink,
  parseJoinLink,
} = require('../src/features/arena-fighter/arena-protocol.ts');
const { arenaInFrame, framePose } = require('../src/features/arena-fighter/arena-placement.ts');

function harness(mode = 'solo', rounds = 3, rules = {}, now = () => 0) {
  const match = new ArenaMatch(mode, rounds, now, { cpuEnabled: false, spawn: 0.04, ...rules });
  let token = match.attachSession(1);
  function load() {
    match.setLandscape(true);
    match.setTracking(token, true);
    match.setPlacement(token, true);
    for (const asset of ['arena', 'blue', 'red'])
      match.assetLoaded(token, match.getSnapshot().placementVersion, asset);
    tick(0.5);
  }
  function tick(seconds, applied = true) {
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      if (applied)
        for (const id of ['blue', 'red'])
          match.animationApplied(id, match.getSnapshot()[id].animationId);
      match.tick(token, 1 / 60);
    }
  }
  load();
  return {
    match,
    tick,
    load,
    token: () => token,
    replace() {
      match.detachSession(token);
      token = match.attachSession(2);
      load();
    },
    snapshot: match.getSnapshot,
  };
}

test('solo starts only after Ready and countdown; results wait for applied knockout commands', () => {
  const h = harness('solo', 1, { health: 10 });
  assert.equal(h.match.ready(), true);
  h.tick(3.1);
  assert.equal(h.snapshot().stage, 'fighting');
  h.match.attack('punch');
  h.tick(0.3, false);
  assert.equal(h.snapshot().stage, 'presenting');
  assert.equal(h.snapshot().outcome, null);
  h.tick(5, false);
  assert.equal(h.snapshot().outcome, null);
  h.tick(1);
  assert.equal(h.snapshot().outcome, null);
  h.tick(1.5);
  assert.equal(h.snapshot().stage, 'finished');
  assert.equal(h.snapshot().wins.blue, 1);
});

test('best of three ends at two wins, automatically advances, and rematch resets the series', () => {
  const h = harness('solo', 3, { health: 10 });
  h.match.ready();
  h.tick(3.1);
  h.match.attack('punch');
  h.tick(2.9);
  assert.equal(h.snapshot().stage, 'intermission');
  assert.deepEqual(h.snapshot().wins, { blue: 1, red: 0 });
  h.tick(5);
  assert.equal(h.snapshot().stage, 'fighting');
  assert.equal(h.snapshot().red.health, 10);
  h.match.attack('punch');
  h.tick(2.9);
  assert.equal(h.snapshot().stage, 'finished');
  assert.equal(h.snapshot().wins.blue, 2);
  h.match.rematch();
  h.tick(3.2);
  assert.equal(h.snapshot().stage, 'fighting');
  assert.deepEqual(h.snapshot().wins, { blue: 0, red: 0 });
});

test('draws replay without advancing score; best of five needs three wins', () => {
  const h = harness('solo', 5, { health: 10 });
  h.match.ready();
  h.tick(3.1);
  h.match.round.attack('punch', 'red');
  h.match.round.attack('punch', 'blue');
  h.tick(2);
  assert.equal(h.snapshot().outcome, 'draw');
  assert.deepEqual(h.snapshot().wins, { blue: 0, red: 0 });
  h.tick(5);
  for (let win = 1; win <= 3; win++) {
    h.match.attack('punch');
    h.tick(2.9);
    assert.equal(h.snapshot().stage, win === 3 ? 'finished' : 'intermission');
    if (win < 3) h.tick(5);
  }
});

test('finishing uppercut plays the full arc, defeat, and victory before showing results', () => {
  const h = harness('solo', 1, { health: 15 });
  h.match.ready();
  h.tick(3.1);
  h.match.attack('uppercut');
  h.tick(0.5);
  h.tick(0.4);
  assert.ok(h.match.getTransform('red').lift > 0.17);
  assert.equal(h.snapshot().outcome, null);
  h.tick(0.4);
  assert.equal(h.snapshot().red.clip, 'Defeat');
  h.tick(0.6);
  assert.equal(h.snapshot().outcome, null);
  h.tick(1);
  assert.equal(h.snapshot().stage, 'finished');
});

test('two humans meet symmetrically and input from the guest is applied once', () => {
  let time = 0;
  const now = () => time;
  const host = harness('host', 3, {}, now),
    guest = harness('guest', 3, {}, now);
  function exchange() {
    host.match.setNetwork(true);
    guest.match.setNetwork(true);
    guest.match.receivePacket(host.match.packet());
    host.match.receiveInput(guest.match.input());
  }
  function step(seconds) {
    for (let i = 0; i < seconds * 60; i++) {
      time += 1000 / 60;
      exchange();
      host.tick(1 / 60);
      guest.tick(1 / 60);
    }
  }
  exchange();
  assert.ok(host.match.ready());
  assert.ok(guest.match.ready());
  step(3.2);
  assert.equal(host.snapshot().stage, 'fighting');
  assert.equal(guest.snapshot().stage, 'fighting');
  host.match.setMovement('advance', true);
  guest.match.setMovement('advance', true);
  step(0.4);
  assert.ok(Math.abs(host.match.getTransform('blue').x + host.match.getTransform('red').x) < 1e-8);
  assert.ok(
    Math.abs(host.match.getTransform('red').x - host.match.getTransform('blue').x - 0.055) < 1e-8
  );
  guest.match.attack('punch');
  step(1.4);
  assert.equal(host.snapshot().blue.health, 90);
  assert.equal(guest.snapshot().blue.health, 90);
  assert.equal(guest.match.input().commands.length, 0);
});

function pair(rules = {}) {
  let time = 0;
  const now = () => time;
  const host = harness('host', 1, rules, now),
    guest = harness('guest', 1, rules, now);
  let linked = true;
  function exchange() {
    if (!linked) return;
    host.match.setNetwork(true);
    guest.match.setNetwork(true);
    guest.match.receivePacket(host.match.packet());
    host.match.receiveInput(guest.match.input());
  }
  function step(seconds, guestApplied = true) {
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      time += 1000 / 60;
      exchange();
      host.match.poll();
      guest.match.poll();
      host.tick(1 / 60);
      guest.tick(1 / 60, guestApplied);
    }
  }
  exchange();
  host.match.ready();
  guest.match.ready();
  step(3.2);
  return {
    host,
    guest,
    step,
    exchange,
    unlink() {
      linked = false;
    },
    link() {
      linked = true;
    },
    now,
  };
}

test('host waits for a delayed guest knockout presentation before either result appears', () => {
  const p = pair({ health: 10 });
  p.host.match.attack('punch');
  p.step(4, false);
  assert.equal(p.host.snapshot().stage, 'presenting');
  assert.equal(p.guest.snapshot().outcome, null);
  p.step(2.5);
  assert.equal(p.host.snapshot().stage, 'finished');
  assert.equal(p.guest.snapshot().stage, 'finished');
});

test('tracking interruption cancels pending attacks, preserves cooldown, and both must Resume', () => {
  const p = pair();
  p.guest.match.attack('uppercut');
  p.step(0.2);
  p.guest.match.setTracking(p.guest.token(), false);
  p.step(0.1);
  assert.equal(p.host.snapshot().stage, 'paused');
  const remaining = p.host.snapshot().red.uppercutRemaining;
  p.step(2);
  assert.equal(p.host.snapshot().red.uppercutRemaining, remaining);
  assert.equal(p.host.snapshot().blue.health, 100);
  p.guest.match.setTracking(p.guest.token(), true);
  p.step(0.6);
  assert.ok(p.host.match.resume());
  p.step(0.1);
  assert.equal(p.host.snapshot().stage, 'paused');
  assert.ok(p.guest.match.resume());
  p.step(0.3);
  assert.equal(p.host.snapshot().stage, 'fighting');
  assert.equal(p.guest.snapshot().stage, 'fighting');
  p.step(1);
  assert.equal(p.host.snapshot().blue.health, 100);
});

test('silent disconnect pauses within one second and expires without a winner', () => {
  const p = pair();
  p.unlink();
  p.step(1.1);
  assert.equal(p.host.snapshot().stage, 'paused');
  assert.equal(p.guest.snapshot().stage, 'paused');
  p.step(30.1);
  assert.equal(p.host.snapshot().stage, 'abandoned');
  assert.equal(p.host.snapshot().outcome, null);
});

test('session replacement recovers the shared round without replaying interrupted damage', () => {
  const p = pair();
  p.guest.match.attack('uppercut');
  p.step(0.2);
  p.guest.replace();
  p.step(0.6);
  assert.equal(p.host.snapshot().stage, 'paused');
  p.host.match.resume();
  p.guest.match.resume();
  p.step(0.5);
  assert.equal(p.host.snapshot().stage, 'fighting');
  assert.equal(p.host.snapshot().blue.health, 100);
});

test('protocol rejects malformed data and QR contains only the version and code', () => {
  const p = pair();
  assert.ok(validPacket(p.host.match.packet()));
  assert.ok(validInput(p.guest.match.input()));
  assert.equal(
    validPacket({ ...p.host.match.packet(), transforms: { blue: { x: NaN }, red: {} } }),
    false
  );
  assert.equal(validInput({ ...p.guest.match.input(), commands: [{ kind: 'win' }] }), false);
  assert.equal(parseJoinLink(joinLink('K7M2QX')), 'K7M2QX');
  assert.equal(parseJoinLink('https://example.com'), null);
});

test('location-frame placement survives different translations and a rotated shared origin', () => {
  const frame = [0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 2, 1, 3, 1];
  const pose = arenaInFrame(frame, [3, 1, 3]);
  assert.deepEqual(pose.position, [0, 0, 1]);
  assert.ok(Math.abs(pose.rotation[1] + 90) < 1e-8);
  assert.deepEqual(framePose(frame).position, [2, 1, 3]);
});

function fakeRelay() {
  const entities = new Map(),
    ports = new Set();
  let nextPeer = 0;
  const announce = () => {
    for (const port of [...ports]) if (port.state === 'synced') port.emit();
  };
  return {
    entities,
    port() {
      const listeners = new Set();
      const port = {
        state: 'idle',
        localPeerId: '',
        writes: 0,
        emit() {
          for (const fn of listeners) fn();
        },
        subscribe(fn) {
          listeners.add(fn);
          return () => listeners.delete(fn);
        },
        connect() {
          this.disconnect();
          ports.add(this);
          this.state = 'synced';
          this.localPeerId = 'p' + ++nextPeer;
          this.emit();
        },
        disconnect() {
          this.state = 'idle';
          for (const entity of entities.values())
            if (entity.owner === this.localPeerId) entity.owner = null;
          this.emit();
          announce();
        },
        get(id) {
          return entities.has(id) ? structuredClone(entities.get(id)) : undefined;
        },
        claim(id, options) {
          const prior = entities.get(id);
          if (
            (prior?.owner && prior.owner !== this.localPeerId) ||
            (options && prior?.version !== options.expectVersion)
          )
            return;
          entities.set(id, {
            id,
            fields: prior?.fields ?? {},
            owner: this.localPeerId,
            version: (prior?.version ?? 0) + 1,
          });
          announce();
        },
        set(id, fields) {
          const prior = entities.get(id);
          assert.equal(prior.owner, this.localPeerId);
          this.writes++;
          entities.set(id, {
            ...prior,
            fields: structuredClone({ ...prior.fields, ...fields }),
            version: prior.version + 1,
          });
          announce();
        },
        release(id) {
          const entity = entities.get(id);
          if (entity?.owner === this.localPeerId) entity.owner = null;
          announce();
        },
      };
      return port;
    },
  };
}

test('replication adapter admits only two seats, bounds writes, and reconnects the same client', () => {
  let time = 0;
  const now = () => time;
  const host = harness('host', 1, {}, now),
    guest = harness('guest', 1, {}, now),
    third = harness('guest', 1, {}, now);
  const relay = fakeRelay(),
    hostPort = relay.port(),
    guestPort = relay.port();
  const config = { roomId: 'room', apiKey: 'test', projectId: 'test' };
  const hostNet = new ArenaNetwork(host.match, hostPort, config, 'ABC234', now);
  const guestNet = new ArenaNetwork(guest.match, guestPort, config, 'ABC234', now);
  function step(seconds) {
    for (let i = 0; i < seconds * 60; i++) {
      time += 1000 / 60;
      hostNet.pump();
      guestNet.pump();
      host.tick(1 / 60);
      guest.tick(1 / 60);
    }
  }
  step(0.3);
  assert.ok(host.match.ready());
  assert.ok(guest.match.ready());
  step(3.2);
  assert.equal(guest.snapshot().stage, 'fighting');
  const thirdNet = new ArenaNetwork(third.match, relay.port(), config, 'ABC234', now);
  assert.equal(third.snapshot().networkMessage, 'Room full.');
  thirdNet.close();
  guest.match.attack('punch');
  step(0.5);
  assert.equal(host.snapshot().blue.health, 90);
  const writes = hostPort.writes;
  step(1);
  assert.ok(hostPort.writes - writes <= 21);
  guestPort.disconnect();
  step(0.2);
  assert.equal(guest.snapshot().stage, 'paused');
  guestNet.retry();
  step(0.6);
  assert.ok(host.match.resume());
  assert.ok(guest.match.resume());
  step(0.3);
  assert.equal(guest.snapshot().stage, 'fighting');
  assert.equal(host.snapshot().blue.health, 90);
  guestNet.close();
  assert.equal(host.snapshot().stage, 'abandoned');
  hostNet.close();
});

test('stale snapshots, previous-round attacks, and duplicate input batches cannot change damage', () => {
  const p = pair();
  const oldPacket = p.host.match.packet(),
    oldInput = p.guest.match.input();
  p.guest.match.attack('punch');
  p.step(0.5);
  p.guest.match.receivePacket(oldPacket);
  assert.equal(p.guest.snapshot().blue.health, 90);
  p.host.match.receiveInput(oldInput);
  p.step(1);
  assert.equal(p.host.snapshot().blue.health, 90);
  const invalidRound = p.guest.match.input();
  invalidRound.commands = [
    {
      kind: 'uppercut',
      seq: 999,
      epoch: invalidRound.epoch,
      matchId: invalidRound.matchId,
      roundId: invalidRound.roundId - 1,
    },
  ];
  p.host.match.receiveInput(invalidRound);
  p.host.tick(0.6);
  assert.equal(p.host.snapshot().blue.health, 90);
});

test('both players must opt into a rematch after a synchronized result', () => {
  const p = pair({ health: 10 });
  p.host.match.attack('punch');
  p.step(3);
  assert.equal(p.host.snapshot().stage, 'finished');
  p.host.match.rematch();
  p.step(0.3);
  assert.equal(p.guest.snapshot().stage, 'finished');
  p.guest.match.rematch();
  p.step(3.3);
  assert.equal(p.host.snapshot().stage, 'fighting');
  assert.equal(p.guest.snapshot().stage, 'fighting');
  assert.deepEqual(p.host.snapshot().wins, { blue: 0, red: 0 });
});

test('a backgrounded knockout resumes its visible presentation before the result', () => {
  const p = pair({ health: 15 });
  p.host.match.attack('uppercut');
  p.step(0.8);
  p.guest.replace();
  p.step(0.6);
  assert.equal(p.host.snapshot().stage, 'paused');
  p.host.match.resume();
  p.guest.match.resume();
  p.step(0.2, false);
  assert.equal(p.guest.snapshot().outcome, null);
  p.step(3);
  assert.equal(p.host.snapshot().stage, 'finished');
  assert.equal(p.guest.snapshot().stage, 'finished');
});

test('shared placement changes notify the guest before assets are mounted', () => {
  const host = harness('host'),
    guest = harness('guest');
  guest.match.receivePacket(host.match.packet());
  let updates = 0;
  guest.match.subscribe(() => updates++);
  const placement = { position: [0.2, 0.1, -0.4], rotation: [0, 90, 0] };
  host.match.setSharedPlacement(placement);
  guest.match.receivePacket(host.match.packet());
  assert.deepEqual(guest.snapshot().sharedPlacement, placement);
  assert.ok(updates > 0);
});

test('coalesced replicated inputs retain every unacknowledged press in order', () => {
  const p = pair();
  p.guest.match.attack('punch');
  const overwritten = p.guest.match.input();
  p.guest.match.attack('uppercut');
  const latest = p.guest.match.input();
  assert.deepEqual(
    latest.commands.map((x) => x.kind),
    ['punch', 'uppercut']
  );
  p.host.match.receiveInput(latest);
  p.host.match.receiveInput(overwritten);
  p.step(1.3);
  assert.equal(p.host.snapshot().blue.health, 75);
  assert.equal(p.guest.match.input().commands.length, 0);
});

test('two human lethal hits on one tick draw, and neither device reveals it early', () => {
  const p = pair({ health: 10 });
  p.host.match.attack('punch');
  p.guest.match.attack('punch');
  p.step(0.5);
  assert.equal(p.host.snapshot().outcome, null);
  assert.equal(p.guest.snapshot().outcome, null);
  p.step(1.2);
  assert.equal(p.host.snapshot().outcome, 'draw');
  assert.equal(p.guest.snapshot().outcome, 'draw');
  assert.deepEqual(p.host.snapshot().wins, { blue: 0, red: 0 });
});

test('delayed launched knockout waits for the full guest flight and clips', () => {
  const p = pair({ health: 15 });
  p.host.match.attack('uppercut');
  p.step(0.5, false);
  p.step(4, false);
  assert.equal(p.host.snapshot().stage, 'presenting');
  assert.equal(p.guest.match.getTransform('red').lift, 0);
  p.step(0.4);
  assert.ok(p.guest.match.getTransform('red').lift > 0.17);
  p.step(1);
  assert.equal(p.host.snapshot().outcome, null);
  assert.equal(p.guest.snapshot().outcome, null);
  p.step(1);
  assert.equal(p.host.snapshot().stage, 'finished');
  assert.equal(p.guest.snapshot().stage, 'finished');
});

test('abandoned matches keep their reason through subsequent socket updates', () => {
  const p = pair();
  p.host.match.abandon('Recovery expired. No winner awarded.');
  p.exchange();
  assert.equal(p.host.snapshot().message, 'Recovery expired. No winner awarded.');
  assert.match(p.guest.snapshot().message, /No winner awarded/);
  p.host.match.setNetwork(true);
  assert.equal(p.host.snapshot().message, 'Recovery expired. No winner awarded.');
});

test('phase transitions flush immediately without waiting for the next 20 Hz write', async () => {
  const host = harness('host'),
    guest = harness('guest');
  const relay = fakeRelay();
  const config = { roomId: 'room', apiKey: 'test', projectId: 'test' };
  const hostNet = new ArenaNetwork(host.match, relay.port(), config, 'ABC234', () => 0);
  const guestNet = new ArenaNetwork(guest.match, relay.port(), config, 'ABC234', () => 0);
  hostNet.pump();
  guestNet.pump();
  host.match.abandon();
  await Promise.resolve();
  assert.equal(guest.snapshot().stage, 'abandoned');
  hostNet.close();
  guestNet.close();
});

test('guest frame cadence is measured while rendering host-authoritative combat', () => {
  const p = pair();
  for (let i = 0; i < 60; i++) p.guest.match.recordFrame(p.guest.token(), 1 / 30);
  assert.equal(p.guest.snapshot().fps, 30);
  p.guest.match.interrupt();
  p.guest.match.recordFrame(p.guest.token(), 1);
  assert.equal(p.guest.snapshot().frameSamples, 60);
});

test('public status exposes remote interruption and per-device presentation readiness', () => {
  const p = pair({ health: 10 });
  p.guest.match.setTracking(p.guest.token(), false);
  p.step(0.1);
  assert.match(p.host.snapshot().remotePauseReason, /tracking/i);
  assert.equal(p.host.snapshot().peerConnected, true);
  p.guest.match.setTracking(p.guest.token(), true);
  p.step(0.6);
  p.host.match.resume();
  p.guest.match.resume();
  p.step(0.1);
  p.host.match.attack('punch');
  p.step(3, false);
  assert.deepEqual(p.host.snapshot().presentationReady, { local: true, peer: false });
  assert.equal(p.guest.snapshot().presentationReady.local, false);
});

test('temporary OS inactivity freezes combat and requires stable tracking plus both Resume', () => {
  const p = pair();
  p.guest.match.attack('uppercut');
  p.step(0.2);
  p.guest.match.setAppActive(false);
  p.step(1);
  assert.equal(p.host.snapshot().stage, 'paused');
  assert.equal(p.host.snapshot().blue.health, 100);
  assert.match(p.host.snapshot().remotePauseReason, /App interrupted/);
  p.guest.match.setAppActive(true);
  assert.equal(p.guest.match.resume(), false);
  p.step(0.6);
  assert.equal(p.host.match.resume(), true);
  assert.equal(p.guest.match.resume(), true);
  p.step(1);
  assert.equal(p.host.snapshot().stage, 'fighting');
  assert.equal(p.host.snapshot().blue.health, 100);
});

test('a relay failure is not misreported as an expired room after thirty seconds', () => {
  let time = 0;
  const guest = new ArenaMatch('guest', 3, () => time);
  const relay = fakeRelay(); const client = relay.port();
  const net = new ArenaNetwork(guest, client, { roomId: 'test', apiKey: 'test', projectId: 'test' }, 'ABC234', () => time);
  client.state = 'failed'; client.error = 'replication socket gave up reconnecting'; client.emit();
  time = 31000; net.pump();
  assert.match(guest.getSnapshot().networkMessage, /Can’t reach the multiplayer server/);
  assert.doesNotMatch(guest.getSnapshot().networkMessage, /expired|socket/);
  client.state = 'connecting'; client.emit();
  assert.equal(guest.getSnapshot().networkMessage, 'Connecting to the multiplayer server…');
  net.close(); guest.dispose();
});
