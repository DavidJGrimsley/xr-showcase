# Medical Viewer supplied-model integration — 2026-10-09

Implemented the owner's updated request: use the supplied brain and half-skull exports, add Half Skull as a fourth selection, and default to Both. This supersedes the handoff's three-item menu and the earlier skull stand-ins. The native iOS and Android menus now contain Skull, Brain, Half Skull, and Both. Both displays the half-skull and brain under one shared anchor/transform. Full Skull and its calibrated labels remain unchanged; no new anatomical labels are claimed.

Branch/worktree: `medical-brain-both` at `F:/ReactNativeApps/xr-showcase-i2Workspace/xr-showcase-medical-brain-both`. Entry HEAD: `83d633191dc50140e36690eff33d2b59ebd88f31`. Validated implementation HEAD: `559be692209fdc736ad127cb6933db1c6723c4ee`. Immutable task-base and local `origin/main`: `37bc04ef2fdfc52c44a1155aa5b40fd322f121c4`. This completion is a documentation-only follow-up. No publishing or main merge occurred; canonical checkbox remains pending coordinator verification and final-base/device acceptance.

## Supplied assets and provenance

Source folder: `F:/ReactNativeApps/xr-showcase-i2Workspace/temp/medical-scans/VisibleHumanHead/From3DSlicer`. The owner explicitly confirmed the same NLM Additional Head Images dataset and registration in Slicer. The open Slicer screenshot identifies corresponding segmentation/registration nodes; implementation uses the exports directly and does not modify the open project or original files.

| Slot | Source | Original SHA-256 | Packaged SHA-256 |
| --- | --- | --- | --- |
| Brain | MRI_Elastix mask.obj | db80fa4dcdc3471463ca84a6816e9c948c65bc421eb84eaec872d4dfc5885b4f | faf9e97dcc5bfe546d388749292ac101ea697e6858fab505e6fba61758c0ec03 |
| Half Skull | Skull3D-Half.obj | 84209dff1cc01af9e7f7d4f51d09d5c4537541a04b0e148ae630462d9a374aa2 | 2cd232b5d13f1ae095ee09203d66e66749702eb7a52ea7553e0b6d1725b9b63b |

The supplied Skull3D.obj SHA-256 is `f3b2629424b65d5d251c6dda1f085184236b33834a602ab1366c18919510403b`, matching the unchanged full-skull provenance. Packaged Skull SHA-256 remains `990603fd394bf12a8f65b02ee77fd9563122c9be6c08547f1e57c30da5cd8d47`.

New sources are Slicer LPS OBJ surfaces. Brain is 948,928 source triangles; half-skull is 2,343,564. Prepared GLBs have 65,000 / 79,817 triangles and 1,171,144 / 1,272,044 bytes respectively. Both totals 144,817 triangles and 2,443,188 bytes. All GLBs are self-contained and opaque, without Draco or external textures. Source and output hashes, cleaning, units, bounds, matrix, presentation materials, and attribution are recorded in the two new provenance JSON files. NLM's [project page](https://www.nlm.nih.gov/research/visible/visible_human.html) describes the image data as public-domain; the [collection README](https://data.lhncbc.nlm.nih.gov/public/Visible-Human/Additional-Head-Images/README) identifies the additional head image source. Attribution is retained.

## Alignment and behavior

Both new meshes bake the full skull's exact LPS-to-model matrix and origin `[-8.314079284667969, 78.85992622375488, -212.7226389219286]` millimetres. Output is Y-up metres, anterior +Z, anatomical left +X. There is no independent centering, grounding, orientation change, fit-to-bounds scaling, or registration adjustment. Each child therefore has identity position/rotation/scale; one parent changes placement/height, size, and yaw together. Full-skull source hash agreement, coordinate header/bounds checks, owner confirmation, and a combined Blender inspection support preserving the supplied registration. This is not a clinical registration-accuracy result.

Both is selected on fresh entry and after leaving/reopening. Reposition, background/resume, and Restart AR preserve the current selection, retaining existing reset semantics. A missing default asset permits fallback to an available mode. Half Skull has its own one-slot load lifecycle. Both still requires two successful loads, clears the pair on failure, reloads both on Retry, rejects callbacks from older selection/attempt/placement/session identities, and clears load deadlines on cleanup. Shared AR files were not changed. Stand-in notices are removed.

## Validation

- Read exact Expo SDK 57 docs before edits; reused previously read Expo overview/UI guidance and Viro/installed package types.
- Ran Blender 5.0.1 `--background --factory-startup --python scripts/prepare-medical-models.py -- --source-directory "F:/ReactNativeApps/xr-showcase-i2Workspace/temp/medical-scans/VisibleHumanHead/From3DSlicer" --preview-directory .expo/medical-integration/preview`: exit 0; generated both GLBs and four previews. After the owner's confirmation, finalized metadata and added the optional `--registration-confirmed` regeneration flag. Python AST syntax check passed on the final script.
- `Get-FileHash -Algorithm SHA256` on all three source OBJs: matched the source hashes above; originals preserved.
- `npm run test:medical`: exit 0, 38/38 tests. Includes actual GLB headers/indices/normals/triangle areas, hashes, budgets, provenance, bounds, common matrix, all four selections, default Both, Half Skull-to-Both stale events, paired readiness/failure/retry, native scene JSX/controller wiring, transforms/reset, labels, deadlines, and teardown.
- `npm test`: exit 0; lint/typecheck and 160/160 tests (14 AR + 108 Qubit + 38 medical).
- `npx expo-doctor`: exit 0, 21/21 checks passed.
- `npm run build:ios`: exit 0, 2,402 modules and 31 assets; all three GLBs packaged. This is a JavaScript export, not a physical iPhone build.
- MDS MCP `doctor_scan_project({projectPath: "F:/ReactNativeApps/xr-showcase-i2Workspace/xr-showcase-medical-brain-both", mode: "ci", runScripts: true})`: score 99, 0 errors, 1 warning group; lint/typecheck/tests/Expo Doctor/build passed. React Doctor's 7 warnings are in 6 unchanged files outside Medical Viewer.
- `git diff --check`, `git diff --cached --check`: passed. Reviewed task-base and `origin/main` diff stats. At implementation HEAD, comparisons include prior groundwork and bootstrap docs; this implementation commit changes 13 files, 558 additions / 100 deletions plus two GLB binaries.
- `git diff --exit-code 83d633191dc50140e36690eff33d2b59ebd88f31 -- assets/medical/skull.glb assets/medical/skull-labels.json assets/medical/skull-provenance.json package.json package-lock.json project/todo.md src/features/ar`: exit 0. Original Skull, shared AR contracts, dependencies, lockfile, and task status are preserved.
- Existing Windows CRLF/Prettier LF mismatch: temporarily normalized 66 checkout files for full checks, then restored their exact saved bytes. Generated Uniwind types were verified unchanged in content and restored to original checkout line endings. No unrelated Git changes remain. Reproducing full lint requires equivalent LF checkout normalization.
- Visually inspected the combined offline render; preview copy: `F:/ReactNativeApps/xr-showcase-i2Workspace/temp/medical-brain-both-preview.png`.

Changed files: new `brain.glb`, `brain-provenance.json`, `half-skull.glb`, `half-skull-provenance.json`, and `scripts/prepare-medical-models.py`; Medical Viewer model catalog/controller/source registry/info/HUD; both medical test files; asset guide; this report and the updated completion index.

## Remaining owner acceptance

No asset-supply blocker remains. Physical iPhone/Android AR performance, menu accessibility, actual pair alignment, original Skull label readability, rapid mode switching, controls/gestures, tracking loss, background/resume, Reposition/Restart, and Home teardown remain device acceptance work. Final Brain/Half Skull labels require owner-approved names and anchors. Educational visualization only; unit/export/offline-render checks do not establish anatomical or clinical accuracy. See [asset details and acceptance steps](../../medical-brain-both-assets.md).
