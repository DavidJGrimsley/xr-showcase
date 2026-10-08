# Phase 4 — Quantum SDK and hackathon build configuration

Date: 2026-10-08 (America/New_York). Implementation complete; native and protected live acceptance pending.

Subsequent device feedback supersedes the HUD's Reconnect control and status copy described here. See [the latest device-feedback report](phase-4-device-feedback.md) for automatic reconnection, cancellation recovery, and current acceptance evidence. This document preserves the earlier SDK/configuration delivery.

## Delivery

- Worktree: `F:/ReactNativeApps/xr-showcase-i2Workspace/xr-showcase-phase-4-qubit`
- Branch: `phase-4-qubit`
- Original task base: `b09e4477f0da378b64c8ba9ed96e08b5febe6d45`
- Refactor starting HEAD: `850d4dae7b0bae3aac47d71e804ebf03df2f2afa`
- SDK/configuration commit: `bc6aff00227a27dce1d6e0c8e915707060675384`
- Tested implementation HEAD: `765b22d330b4911dbab6319cbda447c753b25313` (includes the Windows CI export mitigation)
- This report follows in a documentation commit; `git log -1 --format=%H -- project/agent/completions/phase-4-sdk-refactor.md` identifies it.

The owner explicitly requested use of the npm package where appropriate and authorized bundling a demo API key for the hackathon. This supersedes the earlier private on-device key-entry requirement. Players no longer enter, replace, or delete credentials.

## Changes

Installed and pinned `@mr.dj2u/quantum-api@0.1.2` after reading the published README, implementation, and types. The package covers every runtime route needed here. `src/services/quantum-api.ts` now delegates health, backend discovery, gate measurement, hardware submission/status/result/cancellation to its SDK methods. The game adapter retains injected fetch/clock, response validation, timeouts, abort propagation, sanitized errors, Retry-After handling, and late-acknowledgement cancellation. SDK errors retain remote bodies internally, so the adapter converts them into sanitized game errors instead of exposing them. Neither SDK nor game automatically resubmits hardware work.

`qubit-configuration.ts` now resolves build values, validates the URL, and supplies the existing backend/profile defaults. `use-qubit-configuration.native.ts` reads explicit Expo env property accesses and creates the SDK-backed client. The active HUD checks health/backend availability automatically on session entry, aborts checks on teardown, and offers Reconnect. A rejected demo key disables both modes. Hardware/backend discovery failures can leave the simulator available. Missing build configuration disables guesses and reports demo-service unavailability without asking players for credentials.

The screen removes Configure and the entire `qubit-configuration-sheet.native.tsx` key-entry sheet. There is no Qubit SecureStore loading or writing. Existing dependency pins and Expo plugins remain in place. Credential-denial text no longer directs players to change keys.

Added root `.env.example`, based on the supplied portfolio example, and [one-time build setup](../../quantum-demo-setup.md). It defines:

- `EXPO_PUBLIC_QUANTUM_API_KEY` (empty example value; owner supplies the existing demo key)
- `EXPO_PUBLIC_QUANTUM_API_BASE_URL` (production v1 default)
- `EXPO_PUBLIC_QUANTUM_BACKEND` (`ibm_kingston`)
- `EXPO_PUBLIC_QUANTUM_IBM_PROFILE` (`Unreal Engine Demos`)

Both EAS development profiles explicitly select the `development` environment. `.env` variants remain ignored. No actual key was supplied, copied, committed, or printed. The chosen approach intentionally makes the build-time key readable in the client bundle; no proxy or credential administration was added.

The lockfile changes only to add the SDK and npm dependency metadata. A JSON comparison confirmed **zero existing package version changes**. Expo remains on SDK 57. No sibling feature, roadmap, handoff, shared AR interface, or camera contract changed in this refactor. The original additive overlay interface still warrants coordinator review at integration.

## Verification

Final MDS CI timestamp: `2026-10-08T07:06:46.770Z` (03:06 EDT).

| Check | Result |
| --- | --- |
| `npm install --save-exact '@mr.dj2u/quantum-api@0.1.2'` | Exit 0; one SDK added. |
| `npm ci` | Exit 0; 988 packages installed. Existing advisories remain 31: 11 moderate, 20 high. |
| `npm test` | Exit 0; lint, formatting, TypeScript, 14 AR tests and 61 Qubit tests passed, 0 failures (75 total). |
| SDK-backed transport tests | Passed exact gate/job payloads and authentication, public health, backend validation, every HTTP error mapping, numeric/date retry delays, malformed responses, abort/timeouts, late job IDs, independent cancellation, and base normalization. Former SecureStore tests are replaced by build configuration/default/invalid-value tests. Existing round/race/geometry tests remain. |
| Expo Doctor via final MDS CI | 21/21 passed, exit 0. |
| `npm run build:ios`, `npm run build`, and `CI=true npm run build` | Direct Windows executions passed, producing the iOS Hermes export (~4.9 MB; 2,195 modules). |
| Synthetic env export, `npm run build:ios -- --clear` | Exit 0. Verified the synthetic test key was inlined and SDK methods were present in the bundle. Old key-entry label absent. This used no real key and executed no live API call. |
| Cleared export with ordinary environment restored | Exit 0. Restored the bundle/cache to the unconfigured environment after the synthetic fixture. |
| Final MDS `doctor_scan_project(projectPath: assigned worktree, mode: "ci", runScripts: true)` | Score 99, 0 errors, 1 warning category, 15 passed, 4 skipped. Production export passed with two Metro workers. |
| Git whitespace and preservation checks | Passed. Roadmap, immutable handoff, and shared AR files unchanged from refactor starting HEAD. |

Two earlier MDS CI exports failed with Windows access-violation exit `3221225477` despite successful direct exports, including direct CI mode. Limiting the existing `build:ios` export script to `--max-workers 2` resolved the observed MDS runner failure; final identical CI checks passed. The underlying Windows crash cause is not established. The bounded-worker mitigation is committed in `765b22d`; it changes export concurrency, not game behavior or native build dependencies.

Shell env changes initially reused an old Metro transform. Clearing the cache confirmed Expo inlining. Setup instructions now explicitly clear Metro after local env changes. Existing React Doctor advisories remain 7, all outside Qubit feature files; score 98, 0 errors. MDS skips API routes, undetected animation-heavy files, non-target SEO, and full native builds, as in the original delivery. Schema/platform scene validation from the original delivery remains applicable because the Viro scene/navigator did not change; it is not native acceptance proof.

## Remaining owner actions

1. Supply the existing demo key once in local `.env` and/or the EAS **development** environment, following the setup guide. The referenced `.env.example` contains placeholders rather than an actual key. Players do not perform this step.
2. Build/install the physical iPhone development client. Verify automatic connection and live simulator guesses, AR placement/readability/transparency, reduced motion/accessibility, Reset, Home, background/resume, and camera handoff.
3. Intentionally opt in to one-shot IBM hardware testing and inspect actual queue/result/cancellation outcomes. No protected live calls or real jobs were made during the refactor. A local abort/cancellation request still does not guarantee remote cancellation.
4. Repeat acceptance on Android after iPhone, then coordinate integration and refresh authoritative base/reachability evidence before roadmap reconciliation.

No EAS build, publication, PR, push, merge, or credential administration was performed. Native AR and protected live results remain unverified. The earlier SecureStore/player-entry acceptance steps are superseded; the remaining geometry, game, lifecycle, and accessibility acceptance requirements still apply.
