import type { ViroScanStatus } from '@reactvision/react-viro';

// Viro's Studio flow asks for 30 views beyond the native two-frame minimum.
const MIN_VIEWS = 30;
const FALLBACK_SECONDS = 10;
const count = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

export function scanGuidance(status: ViroScanStatus, elapsedSeconds: number) {
  const checks: { passed: boolean; progress: number; hint: string }[] = [];
  const add = (flag: boolean | undefined, value: unknown, minimum: unknown, hint: string) => {
    const measured = count(value) && count(minimum) && minimum > 0;
    if (typeof flag !== 'boolean' && !measured) return;
    checks.push({
      passed: flag !== false && (measured ? value >= minimum : flag === true),
      progress: measured ? Math.min(1, value / minimum) : flag ? 1 : 0,
      hint,
    });
  };
  add(
    status.meetsKeyframes,
    status.keyframes,
    Math.max(MIN_VIEWS, count(status.minKeyframes) ? status.minKeyframes : MIN_VIEWS),
    'Move slowly around the table to capture more views.'
  );
  add(
    status.meetsViewpointPairs,
    status.viewpointPairs,
    status.minViewpointPairs,
    'Move your phone sideways around the table, keeping it in view.'
  );
  add(
    status.meetsSpread,
    status.cameraSpreadMeters,
    status.minSpreadMeters,
    'Move farther around the table, keeping its corners in view.'
  );
  add(
    undefined,
    status.triangulatedPoints,
    status.minTriangulatedPoints,
    'Scan table edges and nearby textured objects in good light.'
  );
  const available = status.available && status.scanning !== false;
  const canFinish =
    available &&
    (checks.length ? checks.every((check) => check.passed) : elapsedSeconds >= FALLBACK_SECONDS);
  const progress = checks.length
    ? Math.min(...checks.map((check) => check.progress))
    : Math.max(0, elapsedSeconds) / FALLBACK_SECONDS;
  return {
    canFinish,
    progress: Math.max(0, Math.min(canFinish ? 1 : 0.95, progress)),
    message: canFinish
      ? 'Enough detail captured. Tap Create room to invite your opponent.'
      : (checks.find((check) => !check.passed)?.hint ??
        'Move slowly around the table, keeping its corners in view.'),
  };
}
