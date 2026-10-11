import { boundPoint, distance, type ArenaPoint } from './arena-combat-motion.ts';

type Side = 'blue' | 'red';
export interface MovementVelocity {
  advance: number;
  strafe: number;
}
/** The host and visual predictor share exactly the same orbit and separation geometry. */
export function arenaMovement(
  before: Record<Side, ArenaPoint>,
  velocity: Record<Side, MovementVelocity>,
  dt: number,
  rules: { boundary: number; separation: number }
): Record<Side, ArenaPoint> {
  const epsilon = 1e-7;
  const d = Math.max(epsilon, distance(before.blue, before.red));
  const u = { x: (before.blue.x - before.red.x) / d, z: (before.blue.z - before.red.z) / d };
  const tangent = { x: -u.z, z: u.x };
  const radial = velocity.blue.advance + velocity.red.advance;
  const available = Math.max(0, d - rules.separation);
  const fraction = radial > 0 ? Math.min(1, available / (radial * dt)) : 1;
  const nextDistance = d - radial * dt * fraction;
  const angular = velocity.blue.strafe + velocity.red.strafe;
  const angle = (angular * dt) / Math.max(rules.separation, (d + nextDistance) / 2);
  const chord = {
    x: nextDistance * (u.x * Math.cos(angle) - u.z * Math.sin(angle) - u.x),
    z: nextDistance * (u.x * Math.sin(angle) + u.z * Math.cos(angle) - u.z),
  };
  const candidates = {} as Record<Side, ArenaPoint>;
  for (const id of ['blue', 'red'] as const) {
    const v = velocity[id],
      sign = id === 'blue' ? 1 : -1;
    const share = Math.abs(angular) > epsilon ? v.strafe / angular : 0;
    const orbit =
      Math.abs(angular) > epsilon
        ? { x: chord.x * share, z: chord.z * share }
        : { x: tangent.x * v.strafe * dt, z: tangent.z * v.strafe * dt };
    candidates[id] = boundPoint(
      {
        x: before[id].x - sign * u.x * v.advance * dt * fraction + sign * orbit.x,
        z: before[id].z - sign * u.z * v.advance * dt * fraction + sign * orbit.z,
      },
      rules.boundary
    );
  }
  const at = (id: Side, t: number) => ({
    x: before[id].x + (candidates[id].x - before[id].x) * t,
    z: before[id].z + (candidates[id].z - before[id].z) * t,
  });
  let alpha = 1;
  if (distance(candidates.blue, candidates.red) < rules.separation - epsilon) {
    let lo = 0,
      hi = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (distance(at('blue', mid), at('red', mid)) >= rules.separation) lo = mid;
      else hi = mid;
    }
    alpha = lo;
  }
  return { blue: at('blue', alpha), red: at('red', alpha) };
}
