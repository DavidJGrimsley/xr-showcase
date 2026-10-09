import { useEffect, useRef, useSyncExternalStore } from 'react';
import {
  Viro3DObject,
  ViroAmbientLight,
  ViroARPlaneSelector,
  ViroARScene,
  ViroDirectionalLight,
  ViroMaterials,
  ViroNode,
  ViroPolyline,
  ViroSphere,
  ViroText,
  ViroTrackingStateConstants,
} from '@reactvision/react-viro';
import type { ARSceneContext } from '@/features/ar/ar-session-types';
import type { MedicalController, MedicalScope } from './medical-controller';
import { canManipulateMedical } from './medical-controller';
import type { Point3 } from './medical-models';
import calibration from '../../../assets/medical/skull-labels.json';

// Metro needs a literal require to include this non-image binary asset.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const skullSource = require('../../../assets/medical/skull.glb');
ViroMaterials.createMaterials({
  medicalLabel: { diffuseColor: '#fff1da', lightingModel: 'Constant' },
  medicalLeader: { diffuseColor: '#93f5c5', lightingModel: 'Constant' },
});

export interface MedicalSceneProps {
  context: ARSceneContext;
  controller: MedicalController;
}

function Skull({ context, controller }: MedicalSceneProps) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const scope: MedicalScope = {
    sessionId: context.sessionId,
    placementRevision: state.placementRevision,
    loadAttempt: state.loadAttempt,
  };
  useEffect(() => {
    if (state.loadStatus !== 'loading') return;
    const token = {
      sessionId: context.sessionId,
      placementRevision: state.placementRevision,
      loadAttempt: state.loadAttempt,
    };
    const timeout = setTimeout(() => controller.finishLoad(token, false), 30000);
    return () => clearTimeout(timeout);
  }, [controller, context.sessionId, state.loadStatus, state.placementRevision, state.loadAttempt]);
  const interactive = canManipulateMedical(state);
  if (!state.anchorId || state.loadStatus === 'error') return null;
  return (
    <ViroNode
      position={[0, state.height, 0]}
      rotation={[0, state.yaw, 0]}
      scale={[state.scale, state.scale, state.scale]}
      onPinch={
        interactive ? (gesture, factor) => controller.pinch(scope, gesture, factor) : undefined
      }
      onRotate={
        interactive ? (gesture, factor) => controller.rotate(scope, gesture, factor) : undefined
      }>
      <Viro3DObject
        key={`${state.placementRevision}:${state.loadAttempt}`}
        source={skullSource}
        type="GLB"
        onLoadEnd={() => controller.finishLoad(scope, true)}
        onError={() => controller.finishLoad(scope, false)}
      />
      {state.loadStatus === 'ready' && state.labelsVisible
        ? calibration.labels.map((label) => {
            // Keep room for fixed-size text even when the anatomy is scaled down.
            const position: Point3 = [
              Math.sign(label.position[0]) *
                (Math.abs(label.position[0]) + 0.07 * (1 / state.scale - 1)),
              label.position[1],
              label.position[2],
            ];
            return (
              <ViroNode key={label.name} ignoreEventHandling>
                <ViroSphere
                  radius={0.0015 / state.scale}
                  position={label.anchor as Point3}
                  materials={['medicalLeader']}
                />
                <ViroPolyline
                  points={[label.anchor as Point3, position]}
                  thickness={0.0007 / state.scale}
                  materials={['medicalLeader']}
                />
                <ViroText
                  text={label.name}
                  position={position}
                  width={5}
                  height={1}
                  scale={[0.028 / state.scale, 0.028 / state.scale, 0.028 / state.scale]}
                  transformBehaviors={['billboard']}
                  extrusionDepth={0.004}
                  materials={['medicalLabel', 'medicalLabel', 'medicalLabel']}
                  maxLines={1}
                  textLineBreakMode="None"
                  style={{
                    fontSize: 48,
                    fontWeight: 'bold',
                    color: '#fff1da',
                    textAlign: 'center',
                  }}
                />
              </ViroNode>
            );
          })
        : null}
    </ViroNode>
  );
}

export default function MedicalScene({
  sceneNavigator,
}: {
  sceneNavigator: { viroAppProps: MedicalSceneProps };
}) {
  const { context, controller } = sceneNavigator.viroAppProps;
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const selector = useRef<ViroARPlaneSelector>(null);
  useEffect(() => {
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
      }}>
      <ViroAmbientLight color="#ffffff" intensity={550} />
      <ViroDirectionalLight color="#ffffff" intensity={750} direction={[-1, -1, -1]} />
      <ViroARPlaneSelector
        ref={selector}
        alignment="Horizontal"
        minWidth={0.25}
        minHeight={0.25}
        hideOverlayOnSelection
        disableClickSelection={state.tracking !== 'normal' || !!state.anchorId}
        onPlaneSelected={(plane) => {
          controller.selectPlane(context.sessionId, state.placementRevision, plane.anchorId);
          // A tap already queued by native code can arrive after tracking changes.
          // Restore selection UI if the controller rejected that placement.
          if (!controller.getSnapshot().anchorId) selector.current?.reset();
        }}
        onPlaneRemoved={(id) =>
          controller.losePlane(context.sessionId, state.placementRevision, id)
        }>
        <Skull context={context} controller={controller} />
      </ViroARPlaneSelector>
    </ViroARScene>
  );
}
