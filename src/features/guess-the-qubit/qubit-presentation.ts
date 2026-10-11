import type { QubitSnapshot } from './qubit-round-controller';
import type { QubitConnectionSnapshot } from './qubit-connection-controller';
import { qubitRetryMessage } from './qubit-errors.ts';

export const PLACEMENT_CAPTION =
  'Move slowly, then tap a highlighted flat surface to place a Bloch Sphere.';
export const HARDWARE_CAPTION =
  'Hardware queues can take time. Keep this screen open; leaving requests cancellation.';
export const TRACKING_CAPTION =
  'AR tracking paused. Lift your phone and point it at a well-lit surface.';

export function qubitPresentation(
  state: QubitSnapshot,
  connection: string,
  busy: boolean,
  now: number,
  connectionState?: Pick<QubitConnectionSnapshot, 'warning' | 'canRetry' | 'retryAt'>
) {
  const ready = state.mode === 'hardware' ? state.hardwareReady : state.simulatorReady;
  const waitingForConnection = busy || !ready || state.retryAt > now;
  const connectionWarning = !!connectionState?.warning && waitingForConnection;
  const retryConnection =
    !!connectionState?.canRetry &&
    ['idle', 'complete', 'error'].includes(state.phase) &&
    waitingForConnection;
  const retryAt = Math.max(state.retryAt, connectionState?.retryAt ?? 0);
  const retryDisabled = busy || now < retryAt;
  if (!state.placed)
    return {
      caption: PLACEMENT_CAPTION,
      guessHint: '',
      status: connectionWarning ? qubitRetryMessage(connection, retryAt, now) : '',
      warning: connectionWarning,
      spinning: false,
      retryConnection,
      retryDisabled,
    };
  const caption = state.mode === 'hardware' ? HARDWARE_CAPTION : '';
  const uncertain = state.mode === 'hardware' && state.uncertainSubmission;
  const warning = uncertain || state.phase === 'error' || state.phase === 'paused';
  let status = '';
  if (uncertain)
    status =
      'Submission interrupted before confirmation. The job may still run. Reset Qubit to retry.';
  else if (state.phase !== 'idle')
    status = ['error', 'paused'].includes(state.phase)
      ? qubitRetryMessage(state.message, state.retryAt, now)
      : state.message;
  else if (state.retryAt > now)
    status = qubitRetryMessage(
      connection || 'Quantum service is busy. Waiting before retrying.',
      retryAt,
      now
    );
  else if (waitingForConnection) status = qubitRetryMessage(connection, retryAt, now);
  else if (state.cancellationNotice) status = state.cancellationNotice;
  return {
    caption,
    guessHint: state.phase === 'idle' && !state.tracking ? TRACKING_CAPTION : '',
    status,
    warning: warning || connectionWarning || (!!state.cancellationNotice && state.phase === 'idle'),
    spinning:
      !warning &&
      !connectionWarning &&
      (busy || ['intro', 'waiting', 'collapsing'].includes(state.phase)),
    retryConnection,
    retryDisabled,
  };
}
