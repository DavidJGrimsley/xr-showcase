import {
  ViroReplicationClient,
  createColocationRoom,
  lookupColocationRoom,
  normaliseJoinCode,
  formatJoinCode,
  cloudAnchorFrameSource,
  parseLocationTransform,
  type ViroFrameSource,
  type ViroColocationRoom,
  type ViroARSceneNavigator,
} from '@reactvision/react-viro';
import { ArenaMatch } from './arena-match';
import { ArenaNetwork } from './arena-network';
import { arenaInFrame, framePose } from './arena-placement';

type Navigator = ViroARSceneNavigator['arSceneNavigator'];
async function bounded<T>(operation: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Operation timed out')), milliseconds);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
export interface RoomView {
  status: 'scanning' | 'hosting' | 'joining' | 'aligning' | 'placing' | 'ready' | 'error';
  message: string;
  canFinish: boolean;
  source: ViroFrameSource | null;
  frame: number[] | null;
}
export class ArenaRoom {
  private match: ArenaMatch;
  private config: { apiKey: string; projectId: string };
  private code: string;
  private navigator: Navigator | null = null;
  private generation = 0;
  private room: ViroColocationRoom | null = null;
  private network: ArenaNetwork | null = null;
  private listeners = new Set<() => void>();
  private view: RoomView = {
    status: 'joining',
    message: 'Preparing shared arena…',
    canFinish: false,
    source: null,
    frame: null,
  };
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private busy = false;
  private scanPoll = false;
  private trackingNormal = false;
  private awaitingTracking = false;
  constructor(match: ArenaMatch, config: { apiKey: string; projectId: string }, code = '') {
    this.match = match;
    this.config = config;
    this.code = code;
  }
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.view;
  private update(update: Partial<RoomView>) {
    this.view = {
      ...this.view,
      ...update,
      ...(update.source
        ? { source: { ...update.source, key: update.source.key + ':' + this.generation } }
        : {}),
    };
    this.listeners.forEach((fn) => fn());
  }
  start() {
    if (!this.pollTimer)
      this.pollTimer = setInterval(() => {
        this.network?.pump();
        this.match.poll();
        void this.pollScan();
      }, 50);
  }
  attach(nav: Navigator) {
    const generation = ++this.generation;
    this.navigator = nav;
    this.update({ frame: null, source: null, canFinish: false });
    if (this.room?.cloudAnchorId)
      this.update({
        status: 'aligning',
        message: 'Look around the same table to recover the arena.',
        source: cloudAnchorFrameSource(this.room.cloudAnchorId),
      });
    else void this.prepare(generation);
    return () => {
      if (nav !== this.navigator) return;
      this.generation++;
      nav.cancelCloudAnchorOperations();
      this.navigator = null;
      this.busy = false;
      this.scanPoll = false;
      this.trackingNormal = false;
      this.awaitingTracking = false;
    };
  }
  tracking(normal: boolean) {
    this.trackingNormal = normal;
    if (!normal && this.view.status === 'scanning') this.update({ canFinish: false });
    if (normal && this.awaitingTracking) void this.prepare(this.generation);
  }
  private connect() {
    if (!this.room) return;
    this.network?.close();
    this.network = new ArenaNetwork(
      this.match,
      new ViroReplicationClient(),
      { ...this.config, roomId: this.room.roomId },
      formatJoinCode(this.room.joinCode ?? this.code)
    );
  }
  private async prepare(generation: number) {
    if (!this.navigator) return;
    this.busy = false;
    if (this.match.mode === 'host') {
      this.awaitingTracking = !this.trackingNormal;
      if (this.awaitingTracking) {
        this.update({
          status: 'scanning',
          message: 'Look around the table until tracking is ready.',
        });
        return;
      }
      this.navigator.startScan();
      this.update({
        status: 'scanning',
        message: 'Move slowly around the table so both phones can recognize it.',
        source: null,
        canFinish: false,
      });
      return;
    }
    this.update({ status: 'joining', message: 'Looking up room…' });
    const code = normaliseJoinCode(this.code);
    if (!code) {
      this.fail('Enter the six-character room code.');
      return;
    }
    try {
      const result = await bounded(lookupColocationRoom(this.config, code), 20000);
      if (generation !== this.generation) return;
      if (!result.success) {
        this.fail(result.error);
        return;
      }
      if (result.room.frameKind !== 'cloud_anchor' || !result.room.cloudAnchorId) {
        this.fail('This room cannot be joined from an iPhone.');
        return;
      }
      this.room = result.room;
      this.connect();
      this.update({
        status: 'aligning',
        message: 'Look around the host’s table to align the arena.',
        source: cloudAnchorFrameSource(result.room.cloudAnchorId),
      });
    } catch {
      if (generation === this.generation)
        this.fail('Could not reach ReactVision. Check your connection and retry.');
    }
  }
  private lastPoll = 0;
  private async pollScan() {
    if (
      this.view.status !== 'scanning' ||
      !this.trackingNormal ||
      this.awaitingTracking ||
      !this.navigator ||
      this.scanPoll ||
      Date.now() - this.lastPoll < 1000
    )
      return;
    this.lastPoll = Date.now();
    this.scanPoll = true;
    const generation = this.generation;
    try {
      const scan = await bounded(this.navigator.getScanStatus(), 10000);
      if (generation !== this.generation) return;
      if (!scan.available) {
        this.fail(
          'Shared AR is unavailable. Install the new development build with ReactVision configured.'
        );
        return;
      }
      this.update({
        canFinish: !!scan.meetsKeyframes && !!scan.meetsViewpointPairs && !!scan.meetsSpread,
        message:
          'Scan the table from several angles. Coverage ' +
          (scan.keyframes ?? 0) +
          '/' +
          (scan.minKeyframes ?? '…') +
          '.',
      });
    } catch {
      if (generation === this.generation)
        this.fail('Could not scan this space. Retry in good lighting.');
    } finally {
      if (generation === this.generation) this.scanPoll = false;
    }
  }
  finishScan = async () => {
    if (!this.navigator || !this.trackingNormal || this.busy || !this.view.canFinish) return;
    this.busy = true;
    const generation = this.generation;
    this.update({ status: 'hosting', canFinish: false, message: 'Creating shared space…' });
    try {
      const hosted = await bounded(this.navigator.finishScan(1), 60000);
      if (generation !== this.generation) return;
      const frame = parseLocationTransform(hosted.locationTransform);
      if (!hosted.success || !hosted.cloudAnchorId || !frame) {
        this.fail(hosted.error ?? 'The scan needs more detail. Try another angle.');
        return;
      }
      const created = await bounded(
        createColocationRoom(this.config, {
          frameKind: 'cloud_anchor',
          cloudAnchorId: hosted.cloudAnchorId,
          name: 'Arena Fighter',
        }),
        20000
      );
      if (generation !== this.generation) return;
      if (!created.success) {
        this.fail(created.error);
        return;
      }
      this.room = created.room;
      this.connect();
      const pose = framePose(frame);
      const source: ViroFrameSource = {
        key: hosted.cloudAnchorId,
        name: 'hosted arena',
        support: { ok: true },
        acquire: async () => ({
          success: true,
          frame: { ...pose, scale: [1, 1, 1], transform: hosted.locationTransform! },
        }),
      };
      this.update({
        source,
        frame,
        status: 'placing',
        message: 'Tap a highlighted table or floor to place the arena.',
      });
    } catch {
      if (generation === this.generation) {
        this.navigator?.cancelCloudAnchorOperations();
        this.fail('Could not host this space. Check the connection and retry.');
      }
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  };
  localized = (transform: string) => {
    const frame = parseLocationTransform(transform);
    if (!frame) {
      this.fail('The shared space returned an invalid alignment. Retry.');
      return;
    }
    this.update({
      frame,
      status: this.match.placement ? 'ready' : 'placing',
      message: this.match.placement
        ? 'Shared arena aligned.'
        : this.match.mode === 'host'
          ? 'Tap a highlighted surface to place the arena.'
          : 'Waiting for the host to place the arena.',
    });
  };
  progress = (message: string) => {
    if (this.view.status === 'aligning') this.update({ message });
  };
  place(point: [number, number, number]) {
    if (!this.view.frame || this.match.mode !== 'host') return;
    this.match.setSharedPlacement(arenaInFrame(this.view.frame, point));
    this.update({ status: 'ready', message: 'Share the code with your opponent.' });
  }
  fail = (message: string) => this.update({ status: 'error', message, canFinish: false });
  retry = () => {
    this.network?.retry();
    this.navigator?.cancelCloudAnchorOperations();
    if (!this.navigator) return;
    this.attach(this.navigator);
  };
  dispose() {
    this.generation++;
    this.navigator?.cancelCloudAnchorOperations();
    this.network?.close();
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
    this.navigator = null;
  }
}
