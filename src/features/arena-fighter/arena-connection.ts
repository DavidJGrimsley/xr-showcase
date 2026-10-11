import type { ViroReplicationConfig, ViroReplicationState } from '@reactvision/react-viro';
import type { ReplicationPort } from './arena-network.ts';

export const RELAY_UNREACHABLE =
  'Can’t reach the multiplayer server. Check your internet connection and try again. Solo play is still available.';

export function connectionMessage(state: ViroReplicationState, error?: string) {
  if (state === 'failed') {
    if (error?.includes('credentials') || error?.includes('apiKey'))
      return 'Multiplayer access was refused. Make sure both phones have the latest app build. The app’s ReactVision configuration may need updating.';
    return RELAY_UNREACHABLE;
  }
  return state === 'reconnecting'
    ? 'Connection lost. Trying to reconnect; the fight is paused.'
    : 'Connecting to the multiplayer server…';
}

export function roomRequestMessage(operation: 'host' | 'join', status?: number, code?: string) {
  if (status === 401 || status === 403)
    return 'Multiplayer access was refused. The app’s ReactVision configuration or team access needs updating.';
  if (status === 429) return 'The multiplayer service is busy. Wait a moment, then retry.';
  if (operation === 'join' && (status === 404 || status === 410))
    return 'This invite code is no longer active. Ask your opponent to host a new match.';
  if (code === 'INVALID_JOIN_CODE')
    return 'Enter the six-character invite code shown on your opponent’s phone.';
  return operation === 'host'
    ? 'The invite service is unavailable. Check your internet connection, then retry.'
    : 'Can’t look up this invite right now. Check your internet connection, then retry.';
}

export function sharingFailureMessage(error = '') {
  if (/401|403|api.?key|unauthori|forbidden|credentials/i.test(error))
    return 'Shared-arena access was refused. The app’s ReactVision configuration needs updating.';
  if (/coverage|keyframes?|triangulat|viewpoints?|spread|insufficient/i.test(error))
    return 'The arena needs more captured detail. Tap Retry connection and move around nearby textured objects in good lighting.';
  return 'The arena could not be shared. Check your internet connection, then retry. Your arena position is saved.';
}

/** Verify the actual authenticated relay before asking someone to capture a shared space. */
export function checkArenaConnection(
  client: ReplicationPort,
  config: ViroReplicationConfig,
  signal: AbortSignal,
  observe?: (state: ViroReplicationState) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let stop: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      stop?.();
      client.disconnect();
      if (error) reject(error);
      else resolve();
    };
    const abort = () => finish(new Error('Connection check cancelled'));
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => finish(new Error(RELAY_UNREACHABLE)), 20000);
    stop = client.subscribe(() => {
      observe?.(client.state);
      if (client.state === 'synced') finish();
      if (client.state === 'failed')
        finish(new Error(connectionMessage(client.state, client.error)));
    });
    try {
      client.connect(config);
    } catch {
      finish(new Error(RELAY_UNREACHABLE));
    }
  });
}
