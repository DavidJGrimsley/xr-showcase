import { useWindowDimensions } from 'react-native';
import { ARTransformEditor } from '@/features/ar/ar-transform-editor.native';
import { ARENA_FONTS, useArenaColors } from './arena-ui';
import type { ArenaMatch, MatchSnapshot } from './arena-match';
import type { ArenaTransformScope } from './arena-transform';

export default function ArenaTransformControls({
  controller,
  state,
  scope,
  onDone,
  positioning,
  onPositioningChange,
  onReposition,
}: {
  controller: ArenaMatch;
  state: MatchSnapshot;
  scope: ArenaTransformScope;
  onDone: () => void;
  positioning: boolean;
  onPositioningChange: (positioning: boolean) => void;
  onReposition: () => void;
}) {
  const colors = useArenaColors();
  const { fontScale } = useWindowDimensions();
  return (
    <ARTransformEditor
      key={`${scope.sessionToken}:${scope.placementVersion}`}
      fontFamily={ARENA_FONTS.body}
      seedColor={colors.primary}
      testIDPrefix="arena"
      position={{
        x: state.arenaTransform.x,
        y: state.arenaTransform.height,
        z: state.arenaTransform.z,
      }}
      scale={state.arenaTransform.scale}
      yaw={state.arenaTransform.yaw}
      height={state.arenaTransform.height}
      disabled={!state.canTransform}
      pinching={state.pinching}
      rotating={state.rotating}
      repositionDisabled={!state.canTransform}
      stacked={fontScale > 1.3}
      positioning={positioning}
      onPositioningChange={onPositioningChange}
      onPositionChange={(axis, value) => controller.setPosition(scope, axis, value)}
      onScaleChange={(value) => controller.setScale(scope, value)}
      onYawChange={(value) => controller.setYaw(scope, value)}
      onHeightChange={(value) => controller.setHeight(scope, value)}
      onReposition={onReposition}
      onDone={onDone}
    />
  );
}
