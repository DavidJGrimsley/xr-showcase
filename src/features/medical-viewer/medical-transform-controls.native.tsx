import { Host, Slider } from '@expo/ui';
import { accessibilityLabel, accessibilityValue, frame } from '@expo/ui/swift-ui/modifiers';
import { fillMaxWidth, height, semantics } from '@expo/ui/jetpack-compose/modifiers';
import { Platform, Text, View } from 'react-native';
import {
  canManipulateMedical,
  MAX_MODEL_HEIGHT,
  MAX_MODEL_SCALE,
  MIN_MODEL_HEIGHT,
  MIN_MODEL_SCALE,
  type MedicalController,
  type MedicalScope,
  type MedicalSnapshot,
} from './medical-controller';
import { MedicalControl } from './medical-control.native';

function TransformSlider({
  label,
  value,
  spokenValue,
  min,
  max,
  disabled,
  stacked,
  onValueChange,
}: {
  label: string;
  value: number;
  spokenValue: string;
  min: number;
  max: number;
  disabled: boolean;
  stacked: boolean;
  onValueChange: (value: number) => void;
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
          testID={`medical-transform-${label.toLowerCase()}`}
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
  const ready = canManipulateMedical(state);
  const yaw = ((state.yaw % 360) + 360) % 360;
  return (
    <View testID="medical-transform-controls" className="gap-3">
      <TransformSlider
        label="Scale"
        value={state.scale}
        spokenValue={`${state.scale.toFixed(2)} times original size`}
        min={MIN_MODEL_SCALE}
        max={MAX_MODEL_SCALE}
        disabled={!ready || state.pinching}
        stacked={stacked}
        onValueChange={(value) => controller.setScale(scope, value)}
      />
      <TransformSlider
        label="Rotate"
        value={yaw}
        spokenValue={`${Math.round(yaw)} degrees`}
        min={0}
        max={360}
        disabled={!ready || state.rotating}
        stacked={stacked}
        onValueChange={(value) => controller.setYaw(scope, value)}
      />
      <TransformSlider
        label="Height"
        value={state.height}
        spokenValue={`${(state.height / 0.3048).toFixed(1)} feet above the surface`}
        min={MIN_MODEL_HEIGHT}
        max={MAX_MODEL_HEIGHT}
        disabled={!ready}
        stacked={stacked}
        onValueChange={(value) => controller.setHeight(scope, value)}
      />
      <View
        className="items-center justify-center gap-2"
        style={{ flexDirection: stacked ? 'column' : 'row', flexWrap: 'wrap' }}>
        <MedicalControl
          label="Reposition"
          disabled={!state.anchorId}
          testID="medical-reposition"
          onPress={() => {
            controller.reposition(scope.sessionId);
            onDone();
          }}
        />
        <MedicalControl label="Done" testID="medical-transform-done" onPress={onDone} />
      </View>
    </View>
  );
}
