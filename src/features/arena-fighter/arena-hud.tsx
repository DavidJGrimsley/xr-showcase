import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useEffect, useRef, useState, useSyncExternalStore, type ComponentProps } from 'react';
import {
  findNodeHandle,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameCopy } from '@/ui/game-text';
import type { ARActiveOverlayContext } from '@/features/ar/ar-session-types';
import { ARENA_RULES, type Movement } from './arena-controller';
import { ArenaMatch } from './arena-match';
import type { ArenaRoomSession } from './arena-room-session';
import ArenaRoomPanel, { ArenaGuidance } from './arena-room-panel.native';
import { updateHeldTouches } from './arena-touch-input';
import { combatControlLayout } from './arena-control-layout';
import ArenaTransformControls from './arena-transform-controls.native';
import type { ArenaTransformScope } from './arena-transform';
import { arenaAnnouncement, arenaHUDState } from './arena-hud-state';
import { ARENA_FONTS, ArenaButton, ArenaDisplayText, useArenaColors } from './arena-ui';

const noRoomSubscribe = () => () => {};
const noRoomSnapshot = () => null;

function Health({
  label,
  health,
  stamina,
  color,
}: {
  label: string;
  health: number;
  stamina: number;
  color: string;
}) {
  const colors = useArenaColors();
  return (
    <View style={[styles.health, { backgroundColor: colors.surface }]}>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
        style={{
          color: colors.text,
          fontFamily: ARENA_FONTS.body,
          fontSize: 11,
          fontWeight: '600',
        }}>
        {label} ·{' '}
        <Text style={{ fontFamily: ARENA_FONTS.mono }}>
          {health}/{ARENA_RULES.health}
        </Text>
      </Text>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={`${label} health`}
        accessibilityValue={{ min: 0, max: ARENA_RULES.health, now: health }}
        style={[styles.healthTrack, { backgroundColor: colors.background }]}>
        <View
          style={{
            height: '100%',
            width: `${(health / ARENA_RULES.health) * 100}%`,
            backgroundColor: color,
          }}
        />
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={`${label} guard stamina`}
        accessibilityValue={{ min: 0, max: 100, now: stamina }}
        style={{
          height: 4,
          backgroundColor: colors.background,
          borderRadius: 2,
          overflow: 'hidden',
        }}>
        <View style={{ height: 4, width: `${stamina}%`, backgroundColor: colors.secondary }} />
      </View>
    </View>
  );
}

function CombatButton({
  controller,
  movement,
  attack,
  defense,
  icon,
  label,
  glowing = false,
  layout,
  disabled,
}: {
  controller: ArenaMatch;
  movement?: Movement;
  attack?: 'punch' | 'uppercut';
  defense?: 'block' | 'jump-back';
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  glowing?: boolean;
  layout: ReturnType<typeof combatControlLayout>;
  disabled: boolean;
}) {
  const colors = useArenaColors();
  const roundId = controller.getSnapshot().roundId;
  const local = controller.getSnapshot()[controller.localFighter];
  const accepted =
    defense === 'block'
      ? local.guardHeld
      : attack === 'punch'
        ? local.counterpunchBuffered || controller.getSnapshot().punchPending
        : attack === 'uppercut'
          ? controller.getSnapshot().uppercutPending
          : false;
  const control = useRef<View>(null);
  const touches = useRef(new Set<string>());
  const [press, setPress] = useState({ held: false, disabled, roundId });
  // Reset feedback when the control changes generation or availability, before paint.
  if (press.disabled !== disabled || press.roundId !== roundId)
    setPress({ held: false, disabled, roundId });
  const setPressed = (held: boolean) => setPress({ held, disabled, roundId });
  useEffect(() => {
    if (disabled) {
      // Keep a held Block finger until its actual release after exhaustion or damage.
      if (defense !== 'block') touches.current.clear();
      if (movement) controller.setMovement(movement, false, roundId);
    }
  }, [controller, disabled, movement, defense, roundId]);
  useEffect(() => {
    const activeTouches = touches.current;
    return () => {
      if (movement) controller.setMovement(movement, false, roundId);
      if (defense === 'block' && activeTouches.size > 0) controller.block(false, roundId);
      activeTouches.clear();
    };
  }, [controller, movement, defense, roundId]);
  const release = ({ nativeEvent }: GestureResponderEvent) => {
    const held = updateHeldTouches(touches.current, nativeEvent.changedTouches, null, false);
    setPressed(!disabled && held);
    if (movement) controller.setMovement(movement, !disabled && held, roundId);
    if (defense === 'block' && !held) controller.block(false, roundId);
  };
  return (
    <View
      accessible
      ref={control}
      pointerEvents="box-only"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      accessibilityHint={
        movement
          ? 'Touch and hold to move. Release to stop.'
          : defense === 'block'
            ? 'Hold to guard. Release to lower your arms.'
            : defense === 'jump-back'
              ? 'Touch once to hop backward.'
              : 'Touch to attack.'
      }
      onAccessibilityTap={() => {
        if (!disabled && attack) controller.attack(attack, roundId);
        if (!disabled && defense === 'jump-back') controller.jumpBack(roundId);
        if (!disabled && defense === 'block')
          controller.block(!controller.getSnapshot()[controller.localFighter].guardHeld, roundId);
      }}
      onTouchStart={(event) => {
        if (disabled) return;
        const wasHeld = touches.current.size > 0;
        // box-only keeps the label from becoming a separate native touch target.
        const held = updateHeldTouches(
          touches.current,
          event.nativeEvent.changedTouches,
          findNodeHandle(control.current),
          true
        );
        setPressed(held);
        if (movement) controller.setMovement(movement, held, roundId);
        else if (attack && held && !wasHeld) controller.attack(attack, roundId);
        else if (defense && held && !wasHeld) {
          if (defense === 'block') controller.block(true, roundId);
          else controller.jumpBack(roundId);
        }
      }}
      onTouchEnd={release}
      onTouchCancel={release}
      testID={`arena-${movement ?? attack ?? defense}`}
      style={{
        ...styles.combatButton,
        position: 'absolute',
        ...layout.rectangles[movement ?? attack ?? defense!],
        backgroundColor: (press.held && !disabled) || accepted ? colors.primary : colors.surface,
        borderColor: glowing ? colors.secondary : colors.primary,
        opacity: disabled ? 0.45 : 1,
      }}>
      {glowing && (
        <View
          pointerEvents="none"
          testID="arena-uppercut-cue"
          style={{
            position: 'absolute',
            inset: -2,
            borderRadius: 14,
            borderWidth: 2,
            borderColor: colors.secondary,
            boxShadow: [
              { offsetX: 0, offsetY: 0, blurRadius: 6, spreadDistance: 1, color: colors.secondary },
            ],
          }}
        />
      )}
      <View
        pointerEvents="none"
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          ...(attack === 'uppercut' ? { position: 'absolute', top: 14, left: 0, right: 0 } : {}),
        }}>
        {attack === 'uppercut' ? (
          <FontAwesome6 name="hand-fist" size={28} color={colors.text} />
        ) : (
          <MaterialCommunityIcons name={icon} size={28} color={colors.text} />
        )}
      </View>
      {attack === 'uppercut' && (
        <Text
          pointerEvents="none"
          accessibilityLabel={`Uppercut progress ${local.punchProgress} of ${ARENA_RULES.punchStringLength}`}
          numberOfLines={1}
          maxFontSizeMultiplier={1.3}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={{
            position: 'absolute',
            bottom: 12,
            left: 0,
            right: 0,
            height: 20,
            textAlign: 'center',
            color: colors.text,
            fontFamily: ARENA_FONTS.mono,
            fontSize: 14,
          }}>
          {local.punchProgress}/{ARENA_RULES.punchStringLength}
        </Text>
      )}
    </View>
  );
}

export default function ArenaHUD({
  controller,
  controls,
  room,
}: {
  controller: ArenaMatch;
  controls: ARActiveOverlayContext;
  room?: ArenaRoomSession;
}) {
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const roomState = useSyncExternalStore(
    room?.subscribe ?? noRoomSubscribe,
    room?.getSnapshot ?? noRoomSnapshot
  );
  const [transformScope, setTransformScope] = useState<ArenaTransformScope | null>(null);
  const [positioning, setPositioning] = useState(false);
  const colors = useArenaColors();
  const insets = useSafeAreaInsets();
  const { fontScale, width, height } = useWindowDimensions();
  const availableWidth = width - Math.max(12, insets.left) - Math.max(12, insets.right);
  const availableHeight = height - Math.max(10, insets.top) - Math.max(10, insets.bottom);
  const combatLayout = combatControlLayout(fontScale, availableWidth, availableHeight - 64);
  const ui = arenaHUDState(snapshot, roomState);
  const standardActions = !ui.invite && ui.controls && !ui.error;
  const transforming =
    !!transformScope &&
    transformScope.sessionToken === snapshot.sessionToken &&
    transformScope.placementVersion === snapshot.placementVersion &&
    ['lobby', 'finished'].includes(snapshot.stage);
  const closeEditor = () => {
    setTransformScope(null);
    setPositioning(false);
  };
  const back = () => {
    if (transforming) {
      if (positioning) setPositioning(false);
      else closeEditor();
      return;
    }
    room?.dispose();
    controller.dispose();
    controls.home();
  };
  const openTransform = () => {
    if (!snapshot.canTransform || snapshot.sessionToken === null) return;
    controller.invalidatePlacementReady();
    setPositioning(false);
    setTransformScope({
      sessionToken: snapshot.sessionToken,
      placementVersion: snapshot.placementVersion,
    });
  };
  const restart = () => {
    if (room && !room.prepareRestart()) return;
    if (!room) controller.resetSetupTransform();
    closeEditor();
    controls.restartAR();
  };
  const localFighter = snapshot[snapshot.localFighter];
  const movementDisabled =
    snapshot.phase !== 'fighting' ||
    !snapshot.animationsRunning ||
    !['idle', 'walk', 'guard', 'guard-exit'].includes(localFighter.mode);
  const uppercutOpening =
    snapshot.animationsRunning &&
    snapshot.phase === 'fighting' &&
    localFighter.canUppercut &&
    !snapshot.uppercutPending;
  const announcement = arenaAnnouncement(snapshot);

  return (
    <View
      pointerEvents="box-none"
      testID="arena-hud"
      style={{
        ...styles.overlay,
        paddingTop: Math.max(10, insets.top),
        paddingBottom: Math.max(10, insets.bottom),
        paddingLeft: Math.max(12, insets.left),
        paddingRight: Math.max(12, insets.right),
      }}>
      <View
        pointerEvents="box-none"
        style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <ArenaButton label="Back" icon="arrow-left" testID="arena-back" onPress={back} />
        {ui.health && (
          <>
            <Health
              label={snapshot.localFighter === 'blue' ? 'Blue · You' : 'Blue · Opponent'}
              health={snapshot.blue.health}
              stamina={snapshot.blue.guardStamina}
              color="#38bdf8"
            />
            <Health
              label={
                snapshot.mode === 'solo'
                  ? 'Red · CPU'
                  : snapshot.localFighter === 'red'
                    ? 'Red · You'
                    : 'Red · Opponent'
              }
              health={snapshot.red.health}
              stamina={snapshot.red.guardStamina}
              color="#fb923c"
            />
          </>
        )}
      </View>
      <View
        pointerEvents="box-none"
        style={{
          flex: 1,
          minHeight: 0,
          justifyContent: 'center',
          alignItems: transforming ? 'flex-end' : 'center',
        }}>
        {transforming ? (
          <ScrollView
            testID="arena-editor"
            alwaysBounceVertical={false}
            style={{
              width: 280,
              maxWidth: '100%',
              flexGrow: 0,
              backgroundColor: colors.surface,
              borderRadius: 16,
              marginVertical: 6,
            }}
            contentContainerStyle={{ padding: 12 }}>
            <ArenaTransformControls
              controller={controller}
              state={snapshot}
              scope={transformScope}
              positioning={positioning}
              onPosition={() => setPositioning(true)}
              onDone={closeEditor}
            />
          </ScrollView>
        ) : ui.invite ? (
          <ArenaRoomPanel match={snapshot} width={availableWidth} height={availableHeight - 60} />
        ) : null}
      </View>
      {!transforming && !ui.invite && announcement && !snapshot.orientationPaused && (
        <View
          testID="arena-announcement"
          pointerEvents="none"
          style={{
            position: 'absolute',
            inset: 0,
            justifyContent: 'center',
            alignItems: 'center',
          }}>
          <ArenaDisplayText
            text={announcement.text}
            role={announcement.role}
            height={Math.min(90, availableHeight * 0.26)}
            maxWidth={availableWidth * 0.86}
          />
        </View>
      )}
      {!transforming &&
        !ui.invite &&
        (ui.error ||
          (!ui.controls && snapshot.stage === 'lobby') ||
          (ui.controls && !ui.ready && snapshot.stage !== 'finished' && !!ui.guidance) ||
          (snapshot.orientationPaused && !snapshot.localOrientationPaused)) && (
          <ArenaGuidance
            width={availableWidth}
            message={ui.guidance || 'Move slowly. Scan a table or floor.'}
            loading={
              !ui.error &&
              (roomState?.status === 'hosting' || (snapshot.placed && snapshot.assetsLoaded < 3))
            }
            onRetry={ui.error && room ? room.retry : undefined}
            onRestart={ui.error ? restart : undefined}
          />
        )}
      {!transforming && (standardActions || ui.transform) && (
        <View
          testID="arena-actions"
          style={{
            alignSelf: 'center',
            maxWidth: '100%',
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 8,
            padding: 6,
            borderRadius: 16,
            backgroundColor: colors.surface,
          }}>
          {standardActions &&
            ui.ready &&
            (snapshot.localReady ? (
              <GameCopy
                accessibilityLiveRegion="polite"
                style={{ color: colors.text, fontFamily: ARENA_FONTS.body, padding: 14 }}>
                Waiting for opponent…
              </GameCopy>
            ) : (
              <ArenaButton label="Ready" primary onPress={controller.ready} />
            ))}
          {standardActions && ui.setup && snapshot.canTransform && (
            <ArenaButton
              label={snapshot.space === 'remote' ? 'Rotate view 180°' : 'Swap Sides'}
              secondary
              onPress={controller.swapSides}
            />
          )}
          {ui.transform && (
            <ArenaButton
              label="Transform"
              secondary
              disabled={!snapshot.canTransform}
              onPress={openTransform}
            />
          )}
          {standardActions &&
            snapshot.stage === 'finished' &&
            (snapshot.localReady ? (
              <GameCopy
                accessibilityLiveRegion="polite"
                style={{ color: colors.text, fontFamily: ARENA_FONTS.body, padding: 14 }}>
                Waiting for opponent…
              </GameCopy>
            ) : snapshot.canRematch ? (
              <ArenaButton label="Rematch" primary onPress={controller.rematch} />
            ) : null)}
          {standardActions && snapshot.stage === 'paused' && snapshot.canResume && (
            <ArenaButton label="Resume" primary onPress={controller.resume} />
          )}
          {standardActions && <ArenaButton label="Restart AR" danger onPress={restart} />}
        </View>
      )}
      {snapshot.stage === 'fighting' && !snapshot.orientationPaused && (
        <View pointerEvents="box-none" style={{ height: combatLayout.panelHeight, width: '100%' }}>
          <CombatButton
            controller={controller}
            movement="strafeLeft"
            icon="rotate-left"
            label="Left"
            layout={combatLayout}
            disabled={movementDisabled}
          />
          <CombatButton
            controller={controller}
            movement="strafeRight"
            icon="rotate-right"
            label="Right"
            layout={combatLayout}
            disabled={movementDisabled}
          />
          <CombatButton
            controller={controller}
            defense="jump-back"
            icon="chevron-double-left"
            label="Jump Back"
            layout={combatLayout}
            disabled={
              !localFighter.canJumpBack || snapshot.jumpBackPending || !snapshot.animationsRunning
            }
          />
          <CombatButton
            controller={controller}
            movement="advance"
            icon="arrow-right"
            label="Advance"
            layout={combatLayout}
            disabled={movementDisabled}
          />
          <CombatButton
            controller={controller}
            defense="block"
            icon="shield"
            label="Block"
            layout={combatLayout}
            disabled={!localFighter.canBlock || !snapshot.animationsRunning}
          />
          <CombatButton
            controller={controller}
            attack="punch"
            icon="boxing-glove"
            label="Punch"
            layout={combatLayout}
            disabled={
              !snapshot.animationsRunning ||
              snapshot.phase !== 'fighting' ||
              !localFighter.canPunch ||
              snapshot.punchPending
            }
          />
          <CombatButton
            controller={controller}
            attack="uppercut"
            icon="boxing-glove"
            label="Uppercut"
            layout={combatLayout}
            glowing={uppercutOpening}
            disabled={!uppercutOpening}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  health: { flex: 1, gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  healthTrack: { height: 4, overflow: 'hidden', borderRadius: 9999 },
  combatButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 8,
  },
  overlay: { position: 'absolute', inset: 0, justifyContent: 'space-between' },
});
