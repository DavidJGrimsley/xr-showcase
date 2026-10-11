const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ARENA_RULES } = require('../src/features/arena-fighter/arena-controller.ts');
const { ArenaMatch } = require('../src/features/arena-fighter/arena-match.ts');
const { ArenaPrediction } = require('../src/features/arena-fighter/arena-prediction.ts');
const { ArenaNetwork } = require('../src/features/arena-fighter/arena-network.ts');
const { ArenaRemoteRoom } = require('../src/features/arena-fighter/arena-remote-room.ts');
const { validPacket, validInput } = require('../src/features/arena-fighter/arena-protocol.ts');
const { ArenaJoinIntent } = require('../src/features/arena-fighter/arena-join-intent.ts');
const { playsImpact } = require('../src/features/arena-fighter/arena-audio-policy.ts');
const { arenaHUDState } = require('../src/features/arena-fighter/arena-hud-state.ts');
const {
  remoteCodeFromUUID,
  normalizeRemoteCode,
  remoteRoomId,
  formatRemoteCode,
  inviteLink,
  parseArenaInvite,
} = require('../src/features/arena-fighter/arena-invite.ts');

function pair() {
  let now = 0;
  const clock = () => now;
  const host = new ArenaMatch('host', 3, clock, { cpuEnabled: false }, 'host', 'remote');
  const guest = new ArenaMatch('guest', 3, clock, { cpuEnabled: false }, 'guest', 'remote');
  const tokens = [host, guest].map((match) => {
    const token = match.attachSession(1);
    match.setLandscape(true);
    match.setTracking(token, true);
    match.setPlacement(token, true);
    for (const asset of ['arena', 'blue', 'red'])
      match.assetLoaded(token, match.getSnapshot().placementVersion, asset);
    return token;
  });
  function exchange() {
    host.setNetwork(true);
    guest.setNetwork(true);
    guest.receivePacket(host.packet());
    host.receiveInput(guest.input());
  }
  function tick(dt = 1 / 60) {
    now += dt * 1000;
    host.tick(tokens[0], dt);
    guest.tick(tokens[1], dt);
  }
  function step(seconds) {
    for (let i = 0; i < seconds * 60; i++) {
      exchange();
      tick();
    }
  }
  step(1);
  return {
    host,
    guest,
    tokens,
    exchange,
    tick,
    step,
    now: clock,
    advance: (ms) => {
      now += ms;
    },
  };
}
function fightingPair() {
  const p = pair();
  assert.equal(p.host.ready(), true);
  assert.equal(p.guest.ready(), true);
  p.step(4);
  assert.equal(p.host.getSnapshot().stage, 'fighting');
  assert.equal(p.guest.getSnapshot().stage, 'fighting');
  return p;
}
function port() {
  const listeners = new Set(),
    entities = new Map();
  return {
    state: 'idle',
    localPeerId: 'local',
    error: undefined,
    claims: [],
    writes: 0,
    entities,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    emit() {
      for (const fn of [...listeners]) fn();
    },
    connect() {
      this.state = 'synced';
      this.emit();
    },
    disconnect() {
      this.state = 'idle';
      this.emit();
    },
    get(id) {
      return entities.get(id);
    },
    claim(id) {
      this.claims.push(id);
      entities.set(id, { id, fields: {}, owner: 'local', version: 1 });
      this.emit();
    },
    set(id, fields) {
      this.writes++;
      entities.set(id, { ...entities.get(id), fields });
      this.emit();
    },
    release() {},
  };
}

test('remote invites normalize twelve characters, retain mode, and reject bad versions/modes', () => {
  const code = remoteCodeFromUUID('550e8400-e29b-41d4-a716-446655440000');
  assert.equal(code.length, 12);
  assert.equal(
    normalizeRemoteCode(formatRemoteCode(code).toLowerCase().replaceAll(' ', '-')),
    code
  );
  assert.equal(normalizeRemoteCode('ABC234'), null);
  assert.throws(() => remoteCodeFromUUID('invalid'));
  assert.throws(() => remoteRoomId('invalid'));
  const invite = { code, space: 'remote' };
  assert.deepEqual(parseArenaInvite(inviteLink(invite)), invite);
  assert.match(remoteRoomId(code), /^arena-remote-v1:/);
  assert.equal(parseArenaInvite(inviteLink(invite).replace('v=12', 'v=11')), null);
  assert.equal(parseArenaInvite(inviteLink(invite).replace('space=remote', 'space=unknown')), null);
  assert.deepEqual(parseArenaInvite(inviteLink({ code: 'ABC234', space: 'same-space' })), {
    code: 'ABC234',
    space: 'same-space',
  });
  const intent = new ArenaJoinIntent();
  assert.ok(intent.offer(invite));
  assert.equal(intent.take(true, true), null);
  assert.equal(intent.take(false, false), null);
  assert.deepEqual(intent.take(true, false), invite);
  assert.equal(intent.offer({ ...invite }), false);
});

test('both players transform locally; remote wire excludes placement and edits invalidate only local Ready', () => {
  const p = pair();
  assert.ok(p.host.ready());
  assert.ok(p.guest.ready());
  const epoch = p.host.packet().epoch;
  const hostScope = {
    sessionToken: p.tokens[0],
    placementVersion: p.host.getSnapshot().placementVersion,
  };
  const guestScope = {
    sessionToken: p.tokens[1],
    placementVersion: p.guest.getSnapshot().placementVersion,
  };
  p.host.setScale(hostScope, 0.8);
  p.host.setPosition(hostScope, 'x', 0.1);
  p.guest.setScale(guestScope, 1.2);
  p.guest.setYaw(guestScope, 90);
  p.exchange();
  assert.equal(p.host.getSnapshot().arenaTransform.scale, 0.8);
  assert.equal(p.guest.getSnapshot().arenaTransform.scale, 1.2);
  assert.equal(p.guest.getSnapshot().arenaTransform.yaw, 90);
  assert.equal(p.host.packet().epoch, epoch);
  assert.equal(p.host.getSnapshot().localReady, false);
  assert.equal(p.guest.getSnapshot().localReady, false);
  assert.ok(p.host.ready());
  assert.ok(p.guest.ready());
  p.guest.setHeight(guestScope, 0.03);
  p.exchange();
  assert.equal(p.guest.getSnapshot().localReady, false);
  assert.equal(p.host.getSnapshot().localReady, true);
  assert.equal(p.host.getSnapshot().peerReady, false);
  const packet = p.host.packet();
  assert.equal('placement' in packet, false);
  assert.equal('arenaTransform' in packet, false);
  assert.ok(validPacket(packet));
  assert.ok(validInput(p.guest.input()));
  assert.equal(validPacket({ ...packet, placement: null }), false);
  assert.equal(
    validPacket({ ...packet, arenaTransform: p.host.getSnapshot().arenaTransform }),
    false
  );
  const before = p.host.round.getTransform('blue');
  p.guest.swapSides();
  assert.deepEqual(p.host.round.getTransform('blue'), before);
  assert.equal(p.guest.getSnapshot().arenaTransform.yaw, -90);
  assert.equal(arenaHUDState(p.guest.getSnapshot(), { status: 'ready' }).transform, true);
});

test('local movement predicts before host input arrives, while combat remains authoritative', () => {
  const p = fightingPair();
  const before = p.guest.getTransform('red');
  const authoritative = p.host.round.getTransform('red');
  const health = p.guest.getSnapshot().blue.health;
  p.guest.setMovement('advance', true);
  p.tick();
  assert.ok(p.guest.getTransform('red').x < before.x);
  assert.deepEqual(p.host.round.getTransform('red'), authoritative);
  assert.equal(p.guest.getSnapshot().blue.health, health);
  assert.ok(p.guest.predictionDiagnostics().pendingSamples > 0);
  p.host.setAppActive(false);
  p.exchange();
  assert.equal(p.guest.getSnapshot().stage, 'paused');
  assert.equal(p.guest.predictionDiagnostics().pendingSamples, 0);
  assert.deepEqual(p.guest.getTransform('red'), p.host.packet().transforms.red);
});

test('remote combat locks snap to host poses, and only a host impact changes damage', () => {
  const p = fightingPair();
  p.guest.setMovement('advance', true);
  p.step(2);
  p.guest.setMovement('advance', false);
  p.exchange();
  const before = p.guest.getSnapshot().blue.health;
  assert.ok(p.guest.attack('punch'));
  p.tick();
  assert.equal(p.guest.getSnapshot().blue.health, before);
  assert.deepEqual(p.guest.getTransform('red'), p.host.packet().transforms.red);
  p.host.receiveInput(p.guest.input());
  let hit = false;
  for (let i = 0; i < 60; i++) {
    p.host.tick(p.tokens[0], 1 / 60);
    p.advance(1000 / 60);
    if (p.host.getSnapshot().blue.health < before) {
      hit = true;
      break;
    }
  }
  assert.equal(hit, true);
  assert.equal(p.guest.getSnapshot().blue.health, before);
  const impact = p.host.packet();
  p.guest.receivePacket(impact);
  assert.equal(p.guest.getSnapshot().blue.health, p.host.getSnapshot().blue.health);
  assert.deepEqual(p.guest.getTransform('red'), impact.transforms.red);
  assert.equal(p.guest.predictionDiagnostics().pendingSamples, 0);
  p.guest.receivePacket(impact);
  assert.equal(p.guest.getSnapshot().blue.health, p.host.getSnapshot().blue.health);
});

test('coalescing past hitstop still snaps prediction when either fighter has a new impact', () => {
  const p = fightingPair();
  p.guest.setMovement('advance', true);
  p.step(2);
  p.guest.setMovement('advance', false);
  p.exchange();
  assert.ok(p.host.round.command('punch', 'red'));
  p.guest.setMovement('strafeLeft', true);
  for (let i = 0; i < 48; i++) p.tick();
  assert.ok(p.guest.predictionDiagnostics().pendingSamples > 0);
  const packet = p.host.packet();
  assert.equal(packet.round.impactPauseRemaining, 0);
  assert.ok(packet.round.blue.impact);
  assert.equal(packet.round.red.mode, 'idle');
  p.guest.receivePacket(packet);
  assert.equal(p.guest.predictionDiagnostics().pendingSamples, 0);
  assert.deepEqual(p.guest.getTransform('red'), packet.transforms.red);
});

for (const rtt of [50, 150, 300, 500])
  test(`remote movement remains bounded with ${rtt} ms RTT, jitter, coalescing and duplicate input`, () => {
    const p = fightingPair();
    const queue = [];
    p.guest.setMovement('strafeLeft', true);
    let moved = false;
    const start = p.guest.getTransform('red');
    for (let i = 0; i < 240; i++) {
      if (i % 3 === 0 && !(i >= 90 && i < 108)) {
        const input = p.guest.input(),
          packet = p.host.packet();
        queue.push({ at: p.now() + rtt / 2 + (i % 4) * 15, input, packet });
      }
      for (let j = queue.length - 1; j >= 0; j--)
        if (queue[j].at <= p.now()) {
          const { input, packet } = queue.splice(j, 1)[0];
          p.host.receiveInput(input);
          p.host.receiveInput(input);
          p.guest.receivePacket(packet);
        }
      p.tick();
      const pose = p.guest.getTransform('red');
      moved ||= Math.hypot(pose.x - start.x, pose.z - start.z) > 0.0001;
      assert.ok(Number.isFinite(pose.x + pose.z + pose.yaw));
      assert.ok(Math.hypot(pose.x, pose.z) <= ARENA_RULES.boundary + 1e-7);
      assert.ok(p.guest.predictionDiagnostics().historySeconds <= 0.25 + 1e-7);
    }
    assert.ok(moved);
    assert.equal(p.guest.getSnapshot().blue.health, p.host.getSnapshot().blue.health);
    assert.equal(p.guest.getSnapshot().red.health, p.host.getSnapshot().red.health);
    p.guest.setMovement('strafeLeft', false);
    p.step(0.5);
    const actual = p.host.round.getTransform('red'),
      predicted = p.guest.getTransform('red');
    assert.ok(Math.hypot(actual.x - predicted.x, actual.z - predicted.z) < 0.002);
  });

test('prediction snaps on combat locks and large corrections; stale acknowledgements cannot rewind it', () => {
  const predictor = new ArenaPrediction();
  const poses = {
    blue: { x: -0.095, z: 0, lift: 0, yaw: 90 },
    red: { x: 0.095, z: 0, lift: 0, yaw: -90 },
  };
  predictor.reconcile(poses, { seq: 0, time: 0 }, 1, false);
  predictor.step(0.1, { advance: true, strafeLeft: false, strafeRight: false }, false);
  assert.ok(predictor.get().x < poses.red.x);
  predictor.reconcile(poses, { seq: 1, time: 0.1 }, 2, true);
  assert.equal(predictor.diagnostics().pendingSamples, 0);
  assert.equal(predictor.get().x, poses.red.x);
  const moved = { ...poses, red: { ...poses.red, z: 0.05 } };
  predictor.reconcile(moved, { seq: 1, time: 0.1 }, 3, false);
  assert.equal(predictor.get().z, 0.05);
  predictor.reconcile(poses, { seq: 0, time: 0 }, 2, false);
  assert.equal(predictor.get().z, 0.05);
});

test('ordinary prediction corrections blend over 100 ms and zero-length ticks cannot grow history', () => {
  const predictor = new ArenaPrediction();
  const poses = {
    blue: { x: -0.095, z: 0, lift: 0, yaw: 90 },
    red: { x: 0.095, z: 0, lift: 0, yaw: -90 },
  };
  predictor.reconcile(poses, { seq: 0, time: 0 }, 1, false);
  const corrected = { ...poses, red: { ...poses.red, z: 0.01 } };
  predictor.reconcile(corrected, { seq: 0, time: 0 }, 2, false);
  assert.equal(predictor.get().z, 0);
  const held = { advance: false, strafeLeft: false, strafeRight: false };
  for (let i = 0; i < 1000; i++) predictor.step(0, held, false);
  assert.equal(predictor.diagnostics().pendingSamples, 0);
  predictor.step(0.05, held, false);
  assert.ok(Math.abs(predictor.get().z - 0.005) < 1e-7);
  predictor.step(0.05, held, false);
  assert.ok(Math.abs(predictor.get().z - 0.01) < 1e-7);
});

test('a remote guest waits for fresh live host state before claiming; inactive/incompatible rooms fail safely', () => {
  const p = pair(),
    client = port();
  const packet = p.host.packet();
  const guest = new ArenaMatch('guest', 3, undefined, undefined, 'both', 'remote');
  client.entities.set('host', { owner: 'other', version: 1, fields: { packet } });
  const network = new ArenaNetwork(
    guest,
    client,
    { roomId: 'test', apiKey: 'test', projectId: 'test' },
    'test'
  );
  assert.deepEqual(client.claims, []);
  client.entities.get('host').fields.packet = p.host.packet();
  client.emit();
  network.pump();
  assert.deepEqual(client.claims, ['guest']);
  assert.ok(network.established);
  network.retry();
  client.emit();
  network.pump();
  assert.ok(network.established);
  network.close();
  for (const [change, message] of [
    [{ protocol: 11 }, /different app version/],
    [{ stage: 'finished' }, /inactive/],
    [
      { space: 'same-space', placement: null, arenaTransform: p.host.getSnapshot().arenaTransform },
      /same-table/,
    ],
  ]) {
    const c = port(),
      g = new ArenaMatch('guest', 3, undefined, undefined, 'both', 'remote');
    c.entities.set('host', { owner: 'host', fields: { packet: { ...packet, ...change } } });
    const n = new ArenaNetwork(g, c, { roomId: 'test', projectId: 'test' }, 'test');
    assert.match(g.getSnapshot().networkMessage, message);
    assert.deepEqual(c.claims, []);
    n.close();
  }
});

test('occupied remote seats and stale host state cannot be claimed by a new guest', () => {
  const p = pair(),
    client = port();
  const guest = new ArenaMatch('guest', 3, undefined, undefined, 'both', 'remote');
  client.entities.set('host', { owner: 'host', fields: { packet: p.host.packet() } });
  client.entities.set('guest', { owner: 'other-guest', fields: { clientId: 'other' } });
  const network = new ArenaNetwork(guest, client, { roomId: 'test', projectId: 'test' }, 'test');
  client.emit();
  network.pump();
  assert.deepEqual(client.claims, []);
  assert.equal(network.failure, false);
  client.entities.get('host').fields.packet = p.host.packet();
  client.emit();
  assert.equal(network.failure, true);
  assert.match(guest.getSnapshot().networkMessage, /Room full/);
  assert.deepEqual(client.claims, []);
  assert.equal(client.writes, 0);
  network.close();
});

test('a remote invitation is withheld until its initial publication is echoed, and startup can be cancelled', async () => {
  const p = pair(),
    client = port();
  client.set = () => {
    client.writes++;
  };
  const room = new ArenaRemoteRoom(p.host, { projectId: 'test' }, 'ABCDEFGHJKMN', client);
  const abort = new AbortController();
  let opened = false;
  const pending = room.open(abort.signal).then(() => {
    opened = true;
  });
  const rejected = assert.rejects(pending, /cancelled/);
  await Promise.resolve();
  assert.equal(opened, false);
  assert.equal(client.entities.get('host').fields.clientId, undefined);
  abort.abort();
  await rejected;
  assert.equal(client.state, 'idle');
});

test('remote placement survives relay retry; AR recreation clears only local placement and preserves match/transform', async () => {
  const p = pair(),
    client = port();
  const room = new ArenaRemoteRoom(
    p.host,
    { apiKey: 'test', projectId: 'test' },
    'ABCDEFGHJKMN',
    client
  );
  try {
    await room.open(new AbortController().signal);
    room.attach({});
    room.tracking(true);
    assert.ok(room.place([1, 2, 3]));
    assert.equal(room.getSnapshot().source, null);
    assert.equal(room.getSnapshot().frame, null);
    const preview = room.getSnapshot().preview;
    room.retry();
    assert.deepEqual(room.getSnapshot().preview, preview);
    room.prepareRestart();
    assert.equal(room.getSnapshot().preview, null);
    assert.equal(p.host.getSnapshot().stage, 'lobby');
    assert.equal(p.host.getSnapshot().arenaTransform.scale, 1);
    assert.equal(client.state, 'synced');
    const oldDetach = room.attach({});
    room.attach({});
    oldDetach();
    room.tracking(true);
    assert.ok(room.place([4, 5, 6]), 'obsolete cleanup cannot detach the new AR view');
  } finally {
    room.dispose();
  }
});

test('remote AR recreation preserves the fight and the other placement, and both players Resume', () => {
  const p = fightingPair();
  const health = { blue: p.host.getSnapshot().blue.health, red: p.host.getSnapshot().red.health };
  const roundId = p.host.getSnapshot().roundId;
  const session = p.host.session;
  p.guest.detachSession(p.tokens[1]);
  p.tokens[1] = p.guest.attachSession(2);
  p.guest.setTracking(p.tokens[1], true);
  p.step(0.6);
  assert.equal(p.host.getSnapshot().stage, 'paused');
  assert.equal(p.host.getSnapshot().placed, true);
  assert.equal(p.guest.getSnapshot().placed, false);
  assert.equal(p.guest.resume(), false);
  p.guest.setPlacement(p.tokens[1], true);
  for (const asset of ['arena', 'blue', 'red'])
    p.guest.assetLoaded(p.tokens[1], p.guest.getSnapshot().placementVersion, asset);
  p.step(0.6);
  assert.ok(p.host.resume());
  p.step(0.1);
  assert.equal(p.host.getSnapshot().stage, 'paused');
  assert.ok(p.guest.resume());
  p.step(0.3);
  assert.equal(p.host.getSnapshot().stage, 'fighting');
  assert.equal(p.guest.getSnapshot().stage, 'fighting');
  assert.equal(p.host.getSnapshot().roundId, roundId);
  assert.equal(p.guest.session, session);
  assert.deepEqual(
    { blue: p.host.getSnapshot().blue.health, red: p.host.getSnapshot().red.health },
    health
  );
  assert.equal(p.guest.predictionDiagnostics().correctionDistance, 0);
});

test('remote music and announcements use both phones; every impact is audible on each phone', () => {
  const p = pair();
  assert.equal(p.host.getSnapshot().mainAudioSource, 'both');
  assert.equal(p.guest.getSnapshot().mainAudioSource, 'both');
  for (const local of ['blue', 'red'])
    for (const receiver of ['blue', 'red'])
      assert.equal(playsImpact('remote', local, receiver), true);
});
