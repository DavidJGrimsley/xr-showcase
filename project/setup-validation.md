# XR Showcase Setup Validation

Date: 2026-10-07 (America/New_York)

## Status
The MDS Super Stack scaffold is generated, repaired and onboarded. The iOS-first project uses src/app for thin routes, with the root navigation implementation outside the route tree. All four canonical MDS project documents are present, the component policy is confirmed, and the approved Phase 0-5 roadmap and defect queue are recorded.

Arena Fighter, Medical Viewer, Guess the Qubit, their controller/API tests and physical AR acceptance are implementation tasks. No camera scene, live Quantum API call, hardware job, cloud build, remote repository or submission was created during scaffold setup.

## Installed baseline
- Expo 57.0.27; React Native 0.86.3; Viro 3.0.3
- Uniwind 1.12.2; Expo UI 57.0.22
- Expo Dev Client 57.0.19; SecureStore 57.0.4
- Expo Router pinned to 57.0.25; Screens deduplicated to 4.26.2
- TypeScript/npm, Expo Router, Zustand and iOS-first EAS development profiles
- Bundle/package identifier default: com.djleg.xrshowcase; verify ownership before the first EAS build

## Passed checks
- MDS Doctor MCP: doctor_scan_project(projectPath: F:\ReactNativeApps\xr-showcase, mode: ci, runScripts: true)
- MDS result: 0 blocking errors, 1 warning, 17 passed checks, 2 intentional skips; score 94/100
- Lint/format checks and TypeScript
- npm test (the generated script runs lint plus typecheck; it is not a game-controller test suite)
- Expo Doctor: 21/21 checks
- Expo dependency compatibility check and native Screens deduplication
- iOS JavaScript/Hermes export through npm run build (npm run build:ios)
- Local native configuration introspection: iOS/Android platforms, iOS identifier and Viro camera usage string verified
- Documentation, secret/config hygiene, routes, API-route safety, styling and motion-budget static checks

The Doctor production-build check is the iOS JavaScript export. It does not compile an iOS binary or prove Viro camera/device behavior. Web SEO and the broader development/native build profile were intentionally skipped.

## Remaining findings
React Doctor reports five compiler TODO diagnostics in the retained Stylist reference (unsupported try/finally/throw lowering) and seventeen other reference-code warnings across seven files. MDS classifies that scan as a nonblocking warning. The temporary Stylist compiler opt-out is documented; refactor/eject the tool before the demo. These findings are not claimed as resolved.

npm audit still reports 31 dependency advisories: 11 moderate and 20 high, no critical. Compatible npm audit fixes did not resolve them. Track supported upstream fixes; do not force the suggested unsupported SDK downgrades/major changes merely to suppress the report.

## Repairs
Worked around Windows parsing of mathematical pipe notation in generator arguments and restored full canonical documents. Upgraded the Expo 56 template to the Viro-compatible SDK 57 baseline, updated the starter color picker, fixed the Settings adapter import and script/bin collision, deduplicated native Screens, corrected Reanimated shared-value accessors, removed an impure updater, and added timer/animation cleanup. Generated type and lock files are excluded from source-format checks.

## Next handoff
Open a fresh agent session in F:\ReactNativeApps\xr-showcase and run mds continue. Start with the remaining Phase 0 EAS/iPhone, private credential and licensed-asset readiness tasks, then implement the three required experiences. The live Unreal reference is in project/references/guess-the-qubit-unreal.md.

## Ejection validation — October 7, 2026

Ejected Stylist, its sync API/helper and color-picker dependency, all exposition pages and demo components. Removed Home reference links and stale navigation registrations. Preserved the current theme, Settings, shared Settings adapter types and local data adapter. Updated ejection decisions and completed cleanup tasks.

MDS Doctor CI: 99/100, zero blocking errors, one nonblocking React Doctor check (three warnings in Settings, local data and the theme provider). Lint, TypeScript, tests, Expo Doctor and iOS JavaScript export pass. The earlier Stylist compiler TODO diagnostics and opt-out are gone. Existing npm audit advisories and physical device acceptance remain pending.
