import type { QubitSnapshot } from './qubit-round-controller';

export const PLACEMENT_CAPTION =
  'Move slowly, then tap a highlighted flat surface to place a Bloch Sphere.';
export const HARDWARE_CAPTION =
  'Hardware queues can take time. Keep this screen open; leaving requests cancellation.';

export function qubitPresentation(
  state: QubitSnapshot,
  connection: string,
  busy: boolean,
  now: number
) {
  if (!state.placed)
    return { caption: PLACEMENT_CAPTION, status: '', warning: false, spinning: false };
  const caption = state.mode === 'hardware' ? HARDWARE_CAPTION : '';
  const uncertain = state.mode === 'hardware' && state.uncertainSubmission;
  const warning = uncertain || state.phase === 'error' || state.phase === 'paused';
  let status = '';
  if (uncertain)
    status =
      'Submission interrupted before confirmation. The job may still run. Reset Qubit to retry.';
  else if (state.phase !== 'idle') status = state.message;
  else if (state.cancellationNotice) status = state.cancellationNotice;
  else if (state.retryAt > now) status = 'Reconnecting…';
  else if (busy || !(state.mode === 'hardware' ? state.hardwareReady : state.simulatorReady))
    status = connection;
  return {
    caption,
    status,
    warning: warning || (!!state.cancellationNotice && state.phase === 'idle'),
    spinning: !warning && (busy || ['intro', 'waiting', 'collapsing'].includes(state.phase)),
  };
}
