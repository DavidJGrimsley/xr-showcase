import { Text, View } from 'react-native';
import { ARControl } from './ar-control.native';
import { ARTransformSlider } from './ar-transform-controls.native';
import { MAX_AR_HEIGHT, METRES_PER_FOOT } from './ar-transform';

export type ARPositionAxis = 'x' | 'y' | 'z';

/** Position offsets in metres, relative to the placed object's axes. */
export function ARPositionControls({
  position,
  disabled,
  testIDPrefix,
  onChange,
  onDone,
}: {
  position: Record<ARPositionAxis, number>;
  disabled: boolean;
  testIDPrefix: string;
  onChange: (axis: ARPositionAxis, value: number) => void;
  onDone: () => void;
}) {
  const labels = { x: 'X · Left / right', y: 'Y · Up / down', z: 'Z · Forward / back' };
  return (
    <View testID={`${testIDPrefix}-position-controls`} className="gap-3">
      {(['x', 'y', 'z'] as const).map((axis) => (
        <View key={axis} className="gap-1">
          <ARTransformSlider
            label={labels[axis]}
            value={position[axis]}
            spokenValue={`${(position[axis] / METRES_PER_FOOT).toFixed(1)} feet`}
            min={axis === 'y' ? 0 : -MAX_AR_HEIGHT}
            max={MAX_AR_HEIGHT}
            disabled={disabled}
            stacked
            testID={`${testIDPrefix}-position-${axis}`}
            onValueChange={(value) => onChange(axis, value)}
          />
          <Text className="text-sm text-slate-300">{(position[axis] * 100).toFixed(0)} cm</Text>
        </View>
      ))}
      <ARControl label="Done" testID={`${testIDPrefix}-position-done`} onPress={onDone} />
    </View>
  );
}
