import { Button, Host } from '@expo/ui';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useIsFocused } from 'expo-router/react-navigation';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { Alert, AppState, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { arSessionCoordinator } from '@/features/ar/ar-session-controller';

const LandscapeContext = createContext(false);
export const useArenaLandscape = () => useContext(LandscapeContext);
function subscribeAppState(listener: () => void) {
  const subscription = AppState.addEventListener('change', listener);
  return () => subscription.remove();
}

/** Covers the current tree; rotation never replaces it or releases its camera. */
export default function ArenaOrientationGate({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const focused = useIsFocused();
  const appState = useSyncExternalStore(subscribeAppState, () => AppState.currentState);
  const [alertVisible, setAlertVisible] = useState(false);
  const notified = useRef(false);
  const alive = useRef(true);
  const insets = useSafeAreaInsets();
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (landscape) {
      notified.current = false;
      return;
    }
    if (!focused || appState !== 'active' || notified.current || alertVisible) return;
    notified.current = true;
    setAlertVisible(true);
    Alert.alert(
      'Landscape required',
      'Rotate your phone sideways to continue. Your progress is saved.',
      [
        {
          text: 'OK',
          onPress: () => {
            if (alive.current) setAlertVisible(false);
          },
        },
      ],
      { cancelable: false }
    );
  }, [landscape, focused, appState, alertVisible]);
  const blocked = !landscape || alertVisible;
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
