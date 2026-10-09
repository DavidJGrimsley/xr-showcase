import { lazy, Suspense, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { View, useWindowDimensions } from 'react-native';

import ARSessionBoundary from '@/features/ar/ar-session-boundary';
import ARStatusPanel from '@/features/ar/ar-status-panel';
import { useAppTheme } from '@/theme/provider';

import { ArenaController } from './arena-controller';
import ArenaHUD from './arena-hud';

const ArenaNavigator = lazy(() => import('./arena-navigator.native'));

export default function ArenaFighterScreen() {
  const [controller] = useState(() => new ArenaController());
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const { activeColors: colors } = useAppTheme();
  useEffect(() => {
    controller.setLandscape(landscape);
  }, [controller, landscape]);

  if (!landscape) {
    return (
      <View className="flex-1 justify-center px-5" style={{ backgroundColor: colors.background }}>
        <ARStatusPanel
          title="Rotate to landscape"
          message="Turn your phone sideways before placing the arena. Arena Fighter needs the new landscape-enabled development build."
          actions={[{ label: 'Home', onPress: () => router.dismissTo('/') }]}
        />
      </View>
    );
  }
  return (
    <ARSessionBoundary
      enabled={landscape}
      renderNavigator={(context) => (
        <Suspense fallback={null}>
          <ArenaNavigator controller={controller} context={context} />
        </Suspense>
      )}
      renderActiveOverlay={(controls) => <ArenaHUD controller={controller} controls={controls} />}
    />
  );
}
