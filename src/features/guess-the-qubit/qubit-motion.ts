import type { QubitSnapshot } from './qubit-round-controller';

// Scene projection is separate from the round controller: animations cannot manufacture a result.
export function qubitMotion(state: QubitSnapshot, reducedMotion: boolean) {
  const collapsing = state.phase === 'collapsing';
  const target = state.measurement === 1 ? -180 : 0;
  const stage = collapsing ? 'collapse' : state.phase === 'complete' ? 'complete' : 'intro';
  const angle =
    state.phase === 'complete' || (reducedMotion && collapsing)
      ? target
      : state.introDone
        ? -90
        : 0;
  const preparing = state.guess !== null && !state.introDone && state.phase !== 'error';
  return {
    key: `${state.roundId}-${stage}`,
    angle,
    collapsing,
    name: collapsing ? (state.measurement === 1 ? 'qubitOne' : 'qubitZero') : 'qubitIntro',
    run: !reducedMotion && (collapsing || preparing),
    pulse: !reducedMotion && state.introDone && ['waiting', 'paused'].includes(state.phase),
  };
}
