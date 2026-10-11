import data from '../../../assets/arena/combat-collision-data.json' with { type: 'json' };

type Vec = [number, number, number];
interface Box {
  center: Vec;
  half: Vec;
  axes: [Vec, Vec, Vec];
}
export interface ContactPose {
  x: number;
  z: number;
  lift: number;
  yaw: number;
  clip: string;
  elapsed: number;
}
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const clips: Record<string, { duration: number; frames: number[][][] }> = data.clips;

function mix(a: number[], b: number[], t: number) {
  const value = a.map((v, i) => v + (b[i] - v) * t);
  let end = b.slice(6),
    start = a.slice(6);
  let d = start.reduce((sum, v, i) => sum + v * end[i], 0);
  if (d < 0) {
    end = end.map((v) => -v);
    d = -d;
  }
  const angle = Math.acos(Math.min(1, d));
  const q =
    d > 0.9995
      ? start.map((v, i) => v + (end[i] - v) * t)
      : start.map(
          (v, i) => (Math.sin((1 - t) * angle) * v + Math.sin(t * angle) * end[i]) / Math.sin(angle)
        );
  const length = Math.hypot(...q);
  q.forEach((v, i) => {
    value[i + 6] = v / length;
  });
  return value;
}
function box(raw: number[], pose: ContactPose): Box {
  const [x, y, z, w] = raw.slice(6),
    angle = (pose.yaw * Math.PI) / 180,
    c = Math.cos(angle),
    s = Math.sin(angle);
  const turn = ([a, b, d]: Vec): Vec => [c * a + s * d, b, -s * a + c * d];
  const center = turn(raw.slice(0, 3) as Vec);
  return {
    center: [center[0] + pose.x, center[1] + pose.lift, center[2] + pose.z],
    half: raw.slice(3, 6) as Vec,
    axes: [
      turn([1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w)]),
      turn([2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w)]),
      turn([2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y)]),
    ],
  };
}
export function contactBoxes(pose: ContactPose): Box[] {
  const clip = clips[pose.clip];
  if (!clip) throw new Error(`Missing collision pose: ${pose.clip}`);
  const loops = [
    'IdleAggro',
    'WalkForward',
    'WalkBackward',
    'StrafeLeft',
    'StrafeRight',
    'BlockHold',
    'BlockAdvance',
    'BlockStrafeLeft',
    'BlockStrafeRight',
  ].includes(pose.clip);
  const time = loops ? pose.elapsed % clip.duration : Math.min(pose.elapsed, clip.duration);
  const frame = Math.max(0, time * data.sampleRate),
    lo = Math.min(Math.floor(frame), clip.frames.length - 1),
    hi = Math.min(lo + 1, clip.frames.length - 1);
  return clip.frames[lo].map((raw, i) => box(mix(raw, clip.frames[hi][i], frame - lo), pose));
}
function projected(b: Box, axis: Vec) {
  return b.half.reduce((sum, h, i) => sum + h * Math.abs(dot(b.axes[i], axis)), 0);
}
/** Continuous separating-axis test for relative translation in a short pose slice. */
function sweep(a0: Box, a1: Box, b0: Box, b1: Box, tolerance: number): number | null {
  const axes = [...a1.axes, ...b1.axes, ...a1.axes.flatMap((a) => b1.axes.map((b) => cross(a, b)))];
  const initial = sub(a0.center, b0.center),
    delta = sub(sub(a1.center, b1.center), initial);
  let enter = 0,
    exit = 1;
  for (const axis of axes) {
    const length = Math.hypot(...axis);
    if (length < 1e-8) continue;
    const radius =
      Math.max(projected(a0, axis), projected(a1, axis)) +
      Math.max(projected(b0, axis), projected(b1, axis)) +
      tolerance * length;
    const p = dot(initial, axis),
      v = dot(delta, axis);
    if (Math.abs(v) < 1e-12) {
      if (Math.abs(p) > radius) return null;
      continue;
    }
    const t0 = (-radius - p) / v,
      t1 = (radius - p) / v;
    enter = Math.max(enter, Math.min(t0, t1));
    exit = Math.min(exit, Math.max(t0, t1));
    if (enter > exit) return null;
  }
  return enter;
}
function poseBetween(a: ContactPose, b: ContactPose, t: number): ContactPose {
  const same = a.clip === b.clip;
  return {
    ...b,
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
    lift: a.lift + (b.lift - a.lift) * t,
    yaw: a.yaw + (((b.yaw - a.yaw + 540) % 360) - 180) * t,
    elapsed: same ? a.elapsed + (b.elapsed - a.elapsed) * t : b.elapsed * t,
  };
}
/** Glove/body sweeps never use an opponent-center reach or cone as a damage veto.
 * Slices follow a global 240 Hz attack clock, independent of the display rate.
 */
export function sweptContact(
  attackerBefore: ContactPose,
  attackerAfter: ContactPose,
  defenderBefore: ContactPose,
  defenderAfter: ContactPose,
  from: number,
  to: number,
  hand: 'L' | 'R',
  tolerance = data.toleranceMeters
): { x: number; y: number; z: number } | null {
  if (to < from) return null;
  const indices = [data.groups.indexOf(`glove_${hand.toLowerCase()}`)];
  const duration = attackerAfter.elapsed - attackerBefore.elapsed;
  const at = (t: number) =>
    duration > 1e-10 ? Math.max(0, Math.min(1, (t - attackerBefore.elapsed) / duration)) : 1;
  const poseAt = (t: number) => [
    poseBetween(attackerBefore, attackerAfter, at(t)),
    poseBetween(defenderBefore, defenderAfter, at(t)),
  ];
  const ends = [from];
  for (let t = (Math.floor(from * 240) + 1) / 240; t < to - 1e-9; t += 1 / 240) ends.push(t);
  ends.push(to);
  let [ap, bp] = poseAt(from),
    a0 = indices.map((index) => contactBoxes(ap)[index]),
    b0 = contactBoxes(bp);
  for (let i = 1; i < ends.length; i++) {
    [ap, bp] = poseAt(ends[i]);
    const actor = contactBoxes(ap),
      a1 = indices.map((index) => actor[index]),
      b1 = contactBoxes(bp);
    // Volume-derived broad phase, including both endpoints of each relative sweep.
    for (let g = 0; g < a1.length; g++)
      for (let j = 0; j < b1.length; j++) {
        if (data.groups[j].startsWith('glove_')) continue;
        const initial = sub(a0[g].center, b0[j].center),
          delta = sub(sub(a1[g].center, b1[j].center), initial);
        const denom = dot(delta, delta),
          t = denom > 0 ? Math.max(0, Math.min(1, -dot(initial, delta) / denom)) : 0;
        const radius =
          Math.max(Math.hypot(...a0[g].half), Math.hypot(...a1[g].half)) +
          Math.max(Math.hypot(...b0[j].half), Math.hypot(...b1[j].half)) +
          tolerance;
        if (Math.hypot(...initial.map((v, k) => v + delta[k] * t)) > radius) continue;
        const hit = sweep(a0[g], a1[g], b0[j], b1[j], tolerance);
        if (hit !== null) {
          const glove = a0[g].center.map((v, k) => v + (a1[g].center[k] - v) * hit),
            body = b0[j].center.map((v, k) => v + (b1[j].center[k] - v) * hit);
          return {
            x: (glove[0] + body[0]) / 2,
            y: (glove[1] + body[1]) / 2,
            z: (glove[2] + body[2]) / 2,
          };
        }
      }
    a0 = a1;
    b0 = b1;
  }
  return null;
}
