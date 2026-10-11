import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import ARSessionBoundary from '@/ui/game-ar-boundary';
import type { ArenaMatch } from './arena-match';
import { arenaConfiguration } from './arena-configuration';
import { ArenaRoom } from './arena-room.native';
import type { ArenaRoomSession } from './arena-room-session';
import ArenaNavigator from './arena-navigator.native';
import ArenaHUD from './arena-hud';
import { useArenaLandscape } from './arena-orientation-gate.native';

export default function ArenaExperience({
  controller,
  code,
  onBack,
  remoteRoom,
}: {
  controller: ArenaMatch;
  code?: string;
  remoteRoom?: ArenaRoomSession;
  onBack: () => void;
}) {
  const [room] = useState(() =>
    controller.mode === 'solo'
      ? undefined
      : (remoteRoom ?? new ArenaRoom(controller, arenaConfiguration()!, code))
  );
  const landscape = useArenaLandscape();
  const [activated, setActivated] = useState(landscape);
  if (landscape && !activated) setActivated(true);
  const disposal = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useLayoutEffect(() => {
    controller.setLandscape(landscape);
  }, [controller, landscape]);
  useEffect(() => {
    clearTimeout(disposal.current);
    room?.start();
    controller.setAppActive(AppState.currentState !== 'background');
    const timer = setInterval(controller.poll, 100);
    const diagnostics =
      __DEV__ && controller.space === 'remote'
        ? setInterval(
            () => console.log('[Arena remote timing]', controller.predictionDiagnostics()),
            5000
          )
        : undefined;
    const appState = AppState.addEventListener('change', (state) => {
      controller.setAppActive(state !== 'background');
    });
    return () => {
      clearInterval(timer);
      if (diagnostics) clearInterval(diagnostics);
      appState.remove();
      // A Strict Mode effect replay must not destroy the controller being reattached.
      disposal.current = setTimeout(() => {
        room?.dispose();
        controller.dispose();
      }, 0);
    };
  }, [controller, room]);
  return (
    <ARSessionBoundary
      onExit={() => {
        room?.dispose();
        controller.dispose();
        onBack();
      }}
      exitLabel="Back"
      enabled={activated}
      keepSessionOnInactive
      activeOverlayLayout="fullscreen"
      renderNavigator={(context) => (
        <ArenaNavigator controller={controller} room={room} context={context} />
      )}
      renderActiveOverlay={(controls) => (
        <ArenaHUD controller={controller} room={room} controls={controls} />
      )}
    />
  );
}
