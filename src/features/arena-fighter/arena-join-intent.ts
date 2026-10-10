/** Consumes invitations only after the scanner is unmounted and landscape is available. */
export class ArenaJoinIntent {
  private pending: string | null = null;
  private last: string | null = null;
  offer(code: string) {
    if (!code || code === this.last) return false;
    this.last = code;
    this.pending = code;
    return true;
  }
  take(landscape: boolean, scannerMounted: boolean): string | null {
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
