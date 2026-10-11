import type { ReactNode } from 'react';
import { useEffect, useMemo } from 'react';
import { router } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { Stack } from 'expo-router/stack';
import { useFonts } from 'expo-font';
import { Platform, StatusBar } from 'react-native';
import { NavigationBar } from 'expo-navigation-bar';
import * as SystemUI from 'expo-system-ui';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { experiences } from '@/features/experiences/experience-catalog';
import { arSessionCoordinator } from '@/features/ar/ar-session-controller';
import themeFontAssets from '../theme/font-assets';
import { AppThemeProvider, useAppTheme } from '../theme/provider';
import { GameButton } from '@/ui/game-button';

function HeaderAction({ label, onPress }: { label: string; onPress: () => void }) {
  const { activeColors: colors } = useAppTheme();

  return (
    <GameButton
      label={label}
      onPress={onPress}
      color={colors.primary}
      textColor={colors.primary}
      variant="text"
    />
  );
}

function RouterThemeBridge({ children }: { children: ReactNode }) {
  const theme = useAppTheme();
  const prefersDark = theme.activeScheme === 'dark';
  const base = prefersDark ? DarkTheme : DefaultTheme;
  const shellColor = theme.activeColors.background;
  const routerTheme = useMemo(
    () => ({
      ...base,
      colors: {
        ...base.colors,
        background: shellColor,
        border: theme.activeColors.surface,
        card: shellColor,
        notification: theme.activeColors.warning,
        primary: theme.activeColors.primary,
        text: theme.activeColors.text,
      },
    }),
    [base, shellColor, theme.activeColors]
  );

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync?.(shellColor);
  }, [shellColor]);

  return <ThemeProvider value={routerTheme}>{children}</ThemeProvider>;
}

function LayoutInner() {
  const theme = useAppTheme();
  const shellColor = theme.activeColors.background;
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: shellColor }}>
      <KeyboardProvider>
        <SafeAreaProvider>
          <RouterThemeBridge>
            <StatusBar
              backgroundColor={shellColor}
              barStyle={theme.activeScheme === 'dark' ? 'light-content' : 'dark-content'}
              translucent={false}
            />
            {Platform.OS === 'android' ? (
              <NavigationBar style={theme.activeScheme === 'dark' ? 'dark' : 'light'} />
            ) : null}
            <Stack
              screenOptions={{
                contentStyle: { backgroundColor: shellColor },
                headerShown: true,
                orientation: 'portrait',
              }}>
              <Stack.Screen
                name="index"
                options={{
                  title: 'Home',
                  orientation: 'default',
                  headerRight: () => (
                    <GameButton
                      label="Settings"
                      color={theme.activeColors.primary}
                      textColor={theme.activeColors.primary}
                      variant="text"
                      onPress={() => router.navigate('/settings')}
                    />
                  ),
                }}
              />
              {experiences.map((experience) => (
                <Stack.Screen
                  key={experience.route}
                  name={experience.route}
                  options={{
                    title: experience.title,
                    ...(experience.route === 'arena-fighter'
                      ? { orientation: 'default' as const, headerShown: false }
                      : {}),
                    headerRight: () =>
                      experience.route === 'medical-viewer' ? (
                        <HeaderAction
                          label="Home"
                          onPress={() => {
                            arSessionCoordinator.endCurrent();
                            router.dismissTo('/');
                          }}
                        />
                      ) : (
                        <GameButton
                          label="Home"
                          color={theme.activeColors.primary}
                          textColor={theme.activeColors.primary}
                          variant="text"
                          onPress={() => {
                            arSessionCoordinator.endCurrent();
                            router.dismissTo('/');
                          }}
                        />
                      ),
                  }}
                />
              ))}
              <Stack.Screen
                name="settings"
                options={{ presentation: 'modal', title: 'Settings' }}
              />
            </Stack>
          </RouterThemeBridge>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

export default function Layout() {
  const hasFontAssets = Object.keys(themeFontAssets).length > 0;
  const [fontsLoaded, fontsError] = useFonts(themeFontAssets);

  if (hasFontAssets && !fontsLoaded && !fontsError) {
    return null;
  }

  return (
    <AppThemeProvider scheme="dark">
      <LayoutInner />
    </AppThemeProvider>
  );
}
