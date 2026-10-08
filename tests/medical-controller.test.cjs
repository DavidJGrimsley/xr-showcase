const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  MedicalController,
  canManipulateMedical,
  medicalStatus,
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
  c.adjustScale(1, 1);
  c.toggleLabels(1);
  assert.equal(c.getSnapshot().scale, 1);
  assert.equal(c.getSnapshot().labelsVisible, false);
  c.finishLoad(scope(c), true);
  assert.equal(canManipulateMedical(c.getSnapshot()), true);
  assert.equal(medicalStatus(c.getSnapshot()), '');
});
test('button steps are reciprocal and bounded', () => {
  const c = placed();
  c.adjustScale(1, 1);
  assert.equal(c.getSnapshot().scale, 1.1);
  c.adjustScale(1, -1);
  assert.equal(c.getSnapshot().scale, 1);
  for (let i = 0; i < 100; i++) c.adjustScale(1, 1);
  assert.equal(c.getSnapshot().scale, 3);
  for (let i = 0; i < 100; i++) c.adjustScale(1, -1);
  assert.equal(c.getSnapshot().scale, 0.5);
});
test('pinch uses the start baseline, including the final factor and subsequent gestures', () => {
  const c = placed(),
    token = scope(c);
  c.pinch(token, 1, 1);
  c.pinch(token, 2, 1.5);
  c.pinch(token, 2, 1.6);
  assert.equal(c.getSnapshot().scale, 1.6);
  c.adjustScale(1, 1);
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
  c.adjustScale(1, 1);
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
  c.adjustScale(1, 1);
  c.toggleLabels(1);
  c.pinch(token, 2, 2);
  c.rotate(token, 2, 90);
  assert.equal(c.getSnapshot().scale, 1);
  assert.equal(c.getSnapshot().yaw, 0);
  assert.equal(c.getSnapshot().pinching, false);
  c.setTracking(1, true);
  c.pinch(token, 3, 2);
  assert.equal(c.getSnapshot().scale, 1);
  assert.equal(medicalStatus(c.getSnapshot()), '');
});
test('background/resume retains preferences, clears placement and ignores stale callbacks', () => {
  const c = placed(),
    old = scope(c);
  c.adjustScale(1, 1);
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
  assert.equal(c.getSnapshot().labelsVisible, true);
  assert.equal(c.getSnapshot().anchorId, null);
  assert.equal(c.getSnapshot().tracking, 'initializing');
  assert.equal(new MedicalController().getSnapshot().labelsVisible, false);
});
test('Restart AR resets pose and placement while retaining labels; returning later has fresh defaults', () => {
  const c = placed(),
    old = scope(c);
  c.adjustScale(1, 1);
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
  assert.equal(c.getSnapshot().anchorId, null);
  assert.equal(c.getSnapshot().labelsVisible, true);
  const fresh = new MedicalController().getSnapshot();
  assert.equal(fresh.modelId, 'skull');
  assert.equal(fresh.scale, 1);
  assert.equal(fresh.yaw, 0);
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
  c.adjustScale(1, 1);
  assert.equal(c.getSnapshot().scale, 1.1);
});
test('a current model error after readiness remains recoverable', () => {
  const c = placed(),
    token = scope(c);
  c.finishLoad(token, false);
  assert.equal(c.getSnapshot().loadStatus, 'error');
  c.retryLoad(1);
  c.finishLoad(token, true);
  assert.equal(c.getSnapshot().loadStatus, 'loading');
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
