import { ARENA_RULES, type FighterTransform } from './arena-controller.ts';
import { facing, distance } from './arena-combat-motion.ts';
import { arenaMovement, type MovementVelocity } from './arena-movement.ts';
import type { MovementStamp } from './arena-protocol.ts';

export const PREDICTION_LIMIT = 0.25;
export const CORRECTION_SECONDS = 0.1;
export const SNAP_DISTANCE = 0.02;
interface Sample {
  seq: number;
  dt: number;
  velocity: MovementVelocity;
}
/** Render-only state. It never runs attacks, writes health, or emits an impact. */
export class ArenaPrediction {
  private samples: Sample[] = [];
  private base: Record<'blue' | 'red', FighterTransform> | null = null;
  private offset = { x: 0, z: 0 };
  private correction = 0;
  private seq = 0;
  private time = 0;
  private lastHostTime = -1;
  private lastAck = 0;
  private error = 0;
  constructor(privateRules: typeof ARENA_RULES = ARENA_RULES) {
    this.rules = privateRules;
  }
  private rules: typeof ARENA_RULES;
  stamp = (): MovementStamp => ({ seq: this.seq, time: this.time });
  diagnostics = () => ({
    historySeconds: this.samples.reduce((sum, sample) => sum + sample.dt, 0),
    correctionDistance: this.error,
    pendingSamples: this.samples.length,
  });
  clear(resetSequence = false) {
    this.samples = [];
    this.base = null;
    this.offset = { x: 0, z: 0 };
    this.correction = 0;
    if (resetSequence) {
      this.seq = this.time = this.lastAck = 0;
      this.lastHostTime = -1;
    }
  }
  reconcile(
    transforms: Record<'blue' | 'red', FighterTransform>,
    ack: MovementStamp,
    simulationTime: number,
    snap: boolean
  ) {
    if (simulationTime < this.lastHostTime || ack.seq < this.lastAck) return;
    const previous = this.get();
    this.lastHostTime = simulationTime;
    this.lastAck = ack.seq;
    this.samples = snap ? [] : this.samples.filter((sample) => sample.seq > ack.seq);
    this.base = { blue: { ...transforms.blue }, red: { ...transforms.red } };
    this.offset = { x: 0, z: 0 };
    this.correction = 0;
    const target = this.replay();
    this.error = previous && target ? distance(previous, target) : 0;
    if (!snap && previous && target && this.error <= SNAP_DISTANCE) {
      this.offset = { x: previous.x - target.x, z: previous.z - target.z };
      this.correction = CORRECTION_SECONDS;
    }
  }
  step(
    dt: number,
    held: { advance: boolean; strafeLeft: boolean; strafeRight: boolean },
    guard: boolean
  ) {
    if (!this.base || !Number.isFinite(dt) || dt <= 0 || dt > 0.1) return;
    const advance = Number(held.advance),
      strafe = Number(held.strafeLeft) - Number(held.strafeRight);
    const speed =
      (this.rules.speed * (guard ? this.rules.guardSpeed : 1)) /
      Math.max(1, Math.hypot(advance, strafe));
    this.time += dt;
    this.samples.push({
      seq: ++this.seq,
      dt,
      velocity: { advance: advance * speed, strafe: strafe * speed },
    });
    let excess = this.samples.reduce((sum, sample) => sum + sample.dt, 0) - PREDICTION_LIMIT;
    while (excess > 1e-9 && this.samples.length) {
      const sample = this.samples[0];
      const removed = Math.min(excess, sample.dt);
      sample.dt -= removed;
      excess -= removed;
      if (sample.dt <= 1e-9) this.samples.shift();
    }
    this.correction = Math.max(0, this.correction - dt);
  }
  private replay(): FighterTransform | null {
    if (!this.base) return null;
    let red = { ...this.base.red };
    for (const sample of this.samples) {
      const next = arenaMovement(
        { blue: this.base.blue, red },
        {
          blue: { advance: 0, strafe: 0 },
          red: sample.velocity,
        },
        sample.dt,
        this.rules
      );
      red = { ...red, ...next.red };
    }
    return { ...red, yaw: facing(red, this.base.blue) };
  }
  get(): FighterTransform | null {
    const target = this.replay();
    if (!target || !this.base) return null;
    const t = this.correction / CORRECTION_SECONDS;
    const candidate = {
      ...target,
      x: target.x + this.offset.x * t,
      z: target.z + this.offset.z * t,
    };
    // A visual correction must not cross the opponent or leave the ring.
    return Math.hypot(candidate.x, candidate.z) <= this.rules.boundary + 1e-7 &&
      distance(candidate, this.base.blue) >= this.rules.separation - 1e-7
      ? candidate
      : target;
  }
}
