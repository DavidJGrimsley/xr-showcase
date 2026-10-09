import type { ArenaPlacement } from './arena-protocol.ts';

/** Decompose an orthonormal column-major frame into Viro's Z·Y·X Euler degrees. */
export function framePose(matrix: number[]): ArenaPlacement {
  if (matrix.length !== 16 || !matrix.every(Number.isFinite))
    throw new Error('Invalid shared frame');
  const y = Math.atan2(-matrix[2], Math.hypot(matrix[0], matrix[1]));
  const locked = Math.hypot(matrix[0], matrix[1]) < 1e-6;
  const x = locked ? 0 : Math.atan2(matrix[6], matrix[10]);
  const z = locked ? Math.atan2(-matrix[4], matrix[5]) : Math.atan2(matrix[1], matrix[0]);
  return {
    position: [matrix[12], matrix[13], matrix[14]],
    rotation: [x, y, z].map((n) => (n * 180) / Math.PI) as [number, number, number],
  };
}

/** The arena stays horizontal in world space; only its placement crosses the shared frame. */
export function arenaInFrame(frame: number[], point: [number, number, number]): ArenaPlacement {
  framePose(frame);
  const delta = point.map((n, i) => n - frame[12 + i]);
  const inverse = [
    frame[0],
    frame[4],
    frame[8],
    0,
    frame[1],
    frame[5],
    frame[9],
    0,
    frame[2],
    frame[6],
    frame[10],
    0,
    delta[0] * frame[0] + delta[1] * frame[1] + delta[2] * frame[2],
    delta[0] * frame[4] + delta[1] * frame[5] + delta[2] * frame[6],
    delta[0] * frame[8] + delta[1] * frame[9] + delta[2] * frame[10],
    1,
  ];
  return framePose(inverse);
}
