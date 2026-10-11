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
const jsx = (type, props, key) => ({ type, props, key });
const jsxRuntime = { jsx, jsxs: jsx, Fragment: 'Fragment' };

function menuHarness({
  fontsLoaded = true,
  configuration = null,
  checkConnection = async () => {},
  replicationClient = class {},
  viewport = { width: 568, height: 320, fontScale: 1 },
  safeArea = { top: 0, bottom: 0, left: 0, right: 0 },
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
      useSyncExternalStore: (_, get) => get(),
    },
    'react/jsx-runtime': jsxRuntime,
    'expo-router': { router: { dismissTo: () => exits++ }, useLocalSearchParams: () => ({}) },
    'react-native': {
      StyleSheet: { create: (styles) => styles },
      ActivityIndicator: 'ActivityIndicator',
      ScrollView: 'ScrollView',
      Text: 'Text',
      TextInput: 'TextInput',
      View: 'View',
      useWindowDimensions: () => viewport,
    },
    'react-native-safe-area-context': {
      useSafeAreaInsets: () => safeArea,
    },
    'react-native-keyboard-controller': { KeyboardAvoidingView: 'KeyboardAvoidingView' },
    '@/ui/game-invite-field': { GameInviteField: 'InviteField' },
    '@/ui/game-text': { GameCopy: 'Text' },
    './arena-ui': {
      ARENA_FONTS: {},
      ArenaButton: 'Button',
      ArenaDisplayText: 'DisplayText',
      ArenaMenuBackground: 'Background',
      useArenaColors: () => ({}),
      useArenaFonts: () => [fontsLoaded, null],
    },
    './arena-match': { ArenaMatch },
    './arena-remote-room': require('../src/features/arena-fighter/arena-remote-room.ts'),
    './arena-room-panel.native': {
      __esModule: true,
      default: 'RoomPanel',
      ArenaGuidance: 'Guidance',
    },
    './use-arena-audio.native': { useArenaAudio: () => {} },
    './arena-audio-picker.native': { __esModule: true, default: 'AudioPicker' },
    './arena-configuration': { arenaConfiguration: () => configuration },
    './arena-connection': { checkArenaConnection: checkConnection },
    '@reactvision/react-viro': { ViroReplicationClient: replicationClient },
    'expo-modules-core': { uuid: { v4: () => '550e8400-e29b-41d4-a716-446655440000' } },
    './arena-protocol': require('../src/features/arena-fighter/arena-protocol.ts'),
    './arena-invite': require('../src/features/arena-fighter/arena-invite.ts'),
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
      if (typeof node.type === 'function') return visit(node.type(node.props));
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

test('all arena menu paths keep a bounded card, start each page at the top, and retain round, audio and invitation controls', () => {
  for (const viewport of [
    { width: 568, height: 320, fontScale: 1 },
    { width: 844, height: 390, fontScale: 1.8 },
    { width: 1194, height: 834, fontScale: 1 },
  ]) {
    const safeArea = { top: 0, bottom: 21, left: 47, right: 12 };
    const h = menuHarness({ viewport, safeArea });
    const press = (label) =>
      h
        .render()
        .find((node) => node.props?.label === label)
        .props.onPress();
    const expectedWidth = Math.min(520, viewport.width - 47 - 24);
    const checkPage = (page, space = 'same-space') => {
      const rendered = h.render();
      const card = rendered.find((node) => node.props?.testID === 'arena-menu-panel');
      const scroll = rendered.find((node) => node.props?.testID === 'arena-menu-scroll');
      assert.equal(card.props.style.width, expectedWidth);
      assert.equal(card.props.style.height, undefined);
      assert.equal(scroll.key, `${page}:${space}`);
      assert.equal(scroll.props.style.flex, 1);
      return rendered;
    };
    checkPage('title');
    press('1 Player');
    checkPage('solo');
    press('Best of 5');
    assert.equal(h.render().find((node) => node.props?.label === 'Best of 5').props.selected, true);
    press('Back');
    press('2 Players');
    checkPage('two');
    for (const [mode, space] of [
      ['Same table', 'same-space'],
      ['Long distance', 'remote'],
    ]) {
      press(mode);
      checkPage('mode', space);
      press('Host');
      const host = checkPage('host', space);
      assert.equal(
        host.some((node) => node.type === 'AudioPicker'),
        space === 'same-space'
      );
      assert.equal(
        host.some((node) => node.type === 'DisplayText'),
        space === 'remote'
      );
      assert.ok(
        host.some(
          (node) => node.props?.label === (space === 'remote' ? 'Create room' : 'Host match')
        )
      );
      press('1 round');
      assert.equal(h.render().find((node) => node.props?.label === '1 round').props.selected, true);
      press('Back');
      press('Join');
      let join = checkPage('join', space);
      assert.equal(
        join.some((node) => node.type === 'DisplayText'),
        false
      );
      const input = join.find((node) => node.type === 'InviteField');
      assert.equal(input.props.width, expectedWidth - 16);
      assert.equal(input.props.maxLength, space === 'remote' ? 16 : 12);
      input.props.onChange('ABC234');
      press('Scan QR');
      const scanner = h.render().find((node) => node.type === 'Suspense');
      scanner.props.children.props.onClose();
      join = checkPage('join', space);
      assert.equal(join.find((node) => node.type === 'InviteField').props.value, 'ABC234');
      press('Back');
      checkPage('mode', space);
      press('Back');
      checkPage('two', space);
    }
    press('Back');
    checkPage('title', 'remote');
  }
});

test('long-distance hosting publishes a lobby invite before entering AR and retains the room on Place arena', async () => {
  const entities = new Map(),
    listeners = new Set();
  let connections = 0,
    disconnects = 0;
  const h = menuHarness({
    configuration: { projectId: 'test' },
    replicationClient: class {
      state = 'idle';
      localPeerId = 'host';
      subscribe(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
      }
      emit() {
        for (const fn of [...listeners]) fn();
      }
      connect() {
        connections++;
        this.state = 'synced';
        this.emit();
      }
      disconnect() {
        disconnects++;
        this.state = 'idle';
        this.emit();
      }
      get(id) {
        return entities.get(id);
      }
      claim(id) {
        entities.set(id, { owner: 'host', fields: {} });
        this.emit();
      }
      set(id, fields) {
        entities.set(id, { ...entities.get(id), fields });
        this.emit();
      }
      release() {}
    },
  });
  const press = (label) =>
    h
      .render()
      .find((node) => node.props?.label === label)
      .props.onPress();
  press('2 Players');
  press('Long distance');
  press('Host');
  assert.equal(
    h.render().some((node) => node.type === 'AudioPicker'),
    false
  );
  press('Create room');
  await new Promise((resolve) => setImmediate(resolve));
  try {
    const lobby = h.render();
    assert.ok(lobby.some((node) => node.type === 'RoomPanel'));
    assert.equal(
      lobby.some((node) => node.type === 'Suspense'),
      false
    );
    assert.ok(entities.get('host').fields.packet);
    const panel = lobby.find((node) => node.type === 'RoomPanel');
    assert.equal(panel.props.match.space, 'remote');
    assert.match(panel.props.match.displayCode, /^[A-Z2-9]{4} [A-Z2-9]{4} [A-Z2-9]{4}$/);
    press('Place arena');
    const experience = h.render().find((node) => node.type === 'Suspense').props.children;
    assert.ok(experience.props.remoteRoom);
    assert.equal(experience.props.controller.space, 'remote');
    assert.equal(connections, 1);
    assert.equal(disconnects, 0);
    experience.props.onBack();
    assert.equal(disconnects, 1);
  } finally {
    const lobby = h.render().find((node) => node.type?.name === 'RemoteLobby');
    lobby?.props.onBack();
    const experience = h.render().find((node) => node.type === 'Suspense')?.props.children;
    experience?.props.onBack();
  }
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
    .find((node) => node.props?.label === 'Same table')
    .props.onPress();
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
    .find((node) => node.props?.label === 'Same table')
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
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ left: 0, right: 0 }) },
    '@/ui/game-text': { GameText: 'Text' },
    '@/ui/game-progress': { GameProgress: 'Progress' },
    'react-native-qrcode-svg': { __esModule: true, default: 'QRCode' },
    './arena-protocol': require('../src/features/arena-fighter/arena-protocol.ts'),
    './arena-invite': require('../src/features/arena-fighter/arena-invite.ts'),
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
      assert.ok(
        details.props.children.filter(Boolean).every((t) => t.props.maxFontSizeMultiplier <= 1.35)
      );
    }
  }
});

test('scan guidance reserves text space with and without a spinner, lets surface taps through, and keeps recovery actions active', () => {
  const { ArenaGuidance } = component('arena-fighter/arena-room-panel.native.tsx', {
    'react/jsx-runtime': jsxRuntime,
    'react-native': { View: 'View', Text: 'Text', useWindowDimensions: () => ({ width: 844 }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ left: 47, right: 12 }) },
    '@/ui/game-text': { GameText: 'GuidanceText' },
    '@/ui/game-progress': { GameProgress: 'Progress' },
    'react-native-qrcode-svg': { __esModule: true, default: 'QRCode' },
    './arena-invite': require('../src/features/arena-fighter/arena-invite.ts'),
    './arena-hud-state': { arenaInviteLayout },
    './arena-ui': { useArenaColors: () => ({}), ARENA_FONTS: {}, ArenaButton: 'Button' },
  });
  const calls = [];
  for (const width of [200, 420, 785, undefined]) {
    for (const loading of [false, true]) {
      const root = ArenaGuidance({
        message: 'Tap a highlighted surface to place the arena.',
        width,
        loading,
        onRetry: () => calls.push('retry'),
        onRestart: () => calls.push('restart'),
      });
      const panelWidth = Math.min(420, width ?? 785);
      assert.equal(root.props.style.width, panelWidth);
      assert.equal(root.props.pointerEvents, 'box-none');
      const [pill, actions] = root.props.children;
      assert.equal(pill.props.pointerEvents, 'none');
      const text = pill.props.children.find((node) => node?.type === 'GuidanceText');
      assert.ok(text.props.style.width >= 130);
      assert.equal(text.props.style.width + 36 + (loading ? 34 : 0), panelWidth);
      assert.equal(text.props.children, 'Tap a highlighted surface to place the arena.');
      assert.equal(actions.props.pointerEvents, 'box-none');
      actions.props.children.forEach((node) => node.props.onPress());
    }
  }
  assert.equal(calls.length, 16);
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
      StyleSheet: { create: (styles) => styles },
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
