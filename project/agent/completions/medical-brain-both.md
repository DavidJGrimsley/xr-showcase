# Medical brain and Both delivery — 2026-10-09

Current delivery: actual supplied brain and half-skull integrated; Skull, Brain, Half Skull, and Both selections enabled; fresh-entry default is Both. Validated implementation HEAD is `559be692209fdc736ad127cb6933db1c6723c4ee`. All 160 tests, Expo Doctor, iOS export, and MDS CI checks passed with no blocking errors. Physical AR acceptance remains pending. See the [current integration report](medical-brain-both-integration.md) for source hashes, alignment decisions, validation commands, and remaining acceptance.

## Historical groundwork record (superseded by the integration above)

Groundwork is complete at the owner's revised scope: use the existing skull file for all three asset slots, then supply the actual brain and half-skull afterward. Final MRI brain/half-skull integration and physical acceptance remain pending. The canonical task checkbox remains unchecked. The historical handoff is unchanged.

## Git evidence

- Worktree: `F:/ReactNativeApps/xr-showcase-i2Workspace/xr-showcase-medical-brain-both`
- Branch: `medical-brain-both`
- Immutable task-base: `37bc04ef2fdfc52c44a1155aa5b40fd322f121c4`
- Entry HEAD: `04423d3630cb24efb848a32a2e7e38711c5d44bf` (two expected handoff/roadmap commits above task-base; clean checkout)
- Validated implementation HEAD: `6c36400a8c5c40ed1feef90f251c7a9ff40c2640`
- This report is a documentation-only follow-up to that implementation commit. Resolve delivery HEAD with `git rev-parse HEAD`.
- Local `origin/main` comparison reference: `37bc04ef2fdfc52c44a1155aa5b40fd322f121c4`; no remote publication, main merge, or canonical coordinator update performed.

## Behavior and model evidence

Both native dropdowns now expose Skull, Brain, and Both. Skull retains the original full skull and four existing labels. Brain uses one skull stand-in. Both uses two independently keyed and loaded skull stand-ins under one plane anchor and parent transform. HUD and info-sheet text identify the stand-ins; Brain and Both have no anatomical labels.

Mode changes retain placement, height, scale, and yaw while clearing active gesture baselines and starting a new load attempt. Callbacks include session, mode, placement, and load-attempt identity, including when switching away and back to the same mode. Both becomes ready only after both required slots succeed. Either failure removes the pair, identifies the failed slot, and permits retry or switching mode. Retry remounts both slots. The 30-second deadline fails only unfinished slots and is cleared on effect cleanup. Reposition, Restart AR, background/resume, plane loss, and Home teardown retain existing semantics. Shared AR contracts were not changed.

All sources are the existing `assets/medical/skull.glb`, requested by the owner as temporary substitutes. No brain MRI provenance, half-skull geometry, final alignment, or new source license is claimed. Existing attribution and CT derivation remain in `assets/medical/skull-provenance.json`: NLM Additional Head Images, user segmentation exported from 3D Slicer, simplified for educational visualization.

- File SHA-256: `990603fd394bf12a8f65b02ee77fd9563122c9be6c08547f1e57c30da5cd8d47`
- Source SHA-256 recorded in existing provenance: `f3b2629424b65d5d251c6dda1f085184236b33834a602ab1366c18919510403b`
- GLB v2, 3,395,900 bytes, 145,991 triangles per instance; no external resources or Draco requirement
- Output coordinates: Y-up metres, anterior +Z, anatomical left +X
- Minimum: `[-0.08411847054958344, 0, -0.10968240350484848]`
- Maximum: `[0.08411843329668045, 0.21058394014835358, 0.1096731498837471]`
- All three slot transforms: position `[0,0,0]`, rotation `[0,0,0]`, scale `[1,1,1]`, reflecting identical files. Both deliberately overlaps its stand-ins. This is not anatomical registration. Both has two rendered instances, so phone performance remains to be checked.

The native source registry and per-asset transform catalog make the final replacement bounded. Null transforms disable modes that require an unaligned slot. Replacement instructions and owner checklist are in [medical-brain-both-assets.md](../../medical-brain-both-assets.md).

## Validation

Commands ran from the assigned worktree. Consulted exact [Expo SDK 57 docs](https://docs.expo.dev/versions/v57.0.0/) and [Expo UI docs](https://docs.expo.dev/versions/v57.0.0/sdk/ui/) before code, Expo overview/UI skills, Viro MCP props, and installed package types.

| Command/check | Result |
| --- | --- |
| `npm ci` | Exit 0; 988 packages installed; lockfile unchanged. Existing dependency audit reported 11 moderate and 20 high advisories; no dependency changes applied. |
| `node --experimental-strip-types --test tests/medical-controller.test.cjs` | Exit 0; 24 controller tests. |
| `npm run test:medical` | Exit 0; 33 tests, including real scene JSX/controller wiring with native component mocks. |
| `npm test` | First run stopped in Prettier on 66 unchanged CRLF checkout files. Rerun with temporary LF normalization: exit 0; lint/typecheck and all 155 tests passed (14 AR, 108 Qubit, 33 medical). Unrelated files were restored afterward and have no Git diff. |
| `npx expo-doctor` | Exit 0; 21/21 checks passed. |
| `npm run build:ios` | Exit 0; iOS JavaScript export, 2,400 modules, 29 assets; skull packaged once. This is not an iPhone native build. |
| MDS MCP `doctor_scan_project({projectPath: "F:/ReactNativeApps/xr-showcase-i2Workspace/xr-showcase-medical-brain-both", mode: "ci", runScripts: true})` | Completed; score 99, 0 errors, 1 warning group. Lint/typecheck/tests/Expo Doctor/export passed. React Doctor score 98 with 7 warnings in 6 unchanged files outside Medical Viewer. |
| Viro MCP `reactviro_validate_scene` on final scene source | 0 errors, 0 warnings. |
| `git diff --check` and `git diff --cached --check` | Passed. |
| `git diff --stat 37bc04ef2fdfc52c44a1155aa5b40fd322f121c4...HEAD` | Reviewed at implementation HEAD: 12 files, 699 additions / 66 deletions; includes pre-existing handoff and TODO bootstrap commits. |
| `git diff --stat origin/main HEAD` | Same comparison at implementation HEAD; local reference still equals task-base. |
| `git diff --exit-code 04423d3630cb24efb848a32a2e7e38711c5d44bf HEAD -- package.json package-lock.json assets/medical/skull.glb assets/medical/skull-provenance.json assets/medical/skull-labels.json project/todo.md` | Exit 0; all preserved. |
| `git status --short` after implementation commit | Clean. |

Node's existing typeless-module warnings were nonblocking. On this Windows checkout, `core.autocrlf=true` recreates CRLF in untouched files while Prettier expects LF. Reproducing the full lint/Doctor run requires equivalent LF checkout normalization; only line endings were changed for that validation, and no repository/configuration policy was changed.

## Changed files

- `src/features/medical-viewer/medical-models.ts`
- `src/features/medical-viewer/medical-asset-sources.native.ts` (new)
- `src/features/medical-viewer/medical-controller.ts`
- `src/features/medical-viewer/medical-scene.native.tsx`
- `src/features/medical-viewer/medical-model-picker.native.tsx`
- `src/features/medical-viewer/medical-viewer-screen.native.tsx`
- `src/features/medical-viewer/medical-info.native.tsx`
- `tests/medical-controller.test.cjs`
- `tests/medical-assets.test.cjs`
- `project/medical-brain-both-assets.md` (new)
- `project/agent/completions/medical-brain-both.md` (this report)

## Remaining acceptance

Owner supplies real brain and half-skull files with source/license and anatomical correspondence after groundwork. Inspect and document geometry, units, origin/orientation, bounds, per-model registration, and final attribution before claiming asset integration. Final label names/anchors need owner confirmation. Check native iPhone and Android menus, pair performance, rapid selection, loading/retry, common transforms, Reposition/Restart, background/resume, lost planes, Home teardown, safe areas, Dynamic Type, VoiceOver, and actual anatomical alignment. Mock/export results do not establish physical AR acceptance or clinically calibrated accuracy.
