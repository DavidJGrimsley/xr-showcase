import {
  ArenaController,
  type ArenaSnapshot,
  type FighterId,
  type Movement,
  type AttackKind,
  type FighterTransform,
} from './arena-controller.ts';
import { ArenaPresentation, type Knockout } from './arena-presentation.ts';
import {
  DEFAULT_ARENA_TRANSFORM,
  boundedArenaTransform,
  type ArenaTransform,
  type ArenaTransformScope,
} from './arena-transform.ts';
import {
  ARENA_PROTOCOL,
  type ArenaMode,
  type MatchLength,
  type MatchPhase,
  type ArenaPacket,
  type PeerInput,
  type ArenaCommand,
  type ArenaPlacement,
} from './arena-protocol.ts';

export interface MatchSnapshot extends ArenaSnapshot {
  sharedPlacement: ArenaPlacement | null;
  mode: ArenaMode;
  localFighter: FighterId;
  stage: MatchPhase;
  rounds: MatchLength;
  wins: Record<FighterId, number>;
  countdown: number;
  localReady: boolean;
  peerReady: boolean;
  connected: boolean;
  peerConnected: boolean;
  remotePauseReason: string | null;
  presentationReady: { local: boolean; peer: boolean };
  displayCode: string | null;
  networkMessage: string;
  recoverySeconds: number;
  arenaTransform: ArenaTransform;
  transformLocked: boolean;
  canTransform: boolean;
  pinching: boolean;
  rotating: boolean;
  orientationPaused: boolean;
  localOrientationPaused: boolean;
}
export class ArenaMatch {
  readonly round: ArenaController;
  readonly mode: ArenaMode;
  readonly localFighter: FighterId;
  readonly clientId: string;
  session: string;
  placement: ArenaPlacement | null = null;
  private rounds: MatchLength;
  private stage: MatchPhase = 'lobby';
  private resumeStage: MatchPhase = 'fighting';
  private matchId = 1;
  private epoch = 0;
  private wins = { blue: 0, red: 0 };
  private countdown = 0;
  private knockout: Knockout | null = null;
  private presentation: ArenaPresentation | null = null;
  private localReady = false;
  private peer: PeerInput | null = null;
  private remote: ArenaPacket | null = null;
  private connected = false;
  private lastPeerAt = -Infinity;
  private recoveryAt: number | null = null;
  private readyEpoch = 0;
  private seq = 0;
  private serial = 0;
  private ack = 0;
  private pending: ArenaCommand[] = [];
  private localCommands: ArenaCommand[] = [];
  private held = { advance: false, retreat: false };
  private listeners = new Set<() => void>();
  private snapshot!: MatchSnapshot;
  private key = '';
  private code: string | null = null;
  private networkMessage = '';
  private disposed = false;
  private appActive = true;
  private landscape = false;
  private orientationRecovering = false;
  private arenaTransform = { ...DEFAULT_ARENA_TRANSFORM };
  private transformLocked = false;
  private pinchStart: number | null = null;
  private rotationStart: number | null = null;
  private previousTransforms: Record<FighterId, FighterTransform> | null = null;
  private transformAt = 0;
  private now: () => number;

  constructor(
    mode: ArenaMode,
    rounds: MatchLength = 3,
    now = () => Date.now(),
    rules: ConstructorParameters<typeof ArenaController>[0] = {}
  ) {
    this.mode = mode;
    this.localFighter = mode === 'guest' ? 'red' : 'blue';
    this.rounds = rounds;
    this.now = now;
    this.clientId = now().toString(36) + '-' + Math.random().toString(36).slice(2);
    this.session = mode === 'guest' ? '' : this.clientId;
    this.round = new ArenaController({
      ...rules,
      cpuEnabled: mode === 'solo' && rules.cpuEnabled !== false,
    });
    this.round.subscribe(() => this.publish());
    this.publish();
  }
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.snapshot;
  getSessionToken = () => this.round.getSessionToken();
  isCurrent(token: number) {
    return !this.disposed && this.getSessionToken() === token;
  }
  setLandscape = (value: boolean) => {
    if (this.landscape === value) return;
    this.landscape = value;
    this.orientationRecovering = true;
    this.held = { advance: false, retreat: false };
    this.round.clearHeldMovement();
    this.clearGestures();
    this.round.setLandscape(value);
    if (value && this.getSessionToken() !== null && !this.round.hasNormalTracking())
      this.interrupt();
    this.checkReadiness();
    this.publish();
  };
  setAppActive = (active: boolean) => {
    if (this.appActive === active) return;
    this.appActive = active;
    this.round.resetTrackingStability();
    if (!active) {
      this.localReady = false;
      this.clearInput();
      this.interrupt();
    }
    this.publish();
  };
  isAppActive = () => this.appActive;
  isLandscape = () => this.landscape;
  setTracking = (token: number, normal: boolean) => {
    if (!this.isCurrent(token)) return;
    if (!normal) this.clearGestures();
    this.round.setTracking(token, normal);
    if (this.isCurrent(token) && !normal && this.landscape) this.interrupt();
    this.checkReadiness();
  };
  setPlacement = (token: number, placed: boolean) => {
    if (!this.isCurrent(token)) return;
    if (!placed) this.clearGestures();
    this.round.setPlacement(token, placed);
    if (!placed) this.interrupt();
    this.checkReadiness();
  };
  attachSession = (id: number) => {
    this.clearGestures();
    this.transformLocked = false;
    return this.round.attachSession(id);
  };
  detachSession = (token: number) => {
    if (!this.isCurrent(token)) return;
    this.presentation?.remounted();
    this.clearGestures();
    this.round.detachSession(token);
    this.interrupt();
    this.checkReadiness();
  };
  assetLoaded = (
    token: number,
    version: number,
    asset: Parameters<ArenaController['assetLoaded']>[2]
  ) => this.round.assetLoaded(token, version, asset);
  assetFailed = (
    token: number,
    version: number,
    asset: Parameters<ArenaController['assetFailed']>[2]
  ) => {
    const result = this.round.assetFailed(token, version, asset);
    if (result) this.interrupt();
    this.checkReadiness();
    return result;
  };
  firstMissingAsset = () => this.round.firstMissingAsset();
  recordFrame = (token: number, dt: number) =>
    this.round.recordFrame(
      token,
      dt,
      this.stage === 'fighting' || this.stage === 'presenting' || !!this.snapshot.preview
    );
  previewClip = (...args: Parameters<ArenaController['previewClip']>) =>
    this.mode === 'solo' && this.stage === 'lobby' && this.round.previewClip(...args);
  stopPreview = () => this.round.stopPreview();
  swapSides = () => {
    if (this.canTransform()) {
      this.localReady = false;
      this.epoch++;
      this.round.swapSides();
      this.publish();
    }
  };
  rotateArena = () => {
    if (!this.canTransform()) return;
    this.changeTransform({ ...this.arenaTransform, yaw: this.arenaTransform.yaw + 90 });
  };
  private localOrientationPause() {
    return !this.landscape || this.orientationRecovering;
  }
  private peerOrientationPause() {
    return this.mode === 'guest'
      ? this.remote?.orientationPaused === true
      : this.mode === 'host' && this.peer?.orientationPaused === true;
  }
  private orientationPause() {
    return this.localOrientationPause() || this.peerOrientationPause();
  }
  private clearGestures() {
    this.pinchStart = this.rotationStart = null;
  }
  canTransform() {
    const round = this.round.getSnapshot();
    return (
      this.mode !== 'guest' &&
      this.stage === 'lobby' &&
      !this.transformLocked &&
      !this.localOrientationPause() &&
      round.placed &&
      this.round.isReady() &&
      !round.preview
    );
  }
  private currentTransformScope(scope: ArenaTransformScope) {
    return (
      this.isCurrent(scope.sessionToken) &&
      scope.placementVersion === this.round.getSnapshot().placementVersion &&
      this.canTransform()
    );
  }
  invalidatePlacementReady = () => {
    if (this.mode === 'guest' || this.stage !== 'lobby') return;
    this.localReady = false;
    this.epoch++;
    this.publish();
  };
  setTransformLocked = (locked: boolean) => {
    this.transformLocked = locked;
    if (locked) this.clearGestures();
    this.publish();
  };
  resetSetupTransform = () => {
    if (this.mode === 'guest' || this.stage !== 'lobby') return;
    this.clearGestures();
    this.changeTransform({ ...DEFAULT_ARENA_TRANSFORM });
  };
  repositionSolo = (scope: ArenaTransformScope) => {
    if (this.mode !== 'solo' || !this.currentTransformScope(scope)) return;
    this.clearGestures();
    this.invalidatePlacementReady();
    this.setPlacement(scope.sessionToken, false);
  };
  private changeTransform(value: ArenaTransform) {
    const next = boundedArenaTransform(value);
    if (JSON.stringify(next) === JSON.stringify(this.arenaTransform)) return;
    this.arenaTransform = next;
    this.invalidatePlacementReady();
  }
  setScale = (scope: ArenaTransformScope, value: number) => {
    if (!this.currentTransformScope(scope) || this.pinchStart !== null || !Number.isFinite(value))
      return;
    this.changeTransform({ ...this.arenaTransform, scale: value });
  };
  setYaw = (scope: ArenaTransformScope, value: number) => {
    if (
      !this.currentTransformScope(scope) ||
      this.rotationStart !== null ||
      !Number.isFinite(value)
    )
      return;
    this.changeTransform({ ...this.arenaTransform, yaw: value });
  };
  setHeight = (scope: ArenaTransformScope, value: number) => {
    if (!this.currentTransformScope(scope) || !Number.isFinite(value)) return;
    this.changeTransform({ ...this.arenaTransform, height: value });
  };
  pinch = (scope: ArenaTransformScope, gesture: number, factor: number) => {
    if (!this.currentTransformScope(scope) || ![1, 2, 3].includes(gesture)) return;
    if (gesture === 1) {
      this.pinchStart = this.arenaTransform.scale;
      this.invalidatePlacementReady();
    }
    if (this.pinchStart !== null && Number.isFinite(factor) && factor > 0)
      this.changeTransform({ ...this.arenaTransform, scale: this.pinchStart * factor });
    if (gesture === 3) this.pinchStart = null;
    this.publish();
  };
  rotate = (scope: ArenaTransformScope, gesture: number, degrees: number) => {
    if (!this.currentTransformScope(scope) || ![1, 2, 3].includes(gesture)) return;
    if (gesture === 1) {
      this.rotationStart = this.arenaTransform.yaw;
      this.invalidatePlacementReady();
    }
    if (this.rotationStart !== null && Number.isFinite(degrees))
      this.changeTransform({ ...this.arenaTransform, yaw: this.rotationStart - degrees });
    if (gesture === 3) this.rotationStart = null;
    this.publish();
  };
  setSharedPlacement(placement: ArenaPlacement) {
    if (this.mode !== 'guest' && this.stage === 'lobby') {
      this.placement = placement;
      this.localReady = false;
      this.epoch++;
      this.publish();
    }
  }
  setNetwork(connected: boolean, message = '', code = this.code) {
    this.connected = connected;
    if (this.stage !== 'abandoned') this.networkMessage = message;
    this.code = code;
    this.checkReadiness();
    this.publish();
  }
  capable() {
    return this.appActive && this.round.isReady() && (this.mode === 'solo' || this.connected);
  }
  private peerCapable() {
    return (
      this.mode === 'solo' ||
      (this.connected &&
        this.now() - this.lastPeerAt < 1000 &&
        (this.mode === 'guest' ? this.remote?.hostCapable : this.peer?.capable) === true)
    );
  }
  private bothReady() {
    return (
      this.localReady &&
      (this.mode === 'solo' || (!!this.peer?.ready && this.peer.epoch === this.epoch))
    );
  }
  ready = () => {
    if (
      !this.capable() ||
      !this.peerCapable() ||
      !['lobby', 'paused', 'finished'].includes(this.stage) ||
      this.orientationPause() ||
      this.transformLocked
    )
      return false;
    this.round.stopPreview();
    this.localReady = true;
    this.readyEpoch = this.epoch;
    this.publish();
    return true;
  };
  resume = this.ready;
  rematch = this.ready;
  setMovement = (movement: Movement, held: boolean, roundId = this.snapshot.roundId) => {
    if (roundId !== this.snapshot.roundId) return;
    this.held[movement] = held && this.snapshot.canAttack;
  };
  attack = (kind: AttackKind, roundId = this.snapshot.roundId) => {
    if (roundId !== this.snapshot.roundId) return false;
    if (
      !this.snapshot.canAttack ||
      (kind === 'uppercut' && this.snapshot[this.localFighter].uppercutRemaining > 0)
    )
      return false;
    if (this.pending.length >= 32 || this.localCommands.length >= 32) {
      this.interrupt();
      return false;
    }
    const command = {
      seq: ++this.seq,
      epoch: this.epoch,
      matchId: this.matchId,
      roundId: this.snapshot.roundId,
      kind,
    };
    if (this.mode === 'guest') this.pending.push(command);
    else this.localCommands.push(command);
    return true;
  };
  animationApplied(id: FighterId, animationId: number) {
    this.presentation?.applied(id, animationId);
  }
  private clearInput() {
    this.held = { advance: false, retreat: false };
    this.pending = [];
    this.localCommands = [];
  }
  private active() {
    return ['countdown', 'fighting', 'presenting', 'intermission'].includes(this.stage);
  }
  private checkReadiness() {
    // Orientation is a presentation hold, not a recovery or a new generation.
    // Socket loss/background still interrupt even when a phone is in portrait.
    const connectionLost =
      this.mode !== 'solo' && (!this.connected || this.now() - this.lastPeerAt >= 1000);
    const unavailable =
      !this.appActive ||
      connectionLost ||
      (!this.capable() && !this.localOrientationPause()) ||
      (!this.peerCapable() && !this.peerOrientationPause());
    if (this.stage === 'lobby' && this.localReady && unavailable) {
      this.localReady = false;
    }
    if (this.active() && unavailable) this.interrupt();
  }
  interrupt() {
    if (!this.active()) return;
    this.resumeStage = this.stage;
    this.stage = 'paused';
    this.localReady = false;
    this.clearInput();
    this.round.pauseRound();
    this.recoveryAt ??= this.now();
    if (this.mode !== 'guest') this.epoch++;
    this.publish();
  }
  poll = () => {
    if (this.disposed) return;
    this.checkReadiness();
    if (
      this.mode !== 'solo' &&
      this.stage === 'paused' &&
      this.recoveryAt !== null &&
      this.now() - this.recoveryAt >= 30000
    )
      this.abandon('Connection or tracking did not recover. No winner awarded.');
    this.publish();
  };
  abandon(message = 'The other player left. No winner awarded.') {
    this.stage = 'abandoned';
    this.localReady = false;
    this.networkMessage = message;
    this.clearInput();
    this.round.pauseRound();
    this.publish();
  }
  private startCountdown() {
    this.localReady = false;
    this.clearInput();
    this.epoch++;
    this.countdown = 3;
    this.stage = 'countdown';
  }
  private acceptCommand(command: ArenaCommand, fighter: FighterId) {
    if (
      this.stage !== 'fighting' ||
      command.epoch !== this.epoch ||
      command.matchId !== this.matchId ||
      command.roundId !== this.round.getSnapshot().roundId
    )
      return;
    this.round.attack(command.kind, fighter, command.roundId);
  }
  tick = (token: number, dt: number) => {
    if (!this.isCurrent(token) || !Number.isFinite(dt) || dt <= 0 || dt > 0.1) return;
    this.checkReadiness();
    const simulate = !this.orientationPause() && this.capable() && this.peerCapable();
    if (this.mode !== 'guest' && this.stage === 'fighting' && simulate) {
      for (const movement of ['advance', 'retreat'] as const) {
        this.round.setMovement(movement, this.held[movement], undefined, 'blue');
        if (this.mode === 'host')
          this.round.setMovement(
            movement,
            this.peer?.epoch === this.epoch && this.peer[movement] === true,
            undefined,
            'red'
          );
      }
      for (const command of this.localCommands.splice(0)) this.acceptCommand(command, 'blue');
      for (const command of this.peer?.commands ?? []) {
        if (command.seq <= this.ack) continue;
        this.ack = command.seq;
        this.acceptCommand(command, 'red');
      }
    }
    this.round.tick(token, dt, simulate);
    if (this.landscape && this.orientationRecovering && this.round.isReady())
      this.orientationRecovering = false;
    if (this.orientationPause()) this.round.clearHeldMovement();
    if (this.mode !== 'guest' && simulate) this.advanceMatch(dt);
    if (this.presentation && this.stage === 'presenting' && simulate) this.presentation.tick(dt);
    this.publish();
  };
  private advanceMatch(dt: number) {
    const round = this.round.getSnapshot();
    if (this.stage === 'paused' && this.capable() && this.peerCapable() && this.bothReady()) {
      this.stage = this.resumeStage;
      this.recoveryAt = null;
      this.localReady = false;
      this.epoch++;
      this.clearInput();
      if (this.stage === 'countdown') this.countdown = 3;
      if (this.stage === 'fighting' || this.stage === 'presenting') this.round.resume();
    }
    if (this.stage === 'lobby' && this.bothReady()) this.startCountdown();
    else if (this.stage === 'finished' && this.bothReady()) {
      this.matchId++;
      this.wins = { blue: 0, red: 0 };
      this.knockout = null;
      this.presentation = null;
      this.round.prepareRound();
      this.startCountdown();
    } else if (this.stage === 'countdown') {
      this.countdown = Math.max(0, this.countdown - dt);
      if (this.countdown < 1e-7 && (this.round.ready() || this.round.resume()))
        this.stage = 'fighting';
    } else if (this.stage === 'fighting' && round.outcome) {
      this.knockout = {
        id: this.matchId + ':' + round.roundId,
        outcome: round.outcome,
        launched: (['blue', 'red'] as const).filter((id) => round[id].mode === 'launch'),
      };
      this.presentation = new ArenaPresentation(this.knockout, round);
      this.stage = 'presenting';
      this.clearInput();
    } else if (
      this.stage === 'presenting' &&
      round.phase === 'ended' &&
      this.presentation?.done &&
      (this.mode === 'solo' || this.peer?.presentation === this.knockout?.id)
    ) {
      if (this.knockout!.outcome !== 'draw') this.wins[this.knockout!.outcome as FighterId]++;
      this.stage =
        Math.max(this.wins.blue, this.wins.red) >= Math.ceil(this.rounds / 2)
          ? 'finished'
          : 'intermission';
      this.countdown = 2;
      this.localReady = false;
      this.epoch++;
    } else if (this.stage === 'intermission') {
      this.countdown -= dt;
      if (this.countdown <= 0 && this.round.prepareRound()) {
        this.knockout = null;
        this.presentation = null;
        this.startCountdown();
      }
    }
  }
  input(): PeerInput {
    return {
      protocol: ARENA_PROTOCOL,
      clientId: this.clientId,
      session: this.session,
      serial: ++this.serial,
      epoch: this.epoch,
      matchId: this.matchId,
      roundId: this.snapshot.roundId,
      ...this.held,
      commands: [...this.pending],
      capable: this.capable(),
      pauseReason: !this.appActive
        ? 'App interrupted. Return to the arena.'
        : this.capable()
          ? null
          : !this.connected
            ? 'Connection interrupted.'
            : this.round.getSnapshot().message,
      paused: this.stage === 'paused',
      orientationPaused: this.localOrientationPause(),
      ready: this.localReady && this.readyEpoch === this.epoch,
      presentation: this.presentation?.done ? this.knockout!.id : null,
      leaving: this.disposed || this.stage === 'abandoned',
    };
  }
  packet(): ArenaPacket {
    return {
      protocol: ARENA_PROTOCOL,
      session: this.session,
      serial: ++this.serial,
      epoch: this.epoch,
      matchId: this.matchId,
      rounds: this.rounds,
      stage: this.stage,
      countdown: this.countdown,
      wins: { ...this.wins },
      round: this.round.getSnapshot(),
      transforms: { blue: this.round.getTransform('blue'), red: this.round.getTransform('red') },
      knockout: this.knockout,
      ack: this.ack,
      hostCapable: this.capable(),
      hostReady: this.localReady,
      placement: this.placement,
      arenaTransform: { ...this.arenaTransform },
      orientationPaused: this.orientationPause(),
    };
  }
  receiveInput(input: PeerInput) {
    if (
      this.mode !== 'host' ||
      this.disposed ||
      this.stage === 'abandoned' ||
      input.session !== this.session ||
      (this.peer && (input.clientId !== this.peer.clientId || input.serial <= this.peer.serial))
    )
      return;
    this.peer = input;
    if (input.orientationPaused) {
      this.held = { advance: false, retreat: false };
      this.round.clearHeldMovement();
    }
    this.lastPeerAt = this.now();
    if (input.leaving) this.abandon();
    else if (input.paused && input.epoch === this.epoch) this.interrupt();
    else this.checkReadiness();
    this.publish();
  }
  receivePacket(packet: ArenaPacket) {
    if (
      this.mode !== 'guest' ||
      this.stage === 'abandoned' ||
      (this.session && packet.session !== this.session) ||
      (this.remote && packet.serial <= this.remote.serial)
    )
      return;
    this.previousTransforms = { blue: this.getTransform('blue'), red: this.getTransform('red') };
    this.transformAt = this.now();
    this.lastPeerAt = this.now();
    if (packet.epoch !== this.epoch || packet.matchId !== this.matchId) {
      this.clearInput();
      this.localReady = false;
    }
    const hostWasPaused = this.remote?.stage === 'paused';
    this.remote = packet;
    this.session = packet.session;
    this.epoch = packet.epoch;
    this.matchId = packet.matchId;
    this.rounds = packet.rounds;
    this.wins = packet.wins;
    this.countdown = packet.countdown;
    this.placement = packet.placement;
    this.arenaTransform = { ...packet.arenaTransform };
    if (packet.orientationPaused) this.held = { advance: false, retreat: false };
    if (packet.stage === 'abandoned' && !this.networkMessage)
      this.networkMessage = 'Match ended. No winner awarded.';
    // The guest cannot overrule a local interruption with an older host packet.
    if (packet.stage === 'paused') {
      this.stage = 'paused';
      this.recoveryAt ??= this.now();
    } else if (
      packet.stage === 'abandoned' ||
      this.stage !== 'paused' ||
      (hostWasPaused && this.capable())
    ) {
      this.stage = packet.stage;
      this.recoveryAt = null;
    }
    this.pending = this.pending.filter((command) => command.seq > packet.ack);
    if (packet.knockout && packet.knockout.id !== this.knockout?.id) {
      this.knockout = packet.knockout;
      this.presentation = new ArenaPresentation(packet.knockout, packet.round);
    } else if (!packet.knockout) {
      this.knockout = null;
      this.presentation = null;
    }
    this.checkReadiness();
    this.publish();
  }
  getTransform = (id: FighterId): FighterTransform => {
    const target =
      this.mode === 'guest' && this.remote
        ? this.remote.transforms[id]
        : this.round.getTransform(id);
    const previous = this.previousTransforms?.[id];
    const t = Math.min(1, (this.now() - this.transformAt) / 50);
    const transform =
      this.mode === 'guest' && previous && this.stage === 'fighting'
        ? { ...target, x: previous.x + (target.x - previous.x) * t }
        : target;
    return this.presentation ? { ...transform, lift: this.presentation.get(id).lift } : transform;
  };
  dispose = () => {
    this.disposed = true;
    this.clearInput();
    this.round.dispose();
  };
  private publish() {
    const local = this.round.getSnapshot();
    const combat = this.mode === 'guest' && this.remote ? this.remote.round : local;
    const capable = this.capable();
    const peerConnected =
      this.mode === 'solo' || (this.connected && this.now() - this.lastPeerAt < 1000);
    const remotePauseReason =
      this.mode === 'solo'
        ? null
        : !peerConnected
          ? 'Opponent connection interrupted.'
          : this.mode === 'guest'
            ? this.remote?.hostCapable
              ? null
              : (this.remote?.round.message ?? 'Waiting for the host.')
            : (this.peer?.pauseReason ?? null);
    const orientationPaused = this.orientationPause();
    const canAct = this.stage === 'fighting' && capable && this.peerCapable() && !orientationPaused;
    const fighter = (id: FighterId) => {
      const pose = this.presentation?.get(id);
      return pose
        ? { ...combat[id], mode: pose.mode, clip: pose.clip, animationId: pose.animationId }
        : combat[id];
    };
    const message =
      this.stage === 'abandoned'
        ? this.networkMessage
        : !local.placed || !this.round.isReady()
          ? local.message
          : this.stage === 'paused'
            ? this.mode === 'solo'
              ? 'Match paused. Press Resume when ready.'
              : 'Match paused. Both players must Resume.'
            : this.stage === 'lobby'
              ? this.mode !== 'solo' && !this.peerCapable()
                ? 'Waiting for the other player to align the arena.'
                : 'Press Ready when you can see the arena.'
              : this.stage === 'finished'
                ? 'Match complete'
                : '';
    const next: MatchSnapshot = {
      ...local,
      sharedPlacement: this.placement,
      arenaTransform: { ...this.arenaTransform },
      transformLocked: this.transformLocked,
      canTransform: this.canTransform(),
      pinching: this.pinchStart !== null,
      rotating: this.rotationStart !== null,
      orientationPaused,
      localOrientationPaused: this.localOrientationPause(),
      blue: fighter('blue'),
      red: fighter('red'),
      roundId: combat.roundId,
      arenaYaw: this.arenaTransform.yaw,
      blueStartsLeft: combat.blueStartsLeft,
      outcome: ['intermission', 'finished'].includes(this.stage)
        ? (this.knockout?.outcome ?? null)
        : null,
      phase:
        this.stage === 'lobby'
          ? 'setup'
          : this.stage === 'fighting'
            ? 'fighting'
            : this.stage === 'presenting'
              ? 'ending'
              : this.stage === 'paused'
                ? 'paused'
                : 'ended',
      animationsRunning:
        capable &&
        this.peerCapable() &&
        !orientationPaused &&
        this.stage !== 'paused' &&
        this.stage !== 'abandoned',
      canAttack: canAct,
      canReady:
        capable &&
        this.peerCapable() &&
        !this.localReady &&
        !this.transformLocked &&
        !orientationPaused,
      canResume: capable && this.peerCapable() && !this.localReady && !orientationPaused,
      canRematch: capable && this.peerCapable() && this.stage === 'finished' && !this.localReady,
      message,
      mode: this.mode,
      localFighter: this.localFighter,
      stage: this.stage,
      rounds: this.rounds,
      wins: { ...this.wins },
      countdown: Math.ceil(this.countdown),
      localReady: this.localReady,
      peerReady:
        this.mode === 'solo' ||
        (this.mode === 'host'
          ? !!this.peer?.ready && this.peer.epoch === this.epoch
          : !!this.remote?.hostReady),
      connected: this.mode === 'solo' || this.connected,
      peerConnected,
      remotePauseReason,
      presentationReady: {
        local: this.presentation?.done ?? false,
        peer:
          this.mode === 'solo' ||
          (this.mode === 'host'
            ? !!this.knockout && this.peer?.presentation === this.knockout.id
            : this.stage === 'intermission' || this.stage === 'finished'),
      },
      displayCode: this.code,
      networkMessage: this.networkMessage,
      recoverySeconds:
        this.recoveryAt === null
          ? 30
          : Math.max(0, Math.ceil((30000 - this.now() + this.recoveryAt) / 1000)),
    };
    const key = JSON.stringify(next);
    if (key === this.key) return;
    this.key = key;
    this.snapshot = next;
    this.listeners.forEach((listener) => listener());
  }
}
