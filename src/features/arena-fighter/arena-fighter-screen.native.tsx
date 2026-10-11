import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { AppState, ScrollView, Text as TaglineText, View, useWindowDimensions } from 'react-native';
import { GameCopy as Text } from '@/ui/game-text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { GameInviteField } from '@/ui/game-invite-field';
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
import {
  ARENA_PROTOCOL,
  type ArenaMode,
  type MatchLength,
  type ArenaSpace,
} from './arena-protocol';
import ArenaOrientationGate, { useArenaLandscape } from './arena-orientation-gate.native';
import { ArenaJoinIntent } from './arena-join-intent';
import ArenaMenuPage from './arena-menu-pages';
import ArenaLoadingScreen from './arena-loading-screen';
import ArenaAudioPicker from './arena-audio-picker.native';
import { useArenaAudio } from './use-arena-audio.native';
import type { MainAudioSource } from './arena-audio-policy';
import { ArenaRemoteRoom } from './arena-remote-room';
import { normalizeRemoteCode, remoteCodeFromUUID, type ArenaInvite } from './arena-invite';
import ArenaRoomPanel, { ArenaGuidance } from './arena-room-panel.native';

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
  mainAudioSource: MainAudioSource,
  space: ArenaSpace
) {
  const code =
    mode === 'guest'
      ? space === 'remote'
        ? normalizeRemoteCode(inviteCode)
        : await normalizeRoomCode(inviteCode)
      : inviteCode;
  if (signal.aborted) return null;
  if (code === null || (mode === 'guest' && !code))
    throw new Error(
      space === 'remote'
        ? 'Enter the twelve-character long-distance invite code.'
        : 'Enter the six-character room code.'
    );
  if (space === 'remote' && mode !== 'solo' && configuration) {
    const { ViroReplicationClient } = await import('@reactvision/react-viro');
    const { uuid } = await import('expo-modules-core');
    if (signal.aborted) return null;
    const remoteCode = mode === 'host' ? remoteCodeFromUUID(uuid.v4()) : code!;
    const controller = new ArenaMatch(mode, rounds, undefined, undefined, 'both', 'remote');
    const room = new ArenaRemoteRoom(
      controller,
      configuration,
      remoteCode,
      new ViroReplicationClient(),
      __DEV__ ? (state) => console.log('[Arena remote]', { state }) : undefined
    );
    try {
      await room.open(signal);
      if (signal.aborted) {
        room.dispose();
        controller.dispose();
        return null;
      }
      return { code: remoteCode, controller, room };
    } catch (error) {
      room.dispose();
      controller.dispose();
      throw error;
    }
  }
  if (mode !== 'solo' && configuration) await verifyArenaConnection(configuration, signal);
  return signal.aborted
    ? null
    : {
        code,
        controller: new ArenaMatch(mode, rounds, undefined, undefined, mainAudioSource),
        room: undefined,
      };
}
export default function ArenaFighterScreen() {
  const params = useLocalSearchParams<{ join?: string; v?: string; space?: string }>();
  const backAction = useRef<() => void>(() => router.dismissTo('/'));
  const registerBack = useCallback((action: () => void) => {
    backAction.current = action;
  }, []);
  return (
    <ArenaOrientationGate onBack={() => backAction.current()}>
      <ArenaMenu
        key={(params.join ?? '') + ':' + (params.v ?? '') + ':' + (params.space ?? '')}
        invite={params.join}
        version={params.v}
        inviteSpace={params.space}
        registerBack={registerBack}
      />
    </ArenaOrientationGate>
  );
}
function ArenaMenu({
  invite,
  version,
  inviteSpace,
  registerBack,
}: {
  invite?: string;
  version?: string;
  inviteSpace?: string;
  registerBack: (action: () => void) => void;
}) {
  const [fontsLoaded, fontError] = useArenaFonts();
  const { width, height, fontScale } = useWindowDimensions();
  const [page, setPage] = useState<
    'title' | 'solo' | 'two' | 'mode' | 'host' | 'join' | 'scan' | 'how' | 'info'
  >(invite ? 'join' : 'title');
  const [space, setSpace] = useState<ArenaSpace>(
    inviteSpace === 'remote' ? 'remote' : 'same-space'
  );
  const validInviteSpace = !inviteSpace || ['same-space', 'remote'].includes(inviteSpace);
  const [rounds, setRounds] = useState<MatchLength>(3);
  const [mainAudioSource, setMainAudioSource] = useState<MainAudioSource>('host');
  const [code, setCode] = useState(
    version === String(ARENA_PROTOCOL) && validInviteSpace ? (invite ?? '') : ''
  );
  const [error, setError] = useState(
    invite && !validInviteSpace
      ? 'This invite has an unknown play mode.'
      : invite && version !== String(ARENA_PROTOCOL)
        ? 'This invite uses a different app version. Update both phones.'
        : ''
  );
  const [controller, setController] = useState<ArenaMatch | null>(null);
  const [remoteRoom, setRemoteRoom] = useState<ArenaRemoteRoom | undefined>();
  const [placingRemote, setPlacingRemote] = useState(false);
  const [starting, setStarting] = useState(false);
  const remoteDisposal = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const connectionCheck = useRef<AbortController | null>(null);
  const attempt = useRef(false);
  const [joinIntent] = useState(() => {
    const intent = new ArenaJoinIntent<ArenaInvite>();
    if (invite && version === String(ARENA_PROTOCOL) && validInviteSpace)
      intent.offer({ code: invite, space });
    return intent;
  });
  const [inviteRevision, setInviteRevision] = useState(0);
  const landscape = useArenaLandscape();
  useArenaAudio(controller, landscape, page === 'title' && (fontsLoaded || !!fontError));
  useEffect(() => () => connectionCheck.current?.abort(), []);
  const insets = useSafeAreaInsets();
  const colors = useArenaColors();
  const start = useCallback(
    (mode: ArenaMode, inviteCode = code, playSpace = space) => {
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
      void prepareArenaMatch(
        mode,
        inviteCode,
        rounds,
        configuration,
        abort.signal,
        mainAudioSource,
        playSpace
      )
        .then((result) => {
          if (!result) return;
          if (abort.signal.aborted) {
            result.room?.dispose();
            result.controller.dispose();
            return;
          }
          setRemoteRoom(result.room);
          setPlacingRemote(false);
          setSpace(playSpace);
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
    [code, controller, landscape, rounds, mainAudioSource, space]
  );
  const startInvitation = useEffectEvent((pending: ArenaInvite) =>
    start('guest', pending.code, pending.space)
  );
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
    remoteRoom?.dispose();
    controller?.dispose();
    setRemoteRoom(undefined);
    setPlacingRemote(false);
    setController(null);
    setPage('title');
  }, [controller, remoteRoom, resetPending]);
  const back = useCallback(() => {
    if (controller) returnToTitle();
    else if (page === 'title') router.dismissTo('/');
    else {
      resetPending();
      setPage(page === 'host' || page === 'join' ? 'mode' : page === 'mode' ? 'two' : 'title');
    }
  }, [controller, page, resetPending, returnToTitle]);
  useLayoutEffect(() => {
    registerBack(back);
  }, [back, registerBack]);
  useEffect(() => {
    if (!remoteRoom || !controller) return;
    controller.setLandscape(landscape);
    controller.setAppActive(AppState.currentState !== 'background');
    const subscription = AppState.addEventListener('change', (state) =>
      controller.setAppActive(state !== 'background')
    );
    return () => subscription.remove();
  }, [remoteRoom, controller, landscape]);
  useEffect(() => {
    clearTimeout(remoteDisposal.current);
    if (!remoteRoom) return;
    return () => {
      remoteDisposal.current = setTimeout(() => remoteRoom.dispose(), 0);
    };
  }, [remoteRoom]);
  if (!fontsLoaded && !fontError)
    return (
      <ArenaLoadingScreen title="Loading menu" message="Preparing the menu text." onBack={back} />
    );
  if (controller && remoteRoom && !placingRemote)
    return (
      <RemoteLobby
        controller={controller}
        room={remoteRoom}
        onBack={returnToTitle}
        onPlace={() => setPlacingRemote(true)}
      />
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
        <ArenaExperience
          controller={controller}
          code={code}
          remoteRoom={remoteRoom}
          onBack={returnToTitle}
        />
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
            setCode(value.code);
            setSpace(value.space);
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
  const showTitle = page !== 'join' && !(page === 'host' && space === 'same-space');
  const leftPadding = Math.max(24, insets.left);
  const titleWidth = Math.min(640, width - leftPadding - Math.max(24, insets.right));
  const menuWidth = Math.max(1, Math.min(520, titleWidth));
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
          <ArenaButton label="Back" icon="arrow-left" primary={page === 'title'} onPress={back} />
          {page === 'title' && (
            <ArenaButton
              label="How to Play"
              primary
              testID="arena-how-to-play"
              onPress={() => setPage('how')}
            />
          )}
        </View>
        {page === 'title' && (
          <ArenaButton
            label="About the game"
            primary
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
        <KeyboardAvoidingView
          enabled={page === 'join'}
          behavior="padding"
          automaticOffset
          style={{ flex: 1 }}>
          <ScrollView
            key={`${page}:${space}`}
            testID="arena-menu-scroll"
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
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
            {showTitle && (
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
            )}
            {(page === 'title' || page === 'two') && (
              <TaglineText
                testID="arena-tagline"
                style={{
                  color: colors.text,
                  fontFamily: page === 'title' ? ARENA_FONTS.serif : ARENA_FONTS.body,
                  fontSize: 18,
                  textAlign: 'center',
                  backgroundColor: '#09090ba8',
                  paddingHorizontal: 12,
                  paddingVertical: 4,
                  borderRadius: 8,
                  maxWidth: titleWidth,
                }}>
                {page === 'title' ? 'Bring the fight to your table.' : 'Near or far. One match.'}
              </TaglineText>
            )}
            <View
              testID="arena-menu-panel"
              style={{
                width: menuWidth,
                maxWidth: '100%',
                padding: 8,
                borderRadius: 16,
                backgroundColor: '#18181be8',
                alignItems: 'center',
                gap: 10,
              }}>
              {page === 'title' && (
                <View
                  style={{
                    width: '100%',
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    gap: 12,
                  }}>
                  <ArenaButton label="1 Player" primary onPress={() => setPage('solo')} />
                  <ArenaButton label="2 Players" primary onPress={() => setPage('two')} />
                </View>
              )}
              {page === 'two' && (
                <View
                  style={{
                    width: '100%',
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    gap: 12,
                  }}>
                  <ArenaButton
                    label="Same table"
                    primary
                    onPress={() => {
                      setSpace('same-space');
                      setPage('mode');
                    }}
                  />
                  <ArenaButton
                    label="Long distance"
                    secondary
                    onPress={() => {
                      setSpace('remote');
                      setPage('mode');
                    }}
                  />
                </View>
              )}
              {page === 'mode' && (
                <View
                  style={{
                    width: '100%',
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    gap: 12,
                  }}>
                  <ArenaButton label="Host" primary onPress={() => setPage('host')} />
                  <ArenaButton label="Join" secondary onPress={() => setPage('join')} />
                </View>
              )}
              {['mode', 'host', 'join'].includes(page) && (
                <Text
                  testID="arena-space-caption"
                  style={{ color: colors.text, fontFamily: ARENA_FONTS.body, textAlign: 'center' }}>
                  {space === 'remote'
                    ? 'Long distance · Place your own arena'
                    : 'Same table · Share one arena'}
                </Text>
              )}
              {(page === 'solo' || page === 'host') && (
                <>
                  <View
                    style={{
                      width: '100%',
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      justifyContent: 'center',
                      gap: 8,
                    }}>
                    {([1, 3, 5] as const).map((value) => (
                      <ArenaButton
                        key={value}
                        label={value === 1 ? '1 round' : 'Best of ' + value}
                        secondary={rounds === value}
                        selected={rounds === value}
                        onPress={() => setRounds(value)}
                      />
                    ))}
                  </View>
                  {page === 'host' && space === 'same-space' && (
                    <ArenaAudioPicker value={mainAudioSource} onChange={setMainAudioSource} />
                  )}
                  <ArenaButton
                    label={
                      page === 'solo' ? 'Start' : space === 'remote' ? 'Create room' : 'Host match'
                    }
                    primary
                    onPress={() => start(page === 'solo' ? 'solo' : 'host')}
                    disabled={starting}
                  />
                </>
              )}
              {page === 'join' && (
                <>
                  <GameInviteField
                    width={Math.max(1, menuWidth - 16)}
                    value={code}
                    onChange={setCode}
                    onSubmit={(current) => start('guest', current)}
                    maxLength={space === 'remote' ? 16 : 12}
                    color={colors.text}
                    backgroundColor={colors.background}
                    fontFamily={ARENA_FONTS.mono}
                  />
                  <View
                    style={{
                      width: '100%',
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      justifyContent: 'center',
                      gap: 12,
                    }}>
                    <ArenaButton
                      label="Scan QR"
                      primary
                      onPress={() => {
                        joinIntent.beginScan();
                        setPage('scan');
                      }}
                      disabled={starting}
                    />
                    <ArenaButton
                      label="Join match"
                      secondary
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
                  width: menuWidth,
                  maxWidth: 600,
                  backgroundColor: colors.surface,
                  padding: 12,
                  borderRadius: 8,
                }}>
                {error}
              </Text>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </ArenaMenuBackground>
  );
}

function RemoteLobby({
  controller,
  room,
  onBack,
  onPlace,
}: {
  controller: ArenaMatch;
  room: ArenaRemoteRoom;
  onBack: () => void;
  onPlace: () => void;
}) {
  const match = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const view = useSyncExternalStore(room.subscribe, room.getSnapshot);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const colors = useArenaColors();
  return (
    <ArenaMenuBackground>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          paddingTop: Math.max(16, insets.top),
          paddingBottom: Math.max(16, insets.bottom),
          paddingLeft: Math.max(16, insets.left),
          paddingRight: Math.max(16, insets.right),
        }}>
        <Text style={{ color: colors.text, fontFamily: ARENA_FONTS.button, fontSize: 22 }}>
          Long-distance match
        </Text>
        <Text style={{ color: colors.text, fontFamily: ARENA_FONTS.body, textAlign: 'center' }}>
          Each player places the arena on their own table. Both phones play music and game sounds.
        </Text>
        {controller.mode === 'host' && match.connected && (
          <ArenaRoomPanel
            match={match}
            width={width - insets.left - insets.right - 32}
            height={height - 160}
          />
        )}
        {(!match.connected || view.status === 'error') && (
          <ArenaGuidance message={view.message} onRetry={room.retry} />
        )}
        {controller.mode === 'guest' && match.connected && (
          <Text style={{ color: colors.text, fontFamily: ARENA_FONTS.body }}>
            Opponent connected. Place your arena to continue.
          </Text>
        )}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <ArenaButton label="Back" onPress={onBack} />
          <ArenaButton
            label="Place arena"
            primary
            disabled={!match.connected || view.status === 'error'}
            onPress={onPlace}
          />
        </View>
      </ScrollView>
    </ArenaMenuBackground>
  );
}
