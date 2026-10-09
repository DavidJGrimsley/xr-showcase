import type {
  ViroFrameSource,
  ViroColocationRoom,
  ViroARSceneNavigator,
  ViroScanStatus,
} from '@reactvision/react-viro';
import type { ReplicationPort } from './arena-network.ts';
import { ArenaMatch } from './arena-match.ts';
import { ArenaNetwork } from './arena-network.ts';
import { arenaInFrame, framePose } from './arena-placement.ts';
import { scanGuidance } from './arena-scan.ts';
import type { ArenaPlacement } from './arena-protocol.ts';

type ViroSDK = typeof import('@reactvision/react-viro');
export interface ArenaRoomServices {
  createReplicationClient: () => ReplicationPort;
  createColocationRoom: ViroSDK['createColocationRoom'];
  lookupColocationRoom: ViroSDK['lookupColocationRoom'];
  normaliseJoinCode: ViroSDK['normaliseJoinCode'];
  formatJoinCode: ViroSDK['formatJoinCode'];
  cloudAnchorFrameSource: ViroSDK['cloudAnchorFrameSource'];
  parseLocationTransform: ViroSDK['parseLocationTransform'];
  observeScanStatus?: (scan: ViroScanStatus) => void;
}

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
  scanProgress: number;
  preview: ArenaPlacement | null;
  source: ViroFrameSource | null;
  frame: number[] | null;
}
export class ArenaRoom {
  private match: ArenaMatch;
  private config: { apiKey: string; projectId: string };
  private code: string;
  private navigator: Navigator | null = null;
  private generation = 0;
  private attachment = 0;
  private disposed = false;
  private services: ArenaRoomServices;
  private room: ViroColocationRoom | null = null;
  private network: ArenaNetwork | null = null;
  private listeners = new Set<() => void>();
  private view: RoomView = {
    status: 'joining',
    message: 'Preparing shared arena…',
    canFinish: false,
    scanProgress: 0,
    preview: null,
    source: null,
    frame: null,
  };
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private busy = false;
  private scanPoll = false;
  private trackingNormal = false;
  private awaitingTracking = false;
  private scanStartedAt = 0;
  constructor(
    match: ArenaMatch,
    config: { apiKey: string; projectId: string },
    code: string,
    services: ArenaRoomServices
  ) {
    this.services = services;
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
    if (this.disposed) return;
    if (!this.pollTimer)
      this.pollTimer = setInterval(() => {
        this.network?.pump();
        this.match.poll();
        if (this.awaitingTracking && this.trackingNormal && this.match.isAppActive())
          void this.prepare(this.generation);
        void this.pollScan();
      }, 50);
  }
  attach(nav: Navigator) {
    if (this.disposed) return () => {};
    if (this.navigator && this.navigator !== nav) this.detach();
    const attachment = ++this.attachment;
    this.navigator = nav;
    this.view = { ...this.view, preview: null };
    this.prepareAttachment();
    return () => {
      if (attachment === this.attachment) this.detach();
    };
  }
  private prepareAttachment() {
    const generation = ++this.generation;
    this.busy = false;
    this.scanPoll = false;
    this.lastPoll = 0;
    this.update({ frame: null, source: null, canFinish: false, scanProgress: 0 });
    if (this.room?.cloudAnchorId)
      this.update({
        status: 'aligning',
        message: 'Look around the same table to recover the arena.',
        source: this.services.cloudAnchorFrameSource(this.room.cloudAnchorId),
      });
    else void this.prepare(generation);
  }
  private cancel(nav: Navigator | null) {
    if (!nav) return;
    try {
      nav.cancelCloudAnchorOperations();
    } catch {
      // Viro resolves the view with findNodeHandle. It can already be gone during
      // an error-boundary unmount; native cancellation must not abort JS cleanup.
    }
  }
  detach() {
    const nav = this.navigator;
    this.navigator = null;
    this.generation++;
    this.attachment++;
    this.busy = false;
    this.scanPoll = false;
    this.trackingNormal = false;
    this.awaitingTracking = false;
    this.view = { ...this.view, frame: null, source: null, canFinish: false, preview: null };
    this.cancel(nav);
  }
  tracking(normal: boolean) {
    if (this.disposed) return;
    this.trackingNormal = normal;
    if (!normal && this.view.status === 'scanning') this.update({ canFinish: false });
    if (normal && this.awaitingTracking) void this.prepare(this.generation);
  }
  private connect() {
    if (!this.room) return;
    this.network?.close();
    this.network = new ArenaNetwork(
      this.match,
      this.services.createReplicationClient(),
      { ...this.config, roomId: this.room.roomId },
      this.services.formatJoinCode(this.room.joinCode ?? this.code)
    );
  }
  private async prepare(generation: number) {
    if (!this.navigator) return;
    this.busy = false;
    if (this.match.mode === 'host') {
      this.awaitingTracking = !this.trackingNormal || !this.match.isAppActive();
      if (this.awaitingTracking) {
        this.update({
          status: this.view.preview ? 'scanning' : 'placing',
          message: this.match.isAppActive()
            ? 'Look around the table until tracking is ready.'
            : 'Return to the app to place the arena.',
        });
        return;
      }
      if (!this.view.preview) {
        this.update({
          status: 'placing',
          message: 'Tap a blue surface where you want the arena.',
          canFinish: false,
        });
        return;
      }
      try {
        this.navigator.startScan();
        this.scanStartedAt = Date.now();
        this.update({
          status: 'scanning',
          message:
            'Walk slowly around the arena and look at nearby objects so the other phone can find it.',
          source: null,
          canFinish: false,
          scanProgress: 0,
        });
      } catch {
        if (generation === this.generation)
          this.fail('Shared AR could not start. Retry the connection.');
      }
      return;
    }
    this.update({ status: 'joining', message: 'Looking up room…' });
    const code = this.services.normaliseJoinCode(this.code);
    if (!code) {
      this.fail('Enter the six-character room code.');
      return;
    }
    try {
      const result = await bounded(this.services.lookupColocationRoom(this.config, code), 20000);
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
        source: this.services.cloudAnchorFrameSource(result.room.cloudAnchorId),
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
      !this.match.isAppActive() ||
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
      this.services.observeScanStatus?.(scan);
      if (!scan.available) {
        this.fail(
          'Shared AR is unavailable. Install the new development build with ReactVision configured.'
        );
        return;
      }
      const guidance = scanGuidance(scan, (Date.now() - this.scanStartedAt) / 1000);
      this.update({
        canFinish: guidance.canFinish,
        scanProgress: guidance.progress,
        message: guidance.message,
      });
    } catch {
      if (generation === this.generation)
        this.fail('Could not scan this space. Retry in good lighting.');
    } finally {
      if (generation === this.generation) this.scanPoll = false;
    }
  }
  finishScan = async () => {
    if (
      !this.navigator ||
      !this.match.isAppActive() ||
      !this.trackingNormal ||
      this.busy ||
      !this.view.preview ||
      !this.view.canFinish
    )
      return;
    this.busy = true;
    const generation = this.generation;
    const point = this.view.preview.position;
    this.update({
      status: 'hosting',
      canFinish: false,
      message: 'Creating your room. Keep the arena in view…',
    });
    try {
      const hosted = await bounded(this.navigator.finishScan(1), 60000);
      if (generation !== this.generation) return;
      const frame = this.services.parseLocationTransform(hosted.locationTransform);
      if (!hosted.success || !hosted.cloudAnchorId || !frame) {
        this.fail(hosted.error ?? 'The scan needs more detail. Try another angle.');
        return;
      }
      const created = await bounded(
        this.services.createColocationRoom(this.config, {
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
      this.match.setSharedPlacement(arenaInFrame(frame, point));
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
        status: 'ready',
        message: 'Room created. Invite your opponent with the QR or invite code.',
      });
    } catch {
      if (generation === this.generation) {
        this.cancel(this.navigator);
        this.fail('Could not host this space. Check the connection and retry.');
      }
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  };
  localized = (transform: string) => {
    if (this.disposed || !this.navigator) return;
    const frame = this.services.parseLocationTransform(transform);
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
    if (this.disposed || !this.navigator) return;
    if (this.view.status === 'aligning') this.update({ message });
  };
  place(point: [number, number, number]) {
    if (
      this.disposed ||
      !this.navigator ||
      this.match.mode !== 'host' ||
      this.room ||
      this.view.status !== 'placing' ||
      !this.trackingNormal ||
      !this.match.isAppActive() ||
      !point.every(Number.isFinite)
    )
      return false;
    this.update({ preview: { position: [...point], rotation: [0, 0, 0] } });
    void this.prepare(this.generation);
    return true;
  }
  reposition = () => {
    if (this.disposed || this.room || this.match.mode !== 'host' || !this.navigator) return;
    this.cancel(this.navigator);
    this.update({ preview: null });
    this.prepareAttachment();
  };
  fail = (message: string) => this.update({ status: 'error', message, canFinish: false });
  retry = () => {
    if (this.disposed) return;
    this.network?.retry();
    this.cancel(this.navigator);
    if (!this.navigator) return;
    this.prepareAttachment();
  };
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.detach();
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
    this.network?.close();
    this.network = null;
  }
}
