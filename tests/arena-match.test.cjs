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
  const match = new ArenaMatch(mode, rounds, now, {
    cpuEnabled: false,
    spawn: 0.04,
    punchHitstop: 0,
    uppercutHitstop: 0,
    ...rules,
  });
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

function earn(match, tick) {
  for (let i = 0; i < 3; i++) {
    assert.equal(match.attack('punch'), true);
    tick(0.7);
  }
  assert.equal(match.getSnapshot()[match.localFighter].uppercutReady, true);
}

test('solo starts only after Ready and countdown; results wait for applied knockout commands', () => {
  const h = harness('solo', 1, { health: 8 });
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
  h.tick(6.7);
  assert.equal(h.snapshot().stage, 'finished');
  assert.equal(h.snapshot().wins.blue, 1);
});

test('best of three ends at two wins, automatically advances, and rematch resets the series', () => {
  const h = harness('solo', 3, { health: 8 });
  h.match.ready();
  h.tick(3.1);
  h.match.attack('punch');
  h.tick(4);
  assert.equal(h.snapshot().stage, 'intermission');
  assert.deepEqual(h.snapshot().wins, { blue: 1, red: 0 });
  h.tick(5);
  assert.equal(h.snapshot().stage, 'fighting');
  assert.equal(h.snapshot().red.health, 8);
  h.match.attack('punch');
  h.tick(8);
  assert.equal(h.snapshot().stage, 'finished');
  assert.equal(h.snapshot().wins.blue, 2);
  h.tick(2.1);
  h.match.rematch();
  h.tick(3.2);
  assert.equal(h.snapshot().stage, 'fighting');
  assert.deepEqual(h.snapshot().wins, { blue: 0, red: 0 });
});

test('draws replay without advancing score; best of five needs three wins', () => {
  const h = harness('solo', 5, { health: 8 });
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
    h.tick(win === 3 ? 8 : 4);
    assert.equal(h.snapshot().stage, win === 3 ? 'finished' : 'intermission');
    if (win < 3) h.tick(5);
  }
});

test('finishing uppercut plays the full arc, defeat, and victory before showing results', () => {
  const h = harness('solo', 1, { health: 39 });
  h.match.ready();
  h.tick(3.1);
  earn(h.match, h.tick);
  h.match.attack('uppercut');
  h.tick(0.5);
  h.tick(0.4);
  assert.ok(h.match.getTransform('red').lift > 0.17);
  assert.equal(h.snapshot().outcome, null);
  h.tick(0.4);
  assert.equal(h.snapshot().red.clip, 'Defeat');
  h.tick(0.6);
  assert.equal(h.snapshot().outcome, null);
  h.tick(7.2);
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
  assert.equal(host.snapshot().blue.health, 92);
  assert.equal(guest.snapshot().blue.health, 92);
  assert.equal(guest.match.input().commands.length, 0);
});

function pair(rules = {}, rounds = 1) {
  let time = 0;
  const now = () => time;
  const host = harness('host', rounds, rules, now),
    guest = harness('guest', rounds, rules, now);
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

for (const rounds of [3, 5]) {
  for (const winner of ['blue', 'red']) {
    test(`best of ${rounds}: both phones give ${winner} one stretch for rounds and the full dance for the match`, () => {
      const p = pair({ health: 8 }, rounds);
      const winsNeeded = Math.ceil(rounds / 2);
      for (let win = 1; win <= winsNeeded; win++) {
        const dances = [new Set(), new Set()],
          uppercuts = [new Set(), new Set()];
        const final = win === winsNeeded;
        const player = winner === 'blue' ? p.host : p.guest;
        assert.ok(player.match.attack('punch'));
        for (let frame = 0; frame < 600; frame++) {
          p.step(1 / 60);
          for (const [i, device] of [p.host, p.guest].entries()) {
            const state = device.snapshot();
            if (state.stage !== 'presenting') continue;
            assert.equal(state.outcome, null);
            if (state[winner].clip === 'Victory') dances[i].add(state[winner].animationId);
            if (state[winner].clip === 'VictoryUppercut')
              uppercuts[i].add(state[winner].animationId);
          }
          if (['intermission', 'finished'].includes(p.guest.snapshot().stage)) break;
        }
        assert.equal(p.host.match.packet().knockout.matchVictory, final);
        for (const [i, device] of [p.host, p.guest].entries()) {
          assert.equal(dances[i].size, final ? 2 : 1);
          assert.equal(uppercuts[i].size, final ? 1 : 0);
          assert.equal(device.snapshot().stage, final ? 'finished' : 'intermission');
          assert.equal(device.snapshot().wins[winner], win);
        }
        if (!final) {
          assert.equal(p.host.match.ready(), false);
          p.step(2.1);
          assert.ok(p.host.match.ready());
          assert.ok(p.guest.match.ready());
          p.step(3.2);
          assert.equal(p.guest.snapshot().stage, 'fighting');
        }
      }
    });
  }
}

test('a short round celebration waits for the guest renderer before results and fresh Ready presses', () => {
  const p = pair({ health: 8 }, 3);
  p.host.match.attack('punch');
  p.step(4, false);
  assert.equal(p.host.snapshot().presentationReady.local, true);
  assert.equal(p.guest.snapshot().presentationReady.local, false);
  assert.equal(p.host.snapshot().stage, 'presenting');
  assert.equal(p.host.snapshot().outcome, null);
  const packet = p.host.match.packet();
  assert.equal(validPacket(packet), true);
  assert.equal(validPacket({ ...packet, protocol: 8 }), false);
  for (const matchVictory of [undefined, 'false', null])
    assert.equal(validPacket({ ...packet, knockout: { ...packet.knockout, matchVictory } }), false);
  p.step(3.5);
  assert.equal(p.guest.snapshot().stage, 'intermission');
  p.step(20);
  assert.equal(p.host.snapshot().stage, 'intermission');
  assert.equal(p.guest.snapshot().stage, 'intermission');
});

test('host waits for a delayed guest knockout presentation before either result appears', () => {
  const p = pair({ health: 8 });
  p.host.match.attack('punch');
  p.step(4, false);
  assert.equal(p.host.snapshot().stage, 'presenting');
  assert.equal(p.guest.snapshot().outcome, null);
  p.step(8);
  assert.equal(p.host.snapshot().stage, 'finished');
  assert.equal(p.guest.snapshot().stage, 'finished');
});

test('multiplayer results persist until both players freshly Ready before every round', () => {
  const p = pair({ health: 8 }, 3);
  p.host.match.attack('punch');
  p.step(8);
  assert.equal(p.host.snapshot().stage, 'intermission');
  assert.equal(p.guest.snapshot().stage, 'intermission');
  assert.equal(p.host.snapshot().localReady, false);
  assert.equal(p.guest.snapshot().localReady, false);
  p.step(10);
  assert.equal(p.host.snapshot().outcome, 'blue');
  assert.equal(p.host.snapshot().stage, 'intermission');
  assert.equal(p.host.match.ready(), true);
  p.step(4);
  assert.equal(p.host.snapshot().stage, 'intermission');
  assert.equal(p.guest.match.ready(), true);
  p.step(0.1);
  assert.equal(p.host.snapshot().stage, 'countdown');
  assert.equal(p.guest.snapshot().stage, 'countdown');
  assert.equal(p.host.snapshot().outcome, null);
  p.step(3.1);
  assert.equal(p.host.snapshot().stage, 'fighting');
  assert.equal(p.host.snapshot().red.health, 8);
});

test('finished host transforms preserve placement and invalidate both rematch Ready presses', () => {
  const p = pair({ health: 8 });
  p.host.match.attack('punch');
  p.step(8);
  p.step(2.1);
  const scope = {
    sessionToken: p.host.token(),
    placementVersion: p.host.snapshot().placementVersion,
  };
  assert.equal(p.host.snapshot().canTransform, true);
  assert.equal(p.guest.snapshot().canTransform, false);
  const version = scope.placementVersion;
  p.guest.match.rematch();
  p.step(0.1);
  p.host.match.invalidatePlacementReady();
  p.host.match.setScale(scope, 1.5);
  p.host.match.setPosition(scope, 'x', 0.2);
  p.step(0.1);
  assert.equal(p.host.snapshot().stage, 'finished');
  assert.equal(p.guest.snapshot().localReady, false);
  assert.equal(p.host.snapshot().placementVersion, version);
  assert.equal(p.host.snapshot().placed, true);
  assert.equal(p.guest.snapshot().arenaTransform.scale, 1.5);
  assert.equal(p.guest.snapshot().arenaTransform.x, 0.2);
  p.host.match.rematch();
  p.step(4);
  assert.equal(p.host.snapshot().stage, 'finished');
  p.guest.match.rematch();
  p.step(3.2);
  assert.equal(p.host.snapshot().stage, 'fighting');
  assert.deepEqual(p.host.snapshot().wins, { blue: 0, red: 0 });
});

test('solo rematch transforms apply immediately and reject stale editor scopes', () => {
  const h = harness('solo', 1, { health: 8 });
  h.match.ready();
  h.tick(3.1);
  h.match.attack('punch');
  h.tick(8);
  const scope = { sessionToken: h.token(), placementVersion: h.snapshot().placementVersion };
  assert.equal(h.snapshot().canTransform, true);
  h.match.setYaw(scope, 45);
  assert.equal(h.snapshot().arenaTransform.yaw, 45);
  h.replace();
  h.match.setYaw(scope, 90);
  assert.equal(h.snapshot().arenaTransform.yaw, 45);
});

test('tracking interruption cancels pending attacks, clears punch progress, and both must Resume', () => {
  const p = pair();
  p.guest.match.attack('punch');
  p.step(0.2);
  p.guest.match.setTracking(p.guest.token(), false);
  p.step(0.1);
  assert.equal(p.host.snapshot().stage, 'paused');
  const remaining = p.host.snapshot().red.punchProgress;
  p.step(2);
  assert.equal(p.host.snapshot().red.punchProgress, remaining);
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
  p.guest.match.attack('punch');
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
  const packet = p.host.match.packet();
  assert.equal(validPacket({ ...packet, protocol: 2 }), false);
  assert.equal(
    validPacket({ ...packet, arenaTransform: { ...packet.arenaTransform, x: NaN } }),
    false
  );
  assert.equal(
    validPacket({
      ...packet,
      round: { ...packet.round, red: { ...packet.round.red, uppercutWindowRemaining: -1 } },
    }),
    false
  );
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
  assert.equal(host.snapshot().blue.health, 92);
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
  assert.equal(host.snapshot().blue.health, 92);
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
  assert.equal(p.guest.snapshot().blue.health, 92);
  p.host.match.receiveInput(oldInput);
  p.step(1);
  assert.equal(p.host.snapshot().blue.health, 92);
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
  assert.equal(p.host.snapshot().blue.health, 92);
});

test('both players must opt into a rematch after a synchronized result', () => {
  const p = pair({ health: 8 });
  p.host.match.attack('punch');
  p.step(8);
  p.step(2.1);
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
  const p = pair({ health: 39 });
  earn(p.host.match, p.step);
  p.host.match.attack('uppercut');
  p.step(0.8);
  p.guest.replace();
  p.step(0.6);
  assert.equal(p.host.snapshot().stage, 'paused');
  p.host.match.resume();
  p.guest.match.resume();
  p.step(0.2, false);
  assert.equal(p.guest.snapshot().outcome, null);
  p.step(9);
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

test('coalesced ordinary attacks retain distinct start and follow-up presses in order', () => {
  const p = pair();
  p.guest.match.attack('punch');
  const overwritten = p.guest.match.input();
  p.guest.match.attack('punch');
  const latest = p.guest.match.input();
  assert.deepEqual(
    latest.commands.map((x) => x.kind),
    ['punch', 'punch']
  );
  p.host.match.receiveInput(latest);
  p.host.match.receiveInput(overwritten);
  p.step(1.3);
  assert.equal(p.host.snapshot().blue.health, 84);
  assert.equal(p.guest.match.input().commands.length, 0);
});

test('two human lethal hits on one tick draw, and neither device reveals it early', () => {
  const p = pair({ health: 8 });
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
  const p = pair({ health: 39 });
  earn(p.host.match, p.step);
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
  p.step(7.2);
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
  const p = pair({ health: 8 });
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
  p.step(8, false);
  assert.deepEqual(p.host.snapshot().presentationReady, { local: true, peer: false });
  assert.equal(p.guest.snapshot().presentationReady.local, false);
});

test('temporary OS inactivity freezes combat and requires stable tracking plus both Resume', () => {
  const p = pair();
  p.guest.match.attack('punch');
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
  const relay = fakeRelay();
  const client = relay.port();
  const net = new ArenaNetwork(
    guest,
    client,
    { roomId: 'test', apiKey: 'test', projectId: 'test' },
    'ABC234',
    () => time
  );
  client.state = 'failed';
  client.error = 'replication socket gave up reconnecting';
  client.emit();
  time = 31000;
  net.pump();
  assert.match(guest.getSnapshot().networkMessage, /Can’t reach the multiplayer server/);
  assert.doesNotMatch(guest.getSnapshot().networkMessage, /expired|socket/);
  client.state = 'connecting';
  client.emit();
  assert.equal(guest.getSnapshot().networkMessage, 'Connecting to the multiplayer server…');
  net.close();
  guest.dispose();
});

test('portrait freezes an accepted earned uppercut without replacing the session or cancelling its hit', () => {
  const h = harness();
  h.match.ready();
  h.tick(3.1);
  earn(h.match, h.tick);
  h.match.attack('uppercut');
  h.tick(0.2);
  const before = h.snapshot(),
    position = h.match.getTransform('blue');
  h.match.setMovement('advance', true);
  h.match.setLandscape(false);
  h.tick(40);
  assert.equal(h.snapshot().stage, 'fighting');
  assert.equal(h.snapshot().sessionToken, before.sessionToken);
  assert.equal(h.snapshot().placementVersion, before.placementVersion);
  assert.equal(h.snapshot().blue.animationId, before.blue.animationId);
  assert.equal(h.snapshot().blue.punchProgress, before.blue.punchProgress);
  assert.equal(h.snapshot().red.health, 76);
  assert.deepEqual(h.match.getTransform('blue'), position);
  assert.equal(h.snapshot().animationsRunning, false);
  h.match.setLandscape(true);
  h.tick(0.4);
  assert.equal(h.snapshot().orientationPaused, true);
  h.tick(0.1);
  assert.equal(h.snapshot().orientationPaused, false);
  h.tick(0.3);
  assert.equal(h.snapshot().red.health, 61);
  h.tick(1);
  assert.ok(Math.abs(h.match.getTransform('blue').x) < Math.abs(position.x));
});

test('portrait preserves the partially elapsed first countdown instead of restarting it', () => {
  const h = harness();
  h.match.ready();
  h.tick(1);
  const remaining = h.snapshot().countdown;
  h.match.setLandscape(false);
  h.tick(40);
  assert.equal(h.snapshot().stage, 'countdown');
  assert.equal(h.snapshot().countdown, remaining);
  h.match.setLandscape(true);
  h.tick(0.5);
  assert.equal(h.snapshot().countdown, remaining);
  h.tick(2.1);
  assert.equal(h.snapshot().stage, 'fighting');
});

for (const attack of ['punch', 'uppercut']) {
  test(`both devices freeze ${attack} knockout playback during a long portrait hold, then finish before results`, () => {
    const p = pair({ health: attack === 'punch' ? 8 : 39 });
    if (attack === 'uppercut') earn(p.host.match, p.step);
    p.host.match.attack(attack);
    p.step(attack === 'punch' ? 0.4 : 0.6);
    assert.equal(p.host.snapshot().stage, 'presenting');
    p.guest.match.setLandscape(false);
    p.exchange();
    const lift = p.host.match.getTransform('red').lift;
    p.step(40);
    assert.equal(p.host.snapshot().stage, 'presenting');
    assert.equal(p.guest.snapshot().stage, 'presenting');
    assert.equal(p.host.snapshot().outcome, null);
    assert.equal(p.guest.snapshot().outcome, null);
    assert.equal(p.host.match.getTransform('red').lift, lift);
    assert.equal(p.host.snapshot().animationsRunning, false);
    p.guest.match.setLandscape(true);
    p.step(0.4);
    assert.equal(p.host.snapshot().outcome, null);
    p.step(0.3);
    assert.equal(p.host.snapshot().outcome, null);
    p.step(9);
    assert.equal(p.host.snapshot().stage, 'finished');
    assert.equal(p.guest.snapshot().stage, 'finished');
  });
}

test('host portrait holds both humans; landscape recovery waits for both phones without new Ready taps', () => {
  const p = pair();
  p.host.match.setLandscape(false);
  p.guest.match.setLandscape(false);
  p.step(35);
  assert.equal(p.host.snapshot().stage, 'fighting');
  p.host.match.setLandscape(true);
  p.step(1);
  assert.equal(p.host.snapshot().orientationPaused, true);
  p.guest.match.setLandscape(true);
  p.step(0.6);
  assert.equal(p.host.snapshot().orientationPaused, false);
  assert.equal(p.guest.snapshot().orientationPaused, false);
  assert.equal(p.host.snapshot().animationsRunning, true);
});

test('genuine network loss during portrait still uses the recovery timeout', () => {
  const p = pair();
  p.guest.match.setLandscape(false);
  p.step(0.1);
  p.unlink();
  p.step(1.1);
  assert.equal(p.host.snapshot().stage, 'paused');
  p.step(30.1);
  assert.equal(p.host.snapshot().stage, 'abandoned');
  assert.equal(p.guest.snapshot().stage, 'abandoned');
});

test('transforms clamp values, preserve fighter-local distances, reject stale scopes and lock at the first countdown', () => {
  const h = harness();
  const scope = { sessionToken: h.token(), placementVersion: h.snapshot().placementVersion };
  const local = h.match.getTransform('blue');
  assert.equal(h.snapshot().canTransform, true);
  h.match.setScale(scope, 7);
  h.match.setYaw(scope, 450);
  h.match.setHeight(scope, 10);
  assert.deepEqual(h.snapshot().arenaTransform, { scale: 3, yaw: 90, height: 1.524, x: 0, z: 0 });
  h.match.setPosition(scope, 'x', -10);
  h.match.setPosition(scope, 'z', 10);
  assert.equal(h.snapshot().arenaTransform.x, -1.524);
  assert.equal(h.snapshot().arenaTransform.z, 1.524);
  assert.deepEqual(h.match.getTransform('blue'), local);
  h.match.setScale(scope, NaN);
  h.match.setHeight({ ...scope, sessionToken: scope.sessionToken + 1 }, 0);
  h.match.setPosition({ ...scope, placementVersion: scope.placementVersion + 1 }, 'x', 0);
  h.match.setPosition(scope, 'z', Infinity);
  h.match.setPosition(scope, 'yaw', 0);
  assert.equal(h.snapshot().arenaTransform.x, -1.524);
  assert.equal(h.snapshot().arenaTransform.z, 1.524);
  assert.equal(h.snapshot().arenaTransform.height, 1.524);
  h.match.pinch(scope, 1, 1);
  h.match.pinch(scope, 2, 0.2);
  h.match.pinch(scope, 3, 0.2);
  assert.ok(Math.abs(h.snapshot().arenaTransform.scale - 0.6) < 1e-7);
  h.match.rotate(scope, 1, 0);
  h.match.rotate(scope, 3, 90);
  assert.equal(h.snapshot().arenaTransform.yaw, 0);
  h.match.ready();
  h.tick(0.1);
  assert.equal(h.snapshot().canTransform, false);
  const fixed = h.snapshot().arenaTransform;
  h.match.setScale(scope, 1);
  h.match.setPosition(scope, 'x', 0);
  assert.deepEqual(h.snapshot().arenaTransform, fixed);
});

test('guest cannot edit shared transforms and host changes invalidate both Ready confirmations', () => {
  const host = harness('host'),
    guest = harness('guest');
  host.match.setNetwork(true);
  guest.match.setNetwork(true);
  guest.match.receivePacket(host.match.packet());
  host.match.receiveInput(guest.match.input());
  host.match.ready();
  guest.match.ready();
  host.match.receiveInput(guest.match.input());
  const scope = { sessionToken: host.token(), placementVersion: host.snapshot().placementVersion };
  host.match.setPosition(scope, 'x', 0.2);
  host.match.setPosition(scope, 'y', 0.3);
  host.match.setPosition(scope, 'z', -0.1);
  host.match.setScale(scope, 1.5);
  guest.match.receivePacket(host.match.packet());
  assert.equal(host.snapshot().localReady, false);
  assert.equal(host.snapshot().peerReady, false);
  assert.equal(guest.snapshot().localReady, false);
  assert.equal(guest.snapshot().arenaTransform.scale, 1.5);
  assert.deepEqual(guest.snapshot().arenaTransform, {
    scale: 1.5,
    yaw: 0,
    height: 0.3,
    x: 0.2,
    z: -0.1,
  });
  guest.match.setPosition(
    { sessionToken: guest.token(), placementVersion: guest.snapshot().placementVersion },
    'x',
    -0.5
  );
  assert.equal(guest.snapshot().arenaTransform.x, 0.2);
  guest.match.setScale(
    { sessionToken: guest.token(), placementVersion: guest.snapshot().placementVersion },
    2
  );
  assert.equal(guest.snapshot().arenaTransform.scale, 1.5);
  host.match.setTransformLocked(true);
  host.match.setScale(scope, 2);
  assert.equal(host.snapshot().canTransform, false);
  assert.equal(host.snapshot().arenaTransform.scale, 1.5);
});

test('a guest finisher and its uppercut cue come from the host and freeze during portrait', () => {
  const p = pair();
  for (let punch = 0; punch < 2; punch++) {
    p.guest.match.attack('punch');
    p.step(0.65);
  }
  p.guest.match.attack('punch');
  p.step(0.35);
  assert.equal(p.host.snapshot().blue.health, 76);
  assert.equal(p.guest.snapshot().blue.mode, 'hit');
  assert.ok(p.guest.snapshot().red.uppercutWindowRemaining > 0);
  p.guest.match.setLandscape(false);
  p.step(40);
  assert.equal(p.host.snapshot().stage, 'fighting');
  const frozen = p.host.snapshot().red.uppercutWindowRemaining;
  assert.ok(frozen > 0);
  assert.equal(p.guest.snapshot().red.uppercutWindowRemaining, frozen);
  p.guest.match.setLandscape(true);
  p.step(0.6);
  assert.equal(p.guest.match.attack('uppercut'), true);
  // The portrait hold preserves the unfinished punch; its buffered uppercut must finish winding up.
  p.step(0.85);
  assert.equal(p.host.snapshot().blue.health, 61);
  assert.equal(p.guest.snapshot().blue.health, 61);
  assert.equal(p.guest.snapshot().red.uppercutWindowRemaining, 0);
});

test('the host rejects a forged unearned Uppercut even when a guest bypasses its controls', () => {
  const p = pair();
  assert.equal(p.guest.match.attack('uppercut'), false);
  const input = p.guest.match.input();
  p.host.match.receiveInput({
    ...input,
    commands: [
      {
        seq: 1,
        epoch: input.epoch,
        matchId: input.matchId,
        roundId: input.roundId,
        kind: 'uppercut',
      },
    ],
  });
  p.host.tick(0.6);
  assert.equal(p.host.snapshot().blue.health, 100);
  assert.equal(p.host.snapshot().red.clip, 'IdleAggro');
});

test('earned guest Uppercut is pending once, launches on both devices, then recovers without replay', () => {
  const p = pair();
  earn(p.guest.match, p.step);
  assert.equal(p.host.snapshot().red.punchProgress, 3);
  assert.equal(p.guest.snapshot().red.punchProgress, 3);
  p.host.match.takeImpacts();
  p.guest.match.takeImpacts();
  assert.equal(p.guest.match.attack('uppercut'), true);
  assert.equal(p.guest.snapshot().uppercutPending, true);
  assert.equal(p.guest.match.attack('uppercut'), false);
  const duplicate = p.guest.match.input();
  p.step(0.55);
  p.host.match.receiveInput(duplicate);
  assert.equal(p.host.snapshot().blue.health, 61);
  assert.equal(p.guest.snapshot().blue.health, 61);
  assert.equal(p.host.snapshot().blue.mode, 'launch');
  assert.equal(p.guest.snapshot().blue.mode, 'launch');
  assert.equal(p.guest.snapshot().uppercutPending, false);
  for (const device of [p.host, p.guest]) {
    const events = device.match.takeImpacts();
    assert.equal(events.length, 1);
    assert.equal(events[0].impact.kind, 'uppercut');
    assert.deepEqual(device.match.takeImpacts(), []);
  }
  const packet = p.host.match.packet();
  p.guest.match.receivePacket(packet);
  p.guest.match.receivePacket(packet);
  assert.deepEqual(p.guest.match.takeImpacts(), []);
  p.step(1.5);
  assert.equal(p.host.snapshot().blue.mode, 'idle');
  assert.equal(p.guest.snapshot().blue.mode, 'idle');
  assert.equal(p.host.snapshot().blue.health, 61);
  assert.equal(p.guest.snapshot().blue.punchProgress, 0);
});

test('nonlethal launch freezes during portrait and genuine interruption, then resumes on both phones', () => {
  const p = pair();
  earn(p.host.match, p.step);
  p.host.match.attack('uppercut');
  p.step(0.7);
  p.guest.match.setLandscape(false);
  p.step(0.1);
  const lift = p.host.match.getTransform('red').lift;
  p.step(5);
  assert.equal(p.host.match.getTransform('red').lift, lift);
  p.guest.match.setLandscape(true);
  p.step(0.6);
  p.guest.match.setTracking(p.guest.token(), false);
  p.step(0.1);
  const mode = p.host.snapshot().red.mode,
    transform = p.host.match.getTransform('red');
  p.step(2);
  assert.deepEqual(p.host.match.getTransform('red'), transform);
  assert.equal(p.host.snapshot().red.mode, mode);
  p.guest.match.setTracking(p.guest.token(), true);
  p.step(0.6);
  p.host.match.resume();
  p.guest.match.resume();
  p.step(2);
  assert.equal(p.host.snapshot().red.health, 61);
  assert.equal(p.guest.snapshot().red.health, 61);
  assert.equal(p.host.snapshot().red.mode, 'idle');
  assert.equal(p.guest.snapshot().red.mode, 'idle');
});

test('reward expiry and damage-reset progress are authoritative and synchronized', () => {
  const p = pair();
  earn(p.guest.match, p.step);
  p.step(1.1);
  for (const device of [p.host, p.guest]) {
    assert.equal(device.snapshot().red.punchProgress, 0);
    assert.equal(device.snapshot().red.uppercutReady, false);
  }
  assert.equal(p.guest.match.attack('uppercut'), false);
  p.step(0.6);
  p.host.match.attack('punch');
  p.step(0.9);
  assert.equal(p.guest.snapshot().blue.punchProgress, 1);
  p.guest.match.attack('punch');
  p.step(0.4);
  assert.equal(p.host.snapshot().blue.punchProgress, 0);
  assert.equal(p.guest.snapshot().blue.punchProgress, 0);
});

test('protocol 12 rejects invalid progress, availability, flight, pause and impact fields', () => {
  const p = pair();
  const packet = p.host.match.packet();
  assert.equal(packet.protocol, 12);
  assert.equal(validPacket({ ...packet, protocol: 3 }), false);
  assert.equal(validPacket({ ...packet, protocol: 9 }), false);
  assert.equal(validInput({ ...p.guest.match.input(), protocol: 9 }), false);
  for (const patch of [
    { punchProgress: 4 },
    { punchProgress: -1 },
    { uppercutReady: true },
    { punchProgress: 2, uppercutReady: true, uppercutWindowRemaining: 0.45 },
    { motionElapsed: NaN },
    { impact: { id: 1, kind: 'win', hand: 'L', x: 0 } },
  ]) {
    assert.equal(
      validPacket({
        ...packet,
        round: { ...packet.round, blue: { ...packet.round.blue, ...patch } },
      }),
      false
    );
  }
  assert.equal(
    validPacket({
      ...packet,
      round: {
        ...packet.round,
        blue: {
          ...packet.round.blue,
          punchProgress: 3,
          uppercutReady: true,
          uppercutWindowRemaining: 0.45,
        },
      },
    }),
    true
  );
  assert.equal(
    validPacket({ ...packet, round: { ...packet.round, impactPauseRemaining: -1 } }),
    false
  );
  assert.equal(parseJoinLink('xr-showcase://arena-fighter?join=ABC234&v=3'), null);
});

test('impact transitions bypass the ordinary 20 Hz write interval exactly once', async () => {
  let time = 0;
  const now = () => time;
  const host = harness('host', 1, { punchHitstop: 0.035 }, now),
    guest = harness('guest', 1, {}, now);
  const relay = fakeRelay(),
    port = relay.port(),
    config = { roomId: 'room', apiKey: 'test', projectId: 'test' };
  const net = new ArenaNetwork(host.match, port, config, 'ABC234', now);
  const guestNet = new ArenaNetwork(guest.match, relay.port(), config, 'ABC234', now);
  function step(seconds) {
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      time += 1000 / 60;
      net.pump();
      guestNet.pump();
      host.tick(1 / 60);
      guest.tick(1 / 60);
    }
  }
  step(0.3);
  host.match.ready();
  guest.match.ready();
  step(3.2);
  await Promise.resolve();
  net.pump();
  assert.equal(host.match.attack('punch'), true);
  // Hold transport time constant: ordinary write pacing cannot account for this flush.
  host.tick(0.3);
  assert.equal(host.snapshot().red.health, 92);
  const writes = port.writes;
  await Promise.resolve();
  assert.equal(port.writes, writes + 1);
  assert.equal(relay.entities.get('host').fields.packet.round.red.impact.kind, 'punch');
  net.pump();
  assert.equal(port.writes, writes + 1);
  net.close();
  guestNet.close();
});

test('guest interpolation stops at the authoritative contact pose throughout hitstop', () => {
  const p = pair({ uppercutHitstop: 0.07 });
  earn(p.host.match, p.step);
  p.host.match.attack('uppercut');
  p.host.tick(29 / 60);
  p.exchange();
  const packet = p.host.match.packet();
  assert.equal(p.guest.snapshot().impactPauseRemaining, 0.07);
  for (const id of ['blue', 'red'])
    assert.deepEqual(p.guest.match.getTransform(id), packet.transforms[id]);
  p.guest.tick(3 / 60);
  assert.ok(p.guest.snapshot().impactPauseRemaining > 0);
  for (const id of ['blue', 'red'])
    assert.deepEqual(p.guest.match.getTransform(id), packet.transforms[id]);
  p.step(1);
  assert.equal(p.guest.snapshot().red.mode, 'landing');
  assert.equal(p.guest.match.getTransform('red').lift, 0);
});

test('both devices play two stretches and one Uppercut after defeat without early result text', () => {
  const p = pair({ health: 8 });
  const dances = [new Set(), new Set()];
  const uppercuts = [new Set(), new Set()];
  p.host.match.attack('punch');
  for (let frame = 0; frame < 600 && p.guest.snapshot().stage !== 'finished'; frame++) {
    p.step(1 / 60);
    for (const [index, device] of [p.host, p.guest].entries()) {
      const state = device.snapshot();
      if (state.stage !== 'presenting') continue;
      assert.equal(state.outcome, null);
      assert.doesNotMatch(state.message, /won|match complete/i);
      if (state.blue.clip === 'Victory') {
        assert.equal(state.red.clip, 'DefeatedLoop');
        dances[index].add(state.blue.animationId);
      }
      if (state.blue.clip === 'VictoryUppercut') {
        assert.equal(state.red.clip, 'DefeatedLoop');
        assert.equal(dances[index].size, 2);
        uppercuts[index].add(state.blue.animationId);
      }
    }
  }
  for (const [index, device] of [p.host, p.guest].entries()) {
    assert.equal(dances[index].size, 2);
    assert.equal(uppercuts[index].size, 1);
    assert.equal(device.snapshot().stage, 'finished');
    assert.equal(device.snapshot().outcome, 'blue');
    assert.equal(device.snapshot().blue.clip, 'IdleAggro');
  }
});

test('a delayed guest second dance blocks results even after the host celebration ends', () => {
  const p = pair({ health: 8 });
  p.host.match.attack('punch');
  p.step(3.45);
  const first = p.guest.snapshot().blue.animationId;
  p.step(0.25, false);
  assert.notEqual(p.guest.snapshot().blue.animationId, first);
  assert.equal(p.guest.snapshot().blue.clip, 'Victory');
  p.step(5, false);
  assert.equal(p.host.snapshot().presentationReady.local, true);
  for (const device of [p.host, p.guest]) {
    assert.equal(device.snapshot().outcome, null);
    assert.doesNotMatch(device.snapshot().message, /won|match complete/i);
  }
  p.step(2.25);
  assert.equal(p.guest.snapshot().blue.clip, 'Victory');
  assert.equal(p.host.snapshot().outcome, null);
  p.step(0.2);
  assert.equal(p.guest.snapshot().blue.clip, 'VictoryUppercut');
  for (const device of [p.host, p.guest]) {
    assert.equal(device.snapshot().outcome, null);
    assert.doesNotMatch(device.snapshot().message, /won|match complete/i);
  }
  p.step(1.7);
  assert.equal(p.host.snapshot().stage, 'presenting');
  p.step(0.4);
  assert.equal(p.host.snapshot().stage, 'finished');
  assert.equal(p.guest.snapshot().stage, 'finished');
});

test('a delayed guest Uppercut waits for its own acknowledgment and full duration despite repeated packets', () => {
  const p = pair({ health: 8 });
  p.host.match.attack('punch');
  p.step(5.75);
  assert.equal(p.guest.snapshot().blue.clip, 'Victory');
  p.step(0.2, false);
  assert.equal(p.guest.snapshot().blue.clip, 'VictoryUppercut');
  const id = p.guest.snapshot().blue.animationId;
  p.step(3, false);
  assert.equal(p.host.snapshot().presentationReady.local, true);
  assert.equal(p.guest.snapshot().presentationReady.local, false);
  for (let i = 0; i < 4; i++) p.guest.match.receivePacket(p.host.match.packet());
  assert.equal(p.guest.snapshot().blue.animationId, id);
  p.step(1.8);
  for (const device of [p.host, p.guest]) {
    assert.equal(device.snapshot().stage, 'presenting');
    assert.equal(device.snapshot().outcome, null);
    assert.doesNotMatch(device.snapshot().message, /won|match complete/i);
  }
  assert.equal(p.guest.snapshot().blue.clip, 'VictoryUppercut');
  p.step(0.3);
  assert.equal(p.host.snapshot().stage, 'finished');
  assert.equal(p.guest.snapshot().stage, 'finished');
});

test('portrait freezes the final Uppercut on both devices and keeps results hidden', () => {
  const p = pair({ health: 8 });
  p.host.match.attack('punch');
  p.step(6.25);
  const id = p.host.snapshot().blue.animationId;
  assert.equal(p.host.snapshot().blue.clip, 'VictoryUppercut');
  p.guest.match.setLandscape(false);
  p.exchange();
  p.step(40);
  for (const device of [p.host, p.guest]) {
    assert.equal(device.snapshot().blue.clip, 'VictoryUppercut');
    assert.equal(device.snapshot().outcome, null);
    assert.equal(device.snapshot().animationsRunning, false);
  }
  assert.equal(p.host.snapshot().blue.animationId, id);
  p.guest.match.setLandscape(true);
  p.step(0.6);
  p.step(1.3);
  assert.equal(p.host.snapshot().stage, 'presenting');
  assert.equal(p.host.snapshot().outcome, null);
  p.step(0.4);
  assert.equal(p.host.snapshot().stage, 'finished');
  assert.equal(p.guest.snapshot().stage, 'finished');
});

test('portrait freezes the dance and result visibility, then resumes both stretches and Uppercut', () => {
  const p = pair({ health: 8 });
  p.host.match.attack('punch');
  p.step(1.5);
  assert.equal(p.host.snapshot().blue.clip, 'Victory');
  const first = p.host.snapshot().blue.animationId;
  p.guest.match.setLandscape(false);
  p.exchange();
  p.step(40);
  assert.equal(p.host.snapshot().blue.animationId, first);
  assert.equal(p.host.snapshot().outcome, null);
  assert.equal(p.guest.snapshot().outcome, null);
  p.guest.match.setLandscape(true);
  p.step(0.6);
  p.step(1.8);
  assert.equal(p.host.snapshot().blue.animationId, first);
  p.step(0.2);
  assert.notEqual(p.host.snapshot().blue.animationId, first);
  assert.equal(p.host.snapshot().blue.clip, 'Victory');
  assert.equal(p.host.snapshot().outcome, null);
  p.step(2.5);
  assert.equal(p.host.snapshot().blue.clip, 'VictoryUppercut');
  assert.equal(p.host.snapshot().outcome, null);
  p.step(2);
  assert.equal(p.host.snapshot().stage, 'finished');
  assert.equal(p.guest.snapshot().stage, 'finished');
});

test('coalesced Block-down, Block-up and Punch preserve command order and lowering buffer', () => {
  const p = pair();
  assert.ok(p.guest.match.block(true));
  assert.ok(p.guest.match.block(false));
  assert.ok(p.guest.match.attack('punch'));
  const input = p.guest.match.input();
  assert.deepEqual(
    input.commands.map((c) => c.kind),
    ['block-down', 'block-up', 'punch']
  );
  assert.ok(validInput(input));
  p.host.match.receiveInput({ ...input, commands: [...input.commands].reverse() });
  p.host.tick(1 / 60);
  assert.equal(p.host.snapshot().red.mode, 'guard-exit');
  const packet = p.host.match.packet();
  assert.equal(packet.ack, input.commands.at(-1).seq);
  p.guest.match.receivePacket(packet);
  assert.equal(p.guest.match.input().commands.length, 0);
  p.step(0.1);
  assert.equal(p.host.snapshot().red.mode, 'attack');
  p.step(0.3);
  assert.equal(p.host.snapshot().blue.health, 92);
  p.host.match.receiveInput({ ...input, serial: input.serial + 100 });
  p.host.tick(1 / 60);
  assert.equal(p.host.match.packet().ack, packet.ack);
});
test('host rejects a forged guard during an attack and acknowledges it without cancelling', () => {
  const p = pair();
  p.guest.match.attack('punch');
  p.step(0.05);
  const id = p.host.snapshot().red.animationId;
  const input = p.guest.match.input();
  input.commands = [
    {
      seq: p.host.match.packet().ack + 1,
      epoch: input.epoch,
      matchId: input.matchId,
      roundId: input.roundId,
      kind: 'block-down',
    },
  ];
  p.host.match.receiveInput(input);
  p.host.tick(1 / 60);
  assert.equal(p.host.snapshot().red.mode, 'attack');
  assert.equal(p.host.snapshot().red.animationId, id);
  assert.equal(p.host.snapshot().red.guardHeld, false);
  assert.equal(p.host.match.packet().ack, input.commands[0].seq);
});
test('guard stamina and blocked impact identity synchronize, including duplicate packets and remounts', () => {
  const p = pair({ blockHitstop: 0 });
  p.guest.match.block(true);
  p.step(0.2);
  p.host.match.attack('punch');
  p.step(0.35);
  p.exchange();
  assert.equal(p.host.snapshot().red.health, 100);
  assert.equal(p.guest.snapshot().red.health, 100);
  assert.equal(p.guest.snapshot().red.guardStamina, p.host.snapshot().red.guardStamina);
  for (const device of [p.host, p.guest]) {
    const events = device.match.takeImpacts();
    assert.equal(events.length, 1);
    assert.equal(events[0].impact.outcome, 'blocked');
    assert.ok(Math.abs(events[0].impact.z - device.match.getTransform('red').z) < 0.04);
    assert.ok(events[0].impact.y > 0);
  }
  const packet = p.host.match.packet();
  p.guest.match.receivePacket(packet);
  p.guest.match.receivePacket(packet);
  assert.deepEqual(p.guest.match.takeImpacts(), []);
  p.guest.replace();
  assert.deepEqual(p.guest.match.takeImpacts(), []);
});
test('pending and duplicate Jump Back commands execute one hop only', () => {
  const p = pair();
  const before = p.host.match.getTransform('red');
  assert.ok(p.guest.match.jumpBack());
  assert.equal(p.guest.match.jumpBack(), false);
  assert.equal(p.guest.snapshot().jumpBackPending, true);
  const input = p.guest.match.input();
  p.host.match.receiveInput(input);
  p.host.tick(1 / 60);
  const id = p.host.snapshot().red.animationId;
  p.host.match.receiveInput({ ...input, serial: input.serial + 1 });
  p.host.tick(1 / 60);
  assert.equal(p.host.snapshot().red.animationId, id);
  p.step(0.45);
  p.exchange();
  assert.equal(p.guest.snapshot().jumpBackPending, false);
  assert.equal(p.host.snapshot().red.mode, 'idle');
  assert.ok(Math.abs(p.host.match.getTransform('red').x - before.x - 0.06) < 1e-6);
  p.step(0.4);
  assert.equal(p.host.snapshot().red.animationId, p.guest.snapshot().red.animationId);
});
test('guest interpolates X/Z and free yaw while committed attack yaw follows host immediately', () => {
  const p = pair();
  p.guest.match.setMovement('strafeLeft', true);
  p.step(0.3);
  p.exchange();
  const packet = p.host.match.packet();
  assert.ok(packet.transforms.red.z > 0);
  assert.ok(validPacket(packet));
  packet.serial += 100;
  packet.transforms.red = { ...packet.transforms.red, x: 0.05, z: 0.03, yaw: 179 };
  p.guest.match.receivePacket(packet);
  const start = p.guest.match.getTransform('red');
  assert.ok(start.z !== packet.transforms.red.z);
  p.step(0.05);
  p.exchange();
  const attack = p.host.match.packet();
  attack.serial += 200;
  attack.round.red = { ...attack.round.red, mode: 'attack', clip: 'Combo_PunchL' };
  attack.transforms.red.yaw = -90;
  p.guest.match.receivePacket(attack);
  assert.equal(p.guest.match.getTransform('red').yaw, -90);
});
test('portrait freezes guard stamina, hop trajectory and presentation without changing generation', () => {
  const p = pair();
  p.host.match.block(true);
  p.step(0.2);
  const stamina = p.host.snapshot().blue.guardStamina,
    epoch = p.host.match.packet().epoch;
  p.guest.match.setLandscape(false);
  p.exchange();
  p.step(2);
  assert.equal(p.host.snapshot().blue.guardStamina, stamina);
  assert.equal(p.host.match.packet().epoch, epoch);
  p.guest.match.setLandscape(true);
  p.step(0.7);
  assert.equal(p.host.snapshot().blue.guardHeld, false);
  p.host.match.jumpBack();
  p.step(0.2);
  const transform = p.host.match.getTransform('blue');
  p.guest.match.setLandscape(false);
  p.exchange();
  p.step(2);
  assert.deepEqual(p.host.match.getTransform('blue'), transform);
  p.guest.match.setLandscape(true);
  p.step(0.8);
  assert.equal(p.host.snapshot().blue.mode, 'idle');
});
test('interrupted airborne hop knockout retains lift and settlement before Defeat on both devices', () => {
  const p = pair({ health: 8, hopTravel: 0.012, reach: 0.12 });
  p.host.match.attack('punch');
  p.step(0.15);
  p.guest.match.jumpBack();
  p.step(0.15);
  p.exchange();
  const packet = p.host.match.packet();
  assert.equal(packet.knockout.motion.red.mode, 'settling');
  assert.ok(packet.knockout.motion.red.initialLift > 0);
  assert.ok(validPacket(packet));
  for (const device of [p.host, p.guest]) {
    assert.equal(device.snapshot().red.mode, 'settling');
    assert.ok(device.match.getTransform('red').lift > 0);
    assert.equal(device.snapshot().outcome, null);
  }
  p.step(0.15);
  assert.equal(p.host.snapshot().red.mode, 'defeat');
  assert.equal(p.guest.snapshot().red.mode, 'defeat');
  p.step(8);
  assert.equal(p.host.snapshot().stage, 'finished');
});
test('defense protocol rejects malformed guard, hop, Z and knockout motion, and version four', () => {
  const p = pair(),
    packet = p.host.match.packet(),
    input = p.guest.match.input();
  for (const fields of [
    { guardStamina: -1 },
    { guardStamina: 101 },
    { guardState: 'god' },
    { guardRecoveryRemaining: Infinity },
    { motionInitialLift: -1 },
  ])
    assert.equal(
      validPacket({
        ...packet,
        round: { ...packet.round, red: { ...packet.round.red, ...fields } },
      }),
      false
    );
  assert.equal(
    validPacket({
      ...packet,
      transforms: { ...packet.transforms, red: { ...packet.transforms.red, z: NaN } },
    }),
    false
  );
  assert.equal(validPacket({ ...packet, protocol: 4 }), false);
  assert.equal(validPacket({ ...packet, protocol: 5 }), false);
  assert.equal(validInput({ ...input, protocol: 4 }), false);
  assert.equal(validInput({ ...input, protocol: 5 }), false);
  assert.equal(validInput({ ...input, strafeLeft: 'yes' }), false);
  assert.equal(
    validPacket({
      ...packet,
      knockout: {
        id: 'bad',
        outcome: 'blue',
        launched: [],
        motion: { blue: { mode: 'hop' }, red: { mode: null } },
      },
    }),
    false
  );
});

test('guest held guard intent synchronizes during flinch; ordered release cancels it before startup', () => {
  const p = pair();
  p.host.match.attack('punch');
  p.step(0.3);
  p.exchange();
  assert.equal(p.guest.snapshot().red.health, 92);
  assert.ok(p.guest.match.block(true));
  const down = p.guest.match.input();
  p.host.match.receiveInput(down);
  p.host.tick(1 / 60);
  p.exchange();
  assert.equal(p.host.snapshot().red.pendingBlock, true);
  assert.equal(p.guest.snapshot().red.pendingBlock, true);
  assert.equal(p.guest.snapshot().red.guardStamina, p.host.snapshot().red.guardStamina);
  assert.ok(p.guest.match.block(false));
  const up = p.guest.match.input();
  p.host.match.receiveInput(up);
  p.host.match.receiveInput(down);
  p.step(0.3);
  p.exchange();
  assert.equal(p.host.snapshot().red.guardHeld, false);
  assert.equal(p.guest.snapshot().red.pendingBlock, false);
  assert.equal(p.host.snapshot().red.guardState, 'off');
});

test('host rejects forged early defense/attacks while acknowledging, and executes one buffered guest counterpunch', () => {
  const p = pair();
  p.host.match.attack('punch');
  p.step(0.3);
  p.exchange();
  assert.equal(p.guest.match.jumpBack(), false);
  assert.equal(p.guest.match.attack('punch'), false);
  const input = p.guest.match.input();
  const forged = {
    ...input,
    serial: input.serial + 1,
    commands: [
      {
        seq: 1,
        epoch: input.epoch,
        matchId: input.matchId,
        roundId: input.roundId,
        kind: 'jump-back',
      },
    ],
  };
  p.host.match.receiveInput(forged);
  p.host.tick(1 / 60);
  assert.equal(p.host.match.packet().ack, 1);
  assert.notEqual(p.host.snapshot().red.mode, 'hop');
  // Keep the actual client's sequence ahead of the deliberately forged fixture.
  p.guest.match.seq = 1;
  p.step(0.2);
  p.exchange();
  assert.ok(p.guest.match.attack('punch'));
  assert.equal(p.guest.match.attack('punch'), false);
  const buffered = p.guest.match.input();
  p.host.match.receiveInput(buffered);
  p.host.tick(1 / 60);
  p.exchange();
  assert.equal(p.host.snapshot().red.counterpunchBuffered, true);
  assert.equal(p.guest.snapshot().red.counterpunchBuffered, true);
  const id = p.host.snapshot().red.animationId;
  p.host.match.receiveInput(buffered);
  p.step(0.16);
  p.exchange();
  assert.equal(p.host.snapshot().red.mode, 'attack');
  assert.ok(p.host.snapshot().red.animationId > id);
  const attack = p.host.snapshot().red.animationId;
  p.host.match.receiveInput(buffered);
  p.step(0.05);
  assert.equal(p.host.snapshot().red.animationId, attack);
  assert.equal(p.guest.match.input().commands.length, 0);
});

test('protocol seven requires independent acceptance, buffer and recovery fields; six invites/packets fail', () => {
  const p = pair(),
    packet = p.host.match.packet(),
    input = p.guest.match.input();
  for (const fields of [
    { pendingBlock: 'yes' },
    { counterpunchBuffered: 1 },
    { canPunch: null },
    { canUppercut: 'yes' },
    { defenseLockRemaining: NaN },
    { punchRecoveryRemaining: -1 },
    { punchRestRemaining: Infinity },
  ])
    assert.equal(
      validPacket({
        ...packet,
        round: { ...packet.round, red: { ...packet.round.red, ...fields } },
      }),
      false
    );
  assert.equal(validPacket({ ...packet, protocol: 6 }), false);
  assert.equal(validInput({ ...input, protocol: 6 }), false);
  assert.equal(parseJoinLink('xr-showcase://arena-fighter?join=ABC234&v=6'), null);
});

test('guest Block takes priority over an unacknowledged counterpunch in one ordered packet', () => {
  const p = pair();
  p.host.match.attack('punch');
  p.step(0.52);
  p.exchange();
  assert.ok(p.guest.match.attack('punch'));
  assert.ok(p.guest.match.block(true));
  const input = p.guest.match.input();
  assert.deepEqual(
    input.commands.map((c) => c.kind),
    ['punch', 'block-down']
  );
  p.host.match.receiveInput(input);
  p.host.tick(1 / 60);
  assert.equal(p.host.snapshot().red.guardHeld, true);
  assert.equal(p.host.snapshot().red.counterpunchBuffered, false);
  p.host.match.receiveInput(input);
  p.step(0.16);
  assert.equal(p.host.snapshot().red.mode, 'guard');
  assert.equal(p.host.snapshot().red.guardState, 'holding');
});
