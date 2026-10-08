import { lazy, Suspense, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Platform, Text, useWindowDimensions, View } from 'react-native';
import { Stack } from 'expo-router/stack';
import ARSessionBoundary from '@/features/ar/ar-session-boundary';
import type { ARActiveOverlayContext } from '@/features/ar/ar-session-types';
import {
  canManipulateMedical,
  MAX_MODEL_SCALE,
  MedicalController,
  medicalStatus,
  MIN_MODEL_SCALE,
} from './medical-controller';
import { MEDICAL_MODELS } from './medical-models';
import { MedicalControl } from './medical-control.native';
import { MedicalInfoButton, MedicalInfoModal } from './medical-info.native';

const MedicalNavigator = lazy(() => import('./medical-navigator.native'));

function MedicalControls({
  context,
  controller,
}: {
  context: ARActiveOverlayContext;
  controller: MedicalController;
}) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const { width, fontScale } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const availableWidth = measuredWidth ? measuredWidth - 32 : Math.min(width, 720) - 72;
  const stacked = fontScale > 1.3 || availableWidth < 290;
  const ready = canManipulateMedical(state);
  const status = medicalStatus(state);
  const restart = () => {
    if (controller.getSessionId() !== context.sessionId) return;
    controller.restart(context.sessionId);
    context.restartAR();
  };
  return (
    <View
      testID="medical-controls"
      onLayout={(event) => setMeasuredWidth(event.nativeEvent.layout.width)}
      className="gap-3 rounded-2xl p-4"
      style={{ backgroundColor: '#10191fe6' }}>
      {status ? (
        <View className="flex-row items-center justify-center gap-2">
          {state.loadStatus === 'loading' || state.tracking === 'initializing' ? (
            <ActivityIndicator color="#93f5c5" />
          ) : null}
          <Text
            accessibilityLiveRegion="polite"
            className="shrink text-center text-base"
            style={{ color: state.loadStatus === 'error' ? '#fde68a' : '#e2e8f0' }}>
            {status}
          </Text>
        </View>
      ) : null}
      <View
        className="items-center justify-center gap-2"
        style={{ flexDirection: stacked ? 'column' : 'row', flexWrap: 'wrap' }}>
        <View className="flex-row items-center justify-center gap-2" style={{ flexWrap: 'wrap' }}>
          {MEDICAL_MODELS.map((model) => (
            <MedicalControl
              key={model.id}
              label={model.label}
              selected={state.modelId === model.id}
              disabled={!model.available}
              hint={!model.available ? 'Brain model is not available yet' : undefined}
              testID={`medical-model-${model.id}`}
              onPress={() => controller.selectModel(context.sessionId, model.id)}
            />
          ))}
        </View>
        <View className="flex-row gap-2">
          <MedicalControl
            label="−"
            accessibilityLabel="Make skull smaller"
            testID="medical-size-smaller"
            width={Math.max(48, 17 * fontScale + 20)}
            disabled={!ready || state.pinching || state.scale <= MIN_MODEL_SCALE}
            onPress={() => controller.adjustScale(context.sessionId, -1)}
          />
          <MedicalControl
            label="+"
            accessibilityLabel="Make skull larger"
            testID="medical-size-larger"
            width={Math.max(48, 17 * fontScale + 20)}
            disabled={!ready || state.pinching || state.scale >= MAX_MODEL_SCALE}
            onPress={() => controller.adjustScale(context.sessionId, 1)}
          />
        </View>
      </View>
      {state.loadStatus === 'error' ? (
        <View className="items-center">
          <MedicalControl
            label="Retry"
            testID="medical-load-retry"
            onPress={() => controller.retryLoad(context.sessionId)}
          />
        </View>
      ) : null}
      <View
        className="items-center justify-center gap-2"
        style={{ flexDirection: stacked ? 'column' : 'row', flexWrap: 'wrap' }}>
        <MedicalControl
          label="Labels"
          selected={state.labelsVisible}
          disabled={!ready}
          accessibilityLabel={state.labelsVisible ? 'Hide anatomy labels' : 'Show anatomy labels'}
          testID="medical-labels"
          onPress={() => controller.toggleLabels(context.sessionId)}
        />
        <MedicalControl
          label="Reposition"
          disabled={!state.anchorId}
          testID="medical-reposition"
          onPress={() => controller.reposition(context.sessionId)}
        />
        <MedicalControl label="Restart AR" testID="medical-restart-ar" onPress={restart} />
      </View>
    </View>
  );
}

export default function MedicalViewerScreen() {
  const [controller] = useState(() => new MedicalController());
  const [infoOpen, setInfoOpen] = useState(false);
  return (
    <>
      <Stack.Screen
        options={{
          headerBackButtonDisplayMode: 'minimal',
          headerRight: () =>
            Platform.OS === 'ios' ? null : <MedicalInfoButton onPress={() => setInfoOpen(true)} />,
        }}
      />
      {Platform.OS === 'ios' ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon="info.circle"
            accessibilityLabel="About the Medical Viewer"
            hidesSharedBackground
            onPress={() => setInfoOpen(true)}
          />
        </Stack.Toolbar>
      ) : null}
      <ARSessionBoundary
        renderNavigator={(context) => (
          <Suspense fallback={null}>
            <MedicalNavigator context={context} controller={controller} />
          </Suspense>
        )}
        renderActiveOverlay={(context) => (
          <MedicalControls key={context.sessionId} context={context} controller={controller} />
        )}
      />
      <MedicalInfoModal isPresented={infoOpen} onDismiss={() => setInfoOpen(false)} />
    </>
  );
}
