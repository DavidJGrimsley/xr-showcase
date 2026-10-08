import { QuantumApiClient as QuantumSDK, QuantumApiError } from '@mr.dj2u/quantum-api';

export const QUANTUM_API_BASE = 'https://davidjgrimsley.com/public-facing/api/quantum/v1';
export type Bit = 0 | 1;
export type JobStatus = 'queued' | 'running' | 'cancelling' | 'succeeded' | 'failed' | 'cancelled';
export interface QuantumJob {
  jobId: string;
  status: JobStatus;
}
export interface QuantumCredentials {
  apiKey: string;
  backend: string;
  profile: string;
  baseUrl?: string;
}
export interface QuantumRuntime {
  measure(signal: AbortSignal): Promise<Bit>;
  submit(signal: AbortSignal, onLateJob: (job: QuantumJob) => void): Promise<QuantumJob>;
  status(jobId: string, signal: AbortSignal): Promise<QuantumJob>;
  result(jobId: string, signal: AbortSignal): Promise<Bit>;
  cancel(jobId: string): Promise<QuantumJob>;
}
export type QuantumTransport = typeof globalThis.fetch;
export interface QuantumClock {
  now(): number;
  schedule(callback: () => void, delayMs: number): unknown;
  cancel(handle: unknown): void;
}
export const quantumClock: QuantumClock = {
  now: () => Date.now(),
  schedule: (callback, delay) => setTimeout(callback, delay),
  cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};
export type QuantumErrorCode =
  | 'credentials'
  | 'rate_limit'
  | 'unavailable'
  | 'network'
  | 'timeout'
  | 'aborted'
  | 'invalid_result'
  | 'request_failed';
const messages: Record<QuantumErrorCode, string> = {
  credentials: 'The demo service denied access. Reset or try again later.',
  rate_limit: 'The service is limiting requests. Wait before trying again.',
  unavailable: 'The quantum service or selected backend is unavailable.',
  network: 'Connection lost. Check the network before trying again.',
  timeout: 'The request timed out.',
  aborted: 'The request was stopped.',
  invalid_result: 'The service returned an invalid result. No measurement was accepted.',
  request_failed: 'The request could not be completed. Check the configuration and try again.',
};
export class QuantumError extends Error {
  code: QuantumErrorCode;
  status: number;
  retryAt: number;
  constructor(code: QuantumErrorCode, status = 0, retryAt = 0) {
    super(messages[code]);
    this.name = 'QuantumError';
    this.code = code;
    this.status = status;
    this.retryAt = retryAt;
  }
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new QuantumError('invalid_result');
  return value as Record<string, unknown>;
}
export function parseMeasurement(value: unknown): Bit {
  const measurement = record(value).measurement;
  if (measurement !== 0 && measurement !== 1) throw new QuantumError('invalid_result');
  return measurement;
}
export function parseJob(value: unknown, expectedId?: string): QuantumJob {
  const data = record(value);
  const statuses: unknown[] = [
    'queued',
    'running',
    'cancelling',
    'succeeded',
    'failed',
    'cancelled',
  ];
  if (
    typeof data.job_id !== 'string' ||
    !data.job_id.trim() ||
    (expectedId && data.job_id !== expectedId) ||
    !statuses.includes(data.status)
  )
    throw new QuantumError('invalid_result');
  return { jobId: data.job_id, status: data.status as JobStatus };
}
export function parseHardwareResult(value: unknown, expectedId: string): Bit {
  const data = record(value);
  if (data.job_id !== expectedId || data.status !== 'succeeded')
    throw new QuantumError('invalid_result');
  const result = record(data.result);
  if (result.num_qubits !== 1 || result.shots !== 1) throw new QuantumError('invalid_result');
  const counts = record(result.counts);
  const entries = Object.entries(counts);
  if (
    !entries.length ||
    entries.some(
      ([key, count]) =>
        !['0', '1'].includes(key) ||
        typeof count !== 'number' ||
        !Number.isInteger(count) ||
        count < 0
    ) ||
    entries.reduce((sum, [, count]) => sum + (count as number), 0) !== 1
  )
    throw new QuantumError('invalid_result');
  return counts['1'] === 1 ? 1 : 0;
}

export class QuantumApiClient implements QuantumRuntime {
  private sdk: QuantumSDK;
  private credentials: QuantumCredentials;
  private clock: QuantumClock;
  constructor(transport: QuantumTransport, credentials: QuantumCredentials, clock = quantumClock) {
    this.credentials = { ...credentials };
    this.clock = clock;
    this.sdk = new QuantumSDK({
      baseUrl: credentials.baseUrl ?? QUANTUM_API_BASE,
      apiKey: credentials.apiKey,
      fetchImpl: transport,
    });
  }
  private async request<T>(
    signal: AbortSignal | undefined,
    execute: (signal: AbortSignal) => Promise<unknown>,
    parse: (data: unknown) => T,
    onLate?: (value: T) => void,
    timeout = 12000
  ): Promise<T> {
    if (signal?.aborted) throw new QuantumError('aborted');
    const controller = new AbortController();
    let abandoned = false;
    let rejectStop: (error: QuantumError) => void = () => {};
    const stopped = new Promise<never>((_, reject) => {
      rejectStop = reject;
    });
    const stop = (code: 'aborted' | 'timeout') => {
      abandoned = true;
      rejectStop(new QuantumError(code));
      controller.abort();
    };
    const abort = () => stop('aborted');
    signal?.addEventListener('abort', abort, { once: true });
    const timer = this.clock.schedule(() => stop('timeout'), timeout);
    const operation = async () => {
      try {
        const value = parse(await execute(controller.signal));
        if (abandoned) onLate?.(value);
        return value;
      } catch (error) {
        if (error instanceof QuantumError) throw error;
        if (error instanceof QuantumApiError) {
          const code =
            error.status === 401 || error.status === 403
              ? 'credentials'
              : error.status === 429
                ? 'rate_limit'
                : error.status >= 500
                  ? 'unavailable'
                  : 'request_failed';
          const retry = error.headers['retry-after'];
          const seconds = retry === undefined ? NaN : Number(retry);
          const retryAt = Number.isFinite(seconds)
            ? this.clock.now() + Math.max(0, seconds) * 1000
            : retry
              ? Date.parse(retry)
              : NaN;
          // SDK errors retain remote bodies. Expose only sanitized game errors.
          throw new QuantumError(
            code,
            error.status,
            code === 'rate_limit'
              ? Math.max(this.clock.now() + 15000, Number.isFinite(retryAt) ? retryAt : 0)
              : 0
          );
        }
        if (error instanceof SyntaxError) throw new QuantumError('invalid_result');
        throw new QuantumError('network');
      }
    };
    try {
      return await Promise.race([operation(), stopped]);
    } finally {
      this.clock.cancel(timer);
      signal?.removeEventListener('abort', abort);
    }
  }
  health(signal: AbortSignal) {
    return this.request(
      signal,
      (signal) => this.sdk.health({ signal }),
      (value) => {
        const data = record(value);
        if (
          data.status !== 'healthy' ||
          !['qiskit', 'classical-fallback'].includes(data.runtime_mode as string)
        )
          throw new QuantumError('unavailable');
        return data.runtime_mode as 'qiskit' | 'classical-fallback';
      }
    );
  }
  async checkHardware(signal: AbortSignal): Promise<void> {
    await this.request(
      signal,
      (signal) =>
        this.sdk.listBackends(
          {
            provider: 'ibm',
            min_qubits: 1,
            ibm_profile: this.credentials.profile,
          },
          { signal }
        ),
      (value) => {
        const backends = record(value).backends;
        if (
          !Array.isArray(backends) ||
          !backends.some((item) => {
            const backend = record(item);
            return (
              backend.name === this.credentials.backend &&
              backend.is_hardware === true &&
              backend.is_simulator === false &&
              typeof backend.num_qubits === 'number' &&
              backend.num_qubits >= 1
            );
          })
        )
          throw new QuantumError('unavailable');
      }
    );
  }
  measure(signal: AbortSignal) {
    return this.request(
      signal,
      (signal) =>
        this.sdk.runGate(
          {
            gate_type: 'rotation',
            rotation_angle_rad: Math.PI / 2,
          },
          { signal }
        ),
      parseMeasurement
    );
  }
  submit(signal: AbortSignal, onLateJob: (job: QuantumJob) => void) {
    return this.request(
      signal,
      (signal) =>
        this.sdk.submitCircuitJob(
          {
            provider: 'ibm',
            backend_name: this.credentials.backend,
            ibm_profile: this.credentials.profile,
            shots: 1,
            circuit: { num_qubits: 1, operations: [{ gate: 'ry', target: 0, theta: Math.PI / 2 }] },
          },
          { signal }
        ),
      (data) => parseJob(data),
      onLateJob,
      30000
    );
  }
  status(jobId: string, signal: AbortSignal) {
    return this.request(
      signal,
      (signal) => this.sdk.getCircuitJob(jobId, { signal }),
      (data) => parseJob(data, jobId)
    );
  }
  result(jobId: string, signal: AbortSignal) {
    return this.request(
      signal,
      (signal) => this.sdk.getCircuitJobResult(jobId, { signal }),
      (data) => parseHardwareResult(data, jobId)
    );
  }
  cancel(jobId: string) {
    return this.request(
      undefined,
      (signal) => this.sdk.cancelCircuitJob(jobId, { signal }),
      (data) => parseJob(data, jobId),
      undefined,
      8000
    );
  }
}
