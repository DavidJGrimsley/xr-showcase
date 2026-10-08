import { isMedicalModelAvailable, type MedicalModelId } from './medical-models.ts';

export const MIN_MODEL_SCALE = 0.5;
export const MAX_MODEL_SCALE = 3;
export const SCALE_STEP = 1.1;

export interface MedicalScope {
  sessionId: number;
  placementRevision: number;
  loadAttempt: number;
}

export interface MedicalSnapshot {
  sessionId: number | null;
  modelId: MedicalModelId;
  tracking: 'initializing' | 'normal' | 'limited';
  anchorId: string | null;
  placementRevision: number;
  loadAttempt: number;
  loadStatus: 'idle' | 'loading' | 'ready' | 'error';
  scale: number;
  yaw: number;
  labelsVisible: boolean;
  pinching: boolean;
  rotating: boolean;
}

export function canManipulateMedical(state: MedicalSnapshot) {
  return (
    state.sessionId !== null &&
    !!state.anchorId &&
    state.tracking === 'normal' &&
    state.loadStatus === 'ready'
  );
}

export function medicalStatus(state: MedicalSnapshot) {
  if (state.loadStatus === 'error') return 'Skull could not load.';
  if (state.tracking === 'initializing') return 'Finding a surface…';
  if (state.tracking === 'limited') return 'Tracking limited. Move slowly in good light.';
  if (!state.anchorId) return 'Tap a highlighted surface to place the skull.';
  if (state.loadStatus === 'loading') return 'Loading skull…';
  return '';
}

const clampScale = (value: number) => Math.min(MAX_MODEL_SCALE, Math.max(MIN_MODEL_SCALE, value));
export const normalizeYaw = (value: number) => ((((value + 180) % 360) + 360) % 360) - 180;

export class MedicalController {
  private snapshot: MedicalSnapshot = {
    sessionId: null,
    modelId: 'skull',
    tracking: 'initializing',
    anchorId: null,
    placementRevision: 0,
    loadAttempt: 0,
    loadStatus: 'idle',
    scale: 1,
    yaw: 0,
    labelsVisible: false,
    pinching: false,
    rotating: false,
  };
  private listeners = new Set<() => void>();
  private pinchStart: number | null = null;
  private rotationStart: number | null = null;

  getSnapshot = () => this.snapshot;
  getSessionId = () => this.snapshot.sessionId;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private publish(change: Partial<MedicalSnapshot>) {
    if (
      Object.entries(change).every(
        ([key, value]) => this.snapshot[key as keyof MedicalSnapshot] === value
      )
    )
      return;
    this.snapshot = { ...this.snapshot, ...change };
    this.listeners.forEach((listener) => listener());
  }
  private live(sessionId: number) {
    return this.snapshot.sessionId === sessionId;
  }
  private current(scope: MedicalScope) {
    return (
      this.live(scope.sessionId) &&
      scope.placementRevision === this.snapshot.placementRevision &&
      scope.loadAttempt === this.snapshot.loadAttempt
    );
  }
  private clearGestures() {
    this.pinchStart = this.rotationStart = null;
  }

  attach(sessionId: number) {
    if (this.live(sessionId)) return;
    this.clearGestures();
    this.publish({
      sessionId,
      tracking: 'initializing',
      anchorId: null,
      placementRevision: this.snapshot.placementRevision + 1,
      loadStatus: 'idle',
      pinching: false,
      rotating: false,
    });
  }
  detach(sessionId: number) {
    if (!this.live(sessionId)) return;
    this.clearGestures();
    this.publish({
      sessionId: null,
      anchorId: null,
      placementRevision: this.snapshot.placementRevision + 1,
      loadStatus: 'idle',
      pinching: false,
      rotating: false,
    });
  }
  restart(sessionId: number) {
    if (!this.live(sessionId)) return;
    this.publish({ scale: 1, yaw: 0 });
    this.detach(sessionId);
  }
  setTracking(sessionId: number, normal: boolean) {
    if (!this.live(sessionId)) return;
    if (!normal) this.clearGestures();
    this.publish({
      tracking: normal ? 'normal' : 'limited',
      ...(!normal ? { pinching: false, rotating: false } : {}),
    });
  }
  selectModel(sessionId: number, modelId: MedicalModelId) {
    if (!this.live(sessionId) || !isMedicalModelAvailable(modelId)) return;
    this.publish({ modelId });
  }
  selectPlane(sessionId: number, revision: number, anchorId: string) {
    if (
      !this.live(sessionId) ||
      revision !== this.snapshot.placementRevision ||
      this.snapshot.anchorId ||
      this.snapshot.tracking !== 'normal' ||
      !anchorId
    )
      return;
    this.publish({ anchorId, loadStatus: 'loading', loadAttempt: this.snapshot.loadAttempt + 1 });
  }
  losePlane(sessionId: number, revision: number, anchorId: string) {
    if (
      !this.live(sessionId) ||
      revision !== this.snapshot.placementRevision ||
      anchorId !== this.snapshot.anchorId
    )
      return;
    this.reposition(sessionId);
  }
  reposition(sessionId: number) {
    if (!this.live(sessionId) || !this.snapshot.anchorId) return;
    this.clearGestures();
    this.publish({
      anchorId: null,
      placementRevision: this.snapshot.placementRevision + 1,
      loadStatus: 'idle',
      pinching: false,
      rotating: false,
    });
  }
  finishLoad(scope: MedicalScope, success: boolean) {
    if (
      !this.current(scope) ||
      !this.snapshot.anchorId ||
      (this.snapshot.loadStatus !== 'loading' &&
        !(this.snapshot.loadStatus === 'ready' && !success))
    )
      return;
    this.publish({ loadStatus: success ? 'ready' : 'error' });
  }
  retryLoad(sessionId: number) {
    if (!this.live(sessionId) || !this.snapshot.anchorId || this.snapshot.loadStatus !== 'error')
      return;
    this.publish({ loadStatus: 'loading', loadAttempt: this.snapshot.loadAttempt + 1 });
  }
  toggleLabels(sessionId: number) {
    if (this.live(sessionId) && canManipulateMedical(this.snapshot))
      this.publish({ labelsVisible: !this.snapshot.labelsVisible });
  }
  adjustScale(sessionId: number, direction: -1 | 1) {
    if (!this.live(sessionId) || !canManipulateMedical(this.snapshot) || this.snapshot.pinching)
      return;
    this.publish({ scale: clampScale(this.snapshot.scale * SCALE_STEP ** direction) });
  }
  pinch(scope: MedicalScope, gesture: number, factor: number) {
    if (
      !this.current(scope) ||
      !canManipulateMedical(this.snapshot) ||
      ![1, 2, 3].includes(gesture)
    )
      return;
    if (!Number.isFinite(factor) || factor <= 0) {
      if (gesture === 3) {
        this.pinchStart = null;
        this.publish({ pinching: false });
      }
      return;
    }
    if (gesture === 1) {
      this.pinchStart = this.snapshot.scale;
      this.publish({ pinching: true });
    }
    if (this.pinchStart === null) return;
    this.publish({ scale: clampScale(this.pinchStart * factor) });
    if (gesture === 3) {
      this.pinchStart = null;
      this.publish({ pinching: false });
    }
  }
  rotate(scope: MedicalScope, gesture: number, degrees: number) {
    if (
      !this.current(scope) ||
      !canManipulateMedical(this.snapshot) ||
      ![1, 2, 3].includes(gesture)
    )
      return;
    if (!Number.isFinite(degrees)) {
      if (gesture === 3) {
        this.rotationStart = null;
        this.publish({ rotating: false });
      }
      return;
    }
    if (gesture === 1) {
      this.rotationStart = this.snapshot.yaw;
      this.publish({ rotating: true });
    }
    if (this.rotationStart === null) return;
    this.publish({ yaw: normalizeYaw(this.rotationStart - degrees) });
    if (gesture === 3) {
      this.rotationStart = null;
      this.publish({ rotating: false });
    }
  }
}
