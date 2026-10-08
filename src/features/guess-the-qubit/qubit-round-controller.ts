import type {
  Bit,
  JobStatus,
  QuantumClock,
  QuantumJob,
  QuantumRuntime,
} from '../../services/quantum-api';

export type QubitMode = 'simulator' | 'hardware';
export type RoundPhase =
  'idle' | 'intro' | 'waiting' | 'collapsing' | 'complete' | 'paused' | 'error';
export interface QubitSnapshot {
  sessionId: number | null;
  roundId: number;
  placed: boolean;
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
  constructor(getRuntime: () => QuantumRuntime | null, clock = defaultClock) {
    this.getRuntime = getRuntime;
    this.clock = clock;
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
  deferUntil(retryAt: number) {
    this.update({ retryAt: Math.max(this.snapshot.retryAt, retryAt) });
  }
  setMode(mode: QubitMode) {
    if (this.snapshot.phase !== 'idle') return;
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
    if (this.snapshot.phase === 'idle') this.update({ uncertainSubmission: false });
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
      message:
        this.snapshot.mode === 'hardware'
          ? 'Submitting one hardware shot…'
          : 'Preparing π/2 and measuring…',
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
    if (job.status === 'succeeded') {
      const measurement = await round.api.result(job.jobId, round.abort.signal);
      if (this.current(round)) this.acceptMeasurement(measurement);
    } else if (job.status === 'failed' || job.status === 'cancelled') {
      this.update({
        phase: 'error',
        message:
          job.status === 'failed'
            ? 'Hardware job failed. Reset to try a new round.'
            : 'Hardware job was cancelled. Reset to start a new round.',
      });
    } else {
      this.update({
        message:
          job.status === 'cancelling'
            ? 'Hardware cancellation is pending…'
            : job.status === 'running'
              ? 'Hardware is running. Waiting for one measurement…'
              : 'Hardware job is queued. Checking every 15 seconds…',
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
    this.update({
      phase: this.snapshot.introDone ? 'waiting' : 'intro',
      message: 'Resuming the existing hardware job…',
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
    const resumable = !!round.job && data.code !== 'invalid_result';
    const message = uncertain
      ? 'Submission outcome is unknown. A hardware job may still run. Check with the owner before authorizing another shot.'
      : data.code === 'credentials'
        ? 'Access denied. Reset and check the saved key or profile.'
        : data.code === 'rate_limit'
          ? 'Rate limited. Wait, then resume the existing job or reset.'
          : data.code === 'invalid_result'
            ? 'Invalid measurement or job response. No result was accepted. Reset to recover.'
            : resumable
              ? 'Connection interrupted. Resume checks the same job without submitting another shot.'
              : 'The measurement request failed. Check your connection and configuration, then Reset.';
    this.update({
      phase: resumable ? 'paused' : 'error',
      message,
      retryAt: Number.isFinite(data.retryAt) ? data.retryAt! : 0,
      uncertainSubmission: this.snapshot.uncertainSubmission || uncertain,
    });
  }
  private acceptMeasurement(measurement: Bit) {
    if (measurement !== 0 && measurement !== 1) {
      if (this.round) this.fail(this.round, { code: 'invalid_result' });
      return;
    }
    this.update({ measurement, message: 'Measurement received. Finishing the preparation…' });
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
        message: `Collapsing to |${this.snapshot.measurement}⟩…`,
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
      message: `${won ? 'You Won' : 'You Lost'} — measured ${this.snapshot.measurement}. Reset to play again.`,
    });
  }
  private cancel(round: Round) {
    if (!round.job || round.terminal || round.cancelAttempted) return;
    round.cancelAttempted = true;
    // Independent request: the round's signal was deliberately aborted before cancellation.
    void round.api.cancel(round.job.jobId).catch(() => {
      /* Best effort; local teardown must always finish. */
    });
  }
  reset() {
    const round = this.round;
    this.round = null;
    this.clearTimer();
    const uncertain = this.snapshot.uncertainSubmission || !!(round?.submitted && !round.job);
    let notice = this.snapshot.cancellationNotice;
    if (round) {
      round.abort.abort();
      if (round.job && !round.terminal) {
        this.cancel(round);
        notice = 'Cancellation requested. Remote cancellation is not guaranteed.';
      } else if (round.submitted && !round.job)
        notice = 'Submission stopped locally. A late job ID will be cancelled if received.';
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
    });
  }
}
