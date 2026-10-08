# Phase 3 delivery — Medical AR Viewer

Date: 2026-10-08 (America/New_York).

The [floating placement and Transform controls update](phase-3-device-feedback.md)
supersedes the controls and device checklist described in this original delivery
record. Physical acceptance of the updated viewer remains pending.

**Available implementation delivered; physical acceptance remains pending.** This
report does not mark the roadmap or the entire phase complete. The immutable
bootstrap handoff and both TODO copies were left unchanged.

## Git provenance

- Worktree: `F:/ReactNativeApps/xr-showcase-i2Workspace/xr-showcase-phase-3-medical`
- Assigned branch: `phase-3-medical`
- Immutable task base / local `origin/main`: `b09e4477f0da378b64c8ba9ed96e08b5febe6d45`
- Starting HEAD: `a6e3bda186e3888e7fb39a54e94ac946aa8516ba` (bootstrap handoff only)
- Implementation HEAD: `5ff142ae7d47dad65ac5020eba28cdec1baa6626`
- Commit: `feat: add CT skull medical AR viewer and simple controls`

This original delivery record and its review images were committed separately
from the implementation. No push, PR, merge, cloud build, deployment, or sibling
experience change was performed during that initial delivery. The post-merge
update below supersedes its Git/integration status; the original validation
results remain historical evidence.

### Post-merge rebase — 2026-10-08

At the owner's request, the initial Phase 3 tip
`ef04f443bec3eef3e91ee17de135862a7a8dded7` was pushed to
`origin/phase-3-medical`, then main was fetched through the source checkout.
Main now includes the Phase 4 qubit merge at
`4449f1c0069e679f86203ade4e769a13895cdbf4`. The three Phase 3 commits were
rebased onto that exact main commit:

- Bootstrap handoff: `c6bda24`.
- Rebased implementation: `52785949be05893aba2fa1c583ff0a81a4450788`.
- Rebased original report: `65844b750ec2b206334fd689f540759e27274da1`.

The only conflict was in `package.json`. Resolution retains main's pinned Quantum
SDK dependency, lockfile, qubit test script, and two-worker iOS export command,
and appends medical tests to `npm test`. Main's AR overlay contract exactly
matches the medical implementation, so there is now no shared AR file diff
against main. No qubit feature, EAS configuration, or roadmap change was added by
the rebase.

Post-rebase validation:

- `npm ci --no-fund --no-audit`: passed against the merged lockfile.
- `npm test`: passed lint/Prettier, TypeScript, 14 AR tests, 102 qubit tests, and
  20 medical tests (**136 total**).
- `npx expo-doctor`: 21/21 passed.
- `npm run build:ios`: passed with main's two-worker setting and packaged skull.
- `npx expo export --platform android --max-workers 2`: passed with packaged skull.
- `git diff --check`: passed; diff against updated main reviewed.

The rebased remote branch is updated using an explicit force-with-lease against
the previously pushed Phase 3 tip, protecting any unexpected intervening push.
The validation/report update follows the rebased original report in a separate
commit. Physical medical acceptance remains pending as listed below.

## Delivered behavior

The bottom controls view uses the qubit screen's dark shell, system typography,
and native Expo UI buttons. The first row contains selected **Skull**, disabled
**Brain**, **−**, and **+**. The second contains **Labels**, **Reposition**, and
**Restart AR**. There is no Both choice, controls heading, model caption,
percentage, or subtitle. Buttons have at least 48-point targets; groups wrap or
stack for narrow widths and larger text. Labels visibly indicate their selected
state and start off. Accessibility names, states, and activation callbacks are
provided; device accessibility acceptance is still pending.

The native scene selects a horizontal Viro plane at the tapped point, then loads
the packaged skull. One short status line appears for placement, loading,
limited tracking, or failure and disappears after successful placement/loading.
Manipulation requires normal tracking and a placed, loaded model. Pinch and
two-finger rotation use gesture-start baselines, including the final callback;
scale stays within 0.5–3 and rotation changes normalized yaw only. Size buttons
multiply/divide by 1.1. The mesh's base stays at the surface during scaling.

Reposition clears selection and reuses the detected planes while retaining size,
yaw, and label preference. Restart AR invalidates the current session and restores
default size/yaw while retaining the label preference. Background/resume preserves
the screen's preferences and requires fresh surface placement when tracking
restarts. Leaving and returning creates a fresh local controller with Skull,
default pose, and labels off.

Load failures (including a 30-second timeout) offer **Retry**. Retry remounts the
asset without restarting AR or changing the selected plane. Load and gesture
callbacks carry session, placement-revision, and load-attempt identifiers; stale
callbacks are ignored after retry, reposition, restart, or teardown. Selected
plane removal returns to surface selection. Scene failures continue through the
shared AR boundary's error handling.

The header info button opens an Expo UI sheet containing gestures, source credit,
the NLM link, the unavailable Brain explanation, and the educational-use notice.
Four mesh-calibrated labels follow the model's transforms; billboard text and
marker sizes remain constant in world space as the anatomy resizes.

## Asset preparation and evidence

Original OBJ and all scans remain outside the repository under
`F:/ReactNativeApps/xr-showcase-i2Workspace/temp/medical-scans/VisibleHumanHead/`.
The original OBJ SHA-256 was independently rechecked after preparation and is
unchanged:

`f3b2629424b65d5d251c6dda1f085184236b33834a602ab1366c18919510403b`

| Property                   | Result                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------- |
| Original OBJ               | 3,273,786 vertices; 6,053,660 triangles; 681,475,320 bytes                         |
| Source component filtering | 129,986 connected components; 3,587 pass the 0.1 mm extent threshold               |
| Degenerate cleanup         | 3,225 source faces and 74 post-decimation faces removed                            |
| Packaged skull             | 145,991 triangles; 68,455 exported vertices                                        |
| Uncompressed GLB           | 3,395,900 bytes (3.24 MiB), below 10 MiB                                           |
| Physical dimensions        | 168.237 mm wide × 210.584 mm high × 219.356 mm deep                                |
| Origin                     | Horizontally centred; lowest exported point at height zero                         |
| Material                   | Opaque ivory, alpha 1, metallic 0, roughness 0.75                                  |
| Resources                  | One self-contained GLB; no textures, Draco compression, DICOM, or patient metadata |
| GLB SHA-256                | `990603fd394bf12a8f65b02ee77fd9563122c9be6c08547f1e57c30da5cd8d47`                 |

The reproducible Blender 5.0.1 script uses a streaming Node cleaner. It removes
only sub-0.1 mm connected fragments and degenerate faces before simplification;
it does not apply a largest-component-only filter. Larger structures, including
the jaw and teeth, were retained in the reviewed result. Decimation targets
149,000 triangles before final validation and degenerate cleanup.

LPS millimetres enter Blender directly without the OBJ importer's automatic
180-degree rotation. Blender's glTF Y-up export then produces exactly
`(x, y, z) → (x, z, −y)` with millimetres converted to metres. The horizontal
origin and post-decimation floor correction are included in the recorded matrix.
Preparation settings, Blender version, source hash, source links, and credit are
in `assets/medical/skull-provenance.json`.

The source is [NLM Additional Head Images](https://data.lhncbc.nlm.nih.gov/public/Visible-Human/Additional-Head-Images/README),
specifically its [CT series](https://data.lhncbc.nlm.nih.gov/public/Visible-Human/Additional-Head-Images/MR_CT_DICOM/CAT/).
Credit is recorded to NLM and Peter Ratiu and colleagues at Brigham and Women's
Hospital / Harvard Medical School. [NLM's project page](https://www.nlm.nih.gov/research/visible/visible_human.html)
describes its public-domain image library and links this collection. This is the
additional head collection, not the original Visible Human Male body scan.

The [original render](medical-assets/source-skull.png) and
[prepared GLB render](medical-assets/prepared-skull.png) were compared for skull
silhouette, eye sockets, nasal opening, teeth, and jaw. Simplification smooths fine
surface detail; this is an educational display asset, not a clinical reconstruction.
The [anchor review](medical-assets/label-anchors.png) uses red for Frontal bone,
blue for Parietal bone, green for Zygomatic bone, and yellow for Mandible. Anchors
are surface ray intersections on the final mesh, with exported triangle-distance
checks. Owner confirmation of anatomy and phone readability remain pending.

Exact rebuilding instructions are in `project/references/medical-assets.md`.
Brain segmentation and CT/MRI registration remain future work; no brain asset is
present or selectable.

## Changed files and shared scope

- `src/features/medical-viewer/`: native screen, navigator, scene, compact native
  controls, info sheet, local controller, and typed model registry.
- `assets/medical/`: skull GLB, label data, and provenance record.
- `scripts/medical-mesh-clean.cjs`, `scripts/prepare-medical-skull.py`: preparation.
- `tests/medical-controller.test.cjs`, `tests/medical-assets.test.cjs`: behavior and
  geometry/provenance validation.
- `project/references/medical-assets.md`: source, rebuilding, transform, and review.
- `package.json`: `test:medical` added to `npm test`; dependency pins unchanged.
- `tsconfig.json`: `allowImportingTsExtensions` permits the controller tests to run
  the actual typed registry with Node's type stripping.
- `src/features/ar/ar-session-types.ts` and
  `src/features/ar/ar-session-boundary.native.tsx`: the same optional
  `renderActiveOverlay` / `ARActiveOverlayContext` extension already used in qubit.
  Only the active overlay rendering changes; shared permission, camera ownership,
  backgrounding, and teardown logic are retained. Existing fallback panels remain.

No dependency or lockfile changes. Existing app config and EAS development
profiles are retained. Home, Arena, Qubit, theme, release settings, and roadmap
state are unchanged. Windows checkout line endings were normalized locally for
the existing formatter; unchanged file blobs were excluded from the commits.

## Validation

Checks were run from the assigned worktree. The final substantive tree is the
implementation commit above; subsequent changes are report/review images only.

| Command / check                                             | Result                                                                               |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `npm ci --no-fund --no-audit`                               | Passed; existing lockfile used                                                       |
| `npm test`                                                  | Passed: lint/Prettier, TypeScript, 14 existing AR tests, 20 medical tests (34 total) |
| `npm run test:medical`                                      | Passed: 15 controller tests and 5 asset/preparation tests                            |
| `npx expo-doctor`                                           | 21/21 passed; also passed in final MDS CI                                            |
| `npm run build:ios` / final MDS `npm run build`             | Passed; final iOS Hermes bundle includes the GLB                                     |
| `npx expo export --platform android --max-workers 2`        | Passed; final Android Hermes bundle includes the GLB                                 |
| Viro scene schema validation                                | 0 errors, 0 warnings                                                                 |
| Viro iOS/Android platform support check                     | No unsupported features reported                                                     |
| MDS `doctor_scan_project`, `mode: "ci"`, `runScripts: true` | 99/100; 0 errors, 15 passed, 4 skipped, 1 nonblocking check                          |
| `git diff --check` and `git diff --cached --check`          | Passed                                                                               |

Final MDS scan timestamp: `2026-10-08T17:57:58.830Z`. The nonblocking check is React
Doctor: 0 errors and 7 warnings in retained shared AR/Home ScrollViews, shared AR
function complexity, Settings/theme exports, and local data's sequential awaits.
No medical feature warnings were reported. These findings were inspected and
explained through MDS; a broad shared refactor is outside this implementation.
API routes, animation-heavy files, web SEO, and the full development/cloud build
profile were appropriately skipped by CI mode.

Normal Android exports passed earlier, but repeated later attempts exited with
Windows access-violation code `-1073741819` after bundling. An isolated JavaScript
export passed, and the final normal Hermes export passed with two Metro workers.
No dependency pins or build configuration were changed for this workaround.
The exact reproducible local validation command above is recorded; these exports
do not establish native device behavior.

The controller tests cover unavailable Brain selection, manipulation prerequisites,
bounded reciprocal button steps, consecutive cumulative gestures, invalid gesture
ends, yaw wrapping, placement loss/reselection, reposition, retry, tracking loss,
background/resume, explicit restart, fresh-screen defaults, stale callbacks, and
subscriptions. Asset tests inspect actual GLB positions, indices, normals,
zero-area triangles, dimensions, orientation matrix, grounding, opacity, budgets,
hashes, self-contained resources, and four anchor-to-surface distances. A cleaner
fixture verifies retention of separate larger components alongside fragment and
degenerate removal.

Both required diff comparisons were checked against the recorded local base:
`git diff --stat b09e4477f0da378b64c8ba9ed96e08b5febe6d45...HEAD` and
`git diff --stat origin/main HEAD`. A current remote merge/reachability check is
pending coordinator integration.

## Remaining owner acceptance

No physical iPhone or Android AR acceptance was performed in this session.
Exports, schema checks, and controller tests are not device proof.

On the existing iPhone development client, verify:

1. Cold loading, camera permission paths, horizontal surface placement, and the
   disappearance of guidance after placement/loading.
2. Pinch responsiveness, consecutive gestures, 0.5–3 limits, −/+ steps, two-finger
   yaw rotation, and the grounded base throughout resizing.
3. Four label locations and readability at minimum/default/maximum scale and
   different viewing angles; confirm anatomy before accepting their calibration.
4. Controls and the info sheet at large accessibility text sizes, narrow widths,
   and with VoiceOver. Confirm selected/disabled states and 48-point targets.
5. Reposition preserving preferences, selected-plane loss/reselection, and Restart
   AR restoring default pose. Force one asset failure in a test build to verify
   Retry reloads without restarting tracking.
6. Background/resume and rapid back/Home navigation between experiences, with
   one camera owner, no stale callbacks, and no native crash.

After iOS acceptance, perform native Android acceptance including TalkBack,
tracking, gestures, loading, and lifecycle behavior. Keep the roadmap pending
until these owner checks and coordinator integration are complete. Cloud builds,
distribution, brain segmentation, and combined-model registration remain outside
this delivery.
