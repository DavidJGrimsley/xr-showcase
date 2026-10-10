import {
  ARENA_CLIPS,
  type ArenaSnapshot,
  type FighterId,
  type FighterTransform,
  type AttackKind,
} from './arena-controller.ts';
import type { Knockout } from './arena-presentation.ts';
import { validArenaTransform, type ArenaTransform } from './arena-transform.ts';

export const ARENA_PROTOCOL = 3;
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
  kind: AttackKind;
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
  retreat: boolean;
  commands: ArenaCommand[];
  capable: boolean;
  pauseReason: string | null;
  paused: boolean;
  orientationPaused: boolean;
  ready: boolean;
  presentation: string | null;
  leaving: boolean;
}
export interface ArenaPacket {
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
    !['advance', 'retreat', 'capable', 'paused', 'orientationPaused', 'ready', 'leaving'].every(
      (key) => typeof value[key] === 'boolean'
    )
  )
    return false;
  return (
    (value.presentation === null || typeof value.presentation === 'string') &&
    Array.isArray(value.commands) &&
    value.commands.length <= 32 &&
    value.commands.every(
      (command) =>
        object(command) &&
        ['seq', 'epoch', 'matchId', 'roundId'].every((key) => integer(command[key])) &&
        (command.kind === 'punch' || command.kind === 'uppercut')
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
  if (value.placement !== null && !validPlacement(value.placement)) return false;
  if (
    value.knockout !== null &&
    (!object(value.knockout) ||
      typeof value.knockout.id !== 'string' ||
      !['blue', 'red', 'draw'].includes(value.knockout.outcome as string) ||
      !Array.isArray(value.knockout.launched) ||
      !value.knockout.launched.every((id) => id === 'blue' || id === 'red'))
  )
    return false;
  const { round, transforms, wins } = value;
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
      typeof fighter.uppercutRemaining === 'number' &&
      Number.isFinite(fighter.uppercutRemaining) &&
      typeof fighter.uppercutWindowRemaining === 'number' &&
      Number.isFinite(fighter.uppercutWindowRemaining) &&
      fighter.uppercutWindowRemaining >= 0 &&
      ['idle', 'walk', 'attack', 'hit', 'launch', 'defeat', 'defeated', 'victory'].includes(
        fighter.mode as string
      ) &&
      object(transform) &&
      ['x', 'lift', 'yaw'].every(
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
