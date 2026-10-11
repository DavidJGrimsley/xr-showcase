import manifest from '../../../assets/arena/fighter-animation-manifest.json' with { type: 'json' };
import combatManifest from '../../../assets/arena/combat-animation-manifest.json' with { type: 'json' };
import { ARENA_RULES, type FighterId, type FighterView } from './arena-controller.ts';
import { launchLift, settlingLift } from './arena-combat-motion.ts';

export interface Knockout {
  id: string;
  outcome: FighterId | 'draw';
  matchVictory: boolean;
  launched: FighterId[];
  motion?: Record<
    FighterId,
    { mode: 'launch' | 'settling' | null; elapsed: number; initialLift: number; lift: number }
  >;
}
function duration(clip: string) {
  const entry = [...manifest.clips, ...combatManifest.clips].find((entry) => entry.name === clip);
  if (!entry) throw new Error('Missing arena clip duration: ' + clip);
  return entry.durationSeconds;
}
type Pose = FighterView & { elapsed: number; applied: boolean; lift: number };

/** Presentation time starts when the renderer applies a command, never when a packet arrives. */
export class ArenaPresentation {
  readonly knockout: Knockout;
  private sequence = -1;
  private poses: Record<FighterId, Pose>;
  private victoryPlays = 0;
  private readonly victoryRepeats: number;

  constructor(knockout: Knockout, fighters: Record<FighterId, FighterView>) {
    this.knockout = knockout;
    this.victoryRepeats = knockout.matchVictory ? ARENA_RULES.victoryRepeats : 1;
    this.poses = {
      blue: this.initial('blue', fighters.blue),
      red: this.initial('red', fighters.red),
    };
  }
  private initial(id: FighterId, view: FighterView): Pose {
    const winner = this.knockout.outcome === id;
    const launch = this.knockout.launched.includes(id);
    const motion = this.knockout.motion?.[id];
    const settling = motion?.mode === 'settling';
    return {
      ...view,
      clip: launch ? 'HitFront' : settling ? 'JumpBack' : winner ? 'IdleAggro' : 'Defeat',
      mode: launch ? 'launch' : settling ? 'settling' : winner ? 'idle' : 'defeat',
      animationId: settling ? view.animationId : this.sequence--,
      elapsed: motion?.elapsed ?? 0,
      applied: false,
      lift: motion?.lift ?? 0,
      motionInitialLift: motion?.initialLift ?? 0,
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
      if (pose.mode !== 'launch' && pose.mode !== 'settling') pose.elapsed = 0;
    }
  }
  get done() {
    return (
      (this.knockout.outcome === 'draw' || this.victoryPlays === this.victoryRepeats) &&
      Object.values(this.poses).every(
        (pose) => pose.applied && (pose.mode === 'idle' || pose.mode === 'defeated')
      )
    );
  }
  private transition(
    pose: Pose,
    mode: 'idle' | 'victory' | 'defeat' | 'defeated',
    victoryClip = 'Victory'
  ) {
    Object.assign(pose, {
      mode,
      clip:
        mode === 'victory'
          ? victoryClip
          : mode === 'defeat'
            ? 'Defeat'
            : mode === 'idle'
              ? 'IdleAggro'
              : 'DefeatedLoop',
      animationId: this.sequence--,
      elapsed: 0,
      applied: false,
      lift: 0,
    });
  }
  tick(dt: number) {
    for (const id of ['blue', 'red'] as const) {
      const pose = this.poses[id];
      if (!pose.applied || pose.mode === 'idle' || pose.mode === 'defeated') continue;
      pose.elapsed += dt;
      const time =
        pose.mode === 'launch'
          ? ARENA_RULES.launchDuration
          : pose.mode === 'settling'
            ? ARENA_RULES.settleDuration
            : duration(pose.clip);
      if (pose.mode === 'launch') {
        pose.lift = launchLift(
          pose.elapsed,
          time,
          ARENA_RULES.launchHeight,
          pose.motionInitialLift
        );
      } else if (pose.mode === 'settling') {
        pose.lift = settlingLift(pose.elapsed, time, pose.motionInitialLift);
      }
      if (pose.elapsed + 1e-7 < time) continue;
      if (
        pose.mode === 'victory' &&
        pose.clip === 'Victory' &&
        this.victoryPlays < this.victoryRepeats
      ) {
        this.victoryPlays++;
        this.transition(pose, 'victory');
      } else if (pose.mode === 'victory' && pose.clip === 'Victory' && this.knockout.matchVictory) {
        this.transition(pose, 'victory', 'VictoryUppercut');
      } else
        this.transition(
          pose,
          pose.mode === 'launch' || pose.mode === 'settling'
            ? this.knockout.outcome === id
              ? 'idle'
              : 'defeat'
            : pose.mode === 'victory'
              ? 'idle'
              : 'defeated'
        );
    }
    const winnerId = this.knockout.outcome;
    if (winnerId === 'draw' || this.victoryPlays !== 0) return;
    const winner = this.poses[winnerId];
    const loser = this.poses[winnerId === 'blue' ? 'red' : 'blue'];
    if (winner.mode === 'idle' && winner.applied && loser.mode === 'defeated' && loser.applied) {
      this.victoryPlays = 1;
      this.transition(winner, 'victory');
    }
  }
}
