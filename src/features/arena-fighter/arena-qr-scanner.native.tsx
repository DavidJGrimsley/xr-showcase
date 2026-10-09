import { Button, Host } from '@expo/ui';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState, useSyncExternalStore } from 'react';
import { AppState, Linking, Text, View } from 'react-native';
import { useIsFocused } from 'expo-router/react-navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { parseJoinLink } from './arena-protocol';

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
  const active = useSyncExternalStore(subscribeAppState, () => AppState.currentState) === 'active';
  return (
    <View
      className="flex-1 bg-black"
      style={{
        paddingTop: Math.max(16, insets.top),
        paddingBottom: Math.max(16, insets.bottom),
        paddingLeft: Math.max(16, insets.left),
        paddingRight: Math.max(16, insets.right),
      }}>
      {permission?.granted && focused && active ? (
        <CameraView
          style={{ flex: 1 }}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => {
            if (handled.current) return;
            const code = parseJoinLink(data);
            if (!code) {
              setError('Scan an Arena Fighter room QR code.');
              return;
            }
            handled.current = true;
            onCode(code);
          }}
        />
      ) : !permission?.granted ? (
        <>
          <Text className="text-white">
            Allow camera access to scan a room code, or go back to enter it.
          </Text>
          <Host matchContents>
            <Button
              label={permission?.canAskAgain === false ? 'Open Settings' : 'Allow camera'}
              onPress={() => {
                if (permission?.canAskAgain === false) void Linking.openSettings();
                else void requestPermission();
              }}
              style={{ height: 52 }}
            />
          </Host>
        </>
      ) : (
        <View className="flex-1" />
      )}
      {!!error && (
        <Text accessibilityLiveRegion="polite" className="text-white">
          {error}
        </Text>
      )}
      <Host matchContents>
        <Button label="Back to join" onPress={onClose} style={{ height: 52 }} />
      </Host>
    </View>
  );
}
