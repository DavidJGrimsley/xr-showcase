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
} from '@reactvision/react-viro';

import { ARENA_LAYOUT, type FighterId, type FighterTransform } from './arena-controller';
import type { ArenaSceneBinding } from './arena-navigator.native';

const sources = {
  // Metro packages binary assets through static require calls.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  arena: require('../../../assets/arena/Fight_Arena.glb'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  blue: require('../../../assets/arena/Mike_Player1_Blue_AR.glb'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  cpu: require('../../../assets/arena/Mike_Player2_RedOrange_AR.glb'),
};
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
  const appliedAnimation = useRef({ id: -1, name: 'IdleAggro', loop: true });
  const { clip, animationId } = fighter;
  const run = snapshot.animationsRunning;
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
    });
    return () => cancelAnimationFrame(frame);
  }, [animation, animationId, run]);
  const [initialTransform] = useState(() => {
    const transform = controller.getTransform(id);
    return {
      position: [transform.x, fighterY + transform.lift, 0] as [number, number, number],
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
  sceneNavigator: { viroAppProps: ArenaSceneBinding };
}) {
  const binding = sceneNavigator.viroAppProps;
  const { controller, context, token } = binding;
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
      previous.lift !== current.lift
    ) {
      ViroGameLoopUtils.setPosition(node, [current.x, fighterY + current.lift, 0]);
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
          updateTransform('cpu', cpuNode);
        }}
      />
      <ViroARPlaneSelector
        ref={selector}
        alignment="HorizontalUpward"
        minWidth={0.6}
        minHeight={0.6}
        onPlaneSelected={(plane) => {
          selectedPlane.current = plane.anchorId;
          controller.setPlacement(token, true);
        }}
        onPlaneRemoved={(anchorId) => {
          if (anchorId !== selectedPlane.current) return;
          selectedPlane.current = null;
          controller.setPlacement(token, false);
        }}>
        <ViroNode key={version} rotation={[0, snapshot.arenaYaw, 0]}>
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
          <FighterModel binding={binding} id="cpu" node={cpuNode} />
        </ViroNode>
      </ViroARPlaneSelector>
    </ViroARScene>
  );
}
