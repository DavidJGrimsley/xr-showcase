import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Text, useWindowDimensions, View } from 'react-native';
import { Button, Column, Host, Picker, Row } from '@expo/ui';
import ARSessionBoundary from '@/features/ar/ar-session-boundary';
import type { ARActiveOverlayContext } from '@/features/ar/ar-session-types';
import { useQubitConfiguration } from './use-qubit-configuration.native';

import type { QubitSnapshot } from './qubit-round-controller';

const QubitNavigator = lazy(() => import('./qubit-navigator.native'));
type Configuration = ReturnType<typeof useQubitConfiguration>;

function QubitStatus({
  state,
  busy,
  message,
  instruction,
  coolUntil,
  now,
}: {
  state: QubitSnapshot;
  busy: boolean;
  message: string;
  instruction: string;
  coolUntil: number;
  now: number;
}) {
  const statusColor =
    state.outcome === 'won' ? '#86efac' : state.outcome === 'lost' ? '#fca5a5' : '#fff1da';
  return (
    <>
      <Text className="text-sm" style={{ color: '#cbd5e1' }}>
        {instruction}
      </Text>
      <Text
        accessibilityLiveRegion="polite"
        className="text-lg font-semibold"
        style={{ color: statusColor }}>
        {state.message}
      </Text>
      {state.guess !== null ? (
        <Text className="text-sm" style={{ color: '#fff1da' }}>
          Your guess: {state.guess} ·{' '}
          {state.mode === 'hardware' ? `Hardware: ${state.jobStatus ?? 'submitting'}` : 'Simulator'}
        </Text>
      ) : null}
      {busy || ['intro', 'waiting', 'collapsing'].includes(state.phase) ? (
        <ActivityIndicator
          accessibilityLabel={busy ? 'Connecting to the service' : 'Round in progress'}
          color="#ff08a1"
        />
      ) : null}
      {state.phase === 'idle' ? (
        <Text className="text-sm" style={{ color: '#cbd5e1' }}>
          {message}
        </Text>
      ) : null}
      {coolUntil > now ? (
        <Text className="text-sm" style={{ color: '#fde68a' }}>
          Retry available in {Math.ceil((coolUntil - now) / 1000)} seconds.
        </Text>
      ) : null}
      {state.cancellationNotice ? (
        <Text className="text-sm" style={{ color: '#fde68a' }}>
          {state.cancellationNotice}
        </Text>
      ) : null}
      {state.uncertainSubmission ? (
        <Text className="text-sm" style={{ color: '#fde68a' }}>
          A prior submission may still run. Check its outcome with the owner before enabling another
          hardware shot.
        </Text>
      ) : null}
    </>
  );
}

function QubitHUD({
  context,
  configuration,
}: {
  context: ARActiveOverlayContext;
  configuration: Configuration;
}) {
  const { controller, configured, busy, message, retryAt, check, cancelCheck } = configuration;
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [now, setNow] = useState(() => Date.now());
  const { fontScale, width } = useWindowDimensions();
  const coolUntil = Math.max(retryAt, state.retryAt);
  useEffect(() => {
    if (Date.now() >= coolUntil) return;
    const timer = setInterval(() => {
      const time = Date.now();
      setNow(time);
      if (time >= coolUntil) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [coolUntil]);
  useEffect(() => {
    void check();
    return () => cancelCheck();
  }, [context.sessionId, check, cancelCheck]);
  const disabled = busy || !controller.canGuess(now) || now < coolUntil;
  const idle = state.phase === 'idle';
  const buttonStyle = {
    height: Math.max(48, 22 * fontScale + 26),
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#93f5c5',
    borderRadius: 10,
    backgroundColor: '#15232a',
  };
  const leave = (action: () => void) => {
    cancelCheck();
    controller.detach(context.sessionId);
    action();
  };
  const guessButtons = (
    <>
      <Button
        label="Guess 0"
        disabled={disabled}
        onPress={() => controller.guess(0)}
        style={buttonStyle}
      />
      <Button
        label="Guess 1"
        disabled={disabled}
        onPress={() => controller.guess(1)}
        style={buttonStyle}
      />
    </>
  );
  return (
    <View
      className="gap-3 rounded-xl border p-4"
      style={{ backgroundColor: '#10191fee', borderColor: '#365d58' }}>
      <QubitStatus
        state={state}
        busy={busy}
        message={message}
        instruction={context.instruction}
        coolUntil={coolUntil}
        now={now}
      />
      <Host matchContents={{ vertical: true }} colorScheme="dark" seedColor="#93f5c5">
        <Column spacing={8}>
          <Picker
            selectedValue={state.mode}
            enabled={idle && !busy}
            onValueChange={(mode) => controller.setMode(mode as 'simulator' | 'hardware')}>
            <Picker.Item label="Simulator" value="simulator" />
            <Picker.Item label="Hardware Jobs" value="hardware" />
          </Picker>
          {fontScale > 1.3 || width < 360 ? (
            <Column spacing={8}>{guessButtons}</Column>
          ) : (
            <Row spacing={12}>{guessButtons}</Row>
          )}
          {state.phase === 'paused' ? (
            <Button
              label="Resume existing job"
              disabled={coolUntil > now}
              onPress={() => controller.resume()}
              style={buttonStyle}
            />
          ) : null}
          {idle && state.uncertainSubmission ? (
            <Button
              label="I checked — allow another hardware shot"
              onPress={() => controller.acknowledgeUnknown()}
              style={buttonStyle}
            />
          ) : null}
          <Button
            label="Reset round"
            onPress={() => {
              cancelCheck();
              controller.reset();
            }}
            variant="outlined"
            style={buttonStyle}
          />
          {idle ? (
            <Button
              label="Reconnect"
              disabled={busy || !configured || coolUntil > now}
              onPress={() => void check()}
              variant="outlined"
              style={buttonStyle}
            />
          ) : null}
          <Button
            label="Restart AR"
            onPress={() => leave(context.restartAR)}
            variant="text"
            style={buttonStyle}
          />
          <Button
            label="Home"
            onPress={() => leave(context.home)}
            variant="text"
            style={buttonStyle}
          />
        </Column>
      </Host>
    </View>
  );
}
export default function GuessTheQubitScreen() {
  const configuration = useQubitConfiguration();
  return (
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
  );
}
