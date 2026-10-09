# Scoped completion: local AR Arena Fighter

Updated October 9, 2026. The accepted local-game plan is implemented in `xr-showcase-phase-2-arena`, branch `phase-2-arena`. Code and automated checks are complete; physical iPhone acceptance is pending. This report does **not** mark the historical Phase 2 roadmap complete.

Implementation base: `1c149e769251c8a6044217339dc09dd95aaa81d9`. The historical bootstrap packet's `b09e447...` base is not the implementation base. This report records implementation verification before publication; the pull request and EAS build record track subsequent publication and native build status.

## Result

Arena Fighter uses one lazily imported native `ViroARSceneNavigator` through the shared AR boundary, with `provider="none"`. The arena and two full Mike packs are static app assets. Bundled builds contain their GLBs; Metro serves those local files during development. No Studio scene fetch or credential is involved. Asset provenance, exact hashes, repairs and measurements are in `assets/arena/README.md`.

The scene places all three models under one horizontal-plane transform. It preserves the arena's baked axis conversion, normalizes its longest dimension to 60 cm, compensates its base offset, and places 12 cm fighters on the measured central floor. Positive model scales and ±90° facing rotations keep them oriented toward one another. Before Ready, Swap sides and Rotate 90° set the view; phone movement does not affect the fighting line.

An authoritative TypeScript controller owns the round at 60 fixed ticks/second. One Viro game loop sends position/rotation updates only when those transforms change. Native animations use stable initial props and explicit clip commands. Viro 3.0.3's paused-executable behavior is handled by resuming without interruption before applying a changed clip; native callbacks never apply damage.

The blue player and red CPU share 100 health, damage, reach, bounds, stagger and cooldown rules. Punch and Uppercut use the manifest's short clips and exact hit times. Punches follow L,L,R,L,R,R; uppercuts alternate independently and cost a three-second cooldown from attack start. Only the first buffered next attack is retained. Due hits resolve together, including double-knockout draws. CPU recovery cannot be bypassed by briefly leaving reach.

Lethal punches defeat on the floor. Lethal uppercuts launch through the specified 0.8-second, 18 cm arc before defeat. Winners play the 2.3-second Victory once, then idle. Rematch waits for presentation, resets combat and retains placement. Movement uses independent native touch targets so both hold controls and another finger's attack can coexist; movement stops during attacks/stagger and resumes while a touch remains held.

Ready/Resume require all assets, placement, landscape and 0.5 seconds of stable normal tracking. Loading has a 30-second timeout with the shared recoverable Retry path. Tracking loss freezes simulation/playback and cancels pending attack/input. Backgrounding or replacing AR preserves round state but requires new placement and explicit Resume. Completed outcomes restore settled poses. Session, placement and round identities reject stale callbacks/input. Home ends camera ownership and removes the round screen.

The landscape HUD includes top health/outcome feedback, bottom movement/attack controls, safe-area handling, large-text layouts and Home. The development-only clip tester selects all 23 embedded names on either fighter; a frame-cadence display assists device profiling. Neither is native acceptance evidence.

## Changed areas and shared integration

- `src/features/arena-fighter/`: native screen, navigator, scene, controller, HUD and native touch-batch helper. The non-native fallback remains available.
- `assets/arena/`: unchanged GLBs and original manifest, plus provenance notes.
- `tests/arena-fighter.test.cjs`, `tests/arena-assets.test.cjs`: 35 arena/input/asset checks. `npm test` includes `test:arena` alongside the 14 shared AR tests.
- `src/features/ar/ar-session-types.ts`, `ar-session-boundary.native.tsx`: optional `enabled` activation gate and `renderActiveOverlay` hook. Existing permission, unsupported/error handling and default overlay behavior remain shared.
- `src/navigation/root-layout.tsx`: default portrait routes; Arena Fighter requests landscape with its own HUD and hidden navigation header.
- `app.json`: native orientation `default` and iOS `requireFullScreen: true`. Introspection confirmed portrait, both landscape orientations and `UIRequiresFullScreen`.
- `.gitattributes` / `.prettierignore`: preserve curated asset/manifest bytes on Windows and other checkouts. `prettier.config.js` accepts the checkout's existing line endings, avoiding formatting changes across 40 otherwise unchanged files.

The user-approved plan supersedes the packet's Studio integration and SQLite work. SQLite, multiplayer, blocking, dash, sideways movement and Studio authoring are outside this implementation. Historical handoffs and roadmap state were not edited.

## Verification

| Check | Result |
| --- | --- |
| `npm ci` | Passed with existing dependency audit notices; no dependency upgrades or lockfile changes. |
| `npm test` | Passed: ESLint, Prettier, strict TypeScript, 14 AR lifecycle tests and 35 arena/input/asset tests. |
| `npm run test:arena` | Passed: movement, hands, buffering, damage, reach/misses, cooldown, stagger, simultaneous hits, knockout flight, rematch, recovery, touch ownership and asset integrity. |
| `npx expo-doctor` | 21/21 checks passed. |
| `npm run build:ios` | Passed; iOS Hermes export includes all three GLBs, approximately 41.34 MB of model data. This is a JavaScript/asset export, not an installed native build. |
| Viro MCP scene validation | Zero errors, zero warnings. Component schemas and installed Viro types were also consulted. |
| `npx expo config --type introspect --json` | Confirmed native portrait/landscape support and full-screen iOS requirement. |
| MDS Doctor MCP, CI with scripts | Final run on October 9 at 12:30 UTC: score 99, zero errors, 15 passed checks, one warning group and four intentional skips. React Doctor reports seven warnings in shared app code; none in the arena feature. Tests, Expo Doctor and export passed. |
| `git diff --check` | Passed. New text files were also checked for trailing whitespace and conflict markers. |

MDS's React Doctor findings were reviewed rather than treated as device failures. The new HUD complexity finding was addressed. Remaining findings concern shared AR boundary complexity; safe-area padding in shared AR/Home scroll views; non-component exports in Settings/theme; and sequential SQLite initialization. No broad refactor of those unrelated flows was made. MDS's skipped animation-performance scan does not assess Viro's native renderer.

## Remaining physical acceptance

A new physical-device development client is required for native orientation changes. Physical installation and acceptance remain pending. Follow `arena-device-validation.md` for the exact build profile and checks: full-pack rendering/LEDs, clips and interruption transitions, placement/floor alignment, both sides, landscape navigation, simultaneous touches, finishing launches, rematch, background/replacement recovery and camera-independent gameplay.

Sustained performance with both full packs and the 200,000-triangle arena is unmeasured. The target is at least 30 FPS. Record device results and any required optimization in the separate device report before claiming native acceptance.
