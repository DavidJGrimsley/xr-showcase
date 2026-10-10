import { ARTransformControls } from '@/features/ar/ar-transform-controls.native';
import type { ArenaMatch, MatchSnapshot } from './arena-match';
import type { ArenaTransformScope } from './arena-transform';

export default function ArenaTransformControls({
  controller,
  state,
  scope,
  onReposition,
  onDone,
}: {
  controller: ArenaMatch;
  state: MatchSnapshot;
  scope: ArenaTransformScope;
  onReposition: () => void;
  onDone: () => void;
}) {
  return (
    <ARTransformControls
      testIDPrefix="arena"
      scale={state.arenaTransform.scale}
      yaw={state.arenaTransform.yaw}
      height={state.arenaTransform.height}
      disabled={!state.canTransform}
      pinching={state.pinching}
      rotating={state.rotating}
      repositionDisabled={!state.canTransform}
      stacked
      onScaleChange={(value) => controller.setScale(scope, value)}
      onYawChange={(value) => controller.setYaw(scope, value)}
      onHeightChange={(value) => controller.setHeight(scope, value)}
      onReposition={onReposition}
      onDone={onDone}
    />
  );
}
