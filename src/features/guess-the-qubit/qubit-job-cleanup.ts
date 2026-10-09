import type { QuantumClock, QuantumJob, QuantumRuntime } from '../../services/quantum-api';

export const QUBIT_PENDING_JOBS_KEY = 'xr-showcase.qubit.pending-jobs.v1';
export interface QubitJobStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
export interface QubitCleanup {
  hasPending(): boolean;
  track(jobId: string): Promise<void>;
  settle(jobId: string): Promise<void>;
  cancel(api: QuantumRuntime, job: QuantumJob): Promise<void>;
}

// Persist only this game's job IDs, never credentials. Recover cancellation on the next launch.
export class QubitJobCleanup implements QubitCleanup {
  private storage: QubitJobStorage;
  private ids = new Set<string>();
  private loadPromise: Promise<void> | undefined;
  private writes: Promise<void> = Promise.resolve();
  private cancellations = new Map<string, Promise<void>>();
  private retryAt = 0;
  private clock: Pick<QuantumClock, 'now'>;
  constructor(storage: QubitJobStorage, clock = { now: () => Date.now() }) {
    this.storage = storage;
    this.clock = clock;
  }
  hasPending() {
    return this.ids.size > 0;
  }
  private load() {
    this.loadPromise ??= this.storage
      .getItem(QUBIT_PENDING_JOBS_KEY)
      .then((stored) => {
        if (stored === null) return;
        const ids: unknown = JSON.parse(stored);
        if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string' || !id))
          throw new Error();
        this.ids = new Set(ids);
      })
      .catch(() => {
        this.loadPromise = undefined;
        throw new Error('Job cleanup could not load.');
      });
    return this.loadPromise;
  }
  private write() {
    const ids = JSON.stringify([...this.ids]);
    const next = this.writes
      .catch(() => {})
      .then(() => this.storage.setItem(QUBIT_PENDING_JOBS_KEY, ids));
    this.writes = next;
    return next.catch(() => {
      throw new Error('Job cleanup could not save.');
    });
  }
  async track(jobId: string) {
    await this.load();
    this.ids.add(jobId);
    await this.write();
  }
  async settle(jobId: string) {
    await this.load();
    this.ids.delete(jobId);
    await this.write();
  }
  cancel(api: QuantumRuntime, job: QuantumJob): Promise<void> {
    const existing = this.cancellations.get(job.jobId);
    if (existing) return existing;
    const cancellation = (async () => {
      if (this.clock.now() < this.retryAt) throw new Error('Cancellation pending.');
      // Still attempt the bounded network cancellation if local storage fails.
      const tracking = this.track(job.jobId).catch(() => {});
      let result: QuantumJob;
      try {
        result = await api.cancel(job.jobId);
      } catch (error) {
        const data =
          error && typeof error === 'object'
            ? (error as { status?: number; retryAt?: number })
            : {};
        if (data.status === 404) {
          await tracking;
          await this.settle(job.jobId);
          return;
        }
        if (Number.isFinite(data.retryAt)) this.retryAt = Math.max(this.retryAt, data.retryAt!);
        throw new Error('Cancellation pending.');
      }
      if (result.jobId !== job.jobId) throw new Error('Cancellation was not confirmed.');
      if (['succeeded', 'failed', 'cancelled'].includes(result.status)) {
        await tracking;
        await this.settle(job.jobId);
      }
    })().finally(() => this.cancellations.delete(job.jobId));
    this.cancellations.set(job.jobId, cancellation);
    return cancellation;
  }
  async recover(api: QuantumRuntime) {
    await this.load();
    const results = await Promise.allSettled(
      [...this.ids].map((jobId) => this.cancel(api, { jobId, status: 'queued' }))
    );
    if (results.some((result) => result.status === 'rejected') || this.ids.size)
      throw Object.assign(new Error('Job cleanup pending.'), { retryAt: this.retryAt });
  }
}
