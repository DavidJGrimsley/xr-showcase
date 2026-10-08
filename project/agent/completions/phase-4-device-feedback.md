# Phase 4 — Device feedback fixes

Date: 2026-10-08 (America/New_York). Implementation and automated checks complete; revised native UI and cancellation acceptance pending.

Latest revision: [reactive buttons, full-width controls, and native info scrolling](#follow-up-reactive-buttons-and-native-scrolling), correcting the preceding [header info modal](#follow-up-header-info-modal) and [disabled guesses, vector labels, sizing, and centering](#follow-up-disabled-guesses-labels-and-sizing) deliveries. Historical descriptions below preserve their original validation evidence.

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

## Follow-up: disabled guesses, labels, and sizing

Feedback starting HEAD: `650a8854f885eb2fa221e71171d4f5369936e0f4`. Tested implementation HEAD: `e2e2235cd28304d1987a9208141dd2e3e590da78`. Branch and worktree remain as recorded above. The following documentation commit updates this report; retrieve its SHA with the delivery command above.

Both guess buttons now use the same disabled treatment: outlined native buttons, muted gray numbers, and 40% opacity. The selected guess no longer retains its enabled appearance. Enabled guesses have filled backgrounds with dark, contrasting numbers. Native disabled behavior and the controller's guess guard remain in place.

All six basis labels and X/Y/Z now use shallow extruded, vectorized native `ViroText`, with a larger font definition scaled down to approximately the existing physical label size. This replaces the small bitmap glyphs that were enlarged on screen. Constant-color materials keep front, back, and side faces readable without lights. [Viro's text reference](https://viro-community.readme.io/docs/virotext) documents vector text with positive extrusion depth.

Pinching the placed sphere and the new `−` / `+` buttons share the controller's `sphereScale`. Buttons sit beside the mode selector at ordinary text sizes; large text and narrow displays use a centered stacked layout. Scale is bounded to 0.5–3 times default, giving a 12.5–75 cm diameter. Buttons step by 0.25 times default and disable at the corresponding bound. Center height scales with the model so the sphere and labels remain above the placement plane. Sphere mesh detail increases to support enlargement.

Pinch updates use the gesture-start scale rather than repeatedly multiplying the last update. Buttons supersede an active pinch; Reset and teardown invalidate gesture state. Stale session callbacks and invalid factors are rejected. Resizing preserves the selected size across Reset/Restart AR, does not change round/animation identity, and does not submit, cancel, or restart polling. Caption text, status/spinner, mode/size controls, guesses, and actions are centered horizontally. No new instructions appear in the game UI.

Final validation timestamp: `2026-10-08T15:57:10.781Z` (11:57 EDT).

| Check | Result |
| --- | --- |
| `npm test`, direct and final MDS CI | Exit 0; lint, formatting, TypeScript, 14 AR tests and 97 Qubit tests passed: 111 total. Seven added tests cover bounds, cumulative pinch math, stale gestures/session teardown, invalid factors, and unchanged measurement/animation/hardware polling. |
| Expo Doctor | Exit 0; 21/21 passed. |
| MDS Doctor CI | Score 99; zero errors, one existing warning category, 15 passed, four existing skips. React Doctor: zero errors, seven unchanged warnings outside Qubit, score 98. |
| iOS export through `npm run build` | Exit 0; 2,204 modules, 28 assets, 5 MB Hermes bundle: `entry-94600cad1acd39e43513cd9a493e9601.hbc`. |
| Viro schema and iOS/Android support checks | Schema: zero errors/warnings. Platform tool reports no unsupported combinations. These are static checks, not native visual/gesture acceptance. |
| Git whitespace and preservation | Staged diff check passed. Dependencies, lockfile, SDK 57, quantum transport, shared AR interface, navigation files, roadmap, and sibling experiences remain unchanged. No native dependency was added. |

No credential values, service administration, live jobs, EAS builds, deployment, push, or merge were performed. Existing dependency advisories are unchanged; dependency installation was not repeated for these source-only changes.

Additional opt-in acceptance:

- [ ] Reload the iPhone app and verify both guesses visibly disable after either guess and throughout submission/waiting/completion/error states; verify native press feedback when enabled.
- [ ] Verify X/Y/Z and all basis labels are sharp at near/far viewing distances and at minimum/default/maximum sphere size, with normal and reduced motion.
- [ ] Pinch inward/outward, then use `−` / `+`; verify both methods share the current size and remain centered beside the selector at ordinary text sizes. Verify bounds, largest Dynamic Type, and VoiceOver.
- [ ] Resize during simulator measurement and while a hardware job is queued/running; verify no extra submission, polling restart, lost guess, or animation restart. Test Reset, Restart AR, surface loss, and background/resume.
- [ ] Repeat native label/gesture/layout acceptance on Android after iPhone. JavaScript export and mock tests do not prove device gesture performance or label quality.

## Follow-up: header info modal

Starting HEAD: `07608a16689db9cb5e37cd7a312d36addf62845b`. Tested implementation HEAD: `5d1f7950faaf0f0e0d5041accd006e26041e1f79` (`feat: explain Guess the Qubit in an info modal`). The subsequent documentation commit delivers these results; retrieve its SHA using the report-path Git command above.

The header now has an outlined circled **i**, using the native SF Symbol `info.circle` on iOS and a scalable SVG with a 48-point touch target on Android. It opens an Expo UI native modal sheet with three sections: **The game**, **The Bloch sphere**, and **The circuit**. A cyan/magenta legend explains the reference guides and state vector. The text explains the poles, equator labels, illustrated preparation/collapse, guess/result comparison, and simulator versus IBM hardware execution. A small gate diagram shows `|0⟩ → Ry(π/2) → Z measurement`. The Quantum API link points to the exact owner-provided public page.

The sheet scrolls, respects native safe-area layout, supports Dynamic Type, and stacks the circuit diagram for narrow screens or larger text. Section headings and the diagram have screen-reader labels. Done, swipe dismissal, Android back, and the VoiceOver escape gesture close it. The placed sphere and selected size are preserved. Opening info during an active or paused hardware round invokes the existing Reset cancellation path: requests/timers are invalidated, known unfinished jobs receive bounded cancellation requests, and late submission acknowledgements are used only for cancellation. The unknown-submission guard remains intact. Opening info never submits a circuit. Simulator rounds and completed results are preserved.

Final validation timestamp: `2026-10-08T16:22:17.316Z` (12:22 EDT).

| Check | Result |
| --- | --- |
| `npm test`, direct and final MDS CI | Exit 0; lint, formatting, TypeScript, 14 AR tests and 97 Qubit tests passed: 111 total. Existing reset, cancellation and late-acknowledgement tests exercise the controller path used by the info action. |
| Expo Doctor | Exit 0; 21/21 passed. |
| Final MDS Doctor CI | Score 99; zero errors, one existing warning category, 15 passed, four existing skips. React Doctor: zero errors, seven unchanged warnings outside Qubit, score 98. |
| iOS JavaScript export | Direct `npm run build` and final MDS CI both exited 0; 2,317 modules, 28 assets. Hermes bundle `entry-390668a8f9b0935b74ae9543abda9dd0.hbc`, 5,139,680 bytes. |
| Git whitespace and preservation | Staged implementation diff passed. SDK 57, dependencies, lockfile, quantum transport, shared AR interface, navigation layout, roadmap, and sibling experiences are unchanged. |

The first MDS CI run wrote the same iOS export but exited with Windows access-violation code `3221225477`, a failure previously documented in the SDK refactor report. A direct export and an identical MDS CI retry passed without code or build-script changes. The intermittent exit crash remains unexplained; it was not counted as a successful first run. The seven existing React Doctor warnings and four intentional skips are unchanged. No dependency installation, native build, protected API calls, live jobs, credentials, EAS submission, push, or merge were performed for this UI revision. Viro scene code is unchanged; its previous static validation remains applicable.

Implementation references: [Expo SDK 57 BottomSheet](https://docs.expo.dev/versions/v57.0.0/sdk/ui/universal/bottomsheet/), [Expo SDK 57 Stack](https://docs.expo.dev/versions/v57.0.0/sdk/router/stack/), [IBM RY gate definition](https://quantum.cloud.ibm.com/docs/en/api/qiskit/qiskit.circuit.library.RYGate), and [Quantum API](https://davidjgrimsley.com/public-facing/api/quantum). Circuit copy also matches the existing typed service payloads in this worktree.

Additional opt-in device acceptance:

- [ ] On iPhone, open info before and after placement. Check the circled icon, dark sheet, section hierarchy, legend, gate diagram, scrolling, Done, and swipe dismissal. Confirm placement and size remain after closing.
- [ ] Check largest Dynamic Type, VoiceOver section navigation/diagram/link, escape dismissal, and landscape layout. Follow the Quantum API link and return to the app; confirm normal camera handoff/background recovery.
- [ ] If opting into hardware, open info during submission, queued/running work, and paused recovery. Verify no resubmission, known-job cancellation, late-acknowledgement cancellation, and the uncertainty guard when no job ID was returned. Verify completed results remain visible after dismissal.
- [ ] Repeat modal and TalkBack/back-button checks on Android after iPhone. Automated checks and JavaScript export do not establish native modal appearance, touch handling, or live cancellation acceptance.

## Follow-up: reactive buttons and native scrolling

Starting HEAD: `f59c3e69bc2891b9e07117bbf6cc0ff7e4892dea`. Tested implementation HEAD: `e34f407cb1946a4550ee8d3536443db8d11b337b` (`fix: qubit control state and native info scrolling`). The subsequent documentation commit delivers this report.

The owner reported that the info sheet stopped scrolling before its final content, the selector wrapped and shifted other controls, and unavailable guesses still appeared enabled. These are corrections to device-reported failures; prior automated checks did not establish their native appearance.

- **Button state:** compiling the old component with the installed React Compiler reproduced a cache keyed only by the stable controller identity around `controller.canGuess()`. The UI could therefore retain its initial enabled appearance despite subscribed round changes. A shared pure `canGuessQubit(snapshot, now)` guard now drives both controller validation and React rendering. The compiled replacement depends on the subscribed snapshot and clock. Both guesses and Reset use the same native button component: gray text, faded outlined appearance and no press callback when unavailable; filled mint appearance with dark text when available. Picking a bit disables both guesses and enables Reset. Completion keeps the guesses disabled until Reset; Reset reverses those states when connectivity/tracking are ready. Retry deadlines refresh the UI clock, including deadlines that have already elapsed.
- **Selector and centering:** the native Host matches content vertically while filling the HUD's actual measured width. The selector/size row uses that full width, reserves a fixed region for `−` / `+`, and gives the remaining width to the selector. The label is now **Hardware** in both selector and info copy. Mode changes keep the same container width and centered controls. Narrow layouts and larger Dynamic Type stack the selector and size controls instead of compressing the label.
- **Info scrolling:** the sheet uses Expo UI's native ScrollView inside a native Column. The fixed header and complete body each bridge through a content-sized RNHostView; the body no longer inherits a viewport-sized flex root or a nested React Native scroll view. Removed vertical shrinking from paragraph text. The native scroll owner measures the full body, including mode descriptions and the Quantum API link. Native sheet safe-area handling, Done, dismissal, section labels, and the existing hardware cancellation path remain.

Final validation timestamp: `2026-10-08T16:50:24.007Z` (12:50 EDT).

| Check | Result |
| --- | --- |
| `npm test`, direct and MDS CI | Exit 0; lint, formatting, TypeScript, 14 AR tests and 101 Qubit tests passed: 115 total. Four regression tests exercise subscribed eligibility through simulator/hardware waiting, results and Reset with a stable controller, changing retry clocks without snapshot publication, and placement/tracking/connection/submission uncertainty. |
| React Compiler inspection | Before: memoization keyed by controller identity. After: keyed by `state` and `now`. Used the installed Babel/compiler packages and TypeScript/JSX parsing; no compiler setting was disabled. |
| Expo Doctor | Exit 0; 21/21 passed. |
| MDS Doctor CI | `doctor_scan_project(projectPath: assigned worktree, mode: "ci", runScripts: true)` passed: score 99, zero errors, one existing warning category, 15 passed, four intentional skips. React Doctor: zero errors, seven unchanged warnings outside Qubit, score 98. Every non-pass result was explained through the MDS tool. |
| iOS export through MDS CI | Exit 0; 2,317 modules, 28 assets. Hermes bundle `entry-349c8f528057797998962bce502e3d27.hbc`, 5,141,914 bytes. The previously documented intermittent Windows exporter exit crash did not recur in this run. |
| Git whitespace and preservation | Staged diff check passed. SDK 57, dependencies/lockfile, shared AR interface, navigation layout, quantum transport, Viro scene, roadmap, and sibling experiences are unchanged. |

No native build, live API jobs, credentials, deployment, push, or merge were performed. Dependency installation was not repeated for source-only changes; existing dependency advisories remain. JavaScript export, compiler inspection and mocked lifecycle tests do not prove native scroll bounds or button colors on a physical device.

Opt-in device acceptance for these corrections:

- [ ] On iPhone, scroll past the complete circuit paragraph and both mode descriptions to the Quantum API link. Release at the bottom and confirm the link remains reachable, with normal and largest Dynamic Type and in landscape.
- [ ] Place the sphere and switch Simulator/Hardware repeatedly. Verify the label stays readable, the selector/size row fills the HUD, and guesses/actions stay centered.
- [ ] Before guessing, verify 0/1 are enabled and Reset is gray. After either guess, verify both numbers become gray and Reset becomes enabled; check waiting, collapse and completion, then Reset. Repeat in Hardware only when opting into a live job. Verify no second guess can submit before Reset.
- [ ] Verify offline/retry recovery, tracking loss, native press feedback and VoiceOver disabled announcements. Repeat scrolling/layout/disabled-state checks with TalkBack on Android after iPhone.

References: [Expo SDK 57 native ScrollView](https://docs.expo.dev/versions/v57.0.0/sdk/ui/universal/scrollview/), [Host](https://docs.expo.dev/versions/v57.0.0/sdk/ui/universal/host/), [BottomSheet](https://docs.expo.dev/versions/v57.0.0/sdk/ui/universal/bottomsheet/), and [React Compiler memoization](https://react.dev/learn/react-compiler/introduction). Layout behavior was also inspected in the pinned package's native and universal implementations.
