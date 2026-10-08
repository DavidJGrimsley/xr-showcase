import type {
  Bit,
  JobStatus,
  QuantumClock,
  QuantumJob,
  QuantumRuntime,
} from '../../services/quantum-api';
import type { QubitCleanup } from './qubit-job-cleanup';

export type QubitMode = 'simulator' | 'hardware';
export const MIN_SPHERE_SCALE = 0.5;
export const MAX_SPHERE_SCALE = 3;
const SPHERE_SCALE_STEP = 0.25;
export type RoundPhase =
  'idle' | 'intro' | 'waiting' | 'collapsing' | 'complete' | 'paused' | 'error';
export interface QubitSnapshot {
  sessionId: number | null;
  roundId: number;
  placed: boolean;
  sphereScale: number;
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
    sphereScale: 1,
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
  private pinch: { sessionId: number; startScale: number } | null = null;
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
  attach(sessionId: number) {
    if (this.snapshot.sessionId === sessionId) return;
    this.reset();
    this.update({ sessionId, placed: false, tracking: false });
  }
  detach(sessionId: number) {
    if (this.snapshot.sessionId !== sessionId) return;
    this.reset();
    this.update({ sessionId: null, placed: false, tracking: false });
  }
  setTracking(sessionId: number, tracking: boolean) {
    if (this.snapshot.sessionId === sessionId && this.snapshot.tracking !== tracking)
      this.update({ tracking });
  }
  setPlaced(sessionId: number, placed: boolean) {
    if (this.snapshot.sessionId !== sessionId) return;
    if (!placed) this.reset();
    this.update({
      placed,
      message: placed
        ? 'Choose a mode, then guess the measurement.'
        : 'Surface lost. Scan and tap another table.',
    });
  }
  setAvailability(simulatorReady: boolean, hardwareReady: boolean) {
    this.update({ simulatorReady, hardwareReady });
  }
  private setSphereScale(sessionId: number, scale: number) {
    if (
      this.snapshot.sessionId !== sessionId ||
      !this.snapshot.placed ||
      !Number.isFinite(scale) ||
      scale <= 0
    )
      return;
    const sphereScale = Math.max(MIN_SPHERE_SCALE, Math.min(MAX_SPHERE_SCALE, scale));
    if (sphereScale !== this.snapshot.sphereScale) this.update({ sphereScale });
  }
  adjustSphereScale(sessionId: number, direction: -1 | 1) {
    if (
      this.snapshot.sessionId !== sessionId ||
      !this.snapshot.placed ||
      (direction !== -1 && direction !== 1)
    )
      return;
    this.pinch = null;
    this.setSphereScale(sessionId, this.snapshot.sphereScale + direction * SPHERE_SCALE_STEP);
  }
  pinchSphere(sessionId: number, gesture: number, factor: number) {
    if (
      this.snapshot.sessionId !== sessionId ||
      !this.snapshot.placed ||
      !Number.isFinite(factor) ||
      factor <= 0
    )
      return;
    if (gesture === 1) {
      this.pinch = { sessionId, startScale: this.snapshot.sphereScale };
      return;
    }
    if (!this.pinch || this.pinch.sessionId !== sessionId || (gesture !== 2 && gesture !== 3))
      return;
    // Viro reports a factor relative to gesture start, not to the previous callback.
    this.setSphereScale(sessionId, this.pinch.startScale * factor);
    if (gesture === 3) this.pinch = null;
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
    const state = this.snapshot;
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
    this.pinch = null;
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
