import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { ViroARSceneNavigator } from '@reactvision/react-viro';

import type { ARSceneContext } from '@/features/ar/ar-session-types';

import { ArenaController } from './arena-controller';
import ArenaScene from './arena-scene.native';

export interface ArenaSceneBinding {
  controller: ArenaController;
  context: ARSceneContext;
  token: number;
}

const initialScene = { scene: ArenaScene as () => React.JSX.Element };

export default function ArenaNavigator({
  controller,
  context,
}: {
  controller: ArenaController;
  context: ARSceneContext;
}) {
  const token = useSyncExternalStore(controller.subscribe, controller.getSessionToken);
  useEffect(() => {
    const lease = controller.attachSession(context.sessionId);
    return () => controller.detachSession(lease);
  }, [controller, context.sessionId]);
  const binding = useMemo(
    () => ({ controller, context, token: token! }),
    [controller, context, token]
  );
  if (token === null) return null;

  return (
    <ViroARSceneNavigator
      style={{ flex: 1 }}
      initialScene={initialScene}
      viroAppProps={binding}
      provider="none"
      autofocus
      hdrEnabled
      bloomEnabled={false}
    />
  );
}
