import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { router } from 'expo-router';
import { useIsFocused } from 'expo-router/react-navigation';
import { AppState, Linking, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme/provider';

import { nativeARRuntime } from './ar-runtime.native';
import { ARSessionController } from './ar-session-controller';
import type { ARSceneContext, ARSessionBoundaryProps } from './ar-session-types';
import ARStatusPanel from './ar-status-panel';

function subscribeAppState(listener: () => void) {
  const subscription = AppState.addEventListener('change', listener);
  return () => subscription.remove();
}

class SceneErrorBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const NativeNavigator = lazy(() => import('./native-ar-navigator.native'));

function SceneRenderer({
  context,
  renderNavigator,
}: ARSessionBoundaryProps & { context: ARSceneContext }) {
  return renderNavigator ? (
    renderNavigator(context)
  ) : (
    <Suspense fallback={null}>
      <NativeNavigator context={context} />
    </Suspense>
  );
}

export default function ARSessionBoundary({ renderNavigator }: ARSessionBoundaryProps) {
  const { activeColors: colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const appState = useSyncExternalStore(subscribeAppState, () => AppState.currentState);
  const enabled = focused && appState === 'active';
  const [controller] = useState(() => new ARSessionController(nativeARRuntime));
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [settingsError, setSettingsError] = useState(false);

  useEffect(() => {
    controller.setActive(enabled);
    return () => controller.setActive(false);
  }, [controller, enabled]);

  const context = useMemo<ARSceneContext>(
    () => ({
      sessionId: snapshot.sessionId,
      onReady: () => controller.reportReady(snapshot.sessionId),
      onInstruction: (instruction) => controller.reportInstruction(snapshot.sessionId, instruction),
      onError: () => controller.reportError(snapshot.sessionId),
    }),
    [controller, snapshot.sessionId]
  );

  const home = () => {
    controller.setActive(false);
    router.dismissTo('/');
  };
  const openSettings = () => {
    setSettingsError(false);
    void Linking.openSettings().catch(() => setSettingsError(true));
  };
  const mounting = enabled && ['starting', 'running'].includes(snapshot.status);
  const loading = ['checking', 'requesting', 'waiting', 'starting'].includes(snapshot.status);
  const title =
    snapshot.status === 'running'
      ? 'Surface test'
      : snapshot.status === 'denied' || snapshot.status === 'permission'
        ? 'Camera access'
        : snapshot.status === 'error'
          ? 'AR needs another try'
          : snapshot.status === 'unsupported' || snapshot.status === 'missing-native'
            ? 'AR unavailable'
            : snapshot.status === 'inactive'
              ? 'AR paused'
              : 'Preparing AR';
  const actions = [];
  if (['permission', 'denied'].includes(snapshot.status)) {
    actions.push({ label: 'Enable camera', onPress: () => void controller.requestCamera() });
    actions.push({ label: 'Open Settings', onPress: openSettings });
  }
  if (['error', 'unsupported', 'missing-native', 'running'].includes(snapshot.status)) {
    actions.push({
      label: snapshot.status === 'running' ? 'Restart AR' : 'Retry',
      onPress: controller.retry,
    });
  }
  actions.push({ label: 'Home', onPress: home });

  const panel = (
    <ARStatusPanel
      title={title}
      message={
        settingsError && ['permission', 'denied'].includes(snapshot.status)
          ? 'Settings could not open. Allow camera access in device Settings.'
          : snapshot.instruction || 'AR starts when this screen is active.'
      }
      loading={loading}
      actions={actions}
    />
  );

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      {mounting ? (
        <SceneErrorBoundary key={snapshot.sessionId} onError={context.onError}>
          <SceneRenderer context={context} renderNavigator={renderNavigator} />
        </SceneErrorBoundary>
      ) : null}
      <View
        pointerEvents="box-none"
        className={mounting ? 'absolute inset-0 justify-end' : 'flex-1'}>
        <ScrollView
          className={mounting ? 'max-h-[55%]' : 'flex-1'}
          style={mounting ? { flexGrow: 0 } : undefined}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerClassName="grow justify-center px-5 pt-5"
          contentContainerStyle={{
            paddingBottom: Math.max(20, insets.bottom),
            paddingLeft: Math.max(20, insets.left),
            paddingRight: Math.max(20, insets.right),
          }}>
          <View className="items-center">
            <View className="w-full max-w-[720px]">{panel}</View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
