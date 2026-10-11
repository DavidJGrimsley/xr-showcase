const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { ArenaMatch } = require('../src/features/arena-fighter/arena-match.ts');
const { ArenaAudio } = require('../src/features/arena-fighter/arena-audio.ts');
const { ArenaImpactSlots } = require('../src/features/arena-fighter/arena-impact-slots.ts');
const {
  playsMainAudio,
  playsImpact,
  voiceDuration,
  announcementVoice,
} = require('../src/features/arena-fighter/arena-audio-policy.ts');
const { validPacket, validInput } = require('../src/features/arena-fighter/arena-protocol.ts');
const { arenaAnnouncement } = require('../src/features/arena-fighter/arena-hud-state.ts');
const manifest = require('../assets/arena/sounds/audio-manifest.json');

function fighter(mode = 'solo', source = 'host', rounds = 1) {
  let time = 0;
  const match = new ArenaMatch(
    mode,
    rounds,
    () => time,
    { cpuEnabled: false, health: 8, spawn: 0.04, punchHitstop: 0 },
    source
  );
  const token = match.attachSession(1);
  match.setLandscape(true);
  match.setTracking(token, true);
  match.setPlacement(token, true);
  for (const asset of ['arena', 'blue', 'red'])
    match.assetLoaded(token, match.getSnapshot().placementVersion, asset);
  const step = (seconds) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      time += 1000 / 60;
      for (const id of ['blue', 'red'])
        match.animationApplied(id, match.getSnapshot()[id].animationId);
      match.tick(token, 1 / 60);
    }
  };
  step(0.5);
  return { match, step, token };
}
function pair(source) {
  const host = fighter('host', source),
    guest = fighter('guest');
  function exchange() {
    host.match.setNetwork(true);
    guest.match.setNetwork(true);
    guest.match.receivePacket(host.match.packet());
    host.match.receiveInput(guest.match.input());
  }
  function step(seconds) {
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      exchange();
      host.step(1 / 60);
      guest.step(1 / 60);
    }
    exchange();
  }
  exchange();
  return { host, guest, exchange, step };
}
function players() {
  const instances = new Map();
  const create = (key) => {
    const listeners = new Set();
    const player = {
      key,
      volume: 1,
      loop: false,
      playing: false,
      isLoaded: true,
      plays: 0,
      seeks: 0,
      releases: 0,
      currentTime: 0,
      play() {
        this.plays++;
        this.playing = true;
      },
      pause() {
        this.playing = false;
      },
      seekTo(time) {
        this.seeks++;
        this.currentTime = time;
        return Promise.resolve();
      },
      release() {
        this.releases++;
        this.playing = false;
      },
      addListener(_event, fn) {
        listeners.add(fn);
        return { remove: () => listeners.delete(fn) };
      },
      emit(patch) {
        for (const fn of listeners)
          fn({ didJustFinish: false, currentTime: this.currentTime, error: null, ...patch });
      },
      finish() {
        this.playing = false;
        this.emit({ didJustFinish: true, currentTime: voiceDuration(key) });
      },
      listenerCount: () => listeners.size,
    };
    instances.set(key, player);
    return player;
  };
  return { create, instances };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

test('packaged playback copies have the recorded hashes, formats and source durations', () => {
  const directory = path.resolve(__dirname, '../assets/arena/sounds');
  for (const [key, asset] of Object.entries(manifest.assets)) {
    const bytes = fs.readFileSync(path.join(directory, asset.file));
    assert.equal(bytes.length, asset.bytes);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), asset.sha256);
    assert.ok(asset.durationSeconds > 0);
    if (key === 'menu' || key === 'battle') {
      assert.equal(bytes.toString('ascii', 4, 8), 'ftyp');
      assert.ok(asset.bytes < 12_000_000);
    } else {
      assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
      let offset = 12,
        fmt,
        dataLength;
      while (offset + 8 <= bytes.length) {
        const name = bytes.toString('ascii', offset, offset + 4),
          length = bytes.readUInt32LE(offset + 4);
        if (name === 'fmt ') fmt = offset + 8;
        if (name === 'data') dataLength = length;
        offset += 8 + length + (length % 2);
      }
      assert.equal(bytes.readUInt16LE(fmt), 1);
      assert.equal(bytes.readUInt16LE(fmt + 2), 2);
      assert.equal(bytes.readUInt16LE(fmt + 14), 16);
      assert.ok(
        Math.abs(dataLength / bytes.readUInt32LE(fmt + 8) - asset.durationSeconds) < 0.000001
      );
    }
  }
});

test('main source choices and impact receiver routing include solo and future remote play', () => {
  for (const source of ['host', 'guest', 'both']) {
    assert.equal(playsMainAudio('solo', source), true);
    for (const role of ['host', 'guest'])
      assert.equal(playsMainAudio(role, source), source === 'both' || role === source);
  }
  for (const local of ['blue', 'red'])
    for (const receiver of ['blue', 'red']) {
      assert.equal(playsImpact('same-space', local, receiver), local === receiver);
      assert.equal(playsImpact('solo', local, receiver), true);
      assert.equal(playsImpact('remote', local, receiver), true);
    }
  const cue = { key: 'result' };
  assert.equal(announcementVoice(cue, 'blue', 'blue'), 'win');
  assert.equal(announcementVoice(cue, 'red', 'blue'), 'lose');
  assert.equal(announcementVoice(cue, 'red', 'draw'), null);
});

test('three impact slots overlap independently and become reusable only after finishing', () => {
  const pool = new ArenaImpactSlots();
  const keys = Array.from({ length: 3 }, () => pool.reserve('blue:right'));
  assert.equal(new Set(keys).size, 3);
  assert.equal(pool.reserve('blue:right'), null);
  assert.equal(pool.reserve('red:right'), 'red:right:0');
  pool.finish(keys[1]);
  assert.equal(pool.reserve('blue:right'), keys[1]);
  pool.clear();
  assert.equal(pool.reserve('blue:right'), keys[0]);
});

test('Round and Ready wait for playback and buffers; Fight enables input immediately', () => {
  const h = fighter();
  h.match.setAudioAvailable(true);
  h.match.ready();
  h.step(0.02);
  const round = h.match.getSnapshot().announcement;
  assert.equal(round.key, 'round1');
  assert.equal(arenaAnnouncement(h.match.getSnapshot()).text, 'Round 1');
  h.step(2);
  assert.equal(h.match.getSnapshot().announcement.id, round.id);
  assert.equal(h.match.attack('punch'), false);
  h.match.announcementFinished('stale');
  h.step(0.05);
  assert.equal(h.match.getSnapshot().announcement.id, round.id);
  h.match.announcementFinished(round.id);
  h.step(0.1);
  assert.equal(h.match.getSnapshot().announcement.id, round.id);
  h.step(0.06);
  const ready = h.match.getSnapshot().announcement;
  assert.equal(ready.key, 'ready');
  h.step(0.9);
  h.match.announcementFinished(ready.id);
  h.step(0.16);
  assert.equal(h.match.getSnapshot().announcement.key, 'fight');
  assert.equal(h.match.getSnapshot().stage, 'fighting');
  assert.equal(arenaAnnouncement(h.match.getSnapshot()).text, 'Fight!');
  assert.equal(h.match.attack('punch'), true);
  h.step(0.8);
  const fight = h.match.getSnapshot().announcement;
  h.match.announcementFinished(fight.id);
  h.step(0.1);
  assert.equal(h.match.getSnapshot().announcement.id, fight.id);
  h.step(0.06);
  assert.equal(h.match.getSnapshot().announcement, null);
});

for (const source of ['host', 'guest', 'both'])
  test(`${source} source waits only for the selected speech devices`, () => {
    const p = pair(source);
    p.host.match.setAudioAvailable(true);
    p.guest.match.setAudioAvailable(true);
    p.exchange();
    p.host.match.ready();
    p.guest.match.ready();
    p.step(1.5);
    const id = p.host.match.getSnapshot().announcement.id;
    if (source !== 'host') {
      p.host.match.announcementFinished(id);
      p.step(0.2);
      assert.equal(p.host.match.getSnapshot().announcement.id, id);
    }
    if (source !== 'guest') p.host.match.announcementFinished(id);
    if (source !== 'host') p.guest.match.announcementFinished(id);
    p.step(0.2);
    assert.equal(p.host.match.getSnapshot().announcement.key, 'ready');
    assert.equal(p.guest.match.getSnapshot().mainAudioSource, source);
  });

test('pausing a countdown freezes its cue and Resume retains the same cue ID and elapsed time', () => {
  const h = fighter();
  h.match.ready();
  h.step(0.5);
  const cue = h.match.getSnapshot().announcement;
  h.match.interrupt();
  h.step(2);
  assert.deepEqual(h.match.getSnapshot().announcement, cue);
  h.match.resume();
  h.step(0.1);
  assert.equal(h.match.getSnapshot().announcement.id, cue.id);
  assert.ok(h.match.getSnapshot().announcement.elapsed < cue.elapsed + 0.2);
});

test('missing playback completions reach a bounded silent fallback', () => {
  const h = fighter();
  h.match.setAudioAvailable(true);
  h.match.ready();
  h.step(0.02);
  const id = h.match.getSnapshot().announcement.id;
  h.step(6.3);
  assert.equal(h.match.getSnapshot().announcement.id, id);
  h.step(0.2);
  assert.equal(h.match.getSnapshot().announcement.key, 'ready');
});

test('final result waits for both personal voices, rejects early rematches and keeps battle music', () => {
  const p = pair('host');
  p.host.match.ready();
  p.guest.match.ready();
  p.step(3);
  p.host.match.attack('punch');
  p.step(8);
  assert.equal(p.host.match.getSnapshot().stage, 'finished');
  const cue = p.host.match.getSnapshot().announcement;
  assert.equal(cue.key, 'result');
  p.host.match.setAudioAvailable(true);
  p.guest.match.setAudioAvailable(true);
  p.exchange();
  assert.equal(p.host.match.rematch(), false);
  assert.equal(p.guest.match.rematch(), false);
  p.host.match.announcementFinished(cue.id);
  p.step(0.2);
  assert.equal(p.host.match.getSnapshot().announcement.id, cue.id);
  p.guest.match.announcementFinished(cue.id);
  p.step(2.1);
  assert.equal(p.host.match.rematch(), true);
  assert.equal(p.guest.match.rematch(), true);
  p.step(0.02);
  let next = p.host.match.getSnapshot().announcement;
  p.step(next.duration);
  p.host.match.announcementFinished(next.id);
  p.step(0.2);
  next = p.host.match.getSnapshot().announcement;
  assert.equal(next.key, 'ready');
  p.step(next.duration);
  p.host.match.announcementFinished(next.id);
  p.step(0.2);
  assert.equal(p.host.match.getSnapshot().stage, 'fighting');
  assert.equal(p.host.match.getSnapshot().battleMusicStarted, true);
});

test('protocol validates audio ownership, cue keys/durations and completion payloads', () => {
  const h = fighter();
  h.match.ready();
  h.step(0.02);
  const packet = h.match.packet();
  assert.equal(validPacket(packet), true);
  for (const patch of [
    { mainAudioSource: 'remote' },
    { audioAvailable: null },
    { battleMusicStarted: 1 },
    { announcement: { ...packet.announcement, key: 'win' } },
    { announcement: { ...packet.announcement, duration: 99 } },
    { announcement: { ...packet.announcement, elapsed: NaN } },
  ])
    assert.equal(validPacket({ ...packet, ...patch }), false);
  assert.equal(validInput({ ...h.match.input(), announcementDone: 4 }), false);
  assert.equal(validInput({ ...h.match.input(), audioAvailable: null }), false);
});

test('old-epoch and duplicate guest completions cannot advance a new announcement', () => {
  const p = pair('guest');
  p.guest.match.setAudioAvailable(true);
  p.exchange();
  p.host.match.ready();
  p.guest.match.ready();
  p.step(1.5);
  const cue = p.host.match.getSnapshot().announcement;
  const old = p.guest.match.input();
  p.host.match.receiveInput({ ...old, epoch: old.epoch - 1, announcementDone: cue.id });
  p.step(0.2);
  assert.equal(p.host.match.getSnapshot().announcement.id, cue.id);
  p.guest.match.announcementFinished(cue.id);
  p.step(0.2);
  const ready = p.host.match.getSnapshot().announcement;
  assert.equal(ready.key, 'ready');
  const duplicate = p.guest.match.input();
  p.host.match.receiveInput({ ...duplicate, announcementDone: cue.id });
  p.step(1.2);
  assert.equal(p.host.match.getSnapshot().announcement.id, ready.id);
});

test('guest main audio mutes host music and round calls while both phones speak personal results', async () => {
  const p = pair('guest'),
    hostPlayers = players(),
    guestPlayers = players();
  const hostAudio = new ArenaAudio(hostPlayers.create),
    guestAudio = new ArenaAudio(guestPlayers.create);
  hostAudio.connect(p.host.match);
  guestAudio.connect(p.guest.match);
  p.exchange();
  assert.equal(hostPlayers.instances.get('menu').playing, false);
  assert.equal(guestPlayers.instances.get('menu').playing, true);
  p.host.match.ready();
  p.guest.match.ready();
  p.step(0.02);
  await flush();
  assert.equal(hostPlayers.instances.get('round1').plays, 0);
  assert.equal(guestPlayers.instances.get('round1').plays, 1);
  assert.equal(hostPlayers.instances.get('battle').playing, false);
  p.step(1.3);
  guestPlayers.instances.get('round1').finish();
  p.step(0.2);
  await flush();
  p.step(0.9);
  guestPlayers.instances.get('ready').finish();
  p.step(0.2);
  await flush();
  p.step(0.8);
  guestPlayers.instances.get('fight').finish();
  p.step(0.2);
  await flush();
  p.host.match.attack('punch');
  p.step(8);
  await flush();
  assert.equal(hostPlayers.instances.get('win').plays, 1);
  assert.equal(guestPlayers.instances.get('lose').plays, 1);
  assert.equal(guestPlayers.instances.get('battle').seeks, 0);
  hostAudio.dispose();
  guestAudio.dispose();
});

test('a title still speaking finishes before an immediately requested match voice', async () => {
  const h = fighter(),
    p = players(),
    audio = new ArenaAudio(p.create);
  audio.environment(true, true, true);
  await flush();
  audio.connect(h.match);
  h.match.ready();
  h.step(0.02);
  await flush();
  assert.equal(p.instances.get('round1').plays, 0);
  p.instances.get('title').finish();
  audio.tick(0.1);
  await flush();
  assert.equal(p.instances.get('round1').plays, 0);
  audio.tick(0.06);
  await flush();
  assert.equal(p.instances.get('round1').plays, 1);
  audio.dispose();
});

test('audio owner loops menus, speaks title once, ducks and restores music, and releases all resources', async () => {
  const p = players(),
    audio = new ArenaAudio(p.create);
  audio.environment(true, true, true);
  await flush();
  assert.equal(p.instances.get('menu').playing, true);
  assert.equal(p.instances.get('menu').loop, true);
  assert.equal(p.instances.get('title').plays, 1);
  assert.equal(p.instances.get('menu').volume, 0.15);
  p.instances.get('title').finish();
  audio.tick(0.16);
  audio.tick(0.15);
  assert.equal(p.instances.get('menu').volume, 0.45);
  audio.environment(true, true, false);
  audio.environment(true, true, true);
  await flush();
  assert.equal(p.instances.get('title').plays, 1);
  audio.environment(false, true, true);
  assert.equal(p.instances.get('menu').playing, false);
  audio.environment(true, true, true);
  assert.equal(p.instances.get('menu').playing, true);
  audio.dispose();
  audio.dispose();
  for (const player of p.instances.values()) {
    assert.equal(player.releases, 1);
    assert.equal(player.listenerCount(), 0);
  }
});

test('one audio owner preserves music and voice positions across updates and pauses', async () => {
  const h = fighter(),
    p = players(),
    audio = new ArenaAudio(p.create);
  audio.connect(h.match);
  audio.environment(true, true, false);
  assert.equal(p.instances.get('menu').playing, true);
  h.match.ready();
  h.step(0.02);
  await flush();
  assert.equal(p.instances.get('battle').playing, true);
  assert.equal(p.instances.get('menu').playing, false);
  assert.equal(p.instances.get('round1').plays, 1);
  p.instances.get('battle').currentTime = 42;
  p.instances.get('round1').currentTime = 0.4;
  audio.environment(false, true, false);
  audio.tick(2);
  assert.equal(p.instances.get('round1').playing, false);
  audio.environment(true, true, false);
  audio.tick(0.1);
  await flush();
  h.match.resume();
  h.step(0.02);
  audio.tick(0.02);
  assert.equal(p.instances.get('battle').currentTime, 42);
  assert.equal(p.instances.get('round1').currentTime, 0.4);
  assert.equal(p.instances.get('round1').seeks, 1);
  audio.connect(h.match);
  audio.tick(0.1);
  assert.equal(p.instances.get('battle').seeks, 0);
  audio.connect(null);
  await flush();
  assert.equal(p.instances.get('battle').playing, false);
  assert.equal(p.instances.get('menu').playing, true);
  assert.equal(p.instances.get('battle').currentTime, 0);
  audio.dispose();
});

test('voice playback errors use the recorded duration without blocking or repeating the cue', async () => {
  const h = fighter(),
    p = players(),
    audio = new ArenaAudio(p.create);
  audio.connect(h.match);
  h.match.ready();
  h.step(0.02);
  await flush();
  const cue = h.match.getSnapshot().announcement;
  p.instances.get('round1').emit({ error: 'decoder failure' });
  audio.tick(0.5);
  h.step(0.5);
  assert.equal(h.match.input().announcementDone, null);
  audio.tick(0.8);
  h.step(0.9);
  await flush();
  assert.notEqual(h.match.getSnapshot().announcement.id, cue.id);
  assert.equal(p.instances.get('round1').seeks, 1);
  audio.dispose();
});

test('host menu music stays at its position through loading, transform edits and waiting for an opponent', () => {
  const h = fighter('host'),
    p = players(),
    audio = new ArenaAudio(p.create);
  audio.environment(true, true, false);
  const menu = p.instances.get('menu');
  menu.currentTime = 27;
  audio.connect(h.match);
  const scope = { sessionToken: h.token, placementVersion: h.match.getSnapshot().placementVersion };
  h.match.setTransformLocked(true);
  h.match.setTransformLocked(false);
  h.match.setPosition(scope, 'x', 0.3);
  h.match.setScale(scope, 1.5);
  h.match.setNetwork(true, '', 'ABC234');
  h.step(1);
  audio.tick(1);
  assert.equal(menu.playing, true);
  assert.equal(menu.plays, 1);
  assert.equal(menu.seeks, 0);
  assert.equal(menu.currentTime, 27);
  assert.equal(p.instances.get('battle').plays, 0);
  audio.dispose();
});

test('main audio selection stays in force through a lobby disconnect and the other phone turning portrait', () => {
  for (const source of ['host', 'guest', 'both']) {
    const p = pair(source),
      hp = players(),
      gp = players();
    const hostAudio = new ArenaAudio(hp.create),
      guestAudio = new ArenaAudio(gp.create);
    hostAudio.connect(p.host.match);
    guestAudio.connect(p.guest.match);
    hp.instances.get('menu').currentTime = 12;
    gp.instances.get('menu').currentTime = 19;
    p.guest.match.setLandscape(false);
    p.exchange();
    assert.equal(hp.instances.get('menu').playing, source !== 'guest');
    assert.equal(gp.instances.get('menu').playing, false);
    p.guest.match.setLandscape(true);
    p.step(0.6);
    p.host.match.setNetwork(false);
    p.guest.match.setNetwork(false);
    hostAudio.tick(1);
    guestAudio.tick(1);
    assert.equal(hp.instances.get('menu').playing, source !== 'guest');
    assert.equal(gp.instances.get('menu').playing, source !== 'host');
    p.exchange();
    assert.equal(hp.instances.get('menu').currentTime, 12);
    assert.equal(gp.instances.get('menu').currentTime, 19);
    assert.equal(hp.instances.get('menu').seeks, 0);
    assert.equal(gp.instances.get('menu').seeks, 0);
    hostAudio.dispose();
    guestAudio.dispose();
  }
});

test('speech waits for locally cached assets to load before seeking and plays only once', async () => {
  const p = players(),
    audio = new ArenaAudio(p.create);
  const title = p.instances.get('title');
  title.isLoaded = false;
  audio.environment(true, true, true);
  await flush();
  audio.tick(0.5);
  assert.equal(title.seeks, 0);
  assert.equal(title.plays, 0);
  title.isLoaded = true;
  audio.tick(0.05);
  await flush();
  assert.equal(title.seeks, 1);
  assert.equal(title.plays, 1);
  audio.tick(0.05);
  assert.equal(title.seeks, 1);
  audio.dispose();
});
