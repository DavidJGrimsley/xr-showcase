const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { ArenaController } = require('../src/features/arena-fighter/arena-controller.ts');
const { ArenaMatch } = require('../src/features/arena-fighter/arena-match.ts');

// Render the actual HUD's props and raw touch handlers without requiring an iOS runtime.
// Native Yoga placement, visual glow and platform touch delivery still need phone checks.
function renderHUD(patch = {}, fontScale = 1, matchState = {}, options = {}) {
  const base = new ArenaController().getSnapshot();
  const snapshot = {
    ...base,
    stage: 'fighting',
    phase: 'fighting',
    animationsRunning: true,
    canAttack: true,
    localFighter: 'blue',
    mode: 'solo',
    arenaTransform: {},
    wins: { blue: 0, red: 0 },
    blue: {
      ...base.blue,
      canPunch: true,
      canBlock: true,
      canJumpBack: true,
      ...patch,
      canUppercut: patch.canUppercut ?? patch.uppercutReady ?? base.blue.canUppercut,
    },
    ...('canAttack' in patch ? { canAttack: patch.canAttack } : {}),
    ...matchState,
  };
  const calls = [];
  const controller = {
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
    localFighter: 'blue',
    block: (...args) => calls.push(['block', ...args]),
    jumpBack: (...args) => calls.push(['hop', ...args]),
    setMovement: (...args) => calls.push(['movement', ...args]),
    attack: (...args) => {
      calls.push(['attack', ...args]);
      return true;
    },
    dispose: () => calls.push(['dispose']),
    invalidatePlacementReady: () => calls.push(['invalidateReady']),
    ready: () => calls.push(['ready']),
    swapSides: () => calls.push(['swap']),
    rematch: () => calls.push(['rematch']),
  };
  const jsx = (type, props) => ({ type, props: props ?? {} });
  let stateIndex = 0;
  const react = {
    useEffect: () => {},
    useRef: (current) => ({ current }),
    useState: (initial) => {
      const index = stateIndex++;
      return [
        options.state?.[index] ?? initial,
        (value) => {
          if (options.state) calls.push(['state', index, value]);
        },
      ];
    },
    useSyncExternalStore: (_, get) => get(),
  };
  const native = {
    StyleSheet: { create: (styles) => styles },
    View: 'View',
    Text: 'Text',
    ScrollView: 'ScrollView',
    findNodeHandle: (node) => node?.target ?? null,
    useWindowDimensions: () => ({ width: 844, height: 390, fontScale }),
  };
  const colors = { primary: '#4af', secondary: '#a78bfa', surface: '#222', text: '#fff' };
  const source = fs.readFileSync(
    path.resolve(__dirname, '../src/features/arena-fighter/arena-hud.tsx'),
    'utf8'
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
    __DEV__: false,
    require: (name) => {
      if (name === '@expo/vector-icons/MaterialCommunityIcons')
        return { __esModule: true, default: 'Icon' };
      if (name === '@expo/vector-icons/FontAwesome6')
        return { __esModule: true, default: 'FontAwesomeIcon' };
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
      if (name === 'react-native') return native;
      if (name === '@/ui/game-text') return { GameCopy: 'Text' };
      if (name === 'react-native-safe-area-context')
        return { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
      if (name === '@/theme/provider') return { useAppTheme: () => ({ activeColors: colors }) };
      if (name === './arena-ui')
        return {
          useArenaColors: () => colors,
          ARENA_FONTS: { body: 'Noto', mono: 'NotoMono' },
          ArenaButton: ({ label, onPress, ...rest }) =>
            jsx('View', {
              ...rest,
              accessibilityRole: 'button',
              accessibilityLabel: label,
              onPress,
              children: jsx('Text', { children: label }),
            }),
          ArenaDisplayText: ({ text }) => jsx('Text', { children: text }),
        };
      if (name === './arena-room-panel.native')
        return {
          __esModule: true,
          default: (props) => jsx('View', { ...props, testID: 'arena-invite' }),
          ArenaGuidance: (props) => jsx('View', { ...props, testID: 'arena-guidance' }),
        };
      if (name === './arena-transform-controls.native')
        return {
          __esModule: true,
          default: (props) => jsx('View', { ...props, testID: 'arena-transform' }),
        };
      if (name === '@expo/ui')
        return { Host: 'Host', Button: 'Button', Picker: 'Picker', Row: 'Row' };
      if (
        [
          './arena-controller',
          './arena-touch-input',
          './arena-control-layout',
          './arena-hud-state',
        ].includes(name)
      )
        return require('../src/features/arena-fighter/' + name.slice(2) + '.ts');
      return { default: () => null };
    },
  });
  const controls = new Map(),
    texts = [],
    icons = [],
    views = [];
  function visit(element) {
    if (!element || typeof element !== 'object') return;
    if (Array.isArray(element)) {
      element.forEach(visit);
      return;
    }
    if (typeof element.type === 'function') {
      visit(element.type(element.props));
      return;
    }
    const props = element.props;
    if (!props) return;
    if (
      props.testID?.match(/^arena-(punch|uppercut|advance|strafeLeft|strafeRight|jump-back|block)$/)
    ) {
      props.ref.current = { target: controls.size + 1 };
      controls.set(props.testID, props);
    }
    if (element.type === 'Text') texts.push(props);
    if (element.type === 'Icon' || element.type === 'FontAwesomeIcon')
      icons.push({ type: element.type, ...props });
    if (element.type === 'View') views.push(props);
    visit(props.children);
  }
  visit(
    module.exports.default({
      controller,
      room: options.room,
      controls: { home: () => calls.push(['exit']), restartAR: () => calls.push(['restart']) },
    })
  );
  return { controls, texts, views, calls, icons };
}

test('Uppercut sits left of Punch/Block, spans both rows and uses one upward fist with progress below', () => {
  const h = renderHUD({ punchProgress: 3, uppercutReady: true });
  const uppercut = h.controls.get('arena-uppercut').style;
  const punch = h.controls.get('arena-punch').style;
  const block = h.controls.get('arena-block').style;
  assert.ok(uppercut.left < punch.left);
  assert.equal(punch.left, block.left);
  assert.equal(uppercut.top, block.top);
  assert.equal(uppercut.top + uppercut.height, punch.top + punch.height);
  assert.equal(
    h.icons.filter((icon) => icon.type === 'FontAwesomeIcon' && icon.name === 'hand-fist').length,
    1
  );
  assert.equal(
    h.icons.some((icon) => icon.name === 'arrow-up'),
    false
  );
  assert.equal(
    h.texts.find((text) => text.accessibilityLabel === 'Uppercut progress 3 of 3').style.bottom,
    12
  );
});

test('actual HUD combat targets retain dimensions and labels across disabled, reward and hit states', () => {
  for (const fontScale of [1, 2]) {
    const states = [
      {},
      { punchProgress: 2 },
      { punchProgress: 3, uppercutReady: true },
      { punchProgress: 0, canAttack: false, mode: 'hit' },
      { mode: 'launch', canAttack: false },
      { mode: 'guard', guardState: 'raising', guardHeld: true, guardStamina: 98, canAttack: false },
      {
        mode: 'guard',
        guardState: 'holding',
        guardHeld: true,
        guardStamina: 40,
        punchProgress: 3,
        uppercutReady: true,
        canAttack: false,
      },
      { mode: 'guard-exit', guardState: 'lowering', guardHeld: false, guardStamina: 40 },
      {
        mode: 'guard-break',
        guardState: 'exhausted',
        guardStamina: 0,
        canAttack: false,
        canBlock: false,
      },
      { mode: 'hop', canAttack: false, canBlock: false, canJumpBack: false },
      { mode: 'settling', canAttack: false, canBlock: false, canJumpBack: false },
      { mode: 'landing', canAttack: false, canBlock: false, canJumpBack: false },
    ];
    const renders = states.map((state) => renderHUD(state, fontScale));
    for (const key of [
      'arena-punch',
      'arena-uppercut',
      'arena-advance',
      'arena-strafeLeft',
      'arena-strafeRight',
      'arena-jump-back',
      'arena-block',
    ]) {
      const first = renders[0].controls.get(key);
      assert.ok(first.style.width >= 44 && first.style.height >= 44);
      for (const rendered of renders) {
        const props = rendered.controls.get(key);
        assert.equal(props.style.width, first.style.width);
        assert.equal(props.style.height, first.style.height);
        assert.equal(props.style.left, first.style.left);
        assert.equal(props.style.top, first.style.top);
        assert.equal(props.accessibilityLabel, first.accessibilityLabel);
      }
    }
    assert.ok(
      renders[2].texts.some((props) => props.accessibilityLabel === 'Uppercut progress 3 of 3')
    );
    assert.ok(
      renders.every(
        (rendered) => !rendered.texts.some((props) => String(props.children).includes('Uppercut!'))
      )
    );
  }
});

test('scanning, alignment, placement and loading show only Back and the guidance pill', () => {
  for (const status of ['placing', 'scanning', 'hosting', 'aligning']) {
    const room = {
      subscribe: () => () => {},
      getSnapshot: () => ({ status, message: 'Move slowly. Scan a table or floor.' }),
    };
    const h = renderHUD(
      {},
      2,
      { stage: 'lobby', phase: 'idle', placed: status === 'hosting', assetsLoaded: 0 },
      { room }
    );
    assert.equal(h.controls.size, 0);
    assert.equal(
      h.views.some((v) => v.testID === 'arena-actions'),
      false
    );
    assert.equal(
      h.views.some((v) => v.testID === 'arena-guidance'),
      true
    );
    assert.deepEqual(
      h.views.filter((v) => v.accessibilityRole === 'button').map((v) => v.accessibilityLabel),
      ['Back']
    );
    assert.equal(h.views.filter((v) => v.accessibilityRole === 'progressbar').length, 0);
  }
});

test('setup actions are compact, guests have no host actions, and Ready becomes a waiting state', () => {
  const placed = {
    stage: 'lobby',
    placed: true,
    assetsLoaded: 3,
    error: null,
    canReady: true,
    canTransform: true,
  };
  const labels = (h) =>
    h.views.filter((v) => v.accessibilityRole === 'button').map((v) => v.accessibilityLabel);
  assert.deepEqual(labels(renderHUD({}, 1, placed)), [
    'Back',
    'Ready',
    'Swap Sides',
    'Transform',
    'Restart AR',
  ]);
  const guest = renderHUD({}, 1, { ...placed, mode: 'guest', canTransform: false });
  assert.deepEqual(labels(guest), ['Back', 'Ready', 'Restart AR']);
  const waiting = renderHUD({}, 1, { ...placed, localReady: true });
  assert.equal(labels(waiting).includes('Ready'), false);
  assert.equal(
    waiting.texts.some((t) => t.children === 'Waiting for opponent…'),
    true
  );
  assert.equal(waiting.views.filter((v) => v.accessibilityRole === 'progressbar').length, 0);
});

test('the host can open Transform after placement throughout scan, upload, invite and guest alignment', () => {
  const scope = { sessionToken: 1, placementVersion: 2 };
  for (const status of ['scanning', 'hosting', 'ready', 'aligning', 'error']) {
    const room = {
      subscribe: () => () => {},
      getSnapshot: () => ({ status, message: 'Preparing shared arena' }),
    };
    const match = {
      ...scope,
      mode: 'host',
      stage: 'lobby',
      phase: 'setup',
      placed: true,
      assetsLoaded: 3,
      canTransform: true,
      connected: true,
      displayCode: 'ABC234',
      sharedPlacement: {},
      peerConnected: false,
      canReady: false,
    };
    const h = renderHUD({}, 1, match, { room, state: [null, false] });
    const button = h.views.find((v) => v.accessibilityLabel === 'Transform');
    assert.ok(button, status);
    assert.equal(button.disabled, false);
    assert.equal(
      h.views.some((v) => v.accessibilityLabel === 'Ready'),
      false
    );
    assert.equal(
      h.views.some((v) => v.accessibilityLabel === 'Restart AR'),
      false
    );
    assert.equal(
      h.views.some((v) => v.testID === 'arena-invite'),
      status === 'ready'
    );
    button.onPress();
    assert.deepEqual(h.calls[0], ['invalidateReady']);
    assert.equal(JSON.stringify(h.calls.at(-1)), JSON.stringify(['state', 0, scope]));
    const editing = renderHUD({}, 1, match, { room, state: [scope, false] });
    assert.ok(editing.views.some((v) => v.testID === 'arena-transform'));
    assert.equal(
      editing.views.some((v) => v.testID === 'arena-invite'),
      false
    );
    const positioning = renderHUD({}, 1, match, { room, state: [scope, true] });
    assert.equal(positioning.views.find((v) => v.testID === 'arena-transform').positioning, true);
  }
});

test('host Transform waits for loading and tracking and is absent before placement or during combat', () => {
  const match = { mode: 'host', stage: 'lobby', phase: 'setup', placed: true, canTransform: false };
  const h = renderHUD({}, 1, match);
  const button = h.views.find((v) => v.accessibilityLabel === 'Transform');
  assert.equal(button.disabled, true);
  button.onPress();
  assert.deepEqual(h.calls, []);
  for (const patch of [{ placed: false }, { mode: 'guest' }, { stage: 'fighting' }]) {
    const hidden = renderHUD({}, 1, { ...match, ...patch });
    assert.equal(
      hidden.views.some((v) => v.accessibilityLabel === 'Transform'),
      false
    );
  }
});

test('external Back steps Position to Transform to controls, then cancels the room and exits', () => {
  const match = {
    stage: 'finished',
    outcome: 'blue',
    sessionToken: 1,
    placementVersion: 2,
    canTransform: true,
    canRematch: true,
    wins: { blue: 1, red: 0 },
  };
  const scope = { sessionToken: 1, placementVersion: 2 };
  const positioned = renderHUD({}, 1, match, { state: [scope, true] });
  positioned.views.find((v) => v.testID === 'arena-back').onPress();
  assert.deepEqual(positioned.calls, [['state', 1, false]]);
  assert.equal(
    positioned.texts.some((t) => t.children === 'You Win 1-0'),
    false
  );
  const editor = renderHUD({}, 1, match, { state: [scope, false] });
  editor.views.find((v) => v.testID === 'arena-back').onPress();
  assert.deepEqual(editor.calls, [
    ['state', 0, null],
    ['state', 1, false],
  ]);
  let disposed = false;
  const room = {
    subscribe: () => () => {},
    getSnapshot: () => ({ status: 'ready' }),
    dispose: () => {
      disposed = true;
    },
  };
  const controls = renderHUD({}, 1, match, { room });
  assert.equal(
    controls.texts.some((t) => t.children === 'You Win 1-0'),
    true
  );
  controls.views.find((v) => v.accessibilityLabel === 'Transform').onPress();
  assert.deepEqual(controls.calls[0], ['invalidateReady']);
  controls.views.find((v) => v.testID === 'arena-back').onPress();
  assert.equal(disposed, true);
  assert.deepEqual(controls.calls.slice(-2), [['dispose'], ['exit']]);
});

test('disabled Uppercut ignores touch-down while an earned button accepts only one action per held touch', () => {
  const event = { nativeEvent: { changedTouches: [{ identifier: 'one', target: '7' }] } };
  const disabled = renderHUD();
  disabled.controls.get('arena-uppercut').onTouchStart(event);
  assert.deepEqual(disabled.calls, []);
  const ready = renderHUD({ punchProgress: 3, uppercutReady: true });
  const uppercut = ready.controls.get('arena-uppercut');
  uppercut.onTouchStart(event);
  uppercut.onTouchStart(event);
  assert.equal(ready.calls.length, 1);
  assert.equal(ready.calls[0][1], 'uppercut');
  uppercut.onTouchEnd(event);
  uppercut.onTouchStart(event);
  assert.equal(ready.calls.length, 2);
});

test('a movement finger stays held while a separate finger punches and releases', () => {
  const h = renderHUD();
  const batch = {
    nativeEvent: {
      changedTouches: [
        { identifier: 'move', target: '4' },
        { identifier: 'attack', target: '6' },
      ],
    },
  };
  const advance = h.controls.get('arena-advance'),
    punch = h.controls.get('arena-punch');
  advance.onTouchStart(batch);
  punch.onTouchStart(batch);
  assert.equal(h.calls[0][2], true);
  assert.equal(h.calls[1][1], 'punch');
  const releaseAttack = { nativeEvent: { changedTouches: [batch.nativeEvent.changedTouches[1]] } };
  punch.onTouchEnd(releaseAttack);
  advance.onTouchEnd(releaseAttack);
  assert.equal(h.calls.at(-1)[2], true);
  advance.onTouchCancel({ nativeEvent: { changedTouches: [batch.nativeEvent.changedTouches[0]] } });
  assert.equal(h.calls.at(-1)[2], false);
});

test('the cue is absolute and non-interactive while progress reserves the same anchored row', () => {
  for (const fontScale of [1, 2]) {
    const idle = renderHUD({}, fontScale);
    const ready = renderHUD({ punchProgress: 3, uppercutReady: true }, fontScale);
    const glow = ready.views.find((props) => props.testID === 'arena-uppercut-cue');
    assert.equal(glow.pointerEvents, 'none');
    assert.equal(glow.style.position, 'absolute');
    assert.equal(glow.style.inset, -2);
    assert.equal(
      idle.views.some((props) => props.testID === 'arena-uppercut-cue'),
      false
    );
    const row = (h) =>
      h.texts.find((props) => props.accessibilityLabel?.startsWith('Uppercut progress'));
    assert.equal(row(idle).style.height, row(ready).style.height);
    assert.equal(row(ready).pointerEvents, 'none');
    const anchor = (h) => h.views.find((props) => props.testID === 'arena-hud');
    assert.equal(JSON.stringify(anchor(idle).style), JSON.stringify(anchor(ready).style));
    assert.equal(anchor(ready).style.paddingBottom, 10);
    assert.equal(anchor(ready).style.paddingLeft, 12);
    assert.equal(anchor(ready).style.paddingRight, 12);
  }
});

test('Block tracks independent fingers and Jump Back fires once per touch-down', () => {
  const h = renderHUD(),
    block = h.controls.get('arena-block'),
    hop = h.controls.get('arena-jump-back');
  const event = (id, target) => ({ nativeEvent: { changedTouches: [{ identifier: id, target }] } });
  block.onTouchStart(event('a', '5'));
  block.onTouchStart(event('b', '5'));
  assert.equal(h.calls.length, 1);
  assert.deepEqual(h.calls[0].slice(0, 2), ['block', true]);
  block.onTouchEnd(event('a', '5'));
  assert.equal(h.calls.length, 1);
  block.onTouchEnd(event('b', '5'));
  assert.equal(h.calls.at(-1)[1], false);
  hop.onTouchStart(event('h', '3'));
  hop.onTouchStart(event('h', '3'));
  assert.equal(h.calls.filter((c) => c[0] === 'hop').length, 1);
  hop.onTouchEnd(event('h', '3'));
  hop.onTouchStart(event('new', '3'));
  assert.equal(h.calls.filter((c) => c[0] === 'hop').length, 2);
});

test('the actual HUD shows no victory result text until both stretches and the Uppercut finish', () => {
  const match = new ArenaMatch('solo', 1, () => 0, {
    cpuEnabled: false,
    spawn: 0.04,
    health: 8,
    punchHitstop: 0,
  });
  const token = match.attachSession(1);
  function tick(seconds) {
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      for (const id of ['blue', 'red'])
        match.animationApplied(id, match.getSnapshot()[id].animationId);
      match.tick(token, 1 / 60);
    }
  }
  match.setLandscape(true);
  match.setTracking(token, true);
  match.setPlacement(token, true);
  for (const asset of ['arena', 'blue', 'red'])
    match.assetLoaded(token, match.getSnapshot().placementVersion, asset);
  tick(0.5);
  match.ready();
  tick(3.1);
  match.attack('punch');
  const text = () =>
    JSON.stringify(renderHUD({}, 1, match.getSnapshot()).texts.map((props) => props.children));
  tick(0.5);
  assert.doesNotMatch(text(), /You Win|You Lost/);
  tick(0.75);
  const first = match.getSnapshot().blue.animationId;
  assert.equal(match.getSnapshot().blue.clip, 'Victory');
  assert.doesNotMatch(text(), /You Win|You Lost/);
  tick(2.35);
  assert.notEqual(match.getSnapshot().blue.animationId, first);
  assert.equal(match.getSnapshot().blue.clip, 'Victory');
  assert.doesNotMatch(text(), /You Win|You Lost/);
  tick(2.3);
  assert.equal(match.getSnapshot().blue.clip, 'VictoryUppercut');
  assert.equal(match.getSnapshot().outcome, null);
  assert.doesNotMatch(text(), /You Win|You Lost/);
  tick(1.8);
  assert.equal(match.getSnapshot().stage, 'presenting');
  assert.doesNotMatch(text(), /You Win|You Lost/);
  tick(0.2);
  assert.equal(match.getSnapshot().stage, 'finished');
  assert.match(text(), /You Win 1-0/);
});
