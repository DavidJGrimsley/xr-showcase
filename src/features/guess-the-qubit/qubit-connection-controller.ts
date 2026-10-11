import type { QuantumClock, QuantumRuntime } from '../../services/quantum-api';
import type { QubitRoundController } from './qubit-round-controller';
import { qubitConnectionMessage, qubitFailure, type QubitFailureCode } from './qubit-errors.ts';

export interface QubitConnectionSnapshot {
  busy: boolean;
  message: string;
  warning: boolean;
  canRetry: boolean;
  retryAt: number;
}
type ConnectionStage = 'cleanup' | 'health' | 'hardware';
export interface QubitConnectionDiagnostic {
  attempt: number;
  event:
    | 'started'
    | 'stage_started'
    | 'stage_completed'
    | 'stage_failed'
    | 'availability'
    | 'retry_scheduled'
    | 'stopped';
  stage?: ConnectionStage;
  durationMs?: number;
  errorCode?: QubitFailureCode;
  status?: number;
  retryInMs?: number;
  simulatorReady?: boolean;
  hardwareReady?: boolean;
}

interface ConnectionAPI extends QuantumRuntime {
  health(signal: AbortSignal): Promise<'qiskit' | 'classical-fallback'>;
  checkHardware(signal: AbortSignal): Promise<void>;
}
interface CleanupRecovery {
  recover(api: QuantumRuntime): Promise<void>;
  hasPending(): boolean;
}
const defaultClock: QuantumClock = {
  now: () => Date.now(),
  schedule: (callback, delay) => setTimeout(callback, delay),
  cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export class QubitConnectionController {
  private snapshot: QubitConnectionSnapshot = {
    busy: false,
    message: 'Connecting…',
    warning: false,
    canRetry: false,
    retryAt: 0,
  };
  private listeners = new Set<() => void>();
  private api: ConnectionAPI | null;
  private rounds: QubitRoundController;
  private cleanup: CleanupRecovery;
  private clock: QuantumClock;
  private active = false;
  private generation = 0;
  private abort: AbortController | undefined;
  private timer: unknown;
  private unsubscribe?: () => void;
  private retryAt = 0;
  private diagnostics?: (event: QubitConnectionDiagnostic) => void;
  constructor(
    api: ConnectionAPI | null,
    rounds: QubitRoundController,
    cleanup: CleanupRecovery,
    clock = defaultClock,
    diagnostics?: (event: QubitConnectionDiagnostic) => void
  ) {
    this.api = api;
    this.rounds = rounds;
    this.cleanup = cleanup;
    this.clock = clock;
    this.diagnostics = diagnostics;
    if (!api) this.update(false, qubitConnectionMessage('configuration'), 'configuration');
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(busy: boolean, message: string, failure: QubitFailureCode | null = null) {
    this.snapshot = {
      busy,
      message,
      warning: !!failure,
      canRetry: !!this.api && !busy && !!failure,
      retryAt: this.retryAt,
    };
    this.listeners.forEach((listener) => listener());
  }
  private report(event: QubitConnectionDiagnostic) {
    try {
      this.diagnostics?.(event);
    } catch {}
  }
  private betweenRounds() {
    return ['idle', 'complete', 'error'].includes(this.rounds.getSnapshot().phase);
  }
  start() {
    if (this.active || !this.api) return;
    this.active = true;
    this.unsubscribe = this.rounds.subscribe(() => {
      if (
        this.betweenRounds() &&
        !this.abort &&
        this.timer === undefined &&
        (!this.rounds.getSnapshot().hardwareReady ||
          !this.rounds.getSnapshot().simulatorReady ||
          this.cleanup.hasPending())
      )
        this.schedule();
    });
    void this.check();
  }
  stop() {
    if (this.active) this.report({ attempt: this.generation, event: 'stopped' });
    this.active = false;
    this.generation++;
    this.abort?.abort();
    this.abort = undefined;
    if (this.timer !== undefined) this.clock.cancel(this.timer);
    this.timer = undefined;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }
  retry = () => {
    // Retry checks connectivity only. Never repeat a measurement or hardware submission,
    // overlap a live check, or bypass a service Retry-After deadline.
    if (
      !this.active ||
      !this.api ||
      this.abort ||
      !this.betweenRounds() ||
      this.clock.now() < Math.max(this.retryAt, this.rounds.getSnapshot().retryAt)
    )
      return false;
    if (this.timer !== undefined) this.clock.cancel(this.timer);
    this.timer = undefined;
    void this.check();
    return true;
  };
  private schedule() {
    if (!this.active || this.timer !== undefined) return;
    const delay = Math.max(
      15000,
      this.retryAt - this.clock.now(),
      this.rounds.getSnapshot().retryAt - this.clock.now()
    );
    this.report({ attempt: this.generation, event: 'retry_scheduled', retryInMs: delay });
    if (!this.snapshot.message)
      this.update(false, 'Connection recovery is pending. Retrying automatically.', 'network');
    this.timer = this.clock.schedule(() => {
      this.timer = undefined;
      void this.check();
    }, delay);
  }
  private async check() {
    if (!this.active || !this.api || this.abort) return;
    if (
      this.clock.now() < Math.max(this.retryAt, this.rounds.getSnapshot().retryAt) ||
      !this.betweenRounds()
    ) {
      this.schedule();
      return;
    }
    const api = this.api;
    const token = ++this.generation;
    const abort = new AbortController();
    this.abort = abort;
    const current = () => this.active && token === this.generation;
    this.report({ attempt: token, event: 'started' });
    this.update(true, 'Connecting…');
    let simulator = false;
    let hardware = false;
    let cleanupFailure: ReturnType<typeof qubitFailure> | null = null;
    let stage: ConnectionStage = 'cleanup';
    const step = async <T>(next: ConnectionStage, run: () => Promise<T>) => {
      const started = this.clock.now();
      this.report({ attempt: token, event: 'stage_started', stage: next });
      this.update(
        true,
        next === 'cleanup'
          ? 'Checking previous hardware jobs…'
          : next === 'health'
            ? 'Checking quantum service…'
            : 'Checking quantum hardware…'
      );
      try {
        const result = await run();
        if (current())
          this.report({
            attempt: token,
            event: 'stage_completed',
            stage: next,
            durationMs: Math.max(0, this.clock.now() - started),
          });
        return result;
      } catch (error) {
        const failure = qubitFailure(error);
        if (current())
          this.report({
            attempt: token,
            event: 'stage_failed',
            stage: next,
            durationMs: Math.max(0, this.clock.now() - started),
            errorCode: failure.code,
            status: failure.status,
            retryInMs: Math.max(0, failure.retryAt - this.clock.now()),
          });
        throw error;
      }
    };
    try {
      // Old jobs are never resumed: reopen cancels them before enabling hardware again.
      cleanupFailure = await step('cleanup', () => this.cleanup.recover(api)).then(
        () => null,
        (error: unknown) => qubitFailure(error)
      );
      if (!current()) return;
      if (cleanupFailure) this.retryAt = Math.max(this.retryAt, cleanupFailure.retryAt);
      if (!cleanupFailure) this.rounds.clearCancellationNotice();
      if (this.clock.now() < this.retryAt) throw { code: 'rate_limit', retryAt: this.retryAt };
      stage = 'health';
      await step(stage, () => api.health(abort.signal));
      if (!current()) return;
      simulator = true;
      stage = 'hardware';
      await step(stage, () => api.checkHardware(abort.signal));
      if (!current()) return;
      hardware = !cleanupFailure;
      this.retryAt = 0;
      if (cleanupFailure) {
        const failure = cleanupFailure;
        const message =
          failure.code === 'cleanup_storage'
            ? qubitConnectionMessage(failure.code)
            : failure.code === 'credentials'
              ? 'Previous hardware job cancellation was denied. Hardware is paused; try Simulator.'
              : qubitConnectionMessage('cleanup_pending');
        this.update(false, message, failure.code);
      } else this.update(false, '');
    } catch (error) {
      if (!current()) return;
      const failure = qubitFailure(error);
      if (failure.code === 'credentials') simulator = false;
      this.retryAt = Math.max(this.retryAt, failure.retryAt);
      this.rounds.deferUntil(this.retryAt);
      this.update(
        false,
        qubitConnectionMessage(failure.code, stage === 'hardware' && simulator),
        failure.code
      );
    } finally {
      if (current()) {
        this.abort = undefined;
        this.rounds.setAvailability(simulator, hardware);
        this.report({
          attempt: token,
          event: 'availability',
          simulatorReady: simulator,
          hardwareReady: hardware,
        });
        if (!hardware) this.schedule();
      }
    }
  }
}
