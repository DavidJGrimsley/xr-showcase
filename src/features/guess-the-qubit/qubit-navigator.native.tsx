import { useEffect, useSyncExternalStore } from 'react';
import { ViroARSceneNavigator } from '@reactvision/react-viro';
import QubitScene, { type QubitSceneProps } from './qubit-scene.native';

// Viro supplies sceneNavigator at runtime; initialScene omits it from its component type.
const initialScene = { scene: QubitScene as () => React.JSX.Element };
export default function QubitNavigator({ context, controller }: QubitSceneProps) {
  const sessionId = useSyncExternalStore(controller.subscribe, controller.getSessionId);
  useEffect(() => {
    controller.attach(context.sessionId);
    return () => controller.detach(context.sessionId);
  }, [controller, context.sessionId]);
  // Native tracking can report ready immediately. Attach the round scope before mounting Viro.
  if (sessionId !== context.sessionId) return null;
  return (
    <ViroARSceneNavigator
      style={{ flex: 1 }}
      provider="none"
      autofocus
      initialScene={initialScene}
      viroAppProps={{ context, controller }}
    />
  );
}
