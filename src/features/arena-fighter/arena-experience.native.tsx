import { useEffect, useRef, useState } from 'react';
import { AppState, useWindowDimensions } from 'react-native';
import ARSessionBoundary from '@/features/ar/ar-session-boundary';
import type { ArenaMatch } from './arena-match';
import { arenaConfiguration } from './arena-configuration';
import { ArenaRoom } from './arena-room.native';
import ArenaNavigator from './arena-navigator.native';
import ArenaHUD from './arena-hud';

export default function ArenaExperience({
  controller,
  code,
}: {
  controller: ArenaMatch;
  code?: string;
}) {
  const [room] = useState(() =>
    controller.mode === 'solo' ? undefined : new ArenaRoom(controller, arenaConfiguration()!, code)
  );
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const disposal = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    controller.setLandscape(landscape);
  }, [controller, landscape]);
  useEffect(() => {
    clearTimeout(disposal.current);
    room?.start();
    controller.setAppActive(AppState.currentState === 'active');
    const timer = setInterval(controller.poll, 100);
    const appState = AppState.addEventListener('change', (state) => {
      controller.setAppActive(state === 'active');
    });
    return () => {
      clearInterval(timer);
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
      enabled={landscape}
      keepSessionOnInactive={!!room}
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
