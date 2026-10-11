import { ARENA_PROTOCOL } from './arena-protocol-version.ts';
import type { ArenaSpace } from './arena-protocol.ts';

export interface ArenaInvite {
  code: string;
  space: ArenaSpace;
}
export const REMOTE_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
export function normalizeRemoteCode(value: string): string | null {
  const code = value.replace(/[\s-]+/g, '').toUpperCase();
  return code.length === 12 && [...code].every((c) => REMOTE_ALPHABET.includes(c)) ? code : null;
}
/** Native UUID entropy is already available in Expo Core; tests inject the generator. */
export function remoteCodeFromUUID(value: string) {
  if (!/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(value))
    throw new Error('Could not generate a room invite. Try again.');
  // Mask the fixed variant bits out of the final 64 bits, leaving 62 random bits.
  let entropy = BigInt('0x' + value.replace(/-/g, '').slice(-16)) & ((1n << 62n) - 1n);
  let code = '';
  for (let i = 0; i < 12; i++) {
    code += REMOTE_ALPHABET[Number(entropy % BigInt(REMOTE_ALPHABET.length))];
    entropy /= BigInt(REMOTE_ALPHABET.length);
  }
  return code;
}
export const formatRemoteCode = (code: string) => code.match(/.{1,4}/g)?.join(' ') ?? code;
export const remoteRoomId = (code: string) => {
  const normalized = normalizeRemoteCode(code);
  if (!normalized) throw new Error('Enter the twelve-character long-distance invite code.');
  return 'arena-remote-v1:' + normalized;
};
export function inviteLink({ code, space }: ArenaInvite) {
  return (
    'xr-showcase://arena-fighter?join=' +
    encodeURIComponent(code) +
    (space === 'remote' ? '&space=remote' : '') +
    '&v=' +
    ARENA_PROTOCOL
  );
}
export function parseArenaInvite(value: string): ArenaInvite | null {
  try {
    const url = new URL(value);
    const space = url.searchParams.get('space') ?? 'same-space';
    const code = url.searchParams.get('join') ?? '';
    if (
      url.protocol !== 'xr-showcase:' ||
      url.hostname !== 'arena-fighter' ||
      (url.pathname !== '' && url.pathname !== '/') ||
      url.searchParams.get('v') !== String(ARENA_PROTOCOL) ||
      !['same-space', 'remote'].includes(space)
    )
      return null;
    const normalized =
      space === 'remote'
        ? normalizeRemoteCode(code)
        : /^[ABCDEFGHJKMNPQRSTVWXYZ23456789]{6,8}$/.test(code.replace(/[\s-]+/g, '').toUpperCase())
          ? code.replace(/[\s-]+/g, '').toUpperCase()
          : null;
    return normalized ? { code: normalized, space: space as ArenaSpace } : null;
  } catch {
    return null;
  }
}
