const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { MedicalController } = require('../src/features/medical-viewer/medical-controller.ts');
const { parseMedicalSliceDataset } = require('../src/features/medical-viewer/medical-slices.ts');
const { parseMedicalVolumeDataset } = require('../src/features/medical-viewer/medical-volumes.ts');
const colors = {
  primary: '#60a5fa',
  secondary: '#a78bfa',
  background: '#09090b',
  surface: '#18181b',
  text: '#f8fafc',
};
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const flatten = (style) =>
  Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : (style ?? {});
const ui = Object.fromEntries(
  [
    'Host',
    'Column',
    'Row',
    'RNHostView',
    'ScrollView',
    'BottomSheet',
    'Button',
    'Text',
    'Slider',
    'Switch',
  ].map((name) => [name, name])
);
const modifiers = Object.fromEntries(
  [
    'frame',
    'onGeometryChange',
    'preferredColorScheme',
    'fillMaxHeight',
    'fillMaxWidth',
    'onSizeChanged',
    'accessibilityLabel',
    'accessibilityValue',
    'height',
    'semantics',
    'disabled',
    'fixedSize',
    'pickerStyle',
    'tag',
  ].map((name) => [name, (value) => ({ name, value })])
);
function load(
  file,
  {
    viewport = { width: 390, height: 844, fontScale: 1 },
    platform = 'ios',
    overrides = {},
    expose = '',
  } = {}
) {
  let index = 0;
  const states = [];
  const callbacks = new Map();
  let nextFrame = 0;
  const react = {
    lazy: () => 'Lazy',
    Suspense: 'Suspense',
    createContext: (value) => ({ value, Provider: 'Provider' }),
    useContext: (context) => context.value,
    useState: (initial) => {
      const slot = index++;
      if (!(slot in states)) states[slot] = typeof initial === 'function' ? initial() : initial;
      return [
        states[slot],
        (value) => {
          states[slot] = typeof value === 'function' ? value(states[slot]) : value;
        },
      ];
    },
    useEffect: () => {},
    useSyncExternalStore: (_, get) => get(),
  };
  const native = {
    Platform: { OS: platform, Version: 26 },
    StyleSheet: { create: (value) => value },
    View: 'View',
    Text: 'RNText',
    Pressable: 'Pressable',
    useWindowDimensions: () => viewport,
    NativeModules: {},
    TurboModuleRegistry: { get: () => null },
  };
  const mocks = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    '@expo/ui': { ...ui, Picker: Object.assign('Picker', { Item: 'PickerItem' }) },
    '@expo/ui/swift-ui': { Picker: 'NativePicker', Text: 'NativeText' },
    '@expo/ui/jetpack-compose': {
      DropdownMenu: 'DropdownMenu',
      DropdownMenuItem: 'DropdownMenuItem',
    },
    '@expo/ui/swift-ui/modifiers': modifiers,
    '@expo/ui/jetpack-compose/modifiers': modifiers,
    'react-native': native,
    'react-native-safe-area-context': {
      useSafeAreaInsets: () => ({ top: 24, bottom: 20, left: 0, right: 0 }),
    },
    '@/theme/provider': { useAppTheme: () => ({ activeColors: colors, colors: { dark: colors } }) },
    '@/ui/use-game-window-dimensions': { useGameWindowDimensions: () => viewport },
    '@/ui/game-button': { GameButton: 'GameButton' },
    '@/ui/game-text': { GameCopy: 'Copy', GameText: 'Copy' },
    '@/ui/game-progress': { GameProgress: 'Progress' },
    './medical-ui': {
      MedicalControl: 'Control',
      MedicalWidthProvider: 'WidthProvider',
      useMedicalColors: () => colors,
    },
    './medical-sheet.native': { MedicalSheet: 'Sheet' },
    '@/features/ar/ar-transform-controls.native': { ARTransformControls: 'Transform' },
    '@/features/ar/ar-session-boundary': { default: 'ARBoundary' },
    'expo-router/stack': {
      Stack: Object.assign('Stack', {
        Screen: 'StackScreen',
        Toolbar: Object.assign('Toolbar', { Button: 'ToolbarButton' }),
      }),
    },
    './medical-info.native': { MedicalInfoButton: 'InfoButton', MedicalInfoModal: 'InfoModal' },
    './medical-model-picker.native': { MedicalModelPicker: 'ModelPicker' },
    './medical-model-availability': { default: 'AvailabilityPicker' },
    './medical-transform-controls.native': { MedicalTransformControls: 'AnatomyTransform' },
    './medical-slice-controls.native': {
      MedicalSliceControls: 'Slices',
      MedicalPanelTransformControls: 'PanelTransform',
    },
    './medical-volume-controls.native': {
      MedicalVolumeControls: 'Volume',
      MedicalVolumeSheet: 'VolumeSheet',
      MedicalVolumeTransformControls: 'VolumeTransform',
    },
    './medical-controller': require('../src/features/medical-viewer/medical-controller.ts'),
    './medical-models': require('../src/features/medical-viewer/medical-models.ts'),
    './medical-slices': require('../src/features/medical-viewer/medical-slices.ts'),
    './medical-volumes': require('../src/features/medical-viewer/medical-volumes.ts'),
    './medical-volume-stack': require('../src/features/medical-viewer/medical-volume-stack.ts'),
    './medical-volume-uniforms': require('../src/features/medical-viewer/medical-volume-uniforms.ts'),
    './medical-slice-assets.native': {},
    './medical-volume-assets.native': {},
    'expo-constants': { default: { nativeAppVersion: 'test', nativeBuildVersion: 'test' } },
    '@reactvision/react-viro/package.json': { version: '3.0.3' },
    '../../../assets/medical/stack/metadata.json': require('../assets/medical/stack/metadata.json'),
    ...overrides,
  };
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src', file), 'utf8') + expose, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      module,
      exports: module.exports,
      requestAnimationFrame: (callback) => {
        const id = ++nextFrame;
        callbacks.set(id, callback);
        return id;
      },
      cancelAnimationFrame: (id) => callbacks.delete(id),
      require: (name) => {
        if (!(name in mocks)) throw new Error('Missing mock ' + name);
        return mocks[name];
      },
    }
  );
  return {
    exports: module.exports,
    viewport,
    render: (name, props) => {
      index = 0;
      return module.exports[name](props);
    },
    flush: () => {
      for (const callback of callbacks.values()) callback();
      callbacks.clear();
    },
  };
}
function nodes(root) {
  const result = [];
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(walk);
    result.push(node);
    walk(node.props?.children);
  }
  walk(root);
  return result;
}
const byID = (root, id) => nodes(root).find((node) => node.props.testID === id);

test('dense transforms retain all three sliders and completion actions, including large-text layouts', () => {
  const h = load('features/ar/ar-transform-controls.native.tsx', {
    overrides: {
      './ar-transform': require('../src/features/ar/ar-transform.ts'),
      './ar-control.native': { ARControl: 'Control' },
    },
  });
  for (const stacked of [false, true]) {
    const changes = [];
    let repositioned = 0;
    let done = 0;
    const root = h.render('ARTransformControls', {
      testIDPrefix: 'medical',
      scale: 1,
      yaw: 90,
      height: 0,
      dense: true,
      stacked,
      disabled: false,
      pinching: false,
      rotating: false,
      repositionDisabled: false,
      onScaleChange: (value) => changes.push(['scale', value]),
      onYawChange: (value) => changes.push(['yaw', value]),
      onHeightChange: (value) => changes.push(['height', value]),
      onReposition: () => repositioned++,
      onDone: () => done++,
    });
    const fields = nodes(root).filter((n) => n.type?.name === 'ARTransformSlider');
    assert.deepEqual(
      fields.map((n) => n.props.label),
      ['Scale', 'Rotate', 'Height']
    );
    for (const field of fields) {
      const slider = nodes(h.render('ARTransformSlider', field.props)).find(
        (n) => n.type === 'Slider'
      );
      slider.props.onValueChange(0.5);
    }
    assert.deepEqual(changes, [
      ['scale', 0.5],
      ['yaw', 0.5],
      ['height', 0.5],
    ]);
    byID(root, 'medical-reposition').props.onPress();
    byID(root, 'medical-transform-done').props.onPress();
    assert.equal(repositioned, 1);
    assert.equal(done, 2);
  }
});
function viewer() {
  const c = new MedicalController(
    undefined,
    parseMedicalSliceDataset(require('../assets/medical/slices/metadata.json')),
    parseMedicalVolumeDataset(require('../assets/medical/volumes/metadata.json'))
  );
  c.attach(1);
  c.setTracking(1, true);
  c.selectPlane(1, c.getSnapshot().placementRevision, 'table');
  const s = c.getSnapshot();
  for (const asset of ['brain', 'half-skull'])
    c.finishLoad(
      {
        sessionId: 1,
        modelId: s.modelId,
        placementRevision: s.placementRevision,
        loadAttempt: s.loadAttempt,
      },
      asset,
      true
    );
  return c;
}
function readyVolume(c) {
  const s = c.getSnapshot();
  const scope = {
    sessionId: 1,
    placementRevision: s.placementRevision,
    requestId: s.volume.requestId,
  };
  for (let i = 0; i < 48; i++) c.finishVolumeStackImage(scope, i, true);
  c.finishVolumeBinding(scope, 'ready');
}

test('medical actions use app colors, retain labels/state and fit narrow widths at large text sizes', () => {
  for (const width of [320, 390, 844, 1024])
    for (const fontScale of [1, 1.8]) {
      const h = load('features/medical-viewer/medical-ui.tsx', {
        viewport: { width, height: 600, fontScale },
      });
      let calls = 0;
      for (const [label, selected, expected, variant] of [
        ['Scan Controls', undefined, colors.primary, 'filled'],
        ['MRI', true, colors.secondary, 'filled'],
        ['CT', false, colors.surface, 'outlined'],
        ['Home', undefined, colors.primary, 'outlined'],
        ['Reset Scan', undefined, colors.primary, 'outlined'],
      ]) {
        const button = h.render('MedicalControl', {
          label,
          selected,
          testID: 'action',
          accessibilityLabel: 'Spoken ' + label,
          onPress: () => calls++,
        });
        assert.equal(button.props.color, expected);
        assert.equal(button.props.variant, variant);
        assert.equal(button.props.selected, selected);
        assert.equal(button.props.accessibilityLabel, 'Spoken ' + label);
        assert.ok(button.props.width >= 44 && button.props.width <= Math.min(width - 64, 520));
        assert.equal(button.props.compact, true);
        assert.equal(button.props.fontSize, 15);
        button.props.onPress();
      }
      assert.equal(calls, 5);
    }
});

test('medical sheet bounds scrolling separately from the pinned Done header through resize and large text', () => {
  for (const platform of ['ios', 'android'])
    for (const width of [320, 390, 844, 1024]) {
      const viewport = { width, height: width === 844 ? 390 : 844, fontScale: 1.8 };
      const h = load('features/medical-viewer/medical-sheet.native.tsx', { viewport, platform });
      let dismissed = 0;
      const props = {
        title: 'Scan controls',
        subtitle: 'MRI · 3D preview',
        testID: 'sheet',
        isPresented: true,
        onDismiss: () => dismissed++,
        children: jsx('Body', {}),
      };
      let root = h.render('MedicalSheet', props);
      let scroll = nodes(root).find((n) => n.type === 'ScrollView');
      assert.equal(scroll, undefined);
      assert.equal(byID(root, 'sheet-header'), undefined);
      const column = nodes(root).find((n) => n.type === 'Column');
      const measure = column.props.modifiers.find(
        (m) => m.name === (platform === 'ios' ? 'onGeometryChange' : 'onSizeChanged')
      ).value;
      measure({ width: 0, height: 0 });
      assert.equal(byID(h.render('MedicalSheet', props), 'sheet-header'), undefined);
      measure({ width: Math.min(width, 500), height: viewport.height - 40 });
      root = h.render('MedicalSheet', props);
      byID(root, 'sheet-header').props.onLayout({ nativeEvent: { layout: { height: 140 } } });
      root = h.render('MedicalSheet', props);
      scroll = nodes(root).find((n) => n.type === 'ScrollView');
      assert.equal(scroll.props.style.width, Math.min(width, 500));
      assert.equal(scroll.props.style.height, viewport.height - 180);
      assert.ok(!nodes(scroll).some((n) => n.props.testID === 'sheet-done'));
      assert.equal(byID(root, 'sheet').props.containerColor, colors.surface);
      assert.equal(
        flatten(byID(root, 'sheet-content').props.style).width,
        scroll.props.style.width
      );
      byID(root, 'sheet-done').props.onPress();
      byID(root, 'sheet-header').props.onAccessibilityEscape();
      byID(root, 'sheet').props.onDismiss();
      assert.equal(dismissed, 3);
      viewport.width = 320;
      measure({ width: 320, height: 560 });
      root = h.render('MedicalSheet', props);
      assert.equal(nodes(root).find((n) => n.type === 'ScrollView').props.style.width, 320);
    }
});

test('medical HUD retains mode, transform, retry and Home actions through measurement and mode changes', () => {
  for (const width of [320, 390, 844, 1024])
    for (const fontScale of [1, 1.8]) {
      const c = viewer();
      let home = 0;
      const h = load('features/medical-viewer/medical-viewer-screen.native.tsx', {
        viewport: { width, height: 600, fontScale },
        expose: '\nexport { MedicalMainControls, MedicalRepresentationControls };',
      });
      const context = {
        sessionId: 1,
        home: () => home++,
        restartAR: () => {},
        status: 'running',
        instruction: '',
      };
      let root = h.render('MedicalControls', { controller: c, context });
      const panel = byID(root, 'medical-controls');
      assert.ok(flatten(panel.props.style).maxWidth <= 560);
      panel.props.onLayout({ nativeEvent: { layout: { width: Math.min(width - 40, 560) } } });
      root = h.render('MedicalControls', { controller: c, context });
      const controls = () =>
        nodes(root).find((n) => n.type?.name === 'MedicalRepresentationControls');
      let representation = controls();
      let inner = h.render('MedicalRepresentationControls', representation.props);
      let anatomy = h.render('MedicalMainControls', inner.props);
      nodes(anatomy)
        .find((n) => n.type === 'ModelPicker')
        .props.onValueChange('skull');
      assert.equal(c.getSnapshot().modelId, 'skull');
      root = h.render('MedicalControls', { controller: c, context });
      representation = controls();
      inner = h.render('MedicalRepresentationControls', representation.props);
      anatomy = h.render('MedicalMainControls', inner.props);
      byID(anatomy, 'medical-transform').props.onPress();
      root = h.render('MedicalControls', { controller: c, context });
      inner = h.render('MedicalRepresentationControls', controls().props);
      assert.equal(inner.type, 'AnatomyTransform');
      inner.props.onDone();
      root = h.render('MedicalControls', { controller: c, context });
      byID(root, 'medical-mode-slices').props.onPress();
      root = h.render('MedicalControls', { controller: c, context });
      inner = h.render('MedicalRepresentationControls', controls().props);
      assert.equal(inner.type, 'Slices');
      byID(root, 'medical-mode-volume').props.onPress();
      root = h.render('MedicalControls', { controller: c, context });
      inner = h.render('MedicalRepresentationControls', controls().props);
      assert.equal(inner.type, 'Volume');
      const state = c.getSnapshot();
      c.finishVolumeStackImage(
        {
          sessionId: 1,
          placementRevision: state.placementRevision,
          requestId: state.volume.requestId,
        },
        0,
        false
      );
      root = h.render('MedicalControls', { controller: c, context });
      byID(root, 'medical-load-retry').props.onPress();
      assert.equal(c.getSnapshot().volume.loadStatus, 'loading');
      byID(root, 'medical-home').props.onPress();
      assert.equal(home, 1);
    }
});

test('slice controls retain coalesced slider input, limits, modality and reset callbacks', () => {
  const c = viewer();
  c.selectViewerMode(1, 'slices');
  const s = c.getSnapshot();
  c.finishSliceLoad(
    { sessionId: 1, placementRevision: s.placementRevision, requestId: s.slices.requestId },
    true
  );
  const h = load('features/medical-viewer/medical-slice-controls.native.tsx');
  const props = () => ({
    controller: c,
    state: c.getSnapshot(),
    sessionId: 1,
    stacked: true,
    onTransform: () => {},
  });
  let root = h.render('MedicalSliceControls', props());
  let slider = byID(root, 'medical-slice-slider');
  slider.props.onValueChange(0);
  slider.props.onValueChange(1);
  h.flush();
  assert.equal(c.getSnapshot().slices.index, 1);
  root = h.render('MedicalSliceControls', props());
  slider = byID(root, 'medical-slice-slider');
  slider.props.onValueChange(0);
  h.flush();
  root = h.render('MedicalSliceControls', props());
  assert.equal(byID(root, 'medical-slice-previous').props.disabled, true);
  byID(root, 'medical-slice-next').props.onPress();
  assert.equal(c.getSnapshot().slices.index, 1);
  root = h.render('MedicalSliceControls', props());
  byID(root, 'medical-modality-ct').props.onPress();
  assert.equal(c.getSnapshot().slices.modality, 'ct');
  root = h.render('MedicalSliceControls', props());
  byID(root, 'medical-slice-reset').props.onPress();
  assert.equal(c.getSnapshot().slices.index, Math.floor(c.getSliceSeries().imageCount / 2));
});

test('volume sheet preserves crop/appearance controls, diagnostics gates and closing clears pending slider updates', () => {
  const c = viewer();
  c.selectViewerMode(1, 'volume');
  readyVolume(c);
  c.openVolumeControls(1, true);
  const h = load('features/medical-viewer/medical-volume-controls.native.tsx', {
    expose: '\nexport { ScanSlider, ScanToggle, MedicalShaderDiagnostics };',
  });
  const props = () => ({ controller: c, state: c.getSnapshot(), sessionId: 1 });
  let root = h.render('MedicalVolumeSheet', props());
  assert.equal(root.type, 'Sheet');
  assert.equal(root.props.testID, 'medical-volume-sheet');
  let slider = nodes(root).find((n) => n.props.label === 'Transparency %');
  slider.props.onChange(100);
  h.flush();
  assert.equal(c.getSnapshot().volume.appearance.mri.opacity, 0);
  root = h.render('MedicalVolumeSheet', props());
  slider = nodes(root).find((n) => n.props.label === 'Transparency %');
  slider.props.onChange(0);
  root.props.onDismiss();
  h.flush();
  assert.equal(c.getSnapshot().volume.appearance.mri.opacity, 0);
  assert.equal(c.getSnapshot().volume.controlsOpen, false);
  c.openVolumeControls(1, true);
  root = h.render('MedicalVolumeSheet', props());
  nodes(root)
    .find((n) => n.props.label === 'Enable cropping')
    .props.onChange(false);
  assert.equal(c.getSnapshot().volume.cropping, false);
  root = h.render('MedicalVolumeSheet', props());
  assert.equal(nodes(root).filter((n) => n.props.label?.endsWith('boundary (mm)')).length, 0);
  nodes(root)
    .find((n) => n.props.label === 'Enable cropping')
    .props.onChange(true);
  root = h.render('MedicalVolumeSheet', props());
  assert.equal(nodes(root).filter((n) => n.props.label?.endsWith('boundary (mm)')).length, 6);
  byID(root, 'medical-volume-reset-scan').props.onPress();
  assert.equal(c.getSnapshot().volume.appearance.mri.opacity, 1.6);
  const controls = h.render('MedicalVolumeControls', {
    ...props(),
    onTransform: () => {},
    onRestart: () => {},
  });
  byID(controls, 'medical-volume-modality-ct').props.onPress();
  readyVolume(c);
  c.openVolumeControls(1, true);
  root = h.render('MedicalVolumeSheet', props());
  byID(root, 'medical-volume-preset-ct-soft-tissue').props.onPress();
  assert.equal(c.getSnapshot().volume.appearance.ct.preset, 'ct-soft-tissue');
  root = h.render('MedicalVolumeSheet', props());
  byID(root, 'medical-volume-advanced').props.onPress();
  root = h.render('MedicalVolumeSheet', props());
  byID(root, 'medical-renderer-shader').props.onPress();
  root = h.render('MedicalShaderDiagnostics', props());
  assert.equal(byID(root, 'medical-diagnostic-high').props.disabled, true);
  assert.equal(byID(root, 'medical-confirm-magenta').props.disabled, true);
  const s = c.getSnapshot();
  c.finishVolumeBinding(
    { sessionId: 1, placementRevision: s.placementRevision, requestId: s.volume.requestId },
    'ready'
  );
  root = h.render('MedicalShaderDiagnostics', props());
  byID(root, 'medical-confirm-magenta').props.onPress();
  root = h.render('MedicalShaderDiagnostics', props());
  assert.equal(byID(root, 'medical-diagnostic-high').props.disabled, false);
});

test('universal model picker retains all four available models and selection callbacks', () => {
  const h = load('features/medical-viewer/medical-model-picker.native.tsx');
  let selected;
  const root = h.render('MedicalModelPicker', {
    selectedValue: 'both',
    onValueChange: (v) => (selected = v),
  });
  const picker = byID(root, 'medical-model-picker');
  assert.equal(picker.props.selectedValue, 'both');
  assert.equal(picker.props.children.length, 4);
  picker.props.onValueChange('brain');
  assert.equal(selected, 'brain');
});

test('unavailable anatomy models retain disabled native entries and are excluded from the web menu', () => {
  const models = [
    { id: 'skull', label: 'Skull', available: true },
    { id: 'brain', label: 'Brain', available: false },
  ];
  const overrides = { './medical-models': { MEDICAL_MODELS: models } };
  const web = load('features/medical-viewer/medical-model-availability.tsx', {
    platform: 'web',
    overrides,
  });
  const webPicker = byID(
    web.render('default', { selectedValue: 'skull', onValueChange: () => {} }),
    'medical-model-picker'
  );
  assert.equal(webPicker.props.children.length, 1);
  const native = load('features/medical-viewer/medical-model-availability.native.tsx', {
    overrides,
  });
  const nativePicker = byID(
    native.render('default', { selectedValue: 'skull', onValueChange: () => {} }),
    'medical-model-picker'
  );
  const missing = nativePicker.props.children.find((node) => node.key === 'brain');
  assert.equal(
    missing.props.modifiers.find((modifier) => modifier.name === 'disabled').value,
    true
  );
});
