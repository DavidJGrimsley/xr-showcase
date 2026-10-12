# Medical Scan Slices — local implementation and validation

Date: 2026-10-10 (America/New_York).

## Branch and integration evidence

- Worktree: `F:/ReactNativeApps/xr-showcase-i2Workspace/xr-showcase-medical-scan-slices`.
- Branch: `medical-scan-slices`.
- Handoff's original base: `37bc04ef2fdfc52c44a1155aa5b40fd322f121c4`.
- Actual implementation base after the owner-requested rebase: `d059aea43f6a4f2c077b2339e52054e92ed1d6c3` (`origin/main`, merged brain/half-skull work).
- Branch HEAD at slice validation: `c560782da50b94c2f395a74953b4de7b8c3354a3`. At that point, the feature was validated as working-tree changes rather than part of this planning commit. It is subsequently recorded alongside 3D Scan on the `medical-scan-slices` branch.
- `git ls-remote origin refs/heads/main` confirmed the same `d059aea43f6a4f2c077b2339e52054e92ed1d6c3` final-base SHA during delivery.
- The immutable handoff and canonical roadmap were preserved. Physical acceptance and final integration remain separate from local implementation completion.

The earlier handoff predates brain/half-skull integration. Its outstanding overlap is resolved by the rebase: full Skull, Brain, Half Skull, and Both are available; Both remains the initial selection. These meshes, their provenance, calibration, and shared coordinate conversion remain unchanged. The slice panel is a separate representation and is not registered to their AR pose. Arena, Qubit, navigation, package versions, lockfile, and native build configuration have no content changes.

## Delivered behavior

Medical Viewer opens in 3D Anatomy / Both. Scan Slices starts at middle MRI (slice 41 of 80) and reuses the same AR navigator and selected surface. The upright panel starts 55 cm wide and two feet above the surface, preserving the image aspect ratio. Its scale/yaw/height are independent of anatomy. Switching representations retains both poses and invalidates earlier load callbacks.

MRI/CT selection maps to the nearest physical axial position. The integer slider updates while dragging, coalescing native events to the latest selection per animation frame. Previous/Next are bounded; Reset Slice returns to the middle; Reset Panel restores its original pose. Transform provides bounded scale/yaw/height and Reposition. Home uses the shared AR boundary teardown. Existing anatomy Restart AR also retains the selected representation and valid slice selection when the controller attaches a fresh session.

Only one ViroImage is mounted. Its key identifies session, placement, and texture request; the scene, navigator, and plane anchor stay stable during scrolling. Installed Viro 3.0.3 load events expose `success` without source identity, so keying only the image isolates late native callbacks. Failure or a 30-second deadline offers Retry; old attempts cannot complete a newer selection. No bulk texture preload, additional camera session, volume rendering, or mesh clipping was introduced.

The metadata interface is organized by modality and orientation. The exporter and product UI currently support axial slices; sagittal/coronal rendering is future work.

## Real dataset, geometry and provenance

Export ran inside a dedicated **3D Slicer 5.12.4** process against `C:/Users/DJLeg/Documents/2026-10-08-Scene.mrb`. The original bundle is 1,323,777,421 bytes, SHA-256 `998783662535ddd9619709cfce38b262da9bd3ca4ff588ad80f37b228d96d598`. It remains outside Git.

| Series | Source node | PNG count | Dimensions | Window / level | PNG bytes |
| --- | --- | ---: | --- | --- | ---: |
| MRI | MRI_Elastix | 80 | 512 × 512 | 5589 / 2671.5 | 6,322,481 |
| CT | CT Head | 80 | 512 × 512 | 150 / 40 | 4,795,913 |

Combined PNG payload: **11,118,394 bytes (10.60 MiB)**. Both original scalar volumes are 512 × 512 × 463, with voxel spacing approximately 0.489062 × 0.489062 × 0.503247 mm. The common grid uses 0.4900190648 mm square output pixels and 80 positions from RAS S −230.7516174 to +2.2516234 mm, separated by approximately 2.9494081 mm.

Each axial plane is sampled world RAS → current parent frame → volume IJK using VTK linear interpolation. CT's `vtkOrientedGridTransform` acquisition correction is honored once. Registered `MRI_Elastix` has no parent registration transform in this saved scene; `MRI_Elastix_Transform` is not reapplied. Bounds sample every voxel on all six transformed volume faces, including voxel-boundary margins. This covers the observed acquisition correction; arbitrary folding/deforming transforms require their own spatial validation.

PNG orientation is radiological: patient right at image left, anterior at top; columns advance in RAS −R, file rows in −A, and navigation advances inferior to superior. PNG row orientation was verified with an independently decoded asymmetric test image. Frozen window/level settings preserve brightness during scrolling. First/last planes can have little anatomy because the complete volume bounds are retained.

The final export returned process exit code 0 and `.expo/medical-slices/export-result.json` recorded `passed: true`, 160 images, and `sourceVolumesUnchanged: true`. Source voxel hashes, IJK-to-RAS matrices, display window/level, and parent-transform chain fingerprints matched before and after export. Original segmentations were not modified. Actual MRI/CT midpoint PNGs were visually inspected and show head cross-sections without UI controls, annotations, or screenshots.

Attribution: Courtesy of the U.S. National Library of Medicine; Additional Head Images from Brigham and Women's Hospital / Harvard Medical School, Peter Ratiu and colleagues. Collection/source attribution, input voxel hashes, scene identity, transform handling, image hashes, and byte totals are recorded in the packaged metadata. See the existing dataset provenance and [NLM collection README](https://data.lhncbc.nlm.nih.gov/public/Visible-Human/Additional-Head-Images/README). This remains an educational viewer.

## Commands and validation results

Working directory for shell checks was the assigned worktree. Exact full Windows export and spatial-test commands, including `Start-Process -WindowStyle Hidden -Wait`, are in [tools/medical/README.md](../../../tools/medical/README.md).

| Command/check | Result |
| --- | --- |
| `npm ci` | Passed; 988 packages installed. Existing audit queue remains 31 advisories (11 moderate, 20 high); no dependency changes were made. |
| Headless `headless_export(saved_scene, output, result_file=...)` | Passed in the actual Slicer environment; exit 0, real 160-image export, unchanged source fingerprints. |
| Headless `test_slicer_export.py` → `run_tests(result_file)` | 6/6 passed: asymmetric PNG orientation, oblique IJK axes, parent registration once, varying nonlinear grid inversion, common grid, fixed window/level. |
| `& 'C:/Users/DJLeg/AppData/Local/slicer.org/3D Slicer 5.12.4/bin/PythonSlicer.exe' tools/medical/test_manifest.py` | 4/4 passed: static mapping, missing image preserving old manifest, malformed metadata, corrupt PNG; generated TS uses LF on Windows. |
| `& 'C:/Users/DJLeg/AppData/Local/slicer.org/3D Slicer 5.12.4/bin/PythonSlicer.exe' tools/medical/generate_slice_manifest.py assets/medical/slices` | Passed; validated all 160 grayscale PNGs, dimensions, hashes, counts, positions, and byte totals. |
| `npm test` | Passed: ESLint, Prettier, typecheck, shared AR tests, Qubit tests, and medical tests. |
| `npm run test:medical` | 51/51 passed, including existing anatomy tests and actual scene JSX/controller wiring for one image, deadline/retry, and stale callbacks. |
| `npx expo-doctor` | 21/21 checks passed. |
| `npm run build:ios` | Passed; iOS JavaScript/Hermes bundle includes all 160 slice assets and existing models. |
| `doctor_scan_project(projectPath: assigned worktree, mode: "ci", runScripts: true)` | Final result: score 99; 0 errors, 1 warning group, 15 passed, 4 expected skips. React Doctor reports 0 errors and 7 warnings in existing unrelated files. |
| Viro MCP `reactviro_validate_scene` against the complete medical scene | 0 errors, 0 warnings. This is structural validation, not physical AR. |
| `git -c core.autocrlf=false diff --check` | Passed. |
| `git diff --stat 37bc04ef2fdfc52c44a1155aa5b40fd322f121c4...HEAD` | Reviewed; includes the merged brain/half-skull work absent from the handoff's old base. |
| `git diff --stat origin/main HEAD` | Reviewed; two existing planning-document changes at current branch HEAD. Working-tree implementation and new files are additional. |
| `git diff --stat`, `git status --short`, and `git ls-remote origin refs/heads/main` | Reviewed; only feature source/tests, the test command, new slices/export tools, and this completion report are content changes. |

Initial full lint failed because Windows Git checkout used CRLF while Prettier expects LF. Read-only `prettier --check --end-of-line auto` confirmed no other style differences. Working-file line endings were normalized and unchanged index entries refreshed; no unrelated code/config content was added to the diff. A subsequent Doctor run caught the manifest generator reintroducing CRLF; it now explicitly writes LF, regeneration passes Prettier, and the final Doctor rerun passes lint/tests/build.

## Remaining owner acceptance

The real Slicer export, geometry tests, manifest generation, typed integration, local regression checks, and iOS JS packaging are complete. **Physical iPhone/Android AR and texture performance have not been exercised.** There is no claim that mocked scene nodes, MCP schema validation, or PNG inspection proves native rendering.

Use the existing development client and `npm start`. On iPhone first, then Android, check:

- Medical starts in Both; Scan Slices starts at MRI 41/80 using the same chosen surface.
- MRI → CT → MRI, fast drags, first/last, Previous/Next, reset, and accurate position/count text.
- Readable upright aspect-preserving panel, pinch/rotate, Transform/Reposition, independent anatomy pose, Reset Panel, and Restart AR.
- Texture failure/Retry, background/resume, tracking and selected-plane loss, camera denial, Home teardown, and reopening all three experiences.
- Safe-area overlay reachability, large system text, VoiceOver/Android accessibility, and steady native frame/memory behavior during scrolling.

Regeneration and replacement-dataset instructions are in the exporter README. Final integration/coordinator verification and canonical task completion remain pending; no task completion checkbox was changed.
