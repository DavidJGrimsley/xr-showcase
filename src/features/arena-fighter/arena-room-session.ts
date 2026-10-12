import type { ViroARSceneNavigator } from '@reactvision/react-viro';
import type { RoomView } from './arena-room-controller';
import type { ArenaSpace } from './arena-protocol';

export interface ArenaRoomSession {
  readonly space: ArenaSpace;
  subscribe: (fn: () => void) => () => void;
  getSnapshot: () => RoomView;
  start(): void;
  attach(nav: ViroARSceneNavigator['arSceneNavigator']): () => void;
  detach(): void;
  tracking(normal: boolean): void;
  place(point: [number, number, number]): boolean;
  localized(transform: string): void;
  progress(message: string): void;
  fail(message: string): void;
  retry(): void;
  prepareRestart(): boolean;
  reposition(): void;
  finishScan(): Promise<void>;
  cancelHosting(): void;
  dispose(): void;
}
