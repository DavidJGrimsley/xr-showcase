import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme/provider';

import ARStatusPanel from './ar-status-panel';
import type { ARSessionBoundaryProps } from './ar-session-types';

export default function ARSessionBoundary(_props: ARSessionBoundaryProps) {
  const { activeColors: colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      className="flex-1"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="grow items-center justify-center px-5 py-8"
      contentContainerStyle={{ paddingBottom: Math.max(32, insets.bottom) }}
      style={{ backgroundColor: colors.background }}>
      <View className="w-full max-w-[720px]">
        <ARStatusPanel
          title="Camera AR needs a phone"
          message="Open XR Showcase in its development build on a supported physical iPhone or Android phone."
          actions={[{ label: 'Home', onPress: () => router.dismissTo('/') }]}
        />
      </View>
    </ScrollView>
  );
}
