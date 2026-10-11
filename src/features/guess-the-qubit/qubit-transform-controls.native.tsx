import { ARTransformEditor } from '@/features/ar/ar-transform-editor.native';
import {
  canManipulateQubit,
  type QubitRoundController,
  type QubitSnapshot,
  type QubitTransformScope,
} from './qubit-round-controller';

export function QubitTransformControls({
  controller,
  state,
  scope,
  stacked,
  onDone,
}: {
  controller: QubitRoundController;
  state: QubitSnapshot;
  scope: QubitTransformScope;
  stacked: boolean;
  onDone: () => void;
}) {
  return (
    <ARTransformEditor
      key={`${scope.sessionId}:${scope.placementRevision}:${scope.roundId}`}
      position={{ x: state.sphereX, y: state.sphereHeight, z: state.sphereZ }}
      onPositionChange={(axis, value) => controller.setSpherePosition(scope, axis, value)}
      testIDPrefix="qubit"
      scale={state.sphereScale}
      yaw={state.sphereYaw}
      height={state.sphereHeight}
      disabled={!canManipulateQubit(state)}
      pinching={state.pinching}
      rotating={state.rotating}
      repositionDisabled={!state.placed}
      stacked={stacked}
      onScaleChange={(value) => controller.setSphereScale(scope, value)}
      onYawChange={(value) => controller.setSphereYaw(scope, value)}
      onHeightChange={(value) => controller.setSphereHeight(scope, value)}
      onReposition={() => controller.reposition(scope)}
      onDone={onDone}
    />
  );
}
