# Phase 4 — Guess the Qubit implementation report

Date: 2026-10-08 (America/New_York).

Implementation and automated verification are complete. Physical native AR and protected live API acceptance remain owner-owned and unverified. This report does not mark the roadmap or the entire phase accepted.

## Delivery identity

- Worktree: `F:/ReactNativeApps/xr-showcase-i2Workspace/xr-showcase-phase-4-qubit`
- Assigned branch: `phase-4-qubit`
- Repository: `https://github.com/DavidJGrimsley/xr-showcase.git`
- Immutable task base: `b09e4477f0da378b64c8ba9ed96e08b5febe6d45`
- Handoff/bootstrap commit: `ab7547f31ea7af9cd2230323a5e89485f0487956`
- Tested implementation HEAD: `6fcdf0ad749893e2c39ef1bd7fca7a591db9c281` — `feat: implement Guess the Qubit AR experience`
- This report is delivered in a subsequent documentation commit. Retrieve its exact SHA with `git log -1 --format=%H -- project/agent/completions/phase-4.md`.

The implementation commit changes 15 files (2,501 insertions, 3 deletions). Expo SDK 57, dependency pins, and `package-lock.json` are preserved, as the user confirmed. No push, PR, merge, deployment, public distribution, hardware submission, or credential administration was performed. Neither roadmap nor the immutable handoff was edited. No sibling experience or Unreal project was changed.

## Implemented behavior and files

`src/features/guess-the-qubit/guess-the-qubit-screen.native.tsx` replaces the native placeholder through the existing navigator injection. Simulator is the default. The dark HUD exposes Simulator/Hardware Jobs, Guess 0/1, status, Reset, Home, Restart AR, configuration, connection checking, and recovery actions. Guesses require placement, tracking, and configuration readiness. Controls include text, accessible labels, safe-area placement, scrolling, and a stacked layout for narrow screens or larger text.

`qubit-navigator.native.tsx`, `qubit-scene.native.tsx`, `qubit-geometry.ts`, and `qubit-motion.ts` implement horizontal-surface tap placement and the 0.25 m translucent cyan Bloch sphere, three rings, axes, six basis labels, magenta vector, procedural arrowhead, and state point. Quantum Z maps to Viro's vertical Y; the coordinate mapping preserves handedness. Label glyphs use conventional ASCII ket brackets because the preview font lacked the Unicode bracket. The camera remains user-controlled. Viro imports stay in native feature files; the unsupported-platform fallback remains available.

The vector begins at `|0>`, rotates through pi/2 over 800 ms, and collapses over 400 ms only after both introduction completion and validated measurement. Win/loss appears after collapse. The waiting point pulses using native Viro animations. Reduced motion projects directly to the equator or measured pole and provides textual status. Reset clears the round while keeping placement; Restart AR allows replacement. Losing the selected anchor clears the round and returns to placement.

`src/services/quantum-api.ts` provides the injectable, typed client against `https://davidjgrimsley.com/public-facing/api/quantum/v1`, following the retrieved production OpenAPI contract. It validates responses, accepts abort signals, enforces bounded timeouts, honors `Retry-After`, and exposes sanitized typed errors without remote error bodies or credentials.

- Simulator calls `POST /gates/run` with `gate_type: "rotation"` and `rotation_angle_rad: Math.PI / 2`. Only numeric measurement 0/1 is accepted. The stored guess is compared with measurement independently of the response's `success` flag.
- Hardware makes one `POST /jobs/circuits` submission: IBM provider, one qubit, one shot, `ry(Math.PI / 2)` on qubit 0. There is no automatic resubmission.
- Public health and authenticated backend discovery validate connection/configuration. Defaults are `ibm_kingston` and the existing profile `Unreal Engine Demos`; both are editable.
- Hardware status polling is sequential, spaced 15 seconds after the preceding response, and handles queued, running, cancelling, succeeded, failed, and cancelled. Results are fetched only after success. They must have the matching job ID, succeeded status, one qubit, one shot, and nonnegative integer 0/1 counts totaling one.

`qubit-configuration.ts`, `use-qubit-configuration.native.ts`, and `qubit-configuration-sheet.native.tsx` store the privately entered development key in SecureStore using `WHEN_UNLOCKED_THIS_DEVICE_ONLY`. The saved key is never displayed. Replacement is masked; deletion and storage failures are handled. Credentials remain in the private configuration/transport service, outside observable round state, public environment variables, diagnostics, and source. No keys or profiles are created or administered.

`qubit-round-controller.ts` owns session/round identity, stored guess, animation readiness, validated measurement, job status, and completion. Duplicate taps and stale callbacks are rejected. Recoverable polling/result failures pause and offer Resume for the same job, respecting retry delays. An ambiguous submission failure without a job ID blocks another hardware submission until explicit owner acknowledgement after checking the remote outcome.

Reset, Home, background teardown, session replacement, selected-surface loss, and unmount invalidate callbacks, abort requests, and stop timers. Known unfinished jobs receive an independent bounded cancellation request. Late submission acknowledgements trigger cancellation only. Cancellation notices distinguish an attempted request from confirmed remote cancellation; an aborted HTTP request does not guarantee that IBM work stopped. Unknown submissions without an ID cannot be cancelled by the client.

## Minimal shared interface change — coordinator review

Two shared files change: `src/features/ar/ar-session-types.ts` and `src/features/ar/ar-session-boundary.native.tsx`.

`ARSessionBoundaryProps` adds optional `renderActiveOverlay(context)`. Its context contains `sessionId`, `status` (`starting` or `running`), instructions, `home`, and `restartAR`. It is invoked only while the navigator is mounted. Qubit uses it for its compact HUD. Existing permission, unsupported-runtime, and error panels remain owned by the boundary; other experiences retain the default overlay. This is an additive interface, with no camera/session contract redesign. The coordinator should review these two files alongside sibling integrations.

## Verification

All commands ran in the assigned worktree. The final MDS CI run revalidated the completed implementation at `2026-10-08T05:57:17.774Z` (01:57 EDT).

| Check | Exact result |
| --- | --- |
| `npm ci` | Exit 0; 987 packages installed. Existing audit advisories: 31 (11 moderate, 20 high). No forced fixes or dependency changes. |
| `npm run test:qubit` | Exit 0; 61 tests passed, 0 failed/skipped. |
| `npm test` | Exit 0; ESLint, Prettier, TypeScript, 14 existing AR tests, and 61 Qubit tests passed (75 total). |
| `npx expo-doctor` | Exit 0; 21/21 checks passed. |
| `npm run build:ios` | Exit 0; iOS Hermes JavaScript export succeeded, approximately 4.9 MB. This is not a native binary build. |
| MDS `doctor_scan_project` with assigned `projectPath`, `mode: "ci"`, `runScripts: true` | Score 99; 0 errors, 1 warning category, 15 passed, 4 skipped. Scripts, Expo Doctor, and production JavaScript export passed. |
| Viro `reactviro_validate_scene` | Final scene: 0 errors, 0 warnings. |
| Viro `reactviro_check_platform_support`, iOS/Android | No unsupported combinations flagged by the scene scan. This is static support evidence, not device proof. |
| Viro web-rendered static geometry preview | Render succeeded. Label scale/glyph issues found in the first preview were corrected and previewed again. Does not verify ARKit/ARCore placement, native transparency, or animations. |
| `git diff --check` and staged whitespace check | Passed. |
| `git diff --stat b09e4477f0da378b64c8ba9ed96e08b5febe6d45...HEAD` | Reviewed after implementation: 16 files, 2,569 insertions, 3 deletions, including the pre-existing bootstrap handoff. The documentation commit adds this report. |
| `git diff --stat origin/main HEAD` | Reviewed against cached `origin/main` at the task base; same implementation comparison. This is not a refreshed authoritative integration-base check. |
| Lockfile/roadmap preservation | Git content comparisons passed; dependency pins and lockfile unchanged. |

Tests use mocked transport, private storage adapters, and controllable clocks. They cover all guess/result pairs, fast/slow ordering, stale animations, malformed measurements/counts, mismatched IDs, credentials, offline errors, rate limits, timeouts, every hardware status, duplicate taps, Resume, teardown during submission/polling, late acknowledgements, cancellation failure, SecureStore failures, reduced motion, and geometry.

The MDS warning is React Doctor: 0 errors, 7 residual warnings, score 98. Findings are in shared AR boundary complexity/dynamic padding, fallback/Home dynamic padding, Settings/theme export structure, and local-data sequential async work. No finding is in the Qubit feature files. The modified shared boundary remains a coordinator review item; these advisories were not addressed through broader refactoring. MDS skipped API-route scanning, animation-heavy-file detection, non-target web SEO, and its full native build profile. In particular, its animation scan did not detect this native Viro animation work and is not performance acceptance.

An initial formatting failure came from CRLF materialization of otherwise unchanged tracked files on Windows. Content-identical files were normalized for verification, without unrelated Git content changes or formatter/Git configuration changes. No introduced validation failure remains. No protected live request or real job was used in tests. Public OpenAPI and health were read; health reported healthy/Qiskit at that time, which does not establish hardware availability.

## Opt-in owner acceptance checklist

Use a private native development build with Viro support on a physical iPhone first. `npm start` serves the development client; JavaScript export and mock tests cannot substitute for native acceptance. No paid/cloud native build was launched during this implementation.

- [ ] Exercise camera denial, subsequent permission grant, unavailable-runtime messaging, Home, and Restart AR. Confirm only one camera session is active when switching rapidly between experiences.
- [ ] Scan a horizontal table and tap to place. Confirm the sphere is about 0.25 m across, north/south correspond to 0/1, all six labels and axes read correctly, the vector/point are magenta, and shell transparency is readable from multiple distances/angles. Confirm free camera movement and surface-loss/replacement behavior.
- [ ] Open Configure and privately enter an existing development key. Confirm masked replacement, blank retention, deletion, persisted settings after relaunch, and recoverable storage errors. Never paste the key into reports or screenshots. Verify availability of `ibm_kingston` and `Unreal Engine Demos` using Check connection.
- [ ] Opt in to live simulator calls. Try Guess 0 and Guess 1 across several rounds. Confirm the 800 ms introduction, waiting pulse/status, 400 ms collapse, correct win/loss, and Reset preserving placement. Confirm a fast response cannot bypass introduction completion and a slow response waits at the equator.
- [ ] Only when intentionally opting in to IBM usage, select Hardware Jobs and make one guess. Confirm one shot/one qubit, queued/running status, sequential 15-second polling, valid one-count result, and no duplicate submission from repeated taps.
- [ ] Exercise wrong credentials, unavailable backend/profile, offline mode, and rate limits. Confirm readable recovery, respected cooldowns, and Resume retaining the same job. If submission times out without an ID, inspect the remote outcome before acknowledging permission for another shot.
- [ ] During submission and polling, test Reset, Home, backgrounding, and Restart AR. Verify known/late-acknowledged jobs receive cancellation attempts and stale responses cannot update a new round. Check the provider for the actual terminal outcome; cancellation requests and local aborts alone are not remote confirmation.
- [ ] Enable Reduce Motion, VoiceOver, and large Dynamic Type; test a narrow viewport. Verify textual status, reachable controls, readable configuration, appropriate touch targets, immediate reduced-motion state changes, and no pulsing. Check background/resume returns through the existing AR lifecycle without restoring stale round work.
- [ ] After iPhone acceptance, repeat placement, rendering, accessibility, lifecycle, and camera-handoff checks on a supported Android device.

No external implementation dependency remains. The unverified acceptance items above require the owner's device, private existing credentials, and explicit live hardware opt-in. No ReactVision Studio authoring is needed for this procedural scene.

## Integration status

The branch is ready for coordinator review. Refresh final-base evidence through the source checkout when coordinating integration, compare against current authoritative `origin/main`, review the additive overlay interface, and verify merge/reachability before reconciling roadmap status. The canonical control roadmap and source roadmap remain untouched. Native/live acceptance is pending; this delivery makes no claim that the entire phase is accepted.
