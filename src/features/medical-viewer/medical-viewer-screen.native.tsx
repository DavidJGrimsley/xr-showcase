import { lazy, Suspense, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Platform, Text, useWindowDimensions, View } from 'react-native';
import { Stack } from 'expo-router/stack';
import ARSessionBoundary from '@/features/ar/ar-session-boundary';
import type { ARActiveOverlayContext } from '@/features/ar/ar-session-types';
import {
  canManipulateMedical,
  MedicalController,
  medicalStatus,
  type MedicalSnapshot,
} from './medical-controller';
import { ARControl } from '@/features/ar/ar-control.native';
import { MedicalInfoButton, MedicalInfoModal } from './medical-info.native';
import { MedicalModelPicker } from './medical-model-picker.native';
import { MedicalTransformControls } from './medical-transform-controls.native';

const MedicalNavigator = lazy(() => import('./medical-navigator.native'));

function MedicalStatus({ state }: { state: MedicalSnapshot }) {
  const status = medicalStatus(state);
  if (!status) return null;
  return (
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
  );
}

function MedicalMainControls({
  context,
  controller,
  state,
  stacked,
  onTransform,
  onRestart,
}: {
  context: ARActiveOverlayContext;
  controller: MedicalController;
  state: MedicalSnapshot;
  stacked: boolean;
  onTransform: () => void;
  onRestart: () => void;
}) {
  const rowStyle = {
    flexDirection: stacked ? ('column' as const) : ('row' as const),
    flexWrap: 'wrap' as const,
  };
  return (
    <>
      <View className="items-center justify-center gap-2" style={rowStyle}>
        <MedicalModelPicker
          selectedValue={state.modelId}
          onValueChange={(model) => controller.selectModel(context.sessionId, model)}
        />
        <ARControl
          label="Transform"
          disabled={!state.anchorId}
          testID="medical-transform"
          onPress={onTransform}
        />
      </View>
      <View className="items-center justify-center gap-2" style={rowStyle}>
        <ARControl
          label="Labels"
          selected={state.labelsVisible}
          disabled={!canManipulateMedical(state)}
          accessibilityLabel={state.labelsVisible ? 'Hide anatomy labels' : 'Show anatomy labels'}
          testID="medical-labels"
          onPress={() => controller.toggleLabels(context.sessionId)}
        />
        <ARControl label="Restart AR" testID="medical-restart-ar" onPress={onRestart} />
      </View>
    </>
  );
}

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
  const [transformRevision, setTransformRevision] = useState<number | null>(null);
  const availableWidth = measuredWidth ? measuredWidth - 32 : Math.min(width, 720) - 72;
  const stacked = fontScale > 1.3 || availableWidth < 290;
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
      <MedicalStatus state={state} />
      {state.loadStatus === 'error' ? (
        <View className="items-center">
          <ARControl
            label="Retry"
            testID="medical-load-retry"
            onPress={() => controller.retryLoad(context.sessionId)}
          />
        </View>
      ) : null}
      {transformRevision === state.placementRevision && state.anchorId ? (
        <MedicalTransformControls
          controller={controller}
          state={state}
          scope={{
            sessionId: context.sessionId,
            placementRevision: state.placementRevision,
            loadAttempt: state.loadAttempt,
          }}
          stacked={stacked}
          onDone={() => setTransformRevision(null)}
        />
      ) : (
        <MedicalMainControls
          context={context}
          controller={controller}
          state={state}
          stacked={stacked}
          onTransform={() => setTransformRevision(state.placementRevision)}
          onRestart={restart}
        />
      )}
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
