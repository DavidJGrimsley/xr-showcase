const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  MedicalController,
  canManipulateMedical,
  medicalStatus,
  DEFAULT_MODEL_HEIGHT,
  MAX_MODEL_HEIGHT,
} = require('../src/features/medical-viewer/medical-controller.ts');

const scope = (controller) => {
  const { sessionId, placementRevision, loadAttempt } = controller.getSnapshot();
  return { sessionId, placementRevision, loadAttempt };
};
function placed() {
  const controller = new MedicalController();
  controller.attach(1);
  controller.setTracking(1, true);
  controller.selectPlane(1, scope(controller).placementRevision, 'table');
  controller.finishLoad(scope(controller), true);
  return controller;
}

test('starts with Skull and labels off; Brain cannot be selected', () => {
  const c = new MedicalController();
  c.attach(1);
  c.selectModel(1, 'brain');
  assert.equal(c.getSnapshot().modelId, 'skull');
  assert.equal(c.getSnapshot().labelsVisible, false);
  assert.equal(c.getSnapshot().height, 0.3048);
  assert.equal(canManipulateMedical(c.getSnapshot()), false);
});
test('requires normal tracking, selected plane and finished loading', () => {
  const c = new MedicalController();
  c.attach(1);
  const revision = scope(c).placementRevision;
  c.selectPlane(1, revision, 'table');
  assert.equal(c.getSnapshot().anchorId, null);
  c.setTracking(1, true);
  c.selectPlane(1, revision, 'table');
  c.setScale(scope(c), 2);
  c.setYaw(scope(c), 90);
  c.setHeight(scope(c), 1);
  c.toggleLabels(1);
  assert.equal(c.getSnapshot().scale, 1);
  assert.equal(c.getSnapshot().yaw, 0);
  assert.equal(c.getSnapshot().height, DEFAULT_MODEL_HEIGHT);
  assert.equal(c.getSnapshot().labelsVisible, false);
  c.finishLoad(scope(c), true);
  assert.equal(canManipulateMedical(c.getSnapshot()), true);
  assert.equal(medicalStatus(c.getSnapshot()), '');
});
test('transform sliders use absolute values, clamp size and height, and wrap yaw', () => {
  const c = placed();
  const token = scope(c);
  c.setScale(token, 1.5);
  c.setScale(token, 1.6);
  assert.equal(c.getSnapshot().scale, 1.6);
  c.setScale(token, 100);
  assert.equal(c.getSnapshot().scale, 3);
  c.setScale(token, -1);
  assert.equal(c.getSnapshot().scale, 0.5);
  c.setHeight(token, -1);
  assert.equal(c.getSnapshot().height, 0);
  c.setHeight(token, 100);
  assert.equal(c.getSnapshot().height, MAX_MODEL_HEIGHT);
  c.setHeight(token, 0.7);
  assert.equal(c.getSnapshot().height, 0.7);
  c.setYaw(token, 450);
  assert.equal(c.getSnapshot().yaw, 90);
  c.setYaw(token, -900);
  assert.equal(c.getSnapshot().yaw, -180);
  c.setYaw(token, 360);
  assert.equal(c.getSnapshot().yaw, 0);
  const before = c.getSnapshot();
  for (const invalid of [NaN, Infinity, -Infinity]) {
    c.setScale(token, invalid);
    c.setYaw(token, invalid);
    c.setHeight(token, invalid);
  }
  assert.equal(c.getSnapshot(), before);
});
test('pinch uses the start baseline, including the final factor and subsequent gestures', () => {
  const c = placed(),
    token = scope(c);
  c.pinch(token, 1, 1);
  c.pinch(token, 2, 1.5);
  c.pinch(token, 2, 1.6);
  assert.equal(c.getSnapshot().scale, 1.6);
  c.setScale(token, 3);
  assert.equal(c.getSnapshot().scale, 1.6);
  c.pinch(token, 3, 2);
  c.pinch(token, 1, 1);
  c.pinch(token, 3, 0.5);
  assert.equal(c.getSnapshot().scale, 1);
  assert.equal(c.getSnapshot().pinching, false);
  c.pinch(token, 1, 1);
  c.pinch(token, 3, 100);
  assert.equal(c.getSnapshot().scale, 3);
});
test('rotation is cumulative within a gesture and wraps across full turns', () => {
  const c = placed(),
    token = scope(c);
  c.rotate(token, 1, 0);
  c.rotate(token, 2, 45);
  c.rotate(token, 3, 90);
  assert.equal(c.getSnapshot().yaw, -90);
  c.rotate(token, 1, 0);
  c.rotate(token, 3, 450);
  assert.equal(c.getSnapshot().yaw, -180);
  c.rotate(token, 1, 0);
  c.rotate(token, 3, -900);
  assert.equal(c.getSnapshot().yaw, 0);
});
test('invalid and out-of-order gestures do not alter the model', () => {
  const c = placed(),
    token = scope(c);
  c.pinch(token, 2, 2);
  c.rotate(token, 3, 90);
  for (const bad of [NaN, Infinity, -1, 0]) c.pinch(token, 1, bad);
  c.rotate(token, 1, NaN);
  c.pinch(token, 4, 2);
  assert.equal(c.getSnapshot().scale, 1);
  assert.equal(c.getSnapshot().yaw, 0);
});
test('Reposition preserves pose and labels, invalidating previous placement callbacks', () => {
  const c = placed(),
    old = scope(c);
  c.setScale(old, 1.1);
  c.setHeight(old, 0.8);
  c.rotate(old, 1, 0);
  c.rotate(old, 3, 45);
  c.toggleLabels(1);
  c.reposition(1);
  c.selectPlane(1, old.placementRevision, 'old');
  c.finishLoad(old, true);
  c.pinch(old, 1, 2);
  assert.equal(c.getSnapshot().anchorId, null);
  assert.equal(c.getSnapshot().scale, 1.1);
  assert.equal(c.getSnapshot().yaw, -45);
  assert.equal(c.getSnapshot().height, 0.8);
  assert.equal(c.getSnapshot().labelsVisible, true);
  c.selectPlane(1, scope(c).placementRevision, 'new-table');
  c.finishLoad(scope(c), true);
  assert.equal(c.getSnapshot().anchorId, 'new-table');
});
test('removing an unrelated plane is harmless; selected-plane loss allows reselecting', () => {
  const c = placed(),
    token = scope(c);
  c.losePlane(1, token.placementRevision, 'other');
  assert.equal(c.getSnapshot().anchorId, 'table');
  c.losePlane(1, token.placementRevision, 'table');
  assert.equal(c.getSnapshot().anchorId, null);
  assert.equal(c.getSnapshot().loadStatus, 'idle');
  c.selectPlane(1, scope(c).placementRevision, 'floor');
  c.finishLoad(token, true);
  assert.equal(c.getSnapshot().loadStatus, 'loading');
});
test('retry keeps placement and ignores success from a failed or older load', () => {
  const c = new MedicalController();
  c.attach(1);
  c.setTracking(1, true);
  c.selectPlane(1, scope(c).placementRevision, 'table');
  const failed = scope(c);
  c.finishLoad(failed, false);
  c.finishLoad(failed, true);
  assert.equal(c.getSnapshot().loadStatus, 'error');
  assert.equal(medicalStatus(c.getSnapshot()), 'Skull could not load.');
  c.retryLoad(1);
  c.finishLoad(failed, true);
  assert.equal(c.getSnapshot().loadStatus, 'loading');
  assert.equal(c.getSnapshot().anchorId, 'table');
  c.finishLoad(scope(c), true);
  assert.equal(c.getSnapshot().loadStatus, 'ready');
});
test('tracking loss interrupts gestures and blocks manipulation until normal tracking', () => {
  const c = placed(),
    token = scope(c);
  c.pinch(token, 1, 1);
  c.rotate(token, 1, 0);
  c.setTracking(1, false);
  c.setScale(token, 2);
  c.setYaw(token, 90);
  c.setHeight(token, 1);
  c.toggleLabels(1);
  c.pinch(token, 2, 2);
  c.rotate(token, 2, 90);
  assert.equal(c.getSnapshot().scale, 1);
  assert.equal(c.getSnapshot().yaw, 0);
  assert.equal(c.getSnapshot().height, DEFAULT_MODEL_HEIGHT);
  assert.equal(c.getSnapshot().pinching, false);
  c.setTracking(1, true);
  c.pinch(token, 3, 2);
  assert.equal(c.getSnapshot().scale, 1);
  assert.equal(medicalStatus(c.getSnapshot()), '');
});
test('background/resume retains preferences, clears placement and ignores stale callbacks', () => {
  const c = placed(),
    old = scope(c);
  c.setScale(old, 1.1);
  c.setHeight(old, 0.6);
  c.rotate(old, 1, 0);
  c.rotate(old, 3, 45);
  c.toggleLabels(1);
  c.detach(1);
  c.attach(2);
  c.detach(1);
  c.setTracking(1, true);
  c.finishLoad(old, true);
  c.rotate(old, 1, 90);
  assert.equal(c.getSnapshot().sessionId, 2);
  assert.equal(c.getSnapshot().scale, 1.1);
  assert.equal(c.getSnapshot().yaw, -45);
  assert.equal(c.getSnapshot().height, 0.6);
  assert.equal(c.getSnapshot().labelsVisible, true);
  assert.equal(c.getSnapshot().anchorId, null);
  assert.equal(c.getSnapshot().tracking, 'initializing');
  assert.equal(new MedicalController().getSnapshot().labelsVisible, false);
});
test('Restart AR resets pose and placement while retaining labels; returning later has fresh defaults', () => {
  const c = placed(),
    old = scope(c);
  c.setScale(old, 1.1);
  c.setHeight(old, 1);
  c.rotate(old, 1, 0);
  c.rotate(old, 3, 90);
  c.toggleLabels(1);
  c.restart(1);
  c.attach(2);
  c.restart(1);
  c.pinch(old, 1, 3);
  assert.equal(c.getSnapshot().sessionId, 2);
  assert.equal(c.getSnapshot().scale, 1);
  assert.equal(c.getSnapshot().yaw, 0);
  assert.equal(c.getSnapshot().height, DEFAULT_MODEL_HEIGHT);
  assert.equal(c.getSnapshot().anchorId, null);
  assert.equal(c.getSnapshot().labelsVisible, true);
  const fresh = new MedicalController().getSnapshot();
  assert.equal(fresh.modelId, 'skull');
  assert.equal(fresh.scale, 1);
  assert.equal(fresh.yaw, 0);
  assert.equal(fresh.height, DEFAULT_MODEL_HEIGHT);
  assert.equal(fresh.labelsVisible, false);
});
test('malformed gesture ends release their baselines and controls', () => {
  const c = placed(),
    token = scope(c);
  c.pinch(token, 1, 1);
  c.rotate(token, 1, 0);
  c.pinch(token, 3, NaN);
  c.rotate(token, 3, Infinity);
  assert.equal(c.getSnapshot().pinching, false);
  assert.equal(c.getSnapshot().rotating, false);
  c.setScale(token, 1.1);
  assert.equal(c.getSnapshot().scale, 1.1);
});
test('a model error interrupts active gestures and Retry restores usable transform controls', () => {
  const c = placed(),
    token = scope(c);
  c.pinch(token, 1, 1);
  c.rotate(token, 1, 0);
  c.setHeight(token, 0.8);
  c.finishLoad(token, false);
  assert.equal(c.getSnapshot().loadStatus, 'error');
  assert.equal(c.getSnapshot().pinching, false);
  assert.equal(c.getSnapshot().rotating, false);
  c.retryLoad(1);
  c.finishLoad(token, true);
  assert.equal(c.getSnapshot().loadStatus, 'loading');
  c.finishLoad(scope(c), true);
  c.setScale(scope(c), 2);
  c.setYaw(scope(c), 45);
  c.pinch(token, 3, 3);
  c.rotate(token, 3, 90);
  assert.equal(c.getSnapshot().scale, 2);
  assert.equal(c.getSnapshot().yaw, 45);
  assert.equal(c.getSnapshot().height, 0.8);
});

test('height stays independent of pinch size and yaw, including placement loss', () => {
  const c = placed();
  const token = scope(c);
  c.setHeight(token, 0.9);
  c.pinch(token, 1, 1);
  c.pinch(token, 3, 3);
  c.rotate(token, 1, 0);
  c.rotate(token, 3, 120);
  assert.equal(c.getSnapshot().height, 0.9);
  c.losePlane(1, token.placementRevision, 'table');
  c.selectPlane(1, scope(c).placementRevision, 'floor');
  c.finishLoad(scope(c), true);
  assert.equal(c.getSnapshot().height, 0.9);
  assert.equal(c.getSnapshot().scale, 3);
  assert.equal(c.getSnapshot().yaw, -120);
});

test('sliders and consecutive native gestures share pose without baseline jumps', () => {
  const c = placed();
  const token = scope(c);
  c.setScale(token, 2);
  c.setYaw(token, 90);
  c.pinch(token, 1, 1);
  c.rotate(token, 1, 0);
  c.setScale(token, 0.5);
  c.setYaw(token, 0);
  assert.equal(c.getSnapshot().scale, 2);
  assert.equal(c.getSnapshot().yaw, 90);
  c.pinch(token, 3, 0.75);
  c.rotate(token, 3, 45);
  assert.equal(c.getSnapshot().scale, 1.5);
  assert.equal(c.getSnapshot().yaw, 45);
  c.setScale(token, 1);
  c.setYaw(token, 270);
  c.pinch(token, 1, 1);
  c.pinch(token, 3, 2);
  c.rotate(token, 1, 0);
  c.rotate(token, 3, 90);
  assert.equal(c.getSnapshot().scale, 2);
  assert.equal(c.getSnapshot().yaw, -180);
});

test('transform callbacks ignore earlier load attempts, placements and sessions after teardown', () => {
  const c = placed();
  const mutate = (token) => {
    c.setScale(token, 3);
    c.setYaw(token, 123);
    c.setHeight(token, 1.4);
  };
  const oldLoad = scope(c);
  c.finishLoad(oldLoad, false);
  c.retryLoad(1);
  c.finishLoad(scope(c), true);
  const before = c.getSnapshot();
  mutate(oldLoad);
  assert.equal(c.getSnapshot(), before);
  const oldPlacement = scope(c);
  c.reposition(1);
  c.selectPlane(1, scope(c).placementRevision, 'floor');
  c.finishLoad(scope(c), true);
  const reselected = c.getSnapshot();
  mutate(oldPlacement);
  assert.equal(c.getSnapshot(), reselected);
  const oldSession = scope(c);
  c.detach(1);
  const detached = c.getSnapshot();
  mutate(oldSession);
  assert.equal(c.getSnapshot(), detached);
  c.attach(2);
  c.setTracking(2, true);
  c.selectPlane(2, scope(c).placementRevision, 'floor');
  c.finishLoad(scope(c), true);
  const resumed = c.getSnapshot();
  mutate(oldSession);
  assert.equal(c.getSnapshot(), resumed);
});
test('subscription emits changed snapshots and unsubscribes cleanly', () => {
  const c = new MedicalController();
  let changes = 0;
  const unsubscribe = c.subscribe(() => changes++);
  c.attach(1);
  c.attach(1);
  assert.equal(changes, 1);
  unsubscribe();
  c.setTracking(1, true);
  assert.equal(changes, 1);
});
