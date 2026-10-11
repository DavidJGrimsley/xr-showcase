import type { ArenaMatch } from './arena-match.ts';
import {
  AUDIO_BUFFER,
  AUDIO_WATCHDOG,
  announcementVoice,
  playsMainAudio,
  voiceDuration,
  type VoiceKey,
} from './arena-audio-policy.ts';

export type AudioAssetKey = VoiceKey | 'menu' | 'battle';
export interface AudioPlaybackStatus {
  didJustFinish: boolean;
  currentTime: number;
  error: string | null;
}
export interface AudioPlayerPort {
  volume: number;
  loop: boolean;
  playing: boolean;
  isLoaded: boolean;
  play(): void;
  pause(): void;
  seekTo(seconds: number): Promise<void>;
  release(): void;
  addListener(
    event: 'playbackStatusUpdate',
    listener: (status: AudioPlaybackStatus) => void
  ): { remove(): void };
}
interface VoicePlayback {
  id: string;
  key: VoiceKey;
  elapsed: number;
  doneAt: number | null;
  preparing: boolean;
  prepared: boolean;
  started: boolean;
  failed: boolean;
}

/** One owner for the whole game visit; AR/HUD remounts cannot restart music or speech. */
export class ArenaAudio {
  private players = new Map<AudioAssetKey, AudioPlayerPort>();
  private subscriptions: { remove(): void }[] = [];
  private failed = new Set<AudioAssetKey>();
  private completed = new Set<string>();
  private match: ArenaMatch | null = null;
  private stopMatch: (() => void) | null = null;
  private voice: VoicePlayback | null = null;
  private titlePlayed = false;
  private titleVisible = false;
  private active = true;
  private landscape = true;
  private disposed = false;
  private musicVolume = 0.45;
  private paired = false;

  constructor(create: (key: AudioAssetKey) => AudioPlayerPort) {
    try {
      for (const key of [
        'menu',
        'battle',
        'title',
        'ready',
        'fight',
        'win',
        'lose',
        'round1',
        'round2',
        'round3',
        'round4',
        'round5',
      ] as const) {
        const player = create(key);
        player.volume = key === 'menu' || key === 'battle' ? 0.45 : 1;
        player.loop = key === 'menu' || key === 'battle';
        this.players.set(key, player);
        this.subscriptions.push(
          player.addListener('playbackStatusUpdate', (status) => {
            if (this.disposed) return;
            if (status.error) {
              this.failed.add(key);
              if (this.voice?.key === key) this.voice.failed = true;
            }
            const voice = this.voice;
            if (
              voice?.key === key &&
              voice.started &&
              status.didJustFinish &&
              status.currentTime >= voiceDuration(key as VoiceKey) - 0.1
            )
              this.finish(voice);
          })
        );
      }
    } catch (error) {
      this.dispose();
      throw error;
    }
  }
  connect(match: ArenaMatch | null) {
    if (this.disposed || this.match === match) return;
    this.stopMatch?.();
    this.match?.setAudioAvailable(false);
    if (this.voice?.id !== 'title') this.cancelVoice();
    this.completed.clear();
    this.paired = false;
    this.match = match;
    match?.setAudioAvailable(true);
    match?.setAudioActive(this.active);
    this.stopMatch = match?.subscribe(() => this.reconcile()) ?? null;
    if (!match) {
      const battle = this.players.get('battle')!;
      battle.pause();
      void battle.seekTo(0).catch(() => this.failed.add('battle'));
    }
    this.reconcile();
  }
  environment(active: boolean, landscape: boolean, titleVisible: boolean) {
    this.active = active;
    this.landscape = landscape;
    this.titleVisible = titleVisible;
    this.match?.setAudioActive(active);
    this.reconcile();
  }
  private enabled() {
    const state = this.match?.getSnapshot();
    return (
      this.active &&
      this.landscape &&
      (!state ||
        (!state.orientationPaused &&
          state.stage !== 'paused' &&
          state.stage !== 'abandoned' &&
          (state.stage === 'lobby' || state.animationsRunning)))
    );
  }
  private mainEnabled() {
    const state = this.match?.getSnapshot();
    return !state || !this.paired || playsMainAudio(state.mode, state.mainAudioSource);
  }
  private cancelVoice() {
    if (this.voice) this.players.get(this.voice.key)?.pause();
    this.voice = null;
  }
  private startVoice(id: string, key: VoiceKey) {
    this.musicVolume = 0.15;
    const voice: VoicePlayback = {
      id,
      key,
      elapsed: 0,
      doneAt: null,
      preparing: false,
      prepared: false,
      started: false,
      failed: this.failed.has(key),
    };
    this.voice = voice;
  }
  private prepareVoice(voice: VoicePlayback) {
    const player = this.players.get(voice.key)!;
    if (voice.preparing || voice.prepared || voice.failed || !player.isLoaded) return;
    voice.preparing = true;
    void player
      .seekTo(0)
      .then(() => {
        if (this.disposed || this.voice !== voice) return;
        voice.prepared = true;
        this.reconcile();
      })
      .catch(() => {
        if (this.voice === voice) voice.failed = true;
      });
  }
  private finish(voice: VoicePlayback) {
    if (this.voice !== voice || voice.doneAt !== null) return;
    voice.doneAt = voice.elapsed;
    this.completed.add(voice.id);
    if (voice.id !== 'title') this.match?.announcementFinished(voice.id);
  }
  private reconcile() {
    if (this.disposed) return;
    const state = this.match?.getSnapshot();
    if (state?.peerConnected) this.paired = true;
    const cue = state?.announcement;
    if (this.voice && this.voice.id !== 'title' && this.voice.id !== cue?.id) this.cancelVoice();
    if (!this.voice && cue && !this.completed.has(cue.id)) {
      const key = announcementVoice(cue, state!.localFighter, state!.outcome);
      if (key && (cue.key === 'result' || this.mainEnabled())) this.startVoice(cue.id, key);
    }
    if (!this.voice && this.titleVisible && !this.titlePlayed && !this.match) {
      this.titlePlayed = true;
      this.startVoice('title', 'title');
    }
    const enabled = this.enabled();
    const musicEnabled =
      state?.stage === 'lobby'
        ? this.active && this.landscape && !state.localOrientationPaused
        : enabled;
    const music = state?.battleMusicStarted ? 'battle' : 'menu';
    for (const key of ['menu', 'battle'] as const) {
      const player = this.players.get(key)!;
      player.volume = this.musicVolume;
      const run = musicEnabled && this.mainEnabled() && key === music && !this.failed.has(key);
      if (run && player.isLoaded && !player.playing) player.play();
      else if (!run && player.playing) player.pause();
    }
    const voice = this.voice;
    if (voice) {
      this.prepareVoice(voice);
      const player = this.players.get(voice.key)!;
      if (enabled && voice.prepared && !voice.failed && voice.doneAt === null && player.isLoaded) {
        if (!player.playing) player.play();
        voice.started = true;
      } else if (player.playing) player.pause();
    }
  }
  /** Active time only: backgrounding and game pauses preserve the voice and its buffer. */
  tick(dt: number) {
    if (this.disposed || !Number.isFinite(dt) || dt <= 0) return;
    if (this.enabled()) {
      const voice = this.voice;
      if (voice) {
        voice.elapsed += dt;
        if (
          (voice.failed && voice.elapsed >= voiceDuration(voice.key)) ||
          voice.elapsed >= voiceDuration(voice.key) + AUDIO_WATCHDOG
        )
          this.finish(voice);
        if (voice.doneAt !== null && voice.elapsed >= voice.doneAt + AUDIO_BUFFER)
          this.cancelVoice();
      }
      const target = this.voice ? 0.15 : 0.45;
      this.musicVolume =
        target < this.musicVolume
          ? target
          : Math.min(target, this.musicVolume + (0.3 * dt) / AUDIO_BUFFER);
    }
    this.reconcile();
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stopMatch?.();
    this.match?.setAudioAvailable(false);
    this.voice = null;
    for (const subscription of this.subscriptions) subscription.remove();
    for (const player of this.players.values()) player.release();
    this.players.clear();
  }
}
