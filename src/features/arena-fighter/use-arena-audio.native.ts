import { useEffect, useLayoutEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Asset } from 'expo-asset';
import { ArenaAudio } from './arena-audio';
import type { ArenaMatch } from './arena-match';

const sources = {
  menu: require('../../../assets/arena/sounds/menu.m4a'),
  battle: require('../../../assets/arena/sounds/battle.m4a'),
  title: require('../../../assets/arena/sounds/title.wav'),
  ready: require('../../../assets/arena/sounds/ready.wav'),
  fight: require('../../../assets/arena/sounds/fight.wav'),
  win: require('../../../assets/arena/sounds/win.wav'),
  lose: require('../../../assets/arena/sounds/lose.wav'),
  round1: require('../../../assets/arena/sounds/round1.wav'),
  round2: require('../../../assets/arena/sounds/round2.wav'),
  round3: require('../../../assets/arena/sounds/round3.wav'),
  round4: require('../../../assets/arena/sounds/round4.wav'),
  round5: require('../../../assets/arena/sounds/round5.wav'),
};

export function useArenaAudio(match: ArenaMatch | null, landscape: boolean, titleVisible: boolean) {
  const owner = useRef<ArenaAudio | null>(null);
  const inputs = useRef({ match, landscape, titleVisible });
  useLayoutEffect(() => {
    inputs.current = { match, landscape, titleVisible };
  }, [match, landscape, titleVisible]);
  const disposal = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    let attached = true;
    clearTimeout(disposal.current);
    const sync = () => {
      owner.current?.connect(inputs.current.match);
      owner.current?.environment(
        AppState.currentState === 'active',
        inputs.current.landscape,
        inputs.current.titleVisible
      );
    };
    if (!owner.current) {
      void setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: 'mixWithOthers',
      })
        .then(async () => {
          if (!attached) return;
          const keys = Object.keys(sources) as (keyof typeof sources)[];
          const cached = await Asset.loadAsync(keys.map((key) => sources[key]));
          if (!attached) return;
          const playbackSources = new Map(keys.map((key, index) => [key, cached[index]]));
          owner.current = new ArenaAudio((key) =>
            createAudioPlayer(playbackSources.get(key)!.localUri ?? playbackSources.get(key)!.uri, {
              updateInterval: 50,
              keepAudioSessionActive: true,
            })
          );
          sync();
        })
        .catch(() => {
          // Playback failure keeps the match's manifest-duration silent fallback available.
        });
    } else sync();
    const appState = AppState.addEventListener('change', sync);
    let previous = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      sync();
      owner.current?.tick(Math.min(0.1, (now - previous) / 1000));
      previous = now;
    }, 50);
    return () => {
      attached = false;
      clearInterval(timer);
      appState.remove();
      // Strict Mode reattachment retains the same players and title/cue cursors.
      disposal.current = setTimeout(() => {
        owner.current?.dispose();
        owner.current = null;
      }, 0);
    };
  }, []);
  useEffect(() => {
    owner.current?.connect(match);
    owner.current?.environment(AppState.currentState === 'active', landscape, titleVisible);
  }, [match, landscape, titleVisible]);
}
