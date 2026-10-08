import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Alert, Platform, Text, useWindowDimensions, View } from 'react-native';
import { Button, Column, Host, Picker, Row, Text as NativeText } from '@expo/ui';
import { Stack } from 'expo-router/stack';
import ARSessionBoundary from '@/features/ar/ar-session-boundary';
import type { ARActiveOverlayContext } from '@/features/ar/ar-session-types';
import { useQubitConfiguration } from './use-qubit-configuration.native';
import { qubitPresentation } from './qubit-presentation';
import { MAX_SPHERE_SCALE, MIN_SPHERE_SCALE, type QubitSnapshot } from './qubit-round-controller';

const QubitNavigator = lazy(() => import('./qubit-navigator.native'));
type Configuration = ReturnType<typeof useQubitConfiguration>;

function resetQubit(controller: Configuration['controller']) {
  if (!controller.getSnapshot().uncertainSubmission) {
    controller.reset();
    return;
  }
  Alert.alert(
    'Submission interrupted',
    'The service did not confirm the job. It may still run. Start a new round?',
    [
      { text: 'Wait', style: 'cancel' },
      {
        text: 'Reset Qubit',
        onPress: () => {
          controller.reset();
          controller.acknowledgeUnknown();
        },
      },
    ]
  );
}

function QubitStatus({
  display,
  outcome,
}: {
  display: ReturnType<typeof qubitPresentation>;
  outcome: QubitSnapshot['outcome'];
}) {
  if (!display.status) return null;
  const outcomeColor = outcome && { won: '#86efac', lost: '#fca5a5' }[outcome];
  const color = display.warning ? '#fde68a' : outcomeColor || '#e2e8f0';
  return (
    <View className="flex-row items-center justify-center gap-2">
      {display.spinning ? (
        <ActivityIndicator accessibilityLabel="Waiting for the result" color="#93f5c5" />
      ) : null}
      <Text
        accessibilityLiveRegion="polite"
        className="shrink text-center text-base"
        style={{ color }}>
        {display.status}
      </Text>
    </View>
  );
}

function QubitModeAndSize({
  controller,
  state,
  sessionId,
}: {
  controller: Configuration['controller'];
  state: QubitSnapshot;
  sessionId: number;
}) {
  const { fontScale, width } = useWindowDimensions();
  const Layout = fontScale > 1.3 || width < 360 ? Column : Row;
  return (
    <Layout spacing={10} alignment="center">
      <Picker
        testID="qubit-mode"
        selectedValue={state.mode}
        enabled={['idle', 'complete', 'error'].includes(state.phase)}
        onValueChange={(mode) => controller.setMode(mode as 'simulator' | 'hardware')}>
        <Picker.Item label="Simulator" value="simulator" />
        <Picker.Item label="Hardware Jobs" value="hardware" />
      </Picker>
      <Row spacing={8} alignment="center">
        {([-1, 1] as const).map((direction) => {
          const disabled =
            direction === -1
              ? state.sphereScale <= MIN_SPHERE_SCALE
              : state.sphereScale >= MAX_SPHERE_SCALE;
          return (
            <Button
              key={direction}
              testID={direction === -1 ? 'qubit-size-smaller' : 'qubit-size-larger'}
              label={direction === -1 ? '−' : '+'}
              disabled={disabled}
              variant="outlined"
              style={{
                width: 48,
                height: Math.max(48, 17 * fontScale + 20),
                opacity: disabled ? 0.35 : 1,
              }}
              onPress={() => controller.adjustSphereScale(sessionId, direction)}
            />
          );
        })}
      </Row>
    </Layout>
  );
}

function QubitControls({
  controller,
  state,
  context,
}: {
  controller: Configuration['controller'];
  state: QubitSnapshot;
  context: ARActiveOverlayContext;
}) {
  const { fontScale, width } = useWindowDimensions();
  const disabled = !controller.canGuess();
  const resetDisabled = state.phase === 'idle' && !state.uncertainSubmission;
  const actionHeight = Math.max(48, 17 * fontScale + 20);
  const guessWidth = Math.max(80, 24 * fontScale + 40);
  // SwiftUI's explicit point size needs scaling; Compose's sp already follows fontScale.
  const guessFontSize = Platform.OS === 'ios' ? 24 * fontScale : 24;
  const Actions = fontScale > 1.3 || width < 360 ? Column : Row;
  const Guesses = 2 * guessWidth + 24 > width - 72 ? Column : Row;
  const restart = () => {
    if (controller.getSessionId() !== context.sessionId) return;
    controller.detach(context.sessionId);
    context.restartAR();
  };
  return (
    <Host
      matchContents
      colorScheme="dark"
      seedColor="#93f5c5"
      style={{ alignSelf: 'center', maxWidth: '100%' }}>
      <Column spacing={10} alignment="center">
        <QubitModeAndSize controller={controller} state={state} sessionId={context.sessionId} />
        <Guesses spacing={24} alignment="center">
          {[0, 1].map((bit) => (
            <Button
              key={bit}
              testID={`qubit-guess-${bit}`}
              disabled={disabled}
              variant={disabled ? 'outlined' : 'filled'}
              onPress={() => controller.guess(bit as 0 | 1)}
              style={{
                height: Math.max(48, 24 * fontScale + 20),
                width: guessWidth,
                opacity: disabled ? 0.4 : 1,
              }}>
              <NativeText
                textStyle={{
                  fontSize: guessFontSize,
                  fontWeight: 'bold',
                  color: disabled ? '#94a3b8' : '#10231c',
                }}>
                {String(bit)}
              </NativeText>
            </Button>
          ))}
        </Guesses>
        <Actions spacing={10} alignment="center">
          <Button
            label="Reset Qubit"
            disabled={resetDisabled}
            variant="outlined"
            onPress={() => resetQubit(controller)}
            style={{ height: actionHeight, opacity: resetDisabled ? 0.4 : 1 }}
          />
          <Button
            label="Restart AR"
            variant="outlined"
            onPress={restart}
            style={{ height: actionHeight }}
          />
        </Actions>
      </Column>
    </Host>
  );
}

function QubitHUD({
  context,
  configuration,
}: {
  context: ARActiveOverlayContext;
  configuration: Configuration;
}) {
  const { controller, busy, message } = configuration;
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (Date.now() >= state.retryAt) return;
    const timer = setInterval(() => {
      const time = Date.now();
      setNow(time);
      if (time >= state.retryAt) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [state.retryAt]);
  const display = qubitPresentation(state, message, busy, now);
  if (!state.placed)
    return (
      <View className="rounded-2xl px-4 py-3" style={{ backgroundColor: '#10191fe6' }}>
        <Text className="text-center text-base" style={{ color: '#e2e8f0' }}>
          {display.caption}
        </Text>
      </View>
    );
  return (
    <View className="gap-3 rounded-2xl p-4" style={{ backgroundColor: '#10191fe6' }}>
      {display.caption ? (
        <Text className="text-center text-sm" style={{ color: '#cbd5e1' }}>
          {display.caption}
        </Text>
      ) : null}
      <QubitStatus display={display} outcome={state.outcome} />
      <QubitControls controller={controller} state={state} context={context} />
    </View>
  );
}
export default function GuessTheQubitScreen() {
  const configuration = useQubitConfiguration();
  return (
    <>
      <Stack.Screen options={{ headerRight: () => null, headerBackButtonDisplayMode: 'minimal' }} />
      <ARSessionBoundary
        renderNavigator={(context) => (
          <Suspense fallback={null}>
            <QubitNavigator context={context} controller={configuration.controller} />
          </Suspense>
        )}
        renderActiveOverlay={(context) => (
          <QubitHUD key={context.sessionId} context={context} configuration={configuration} />
        )}
      />
    </>
  );
}
