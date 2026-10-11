/** Shared by authoritative combat and each device's knockout presentation. */
export function launchLift(elapsed: number, duration: number, height: number, initialLift = 0) {
  const t = Math.min(1, Math.max(0, elapsed / duration));
  return initialLift * (1 - t) + 4 * height * t * (1 - t);
}

export function canFighterAttack(mode: string) {
  return mode === 'idle' || mode === 'walk' || mode === 'attack' || mode === 'guard-exit';
}

export function canFighterBeHit(mode: string) {
  return (
    canFighterAttack(mode) || ['hit', 'guard', 'guard-break', 'hop', 'settling'].includes(mode)
  );
}

export function hopLift(elapsed: number, preparation: number, flight: number, height: number) {
  return launchLift(elapsed - preparation, flight, height);
}

export function settlingLift(elapsed: number, duration: number, initialLift: number) {
  const t = Math.min(1, Math.max(0, elapsed / duration));
  return initialLift * (1 - t * t * (3 - 2 * t));
}

export interface ArenaPoint {
  x: number;
  z: number;
}
export function distance(a: ArenaPoint, b: ArenaPoint) {
  return Math.hypot(b.x - a.x, b.z - a.z);
}
export function facing(a: ArenaPoint, b: ArenaPoint) {
  return (Math.atan2(b.x - a.x, b.z - a.z) * 180) / Math.PI;
}
export function interpolateYaw(previous: number, target: number, t: number) {
  const wrap = (degrees: number) => ((((degrees + 180) % 360) + 360) % 360) - 180;
  return wrap(previous + wrap(target - previous) * Math.min(1, Math.max(0, t)));
}
export function forward(yaw: number) {
  const r = (yaw * Math.PI) / 180;
  return { x: Math.sin(r), z: Math.cos(r) };
}
export function inCone(a: ArenaPoint, b: ArenaPoint, yaw: number, halfAngle: number) {
  const d = distance(a, b);
  const f = forward(yaw);
  return (
    d < 1e-7 ||
    ((b.x - a.x) * f.x + (b.z - a.z) * f.z) / d >= Math.cos((halfAngle * Math.PI) / 180) - 1e-7
  );
}
export function boundPoint(p: ArenaPoint, radius: number): ArenaPoint {
  const d = Math.hypot(p.x, p.z);
  return d > radius ? { x: (p.x * radius) / d, z: (p.z * radius) / d } : p;
}
/** Clamp a captured straight path without changing its direction or crossing a fighter. */
export function pathTravel(
  p: ArenaPoint,
  direction: ArenaPoint,
  wanted: number,
  radius: number,
  other: ArenaPoint,
  separation: number
) {
  const dot = p.x * direction.x + p.z * direction.z;
  const wall = -dot + Math.sqrt(Math.max(0, dot * dot + radius * radius - p.x * p.x - p.z * p.z));
  let travel = Math.max(0, Math.min(wanted, wall));
  const rx = p.x - other.x,
    rz = p.z - other.z;
  const toward = rx * direction.x + rz * direction.z;
  const discriminant = toward * toward - (rx * rx + rz * rz - separation * separation);
  if (toward < 0 && discriminant >= 0)
    travel = Math.min(travel, Math.max(0, -toward - Math.sqrt(discriminant)));
  return travel;
}
