import { Host, Slider } from '@expo/ui';
import { accessibilityLabel, accessibilityValue, frame } from '@expo/ui/swift-ui/modifiers';
import { fillMaxWidth, height, semantics } from '@expo/ui/jetpack-compose/modifiers';
import { Platform, Text, View } from 'react-native';
import {
  MAX_AR_HEIGHT,
  MAX_AR_SCALE,
  METRES_PER_FOOT,
  MIN_AR_HEIGHT,
  MIN_AR_SCALE,
} from './ar-transform';
import { ARControl } from './ar-control.native';

export function ARTransformSlider({
  label,
  value,
  spokenValue,
  min,
  max,
  disabled,
  stacked,
  onValueChange,
  testID,
}: {
  label: string;
  value: number;
  spokenValue: string;
  min: number;
  max: number;
  disabled: boolean;
  stacked: boolean;
  onValueChange: (value: number) => void;
  testID: string;
}) {
  return (
    <View
      className="gap-3"
      style={{
        flexDirection: stacked ? 'column' : 'row',
        alignItems: stacked ? 'stretch' : 'center',
      }}>
      <Text className="text-base text-slate-200" style={stacked ? undefined : { width: 64 }}>
        {label}
      </Text>
      <Host
        colorScheme="dark"
        seedColor="#93f5c5"
        matchContents={{ vertical: true }}
        style={{
          ...(stacked ? {} : { flex: 1 }),
          minHeight: 48,
          width: stacked ? '100%' : undefined,
        }}>
        <Slider
          testID={testID}
          value={value}
          min={min}
          max={max}
          disabled={disabled}
          onValueChange={onValueChange}
          modifiers={
            Platform.OS === 'ios'
              ? [
                  frame({ minHeight: 48, maxWidth: Infinity }),
                  accessibilityLabel(label),
                  accessibilityValue(spokenValue),
                ]
              : [
                  fillMaxWidth(),
                  height(48),
                  semantics({ contentDescription: `${label}, ${spokenValue}` }),
                ]
          }
        />
      </Host>
    </View>
  );
}

export function ARTransformControls({
  scale,
  yaw,
  height,
  disabled,
  pinching,
  rotating,
  repositionDisabled,
  testIDPrefix,
  onScaleChange,
  onYawChange,
  onHeightChange,
  onPosition,
  onReposition,
  stacked,
  onDone,
}: {
  scale: number;
  yaw: number;
  height: number;
  disabled: boolean;
  pinching: boolean;
  rotating: boolean;
  repositionDisabled: boolean;
  testIDPrefix: string;
  onScaleChange: (value: number) => void;
  onYawChange: (value: number) => void;
  onHeightChange: (value: number) => void;
  onPosition?: () => void;
  onReposition?: () => void;
  stacked: boolean;
  onDone: () => void;
}) {
  const sliderYaw = ((yaw % 360) + 360) % 360;
  return (
    <View testID={`${testIDPrefix}-transform-controls`} className="gap-3">
      <ARTransformSlider
        label="Scale"
        testID={`${testIDPrefix}-transform-scale`}
        value={scale}
        spokenValue={`${scale.toFixed(2)} times original size`}
        min={MIN_AR_SCALE}
        max={MAX_AR_SCALE}
        disabled={disabled || pinching}
        stacked={stacked}
        onValueChange={onScaleChange}
      />
      <ARTransformSlider
        label="Rotate"
        testID={`${testIDPrefix}-transform-rotate`}
        value={sliderYaw}
        spokenValue={`${Math.round(sliderYaw)} degrees`}
        min={0}
        max={360}
        disabled={disabled || rotating}
        stacked={stacked}
        onValueChange={onYawChange}
      />
      {onPosition ? (
        <ARControl
          label="Position"
          disabled={disabled}
          testID={`${testIDPrefix}-transform-position`}
          onPress={onPosition}
        />
      ) : (
        <ARTransformSlider
          label="Height"
          testID={`${testIDPrefix}-transform-height`}
          value={height}
          spokenValue={`${(height / METRES_PER_FOOT).toFixed(1)} feet above the surface`}
          min={MIN_AR_HEIGHT}
          max={MAX_AR_HEIGHT}
          disabled={disabled}
          stacked={stacked}
          onValueChange={onHeightChange}
        />
      )}
      <View
        className="items-center justify-center gap-2"
        style={{ flexDirection: stacked ? 'column' : 'row', flexWrap: 'wrap' }}>
        {onReposition && (
          <ARControl
            label="Reposition"
            disabled={repositionDisabled}
            testID={`${testIDPrefix}-reposition`}
            onPress={() => {
              onReposition();
              onDone();
            }}
          />
        )}
        <ARControl label="Done" testID={`${testIDPrefix}-transform-done`} onPress={onDone} />
      </View>
    </View>
  );
}
