import type { QuantumClock, QuantumRuntime } from '../../services/quantum-api';
import type { QubitRoundController } from './qubit-round-controller';

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
  private snapshot = { busy: false, message: 'Connecting…' };
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
  constructor(
    api: ConnectionAPI | null,
    rounds: QubitRoundController,
    cleanup: CleanupRecovery,
    clock = defaultClock
  ) {
    this.api = api;
    this.rounds = rounds;
    this.cleanup = cleanup;
    this.clock = clock;
    if (!api) this.snapshot.message = 'Demo service unavailable.';
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(busy: boolean, message: string) {
    this.snapshot = { busy, message };
    this.listeners.forEach((listener) => listener());
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
    this.active = false;
    this.generation++;
    this.abort?.abort();
    this.abort = undefined;
    if (this.timer !== undefined) this.clock.cancel(this.timer);
    this.timer = undefined;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }
  private schedule() {
    if (!this.active || this.timer !== undefined) return;
    this.timer = this.clock.schedule(
      () => {
        this.timer = undefined;
        void this.check();
      },
      Math.max(15000, this.retryAt - this.clock.now())
    );
  }
  private async check() {
    if (!this.active || !this.api || this.abort) return;
    if (this.clock.now() < this.retryAt || !this.betweenRounds()) {
      this.schedule();
      return;
    }
    const api = this.api;
    const token = ++this.generation;
    const abort = new AbortController();
    this.abort = abort;
    const current = () => this.active && token === this.generation;
    this.update(true, 'Connecting…');
    let simulator = false;
    let hardware = false;
    let cleanupReady = true;
    try {
      // Old jobs are never resumed: reopen cancels them before enabling hardware again.
      await this.cleanup.recover(api).catch((error: unknown) => {
        cleanupReady = false;
        const data = error && typeof error === 'object' ? (error as { retryAt?: number }) : {};
        if (Number.isFinite(data.retryAt)) this.retryAt = Math.max(this.retryAt, data.retryAt!);
      });
      if (!current()) return;
      if (cleanupReady) this.rounds.clearCancellationNotice();
      if (this.clock.now() < this.retryAt) throw { retryAt: this.retryAt };
      await api.health(abort.signal);
      if (!current()) return;
      simulator = true;
      await api.checkHardware(abort.signal);
      if (!current()) return;
      hardware = cleanupReady;
      this.update(false, cleanupReady ? '' : 'Finishing cancellation…');
    } catch (error) {
      if (!current()) return;
      const data =
        error && typeof error === 'object' ? (error as { code?: string; retryAt?: number }) : {};
      if (data.code === 'credentials') simulator = false;
      this.retryAt = Number.isFinite(data.retryAt) ? Math.max(this.retryAt, data.retryAt!) : 0;
      this.rounds.deferUntil(this.retryAt);
      this.update(false, 'Reconnecting…');
    } finally {
      if (current()) {
        this.abort = undefined;
        this.rounds.setAvailability(simulator, hardware);
        if (!hardware) this.schedule();
      }
    }
  }
}
