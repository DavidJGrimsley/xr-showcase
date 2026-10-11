import {
  ARENA_CLIPS,
  ARENA_RULES,
  type ArenaSnapshot,
  type FighterId,
  type FighterTransform,
  type CombatCommand,
} from './arena-controller.ts';
import type { Knockout } from './arena-presentation.ts';
import {
  validAnnouncement,
  type ArenaAnnouncement,
  type MainAudioSource,
} from './arena-audio-policy.ts';
import { validArenaTransform, type ArenaTransform } from './arena-transform.ts';

// Audio ownership and cue completion must agree on both phones.
export const ARENA_PROTOCOL = 11;
export type ArenaMode = 'solo' | 'host' | 'guest';
export type MatchLength = 1 | 3 | 5;
export type MatchPhase =
  | 'lobby'
  | 'countdown'
  | 'fighting'
  | 'presenting'
  | 'intermission'
  | 'finished'
  | 'paused'
  | 'abandoned';
export interface ArenaPlacement {
  position: [number, number, number];
  rotation: [number, number, number];
}
export interface ArenaCommand {
  seq: number;
  epoch: number;
  matchId: number;
  roundId: number;
  kind: CombatCommand;
}
export interface PeerInput {
  protocol: number;
  clientId: string;
  session: string;
  serial: number;
  epoch: number;
  matchId: number;
  roundId: number;
  advance: boolean;
  strafeLeft: boolean;
  strafeRight: boolean;
  commands: ArenaCommand[];
  capable: boolean;
  pauseReason: string | null;
  paused: boolean;
  orientationPaused: boolean;
  ready: boolean;
  presentation: string | null;
  audioAvailable: boolean;
  announcementDone: string | null;
  leaving: boolean;
}
export interface ArenaPacket {
  mainAudioSource: MainAudioSource;
  announcement: ArenaAnnouncement | null;
  audioAvailable: boolean;
  battleMusicStarted: boolean;
  protocol: number;
  session: string;
  serial: number;
  epoch: number;
  matchId: number;
  rounds: MatchLength;
  stage: MatchPhase;
  countdown: number;
  wins: Record<FighterId, number>;
  round: ArenaSnapshot;
  transforms: Record<FighterId, FighterTransform>;
  knockout: Knockout | null;
  ack: number;
  hostCapable: boolean;
  hostReady: boolean;
  placement: ArenaPlacement | null;
  arenaTransform: ArenaTransform;
  orientationPaused: boolean;
}
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const integer = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0;
const vector = (value: unknown) =>
  Array.isArray(value) &&
  value.length === 3 &&
  value.every((n) => typeof n === 'number' && Number.isFinite(n));
export function validPlacement(value: unknown): value is ArenaPlacement {
  return object(value) && vector(value.position) && vector(value.rotation);
}
export function validInput(value: unknown): value is PeerInput {
  if (
    !object(value) ||
    value.protocol !== ARENA_PROTOCOL ||
    typeof value.clientId !== 'string' ||
    value.clientId.length > 100 ||
    typeof value.session !== 'string'
  )
    return false;
  if (!['serial', 'epoch', 'matchId', 'roundId'].every((key) => integer(value[key]))) return false;
  if (
    value.pauseReason !== null &&
    (typeof value.pauseReason !== 'string' || value.pauseReason.length > 500)
  )
    return false;
  if (
    ![
      'advance',
      'strafeLeft',
      'strafeRight',
      'capable',
      'paused',
      'orientationPaused',
      'ready',
      'leaving',
      'audioAvailable',
    ].every((key) => typeof value[key] === 'boolean')
  )
    return false;
  return (
    (value.presentation === null || typeof value.presentation === 'string') &&
    (value.announcementDone === null ||
      (typeof value.announcementDone === 'string' && value.announcementDone.length <= 200)) &&
    Array.isArray(value.commands) &&
    value.commands.length <= 32 &&
    value.commands.every(
      (command) =>
        object(command) &&
        ['seq', 'epoch', 'matchId', 'roundId'].every((key) => integer(command[key])) &&
        ['punch', 'uppercut', 'block-down', 'block-up', 'jump-back'].includes(
          command.kind as string
        )
    )
  );
}
export function validPacket(value: unknown): value is ArenaPacket {
  if (
    !object(value) ||
    value.protocol !== ARENA_PROTOCOL ||
    typeof value.session !== 'string' ||
    !object(value.round) ||
    !object(value.transforms) ||
    !object(value.wins)
  )
    return false;
  if (
    !['serial', 'epoch', 'matchId', 'ack'].every((key) => integer(value[key])) ||
    ![1, 3, 5].includes(value.rounds as number)
  )
    return false;
  if (
    ![
      'lobby',
      'countdown',
      'fighting',
      'presenting',
      'intermission',
      'finished',
      'paused',
      'abandoned',
    ].includes(value.stage as string) ||
    !Number.isFinite(value.countdown)
  )
    return false;
  if (
    typeof value.hostCapable !== 'boolean' ||
    typeof value.hostReady !== 'boolean' ||
    typeof value.orientationPaused !== 'boolean' ||
    !validArenaTransform(value.arenaTransform) ||
    !integer(value.round.roundId) ||
    !Number.isFinite(value.round.arenaYaw)
  )
    return false;
  if (
    typeof value.round.impactPauseRemaining !== 'number' ||
    !Number.isFinite(value.round.impactPauseRemaining) ||
    value.round.impactPauseRemaining < 0 ||
    value.round.impactPauseRemaining > 0.1
  )
    return false;
  if (value.placement !== null && !validPlacement(value.placement)) return false;
  if (
    value.knockout !== null &&
    (!object(value.knockout) ||
      typeof value.knockout.id !== 'string' ||
      !['blue', 'red', 'draw'].includes(value.knockout.outcome as string) ||
      typeof value.knockout.matchVictory !== 'boolean' ||
      !Array.isArray(value.knockout.launched) ||
      !value.knockout.launched.every((id) => id === 'blue' || id === 'red'))
  )
    return false;
  if (value.knockout !== null) {
    const motion = (value.knockout as Record<string, unknown>).motion;
    if (
      !object(motion) ||
      !['blue', 'red'].every((id) => {
        const m = motion[id];
        return (
          object(m) &&
          [null, 'launch', 'settling'].includes(m.mode as null | 'launch' | 'settling') &&
          ['elapsed', 'initialLift', 'lift'].every(
            (key) =>
              typeof m[key] === 'number' && Number.isFinite(m[key]) && (m[key] as number) >= 0
          ) &&
          (m.initialLift as number) <= 0.25 &&
          (m.lift as number) <= 0.25
        );
      })
    )
      return false;
  }
  const { round, transforms, wins } = value;
  if (
    !['host', 'guest', 'both'].includes(value.mainAudioSource as string) ||
    typeof value.audioAvailable !== 'boolean' ||
    typeof value.battleMusicStarted !== 'boolean' ||
    !validAnnouncement(value.announcement)
  )
    return false;
  return (['blue', 'red'] as const).every((id) => {
    const fighter = round[id];
    const transform = transforms[id];
    return (
      integer(wins[id]) &&
      object(fighter) &&
      typeof fighter.health === 'number' &&
      fighter.health >= 0 &&
      fighter.health <= 100 &&
      ARENA_CLIPS.includes(fighter.clip as string) &&
      integer(fighter.animationId) &&
      integer(fighter.punchProgress) &&
      (fighter.punchProgress as number) <= ARENA_RULES.punchStringLength &&
      typeof fighter.uppercutReady === 'boolean' &&
      typeof fighter.uppercutWindowRemaining === 'number' &&
      Number.isFinite(fighter.uppercutWindowRemaining) &&
      fighter.uppercutWindowRemaining >= 0 &&
      fighter.uppercutWindowRemaining <= 2 &&
      (!fighter.uppercutReady ||
        (fighter.punchProgress === ARENA_RULES.punchStringLength &&
          fighter.uppercutWindowRemaining > 0)) &&
      ['off', 'raising', 'holding', 'lowering', 'exhausted'].includes(
        fighter.guardState as string
      ) &&
      typeof fighter.guardHeld === 'boolean' &&
      ['pendingBlock', 'counterpunchBuffered', 'canPunch', 'canUppercut'].every(
        (key) => typeof fighter[key] === 'boolean'
      ) &&
      ['defenseLockRemaining', 'punchRecoveryRemaining', 'punchRestRemaining'].every(
        (key) =>
          typeof fighter[key] === 'number' &&
          Number.isFinite(fighter[key]) &&
          (fighter[key] as number) >= 0 &&
          (fighter[key] as number) <= 1.5
      ) &&
      typeof fighter.canBlock === 'boolean' &&
      typeof fighter.canJumpBack === 'boolean' &&
      typeof fighter.guardStamina === 'number' &&
      Number.isFinite(fighter.guardStamina) &&
      fighter.guardStamina >= 0 &&
      fighter.guardStamina <= 100 &&
      typeof fighter.guardRecoveryRemaining === 'number' &&
      Number.isFinite(fighter.guardRecoveryRemaining) &&
      fighter.guardRecoveryRemaining >= 0 &&
      fighter.guardRecoveryRemaining <= 0.65 &&
      typeof fighter.motionInitialLift === 'number' &&
      Number.isFinite(fighter.motionInitialLift) &&
      fighter.motionInitialLift >= 0 &&
      fighter.motionInitialLift <= 0.25 &&
      typeof fighter.motionElapsed === 'number' &&
      Number.isFinite(fighter.motionElapsed) &&
      fighter.motionElapsed >= 0 &&
      (fighter.impact === null ||
        (object(fighter.impact) &&
          integer(fighter.impact.id) &&
          (fighter.impact.kind === 'punch' || fighter.impact.kind === 'uppercut') &&
          (fighter.impact.hand === 'L' || fighter.impact.hand === 'R') &&
          typeof fighter.impact.x === 'number' &&
          Number.isFinite(fighter.impact.x) &&
          typeof fighter.impact.z === 'number' &&
          Number.isFinite(fighter.impact.z) &&
          typeof fighter.impact.y === 'number' &&
          Number.isFinite(fighter.impact.y) &&
          ['hit', 'blocked', 'guard-break'].includes(fighter.impact.outcome as string))) &&
      [
        'idle',
        'walk',
        'guard',
        'guard-exit',
        'guard-break',
        'hop',
        'settling',
        'attack',
        'hit',
        'launch',
        'landing',
        'defeat',
        'defeated',
        'victory',
      ].includes(fighter.mode as string) &&
      object(transform) &&
      ['x', 'z', 'lift', 'yaw'].every(
        (key) => typeof transform[key] === 'number' && Number.isFinite(transform[key])
      )
    );
  });
}

export function joinLink(code: string) {
  return 'xr-showcase://arena-fighter?join=' + encodeURIComponent(code) + '&v=' + ARENA_PROTOCOL;
}
export function parseJoinLink(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'xr-showcase:' &&
      url.hostname === 'arena-fighter' &&
      url.searchParams.get('v') === String(ARENA_PROTOCOL)
      ? url.searchParams.get('join')
      : null;
  } catch {
    return null;
  }
}
