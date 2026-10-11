import type { ViroReplicationClient, ViroReplicationConfig } from '@reactvision/react-viro';
import { ArenaMatch } from './arena-match.ts';
import { validInput, validPacket, ARENA_PROTOCOL } from './arena-protocol.ts';
import { connectionMessage } from './arena-connection.ts';

export type ReplicationPort = Pick<
  ViroReplicationClient,
  | 'state'
  | 'localPeerId'
  | 'error'
  | 'get'
  | 'subscribe'
  | 'connect'
  | 'disconnect'
  | 'claim'
  | 'set'
  | 'release'
>;

/** Transport ownership and pacing are separate from combat. Tests supply a relay double. */
export class ArenaNetwork {
  private stop: () => void;
  private stopMatch: () => void;
  private phaseWriteQueued = false;
  private lastWrite = -Infinity;
  private claimed = false;
  private claiming = false;
  private lastStage = '';
  private lastOrientation = false;
  private lastImpact = '';
  private lastAudio = '';
  private lastPeer = -1;
  private opened: number;
  private closed = false;
  private code: string;
  private match: ArenaMatch;
  private client: ReplicationPort;
  private now: () => number;
  private seat: 'host' | 'guest';
  private rejected = false;
  private config: ViroReplicationConfig;
  private connectionState = '';
  private firstHostSerial = -1;
  private lastInput = '';
  private observe?: (state: ViroReplicationClient['state']) => void;

  constructor(
    match: ArenaMatch,
    client: ReplicationPort,
    config: ViroReplicationConfig,
    code: string,
    now = () => Date.now(),
    observe?: (state: ViroReplicationClient['state']) => void
  ) {
    this.match = match;
    this.client = client;
    this.code = code;
    this.now = now;
    this.opened = now();
    this.config = config;
    this.observe = observe;
    this.seat = match.mode === 'host' ? 'host' : 'guest';
    this.stop = client.subscribe(() => this.read());
    this.stopMatch = match.subscribe(() => {
      if (
        (match.getSnapshot().stage === this.lastStage &&
          match.getSnapshot().orientationPaused === this.lastOrientation &&
          this.impactKey() === this.lastImpact &&
          match.audioStateKey() === this.lastAudio &&
          match.inputStateKey() === this.lastInput) ||
        this.phaseWriteQueued
      )
        return;
      this.phaseWriteQueued = true;
      // Flush the complete transition after the controller finishes its current tick.
      queueMicrotask(() => {
        this.phaseWriteQueued = false;
        this.pump();
      });
    });
    client.connect(config);
  }
  private impactKey() {
    const snapshot = this.match.getSnapshot();
    return `${snapshot.blue.impact?.id ?? 0}:${snapshot.red.impact?.id ?? 0}`;
  }
  get failure() {
    return this.rejected;
  }
  get established() {
    const own = this.client.get(this.seat);
    return (
      this.claimed &&
      this.client.state === 'synced' &&
      own?.owner === this.client.localPeerId &&
      own.fields.clientId === this.match.clientId &&
      this.match.getSnapshot().connected
    );
  }
  private fail(message: string) {
    this.rejected = true;
    this.match.setNetwork(false, message, this.code);
  }
  retry() {
    if (this.closed) return;
    this.rejected = false;
    this.claimed = false;
    this.claiming = false;
    this.opened = this.now();
    this.firstHostSerial = -1;
    this.match.setNetwork(false, 'Reconnecting…', this.code);
    this.client.connect(this.config);
  }
  private read() {
    if (this.closed || this.rejected) return;
    const client = this.client;
    if (client.state !== this.connectionState) {
      this.connectionState = client.state;
      this.observe?.(client.state);
    }
    if (client.state !== 'synced') {
      this.claimed = false;
      this.claiming = false;
      this.match.setNetwork(false, connectionMessage(client.state, client.error), this.code);
      return;
    }
    if (this.match.space === 'remote' && this.seat === 'guest' && !this.match.session) {
      const host = client.get('host');
      const packet = host?.fields.packet;
      if (
        packet &&
        typeof packet === 'object' &&
        'protocol' in packet &&
        packet.protocol !== ARENA_PROTOCOL
      ) {
        this.fail('This room uses a different app version. Update both phones.');
        return;
      }
      if (validPacket(packet) && packet.space !== 'remote') {
        this.fail('This invite is for a same-table match.');
        return;
      }
      if (!host?.owner || !validPacket(packet)) {
        this.match.setNetwork(false, 'Waiting for a live host…', this.code);
        return;
      }
      if (packet.stage !== 'lobby') {
        this.fail('This long-distance invite is inactive. Ask your opponent to host a new match.');
        return;
      }
      if (this.firstHostSerial < 0) this.firstHostSerial = packet.serial;
      if (packet.serial <= this.firstHostSerial) return;
    }
    const own = client.get(this.seat);
    if (own?.fields.clientId && own.fields.clientId !== this.match.clientId) {
      this.fail(
        this.seat === 'guest' ? 'Room full.' : 'This hosting session is no longer available.'
      );
      return;
    }
    if (own?.owner && own.owner !== client.localPeerId) {
      this.fail('Room full.');
      return;
    }
    if (own?.owner !== client.localPeerId) {
      if (!this.claiming) {
        this.claiming = true;
        client.claim(this.seat, own ? { expectVersion: own.version } : undefined);
      }
      return;
    }
    this.claiming = false;
    this.claimed = true;
    const other = client.get(this.seat === 'host' ? 'guest' : 'host');
    if (this.seat === 'guest') {
      const packet = other?.fields.packet;
      if (
        packet &&
        typeof packet === 'object' &&
        'protocol' in packet &&
        packet.protocol !== ARENA_PROTOCOL
      ) {
        this.fail('This room uses a different app version. Update both phones.');
        return;
      }
      if (validPacket(packet) && packet.serial > this.lastPeer) {
        if (packet.space !== this.match.space) {
          this.fail('This invite uses a different play mode.');
          return;
        }
        this.lastPeer = packet.serial;
        this.opened = this.now();
        this.match.receivePacket(packet);
      }
      if (!validPacket(packet) || !other?.owner) {
        this.match.setNetwork(false, 'Waiting for the host…', this.code);
        return;
      }
    } else {
      const input = other?.fields.input;
      if (
        input &&
        typeof input === 'object' &&
        'protocol' in input &&
        input.protocol !== ARENA_PROTOCOL
      ) {
        this.fail('This room uses a different app version. Update both phones.');
        return;
      }
      if (validInput(input) && input.serial > this.lastPeer) {
        if (input.space !== this.match.space) {
          this.fail('This invite uses a different play mode.');
          return;
        }
        this.lastPeer = input.serial;
        this.match.receiveInput(input);
      }
    }
    this.match.setNetwork(true, '', this.code);
  }
  pump = () => {
    if (this.closed || this.rejected) return;
    this.match.poll();
    if (
      this.seat === 'guest' &&
      this.client.state === 'synced' &&
      this.claimed &&
      this.now() - this.opened > 30000 &&
      this.match.getSnapshot().stage === 'lobby'
    ) {
      this.fail('The host isn’t connected. Ask them to tap Retry connection, then retry joining.');
      return;
    }
    if (!this.claimed || this.client.state !== 'synced') return;
    const stage = this.match.getSnapshot().stage;
    const orientation = this.match.getSnapshot().orientationPaused;
    if (
      this.now() - this.lastWrite < 50 &&
      stage === this.lastStage &&
      orientation === this.lastOrientation &&
      this.impactKey() === this.lastImpact &&
      this.match.audioStateKey() === this.lastAudio &&
      this.match.inputStateKey() === this.lastInput
    )
      return;
    this.lastWrite = this.now();
    this.lastAudio = this.match.audioStateKey();
    this.lastInput = this.match.inputStateKey();
    this.lastStage = stage;
    this.lastOrientation = orientation;
    this.lastImpact = this.impactKey();
    this.client.set(
      this.seat,
      this.seat === 'host'
        ? { clientId: this.match.clientId, packet: this.match.packet() }
        : { clientId: this.match.clientId, input: this.match.input() }
    );
  };
  close = () => {
    if (this.closed) return;
    if (this.claimed && this.client.state === 'synced') {
      this.match.abandon('Match ended. No winner awarded.');
      this.client.set(
        this.seat,
        this.seat === 'host'
          ? { clientId: this.match.clientId, packet: this.match.packet() }
          : { clientId: this.match.clientId, input: this.match.input() }
      );
    }
    this.closed = true;
    this.stop();
    this.stopMatch();
    // WebSocket preserves the final write before the close frame.
    this.client.disconnect();
  };
}
