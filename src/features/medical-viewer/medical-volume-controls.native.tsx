import { useEffect, useState } from 'react';
import {
  BottomSheet,
  Button,
  Column,
  Host,
  RNHostView,
  ScrollView,
  Slider,
  Switch,
} from '@expo/ui';
import { accessibilityLabel, accessibilityValue, frame } from '@expo/ui/swift-ui/modifiers';
import { fillMaxWidth, height, semantics } from '@expo/ui/jetpack-compose/modifiers';
import { Platform, Text, useWindowDimensions, View } from 'react-native';
import { ARControl } from '@/features/ar/ar-control.native';
import { ARTransformControls } from '@/features/ar/ar-transform-controls.native';
import {
  canManipulateVolume,
  type MedicalController,
  type MedicalSnapshot,
} from './medical-controller';
import {
  VOLUME_PRESETS,
  VolumeControlScheduler,
  volumeControlRanges,
  type VolumePreset,
} from './medical-volumes';

interface ControlsProps {
  controller: MedicalController;
  state: MedicalSnapshot;
  sessionId: number;
}
function ScanSlider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  disabled = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const spokenValue = `${value.toFixed(1)}`;
  return (
    <View className="gap-1">
      <Text className="text-base text-slate-200" style={{ fontVariant: ['tabular-nums'] }}>
        {label}: {spokenValue}
      </Text>
      <Host
        matchContents={{ vertical: true }}
        colorScheme="dark"
        style={{ width: '100%', minHeight: 48 }}>
        <Slider
          value={value}
          min={min}
          max={Math.max(max, min + step)}
          step={step}
          disabled={disabled || max <= min}
          onValueChange={onChange}
          testID={`medical-volume-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`}
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
function ScanToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Host
      matchContents={{ vertical: true }}
      colorScheme="dark"
      style={{ minHeight: 48, width: '100%' }}>
      <Switch
        label={label}
        value={value}
        onValueChange={onChange}
        testID={`medical-volume-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`}
      />
    </Host>
  );
}
export function MedicalVolumeSheet({ controller, state, sessionId }: ControlsProps) {
  const { height: windowHeight } = useWindowDimensions();
  const [scheduler] = useState(
    () => new VolumeControlScheduler(requestAnimationFrame, cancelAnimationFrame)
  );
  const { volume } = state,
    series = controller.getVolumeSeries();
  const scope = {
    sessionId,
    placementRevision: state.placementRevision,
    requestId: volume.requestId,
  };
  useEffect(
    () => () => scheduler.clear(),
    [scheduler, sessionId, state.placementRevision, volume.requestId, volume.controlsOpen]
  );
  if (!volume.controlsOpen || state.mode !== 'volume' || !series) return null;
  const appearance = volume.appearance[volume.modality],
    ranges = volumeControlRanges(series, appearance);
  const queue = (key: string, action: () => void) => scheduler.select(key, action);
  const close = () => {
    scheduler.clear();
    controller.openVolumeControls(sessionId, false);
  };
  const labels = [
    'Left boundary · RAS R mm',
    'Right boundary · RAS R mm',
    'Back boundary · RAS A mm',
    'Front boundary · RAS A mm',
    'Bottom boundary · RAS S mm',
    'Top boundary · RAS S mm',
  ];
  return (
    <Host colorScheme="dark">
      <BottomSheet
        isPresented
        onDismiss={close}
        snapPoints={['full']}
        testID="medical-volume-sheet">
        <Column style={{ padding: 16 }}>
          <Button onPress={close}>Done</Button>
          <ScrollView style={{ height: Math.min(windowHeight * 0.72, 720) }}>
            <RNHostView matchContents>
              <View className="gap-4 p-3">
                <Text className="text-xl font-semibold text-white">
                  {volume.modality.toUpperCase()} · Scan Controls
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {(Object.keys(VOLUME_PRESETS) as VolumePreset[])
                    .filter((key) => VOLUME_PRESETS[key].modality === volume.modality)
                    .map((preset) => (
                      <ARControl
                        key={preset}
                        testID={`medical-volume-preset-${preset}`}
                        label={VOLUME_PRESETS[preset].label}
                        selected={appearance.preset === preset}
                        onPress={() => {
                          scheduler.clear();
                          controller.setVolumePreset(scope, preset);
                        }}
                      />
                    ))}
                </View>
                <ScanSlider
                  label="Window"
                  value={appearance.window}
                  min={ranges.window[0]}
                  max={ranges.window[1]}
                  onChange={(value) =>
                    queue('window', () => controller.setVolumeAppearance(scope, 'window', value))
                  }
                />
                <ScanSlider
                  label="Level"
                  value={appearance.level}
                  min={ranges.level[0]}
                  max={ranges.level[1]}
                  onChange={(value) =>
                    queue('level', () => controller.setVolumeAppearance(scope, 'level', value))
                  }
                />
                <ScanSlider
                  label="Transparency %"
                  value={(2 - appearance.opacity) * 50}
                  min={0}
                  max={100}
                  onChange={(value) =>
                    queue('opacity', () =>
                      controller.setVolumeAppearance(scope, 'opacity', 2 - value / 50)
                    )
                  }
                />
                <Text className="text-lg font-semibold text-white">Rendering quality</Text>
                <View className="flex-row flex-wrap gap-2">
                  {(['balanced', 'fast'] as const).map((quality) => (
                    <ARControl
                      key={quality}
                      testID={`medical-volume-quality-${quality}`}
                      label={quality === 'balanced' ? 'Balanced' : 'Fast'}
                      selected={volume.quality === quality}
                      onPress={() => controller.configureVolume(scope, { quality })}
                    />
                  ))}
                </View>
                <Text className="text-lg font-semibold text-white">Cropping</Text>
                <ScanToggle
                  label="Enable cropping"
                  value={volume.cropping}
                  onChange={(cropping) => controller.configureVolume(scope, { cropping })}
                />
                <ScanToggle
                  label="Show crop box"
                  value={volume.cropBoxVisible}
                  onChange={(cropBoxVisible) =>
                    controller.configureVolume(scope, { cropBoxVisible })
                  }
                />
                {labels.map((label, index) => (
                  <ScanSlider
                    key={label}
                    label={label}
                    value={volume.crop[index]}
                    min={
                      index % 2 === 0
                        ? controller.volumeDataset.boundsRasMm[index]
                        : volume.crop[index - 1] + controller.volumeDataset.spacingMm
                    }
                    max={
                      index % 2 === 0
                        ? volume.crop[index + 1] - controller.volumeDataset.spacingMm
                        : controller.volumeDataset.boundsRasMm[index]
                    }
                    step={controller.volumeDataset.spacingMm}
                    disabled={!volume.cropping}
                    onChange={(value) =>
                      queue(`crop${index}`, () => controller.setVolumeCrop(scope, index, value))
                    }
                  />
                ))}
                <View className="flex-row flex-wrap gap-2">
                  <ARControl
                    label="Reset Crop"
                    testID="medical-volume-reset-crop"
                    onPress={() => {
                      scheduler.clear();
                      controller.resetVolumeCrop(sessionId);
                    }}
                  />
                  <ARControl
                    label="Reset Scan"
                    testID="medical-volume-reset-scan"
                    onPress={() => {
                      scheduler.clear();
                      controller.resetVolumeScan(sessionId);
                    }}
                  />
                </View>
              </View>
            </RNHostView>
          </ScrollView>
        </Column>
      </BottomSheet>
    </Host>
  );
}
export function MedicalVolumeControls({
  controller,
  state,
  sessionId,
  onTransform,
  onRestart,
}: ControlsProps & { onTransform: () => void; onRestart: () => void }) {
  return (
    <View className="gap-3" testID="medical-volume-controls">
      <View className="flex-row flex-wrap justify-center gap-2">
        {(['mri', 'ct'] as const).map((modality) => (
          <ARControl
            key={modality}
            label={modality.toUpperCase()}
            selected={state.volume.modality === modality}
            disabled={!controller.getVolumeSeries(modality)}
            testID={`medical-volume-modality-${modality}`}
            onPress={() => controller.selectVolumeModality(sessionId, modality)}
          />
        ))}
      </View>
      <View className="flex-row flex-wrap justify-center gap-2">
        <ARControl
          label="Scan Controls"
          testID="medical-volume-scan-controls"
          disabled={!controller.getVolumeSeries()}
          onPress={() => controller.openVolumeControls(sessionId, true)}
        />
        <ARControl
          label="Transform"
          testID="medical-volume-transform"
          disabled={!state.anchorId}
          onPress={onTransform}
        />
        <ARControl
          label="Reset Transform"
          testID="medical-volume-reset-transform"
          disabled={!state.anchorId}
          onPress={() => controller.resetVolumeTransform(sessionId)}
        />
        <ARControl label="Restart AR" testID="medical-volume-restart-ar" onPress={onRestart} />
      </View>
    </View>
  );
}
export function MedicalVolumeTransformControls({
  controller,
  state,
  sessionId,
  stacked,
  onDone,
}: ControlsProps & { stacked: boolean; onDone: () => void }) {
  const scope = {
    sessionId,
    placementRevision: state.placementRevision,
    requestId: state.volume.requestId,
  };
  return (
    <ARTransformControls
      {...state.volume}
      disabled={!canManipulateVolume(state)}
      repositionDisabled={!state.anchorId}
      testIDPrefix="medical-volume"
      stacked={stacked}
      onDone={onDone}
      onScaleChange={(value) => controller.setVolumeTransform(scope, 'scale', value)}
      onYawChange={(value) => controller.setVolumeTransform(scope, 'yaw', value)}
      onHeightChange={(value) => controller.setVolumeTransform(scope, 'height', value)}
      onReposition={() => controller.reposition(sessionId)}
    />
  );
}
