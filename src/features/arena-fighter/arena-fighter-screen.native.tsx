import { Button, Host, Picker } from '@expo/ui';
import { lazy, Suspense, useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/theme/provider';
import { ArenaMatch } from './arena-match';
import { arenaConfiguration, type ArenaConfiguration } from './arena-configuration';
import { checkArenaConnection, RELAY_UNREACHABLE } from './arena-connection';
import { ARENA_PROTOCOL, type ArenaMode, type MatchLength } from './arena-protocol';
import ArenaOrientationGate, { useArenaLandscape } from './arena-orientation-gate.native';
import { ArenaJoinIntent } from './arena-join-intent';

const ArenaExperience = lazy(() => import('./arena-experience.native'));
const ArenaQRScanner = lazy(() => import('./arena-qr-scanner.native'));
async function normalizeRoomCode(code: string) {
  const { normaliseJoinCode } = await import('@reactvision/react-viro');
  return normaliseJoinCode(code);
}
async function verifyArenaConnection(configuration: ArenaConfiguration, signal: AbortSignal) {
  const { ViroReplicationClient } = await import('@reactvision/react-viro');
  return checkArenaConnection(
    new ViroReplicationClient(),
    {
      apiKey: configuration.apiKey,
      projectId: configuration.projectId,
      endpoint: configuration.replicationEndpoint,
      // Shared, empty and never written: repeated checks do not mint new saved room IDs.
      roomId: 'arena-fighter-connection-check-v1',
    },
    signal,
    __DEV__ ? (state) => console.log('[Arena preflight]', { state }) : undefined
  );
}
async function prepareArenaMatch(
  mode: ArenaMode,
  inviteCode: string,
  rounds: MatchLength,
  configuration: ArenaConfiguration | null,
  signal: AbortSignal
) {
  const code = mode === 'guest' ? await normalizeRoomCode(inviteCode) : inviteCode;
  if (signal.aborted) return null;
  if (code === null || (mode === 'guest' && !code))
    throw new Error('Enter the six-character room code.');
  if (mode !== 'solo' && configuration) await verifyArenaConnection(configuration, signal);
  return signal.aborted ? null : { code, controller: new ArenaMatch(mode, rounds) };
}
function ArenaMenuButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Host matchContents>
      <Button
        label={label}
        onPress={onPress}
        disabled={disabled}
        style={{ height: 56, paddingHorizontal: 24 }}
      />
    </Host>
  );
}
export default function ArenaFighterScreen() {
  const params = useLocalSearchParams<{ join?: string; v?: string }>();
  return (
    <ArenaOrientationGate>
      <ArenaMenu
        key={(params.join ?? '') + ':' + (params.v ?? '')}
        invite={params.join}
        version={params.v}
      />
    </ArenaOrientationGate>
  );
}
function ArenaMenu({ invite, version }: { invite?: string; version?: string }) {
  const [page, setPage] = useState<'title' | 'solo' | 'two' | 'host' | 'join' | 'scan'>(
    invite ? 'join' : 'title'
  );
  const [rounds, setRounds] = useState<MatchLength>(3);
  const [code, setCode] = useState(version === String(ARENA_PROTOCOL) ? (invite ?? '') : '');
  const [error, setError] = useState(
    invite && version !== String(ARENA_PROTOCOL)
      ? 'This invite uses a different app version. Update both phones.'
      : ''
  );
  const [controller, setController] = useState<ArenaMatch | null>(null);
  const [starting, setStarting] = useState(false);
  const connectionCheck = useRef<AbortController | null>(null);
  const attempt = useRef(false);
  const [joinIntent] = useState(() => {
    const intent = new ArenaJoinIntent();
    if (invite && version === String(ARENA_PROTOCOL)) intent.offer(invite);
    return intent;
  });
  const [inviteRevision, setInviteRevision] = useState(0);
  const landscape = useArenaLandscape();
  useEffect(() => () => connectionCheck.current?.abort(), []);
  const insets = useSafeAreaInsets();
  const { activeColors: colors, activeScheme } = useAppTheme();
  const start = useCallback(
    (mode: ArenaMode, inviteCode = code) => {
      if (attempt.current || controller || !landscape) return;
      setError('');
      const configuration = arenaConfiguration();
      if (mode !== 'solo' && !configuration) {
        setError(
          'Two-player setup is missing from this build. Configure the ReactVision app key and install the new development build.'
        );
        return;
      }
      attempt.current = true;
      setStarting(true);
      const abort = new AbortController();
      connectionCheck.current = abort;
      void prepareArenaMatch(mode, inviteCode, rounds, configuration, abort.signal)
        .then((result) => {
          if (!result || abort.signal.aborted) return;
          setCode(result.code);
          setController(result.controller);
        })
        .catch((error: unknown) => {
          if (!abort.signal.aborted)
            setError(error instanceof Error ? error.message : RELAY_UNREACHABLE);
        })
        .finally(() => {
          if (connectionCheck.current === abort) {
            attempt.current = false;
            setStarting(false);
          }
        });
    },
    [code, controller, landscape, rounds]
  );
  const startInvitation = useEffectEvent((pending: string) => start('guest', pending));
  useEffect(() => {
    if (starting || controller) return;
    // Dispatch after the camera removal commit; cleanup cancels an obsolete dispatch.
    const timer = setTimeout(() => {
      const pending = joinIntent.take(landscape, page === 'scan');
      if (pending) startInvitation(pending);
    }, 0);
    return () => clearTimeout(timer);
  }, [landscape, page, starting, controller, inviteRevision, joinIntent]);
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
            if (!joinIntent.offer(value)) return;
            setCode(value);
            setPage('join');
            setError('');
            setInviteRevision((revision) => revision + 1);
          }}
        />
      </Suspense>
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
                : 'Number of Rounds'}
        </Text>
        {page === 'title' && (
          <View className="flex-row flex-wrap gap-4">
            <ArenaMenuButton label="1 Player" onPress={() => setPage('solo')} />
            <ArenaMenuButton label="2 Players" onPress={() => setPage('two')} />
          </View>
        )}
        {page === 'two' && (
          <View className="flex-row gap-4">
            <ArenaMenuButton label="Host" onPress={() => setPage('host')} />
            <ArenaMenuButton label="Join" onPress={() => setPage('join')} />
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
            <ArenaMenuButton
              label={page === 'solo' ? 'Start' : 'Host match'}
              onPress={() => void start(page === 'solo' ? 'solo' : 'host')}
              disabled={starting}
            />
          </>
        )}
        {page === 'join' && (
          <>
            <TextInput
              accessibilityLabel="Invite code"
              value={code}
              onChangeText={setCode}
              placeholder="Invite code"
              placeholderTextColor={activeScheme === 'dark' ? '#9ca3af' : '#6b7280'}
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
              <ArenaMenuButton
                label="Scan QR"
                onPress={() => {
                  joinIntent.beginScan();
                  setPage('scan');
                }}
                disabled={starting}
              />
              <ArenaMenuButton
                label="Join match"
                onPress={() => void start('guest')}
                disabled={starting}
              />
            </View>
          </>
        )}
        {starting && (
          <View className="flex-row items-center gap-2">
            <ActivityIndicator color={colors.primary} />
            <Text accessibilityLiveRegion="polite" style={{ color: colors.text }}>
              Checking multiplayer connection…
            </Text>
          </View>
        )}
        {!!error && (
          <Text accessibilityLiveRegion="polite" style={{ color: colors.text, maxWidth: 600 }}>
            {error}
          </Text>
        )}
        {page !== 'title' && (
          <ArenaMenuButton
            label="Back"
            onPress={() => {
              connectionCheck.current?.abort();
              connectionCheck.current = null;
              attempt.current = false;
              joinIntent.cancel();
              setStarting(false);
              setPage(page === 'host' || page === 'join' ? 'two' : 'title');
              setError('');
            }}
          />
        )}
        <ArenaMenuButton label="Home" onPress={() => router.dismissTo('/')} />
      </ScrollView>
    </View>
  );
}
