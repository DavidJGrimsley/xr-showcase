import manifest from '../../../assets/arena/fighter-animation-manifest.json' with { type: 'json' };
import { ARENA_RULES, type FighterId, type FighterView } from './arena-controller.ts';

export interface Knockout {
  id: string;
  outcome: FighterId | 'draw';
  launched: FighterId[];
}
function duration(clip: string) {
  const entry = manifest.clips.find((entry) => entry.name === clip);
  if (!entry) throw new Error('Missing arena clip duration: ' + clip);
  return entry.durationSeconds;
}
type Pose = FighterView & { elapsed: number; applied: boolean; lift: number };

/** Presentation time starts when the renderer applies a command, never when a packet arrives. */
export class ArenaPresentation {
  readonly knockout: Knockout;
  private sequence = -1;
  private poses: Record<FighterId, Pose>;

  constructor(knockout: Knockout, fighters: Record<FighterId, FighterView>) {
    this.knockout = knockout;
    this.poses = {
      blue: this.initial('blue', fighters.blue),
      red: this.initial('red', fighters.red),
    };
  }
  private initial(id: FighterId, view: FighterView): Pose {
    const winner = this.knockout.outcome === id;
    const launch = this.knockout.launched.includes(id);
    return {
      ...view,
      clip: winner ? 'Victory' : launch ? 'HitFront' : 'Defeat',
      mode: winner ? 'victory' : launch ? 'launch' : 'defeat',
      animationId: this.sequence--,
      elapsed: 0,
      applied: false,
      lift: 0,
    };
  }
  applied(id: FighterId, animationId: number) {
    if (this.poses[id].animationId === animationId) this.poses[id].applied = true;
  }
  get(id: FighterId) {
    return this.poses[id];
  }
  remounted() {
    for (const pose of Object.values(this.poses)) {
      pose.applied = false;
      pose.animationId = this.sequence--;
      // Native playback restarts after camera teardown, so give this clip its full duration.
      if (pose.mode !== 'launch') pose.elapsed = 0;
    }
  }
  get done() {
    return Object.values(this.poses).every(
      (pose) => pose.applied && (pose.mode === 'idle' || pose.mode === 'defeated')
    );
  }
  tick(dt: number) {
    for (const pose of Object.values(this.poses)) {
      if (!pose.applied || pose.mode === 'idle' || pose.mode === 'defeated') continue;
      pose.elapsed += dt;
      const time = pose.mode === 'launch' ? ARENA_RULES.launchDuration : duration(pose.clip);
      if (pose.mode === 'launch') {
        const t = Math.min(1, pose.elapsed / time);
        pose.lift = 4 * ARENA_RULES.launchHeight * t * (1 - t);
      }
      if (pose.elapsed + 1e-7 < time) continue;
      const mode =
        pose.mode === 'launch' ? 'defeat' : pose.mode === 'victory' ? 'idle' : 'defeated';
      Object.assign(pose, {
        mode,
        clip: mode === 'defeat' ? 'Defeat' : mode === 'idle' ? 'IdleAggro' : 'DefeatedLoop',
        animationId: this.sequence--,
        elapsed: 0,
        applied: false,
        lift: 0,
      });
    }
  }
}
