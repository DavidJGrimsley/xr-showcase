import { ARTransformControls } from '@/features/ar/ar-transform-controls.native';
import { ARPositionControls } from '@/features/ar/ar-position-controls.native';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useAppTheme } from '@/theme/provider';
import type { ArenaMatch, MatchSnapshot } from './arena-match';
import type { ArenaTransformScope } from './arena-transform';

export default function ArenaTransformControls({
  controller,
  state,
  scope,
  onDone,
}: {
  controller: ArenaMatch;
  state: MatchSnapshot;
  scope: ArenaTransformScope;
  onDone: () => void;
}) {
  const [positioning, setPositioning] = useState(false);
  const { activeColors: colors } = useAppTheme();
  return (
    <View className="gap-3">
      <Text className="font-semibold text-lg" style={{ color: colors.text }}>
        {positioning ? 'Position arena' : 'Transform arena'}
      </Text>
      {positioning ? (
        <ARPositionControls
          position={{
            x: state.arenaTransform.x,
            y: state.arenaTransform.height,
            z: state.arenaTransform.z,
          }}
          disabled={!state.canTransform}
          testIDPrefix="arena"
          onChange={(axis, value) => controller.setPosition(scope, axis, value)}
          onDone={() => setPositioning(false)}
        />
      ) : (
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
          onPosition={() => setPositioning(true)}
          onDone={onDone}
        />
      )}
    </View>
  );
}
