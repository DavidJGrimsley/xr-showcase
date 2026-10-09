import type {
  Bit,
  JobStatus,
  QuantumClock,
  QuantumJob,
  QuantumRuntime,
} from '../../services/quantum-api';
import type { QubitCleanup } from './qubit-job-cleanup';
import {
  clampARHeight,
  clampARScale,
  DEFAULT_AR_HEIGHT,
  normalizeYaw,
} from '../ar/ar-transform.ts';
export {
  MIN_AR_SCALE as MIN_SPHERE_SCALE,
  MAX_AR_SCALE as MAX_SPHERE_SCALE,
  DEFAULT_AR_HEIGHT as DEFAULT_SPHERE_HEIGHT,
} from '../ar/ar-transform.ts';

export type QubitMode = 'simulator' | 'hardware';
export interface QubitTransformScope {
  sessionId: number;
  placementRevision: number;
  roundId: number;
}
export type RoundPhase =
  'idle' | 'intro' | 'waiting' | 'collapsing' | 'complete' | 'paused' | 'error';
export interface QubitSnapshot {
  sessionId: number | null;
  roundId: number;
  placed: boolean;
  placementRevision: number;
  sphereScale: number;
  sphereYaw: number;
  sphereHeight: number;
  pinching: boolean;
  rotating: boolean;
  tracking: boolean;
  mode: QubitMode;
  phase: RoundPhase;
  guess: Bit | null;
  measurement: Bit | null;
  introDone: boolean;
  jobId: string | null;
  jobStatus: JobStatus | null;
  message: string;
  outcome: 'won' | 'lost' | null;
  retryAt: number;
  uncertainSubmission: boolean;
  cancellationNotice: string;
  simulatorReady: boolean;
  hardwareReady: boolean;
}
// React renders must depend on the subscribed snapshot, not a mutable controller read.
export function canGuessQubit(state: QubitSnapshot, now: number) {
  return (
    state.sessionId !== null &&
    state.placed &&
    state.tracking &&
    state.phase === 'idle' &&
    now >= state.retryAt &&
    (state.mode === 'simulator'
      ? state.simulatorReady
      : state.hardwareReady && !state.uncertainSubmission)
  );
}
export function canManipulateQubit(state: QubitSnapshot) {
  return state.sessionId !== null && state.placed && state.tracking;
}
interface Round {
  id: number;
  sessionId: number;
  api: QuantumRuntime;
  abort: AbortController;
  job: QuantumJob | null;
  submitted: boolean;
  terminal: boolean;
  cancelAttempted: boolean;
}
const defaultClock: QuantumClock = {
  now: () => Date.now(),
  schedule: (callback, delay) => setTimeout(callback, delay),
  cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};
export class QubitRoundController {
  private snapshot: QubitSnapshot = {
    sessionId: null,
    roundId: 0,
    placed: false,
    placementRevision: 0,
    sphereScale: 1,
    sphereYaw: 0,
    sphereHeight: DEFAULT_AR_HEIGHT,
    pinching: false,
    rotating: false,
    tracking: false,
    mode: 'simulator',
    phase: 'idle',
    guess: null,
    measurement: null,
    introDone: false,
    jobId: null,
    jobStatus: null,
    message: 'Place the Bloch sphere on a table.',
    outcome: null,
    retryAt: 0,
    uncertainSubmission: false,
    cancellationNotice: '',
    simulatorReady: false,
    hardwareReady: false,
  };
  private listeners = new Set<() => void>();
  private round: Round | null = null;
  private sequence = 0;
  private timer: unknown;
  private getRuntime: () => QuantumRuntime | null;
  private clock: QuantumClock;
  private cleanup?: QubitCleanup;
  private uncertainRounds = new Set<number>();
  private pinchStart: number | null = null;
  private rotationStart: number | null = null;
  constructor(
    getRuntime: () => QuantumRuntime | null,
    clock = defaultClock,
    cleanup?: QubitCleanup
  ) {
    this.getRuntime = getRuntime;
    this.clock = clock;
    this.cleanup = cleanup;
  }
  getSnapshot = () => this.snapshot;
  getSessionId = () => this.snapshot.sessionId;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(patch: Partial<QubitSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  private current(round: Round) {
    return (
      this.round === round &&
      this.snapshot.sessionId === round.sessionId &&
      !round.abort.signal.aborted
    );
  }
  private clearTimer() {
    if (this.timer !== undefined) this.clock.cancel(this.timer);
    this.timer = undefined;
  }
  private currentTransform(scope: QubitTransformScope) {
    return (
      this.snapshot.sessionId === scope.sessionId &&
      this.snapshot.placementRevision === scope.placementRevision &&
      this.snapshot.roundId === scope.roundId &&
      canManipulateQubit(this.snapshot)
    );
  }
  private clearGestures() {
    this.pinchStart = this.rotationStart = null;
  }
  attach(sessionId: number) {
    if (this.snapshot.sessionId === sessionId) return;
    this.reset();
    this.update({
      sessionId,
      placed: false,
      tracking: false,
      placementRevision: this.snapshot.placementRevision + 1,
    });
  }
  detach(sessionId: number) {
    if (this.snapshot.sessionId !== sessionId) return;
    this.reset();
    this.update({
      sessionId: null,
      placed: false,
      tracking: false,
      placementRevision: this.snapshot.placementRevision + 1,
    });
  }
  restart(sessionId: number) {
    if (this.snapshot.sessionId !== sessionId) return;
    this.update({ sphereScale: 1, sphereYaw: 0, sphereHeight: DEFAULT_AR_HEIGHT });
    this.detach(sessionId);
  }
  setTracking(sessionId: number, tracking: boolean) {
    if (this.snapshot.sessionId !== sessionId || this.snapshot.tracking === tracking) return;
    if (!tracking) this.clearGestures();
    this.update({ tracking, ...(!tracking ? { pinching: false, rotating: false } : {}) });
  }
  setPlaced(sessionId: number, placed: boolean, revision = this.snapshot.placementRevision) {
    if (
      this.snapshot.sessionId !== sessionId ||
      revision !== this.snapshot.placementRevision ||
      this.snapshot.placed === placed
    )
      return;
    if (!placed) this.reset();
    this.update({
      placed,
      ...(!placed ? { placementRevision: this.snapshot.placementRevision + 1 } : {}),
      message: placed
        ? 'Choose a mode, then guess the measurement.'
        : 'Surface lost. Scan and tap another table.',
    });
  }
  reposition(scope: QubitTransformScope) {
    if (
      this.snapshot.sessionId !== scope.sessionId ||
      this.snapshot.placementRevision !== scope.placementRevision ||
      this.snapshot.roundId !== scope.roundId
    )
      return;
    this.setPlaced(scope.sessionId, false, scope.placementRevision);
  }
  setAvailability(simulatorReady: boolean, hardwareReady: boolean) {
    this.update({ simulatorReady, hardwareReady });
  }
  setSphereScale(scope: QubitTransformScope, value: number) {
    if (!this.currentTransform(scope) || this.snapshot.pinching || !Number.isFinite(value)) return;
    const sphereScale = clampARScale(value);
    if (sphereScale !== this.snapshot.sphereScale) this.update({ sphereScale });
  }
  setSphereYaw(scope: QubitTransformScope, value: number) {
    if (!this.currentTransform(scope) || this.snapshot.rotating || !Number.isFinite(value)) return;
    const sphereYaw = normalizeYaw(value);
    if (sphereYaw !== this.snapshot.sphereYaw) this.update({ sphereYaw });
  }
  setSphereHeight(scope: QubitTransformScope, value: number) {
    if (!this.currentTransform(scope) || !Number.isFinite(value)) return;
    const sphereHeight = clampARHeight(value);
    if (sphereHeight !== this.snapshot.sphereHeight) this.update({ sphereHeight });
  }
  pinchSphere(scope: QubitTransformScope, gesture: number, factor: number) {
    if (!this.currentTransform(scope) || ![1, 2, 3].includes(gesture)) return;
    if (!Number.isFinite(factor) || factor <= 0) {
      if (gesture === 3) {
        this.pinchStart = null;
        this.update({ pinching: false });
      }
      return;
    }
    if (gesture === 1) {
      this.pinchStart = this.snapshot.sphereScale;
      this.update({ pinching: true });
    }
    if (this.pinchStart === null) return;
    // Viro reports a factor relative to gesture start, not to the previous callback.
    this.update({ sphereScale: clampARScale(this.pinchStart * factor) });
    if (gesture === 3) {
      this.pinchStart = null;
      this.update({ pinching: false });
    }
  }
  rotateSphere(scope: QubitTransformScope, gesture: number, degrees: number) {
    if (!this.currentTransform(scope) || ![1, 2, 3].includes(gesture)) return;
    if (!Number.isFinite(degrees)) {
      if (gesture === 3) {
        this.rotationStart = null;
        this.update({ rotating: false });
      }
      return;
    }
    if (gesture === 1) {
      this.rotationStart = this.snapshot.sphereYaw;
      this.update({ rotating: true });
    }
    if (this.rotationStart === null) return;
    this.update({ sphereYaw: normalizeYaw(this.rotationStart - degrees) });
    if (gesture === 3) {
      this.rotationStart = null;
      this.update({ rotating: false });
    }
  }
  deferUntil(retryAt: number) {
    this.update({ retryAt: Math.max(this.snapshot.retryAt, retryAt) });
  }
  clearCancellationNotice() {
    if (this.snapshot.cancellationNotice) this.update({ cancellationNotice: '' });
  }
  setMode(mode: QubitMode) {
    if (!['idle', 'complete', 'error'].includes(this.snapshot.phase)) return;
    if (this.snapshot.mode === mode) return;
    this.reset();
    this.update({ mode });
  }
  canGuess(now = this.clock.now()) {
    return canGuessQubit(this.snapshot, now);
  }
  acknowledgeUnknown() {
    if (this.snapshot.phase === 'idle') {
      this.uncertainRounds.clear();
      this.update({ uncertainSubmission: false, cancellationNotice: '' });
    }
  }
  guess(bit: Bit) {
    if ((bit !== 0 && bit !== 1) || !this.canGuess()) return;
    const api = this.getRuntime();
    if (!api || this.snapshot.sessionId === null) return;
    this.clearGestures();
    const round: Round = {
      id: ++this.sequence,
      sessionId: this.snapshot.sessionId,
      api,
      abort: new AbortController(),
      job: null,
      submitted: false,
      terminal: false,
      cancelAttempted: false,
    };
    this.round = round;
    this.update({
      roundId: round.id,
      pinching: false,
      rotating: false,
      phase: 'intro',
      guess: bit,
      measurement: null,
      introDone: false,
      outcome: null,
      jobId: null,
      jobStatus: null,
      message: this.snapshot.mode === 'hardware' ? 'Submitting…' : 'Measuring…',
      cancellationNotice: '',
    });
    if (this.snapshot.mode === 'hardware') void this.submit(round);
    else void this.measure(round);
  }
  private async measure(round: Round) {
    try {
      const measurement = await round.api.measure(round.abort.signal);
      if (this.current(round)) this.acceptMeasurement(measurement);
    } catch (error) {
      this.fail(round, error);
    }
  }
  private async submit(round: Round) {
    round.submitted = true;
    try {
      const job = await round.api.submit(round.abort.signal, (lateJob) =>
        this.retireLateJob(round, lateJob)
      );
      if (!this.current(round)) {
        this.retireLateJob(round, job);
        return;
      }
      await this.acceptJob(round, job);
    } catch (error) {
      this.fail(round, error);
    }
  }
  private retireLateJob(round: Round, job: QuantumJob) {
    round.job = job;
    round.terminal = ['succeeded', 'failed', 'cancelled'].includes(job.status);
    this.uncertainRounds.delete(round.id);
    this.update({ uncertainSubmission: this.uncertainRounds.size > 0 });
    if (round.terminal) {
      void this.cleanup?.settle(job.jobId).catch(() => {});
      return;
    }
    if (this.cleanup) this.update({ hardwareReady: false });
    this.cancel(round);
  }
  private async acceptJob(round: Round, job: QuantumJob) {
    if (!this.current(round)) return;
    if (round.job && round.job.jobId !== job.jobId) {
      this.fail(round, { code: 'invalid_result' });
      return;
    }
    round.job = job;
    round.terminal = ['succeeded', 'failed', 'cancelled'].includes(job.status);
    this.update({ jobId: job.jobId, jobStatus: job.status });
    if (this.cleanup) {
      if (round.terminal) void this.cleanup.settle(job.jobId).catch(() => {});
      else {
        try {
          await this.cleanup.track(job.jobId);
        } catch {
          if (this.current(round)) {
            this.cancel(round);
            this.update({
              phase: 'error',
              message: 'Could not save job cleanup. Cancellation requested.',
              hardwareReady: false,
            });
          }
          return;
        }
      }
    }
    if (!this.current(round)) return;
    if (job.status === 'succeeded') {
      const measurement = await round.api.result(job.jobId, round.abort.signal);
      if (this.current(round)) this.acceptMeasurement(measurement);
    } else if (job.status === 'failed' || job.status === 'cancelled') {
      this.update({
        phase: 'error',
        message: job.status === 'failed' ? 'Job failed. Reset Qubit to retry.' : 'Job cancelled.',
      });
    } else {
      this.update({
        message:
          job.status === 'cancelling'
            ? 'Cancelling…'
            : job.status === 'running'
              ? 'Running…'
              : 'Queued…',
      });
      this.schedulePoll(round);
    }
  }
  private schedulePoll(round: Round) {
    this.clearTimer();
    this.timer = this.clock.schedule(() => {
      this.timer = undefined;
      void this.poll(round);
    }, 15000);
  }
  private async poll(round: Round) {
    if (!this.current(round) || !round.job) return;
    try {
      await this.acceptJob(round, await round.api.status(round.job.jobId, round.abort.signal));
    } catch (error) {
      this.fail(round, error);
    }
  }
  resume() {
    const round = this.round;
    if (
      !round ||
      !this.current(round) ||
      this.snapshot.phase !== 'paused' ||
      this.clock.now() < this.snapshot.retryAt
    )
      return;
    this.clearTimer();
    this.update({
      phase: this.snapshot.introDone ? 'waiting' : 'intro',
      message: 'Reconnecting…',
    });
    void this.poll(round);
  }
  private fail(round: Round, error: unknown) {
    if (!this.current(round)) return;
    this.clearTimer();
    const data =
      error && typeof error === 'object' ? (error as { code?: string; retryAt?: number }) : {};
    const uncertain =
      round.submitted &&
      !round.job &&
      !['credentials', 'rate_limit', 'request_failed'].includes(data.code ?? '');
    if (!round.job && !uncertain) round.submitted = false;
    if (uncertain) this.uncertainRounds.add(round.id);
    const resumable =
      !!round.job && !['invalid_result', 'credentials', 'request_failed'].includes(data.code ?? '');
    const message = uncertain
      ? 'Submission interrupted before confirmation. The job may still run. Reset Qubit to retry.'
      : data.code === 'credentials'
        ? 'Service unavailable. Reset Qubit to retry.'
        : data.code === 'rate_limit'
          ? 'Reconnecting…'
          : data.code === 'invalid_result'
            ? 'Invalid result. Reset Qubit to retry.'
            : resumable
              ? 'Reconnecting…'
              : 'Connection interrupted. Reset Qubit to retry.';
    this.update({
      phase: resumable ? 'paused' : 'error',
      message,
      retryAt: Number.isFinite(data.retryAt) ? data.retryAt! : 0,
      uncertainSubmission: this.snapshot.uncertainSubmission || uncertain,
      ...(uncertain ? { hardwareReady: false } : {}),
      ...(data.code === 'credentials' ? { simulatorReady: false, hardwareReady: false } : {}),
      ...(!round.submitted && ['network', 'timeout', 'unavailable'].includes(data.code ?? '')
        ? { simulatorReady: false }
        : {}),
      ...(!resumable && round.job && !round.terminal ? { hardwareReady: false } : {}),
    });
    if (resumable) {
      this.timer = this.clock.schedule(
        () => {
          this.timer = undefined;
          if (this.current(round)) this.resume();
        },
        Math.max(15000, this.snapshot.retryAt - this.clock.now())
      );
    } else if (round.job && !round.terminal) this.cancel(round);
  }
  private acceptMeasurement(measurement: Bit) {
    if (measurement !== 0 && measurement !== 1) {
      if (this.round) this.fail(this.round, { code: 'invalid_result' });
      return;
    }
    this.update({ measurement, message: 'Measuring…' });
    this.collapseWhenReady();
  }
  finishIntro(sessionId: number, roundId: number) {
    if (
      !this.round ||
      !this.current(this.round) ||
      this.round.id !== roundId ||
      this.round.sessionId !== sessionId ||
      this.snapshot.introDone
    )
      return;
    this.update({
      introDone: true,
      ...(this.snapshot.phase === 'intro' ? { phase: 'waiting' as const } : {}),
    });
    this.collapseWhenReady();
  }
  private collapseWhenReady() {
    if (
      this.snapshot.introDone &&
      this.snapshot.measurement !== null &&
      ['intro', 'waiting'].includes(this.snapshot.phase)
    ) {
      this.update({
        phase: 'collapsing',
        message: 'Measuring…',
      });
    }
  }
  finishCollapse(sessionId: number, roundId: number) {
    if (
      !this.round ||
      !this.current(this.round) ||
      this.round.id !== roundId ||
      this.round.sessionId !== sessionId ||
      this.snapshot.phase !== 'collapsing'
    )
      return;
    const won = this.snapshot.guess === this.snapshot.measurement;
    this.update({
      phase: 'complete',
      outcome: won ? 'won' : 'lost',
      message: `${won ? 'You Won' : 'You Lost'} · ${this.snapshot.measurement}`,
    });
  }
  private cancel(round: Round) {
    if (!round.job || round.terminal || round.cancelAttempted) return;
    round.cancelAttempted = true;
    // Independent request: the round's signal was deliberately aborted before cancellation.
    const job = round.job;
    void (this.cleanup ? this.cleanup.cancel(round.api, job) : round.api.cancel(job.jobId))
      .then(() => {
        if (!this.round && this.cleanup && !this.cleanup.hasPending())
          this.clearCancellationNotice();
      })
      .catch(() => {
        if (!this.round)
          this.update({ cancellationNotice: 'Cancellation pending. Retrying when connected.' });
      });
  }
  reset() {
    this.clearGestures();
    const round = this.round;
    this.round = null;
    this.clearTimer();
    const uncertain = this.snapshot.uncertainSubmission || !!(round?.submitted && !round.job);
    if (round?.submitted && !round.job) this.uncertainRounds.add(round.id);
    let notice = this.snapshot.cancellationNotice;
    if (round) {
      round.abort.abort();
      if (round.job && !round.terminal) {
        this.cancel(round);
        notice = 'Cancelling…';
      } else if (round.submitted && !round.job) notice = '';
    }
    this.update({
      roundId: ++this.sequence,
      pinching: false,
      rotating: false,
      phase: 'idle',
      guess: null,
      measurement: null,
      introDone: false,
      outcome: null,
      jobId: null,
      jobStatus: null,
      message: this.snapshot.placed
        ? 'Choose a mode, then guess the measurement.'
        : 'Place the Bloch sphere on a table.',
      uncertainSubmission: uncertain,
      cancellationNotice: notice,
      ...(this.cleanup && round?.job && !round.terminal ? { hardwareReady: false } : {}),
    });
  }
}
