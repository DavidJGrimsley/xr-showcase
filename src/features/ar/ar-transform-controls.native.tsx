import { Host, Slider } from '@expo/ui';
import { accessibilityLabel, accessibilityValue, frame } from '@expo/ui/swift-ui/modifiers';
import { fillMaxWidth, height, semantics } from '@expo/ui/jetpack-compose/modifiers';
import { Platform, Text, View } from 'react-native';
import type { ReactNode } from 'react';
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
  compact = false,
  fontFamily,
  seedColor = '#93f5c5',
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
  compact?: boolean;
  fontFamily?: string;
  seedColor?: string;
}) {
  return (
    <View
      style={{
        gap: compact ? 2 : 12,
        flexDirection: stacked ? 'column' : 'row',
        alignItems: stacked ? 'stretch' : 'center',
      }}>
      <Text
        style={{ fontFamily, fontSize: 16, color: '#e2e8f0', ...(stacked ? {} : { width: 64 }) }}>
        {label}
      </Text>
      <Host
        colorScheme="dark"
        seedColor={seedColor}
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
  positionControl,
  onReposition,
  stacked,
  onDone,
  compact = false,
  fontFamily,
  seedColor,
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
  positionControl?: ReactNode;
  onReposition?: () => void;
  stacked: boolean;
  onDone: () => void;
  compact?: boolean;
  fontFamily?: string;
  seedColor?: string;
}) {
  const sliderYaw = ((yaw % 360) + 360) % 360;
  return (
    <View testID={`${testIDPrefix}-transform-controls`} style={{ gap: compact ? 6 : 12 }}>
      <ARTransformSlider
        label="Scale"
        compact={compact}
        fontFamily={fontFamily}
        seedColor={seedColor}
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
        compact={compact}
        fontFamily={fontFamily}
        seedColor={seedColor}
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
        (positionControl ?? (
          <ARControl
            label="Position"
            fontFamily={fontFamily}
            seedColor={seedColor}
            disabled={disabled}
            testID={`${testIDPrefix}-transform-position`}
            onPress={onPosition}
          />
        ))
      ) : (
        <ARTransformSlider
          label="Height"
          compact={compact}
          fontFamily={fontFamily}
          seedColor={seedColor}
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
      {!compact && (
        <View
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            flexDirection: stacked ? 'column' : 'row',
            flexWrap: 'wrap',
          }}>
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
      )}
    </View>
  );
}
