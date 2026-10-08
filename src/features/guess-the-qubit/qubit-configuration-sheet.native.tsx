import {
  BottomSheet,
  Button,
  Column,
  Host,
  ScrollView,
  Text,
  TextInput,
  useNativeState,
} from '@expo/ui';
import { useWindowDimensions } from 'react-native';

interface Props {
  backend: string;
  profile: string;
  configured: boolean;
  busy: boolean;
  message: string;
  save: (key: string, backend: string, profile: string) => Promise<boolean>;
  remove: () => Promise<void>;
  close: () => void;
}
export default function QubitConfigurationSheet({
  backend,
  profile,
  configured,
  busy,
  message,
  save,
  remove,
  close,
}: Props) {
  const keyValue = useNativeState('');
  const backendValue = useNativeState(backend);
  const profileValue = useNativeState(profile);
  const { fontScale } = useWindowDimensions();
  const inputStyle = {
    padding: 12,
    height: Math.max(48, 28 * fontScale + 20),
    backgroundColor: '#202a31',
    borderRadius: 8,
  };
  return (
    <Host colorScheme="dark" seedColor="#93f5c5">
      <BottomSheet
        isPresented
        onDismiss={() => {
          keyValue.set('');
          close();
        }}
        snapPoints={['full']}
        containerColor="#10191f">
        <ScrollView>
          <Column spacing={16} style={{ padding: 24 }}>
            <Text textStyle={{ fontSize: 22, fontWeight: 'bold' }}>Quantum configuration</Text>
            <Text>
              Use an existing development key for this private demo. IBM credentials stay on the
              service.
            </Text>
            <Text>
              {configured ? 'API key saved — leave blank to keep it' : 'Existing API key'}
            </Text>
            <TextInput
              value={keyValue}
              secureTextEntry
              autoCorrect={false}
              autoCapitalize="none"
              autoComplete="off"
              placeholder="API key"
              editable={!busy}
              style={inputStyle}
            />
            <Text>Hardware backend</Text>
            <TextInput
              value={backendValue}
              autoCorrect={false}
              autoCapitalize="none"
              placeholder="Hardware backend"
              editable={!busy}
              style={inputStyle}
            />
            <Text>Existing IBM profile</Text>
            <TextInput
              value={profileValue}
              autoCorrect={false}
              autoCapitalize="none"
              placeholder="IBM profile name"
              editable={!busy}
              style={inputStyle}
            />
            <Text>{message}</Text>
            <Button
              label={busy ? 'Working…' : 'Save securely'}
              disabled={busy}
              onPress={() => {
                const key = keyValue.get();
                void save(key, backendValue.get(), profileValue.get()).then((saved) => {
                  if (saved) {
                    keyValue.set('');
                    close();
                  }
                });
              }}
            />
            <Button
              label="Remove saved configuration"
              variant="outlined"
              disabled={busy}
              onPress={() => {
                keyValue.set('');
                void remove();
              }}
            />
            <Button
              label="Close"
              variant="text"
              onPress={() => {
                keyValue.set('');
                close();
              }}
            />
          </Column>
        </ScrollView>
      </BottomSheet>
    </Host>
  );
}
