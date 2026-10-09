import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';
import {
  ViroAnimations,
  ViroARPlaneSelector,
  ViroARScene,
  ViroBox,
  ViroGeometry,
  ViroMaterials,
  ViroNode,
  ViroPolyline,
  ViroSphere,
  ViroText,
  ViroTrackingStateConstants,
} from '@reactvision/react-viro';
import type { ARSceneContext } from '@/features/ar/ar-session-types';
import { PLACEMENT_CAPTION } from './qubit-presentation';
import {
  ARROW_TRIANGLES,
  ARROW_VERTICES,
  BASIS_LABELS,
  blochSpherePosition,
  BLOCH_RADIUS,
  ringPoints,
  type Point3,
} from './qubit-geometry';
import type { QubitRoundController, QubitSnapshot } from './qubit-round-controller';
import { canManipulateQubit } from './qubit-round-controller';
import { qubitMotion } from './qubit-motion';

ViroMaterials.createMaterials({
  qubitCyan: { diffuseColor: '#00c7ff', lightingModel: 'Constant' },
  qubitIvory: { diffuseColor: '#fff1da', lightingModel: 'Constant' },
  qubitShell: {
    diffuseColor: '#009ec7',
    lightingModel: 'Constant',
    writesToDepthBuffer: false,
    cullMode: 'Back',
  },
  qubitMagenta: { diffuseColor: '#ff08a1', lightingModel: 'Constant', cullMode: 'None' },
});
ViroAnimations.registerAnimations({
  qubitIntro: { duration: 800, easing: 'EaseInEaseOut', properties: { rotateZ: -90 } },
  qubitZero: { duration: 400, easing: 'EaseInEaseOut', properties: { rotateZ: 0 } },
  qubitOne: { duration: 400, easing: 'EaseInEaseOut', properties: { rotateZ: -180 } },
  qubitPulseUp: {
    duration: 600,
    easing: 'EaseInEaseOut',
    properties: { scaleX: 1.3, scaleY: 1.3, scaleZ: 1.3, opacity: 0.6 },
  },
  qubitPulseDown: {
    duration: 600,
    easing: 'EaseInEaseOut',
    properties: { scaleX: 1, scaleY: 1, scaleZ: 1, opacity: 1 },
  },
});
const rings = (['xy', 'xz', 'yz'] as const).map((plane) => ({ plane, points: ringPoints(plane) }));
export interface QubitSceneProps {
  context: ARSceneContext;
  controller: QubitRoundController;
}

function StatePoint({ pulse }: { pulse: boolean }) {
  const [growing, setGrowing] = useState(true);
  return (
    <ViroSphere
      position={[0, BLOCH_RADIUS, 0]}
      radius={0.007}
      widthSegmentCount={16}
      heightSegmentCount={12}
      materials={['qubitMagenta']}
      animation={{
        name: growing ? 'qubitPulseUp' : 'qubitPulseDown',
        run: pulse,
        onFinish: () => {
          if (pulse) setGrowing((value) => !value);
        },
      }}
    />
  );
}

function useQubitReducedMotion(
  controller: QubitRoundController,
  context: ARSceneContext,
  state: QubitSnapshot
) {
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (live) setReduceMotion(value);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    if (!reduceMotion || state.guess === null) return;
    if (!state.introDone) controller.finishIntro(context.sessionId, state.roundId);
    else if (state.phase === 'collapsing')
      controller.finishCollapse(context.sessionId, state.roundId);
  }, [
    reduceMotion,
    state.guess,
    state.introDone,
    state.phase,
    state.roundId,
    controller,
    context.sessionId,
  ]);
  return reduceMotion;
}

function VectorLabel({
  text,
  position,
  axis = false,
}: {
  text: string;
  position: Point3;
  axis?: boolean;
}) {
  const scale = axis ? 0.032 : 0.04;
  const material = axis ? 'qubitCyan' : 'qubitIvory';
  return (
    <ViroText
      text={text}
      position={position}
      width={axis ? 1.3 : 2.5}
      height={1}
      scale={[scale, scale, scale]}
      // Positive depth uses native vector glyph geometry instead of a stretched bitmap atlas.
      extrusionDepth={0.015}
      materials={[material, material, material]}
      maxLines={1}
      textLineBreakMode="None"
      transformBehaviors={['billboard']}
      style={{
        fontSize: 64,
        fontWeight: 'bold',
        color: axis ? '#00c7ff' : '#fff1da',
        textAlign: 'center',
      }}
    />
  );
}

function BlochSphere({ context, controller }: QubitSceneProps) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const reduceMotion = useQubitReducedMotion(controller, context, state);
  const motion = qubitMotion(state, reduceMotion);
  const scope = {
    sessionId: context.sessionId,
    placementRevision: state.placementRevision,
    roundId: state.roundId,
  };
  const interactive = canManipulateQubit(state);
  return (
    <ViroNode
      position={blochSpherePosition(state.sphereScale, state.sphereHeight)}
      rotation={[0, state.sphereYaw, 0]}
      scale={[state.sphereScale, state.sphereScale, state.sphereScale]}
      onPinch={
        interactive
          ? (gesture, factor) => controller.pinchSphere(scope, gesture, factor)
          : undefined
      }
      onRotate={
        interactive
          ? (gesture, degrees) => controller.rotateSphere(scope, gesture, degrees)
          : undefined
      }>
      <ViroSphere
        radius={BLOCH_RADIUS}
        widthSegmentCount={64}
        heightSegmentCount={48}
        opacity={0.13}
        materials={['qubitShell']}
        renderingOrder={1}
      />
      {rings.map(({ points, plane }) => (
        <ViroPolyline key={plane} points={points} thickness={0.001} materials={['qubitCyan']} />
      ))}
      <ViroPolyline
        points={[
          [-0.145, 0, 0],
          [0.145, 0, 0],
        ]}
        thickness={0.001}
        materials={['qubitCyan']}
      />
      <ViroPolyline
        points={[
          [0, -0.145, 0],
          [0, 0.145, 0],
        ]}
        thickness={0.001}
        materials={['qubitCyan']}
      />
      <ViroPolyline
        points={[
          [0, 0, -0.145],
          [0, 0, 0.145],
        ]}
        thickness={0.001}
        materials={['qubitCyan']}
      />
      {BASIS_LABELS.map((label) => (
        <VectorLabel key={label.text} text={label.text} position={label.position} />
      ))}
      <VectorLabel axis text="X" position={[0.105, 0.022, 0]} />
      <VectorLabel axis text="Y" position={[0.018, 0.022, -0.105]} />
      <VectorLabel axis text="Z" position={[0.025, 0.115, 0]} />
      <ViroNode
        key={motion.key}
        rotation={[0, 0, motion.angle]}
        animation={{
          name: motion.name,
          run: motion.run,
          onFinish: () => {
            if (motion.collapsing) controller.finishCollapse(context.sessionId, state.roundId);
            else controller.finishIntro(context.sessionId, state.roundId);
          },
        }}>
        <ViroBox
          position={[0, 0.052, 0]}
          width={0.0035}
          height={0.104}
          length={0.0035}
          materials={['qubitMagenta']}
        />
        <ViroGeometry
          vertices={ARROW_VERTICES}
          triangleIndices={ARROW_TRIANGLES}
          materials={['qubitMagenta']}
        />
        <StatePoint key={motion.pulse ? 'pulse' : 'point'} pulse={motion.pulse} />
      </ViroNode>
    </ViroNode>
  );
}

export default function QubitScene({
  sceneNavigator,
}: {
  sceneNavigator: { viroAppProps: QubitSceneProps };
}) {
  const { context, controller } = sceneNavigator.viroAppProps;
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const selector = useRef<ViroARPlaneSelector>(null);
  const selected = useRef<string | null>(null);
  useEffect(() => {
    selected.current = null;
    selector.current?.reset();
  }, [state.placementRevision]);
  return (
    <ViroARScene
      anchorDetectionTypes={['PlanesHorizontal']}
      toneMappingEnabled={false}
      onAnchorFound={(anchor) => selector.current?.handleAnchorFound(anchor)}
      onAnchorUpdated={(anchor) => selector.current?.handleAnchorUpdated(anchor)}
      onAnchorRemoved={(anchor) => {
        if (anchor) selector.current?.handleAnchorRemoved(anchor);
      }}
      onError={context.onError}
      onTrackingUpdated={(tracking) => {
        const normal = tracking === ViroTrackingStateConstants.TRACKING_NORMAL;
        controller.setTracking(context.sessionId, normal);
        if (normal) context.onReady();
        context.onInstruction(
          normal
            ? selected.current
              ? ''
              : PLACEMENT_CAPTION
            : 'Tracking is limited. Move slowly in a well-lit space.'
        );
      }}>
      <ViroARPlaneSelector
        ref={selector}
        alignment="Horizontal"
        minWidth={0.3}
        minHeight={0.3}
        hideOverlayOnSelection
        disableClickSelection={!state.tracking || state.placed}
        onPlaneSelected={(plane) => {
          const current = controller.getSnapshot();
          if (
            current.sessionId !== context.sessionId ||
            current.placementRevision !== state.placementRevision ||
            !current.tracking ||
            current.placed
          ) {
            if (!current.placed) selector.current?.reset();
            return;
          }
          controller.setPlaced(context.sessionId, true, state.placementRevision);
          if (controller.getSnapshot().placed) {
            selected.current = plane.anchorId;
            context.onInstruction('');
          } else selector.current?.reset();
        }}
        onPlaneRemoved={(id) => {
          const current = controller.getSnapshot();
          if (
            current.sessionId !== context.sessionId ||
            current.placementRevision !== state.placementRevision
          )
            return;
          if (selected.current === id) {
            selected.current = null;
            controller.setPlaced(context.sessionId, false, state.placementRevision);
            context.onInstruction(PLACEMENT_CAPTION);
          }
        }}>
        {state.placed ? <BlochSphere context={context} controller={controller} /> : null}
      </ViroARPlaneSelector>
    </ViroARScene>
  );
}
