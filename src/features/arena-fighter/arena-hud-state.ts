import type { MatchSnapshot } from './arena-match';
import type { RoomView } from './arena-room-controller';

/** Stage-specific chrome leaves placement/scan taps to the native AR view. */
export function arenaHUDState(match: MatchSnapshot, room: RoomView | null = null) {
  const invite =
    match.stage === 'lobby' &&
    match.mode === 'host' &&
    match.connected &&
    !!match.displayCode &&
    !match.peerConnected &&
    room?.status === 'ready' &&
    (match.space !== 'remote' || match.placed);
  const placed =
    match.placed &&
    match.assetsLoaded === 3 &&
    !match.error &&
    (!room || (room.status === 'ready' && (match.space === 'remote' || !!match.sharedPlacement)));
  const setup =
    match.stage === 'lobby' &&
    placed &&
    !invite &&
    (match.mode === 'solo' || match.canReady || match.localReady);
  const betweenRounds = match.stage === 'intermission' && match.mode !== 'solo';
  const controls = setup || betweenRounds || match.stage === 'finished' || match.stage === 'paused';
  const transform =
    ((match.mode === 'host' || match.space === 'remote') &&
      match.stage === 'lobby' &&
      match.placed) ||
    ((setup || match.stage === 'finished') && match.canTransform);
  const ready = (setup || betweenRounds) && (match.canReady || match.localReady);
  const error = !!match.error || room?.status === 'error' || !!match.networkMessage;
  const guidance =
    match.orientationPaused && !match.localOrientationPaused
      ? 'Waiting for your opponent to return to landscape.'
      : match.networkMessage || (room && room.status !== 'ready' ? room.message : match.message);
  return {
    invite,
    setup,
    controls,
    transform,
    ready,
    error,
    guidance,
    health: match.stage === 'fighting',
  };
}

export function arenaAnnouncement(match: MatchSnapshot) {
  if (match.orientationPaused) return null;
  if (match.announcement && match.announcement.key !== 'result')
    return {
      role: 'TitleFont' as const,
      text: match.announcement.key.startsWith('round')
        ? `Round ${match.announcement.key.slice(5)}`
        : match.announcement.key === 'fight'
          ? 'Fight!'
          : 'Ready',
    };
  if (!match.outcome) return null;
  const opponent = match.localFighter === 'blue' ? 'red' : 'blue';
  return {
    role: 'SecondaryTitleFont' as const,
    text:
      match.outcome === 'draw'
        ? 'Draw'
        : match.outcome === match.localFighter
          ? `You Win ${match.wins[match.localFighter]}-${match.wins[opponent]}`
          : 'You Lost',
  };
}

/** Fixed invite geometry: reserve the complete quiet zone, never scroll the QR. */
export function arenaInviteLayout(width: number, height: number) {
  const padding = 16;
  const qrSize = Math.max(96, Math.min(224, height - padding * 2 - 24, width * 0.36 - 24));
  return { padding, qrSize, width: Math.min(width, 720), height: qrSize + padding * 2 + 24 };
}
