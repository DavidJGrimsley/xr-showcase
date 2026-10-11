import type { QuantumErrorCode } from '../../services/quantum-api';

export type QubitFailureCode =
  QuantumErrorCode | 'cleanup_pending' | 'cleanup_storage' | 'configuration';
export interface QubitFailure {
  code: QubitFailureCode;
  status: number;
  retryAt: number;
}
const codes: QubitFailureCode[] = [
  'credentials',
  'rate_limit',
  'unavailable',
  'backend_unavailable',
  'network',
  'timeout',
  'aborted',
  'invalid_result',
  'request_failed',
  'cleanup_pending',
  'cleanup_storage',
  'configuration',
];

// Never expose remote bodies, exception messages, credentials or job identifiers.
export function qubitFailure(error: unknown): QubitFailure {
  const data =
    error && typeof error === 'object'
      ? (error as { code?: unknown; status?: unknown; retryAt?: unknown })
      : {};
  const retryAt =
    typeof data.retryAt === 'number' && Number.isFinite(data.retryAt)
      ? Math.max(0, data.retryAt)
      : 0;
  const code = codes.find((code) => code === data.code) ?? (retryAt ? 'rate_limit' : 'network');
  const status =
    typeof data.status === 'number' &&
    Number.isInteger(data.status) &&
    data.status >= 100 &&
    data.status <= 599
      ? data.status
      : 0;
  return { code, status, retryAt };
}

export function qubitConnectionMessage(code: QubitFailureCode, hardwareOnly = false) {
  switch (code) {
    case 'credentials':
      return 'Quantum service access denied. Reload the updated app.';
    case 'rate_limit':
      return 'Quantum service is busy. Waiting before retrying.';
    case 'backend_unavailable':
      return 'Selected quantum hardware is unavailable. Try Simulator while we retry.';
    case 'unavailable':
      return hardwareOnly
        ? 'Quantum hardware service is unavailable. Try Simulator while we retry.'
        : 'Quantum service is unavailable. Retrying automatically.';
    case 'timeout':
      return hardwareOnly
        ? 'Quantum hardware check timed out. Try Simulator while we retry.'
        : 'Quantum service timed out. Retrying automatically.';
    case 'invalid_result':
      return 'Quantum service returned an invalid response. Retrying automatically.';
    case 'request_failed':
      return 'Quantum service rejected the request. Check the app’s service configuration.';
    case 'cleanup_storage':
      return 'Could not read or save job cleanup on this phone. Hardware is paused; try Simulator.';
    case 'cleanup_pending':
      return 'Previous hardware job cancellation is still pending. Try Simulator while we retry.';
    case 'configuration':
      return 'Quantum service is not configured in this app. Reload an updated build.';
    case 'aborted':
      return 'Connection check was interrupted. Retry connection.';
    default:
      return hardwareOnly
        ? 'Cannot reach quantum hardware. Check your internet connection or try Simulator.'
        : 'Cannot reach the quantum service. Check your internet connection. Retrying automatically.';
  }
}

export function qubitRoundMessage(code: QubitFailureCode, resumable: boolean) {
  const action = resumable
    ? 'Retrying the existing job automatically.'
    : 'Reset Qubit to try again.';
  switch (code) {
    case 'credentials':
      return 'Quantum service access denied. Reload the updated app.';
    case 'rate_limit':
      return `Quantum service is busy. ${resumable ? action : 'Wait, then Reset Qubit to try again.'}`;
    case 'timeout':
      return `Quantum request timed out. ${action}`;
    case 'unavailable':
    case 'backend_unavailable':
      return `Quantum service is unavailable. ${action}`;
    case 'invalid_result':
      return 'Invalid result. No measurement was accepted. Reset Qubit to try again.';
    case 'request_failed':
      return 'Quantum service rejected the request. Reset Qubit; if it continues, check the app’s service configuration.';
    default:
      return `Connection interrupted. Check your internet connection. ${action}`;
  }
}

export function qubitRetryMessage(message: string, retryAt: number, now: number) {
  return retryAt > now
    ? `${message} Retry available in ${Math.ceil((retryAt - now) / 1000)}s.`
    : message;
}
