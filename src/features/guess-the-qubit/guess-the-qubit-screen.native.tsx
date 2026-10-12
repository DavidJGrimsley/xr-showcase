import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GameText } from '@/ui/game-text';
import { GameProgress } from '@/ui/game-progress';
import { GameConfirmSheet } from '@/ui/game-confirm-sheet';
import { Button, Column, Host, Picker, Row, Spacer, Text as NativeText } from '@expo/ui';
import { fixedSize } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router/stack';
import ARSessionBoundary from '@/ui/game-ar-boundary';
import type { ARActiveOverlayContext } from '@/features/ar/ar-session-types';
import { useQubitConfiguration } from './use-qubit-configuration.native';
import { qubitPresentation } from './qubit-presentation';
import { canGuessQubit, type QubitSnapshot } from './qubit-round-controller';
import { QubitInfoButton, QubitInfoModal } from './qubit-info.native';
import { QubitTransformControls } from './qubit-transform-controls.native';

const QubitNavigator = lazy(() => import('./qubit-navigator.native'));
type Configuration = ReturnType<typeof useQubitConfiguration>;

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
    <View style={styles.status}>
      {display.spinning ? <GameProgress label="Waiting for the result" color="#93f5c5" /> : null}
      <GameText accessibilityLiveRegion="polite" centered color={color} style={{ flex: 1 }}>
        {display.status}
      </GameText>
    </View>
  );
}

function QubitModeAndTransform({
  controller,
  state,
  onTransform,
  width,
}: {
  controller: Configuration['controller'];
  state: QubitSnapshot;
  onTransform: () => void;
  width: number;
}) {
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale > 1.3 || width < 250;
  const modePicker = (
    <Column
      alignment="center"
      modifiers={
        Platform.OS === 'ios' ? [fixedSize({ horizontal: true, vertical: false })] : undefined
      }>
      <Picker
        testID="qubit-mode"
        selectedValue={state.mode}
        enabled={['idle', 'complete', 'error'].includes(state.phase)}
        onValueChange={(mode) => controller.setMode(mode as 'simulator' | 'hardware')}>
        <Picker.Item label="Simulator" value="simulator" />
        <Picker.Item label="Hardware" value="hardware" />
      </Picker>
    </Column>
  );
  const transformButton = (
    <Button
      testID="qubit-transform"
      label="Transform"
      variant="outlined"
      onPress={onTransform}
      style={{ height: Math.max(48, 17 * fontScale + 20) }}
    />
  );
  return stacked ? (
    <Column spacing={10} alignment="center" style={{ width }}>
      {modePicker}
      {transformButton}
    </Column>
  ) : (
    <Row spacing={0} alignment="center" style={{ width }}>
      {modePicker}
      <Spacer flexible size={12} />
      {transformButton}
    </Row>
  );
}

function QubitRoundButton({
  label,
  disabled,
  onPress,
  testID,
  height,
  width,
  fontSize,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
  testID: string;
  height: number;
  width?: number;
  fontSize: number;
}) {
  return (
    <Button
      testID={testID}
      disabled={disabled}
      variant={disabled ? 'outlined' : 'filled'}
      onPress={disabled ? undefined : onPress}
      style={{ height, ...(width ? { width } : {}), opacity: disabled ? 0.4 : 1 }}>
      <NativeText
        textStyle={{ fontSize, fontWeight: 'bold', color: disabled ? '#94a3b8' : '#10231c' }}>
        {label}
      </NativeText>
    </Button>
  );
}

function QubitMainControls({
  controller,
  state,
  context,
  now,
  guessHint,
  controlsWidth,
  onTransform,
  onReset,
}: {
  controller: Configuration['controller'];
  state: QubitSnapshot;
  context: ARActiveOverlayContext;
  now: number;
  guessHint: string;
  controlsWidth: number;
  onTransform: () => void;
  onReset: () => void;
}) {
  const { fontScale, width } = useWindowDimensions();
  const disabled = !canGuessQubit(state, now);
  const resetDisabled = state.phase === 'idle' && !state.uncertainSubmission;
  const actionHeight = Math.max(48, 17 * fontScale + 20);
  const guessWidth = Math.max(80, 24 * fontScale + 40);
  // SwiftUI's explicit point size needs scaling; Compose's sp already follows fontScale.
  const guessFontSize = Platform.OS === 'ios' ? 24 * fontScale : 24;
  const Actions = fontScale > 1.3 || width < 360 ? Column : Row;
  const Guesses = 2 * guessWidth + 24 > controlsWidth ? Column : Row;
  const restart = () => {
    if (controller.getSessionId() !== context.sessionId) return;
    controller.restart(context.sessionId);
    context.restartAR();
  };
  return (
    <Host
      matchContents={{ vertical: true }}
      colorScheme="dark"
      seedColor="#93f5c5"
      style={{ width: '100%' }}>
      <Column spacing={10} alignment="center" style={{ width: controlsWidth }}>
        <QubitModeAndTransform
          controller={controller}
          state={state}
          onTransform={onTransform}
          width={controlsWidth}
        />
        <Guesses spacing={24} alignment="center">
          {[0, 1].map((bit) => (
            <QubitRoundButton
              key={bit}
              testID={`qubit-guess-${bit}`}
              label={String(bit)}
              disabled={disabled}
              onPress={() => controller.guess(bit as 0 | 1)}
              height={Math.max(48, 24 * fontScale + 20)}
              width={guessWidth}
              fontSize={guessFontSize}
            />
          ))}
        </Guesses>
        {guessHint ? (
          <NativeText
            testID="qubit-tracking-caption"
            style={{ width: controlsWidth }}
            textStyle={{
              fontSize: Platform.OS === 'ios' ? 13 * fontScale : 13,
              color: '#fde68a',
              textAlign: 'center',
            }}>
            {guessHint}
          </NativeText>
        ) : null}
        <Actions spacing={10} alignment="center">
          <QubitRoundButton
            testID="qubit-reset"
            label="Reset Qubit"
            disabled={resetDisabled}
            onPress={onReset}
            height={actionHeight}
            fontSize={Platform.OS === 'ios' ? 17 * fontScale : 17}
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

function QubitControls({
  controller,
  state,
  context,
  now,
  guessHint,
}: {
  controller: Configuration['controller'];
  state: QubitSnapshot;
  context: ARActiveOverlayContext;
  now: number;
  guessHint: string;
}) {
  const { width, fontScale } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const [transformRevision, setTransformRevision] = useState<number | null>(null);
  const [resetRound, setResetRound] = useState<number | null>(null);
  const controlsWidth = measuredWidth || Math.max(1, Math.min(width, 720) - 72);
  return (
    <View
      style={{ width: '100%' }}
      onLayout={(event) => setMeasuredWidth(event.nativeEvent.layout.width)}>
      {transformRevision === state.placementRevision ? (
        <QubitTransformControls
          controller={controller}
          state={state}
          scope={{
            sessionId: context.sessionId,
            placementRevision: state.placementRevision,
            roundId: state.roundId,
          }}
          stacked={fontScale > 1.3 || controlsWidth < 230}
          onDone={() => setTransformRevision(null)}
        />
      ) : (
        <QubitMainControls
          controller={controller}
          state={state}
          context={context}
          now={now}
          guessHint={guessHint}
          controlsWidth={controlsWidth}
          onTransform={() => setTransformRevision(state.placementRevision)}
          onReset={() => {
            if (controller.getSnapshot().uncertainSubmission) setResetRound(state.roundId);
            else controller.reset();
          }}
        />
      )}
      <GameConfirmSheet
        isPresented={resetRound === state.roundId}
        onDismiss={() => setResetRound(null)}
        onConfirm={() => {
          setResetRound(null);
          // A sheet left open across AR/round recreation cannot reset a later round.
          if (
            controller.getSessionId() !== context.sessionId ||
            controller.getSnapshot().roundId !== resetRound
          )
            return;
          controller.reset();
          controller.acknowledgeUnknown();
        }}
      />
    </View>
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
  const { fontScale } = useWindowDimensions();
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const retryAt = Math.max(state.retryAt, configuration.retryAt);
    if (!retryAt) return;
    const timer = setInterval(() => {
      const time = Date.now();
      setNow(time);
      if (time >= retryAt) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [state.retryAt, configuration.retryAt]);
  const display = qubitPresentation(state, message, busy, now, configuration);
  const retry = display.retryConnection ? (
    <Host
      matchContents={{ vertical: true }}
      colorScheme="dark"
      seedColor="#93f5c5"
      style={{ width: '100%' }}>
      <Column alignment="center">
        <Button
          testID="qubit-retry-connection"
          label="Retry connection"
          variant="outlined"
          disabled={display.retryDisabled}
          onPress={() => configuration.retryConnection()}
          style={{ height: Math.max(48, 17 * fontScale + 20) }}
        />
      </Column>
    </Host>
  ) : null;
  if (!state.placed)
    return (
      <View style={[styles.panel, { paddingVertical: 12 }]}>
        <GameText centered>{display.caption}</GameText>
        <QubitStatus display={display} outcome={null} />
        {retry}
      </View>
    );
  return (
    <View style={styles.panel}>
      {display.caption ? (
        <GameText centered fontSize={14} color="#cbd5e1">
          {display.caption}
        </GameText>
      ) : null}
      <QubitStatus display={display} outcome={state.outcome} />
      {retry}
      <QubitControls
        controller={controller}
        state={state}
        context={context}
        now={now}
        guessHint={display.guessHint}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  status: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  panel: { gap: 12, borderRadius: 16, padding: 16, backgroundColor: '#10191fe6' },
});
export default function GuessTheQubitScreen() {
  const configuration = useQubitConfiguration();
  const [infoOpen, setInfoOpen] = useState(false);
  const openInfo = () => {
    const state = configuration.controller.getSnapshot();
    // Reading the modal leaves active waiting; use the existing bounded cancellation path.
    if (state.mode === 'hardware' && ['intro', 'waiting', 'paused'].includes(state.phase)) {
      configuration.controller.reset();
    }
    setInfoOpen(true);
  };
  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () =>
            Platform.OS === 'ios' ? null : <QubitInfoButton onPress={openInfo} />,
          headerBackButtonDisplayMode: 'minimal',
        }}
      />
      {Platform.OS === 'ios' ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon="info.circle"
            accessibilityLabel="About Guess the Qubit"
            accessibilityHint="Explains qubits, the Bloch vector, and the circuit"
            hidesSharedBackground
            onPress={openInfo}
          />
        </Stack.Toolbar>
      ) : null}
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
      <QubitInfoModal isPresented={infoOpen} onDismiss={() => setInfoOpen(false)} />
    </>
  );
}
