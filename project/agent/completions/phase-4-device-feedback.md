# Phase 4 — Device feedback fixes

Date: 2026-10-08 (America/New_York). Implementation and automated checks complete; revised native UI and cancellation acceptance pending.

## Delivery

- Worktree: `F:/ReactNativeApps/xr-showcase-i2Workspace/xr-showcase-phase-4-qubit`
- Branch: `phase-4-qubit`
- Original task base: `b09e4477f0da378b64c8ba9ed96e08b5febe6d45`
- Feedback starting HEAD: `45425e6d702684d17a15d29eab7d402cc82a77bc`
- Tested implementation HEAD: `fca28d3681184e82e25a086486d7f1c1d9e9b99f`
- The following documentation commit delivers this report. Retrieve its SHA with `git log -1 --format=%H -- project/agent/completions/phase-4-device-feedback.md`.

The owner supplied iPhone screenshots showing placement, a queued hardware job, and a completed winning hardware round on the previous build. Those are owner-reported results, not automated native verification of this revision.

## Changes

Before placement, the active HUD shows only: “Move slowly, then tap a highlighted flat surface to place a Bloch Sphere.” After placement, Simulator has no caption. Hardware Jobs shows: “Hardware queues can take time. Keep this screen open; leaving requests cancellation.”

The placed HUD contains the mode selector and four buttons: `0`, `1`, `Reset Qubit`, and `Restart AR`. Removed outer button borders/background wrappers, HUD Home, header-right Home, Reconnect, Resume, extra instructions, duplicate guess/job text, and oversized status text. The navigation back control is a minimal arrow. Buttons retain native pressed feedback; unavailable buttons are disabled and faded, and the selected guess keeps its distinct filled treatment. Reset is disabled when there is no round to clear. Dynamic Type scales numbers and action height; controls stack on narrow screens or at larger text sizes. The existing safe-area/scroll container and reduced-motion AR behavior remain.

Status appears once in normal-sized text. Hardware progress uses `Submitting…`, `Queued…`, `Running…`, and `Cancelling…`. Results use `You Won · 1` or the corresponding result. An interrupted submission appears once in yellow: “Submission interrupted before confirmation. The job may still run. Reset Qubit to retry.” Reset confirms another round before clearing that uncertainty. A late acknowledgement clears ambiguity and requests cancellation only; it never updates a new round or causes another submission. The submission-specific timeout increases from 30 to 60 seconds; ordinary requests remain bounded at 12 seconds and independent cancellation at 8 seconds.

The feature-local connection controller automatically retries health/backend discovery and cancellation recovery. Interrupted polling reconnects to the same job sequentially, with a 15-second minimum and Retry-After handling. No hardware submission is automatically repeated. Round errors can reconnect without repeating measurements; fatal hardware errors request cancellation and keep recovering failed cancellation before Reset is pressed.

Reset, Restart AR, surface loss, navigation blur, backgrounding, and unmount invalidate callbacks, abort round requests, stop polling, and request cancellation of known unfinished jobs. A feature-local AsyncStorage journal saves only this game's job IDs. Failed/incomplete cancellations remain recorded; reopening requests cancellation before enabling hardware again. Concurrent cleanup attempts for the same ID share one request. Local storage failure cannot delay the remote cancellation request. Mismatched cancellation acknowledgements retain the original ID; terminal acknowledgements and expired server IDs remove it.

Credentials and the first-party `@mr.dj2u/quantum-api@0.1.2` integration remain unchanged. No key was read, printed, committed, or edited. Expo SDK 57, package pins, lockfile, shared AR files/interfaces, roadmap, handoff, and sibling features are unchanged from feedback starting HEAD. The original additive `renderActiveOverlay` interface still needs coordinator review during integration; this revision adds no shared-interface change. No push, merge, PR, EAS build, deployment, credential administration, or protected live job was performed.

## Verification

Final MDS CI timestamp: `2026-10-08T15:28:52.186Z` (11:28 EDT).

| Check | Result |
| --- | --- |
| Final `npm test` via MDS CI | Exit 0. ESLint, Prettier, TypeScript, 14 AR tests and 90 Qubit tests passed: 104 total, zero failures. |
| New deterministic coverage | Caption/status rules; slow submission; automatic health/backend/poll reconnect; credential/offline/rate-limit failures; cancellation Retry-After; teardown; late IDs; persisted reopening cleanup; deduplication; mismatched cancellation IDs; storage read/write failures and delayed storage; fatal-error cancellation recovery. Existing payload/result/race/animation tests remain. |
| Expo Doctor via final MDS CI | Exit 0; 21/21 checks passed. |
| iOS JavaScript export via `npm run build` | Exit 0; `expo export --platform ios --max-workers 2`, 2,204 modules, 4.9 MB Hermes bundle, 28 assets. Bundle: `entry-cf6877e90a1d7eb3c6839e5562185c3c.hbc`. |
| MDS `doctor_scan_project(mode: "ci", runScripts: true)` | Score 99; zero errors, one existing warning category, 15 passed, four skipped. |
| React Doctor | Score 98; zero errors, seven existing warnings, all outside the Qubit feature. The introduced HUD complexity warning was fixed. |
| Viro scene schema | Zero errors and zero warnings. |
| Viro iOS/Android platform validation | All used features supported; no unsupported combinations. |
| Git checks | `git diff --cached --check` passed. Branch and scoped diff checked; dependency/configuration/shared AR preservation confirmed. |
| Dependency installation | No dependency changes in this revision; `npm ci` was not repeated. The preceding SDK delivery passed it with 988 packages and 31 existing audit advisories (11 moderate, 20 high). |

An intermediate test run caught an outdated readiness expectation after submission timeout. The test now requires successful reconnection as well as explicit acknowledgement before another hardware guess. Final tests pass. Existing MDS skips remain API routes, animation detection, non-target SEO, and native development/preview builds.

## Opt-in device acceptance

- [ ] Reload JavaScript from the assigned worktree. Confirm existing owner-provided build configuration works without asking players for a key.
- [ ] iPhone: verify the exact caption and no HUD controls before tapping a plane; afterward verify no simulator caption, only four buttons plus mode selection, no extra borders/Home/Reconnect, clear press/disabled/selected states, and readable concise statuses.
- [ ] Verify sphere placement, transparency, labels, introduction/collapse, live simulator outcomes, and Reset preserving position versus Restart AR permitting another plane.
- [ ] Verify safe areas, largest Dynamic Type sizes, VoiceOver, accessible touch targets, Reduce Motion, and camera handoff to another experience.
- [ ] Intentionally submit a hardware guess. Observe actual queued/running/result states and confirm the single shot completes with the expected measurement/outcome.
- [ ] For known pending jobs, test Reset, Restart AR, leaving the screen, backgrounding, and surface loss. Independently verify the provider's actual terminal/cancelled status, rather than treating a client abort as proof.
- [ ] Test interrupted submission, late acknowledgement, offline cancellation, automatic reconnect, and reopening with recorded unfinished jobs. Confirm recovery cancels old work rather than resuming it or submitting another job.
- [ ] Repeat on Android after iPhone acceptance.

Client cleanup cannot guarantee remote cancellation after an immediate force quit, network loss, or process termination before a job ID is returned. The current API exposes no server-side lease for automatic unattended-job expiry. The hardware caption therefore says “requests cancellation.” Absolute force-quit guarantees require service work outside this client revision. Mock tests, schema validation, and JavaScript export do not establish native AR or provider cancellation acceptance.
