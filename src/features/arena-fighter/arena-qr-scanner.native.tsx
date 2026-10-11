import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState, useSyncExternalStore } from 'react';
import { AppState, Linking, Text, View } from 'react-native';
import { useIsFocused } from 'expo-router/react-navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { parseJoinLink } from './arena-protocol';
import { useArenaLandscape } from './arena-orientation-gate.native';
import { ARENA_FONTS, ArenaButton } from './arena-ui';

const subscribeAppState = (listener: () => void) => {
  const subscription = AppState.addEventListener('change', listener);
  return () => subscription.remove();
};

export default function ArenaQRScanner({
  onCode,
  onClose,
}: {
  onCode: (code: string) => void;
  onClose: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const handled = useRef(false);
  const [error, setError] = useState('');
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const appState = useSyncExternalStore(subscribeAppState, () => AppState.currentState);
  const landscape = useArenaLandscape();
  return (
    <View
      className="flex-1 bg-black"
      style={{
        paddingTop: Math.max(16, insets.top),
        paddingBottom: Math.max(16, insets.bottom),
        paddingLeft: Math.max(16, insets.left),
        paddingRight: Math.max(16, insets.right),
      }}>
      <View
        style={{
          position: 'absolute',
          top: Math.max(10, insets.top),
          left: Math.max(12, insets.left),
          zIndex: 1,
        }}>
        <ArenaButton label="Back" icon="arrow-left" onPress={onClose} />
      </View>
      {permission?.granted && focused && appState !== 'background' ? (
        <CameraView
          style={{ flex: 1 }}
          active={landscape && appState === 'active'}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => {
            if (handled.current) return;
            const code = parseJoinLink(data);
            if (!code) {
              setError("Scan a Neo Rock 'Em Sock 'Em Robots room QR code.");
              return;
            }
            handled.current = true;
            onCode(code);
          }}
        />
      ) : !permission?.granted ? (
        <>
          <Text className="text-white" style={{ fontFamily: ARENA_FONTS.body, marginTop: 64 }}>
            Allow camera access to scan a room code, or go back to enter it.
          </Text>
          <ArenaButton
            label={permission?.canAskAgain === false ? 'Open Settings' : 'Allow camera'}
            onPress={() => {
              if (permission?.canAskAgain === false) void Linking.openSettings();
              else void requestPermission();
            }}
          />
        </>
      ) : (
        <View className="flex-1" />
      )}
      {!!error && (
        <Text
          accessibilityLiveRegion="polite"
          className="text-white"
          style={{ fontFamily: ARENA_FONTS.body }}>
          {error}
        </Text>
      )}
    </View>
  );
}
