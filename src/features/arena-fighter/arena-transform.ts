import {
  clampARHeight,
  clampARScale,
  MAX_AR_HEIGHT,
  MAX_AR_SCALE,
  MIN_AR_SCALE,
  normalizeYaw,
} from '../ar/ar-transform.ts';

export interface ArenaTransform {
  scale: number;
  yaw: number;
  height: number;
  x: number;
  z: number;
}
export interface ArenaTransformScope {
  sessionToken: number;
  placementVersion: number;
}
export const DEFAULT_ARENA_TRANSFORM: ArenaTransform = { scale: 1, yaw: 0, height: 0, x: 0, z: 0 };
export const MAX_ARENA_OFFSET = MAX_AR_HEIGHT;
const clampOffset = (value: number) =>
  Math.max(-MAX_ARENA_OFFSET, Math.min(MAX_ARENA_OFFSET, value));
export function boundedArenaTransform(value: ArenaTransform): ArenaTransform {
  return {
    scale: clampARScale(value.scale),
    yaw: normalizeYaw(value.yaw),
    height: clampARHeight(value.height),
    x: clampOffset(value.x),
    z: clampOffset(value.z),
  };
}
export function validArenaTransform(value: unknown): value is ArenaTransform {
  if (!value || typeof value !== 'object') return false;
  const { scale, yaw, height, x, z } = value as ArenaTransform;
  return (
    [scale, yaw, height, x, z].every(Number.isFinite) &&
    scale >= MIN_AR_SCALE &&
    scale <= MAX_AR_SCALE &&
    height >= 0 &&
    height <= MAX_AR_HEIGHT &&
    Math.abs(x) <= MAX_ARENA_OFFSET &&
    Math.abs(z) <= MAX_ARENA_OFFSET &&
    yaw >= -180 &&
    yaw < 180
  );
}

/** Fixed placement axes keep position independent of model scale, yaw and camera view. */
export function arenaOffsetPosition({ x, height, z }: ArenaTransform): [number, number, number] {
  return [x, height, z];
}
