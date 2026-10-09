import { ARTransformControls } from '@/features/ar/ar-transform-controls.native';
import {
  canManipulateMedical,
  type MedicalController,
  type MedicalScope,
  type MedicalSnapshot,
} from './medical-controller';

export function MedicalTransformControls({
  controller,
  state,
  scope,
  stacked,
  onDone,
}: {
  controller: MedicalController;
  state: MedicalSnapshot;
  scope: MedicalScope;
  stacked: boolean;
  onDone: () => void;
}) {
  return (
    <ARTransformControls
      testIDPrefix="medical"
      scale={state.scale}
      yaw={state.yaw}
      height={state.height}
      disabled={!canManipulateMedical(state)}
      pinching={state.pinching}
      rotating={state.rotating}
      repositionDisabled={!state.anchorId}
      stacked={stacked}
      onScaleChange={(value) => controller.setScale(scope, value)}
      onYawChange={(value) => controller.setYaw(scope, value)}
      onHeightChange={(value) => controller.setHeight(scope, value)}
      onReposition={() => controller.reposition(scope.sessionId)}
      onDone={onDone}
    />
  );
}
