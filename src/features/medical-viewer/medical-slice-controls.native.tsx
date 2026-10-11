import { useEffect, useState } from 'react';
import { Host, Slider } from '@expo/ui';
import { accessibilityLabel, accessibilityValue, frame } from '@expo/ui/swift-ui/modifiers';
import { fillMaxWidth, height, semantics } from '@expo/ui/jetpack-compose/modifiers';
import { Platform, Text, View } from 'react-native';
import { ARControl } from '@/features/ar/ar-control.native';
import { ARTransformControls } from '@/features/ar/ar-transform-controls.native';
import {
  canManipulateSlices,
  type MedicalController,
  type MedicalSnapshot,
} from './medical-controller';
import { SliceSelectionScheduler } from './medical-slices';

export function MedicalSliceControls({
  controller,
  state,
  sessionId,
  stacked,
  onTransform,
}: {
  controller: MedicalController;
  state: MedicalSnapshot;
  sessionId: number;
  stacked: boolean;
  onTransform: () => void;
}) {
  const [scheduler] = useState(
    () => new SliceSelectionScheduler(requestAnimationFrame, cancelAnimationFrame)
  );
  const { slices } = state;
  const series = controller.getSliceSeries();
  const scope = {
    sessionId,
    placementRevision: state.placementRevision,
    requestId: slices.requestId,
  };
  useEffect(
    () => () => scheduler.clear(),
    [scheduler, sessionId, slices.modality, slices.orientation, state.placementRevision]
  );
  const rowStyle = {
    flexDirection: stacked ? ('column' as const) : ('row' as const),
    flexWrap: 'wrap' as const,
  };
  return (
    <View className="gap-3" testID="medical-slice-controls">
      <View className="items-center justify-center gap-2" style={rowStyle}>
        {(['mri', 'ct'] as const).map((modality) => (
          <ARControl
            key={modality}
            label={modality.toUpperCase()}
            selected={slices.modality === modality}
            disabled={!controller.getSliceSeries(modality)}
            testID={`medical-modality-${modality}`}
            onPress={() => {
              scheduler.clear();
              controller.selectModality(sessionId, modality);
            }}
          />
        ))}
      </View>
      {series ? (
        <>
          <Text
            selectable
            className="text-center text-base text-slate-200"
            style={{ fontVariant: ['tabular-nums'] }}>
            Slice {slices.index + 1} / {series.imageCount} ·{' '}
            {series.slices[slices.index].positionMm.toFixed(1)} mm (RAS S)
          </Text>
          <Host
            matchContents={{ vertical: true }}
            colorScheme="dark"
            seedColor="#93f5c5"
            style={{ minHeight: 48, width: '100%' }}>
            <Slider
              testID="medical-slice-slider"
              value={slices.index}
              min={0}
              max={Math.max(1, series.imageCount - 1)}
              step={1}
              disabled={series.imageCount <= 1}
              onValueChange={(index) =>
                scheduler.schedule(() => controller.selectSlice(scope, index))
              }
              modifiers={
                Platform.OS === 'ios'
                  ? [
                      frame({ minHeight: 48, maxWidth: Infinity }),
                      accessibilityLabel('Scan slice'),
                      accessibilityValue(`${slices.index + 1} of ${series.imageCount}`),
                    ]
                  : [
                      fillMaxWidth(),
                      height(48),
                      semantics({
                        contentDescription: `Scan slice ${slices.index + 1} of ${series.imageCount}`,
                      }),
                    ]
              }
            />
          </Host>
          <View className="items-center justify-center gap-2" style={rowStyle}>
            <ARControl
              label="Previous"
              disabled={slices.index === 0}
              testID="medical-slice-previous"
              onPress={() => {
                scheduler.clear();
                controller.selectSlice(scope, slices.index - 1);
              }}
            />
            <ARControl
              label="Next"
              disabled={slices.index === series.imageCount - 1}
              testID="medical-slice-next"
              onPress={() => {
                scheduler.clear();
                controller.selectSlice(scope, slices.index + 1);
              }}
            />
            <ARControl
              label="Reset Slice"
              testID="medical-slice-reset"
              onPress={() => {
                scheduler.clear();
                controller.resetSlice(sessionId);
              }}
            />
          </View>
        </>
      ) : null}
      <View className="items-center justify-center gap-2" style={rowStyle}>
        <ARControl
          label="Transform"
          disabled={!canManipulateSlices(state)}
          testID="medical-panel-transform"
          onPress={onTransform}
        />
        <ARControl
          label="Reset Panel"
          disabled={!state.anchorId}
          testID="medical-panel-reset"
          onPress={() => controller.resetPanel(sessionId)}
        />
      </View>
      <Text className="text-center text-sm text-slate-300">
        Axial view · Patient right at image left · Anterior at top
      </Text>
    </View>
  );
}

export function MedicalPanelTransformControls({
  controller,
  state,
  sessionId,
  stacked,
  onDone,
}: {
  controller: MedicalController;
  state: MedicalSnapshot;
  sessionId: number;
  stacked: boolean;
  onDone: () => void;
}) {
  const scope = {
    sessionId,
    placementRevision: state.placementRevision,
    requestId: state.slices.requestId,
  };
  return (
    <ARTransformControls
      testIDPrefix="medical-panel"
      scale={state.slices.scale}
      yaw={state.slices.yaw}
      height={state.slices.height}
      pinching={state.slices.pinching}
      rotating={state.slices.rotating}
      disabled={!canManipulateSlices(state)}
      repositionDisabled={!state.anchorId}
      stacked={stacked}
      onScaleChange={(value) => controller.setPanelTransform(scope, 'scale', value)}
      onYawChange={(value) => controller.setPanelTransform(scope, 'yaw', value)}
      onHeightChange={(value) => controller.setPanelTransform(scope, 'height', value)}
      onReposition={() => controller.reposition(sessionId)}
      onDone={onDone}
    />
  );
}
