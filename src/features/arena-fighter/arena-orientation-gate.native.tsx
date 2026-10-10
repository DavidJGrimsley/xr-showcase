import { Button, Host } from '@expo/ui';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { createContext, useContext, type ReactNode } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { arSessionCoordinator } from '@/features/ar/ar-session-controller';

const LandscapeContext = createContext(false);
export const useArenaLandscape = () => useContext(LandscapeContext);

/** Covers the current tree; rotation never replaces it or releases its camera. */
export default function ArenaOrientationGate({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const insets = useSafeAreaInsets();
  const blocked = !landscape;
  return (
    <LandscapeContext.Provider value={!blocked}>
      <View style={{ flex: 1 }}>
        <View
          style={{ flex: 1 }}
          pointerEvents={blocked ? 'none' : 'auto'}
          accessibilityElementsHidden={blocked}
          importantForAccessibility={blocked ? 'no-hide-descendants' : 'auto'}>
          {children}
        </View>
        {blocked && (
          <View
            testID="arena-portrait-cover"
            style={StyleSheet.absoluteFill}
            accessibilityViewIsModal>
            <BlurView intensity={85} tint="dark" style={StyleSheet.absoluteFill} />
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingTop: Math.max(32, insets.top),
                  paddingBottom: Math.max(32, insets.bottom),
                  paddingLeft: Math.max(32, insets.left),
                  paddingRight: Math.max(32, insets.right),
                },
              ]}>
              <Text
                testID="arena-portrait-message"
                accessibilityRole="header"
                accessibilityLiveRegion="polite"
                style={{ color: '#fff', textAlign: 'center', fontSize: 26, fontWeight: '600' }}>
                Rotate to landscape to play
              </Text>
            </View>
            <View
              style={{
                position: 'absolute',
                top: Math.max(16, insets.top),
                right: Math.max(16, insets.right),
              }}>
              <Host matchContents>
                <Button
                  label="Home"
                  style={{ height: 52, paddingHorizontal: 20 }}
                  onPress={() => {
                    arSessionCoordinator.endCurrent();
                    router.dismissTo('/');
                  }}
                />
              </Host>
            </View>
          </View>
        )}
      </View>
    </LandscapeContext.Provider>
  );
}
