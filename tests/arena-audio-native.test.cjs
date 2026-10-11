const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { ArenaAudio } = require('../src/features/arena-fighter/arena-audio.ts');
const flush = () => new Promise((resolve) => setImmediate(resolve));

function hookHarness() {
  const players = [],
    listeners = new Set(),
    cleanups = [],
    timers = new Map();
  let finishCache, cachedSources, mode;
  const cache = new Promise((resolve) => {
    finishCache = resolve;
  });
  const appState = {
    currentState: 'active',
    addEventListener(_event, listener) {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    },
  };
  const source = fs.readFileSync(
    path.resolve(__dirname, '../src/features/arena-fighter/use-arena-audio.native.ts'),
    'utf8'
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
    setInterval: () => 1,
    clearInterval: () => {},
    setTimeout: (fn) => {
      timers.set(fn, fn);
      return fn;
    },
    clearTimeout: (fn) => timers.delete(fn),
    require: (name) => {
      if (name === 'react')
        return {
          useRef: (current) => ({ current }),
          useLayoutEffect: (fn) => fn(),
          useEffect: (fn) => cleanups.push(fn()),
        };
      if (name === 'react-native') return { AppState: appState };
      if (name === './arena-audio') return { ArenaAudio };
      if (name === 'expo-asset')
        return {
          Asset: {
            loadAsync: (sources) => {
              cachedSources = sources;
              return cache;
            },
          },
        };
      if (name === 'expo-audio')
        return {
          setAudioModeAsync: async (value) => {
            mode = value;
          },
          createAudioPlayer: (uri, options) => {
            const player = {
              uri,
              options,
              volume: 1,
              playing: false,
              isLoaded: true,
              releases: 0,
              play() {
                this.playing = true;
              },
              pause() {
                this.playing = false;
              },
              seekTo: async () => {},
              release() {
                this.releases++;
              },
              addListener: () => ({ remove: () => {} }),
            };
            players.push(player);
            return player;
          },
        };
      if (name.startsWith('../../../assets/arena/sounds/')) return name;
      throw new Error('Missing mock: ' + name);
    },
  });
  module.exports.useArenaAudio(null, true, false);
  return {
    players,
    mode: () => mode,
    sources: () => cachedSources,
    finishCache: () =>
      finishCache(
        cachedSources.map((uri) => ({ uri, localUri: 'file:///cache/' + path.basename(uri) }))
      ),
    state(value) {
      appState.currentState = value;
      for (const listener of listeners) listener();
    },
    unmount() {
      for (const fn of cleanups) fn?.();
      for (const fn of timers.values()) fn();
    },
    listenerCount: () => listeners.size,
  };
}

test('native playback waits for cached local assets, keeps its audio session and resumes at the same position', async () => {
  const h = hookHarness();
  await flush();
  assert.equal(h.players.length, 0);
  assert.equal(h.sources().length, 12);
  assert.equal(h.mode().playsInSilentMode, true);
  h.finishCache();
  await flush();
  assert.equal(h.players.length, 12);
  for (const player of h.players) {
    assert.match(player.uri, /^file:\/\/\/cache\//);
    assert.equal(player.options.keepAudioSessionActive, true);
  }
  const menu = h.players.find((p) => p.uri.endsWith('menu.m4a'));
  assert.equal(menu.playing, true);
  menu.currentTime = 17;
  h.state('background');
  assert.equal(menu.playing, false);
  h.state('active');
  assert.equal(menu.playing, true);
  assert.equal(menu.currentTime, 17);
  h.unmount();
  assert.equal(h.listenerCount(), 0);
  assert.ok(h.players.every((p) => p.releases === 1));
});

test('a cache download completing after leaving the game never creates players or restarts music', async () => {
  const h = hookHarness();
  await flush();
  h.unmount();
  h.finishCache();
  await flush();
  assert.equal(h.players.length, 0);
  assert.equal(h.listenerCount(), 0);
});
