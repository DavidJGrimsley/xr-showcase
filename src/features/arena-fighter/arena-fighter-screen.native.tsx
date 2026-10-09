import { Button, Host, Picker } from '@expo/ui';
import { lazy, Suspense, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/theme/provider';
import { ArenaMatch } from './arena-match';
import { arenaConfiguration } from './arena-configuration';
import type { ArenaMode, MatchLength } from './arena-protocol';

const ArenaExperience = lazy(() => import('./arena-experience.native'));
const ArenaQRScanner = lazy(() => import('./arena-qr-scanner.native'));
async function normalizeRoomCode(code: string) {
  const { normaliseJoinCode } = await import('@reactvision/react-viro');
  return normaliseJoinCode(code);
}
export default function ArenaFighterScreen() {
  const params = useLocalSearchParams<{ join?: string; v?: string }>();
  return (
    <ArenaMenu
      key={(params.join ?? '') + ':' + (params.v ?? '')}
      invite={params.join}
      version={params.v}
    />
  );
}
function ArenaMenu({ invite, version }: { invite?: string; version?: string }) {
  const [page, setPage] = useState<'title' | 'solo' | 'two' | 'host' | 'join' | 'scan'>(
    invite ? 'join' : 'title'
  );
  const [rounds, setRounds] = useState<MatchLength>(3);
  const [code, setCode] = useState(version === '1' ? (invite ?? '') : '');
  const [error, setError] = useState(
    invite && version !== '1' ? 'This invite uses a different app version.' : ''
  );
  const [controller, setController] = useState<ArenaMatch | null>(null);
  const [starting, setStarting] = useState(false);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { activeColors: colors } = useAppTheme();
  const start = async (mode: ArenaMode) => {
    if (starting || controller) return;
    setError('');
    if (mode !== 'solo' && !arenaConfiguration()) {
      setError(
        'Two-player setup is missing from this build. Configure the ReactVision app key and install the new development build.'
      );
      return;
    }
    setStarting(true);
    try {
      if (mode === 'guest') {
        const normalized = await normalizeRoomCode(code);
        if (!normalized) {
          setError('Enter the six-character room code.');
          setStarting(false);
          return;
        }
        setCode(normalized);
      }
      setController(new ArenaMatch(mode, rounds));
    } catch {
      setError('Shared AR requires the new development build.');
    }
    setStarting(false);
  };
  if (controller)
    return (
      <Suspense fallback={<ActivityIndicator />}>
        <ArenaExperience controller={controller} code={code} />
      </Suspense>
    );
  if (page === 'scan')
    return (
      <Suspense fallback={<ActivityIndicator />}>
        <ArenaQRScanner
          onClose={() => setPage('join')}
          onCode={(value) => {
            setCode(value);
            setPage('join');
            setError('');
          }}
        />
      </Suspense>
    );
  const button = (label: string, onPress: () => void, disabled = false) => (
    <Host matchContents>
      <Button
        label={label}
        onPress={onPress}
        disabled={disabled}
        style={{ height: 56, paddingHorizontal: 24 }}
      />
    </Host>
  );
  return (
    <View
      className="flex-1"
      style={{
        backgroundColor: colors.background,
        paddingTop: Math.max(16, insets.top),
        paddingBottom: Math.max(16, insets.bottom),
        paddingHorizontal: Math.max(24, insets.left, insets.right),
      }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          alignItems: 'center',
          gap: 16,
        }}
        keyboardShouldPersistTaps="handled">
        <Text
          accessibilityRole="header"
          style={{ color: colors.text, fontSize: 36, fontWeight: '800' }}>
          ARENA FIGHTER
        </Text>
        <Text style={{ color: colors.text }}>
          {page === 'title'
            ? 'Bring the fight to your table.'
            : page === 'two'
              ? 'Two iPhones. One arena.'
              : page === 'join'
                ? 'Join your opponent'
                : 'Choose your match'}
        </Text>
        {width <= height && (
          <Text style={{ color: colors.text }}>Rotate to landscape to play.</Text>
        )}
        {page === 'title' && (
          <View className="flex-row flex-wrap gap-4">
            {button('1 Player', () => setPage('solo'))}
            {button('2 Players', () => setPage('two'))}
          </View>
        )}
        {page === 'two' && (
          <View className="flex-row gap-4">
            {button('Host', () => setPage('host'))}
            {button('Join', () => setPage('join'))}
          </View>
        )}
        {(page === 'solo' || page === 'host') && (
          <>
            <Host matchContents>
              <Picker selectedValue={rounds} onValueChange={setRounds}>
                <Picker.Item label="1 round" value={1} />
                <Picker.Item label="Best of 3" value={3} />
                <Picker.Item label="Best of 5" value={5} />
              </Picker>
            </Host>
            {button(
              page === 'solo' ? 'Start' : 'Host match',
              () => void start(page === 'solo' ? 'solo' : 'host'),
              width <= height || starting
            )}
          </>
        )}
        {page === 'join' && (
          <>
            <TextInput
              accessibilityLabel="Room code"
              value={code}
              onChangeText={setCode}
              placeholder="K7M 2QX"
              placeholderTextColor={colors.text}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={12}
              style={{
                color: colors.text,
                backgroundColor: colors.surface,
                minWidth: 240,
                minHeight: 52,
                padding: 12,
                borderRadius: 12,
                fontSize: 24,
                textAlign: 'center',
              }}
            />
            <View className="flex-row gap-4">
              {button('Scan QR', () => setPage('scan'))}
              {button('Join match', () => void start('guest'), width <= height || starting)}
            </View>
          </>
        )}
        {!!error && (
          <Text accessibilityLiveRegion="polite" style={{ color: colors.text, maxWidth: 600 }}>
            {error}
          </Text>
        )}
        {page !== 'title' &&
          button('Back', () => {
            setPage(page === 'host' || page === 'join' ? 'two' : 'title');
            setError('');
          })}
        {button('Home', () => router.dismissTo('/'))}
      </ScrollView>
    </View>
  );
}
