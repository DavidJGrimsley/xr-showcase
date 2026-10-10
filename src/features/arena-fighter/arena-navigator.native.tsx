import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { ViroARSceneNavigator } from '@reactvision/react-viro';

import type { ARSceneContext } from '@/features/ar/ar-session-types';

import { ArenaMatch } from './arena-match';
import type { ArenaRoom } from './arena-room.native';
import ArenaScene from './arena-scene.native';

export interface ArenaSceneBinding {
  controller: ArenaMatch;
  room?: ArenaRoom;
  context: ARSceneContext;
  token: number;
}

const initialScene = { scene: ArenaScene as () => React.JSX.Element };

export default function ArenaNavigator({
  controller,
  context,
  room,
}: {
  controller: ArenaMatch;
  context: ARSceneContext;
  room?: ArenaRoom;
}) {
  const token = useSyncExternalStore(controller.subscribe, controller.getSessionToken);
  useLayoutEffect(() => {
    const lease = controller.attachSession(context.sessionId);
    return () => {
      // Cancel while the descendant Viro navigator still has its native view.
      room?.detach();
      controller.detachSession(lease);
    };
  }, [controller, context.sessionId, room]);
  const binding = useMemo(
    () => ({ controller, context, token: token!, room }),
    [controller, context, token, room]
  );
  if (token === null) return null;

  return (
    <ViroARSceneNavigator
      style={{ flex: 1 }}
      initialScene={initialScene}
      viroAppProps={binding}
      provider={room ? 'reactvision' : 'none'}
      autofocus
      hdrEnabled
      bloomEnabled={false}
    />
  );
}
