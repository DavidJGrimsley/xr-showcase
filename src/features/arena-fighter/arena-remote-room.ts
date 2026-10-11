import type { ArenaMatch } from './arena-match.ts';
import { ArenaNetwork, type ReplicationPort } from './arena-network.ts';
import type { ArenaConfiguration } from './arena-configuration';
import type { ArenaRoomSession } from './arena-room-session';
import type { RoomView } from './arena-room-controller';
import { formatRemoteCode, remoteRoomId } from './arena-invite.ts';
import { RELAY_UNREACHABLE } from './arena-connection.ts';

/** A remote room owns its socket independently of the camera or local placement. */
export class ArenaRemoteRoom implements ArenaRoomSession {
  readonly space = 'remote' as const;
  private network: ArenaNetwork | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private stopMatch: (() => void) | null = null;
  private attached = false;
  private attachment = 0;
  private normal = false;
  private disposed = false;
  private listeners = new Set<() => void>();
  private view: RoomView = {
    status: 'joining',
    message: 'Connecting long-distance match…',
    canFinish: false,
    scanProgress: 0,
    hostStep: null,
    hostSeconds: 0,
    preview: null,
    source: null,
    frame: null,
    repositioning: false,
  };
  private match: ArenaMatch;
  private config: ArenaConfiguration;
  readonly code: string;
  private client: ReplicationPort;
  private observe?: (state: ReplicationPort['state']) => void;
  constructor(
    match: ArenaMatch,
    config: ArenaConfiguration,
    code: string,
    client: ReplicationPort,
    observe?: (state: ReplicationPort['state']) => void
  ) {
    this.match = match;
    this.config = config;
    this.code = code;
    this.client = client;
    this.observe = observe;
  }
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  getSnapshot = () => this.view;
  private update(change: Partial<RoomView>) {
    const next = { ...this.view, ...change };
    if (JSON.stringify(next) === JSON.stringify(this.view)) return;
    this.view = next;
    this.listeners.forEach((fn) => fn());
  }
  start() {
    if (this.disposed || this.network) return;
    this.stopMatch = this.match.subscribe(() => this.sync());
    this.network = new ArenaNetwork(
      this.match,
      this.client,
      {
        ...this.config,
        endpoint: this.config.replicationEndpoint,
        roomId: remoteRoomId(this.code),
      },
      formatRemoteCode(this.code),
      () => Date.now(),
      this.observe
    );
    this.timer = setInterval(() => {
      this.network?.pump();
      this.sync();
    }, 50);
    this.sync();
  }
  private sync() {
    if (this.disposed) return;
    const state = this.match.getSnapshot();
    if (this.network?.failure || state.stage === 'abandoned') {
      this.update({ status: 'error', message: state.networkMessage });
    } else if (!state.connected) {
      this.update({
        status: 'joining',
        message: state.networkMessage || 'Connecting long-distance match…',
      });
    } else {
      this.update({
        status: this.view.preview ? 'ready' : 'placing',
        message: this.view.preview
          ? 'Your arena is placed. Both players must Ready.'
          : 'Tap a blue surface on your own table to place the arena.',
      });
    }
  }
  async open(signal: AbortSignal) {
    if (signal.aborted) throw new Error('Connection check cancelled');
    this.start();
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let stop: (() => void) | undefined;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
        stop?.();
        if (error) {
          this.dispose();
          reject(error);
        } else resolve();
      };
      const abort = () => finish(new Error('Connection check cancelled'));
      const timer = setTimeout(
        () =>
          finish(
            new Error(
              this.client.state === 'synced' && this.match.mode === 'guest'
                ? 'This long-distance invite is inactive. Ask your opponent to host a new match.'
                : RELAY_UNREACHABLE
            )
          ),
        20000
      );
      const check = () => {
        if (this.network?.failure || this.client.state === 'failed')
          finish(new Error(this.match.getSnapshot().networkMessage));
        else if (this.network?.established) finish();
      };
      signal.addEventListener('abort', abort, { once: true });
      stop = this.client.subscribe(check);
      check();
      if (signal.aborted) abort();
    });
  }
  attach(_nav: Parameters<ArenaRoomSession['attach']>[0]) {
    this.detach();
    const attachment = ++this.attachment;
    this.attached = true;
    this.update({ preview: null, repositioning: false });
    this.sync();
    return () => {
      if (attachment === this.attachment) this.detach();
    };
  }
  detach() {
    this.attachment++;
    this.attached = this.normal = false;
    this.update({ preview: null });
  }
  tracking(normal: boolean) {
    this.normal = normal;
  }
  place(point: [number, number, number]) {
    const state = this.match.getSnapshot();
    if (
      this.disposed ||
      !this.attached ||
      !this.normal ||
      !this.match.isAppActive() ||
      !this.match.isLandscape() ||
      !['lobby', 'finished', 'paused'].includes(state.stage) ||
      (this.view.preview && !this.view.repositioning) ||
      !point.every(Number.isFinite)
    )
      return false;
    this.match.invalidatePlacementReady();
    this.match.setTransformLocked(false);
    this.update({ preview: { position: [...point], rotation: [0, 0, 0] }, repositioning: false });
    this.sync();
    return true;
  }
  prepareRestart = () => {
    this.detach();
    return true;
  };
  reposition = () => {
    if (this.disposed || !this.attached || !this.match.canTransform()) return;
    this.update({ preview: null, repositioning: true, status: 'placing' });
    this.match.invalidatePlacementReady();
    this.match.setTransformLocked(true);
    this.sync();
  };
  retry = () => {
    this.network?.retry();
    this.sync();
  };
  fail = (message: string) => this.update({ status: 'error', message });
  localized(_transform: string) {}
  progress(_message: string) {}
  finishScan = async () => {};
  cancelHosting = () => {};
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.timer) clearInterval(this.timer);
    this.stopMatch?.();
    this.network?.close();
    this.detach();
  }
}
