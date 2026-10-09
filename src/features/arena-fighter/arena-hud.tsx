import { Button, Column, Host, Picker, Row } from '@expo/ui';
import { useEffect, useRef, useState, useSyncExternalStore, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  findNodeHandle,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ARActiveOverlayContext } from '@/features/ar/ar-session-types';
import { useAppTheme } from '@/theme/provider';

import {
  ARENA_CLIPS,
  ARENA_RULES,
  ArenaController,
  type ArenaSnapshot,
  type FighterId,
  type Movement,
} from './arena-controller';
import { updateHeldTouches } from './arena-touch-input';

function HUDButton(props: ComponentProps<typeof Button>) {
  const { activeColors: colors } = useAppTheme();
  return (
    <Host matchContents colorScheme="dark" seedColor={colors.primary}>
      <Button {...props} />
    </Host>
  );
}

function Health({ label, health, color }: { label: string; health: number; color: string }) {
  const { activeColors: colors } = useAppTheme();
  return (
    <View className="flex-1 gap-1 rounded-lg px-3 py-2" style={{ backgroundColor: colors.surface }}>
      <Text className="font-semibold" style={{ color: colors.text }}>
        {label} · {health}/{ARENA_RULES.health}
      </Text>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={`${label} health`}
        accessibilityValue={{ min: 0, max: ARENA_RULES.health, now: health }}
        className="h-2 overflow-hidden rounded-full"
        style={{ backgroundColor: colors.background }}>
        <View
          className="h-full"
          style={{ width: `${(health / ARENA_RULES.health) * 100}%`, backgroundColor: color }}
        />
      </View>
    </View>
  );
}

function MovementButton({
  controller,
  movement,
  disabled,
}: {
  controller: ArenaController;
  movement: Movement;
  disabled: boolean;
}) {
  const { activeColors: colors } = useAppTheme();
  const roundId = controller.getSnapshot().roundId;
  const control = useRef<View>(null);
  const touches = useRef(new Set<string>());
  useEffect(() => {
    if (disabled) {
      touches.current.clear();
      controller.setMovement(movement, false, roundId);
    }
    return () => controller.setMovement(movement, false, roundId);
  }, [controller, disabled, movement, roundId]);
  const release = ({ nativeEvent }: GestureResponderEvent) => {
    const held = updateHeldTouches(touches.current, nativeEvent.changedTouches, null, false);
    controller.setMovement(movement, !disabled && held, roundId);
  };
  return (
    <View
      accessible
      ref={control}
      pointerEvents="box-only"
      accessibilityRole="button"
      accessibilityLabel={
        movement === 'advance' ? 'Hold to advance toward Red Mike' : 'Hold to retreat from Red Mike'
      }
      accessibilityState={{ disabled }}
      accessibilityHint="Touch and hold to move. Release to stop."
      onTouchStart={(event) => {
        if (disabled) return;
        // box-only keeps the label from becoming a separate native touch target.
        const held = updateHeldTouches(
          touches.current,
          event.nativeEvent.changedTouches,
          findNodeHandle(control.current),
          true
        );
        controller.setMovement(movement, held, roundId);
      }}
      onTouchEnd={release}
      onTouchCancel={release}
      className="min-h-[52px] min-w-[92px] items-center justify-center rounded-xl border px-3 py-3"
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.primary,
        opacity: disabled ? 0.45 : 1,
      }}>
      <Text className="text-base font-semibold" style={{ color: colors.text }}>
        {movement === 'advance' ? 'Advance' : 'Retreat'}
      </Text>
    </View>
  );
}

function SetupPanel({
  controller,
  controls,
  snapshot,
  buttonStyle,
}: {
  controller: ArenaController;
  controls: ARActiveOverlayContext;
  snapshot: ArenaSnapshot;
  buttonStyle: ComponentProps<typeof Button>['style'];
}) {
  const { activeColors: colors } = useAppTheme();
  const [tester, setTester] = useState(false);
  const [testFighter, setTestFighter] = useState<FighterId>('blue');
  const [testClip, setTestClip] = useState('IdleAggro');
  const setup = snapshot.phase === 'setup';
  if (snapshot.phase === 'fighting' || snapshot.phase === 'ending') return null;
  return (
    <View pointerEvents="box-none" className="my-2 min-h-0 flex-1 justify-start">
      <ScrollView
        className="w-full max-w-[380px] rounded-xl"
        style={{ backgroundColor: colors.surface, flexGrow: 0 }}
        contentContainerClassName="gap-3 p-3">
        <Text
          accessibilityRole="header"
          className="text-lg font-semibold"
          style={{ color: colors.text }}>
          Arena Fighter
        </Text>
        <Text accessibilityLiveRegion="polite" className="text-base" style={{ color: colors.text }}>
          {snapshot.message}
        </Text>
        {snapshot.placed && snapshot.assetsLoaded < 3 && !snapshot.error ? (
          <ActivityIndicator accessibilityLabel="Loading fighters" color={colors.primary} />
        ) : null}
        <View className="flex-row flex-wrap gap-2">
          {setup ? (
            <>
              <HUDButton
                label="Ready"
                disabled={!snapshot.canReady || tester}
                onPress={controller.ready}
                style={buttonStyle}
              />
              <HUDButton
                label="Swap sides"
                disabled={Boolean(snapshot.preview)}
                onPress={controller.swapSides}
                variant="outlined"
                style={buttonStyle}
              />
              <HUDButton
                label="Rotate 90°"
                disabled={Boolean(snapshot.preview)}
                onPress={controller.rotateArena}
                variant="outlined"
                style={buttonStyle}
              />
            </>
          ) : snapshot.phase === 'paused' ? (
            <HUDButton
              label="Resume"
              disabled={!snapshot.canResume}
              onPress={controller.resume}
              style={buttonStyle}
            />
          ) : (
            <HUDButton
              label="Rematch"
              disabled={!snapshot.canRematch}
              onPress={controller.rematch}
              style={buttonStyle}
            />
          )}
          <HUDButton
            label="Replace arena"
            variant="outlined"
            onPress={controls.restartAR}
            style={buttonStyle}
          />
        </View>
        {__DEV__ && setup ? (
          <>
            <Host matchContents={{ vertical: true }} colorScheme="dark" seedColor={colors.primary}>
              <Button
                label={tester ? 'Close clip tester' : 'Test fighter clips'}
                variant="text"
                onPress={() => {
                  controller.stopPreview();
                  setTester(!tester);
                }}
                style={buttonStyle}
              />
            </Host>
            {tester ? (
              <>
                <Text className="text-sm" style={{ color: colors.text }}>
                  Development clip test. Place the arena and wait for both fighters to load.
                </Text>
                <Host
                  matchContents={{ vertical: true }}
                  colorScheme="dark"
                  seedColor={colors.primary}>
                  <Row spacing={12}>
                    <Picker selectedValue={testFighter} onValueChange={setTestFighter}>
                      <Picker.Item label="Blue Mike" value="blue" />
                      <Picker.Item label="Red Mike" value="cpu" />
                    </Picker>
                    <Picker selectedValue={testClip} onValueChange={setTestClip}>
                      {ARENA_CLIPS.map((clip) => (
                        <Picker.Item key={clip} label={clip} value={clip} />
                      ))}
                    </Picker>
                  </Row>
                </Host>
                <View className="flex-row flex-wrap gap-2">
                  <HUDButton
                    label="Play"
                    disabled={!snapshot.canReady && !snapshot.preview}
                    onPress={() => controller.previewClip(testFighter, testClip)}
                    style={buttonStyle}
                  />
                  <HUDButton label="Stop" onPress={controller.stopPreview} style={buttonStyle} />
                </View>
              </>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

export default function ArenaHUD({
  controller,
  controls,
}: {
  controller: ArenaController;
  controls: ARActiveOverlayContext;
}) {
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const { activeColors: colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const buttonStyle = {
    height: Math.max(52, Math.ceil(20 * fontScale) + 28),
    paddingHorizontal: 12,
  };
  const home = () => {
    controller.dispose();
    controls.home();
  };
  const movementDisabled = snapshot.phase !== 'fighting' || !snapshot.animationsRunning;
  const AttackLayout = fontScale > 1.3 ? Column : Row;
  const outcomeText =
    snapshot.outcome === 'draw'
      ? 'Draw · double knockout'
      : snapshot.outcome === 'blue'
        ? 'You won!'
        : 'Red Mike won';

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-0 justify-between"
      style={{
        paddingTop: Math.max(10, insets.top),
        paddingBottom: Math.max(10, insets.bottom),
        paddingLeft: Math.max(12, insets.left),
        paddingRight: Math.max(12, insets.right),
      }}>
      <View pointerEvents="box-none" className="gap-2">
        <View className="flex-row items-center gap-3">
          <Health label="Blue Mike · You" health={snapshot.blue.health} color="#38bdf8" />
          <Health label="Red Mike · CPU" health={snapshot.cpu.health} color="#fb923c" />
          <Host matchContents colorScheme="dark" seedColor={colors.primary}>
            <Button label="Home" onPress={home} style={buttonStyle} />
          </Host>
        </View>
        {snapshot.outcome ? (
          <Text
            accessibilityRole="header"
            accessibilityLiveRegion="polite"
            className="self-center rounded-lg px-3 py-1 text-lg font-semibold"
            style={{ color: colors.text, backgroundColor: colors.surface }}>
            {outcomeText}
          </Text>
        ) : null}
        {__DEV__ && snapshot.fps !== null ? (
          <Text
            pointerEvents="none"
            className="self-center rounded-lg px-2 py-1 text-xs"
            style={{ color: colors.text, backgroundColor: colors.surface }}>
            {snapshot.fps} FPS avg · {snapshot.frameSamples} frames
          </Text>
        ) : null}
      </View>

      <SetupPanel
        controller={controller}
        controls={controls}
        snapshot={snapshot}
        buttonStyle={buttonStyle}
      />

      <View pointerEvents="box-none" className="flex-row items-end justify-between gap-3">
        <View className={fontScale > 1.3 ? 'flex-col gap-2' : 'flex-row gap-2'}>
          {/* Raw touch events keep each finger independent; claiming one RN responder cancels the other hold. */}
          <MovementButton controller={controller} movement="retreat" disabled={movementDisabled} />
          <MovementButton controller={controller} movement="advance" disabled={movementDisabled} />
        </View>
        <Host matchContents colorScheme="dark" seedColor={colors.primary}>
          <AttackLayout spacing={8}>
            <Button
              label="Punch"
              disabled={!snapshot.canAttack}
              onPress={() => controller.attack('punch', 'blue', snapshot.roundId)}
              style={buttonStyle}
            />
            <Button
              label={
                snapshot.blue.uppercutRemaining > 0
                  ? `Uppercut ${snapshot.blue.uppercutRemaining.toFixed(1)}s`
                  : 'Uppercut'
              }
              disabled={!snapshot.canAttack || snapshot.blue.uppercutRemaining > 0}
              onPress={() => controller.attack('uppercut', 'blue', snapshot.roundId)}
              style={buttonStyle}
            />
          </AttackLayout>
        </Host>
      </View>
    </View>
  );
}
