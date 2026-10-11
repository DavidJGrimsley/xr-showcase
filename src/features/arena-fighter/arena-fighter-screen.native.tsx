import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ARENA_FONTS,
  ArenaButton,
  ArenaDisplayText,
  ArenaMenuBackground,
  useArenaColors,
  useArenaFonts,
} from './arena-ui';
import { ArenaMatch } from './arena-match';
import { arenaConfiguration, type ArenaConfiguration } from './arena-configuration';
import { checkArenaConnection, RELAY_UNREACHABLE } from './arena-connection';
import { ARENA_PROTOCOL, type ArenaMode, type MatchLength } from './arena-protocol';
import ArenaOrientationGate, { useArenaLandscape } from './arena-orientation-gate.native';
import { ArenaJoinIntent } from './arena-join-intent';
import ArenaMenuPage from './arena-menu-pages';
import ArenaLoadingScreen from './arena-loading-screen';
import ArenaAudioPicker from './arena-audio-picker.native';
import { useArenaAudio } from './use-arena-audio.native';
import type { MainAudioSource } from './arena-audio-policy';

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
  signal: AbortSignal,
  mainAudioSource: MainAudioSource
) {
  const code = mode === 'guest' ? await normalizeRoomCode(inviteCode) : inviteCode;
  if (signal.aborted) return null;
  if (code === null || (mode === 'guest' && !code))
    throw new Error('Enter the six-character room code.');
  if (mode !== 'solo' && configuration) await verifyArenaConnection(configuration, signal);
  return signal.aborted
    ? null
    : { code, controller: new ArenaMatch(mode, rounds, undefined, undefined, mainAudioSource) };
}
export default function ArenaFighterScreen() {
  const params = useLocalSearchParams<{ join?: string; v?: string }>();
  const backAction = useRef<() => void>(() => router.dismissTo('/'));
  const registerBack = useCallback((action: () => void) => {
    backAction.current = action;
  }, []);
  return (
    <ArenaOrientationGate onBack={() => backAction.current()}>
      <ArenaMenu
        key={(params.join ?? '') + ':' + (params.v ?? '')}
        invite={params.join}
        version={params.v}
        registerBack={registerBack}
      />
    </ArenaOrientationGate>
  );
}
function ArenaMenu({
  invite,
  version,
  registerBack,
}: {
  invite?: string;
  version?: string;
  registerBack: (action: () => void) => void;
}) {
  const [fontsLoaded, fontError] = useArenaFonts();
  const { width, height, fontScale } = useWindowDimensions();
  const [page, setPage] = useState<
    'title' | 'solo' | 'two' | 'host' | 'join' | 'scan' | 'how' | 'info'
  >(invite ? 'join' : 'title');
  const [rounds, setRounds] = useState<MatchLength>(3);
  const [mainAudioSource, setMainAudioSource] = useState<MainAudioSource>('host');
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
  useArenaAudio(controller, landscape, page === 'title' && (fontsLoaded || !!fontError));
  useEffect(() => () => connectionCheck.current?.abort(), []);
  const insets = useSafeAreaInsets();
  const colors = useArenaColors();
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
      void prepareArenaMatch(mode, inviteCode, rounds, configuration, abort.signal, mainAudioSource)
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
    [code, controller, landscape, rounds, mainAudioSource]
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
  const resetPending = useCallback(() => {
    connectionCheck.current?.abort();
    connectionCheck.current = null;
    attempt.current = false;
    joinIntent.cancel();
    setStarting(false);
    setError('');
  }, [joinIntent]);
  const returnToTitle = useCallback(() => {
    resetPending();
    controller?.dispose();
    setController(null);
    setPage('title');
  }, [controller, resetPending]);
  const back = useCallback(() => {
    if (controller) returnToTitle();
    else if (page === 'title') router.dismissTo('/');
    else {
      resetPending();
      setPage(page === 'host' || page === 'join' ? 'two' : 'title');
    }
  }, [controller, page, resetPending, returnToTitle]);
  useLayoutEffect(() => {
    registerBack(back);
  }, [back, registerBack]);
  if (!fontsLoaded && !fontError)
    return (
      <ArenaLoadingScreen title="Loading menu" message="Preparing the menu text." onBack={back} />
    );
  if (controller)
    return (
      <Suspense
        fallback={
          <ArenaLoadingScreen
            title="Preparing the arena"
            message="Loading the game and camera controls. Next, scan a table or floor."
            onBack={returnToTitle}
          />
        }>
        <ArenaExperience controller={controller} code={code} onBack={returnToTitle} />
      </Suspense>
    );
  if (page === 'scan')
    return (
      <Suspense
        fallback={
          <ArenaLoadingScreen
            title="Opening QR scanner"
            message="Getting the camera ready to scan your friend’s invite."
            onBack={() => setPage('join')}
          />
        }>
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
  if (starting)
    return (
      <ArenaLoadingScreen
        title={page === 'solo' ? 'Preparing your match' : 'Connecting multiplayer'}
        message={
          page === 'solo'
            ? 'Getting your match ready to begin.'
            : 'Checking the connection for your match.'
        }
        onBack={back}
      />
    );
  const informationPage = page === 'how' || page === 'info' ? page : null;
  const leftPadding = Math.max(24, insets.left);
  const titleWidth = Math.min(640, width - leftPadding - Math.max(24, insets.right));
  const titleHeight = Math.min(height < 360 ? 36 : 56, height * 0.15);
  return (
    <ArenaMenuBackground>
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: Math.max(10, insets.top),
          left: Math.max(12, insets.left),
          right: Math.max(12, insets.right),
          zIndex: 1,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
        <View
          pointerEvents="box-none"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ArenaButton label="Back" icon="arrow-left" onPress={back} />
          {page === 'title' && (
            <ArenaButton
              label="How to Play"
              testID="arena-how-to-play"
              onPress={() => setPage('how')}
            />
          )}
        </View>
        {page === 'title' && (
          <ArenaButton
            label="About the game"
            icon="information-outline"
            iconOnly
            testID="arena-info"
            onPress={() => setPage('info')}
          />
        )}
      </View>
      {informationPage ? (
        <ArenaMenuPage page={informationPage} />
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            alignItems: 'center',
            gap: 10,
            paddingTop:
              page === 'title'
                ? Math.max(64, insets.top + 44 + 24 * fontScale)
                : Math.max(64, insets.top + 54),
            paddingBottom: Math.max(16, insets.bottom),
            paddingLeft: leftPadding,
            paddingRight: Math.max(24, insets.right),
          }}>
          <View
            accessibilityLabel="Neo Rock 'Em Sock 'Em Robots"
            style={{ alignItems: 'center', gap: 2 }}>
            <ArenaDisplayText text="Neo" height={titleHeight * 0.7} maxWidth={titleWidth} />
            <ArenaDisplayText
              text="Rock 'Em Sock 'Em"
              role="TitleFont"
              height={titleHeight}
              maxWidth={titleWidth}
            />
            <ArenaDisplayText
              text="Robots"
              role="TitleFont"
              height={titleHeight}
              maxWidth={titleWidth}
            />
          </View>
          {(page === 'title' || page === 'two') && (
            <Text
              style={{
                color: colors.text,
                fontFamily: page === 'title' ? ARENA_FONTS.serif : ARENA_FONTS.body,
                fontSize: 18,
                textAlign: 'center',
                backgroundColor: '#09090ba8',
                paddingHorizontal: 12,
                paddingVertical: 4,
                borderRadius: 8,
              }}>
              {page === 'title' ? 'Bring the fight to your table.' : 'Two iPhones. One arena.'}
            </Text>
          )}
          <View
            style={{
              padding: 8,
              borderRadius: 16,
              backgroundColor: '#18181be8',
              alignItems: 'center',
              gap: 10,
            }}>
            {page === 'title' && (
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <ArenaButton label="1 Player" secondary onPress={() => setPage('solo')} />
                <ArenaButton label="2 Players" secondary onPress={() => setPage('two')} />
              </View>
            )}
            {page === 'two' && (
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <ArenaButton label="Host" primary onPress={() => setPage('host')} />
                <ArenaButton label="Join" onPress={() => setPage('join')} />
              </View>
            )}
            {(page === 'solo' || page === 'host') && (
              <>
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    gap: 8,
                  }}>
                  {([1, 3, 5] as const).map((value) => (
                    <ArenaButton
                      key={value}
                      label={value === 1 ? '1 round' : 'Best of ' + value}
                      primary={rounds === value}
                      onPress={() => setRounds(value)}
                    />
                  ))}
                </View>
                {page === 'host' && (
                  <ArenaAudioPicker value={mainAudioSource} onChange={setMainAudioSource} />
                )}
                <ArenaButton
                  label={page === 'solo' ? 'Start' : 'Host match'}
                  primary={page === 'host'}
                  secondary={page === 'solo'}
                  onPress={() => start(page === 'solo' ? 'solo' : 'host')}
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
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={12}
                  style={{
                    color: colors.text,
                    backgroundColor: colors.background,
                    minWidth: 240,
                    minHeight: 48,
                    padding: 10,
                    borderRadius: 12,
                    fontFamily: ARENA_FONTS.mono,
                    fontSize: 24,
                    textAlign: 'center',
                  }}
                />
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <ArenaButton
                    label="Scan QR"
                    onPress={() => {
                      joinIntent.beginScan();
                      setPage('scan');
                    }}
                    disabled={starting}
                  />
                  <ArenaButton
                    label="Join match"
                    primary
                    onPress={() => start('guest')}
                    disabled={starting}
                  />
                </View>
              </>
            )}
          </View>
          {!!error && (
            <Text
              accessibilityLiveRegion="polite"
              style={{
                color: colors.text,
                fontFamily: ARENA_FONTS.body,
                maxWidth: 600,
                backgroundColor: colors.surface,
                padding: 12,
                borderRadius: 8,
              }}>
              {error}
            </Text>
          )}
        </ScrollView>
      )}
    </ArenaMenuBackground>
  );
}
