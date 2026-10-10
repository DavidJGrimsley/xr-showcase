import {
  ViroReplicationClient,
  createColocationRoom,
  lookupColocationRoom,
  normaliseJoinCode,
  formatJoinCode,
  cloudAnchorFrameSource,
  parseLocationTransform,
} from '@reactvision/react-viro';
import type { ArenaMatch } from './arena-match';
import { ArenaRoom as RoomController } from './arena-room-controller';
import type { ArenaConfiguration } from './arena-configuration';
export type { RoomView } from './arena-room-controller';

export class ArenaRoom extends RoomController {
  constructor(match: ArenaMatch, config: ArenaConfiguration, code = '') {
    super(match, config, code, {
      createReplicationClient: () => new ViroReplicationClient(),
      createColocationRoom,
      lookupColocationRoom,
      normaliseJoinCode,
      formatJoinCode,
      cloudAnchorFrameSource,
      parseLocationTransform,
      observeConnectionState: __DEV__
        ? (state) => console.log('[Arena connection]', { state })
        : undefined,
      observeHosting: __DEV__ ? (event) => console.log('[Arena sharing]', event) : undefined,
      observeScanStatus: __DEV__
        ? (scan) =>
            console.log('[Arena scan]', {
              frames: scan.keyframes,
              frameMinimum: scan.minKeyframes,
              pairs: scan.viewpointPairs,
              pairMinimum: scan.minViewpointPairs,
              spread: scan.cameraSpreadMeters,
              spreadMinimum: scan.minSpreadMeters,
              points: scan.triangulatedPoints,
              pointMinimum: scan.minTriangulatedPoints,
              gates: [scan.meetsKeyframes, scan.meetsViewpointPairs, scan.meetsSpread],
            })
        : undefined,
    });
  }
}
