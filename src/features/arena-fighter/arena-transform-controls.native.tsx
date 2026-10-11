import { ARTransformControls } from '@/features/ar/ar-transform-controls.native';
import { ARPositionControls } from '@/features/ar/ar-position-controls.native';
import { View } from 'react-native';
import { ARENA_FONTS, ArenaButton, useArenaColors } from './arena-ui';
import type { ArenaMatch, MatchSnapshot } from './arena-match';
import type { ArenaTransformScope } from './arena-transform';

export default function ArenaTransformControls({
  controller,
  state,
  scope,
  onDone,
  positioning,
  onPosition,
}: {
  controller: ArenaMatch;
  state: MatchSnapshot;
  scope: ArenaTransformScope;
  onDone: () => void;
  positioning: boolean;
  onPosition: () => void;
}) {
  const colors = useArenaColors();
  return (
    <View style={{ gap: 12 }}>
      {positioning ? (
        <ARPositionControls
          compact
          fontFamily={ARENA_FONTS.body}
          seedColor={colors.primary}
          position={{
            x: state.arenaTransform.x,
            y: state.arenaTransform.height,
            z: state.arenaTransform.z,
          }}
          disabled={!state.canTransform}
          testIDPrefix="arena"
          onChange={(axis, value) => controller.setPosition(scope, axis, value)}
          onDone={onDone}
        />
      ) : (
        <ARTransformControls
          compact
          fontFamily={ARENA_FONTS.body}
          seedColor={colors.primary}
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
          onPosition={onPosition}
          positionControl={
            <ArenaButton
              label="Position"
              primary
              disabled={!state.canTransform}
              testID="arena-transform-position"
              onPress={onPosition}
            />
          }
          onDone={onDone}
        />
      )}
    </View>
  );
}
