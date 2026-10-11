const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { ArenaMatch } = require('../src/features/arena-fighter/arena-match.ts');
const {
  arenaAnnouncement,
  arenaHUDState,
  arenaInviteLayout,
} = require('../src/features/arena-fighter/arena-hud-state.ts');
const {
  ARSessionController,
  createARSessionCoordinator,
} = require('../src/features/ar/ar-session-controller.ts');

function component(file, mocks) {
  const output = ts.transpileModule(
    fs.readFileSync(path.resolve(__dirname, '../src/features/', file), 'utf8'),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
      },
    }
  ).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, {
    module,
    exports: module.exports,
    AbortController,
    __DEV__: false,
    require: (name) => {
      if (!(name in mocks)) throw new Error('Missing mock: ' + name);
      return mocks[name];
    },
  });
  return module.exports;
}
const jsx = (type, props) => ({ type, props });
const jsxRuntime = { jsx, jsxs: jsx, Fragment: 'Fragment' };

function menuHarness({
  fontsLoaded = true,
  configuration = null,
  checkConnection = async () => {},
} = {}) {
  const states = [];
  const refs = [];
  let stateIndex = 0;
  let refIndex = 0;
  let exits = 0;
  const Screen = component('arena-fighter/arena-fighter-screen.native.tsx', {
    react: {
      lazy: () => 'Lazy',
      Suspense: 'Suspense',
      useCallback: (callback) => callback,
      useEffect: () => {},
      useEffectEvent: (callback) => callback,
      useLayoutEffect: (effect) => effect(),
      useRef: (current) => (refs[refIndex++] ??= { current }),
      useState: (initial) => {
        const index = stateIndex++;
        if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
        return [states[index], (value) => (states[index] = value)];
      },
    },
    'react/jsx-runtime': jsxRuntime,
    'expo-router': { router: { dismissTo: () => exits++ }, useLocalSearchParams: () => ({}) },
    'react-native': {
      ActivityIndicator: 'ActivityIndicator',
      ScrollView: 'ScrollView',
      Text: 'Text',
      TextInput: 'TextInput',
      View: 'View',
      useWindowDimensions: () => ({ width: 568, height: 320, fontScale: 1 }),
    },
    'react-native-safe-area-context': {
      useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    },
    './arena-ui': {
      ARENA_FONTS: {},
      ArenaButton: 'Button',
      ArenaDisplayText: 'DisplayText',
      ArenaMenuBackground: 'Background',
      useArenaColors: () => ({}),
      useArenaFonts: () => [fontsLoaded, null],
    },
    './arena-match': { ArenaMatch },
    './use-arena-audio.native': { useArenaAudio: () => {} },
    './arena-audio-picker.native': { __esModule: true, default: 'AudioPicker' },
    './arena-configuration': { arenaConfiguration: () => configuration },
    './arena-connection': { checkArenaConnection: checkConnection },
    '@reactvision/react-viro': { ViroReplicationClient: class {} },
    './arena-protocol': require('../src/features/arena-fighter/arena-protocol.ts'),
    './arena-orientation-gate.native': {
      __esModule: true,
      default: 'OrientationGate',
      useArenaLandscape: () => true,
    },
    './arena-join-intent': require('../src/features/arena-fighter/arena-join-intent.ts'),
    './arena-menu-pages': { __esModule: true, default: 'MenuPage' },
    './arena-loading-screen': { __esModule: true, default: 'LoadingScreen' },
  }).default;
  const root = Screen();
  function render() {
    stateIndex = 0;
    // The screen owns the first ref, so only the menu's refs are replayed here.
    refIndex = 1;
    const menu = root.props.children;
    const nodes = [];
    function visit(node) {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach(visit);
      nodes.push(node);
      visit(node.props?.children);
    }
    visit(menu.type(menu.props));
    return nodes;
  }
  return { render, root, exits: () => exits };
}

test('title help and info actions open their pages and both Back paths return to the title', () => {
  const { render, root, exits } = menuHarness();
  for (const [testID, page] of [
    ['arena-how-to-play', 'how'],
    ['arena-info', 'info'],
  ]) {
    let nodes = render();
    nodes.find((node) => node.props?.testID === testID).props.onPress();
    nodes = render();
    assert.equal(nodes.find((node) => node.type === 'MenuPage').props.page, page);
    assert.equal(
      nodes.some((node) => node.props?.testID === 'arena-how-to-play'),
      false
    );
    if (page === 'how') nodes.find((node) => node.props?.label === 'Back').props.onPress();
    else root.props.onBack();
    nodes = render();
    assert.equal(
      nodes.some((node) => node.type === 'MenuPage'),
      false
    );
    assert.ok(nodes.some((node) => node.props?.testID === 'arena-how-to-play'));
    assert.ok(nodes.some((node) => node.props?.label === '1 Player'));
    assert.equal(exits(), 0);
  }
  render()
    .find((node) => node.props?.label === 'Back')
    .props.onPress();
  assert.equal(exits(), 1);
});

test('deferred game and QR startup show named loading screens whose Back actions cancel startup', async () => {
  const h = menuHarness();
  h.render()
    .find((node) => node.props?.label === '1 Player')
    .props.onPress();
  h.render()
    .find((node) => node.props?.label === 'Start')
    .props.onPress();
  await new Promise((resolve) => setImmediate(resolve));
  let nodes = h.render();
  let suspense = nodes.find((node) => node.type === 'Suspense');
  const controller = suspense.props.children.props.controller;
  let disposals = 0;
  controller.dispose = () => disposals++;
  assert.equal(suspense.props.fallback.type, 'LoadingScreen');
  assert.equal(suspense.props.fallback.props.title, 'Preparing the arena');
  assert.match(suspense.props.fallback.props.message, /game and camera controls/);
  suspense.props.fallback.props.onBack();
  nodes = h.render();
  assert.equal(disposals, 1);
  assert.ok(nodes.some((node) => node.props?.label === '1 Player'));
  assert.equal(
    nodes.some((node) => node.type === 'Suspense'),
    false
  );
  nodes.find((node) => node.props?.label === '2 Players').props.onPress();
  h.render()
    .find((node) => node.props?.label === 'Join')
    .props.onPress();
  h.render()
    .find((node) => node.props?.label === 'Scan QR')
    .props.onPress();
  suspense = h.render().find((node) => node.type === 'Suspense');
  assert.equal(suspense.props.fallback.props.title, 'Opening QR scanner');
  suspense.props.fallback.props.onBack();
  assert.ok(h.render().some((node) => node.props?.label === 'Join match'));
  assert.equal(h.exits(), 0);
});

test('multiplayer connection loading can be cancelled without a late result reopening AR', async () => {
  let resolveConnection, signal;
  const h = menuHarness({
    configuration: { apiKey: 'test', projectId: 'test' },
    checkConnection: (_, __, abort) => {
      signal = abort;
      return new Promise((resolve) => (resolveConnection = resolve));
    },
  });
  h.render()
    .find((node) => node.props?.label === '2 Players')
    .props.onPress();
  h.render()
    .find((node) => node.props?.label === 'Host')
    .props.onPress();
  h.render()
    .find((node) => node.props?.label === 'Host match')
    .props.onPress();
  await new Promise((resolve) => setImmediate(resolve));
  const loading = h.render().find((node) => node.type === 'LoadingScreen');
  assert.equal(loading.props.title, 'Connecting multiplayer');
  assert.match(loading.props.message, /connection/);
  loading.props.onBack();
  assert.equal(signal.aborted, true);
  resolveConnection();
  await new Promise((resolve) => setImmediate(resolve));
  const nodes = h.render();
  assert.ok(nodes.some((node) => node.props?.label === 'Host'));
  assert.equal(
    nodes.some((node) => node.type === 'LoadingScreen' || node.type === 'Suspense'),
    false
  );
});

test('compact editors omit measurements and Done while shared editor defaults remain intact', () => {
  const common = {
    'react/jsx-runtime': jsxRuntime,
    'react-native': { View: 'View', Text: 'Text', Platform: { OS: 'ios' } },
    '@expo/ui': { Host: 'Host', Slider: 'Slider' },
    '@expo/ui/swift-ui/modifiers': {
      accessibilityLabel: (value) => value,
      accessibilityValue: (value) => value,
      frame: (value) => value,
    },
    '@expo/ui/jetpack-compose/modifiers': {
      fillMaxWidth: () => ({}),
      height: (value) => value,
      semantics: (value) => value,
    },
    './ar-transform': require('../src/features/ar/ar-transform.ts'),
    './ar-control.native': { ARControl: (props) => jsx('Button', props) },
  };
  const transform = component('ar/ar-transform-controls.native.tsx', common);
  const position = component('ar/ar-position-controls.native.tsx', {
    ...common,
    './ar-transform-controls.native': transform,
  });
  const collect = (element) => {
    const nodes = [];
    function visit(node) {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach(visit);
      if (typeof node.type === 'function') return visit(node.type(node.props));
      nodes.push(node);
      visit(node.props?.children);
    }
    visit(element);
    return nodes;
  };
  for (const compact of [false, true]) {
    const transformed = collect(
      transform.ARTransformControls({
        compact,
        stacked: true,
        scale: 1,
        yaw: 0,
        height: 0,
        onPosition: () => {},
        testIDPrefix: 'test',
      })
    );
    assert.equal(
      transformed.some((node) => node.type === 'Button' && node.props.label === 'Done'),
      !compact
    );
    assert.ok(
      transformed.some((node) => node.type === 'Button' && node.props.label === 'Position')
    );
    const positioned = collect(
      position.ARPositionControls({
        compact,
        position: { x: 0.08, y: 0, z: 0 },
        testIDPrefix: 'test',
      })
    );
    assert.equal(
      positioned.some((node) => node.type === 'Text' && /cm$/.test(node.props.children)),
      !compact
    );
    assert.equal(
      positioned.some((node) => node.type === 'Button' && node.props.label === 'Done'),
      !compact
    );
    assert.equal(positioned.filter((node) => node.type === 'Slider').length, 3);
  }
});

test('the full invite appears automatically then disappears when the second player joins', () => {
  const base = new ArenaMatch('host').getSnapshot();
  const match = {
    ...base,
    connected: true,
    displayCode: 'ABC234',
    placed: true,
    assetsLoaded: 3,
    sharedPlacement: {},
  };
  assert.equal(arenaHUDState(match, { status: 'ready' }).invite, true);
  assert.equal(arenaHUDState(match, { status: 'hosting' }).invite, false);
  const joined = arenaHUDState(
    { ...match, peerConnected: true, canReady: true },
    { status: 'ready' }
  );
  assert.equal(joined.invite, false);
  assert.equal(joined.setup, true);
  assert.equal(joined.ready, true);
  assert.equal(joined.health, false);
  const aligning = arenaHUDState(
    { ...match, peerConnected: true, canReady: false },
    { status: 'ready' }
  );
  assert.equal(aligning.setup, false);
  assert.equal(aligning.controls, false);
});

test('countdown lettering and results use the local score, and draws repeat the round number', () => {
  const base = new ArenaMatch('guest').getSnapshot();
  const match = {
    ...base,
    orientationPaused: false,
    wins: { blue: 1, red: 2 },
    stage: 'countdown',
    countdown: 3,
    announcement: { id: 'cue', key: 'round4', elapsed: 0, duration: 1.2 },
  };
  assert.deepEqual(arenaAnnouncement(match), { role: 'TitleFont', text: 'Round 4' });
  assert.deepEqual(
    arenaAnnouncement({ ...match, announcement: { ...match.announcement, key: 'ready' } }),
    {
      role: 'TitleFont',
      text: 'Ready',
    }
  );
  assert.equal(arenaAnnouncement({ ...match, orientationPaused: true }), null);
  assert.equal(
    arenaAnnouncement({ ...match, announcement: null, stage: 'finished', outcome: 'red' }).text,
    'You Win 2-1'
  );
  assert.equal(
    arenaAnnouncement({ ...match, announcement: null, stage: 'finished', outcome: 'blue' }).text,
    'You Lost'
  );
  assert.equal(
    arenaAnnouncement({ ...match, announcement: null, stage: 'intermission', outcome: 'draw' })
      .text,
    'Draw'
  );
  assert.equal(arenaAnnouncement({ ...match, stage: 'countdown', outcome: null }).text, 'Round 4');
});

test('fixed invite reserves a complete white QR quiet zone and fits small landscape safe areas', () => {
  const RoomPanel = component('arena-fighter/arena-room-panel.native.tsx', {
    'react/jsx-runtime': jsxRuntime,
    'react-native': { View: 'View', Text: 'Text', ActivityIndicator: 'ActivityIndicator' },
    'react-native-qrcode-svg': { __esModule: true, default: 'QRCode' },
    './arena-protocol': require('../src/features/arena-fighter/arena-protocol.ts'),
    './arena-hud-state': { arenaInviteLayout },
    './arena-ui': { useArenaColors: () => ({}), ARENA_FONTS: {}, ArenaButton: 'Button' },
  }).default;
  for (const [width, height] of [
    [568, 320],
    [667, 375],
    [844, 390],
  ]) {
    for (const [left, right] of [
      [47, 12],
      [12, 47],
    ]) {
      const availableWidth = width - left - right,
        availableHeight = height - 21 - 10 - 60;
      const panel = RoomPanel({
        match: { displayCode: 'ABC234', rounds: 3 },
        width: availableWidth,
        height: availableHeight,
      });
      assert.ok(panel.props.style.minHeight <= availableHeight);
      const qr = panel.props.children[0];
      assert.equal(qr.props.style.padding, 12);
      assert.equal(qr.props.style.flexShrink, 0);
      assert.equal(qr.props.children.type, 'QRCode');
      const details = panel.props.children[1];
      assert.equal(details.type, 'View');
      assert.equal(details.props.children[1].props.children, 'ABC234');
      assert.equal(details.props.children[1].props.numberOfLines, 1);
      assert.equal(details.props.children[1].props.adjustsFontSizeToFit, true);
      assert.ok(
        qr.props.children.props.size + 24 + panel.props.style.padding * 2 + 20 < availableWidth
      );
      assert.ok(details.props.children.every((t) => t.props.maxFontSizeMultiplier <= 1.35));
    }
  }
});

test('Arena exit releases the live camera before its callback and other experiences keep Home defaults', async () => {
  const coordinator = createARSessionCoordinator();
  const controller = new ARSessionController(
    { checkSupport: async () => 'supported', hasCameraPermission: async () => true },
    coordinator
  );
  controller.setActive(true);
  await new Promise((resolve) => setImmediate(resolve));
  controller.reportReady(controller.getSnapshot().sessionId);
  assert.ok(coordinator.getOwner());
  let overlay,
    exits = 0,
    defaults = 0;
  const Boundary = component('ar/ar-session-boundary.native.tsx', {
    react: {
      Component: class {},
      lazy: () => null,
      Suspense: 'Suspense',
      useEffect: () => {},
      useMemo: (factory) => factory(),
      useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
      useSyncExternalStore: (_, get) => get(),
    },
    'react/jsx-runtime': jsxRuntime,
    'expo-router': { router: { dismissTo: () => defaults++ } },
    'expo-router/react-navigation': { useIsFocused: () => true },
    'react-native': {
      View: 'View',
      ScrollView: 'ScrollView',
      AppState: { currentState: 'active' },
    },
    'react-native-safe-area-context': {
      useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    },
    '@/theme/provider': { useAppTheme: () => ({ activeColors: {} }) },
    './ar-runtime.native': { nativeARRuntime: {} },
    './ar-activation': require('../src/features/ar/ar-activation.ts'),
    './ar-session-controller': {
      ARSessionController: class {
        constructor() {
          return controller;
        }
      },
    },
    './ar-status-panel': { default: 'StatusPanel' },
  }).default;
  Boundary({
    activeOverlayLayout: 'fullscreen',
    renderActiveOverlay: (controls) => {
      overlay = controls;
      return null;
    },
    onExit: () => {
      assert.equal(coordinator.getOwner(), null);
      exits++;
    },
    exitLabel: 'Back',
  });
  overlay.home();
  assert.equal(exits, 1);
  assert.equal(defaults, 0);
  assert.equal(controller.getSnapshot().status, 'inactive');
  controller.setActive(true);
  await new Promise((resolve) => setImmediate(resolve));
  Boundary({
    renderActiveOverlay: (controls) => {
      overlay = controls;
      return null;
    },
  });
  overlay.home();
  assert.equal(defaults, 1);
  assert.equal(coordinator.getOwner(), null);
});

test('bundled display lettering contains the requested slant, all messages and layered Nabla shapes', () => {
  const lettering = require('../assets/arena/ui/lettering.json');
  const provenance = require('../assets/arena/ui/font-provenance.json');
  assert.equal(provenance.secondaryAxes.slnt, -8);
  for (const asset of Object.values(lettering.TitleFont)) {
    assert.ok(asset.width > 0 && asset.height > 0);
    assert.match(asset.svg, /linearGradient/);
    assert.match(asset.svg, /__PRIMARY__/);
    assert.match(asset.svg, /__SECONDARY__/);
    assert.doesNotMatch(asset.svg, /<use\b/);
    assert.doesNotMatch(asset.svg, /\bd="\s*"/, 'spaces must not emit empty painted paths');
    for (const gradient of asset.svg.matchAll(/<linearGradient\b([^>]+)>/g)) {
      const attributes = Object.fromEntries(
        [...gradient[1].matchAll(/(\w+)="([^"]+)"/g)].map((m) => [m[1], m[2]])
      );
      assert.ok(
        attributes.x1 !== attributes.x2 || attributes.y1 !== attributes.y2,
        'glyph gradients have a nonzero extent'
      );
    }
  }
  for (const text of ['Neo', 'Fight!', 'You Lost', 'Draw', 'You Win 3-2'])
    assert.match(lettering.SecondaryTitleFont[text].svg, /<path/);
  assert.ok(
    fs.statSync(path.resolve(__dirname, '../assets/arena/ui/lettering.json')).size < 4 * 1024 * 1024
  );
});
