/** Each effect/receiver has three independent voices. Never rewind a playing voice. */
export class ArenaImpactSlots {
  private playing = new Set<string>();
  reserve(effect: string) {
    for (let slot = 0; slot < 3; slot++) {
      const key = `${effect}:${slot}`;
      if (!this.playing.has(key)) {
        this.playing.add(key);
        return key;
      }
    }
    return null;
  }
  finish(key: string) {
    this.playing.delete(key);
  }
  clear() {
    this.playing.clear();
  }
}
