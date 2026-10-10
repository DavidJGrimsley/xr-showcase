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
}
export interface ArenaTransformScope {
  sessionToken: number;
  placementVersion: number;
}
export const DEFAULT_ARENA_TRANSFORM: ArenaTransform = { scale: 1, yaw: 0, height: 0 };
export function boundedArenaTransform(value: ArenaTransform): ArenaTransform {
  return {
    scale: clampARScale(value.scale),
    yaw: normalizeYaw(value.yaw),
    height: clampARHeight(value.height),
  };
}
export function validArenaTransform(value: unknown): value is ArenaTransform {
  if (!value || typeof value !== 'object') return false;
  const { scale, yaw, height } = value as ArenaTransform;
  return (
    [scale, yaw, height].every(Number.isFinite) &&
    scale >= MIN_AR_SCALE &&
    scale <= MAX_AR_SCALE &&
    height >= 0 &&
    height <= MAX_AR_HEIGHT &&
    yaw >= -180 &&
    yaw < 180
  );
}
