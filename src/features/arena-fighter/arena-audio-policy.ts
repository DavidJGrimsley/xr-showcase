import manifest from '../../../assets/arena/sounds/audio-manifest.json' with { type: 'json' };
import type { FighterId } from './arena-controller.ts';

export type MainAudioSource = 'host' | 'guest' | 'both';
export type AudioContext = 'solo' | 'same-space' | 'remote';
export type VoiceKey = Exclude<keyof typeof manifest.assets, 'menu' | 'battle'>;
export type AnnouncementKey = Exclude<VoiceKey, 'title' | 'win' | 'lose'> | 'result';
export interface ArenaAnnouncement {
  id: string;
  key: AnnouncementKey;
  elapsed: number;
  duration: number;
}
export const AUDIO_BUFFER = 0.15;
export const AUDIO_WATCHDOG = 5;
export const voiceDuration = (key: VoiceKey) => manifest.assets[key].durationSeconds;
export function playsMainAudio(mode: 'solo' | 'host' | 'guest', source: MainAudioSource) {
  return mode === 'solo' || source === 'both' || mode === source;
}
export function playsImpact(context: AudioContext, local: FighterId, receiver: FighterId) {
  return context !== 'same-space' || local === receiver;
}
export function announcementVoice(
  cue: ArenaAnnouncement,
  local: FighterId,
  outcome: FighterId | 'draw' | null
): VoiceKey | null {
  if (cue.key !== 'result') return cue.key;
  return !outcome || outcome === 'draw' ? null : outcome === local ? 'win' : 'lose';
}
export function validAnnouncement(value: unknown): value is ArenaAnnouncement | null {
  if (value === null) return true;
  if (!value || typeof value !== 'object') return false;
  const cue = value as ArenaAnnouncement;
  return (
    typeof cue.id === 'string' &&
    cue.id.length > 0 &&
    cue.id.length <= 200 &&
    ['round1', 'round2', 'round3', 'round4', 'round5', 'ready', 'fight', 'result'].includes(
      cue.key
    ) &&
    Number.isFinite(cue.elapsed) &&
    cue.elapsed >= 0 &&
    cue.duration === (cue.key === 'result' ? voiceDuration('lose') : voiceDuration(cue.key))
  );
}
