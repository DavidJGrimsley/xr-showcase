import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from 'react';
import {
  Viro3DObject,
  ViroAmbientLight,
  ViroARPlaneSelector,
  ViroARScene,
  ViroDirectionalLight,
  ViroGameLoop,
  ViroGameLoopUtils,
  ViroNode,
  ViroTrackingStateConstants,
  ViroSharedFrame,
  ViroSound,
  ViroSphere,
  ViroMaterials,
} from '@reactvision/react-viro';
import { useReducedMotion } from 'react-native-reanimated';

import { ARENA_LAYOUT, type FighterId, type FighterTransform } from './arena-controller';
import { arenaOffsetPosition } from './arena-transform';
import type { ArenaSceneBinding } from './arena-navigator.native';
import type { RoomView } from './arena-room.native';
import { framePose } from './arena-placement';
import { playsImpact } from './arena-audio-policy';
import { ArenaImpactSlots } from './arena-impact-slots';

const sources = {
  // Metro packages binary assets through static require calls.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  arena: require('../../../assets/arena/Fight_Arena.glb'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  blue: require('../../../assets/arena/Mike_Player1_Blue_Combat_AR.glb'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  red: require('../../../assets/arena/Mike_Player2_RedOrange_Combat_AR.glb'),
};
const impactSounds = {
  right: require('../../../assets/arena/sounds/punch_01.wav'),
  left: require('../../../assets/arena/sounds/punch_02.wav'),
  uppercut: require('../../../assets/arena/sounds/punch_03.wav'),
};
ViroMaterials.createMaterials({
  arenaBlock: { diffuseColor: '#8ee8ef', lightingModel: 'Constant' },
  arenaContact: { diffuseColor: '#fff3cd', lightingModel: 'Constant' },
});
const scale: [number, number, number] = Array(3).fill(ARENA_LAYOUT.fighterScale) as [
  number,
  number,
  number,
];
const arenaScale: [number, number, number] = Array(3).fill(ARENA_LAYOUT.arenaScale) as [
  number,
  number,
  number,
];
const fighterY = ARENA_LAYOUT.floorHeight + ARENA_LAYOUT.footOffset;
const loopingClips = new Set([
  'Idle',
  'IdleAggro',
  'WalkForward',
  'WalkBackward',
  'StrafeLeft',
  'StrafeRight',
  'Run',
  'RunFast',
  'DefeatedLoop',
  'BlockHold',
  'BlockAdvance',
  'BlockStrafeLeft',
  'BlockStrafeRight',
]);
const initialAnimation = { name: 'IdleAggro', loop: true, run: false, interruptible: true };
function writeAnimation(model: Viro3DObject | null, animation: typeof initialAnimation) {
  // Viro's inherited signature requires all model props; native updates accept partial props.
  model?.setNativeProps({ animation } as Parameters<Viro3DObject['setNativeProps']>[0]);
}

function FighterModel({
  binding,
  id,
  node,
}: {
  binding: ArenaSceneBinding;
  id: FighterId;
  node: RefObject<ViroNode | null>;
}) {
  const { controller, token, context } = binding;
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const fighter = snapshot[id];
  const model = useRef<Viro3DObject>(null);
  const appliedAnimation = useRef({ id: Number.NaN, name: 'IdleAggro', loop: true });
  const { clip, animationId } = fighter;
  const run = snapshot.animationsRunning && snapshot.impactPauseRemaining === 0;
  const animation = useMemo(() => ({ name: clip, loop: loopingClips.has(clip) }), [clip]);
  useEffect(() => {
    if (!run) {
      writeAnimation(model.current, {
        name: appliedAnimation.current.name,
        loop: appliedAnimation.current.loop,
        run: false,
        interruptible: false,
      });
      return;
    }
    // Viro 3.0.3 resumes the old executable when paused, even if its name changes.
    // Resume without interruption, then apply a changed command on the next frame.
    writeAnimation(model.current, { ...animation, run: true, interruptible: false });
    if (appliedAnimation.current.id === animationId) return;
    const frame = requestAnimationFrame(() => {
      writeAnimation(model.current, { ...animation, run: true, interruptible: true });
      appliedAnimation.current = { id: animationId, ...animation };
      controller.animationApplied(id, animationId);
    });
    return () => cancelAnimationFrame(frame);
  }, [animation, animationId, run, controller, id]);
  const [initialTransform] = useState(() => {
    const transform = controller.getTransform(id);
    return {
      position: [transform.x, fighterY + transform.lift, transform.z] as [number, number, number],
      rotation: [0, transform.yaw, 0] as [number, number, number],
    };
  });
  const version = snapshot.placementVersion;

  return (
    <ViroNode ref={node} position={initialTransform.position} rotation={initialTransform.rotation}>
      <Viro3DObject
        ref={model}
        source={sources[id]}
        type="GLB"
        scale={scale}
        animation={initialAnimation}
        onLoadEnd={() => controller.assetLoaded(token, version, id)}
        onError={() => {
          if (controller.assetFailed(token, version, id)) context.onError();
        }}
      />
    </ViroNode>
  );
}

export default function ArenaScene({
  sceneNavigator,
}: {
  sceneNavigator: { viroAppProps: ArenaSceneBinding } & Parameters<
    NonNullable<ArenaSceneBinding['room']>['attach']
  >[0];
}) {
  const binding: ArenaSceneBinding = sceneNavigator.viroAppProps;
  const { controller, context, token, room } = binding;
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const selector = useRef<ViroARPlaneSelector>(null);
  const selectedPlane = useRef<string | null>(null);
  const blueNode = useRef<ViroNode>(null);
  const cpuNode = useRef<ViroNode>(null);
  const renderedTransforms = useRef<
    Partial<Record<FighterId, FighterTransform & { node: ViroNode }>>
  >({});
  const loaded = snapshot.assetsLoaded === 3;
  const version = snapshot.placementVersion;
  const roomState = useSyncExternalStore<RoomView | null>(
    room?.subscribe ?? noSubscribe,
    room?.getSnapshot ?? noRoom
  );
  useEffect(() => room?.attach(sceneNavigator), [room, sceneNavigator, token]);
  const sharedPlaced = !!roomState?.preview || (!!roomState?.frame && !!controller.placement);
  useEffect(() => {
    if (room) controller.setPlacement(token, sharedPlaced);
  }, [room, controller, token, sharedPlaced]);
  useEffect(() => {
    if (room && roomState?.status === 'placing' && !roomState.preview) selector.current?.reset();
    if (!room && !snapshot.placed) {
      selectedPlane.current = null;
      selector.current?.reset();
    }
  }, [room, roomState?.status, roomState?.preview, snapshot.placed, version]);
  const frame = roomState?.frame;
  const worldFrame = useMemo(
    () =>
      frame
        ? framePose(frame)
        : {
            position: [0, 0, 0] as [number, number, number],
            rotation: [0, 0, 0] as [number, number, number],
          },
    [frame]
  );
  const sharedArena =
    roomState?.frame && controller.placement ? controller.placement : roomState?.preview;
  const source = roomState?.source;
  const sharedSource = useMemo(
    () => (source ? { ...source, key: source.key + ':' + token } : null),
    [source, token]
  );

  const updateTransform = (id: FighterId, node: RefObject<ViroNode | null>) => {
    if (!node.current) {
      delete renderedTransforms.current[id];
      return;
    }
    const current = controller.getTransform(id);
    const previous = renderedTransforms.current[id];
    if (
      previous?.node !== node.current ||
      previous.x !== current.x ||
      previous.z !== current.z ||
      previous.lift !== current.lift
    ) {
      ViroGameLoopUtils.setPosition(node, [current.x, fighterY + current.lift, current.z]);
    }
    if (previous?.node !== node.current || previous.yaw !== current.yaw) {
      ViroGameLoopUtils.setRotation(node, [0, current.yaw, 0]);
    }
    renderedTransforms.current[id] = { ...current, node: node.current };
  };

  useEffect(() => {
    if (!snapshot.placed || loaded) return;
    const timer = setTimeout(() => {
      const missing = controller.firstMissingAsset();
      if (missing && controller.assetFailed(token, version, missing)) context.onError();
    }, 30000);
    return () => clearTimeout(timer);
  }, [controller, context, token, version, snapshot.placed, loaded]);

  return (
    <ViroARScene
      anchorDetectionTypes={['PlanesHorizontal']}
      toneMappingEnabled={false}
      onError={context.onError}
      onTrackingUpdated={(state) => {
        const normal = state === ViroTrackingStateConstants.TRACKING_NORMAL;
        controller.setTracking(token, normal);
        if (controller.isCurrent(token)) room?.tracking(normal);
        if (normal) context.onReady();
      }}
      onAnchorFound={(anchor) => selector.current?.handleAnchorFound(anchor)}
      onAnchorUpdated={(anchor) => selector.current?.handleAnchorUpdated(anchor)}
      onAnchorRemoved={(anchor) => {
        if (anchor) selector.current?.handleAnchorRemoved(anchor);
      }}>
      <ViroAmbientLight color="#ffffff" intensity={600} />
      <ViroDirectionalLight
        color="#ffffff"
        intensity={800}
        direction={[-1, -2, -1]}
        castsShadow={false}
      />
      <ViroGameLoop
        fixedHz={60}
        onFixedUpdate={({ dt }) => controller.tick(token, dt)}
        onLateUpdate={({ dt }) => {
          if (__DEV__) controller.recordFrame(token, dt);
          updateTransform('blue', blueNode);
          updateTransform('red', cpuNode);
        }}
      />
      {(!room ||
        (controller.mode === 'host' && (!controller.placement || roomState?.repositioning))) && (
        <ViroNode visible={!room || (roomState?.status === 'placing' && !roomState.preview)}>
          <ViroARPlaneSelector
            ref={selector}
            disableClickSelection={
              !!room && (roomState?.status !== 'placing' || !!roomState.preview)
            }
            alignment="HorizontalUpward"
            minWidth={0.6}
            minHeight={0.6}
            onPlaneSelected={(plane, point) => {
              if (room) {
                if (!point || !room.place(point)) selector.current?.reset();
                return;
              }
              selectedPlane.current = plane.anchorId;
              controller.setPlacement(token, true);
            }}
            onPlaneRemoved={(anchorId) => {
              if (anchorId !== selectedPlane.current) return;
              selectedPlane.current = null;
              controller.setPlacement(token, false);
            }}>
            {!room && (
              <ArenaModels
                binding={binding}
                version={version}
                blueNode={blueNode}
                redNode={cpuNode}
              />
            )}
          </ViroARPlaneSelector>
        </ViroNode>
      )}
      {room && sharedSource && (
        <ViroSharedFrame
          source={sharedSource}
          arSceneNavigator={sceneNavigator}
          onLocalized={(event) => {
            if (controller.isCurrent(token)) room.localized(event.transform);
          }}
          onLocalizeProgress={({ message }) => {
            if (controller.isCurrent(token)) room.progress(message);
          }}
          onLocalizeError={(error) => {
            if (controller.isCurrent(token)) room.fail(error);
          }}
        />
      )}
      {room && sharedArena && (
        <ViroNode position={worldFrame.position} rotation={worldFrame.rotation}>
          <ViroNode position={sharedArena.position} rotation={sharedArena.rotation}>
            <ArenaModels
              binding={binding}
              version={version}
              blueNode={blueNode}
              redNode={cpuNode}
            />
          </ViroNode>
        </ViroNode>
      )}
    </ViroARScene>
  );
}

const noSubscribe = () => () => {};
const noRoom = () => null;
function ImpactSound({
  source,
  soundKey,
  sounds,
  slots,
}: {
  source: number;
  soundKey: string;
  sounds: RefObject<Map<string, ViroSound>>;
  slots: ArenaImpactSlots;
}) {
  return (
    <ViroSound
      source={source}
      paused
      volume={0.8}
      ref={(sound) => {
        if (sound) sounds.current.set(soundKey, sound);
        else sounds.current.delete(soundKey);
      }}
      onFinish={() => {
        slots.finish(soundKey);
        sounds.current
          .get(soundKey)
          ?.setNativeProps({ paused: true } as Parameters<ViroSound['setNativeProps']>[0]);
      }}
      onError={() => {
        slots.finish(soundKey);
        sounds.current.delete(soundKey);
      }}
    />
  );
}
function ImpactFeedback({ binding }: { binding: ArenaSceneBinding }) {
  const { controller } = binding;
  const reduced = useReducedMotion();
  const sounds = useRef(new Map<string, ViroSound>());
  const [slots] = useState(() => new ArenaImpactSlots());
  const flashes = useRef(new Map<FighterId, ViroNode>());
  const spheres = useRef(new Map<FighterId, ViroSphere>());
  const remaining = useRef({ blue: 0, red: 0 });
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  useEffect(() => {
    if (state.animationsRunning) return;
    for (const sound of sounds.current.values())
      sound.setNativeProps({ paused: true } as Parameters<ViroSound['setNativeProps']>[0]);
    for (const flash of flashes.current.values())
      flash.setNativeProps({ opacity: 0 } as Parameters<ViroNode['setNativeProps']>[0]);
    remaining.current = { blue: 0, red: 0 };
    slots.clear();
  }, [state.animationsRunning, slots]);
  return (
    <>
      <ViroGameLoop
        onLateUpdate={({ dt }) => {
          for (const { fighter, impact } of controller.takeImpacts()) {
            const key = `${fighter}:${impact.kind === 'uppercut' ? 'uppercut' : impact.hand === 'L' ? 'left' : 'right'}`;
            const slot = playsImpact(
              state.mode === 'solo' ? 'solo' : 'same-space',
              state.localFighter,
              fighter
            )
              ? slots.reserve(key)
              : null;
            const sound = slot ? sounds.current.get(slot) : null;
            if (slot && !sound) slots.finish(slot);
            sound?.seekToTime(0);
            sound?.setNativeProps({
              paused: false,
              volume: impact.outcome === 'hit' ? 0.8 : 0.4,
            } as Parameters<ViroSound['setNativeProps']>[0]);
            spheres.current.get(fighter)?.setNativeProps({
              materials: [impact.outcome === 'hit' ? 'arenaContact' : 'arenaBlock'],
            } as Parameters<ViroSphere['setNativeProps']>[0]);
            remaining.current[fighter] = impact.kind === 'uppercut' ? 0.14 : 0.09;
            const size = impact.kind === 'uppercut' ? 1.5 : 1;
            flashes.current.get(fighter)?.setNativeProps({
              position: [impact.x, fighterY + impact.y, impact.z],
              scale: [size, size, size],
              opacity: reduced ? 0.25 : 0.65,
            } as Parameters<ViroNode['setNativeProps']>[0]);
          }
          for (const fighter of ['blue', 'red'] as const) {
            if (remaining.current[fighter] <= 0) continue;
            remaining.current[fighter] = Math.max(0, remaining.current[fighter] - dt);
            if (remaining.current[fighter] === 0)
              flashes.current
                .get(fighter)
                ?.setNativeProps({ opacity: 0 } as Parameters<ViroNode['setNativeProps']>[0]);
          }
        }}
      />
      {(['blue', 'red'] as const).map((fighter) => (
        <ViroNode key={fighter}>
          <ViroNode
            opacity={0}
            ref={(node) => {
              if (node) flashes.current.set(fighter, node);
              else flashes.current.delete(fighter);
            }}>
            <ViroSphere
              ref={(node) => {
                if (node) spheres.current.set(fighter, node);
                else spheres.current.delete(fighter);
              }}
              radius={0.008}
              materials={['arenaContact']}
            />
          </ViroNode>
          {Object.entries(impactSounds).flatMap(([name, source]) =>
            [0, 1, 2].map((slot) => (
              <ImpactSound
                key={`${name}:${slot}`}
                source={source}
                soundKey={`${fighter}:${name}:${slot}`}
                sounds={sounds}
                slots={slots}
              />
            ))
          )}
        </ViroNode>
      ))}
    </>
  );
}
function ArenaModels({
  binding,
  version,
  blueNode,
  redNode,
}: {
  binding: ArenaSceneBinding;
  version: number;
  blueNode: RefObject<ViroNode | null>;
  redNode: RefObject<ViroNode | null>;
}) {
  const { controller, token, context } = binding;
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const { scale, yaw } = state.arenaTransform;
  const scope = { sessionToken: token, placementVersion: version };
  return (
    <ViroNode
      key={version}
      position={arenaOffsetPosition(state.arenaTransform)}
      rotation={[0, yaw, 0]}
      scale={[scale, scale, scale]}
      onPinch={
        state.canTransform
          ? (gesture, factor) => controller.pinch(scope, gesture, factor)
          : undefined
      }
      onRotate={
        state.canTransform
          ? (gesture, degrees) => controller.rotate(scope, gesture, degrees)
          : undefined
      }>
      <Viro3DObject
        source={sources.arena}
        type="GLB"
        scale={arenaScale}
        position={[0, ARENA_LAYOUT.arenaBaseOffset, 0]}
        onLoadEnd={() => controller.assetLoaded(token, version, 'arena')}
        onError={() => {
          if (controller.assetFailed(token, version, 'arena')) context.onError();
        }}
      />
      <FighterModel binding={binding} id="blue" node={blueNode} />
      <FighterModel binding={binding} id="red" node={redNode} />
      <ImpactFeedback binding={binding} />
    </ViroNode>
  );
}
