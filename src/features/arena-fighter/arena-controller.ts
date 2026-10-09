import exportedManifest from '../../../assets/arena/fighter-animation-manifest.json' with { type: 'json' };

// The manifest is the exported motion contract, not executable Unreal montage logic.
interface AnimationManifest {
  clips: { name: string; durationSeconds: number; loopRecommended: boolean }[];
  combo: { clip: string; durationSeconds: number; hitCheckSeconds: number }[];
}
const manifest: AnimationManifest = exportedManifest;

export type FighterId = 'blue' | 'cpu';
export type AttackKind = 'punch' | 'uppercut';
export type Movement = 'advance' | 'retreat';
export type ArenaPhase = 'setup' | 'fighting' | 'paused' | 'ending' | 'ended';
export type FighterMode =
  'idle' | 'walk' | 'attack' | 'hit' | 'launch' | 'defeat' | 'defeated' | 'victory';
export type ArenaAsset = 'arena' | 'blue' | 'cpu';

export const ARENA_RULES = {
  health: 100,
  punchDamage: 10,
  uppercutDamage: 15,
  uppercutCooldown: 3,
  spawn: 0.095,
  boundary: 0.14,
  separation: 0.055,
  reach: 0.085,
  speed: 0.08,
  stableTracking: 0.5,
  cpuFirstDelay: 0.7,
  cpuRecovery: 0.9,
  launchDuration: 0.8,
  launchHeight: 0.18,
  cpuEnabled: true,
};

// GLB already rotates its source mesh into Y-up. Its base is at Y=-0.14273847.
// Largest horizontal span=1.139190018m; the fighting floor is at about Y=-0.027.
export const ARENA_LAYOUT = {
  arenaScale: 0.6 / 1.1391900181770325,
  arenaBaseOffset: 0.14273847315734003 * (0.6 / 1.1391900181770325),
  floorHeight: (0.14273847315734003 - 0.027) * (0.6 / 1.1391900181770325),
  fighterScale: 0.12 / 1.59857170559,
  footOffset: 0.00106792559 * (0.12 / 1.59857170559),
};

export const ARENA_CLIPS = manifest.clips.map((clip) => clip.name);
const clipDuration = (name: string) => {
  const clip = manifest.clips.find((candidate) => candidate.name === name);
  if (!clip) throw new Error(`Missing fighter clip: ${name}`);
  return clip.durationSeconds;
};
const punchHands = ['L', 'L', 'R', 'L', 'R', 'R'] as const;
const ids: FighterId[] = ['blue', 'cpu'];
const epsilon = 1e-7;

interface Attack {
  kind: AttackKind;
  elapsed: number;
  duration: number;
  hitAt: number;
  hitChecked: boolean;
}
interface Fighter {
  health: number;
  x: number;
  lift: number;
  mode: FighterMode;
  clip: string;
  animationId: number;
  elapsed: number;
  uppercutAt: number;
  punchIndex: number;
  uppercutIndex: number;
  attack: Attack | null;
  buffered: AttackKind | null;
}

export interface FighterView {
  health: number;
  mode: FighterMode;
  clip: string;
  animationId: number;
  uppercutRemaining: number;
}
export interface ArenaSnapshot {
  sessionToken: number | null;
  roundId: number;
  phase: ArenaPhase;
  blue: FighterView;
  cpu: FighterView;
  assetsLoaded: number;
  placementVersion: number;
  placed: boolean;
  canReady: boolean;
  canResume: boolean;
  canRematch: boolean;
  canAttack: boolean;
  animationsRunning: boolean;
  message: string;
  error: string | null;
  outcome: FighterId | 'draw' | null;
  arenaYaw: number;
  blueStartsLeft: boolean;
  preview: { fighter: FighterId; clip: string } | null;
  fps: number | null;
  frameSamples: number;
}
export interface FighterTransform {
  x: number;
  lift: number;
  yaw: number;
}

/** Owns every gameplay event. Native callbacks only supply readiness, never damage. */
export class ArenaController {
  private rules: typeof ARENA_RULES;
  private fighters: Record<FighterId, Fighter>;
  private listeners = new Set<() => void>();
  private snapshot!: ArenaSnapshot;
  private snapshotKey = '';
  private token = 0;
  private roundId = 0;
  private animationSequence = 0;
  private attached = false;
  private landscape = false;
  private tracking = false;
  private stableTime = 0;
  private placed = false;
  private placementVersion = 0;
  private assets = new Set<ArenaAsset>();
  private phase: ArenaPhase = 'setup';
  private resumePhase: 'fighting' | 'ending' = 'fighting';
  private clock = 0;
  private outcome: FighterId | 'draw' | null = null;
  private error: string | null = null;
  private held = { advance: false, retreat: false };
  private blueStartsLeft = true;
  private arenaYaw = 0;
  private cpuAttackAt: number | null = null;
  private cpuRecoveryUntil = 0;
  private cpuAttacks = 0;
  private preview: { fighter: FighterId; clip: string; elapsed: number } | null = null;
  private frameTotal = 0;
  private frameSamples = 0;
  private fps: number | null = null;

  constructor(rules: Partial<typeof ARENA_RULES> = {}) {
    this.rules = { ...ARENA_RULES, ...rules };
    this.fighters = {
      blue: this.newFighter(-this.rules.spawn),
      cpu: this.newFighter(this.rules.spawn),
    };
    this.publish();
  }

  getSnapshot = () => this.snapshot;
  getSessionToken = () => this.snapshot.sessionToken;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  attachSession = (_sessionId: number) => {
    if (this.attached) this.detachSession(this.token);
    this.token++;
    this.attached = true;
    this.tracking = false;
    this.stableTime = 0;
    this.placed = false;
    this.placementVersion++;
    this.assets.clear();
    this.error = null;
    this.frameTotal = 0;
    this.frameSamples = 0;
    this.fps = null;
    this.publish();
    return this.token;
  };

  detachSession = (token: number) => {
    if (!this.isCurrent(token)) return;
    this.pause();
    if (this.outcome) this.settleOutcome();
    this.attached = false;
    this.token++;
    this.placed = false;
    this.tracking = false;
    this.stableTime = 0;
    this.assets.clear();
    this.publish();
  };

  dispose = () => {
    if (this.attached) this.detachSession(this.token);
    this.token++;
    this.clearInput();
  };

  setLandscape = (landscape: boolean) => {
    if (this.landscape === landscape) return;
    this.landscape = landscape;
    if (!landscape) {
      this.stableTime = 0;
      this.pause();
    }
    this.publish();
  };

  setTracking = (token: number, normal: boolean) => {
    if (!this.isCurrent(token) || this.tracking === normal) return;
    this.tracking = normal;
    this.stableTime = 0;
    if (!normal) this.pause();
    this.publish();
  };

  setPlacement = (token: number, placed: boolean) => {
    if (!this.isCurrent(token) || this.placed === placed) return;
    this.placed = placed;
    if (!placed) {
      this.pause();
      this.placementVersion++;
      this.assets.clear();
    }
    this.publish();
  };

  assetLoaded = (token: number, version: number, asset: ArenaAsset) => {
    if (!this.isCurrent(token) || version !== this.placementVersion || this.error) return;
    this.assets.add(asset);
    this.publish();
  };

  assetFailed = (token: number, version: number, asset: ArenaAsset) => {
    if (!this.isCurrent(token) || version !== this.placementVersion) return false;
    this.error = `${asset === 'cpu' ? 'Red fighter' : asset === 'blue' ? 'Blue fighter' : 'Arena'} could not load. Retry the AR scene.`;
    this.pause();
    this.publish();
    return true;
  };

  firstMissingAsset = (): ArenaAsset | undefined =>
    (['arena', 'blue', 'cpu'] as const).find((asset) => !this.assets.has(asset));

  ready = () => {
    if (this.phase !== 'setup' || !this.prerequisites() || this.preview) return false;
    this.phase = 'fighting';
    this.roundId++;
    this.cpuAttackAt = null;
    this.publish();
    return true;
  };

  resume = () => {
    if (this.phase !== 'paused' || !this.prerequisites()) return false;
    this.phase = this.resumePhase;
    this.cpuAttackAt = null;
    this.publish();
    return true;
  };

  rematch = () => {
    if (this.phase !== 'ended' || !this.prerequisites()) return false;
    this.clock = 0;
    this.outcome = null;
    this.cpuAttacks = 0;
    this.cpuRecoveryUntil = 0;
    const side = this.blueStartsLeft ? -1 : 1;
    this.fighters = {
      blue: this.newFighter(side * this.rules.spawn),
      cpu: this.newFighter(-side * this.rules.spawn),
    };
    this.clearInput();
    this.phase = 'fighting';
    this.roundId++;
    this.cpuAttackAt = null;
    this.publish();
    return true;
  };

  swapSides = () => {
    if (this.phase !== 'setup' || this.preview) return;
    this.blueStartsLeft = !this.blueStartsLeft;
    this.fighters.blue.x *= -1;
    this.fighters.cpu.x *= -1;
    this.publish();
  };

  rotateArena = () => {
    if (this.phase !== 'setup' || this.preview) return;
    this.arenaYaw = (this.arenaYaw + 90) % 360;
    this.publish();
  };

  setMovement = (movement: Movement, held: boolean, roundId = this.roundId) => {
    if (roundId !== this.roundId) return;
    this.held[movement] = held && this.phase === 'fighting' && this.prerequisites();
  };

  attack = (kind: AttackKind, id: FighterId = 'blue', roundId = this.roundId) =>
    roundId === this.roundId && this.requestAttack(id, kind);

  previewClip = (fighter: FighterId, clip: string) => {
    if (this.phase !== 'setup' || !this.prerequisites() || !ARENA_CLIPS.includes(clip))
      return false;
    this.stopPreview();
    this.preview = { fighter, clip, elapsed: 0 };
    this.setAnimation(this.fighters[fighter], 'idle', clip, true);
    this.publish();
    return true;
  };

  stopPreview = () => {
    if (!this.preview) return;
    this.setAnimation(this.fighters[this.preview.fighter], 'idle', 'IdleAggro', true);
    this.preview = null;
    this.publish();
  };

  getTransform = (id: FighterId): FighterTransform => {
    const fighter = this.fighters[id];
    const other = this.fighters[id === 'blue' ? 'cpu' : 'blue'];
    return { x: fighter.x, lift: fighter.lift, yaw: other.x > fighter.x ? 90 : -90 };
  };

  recordFrame = (token: number, dt: number) => {
    if (!this.isCurrent(token) || !this.prerequisites() || !Number.isFinite(dt) || dt <= 0) return;
    if (this.phase !== 'fighting' && this.phase !== 'ending' && !this.preview) return;
    this.frameTotal += dt;
    this.frameSamples++;
    if (this.frameSamples % 60 === 0) {
      this.fps = Math.round(this.frameSamples / this.frameTotal);
      this.publish();
    }
  };

  tick = (token: number, dt: number) => {
    if (!this.isCurrent(token) || !Number.isFinite(dt) || dt <= 0 || dt > 0.1) return;
    if (this.tracking && this.landscape)
      this.stableTime = Math.min(this.rules.stableTracking, this.stableTime + dt);
    if (!this.prerequisites()) {
      this.publish();
      return;
    }
    if (this.preview) {
      this.preview.elapsed += dt;
      const clip = manifest.clips.find((entry) => entry.name === this.preview?.clip)!;
      if (!clip.loopRecommended && this.preview.elapsed + epsilon >= clip.durationSeconds)
        this.stopPreview();
    }
    if (this.phase === 'ending') {
      this.tickEnding(dt);
      this.publish();
      return;
    }
    if (this.phase !== 'fighting') {
      this.publish();
      return;
    }
    this.clock += dt;
    this.move(dt);
    this.decideCPU();

    // Capture all eligible hits before applying any stagger/KO: simultaneous attacks are fair.
    const hits: { defender: FighterId; kind: AttackKind }[] = [];
    for (const id of ids) {
      const fighter = this.fighters[id];
      fighter.elapsed += dt;
      const attack = fighter.attack;
      if (!attack) continue;
      attack.elapsed += dt;
      if (!attack.hitChecked && attack.elapsed + epsilon >= attack.hitAt) {
        attack.hitChecked = true;
        if (Math.abs(this.fighters.blue.x - this.fighters.cpu.x) <= this.rules.reach + epsilon) {
          hits.push({ defender: id === 'blue' ? 'cpu' : 'blue', kind: attack.kind });
        }
      }
    }
    for (const hit of hits) {
      const fighter = this.fighters[hit.defender];
      fighter.health = Math.max(
        0,
        fighter.health - (hit.kind === 'punch' ? this.rules.punchDamage : this.rules.uppercutDamage)
      );
      fighter.attack = null;
      fighter.buffered = null;
      this.setAnimation(fighter, 'hit', 'HitFront', true);
      if (hit.defender === 'cpu') this.cpuAttackAt = null;
    }
    if (ids.some((id) => this.fighters[id].health === 0)) {
      this.endRound(hits);
    } else {
      for (const id of ids) {
        const fighter = this.fighters[id];
        if (fighter.attack && fighter.attack.elapsed + epsilon >= fighter.attack.duration) {
          const next = fighter.buffered;
          fighter.attack = null;
          fighter.buffered = null;
          this.setAnimation(fighter, 'idle', 'IdleAggro');
          if (id === 'cpu')
            this.cpuAttackAt = this.cpuRecoveryUntil = this.clock + this.rules.cpuRecovery;
          if (next) this.requestAttack(id, next);
        } else if (
          fighter.mode === 'hit' &&
          fighter.elapsed + epsilon >= clipDuration('HitFront')
        ) {
          this.setAnimation(fighter, 'idle', 'IdleAggro');
          if (id === 'cpu')
            this.cpuAttackAt = this.cpuRecoveryUntil = this.clock + this.rules.cpuRecovery;
        }
      }
    }
    this.publish();
  };

  private newFighter(x: number): Fighter {
    return {
      health: this.rules.health,
      x,
      lift: 0,
      mode: 'idle',
      clip: 'IdleAggro',
      animationId: ++this.animationSequence,
      elapsed: 0,
      uppercutAt: 0,
      punchIndex: 0,
      uppercutIndex: 0,
      attack: null,
      buffered: null,
    };
  }

  private isCurrent(token: number) {
    return this.attached && token === this.token;
  }
  private prerequisites() {
    return (
      this.attached &&
      this.landscape &&
      this.tracking &&
      this.stableTime + epsilon >= this.rules.stableTracking &&
      this.placed &&
      this.assets.size === 3 &&
      !this.error
    );
  }
  private setAnimation(fighter: Fighter, mode: FighterMode, clip: string, restart = false) {
    if (restart || fighter.mode !== mode || fighter.clip !== clip) {
      fighter.mode = mode;
      fighter.clip = clip;
      fighter.animationId = ++this.animationSequence;
      fighter.elapsed = 0;
    }
  }
  private clearInput() {
    this.held = { advance: false, retreat: false };
    ids.forEach((id) => {
      this.fighters[id].buffered = null;
    });
  }
  private pause() {
    this.stopPreview();
    this.clearInput();
    if (this.phase === 'fighting' || this.phase === 'ending') {
      this.resumePhase = this.phase;
      this.phase = 'paused';
    }
    for (const id of ids) {
      const fighter = this.fighters[id];
      fighter.attack = null;
      if (['attack', 'hit', 'walk'].includes(fighter.mode))
        this.setAnimation(fighter, 'idle', 'IdleAggro');
    }
    this.cpuAttackAt = null;
  }
  private requestAttack(id: FighterId, kind: AttackKind) {
    if (this.phase !== 'fighting' || !this.prerequisites()) return false;
    const fighter = this.fighters[id];
    if (kind === 'uppercut' && this.clock + epsilon < fighter.uppercutAt) return false;
    if (fighter.mode === 'hit') return false;
    if (fighter.attack) {
      if (fighter.buffered) return false;
      fighter.buffered = kind;
      return true;
    }
    const hand =
      kind === 'punch'
        ? punchHands[fighter.punchIndex++ % punchHands.length]
        : fighter.uppercutIndex++ % 2 === 0
          ? 'L'
          : 'R';
    const clip = `Combo_${kind === 'punch' ? 'Punch' : 'Uppercut'}${hand}`;
    const timing = manifest.combo.find((entry) => entry.clip === clip)!;
    fighter.attack = {
      kind,
      elapsed: 0,
      duration: timing.durationSeconds,
      hitAt: timing.hitCheckSeconds,
      hitChecked: false,
    };
    if (kind === 'uppercut') fighter.uppercutAt = this.clock + this.rules.uppercutCooldown;
    this.setAnimation(fighter, 'attack', clip, true);
    this.publish();
    return true;
  }
  private move(dt: number) {
    const blue = this.fighters.blue;
    const cpu = this.fighters.cpu;
    const canMove = (fighter: Fighter) => fighter.mode === 'idle' || fighter.mode === 'walk';
    const directions = {
      blue: canMove(blue) ? Number(this.held.advance) - Number(this.held.retreat) : 0,
      cpu:
        this.rules.cpuEnabled && canMove(cpu) && Math.abs(cpu.x - blue.x) > this.rules.reach
          ? 1
          : 0,
    };
    const before = { blue: blue.x, cpu: cpu.x };
    for (const id of ids) {
      const fighter = this.fighters[id];
      const toward = this.blueStartsLeft === (id === 'blue') ? 1 : -1;
      fighter.x = Math.max(
        -this.rules.boundary,
        Math.min(this.rules.boundary, fighter.x + toward * directions[id] * this.rules.speed * dt)
      );
    }
    const left = this.blueStartsLeft ? blue : cpu;
    const right = this.blueStartsLeft ? cpu : blue;
    if (right.x - left.x < this.rules.separation) {
      const overlap = this.rules.separation - (right.x - left.x);
      // Only move fighters that actually tried to advance; stationary opponents aren't pushed.
      const leftMoving = this.blueStartsLeft ? directions.blue > 0 : directions.cpu > 0;
      const rightMoving = this.blueStartsLeft ? directions.cpu > 0 : directions.blue > 0;
      left.x -= overlap * (leftMoving && rightMoving ? 0.5 : leftMoving ? 1 : 0);
      right.x += overlap * (leftMoving && rightMoving ? 0.5 : rightMoving ? 1 : 0);
    }
    for (const id of ids) {
      const fighter = this.fighters[id];
      if (!canMove(fighter)) continue;
      if (Math.abs(fighter.x - before[id]) < epsilon)
        this.setAnimation(fighter, 'idle', 'IdleAggro');
      else this.setAnimation(fighter, 'walk', directions[id] > 0 ? 'WalkForward' : 'WalkBackward');
    }
  }
  private decideCPU() {
    if (!this.rules.cpuEnabled) return;
    const cpu = this.fighters.cpu;
    if (cpu.attack || cpu.mode === 'hit') return;
    if (Math.abs(cpu.x - this.fighters.blue.x) > this.rules.reach + epsilon) {
      this.cpuAttackAt = null;
      return;
    }
    this.cpuAttackAt ??= Math.max(this.clock + this.rules.cpuFirstDelay, this.cpuRecoveryUntil);
    if (this.clock + epsilon < this.cpuAttackAt) return;
    const kind =
      (this.cpuAttacks + 1) % 3 === 0 && this.clock + epsilon >= cpu.uppercutAt
        ? 'uppercut'
        : 'punch';
    if (this.requestAttack('cpu', kind)) {
      this.cpuAttacks++;
      this.cpuAttackAt = null;
    }
  }
  private endRound(hits: { defender: FighterId; kind: AttackKind }[]) {
    this.outcome =
      this.fighters.blue.health === 0 ? (this.fighters.cpu.health === 0 ? 'draw' : 'cpu') : 'blue';
    this.phase = 'ending';
    this.clearInput();
    for (const id of ids) {
      const fighter = this.fighters[id];
      fighter.attack = null;
      if (fighter.health > 0) this.setAnimation(fighter, 'victory', 'Victory', true);
      else if (hits.some((hit) => hit.defender === id && hit.kind === 'uppercut'))
        this.setAnimation(fighter, 'launch', 'HitFront', true);
      else this.setAnimation(fighter, 'defeat', 'Defeat', true);
    }
  }
  private tickEnding(dt: number) {
    for (const id of ids) {
      const fighter = this.fighters[id];
      fighter.elapsed += dt;
      if (fighter.mode === 'launch') {
        const t =
          fighter.elapsed + epsilon >= this.rules.launchDuration
            ? 1
            : fighter.elapsed / this.rules.launchDuration;
        fighter.lift = 4 * this.rules.launchHeight * t * (1 - t);
        if (t === 1) {
          fighter.lift = 0;
          this.setAnimation(fighter, 'defeat', 'Defeat', true);
        }
      } else if (fighter.mode === 'defeat' && fighter.elapsed + epsilon >= clipDuration('Defeat')) {
        this.setAnimation(fighter, 'defeated', 'DefeatedLoop', true);
      } else if (
        fighter.mode === 'victory' &&
        fighter.elapsed + epsilon >= clipDuration('Victory')
      ) {
        this.setAnimation(fighter, 'idle', 'IdleAggro');
      }
    }
    if (ids.every((id) => ['idle', 'defeated'].includes(this.fighters[id].mode)))
      this.phase = 'ended';
  }
  private settleOutcome() {
    this.phase = 'ended';
    for (const id of ids) {
      const fighter = this.fighters[id];
      fighter.lift = 0;
      this.setAnimation(
        fighter,
        fighter.health > 0 ? 'idle' : 'defeated',
        fighter.health > 0 ? 'IdleAggro' : 'DefeatedLoop',
        true
      );
    }
  }
  private publish() {
    const capable = this.prerequisites();
    const message =
      this.error ??
      (!this.landscape
        ? 'Rotate to landscape to place the arena.'
        : !this.attached
          ? 'AR paused. Return to place the arena again.'
          : !this.tracking || this.stableTime + epsilon < this.rules.stableTracking
            ? 'Move slowly in a well-lit space until tracking is stable.'
            : !this.placed
              ? 'Tap a highlighted table or floor to place the arena.'
              : this.assets.size < 3
                ? `Loading arena and fighters (${this.assets.size}/3).`
                : this.phase === 'paused'
                  ? 'Fight paused. Press Resume when ready.'
                  : this.phase === 'setup'
                    ? this.preview
                      ? `Testing ${this.preview.fighter === 'blue' ? 'Blue' : 'Red'}: ${this.preview.clip}`
                      : 'Choose your side and view, then press Ready.'
                    : this.outcome
                      ? this.outcome === 'draw'
                        ? 'Draw — double knockout.'
                        : this.outcome === 'blue'
                          ? 'You won!'
                          : 'Red Mike won. Try a rematch.'
                      : 'Hold Advance or Retreat. Tap Punch or Uppercut.');
    const view = (fighter: Fighter): FighterView => ({
      health: fighter.health,
      mode: fighter.mode,
      clip: fighter.clip,
      animationId: fighter.animationId,
      uppercutRemaining:
        Math.ceil(Math.max(0, fighter.uppercutAt - this.clock - epsilon) * 10) / 10,
    });
    const snapshot: ArenaSnapshot = {
      sessionToken: this.attached ? this.token : null,
      roundId: this.roundId,
      phase: this.phase,
      blue: view(this.fighters.blue),
      cpu: view(this.fighters.cpu),
      assetsLoaded: this.assets.size,
      placementVersion: this.placementVersion,
      placed: this.placed,
      canReady: capable && this.phase === 'setup' && !this.preview,
      canResume: capable && this.phase === 'paused',
      canRematch: capable && this.phase === 'ended',
      canAttack: capable && this.phase === 'fighting' && this.fighters.blue.mode !== 'hit',
      animationsRunning: capable && this.phase !== 'paused',
      message,
      error: this.error,
      outcome: this.outcome,
      arenaYaw: this.arenaYaw,
      blueStartsLeft: this.blueStartsLeft,
      preview: this.preview ? { fighter: this.preview.fighter, clip: this.preview.clip } : null,
      fps: this.fps,
      frameSamples: this.frameSamples - (this.frameSamples % 60),
    };
    const key = JSON.stringify(snapshot);
    if (key === this.snapshotKey) return;
    this.snapshotKey = key;
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener());
  }
}
