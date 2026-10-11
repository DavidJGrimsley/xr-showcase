import type { ArenaInvite } from './arena-invite';

/** Consumes invitations only after the scanner is unmounted and landscape is available. */
export class ArenaJoinIntent<T extends string | ArenaInvite = string> {
  private pending: T | null = null;
  private last: string | null = null;
  offer(code: T) {
    const key = typeof code === 'string' ? code : code.space + ':' + code.code;
    if (!key || key === this.last) return false;
    this.last = key;
    this.pending = code;
    return true;
  }
  take(landscape: boolean, scannerMounted: boolean): T | null {
    if (!landscape || scannerMounted) return null;
    const code = this.pending;
    this.pending = null;
    return code;
  }
  cancel() {
    this.pending = null;
  }
  beginScan() {
    this.pending = this.last = null;
  }
}
