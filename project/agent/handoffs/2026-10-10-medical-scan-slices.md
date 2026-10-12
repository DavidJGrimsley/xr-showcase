# Immutable handoff: Medical Scan Slices
Created: 2026-10-10 (America/New_York). Preserve this packet; use a separate completion report.

## Assignment and roadmap mapping
Branch: medical-scan-slices
Worktree: F:/ReactNativeApps/xr-showcase-i2Workspace/xr-showcase-medical-scan-slices
Heading: Phase 3 — Medical Viewer And Product Flows
Exact selected task:
- [ ] Add a Scan Slices option to Medical Viewer for actual CT and registered MRI axial images in AR, with a 3D Slicer exporter, generated static asset mappings, modality selection and slice navigation; preserve the separate 3D Anatomy mode.
Control repository: F:/ReactNativeApps/xr-showcase-i2Workspace/project
Control remote: git@github.com:DavidJGrimsley/xr-showcase-project.git
[Canonical roadmap](F:/ReactNativeApps/xr-showcase-i2Workspace/project/todo.md)
Source repository: https://github.com/DavidJGrimsley/xr-showcase.git
Chosen base: freshly fetched origin/main
Immutable base SHA: 37bc04ef2fdfc52c44a1155aa5b40fd322f121c4
Final-base default: origin/main, from manifest defaultBranch main.
Recommended worker: Tier 3 — GPT-6 Astra, extra high — Slicer spatial geometry, registered-image resampling and reactive AR texture updates require careful cross-system reasoning.

## Verified dependencies and readiness
Medical Viewer PR #2 was authoritatively merged into main at 2026-10-09T00:33:00Z; this base is its merge commit. Qubit PR #1 is also merged. No unmerged PR is used as the base; Arena PRs #3/#4/#5 are outside scope.
The source main checkout is clean but behind origin/main; it was left unchanged. This worktree includes merged Medical Viewer, shared AR lifecycle, native model picker and medical tests.
The separate medical-brain-both worktree is at 4beea5ca4c658e6898dc24dfed32052124cff0fc, but its integration into main is not verified and the current main base does not contain its new anatomy modes. Preserve existing anatomy modes on this base. Do not recreate or overwrite sibling work: report overlap and coordinate final integration once the brain work is merged. Do not silently rebase onto or merge that sibling branch.
The prompt's Phase 1–7 headings are implementation steps within this one Phase 3 roadmap task, not new project phases.
The user explicitly provided the appended prompt for this worker handoff. Preparing this packet does not launch implementation. Follow the complete prompt when assigned, implement all independent available work in one sustained pass, and leave genuine owner/manual dependencies explicit.

## Owner steps and exclusions
The loaded 3D Slicer scene/volumes are described by the user but have not been inspected by this coordinator. If no supported access to Slicer's environment exists, deliver the exporter and exact Windows Python Console instructions, then have the owner execute it and supply exported images/metadata. Do not fabricate scans or treat script syntax checks as proof of Slicer geometry correctness. Keep original volumes and segmentations untouched.
Physical iPhone/Android acceptance and export execution when unavailable locally remain owner steps. Use real images only and preserve provenance. No Studio authoring is implied. No cloud builds, purchases, publishing, submissions or unrelated account changes are authorized by preparation.
Read AGENTS.md, project/info.md, project/style.md and project/guidelines.md before implementation. Follow the exact SDK 57 documentation requirement and relevant Expo/Viro skills and APIs. Preserve installed versions and lockfile except a demonstrably needed compatible slider dependency authorized by the prompt.
Do not change sibling XR experiences, rewrite existing roadmap items, assume a panel is registered to meshes, apply MRI registration twice, use screenshots as scan data, or implement volume rendering/clipping. Prefer feature-local changes and retain exactly one camera session.
No eligible .env/.env.* paths were found in the default source donor outside generated/dependency folders; no private environment files were copied.
Stop on conflicts, locks, surprising dirty state or in-progress Git operations; preserve state. No auto-stash, forced operations, source-main merge or cleanup of sibling work.

## Required validation and delivery
From this worktree run npm ci, npm test, npm run test:medical, npx expo-doctor, npm run build:ios and MDS Doctor MCP doctor_scan_project(projectPath: "F:/ReactNativeApps/xr-showcase-i2Workspace/xr-showcase-medical-scan-slices", mode: "ci", runScripts: true). If MCP is unavailable, use npm run mds:doctor:ci and record that limitation.
Add meaningful exporter/geometry and manifest-validation tests where the runtime supports them; test slice-index bounds, modality switching, rapid selection, missing files/load failures, stale callbacks and teardown. Record exact commands and distinguish mock/static verification from Slicer execution and physical AR.
Run git diff --check, git diff --stat 37bc04ef2fdfc52c44a1155aa5b40fd322f121c4...HEAD and git diff --stat origin/main HEAD in the assigned worktree. Verify current final-base evidence during integration.
Commit only on medical-scan-slices. Deliver project/agent/completions/medical-scan-slices.md with base/HEAD SHAs, exact validation results, model-mode overlap, image dataset provenance/size, exporter/resampling choices and remaining manual steps. Do not mark the canonical task complete before coordinator verification and final-base integration. Do not stop after a plan or UI stub; finish all available scope and state blockers precisely.

## User-supplied implementation prompt (verbatim)

# Implement Interactive CT/MRI Slice Viewer in XR Showcase

You are working in my existing **Expo React Native + TypeScript XR Showcase** project.

I want you to implement an interactive medical-image viewer that displays **actual CT and MRI cross-sectional images in augmented reality**, using ViroReact.

**Do not create another Expo application.** Integrate this into the existing Medical Viewer experience. Preserve the Arena Fighter and Guess the Qubit experiences and existing navigation.

## Context

I have already prepared medical imaging data in 3D Slicer on Windows.

These are from the NIH Visible Human Project Additional Head Images dataset.

My relevant Slicer volumes are:

- `CT Head` — original CT volume.
- `MRI` — original T1 MRI volume.
- `MRI_Elastix` — MRI successfully registered to CT using SlicerElastix.
- `MRI_Elastix mask` — extracted brain segmentation.
- `Skull3D` — full skull segmentation.
- `Skull3D-Half` — half-skull segmentation.

The CT and registered MRI are already reasonably aligned.

**This task is specifically about the original medical image slices, not converting the skull or brain models into images.**

Keep the existing 3D anatomical models available for the separate 3D anatomy mode.

## Phase 1 — Inspect the existing project

Before implementing anything:

1. Inspect the Expo, React Native, TypeScript, and `@reactvision/react-viro` versions.
2. Identify the existing Medical Viewer route and AR scene.
3. Examine the current architecture for rendering ViroReact content and communicating between React Native UI and AR scenes.
4. Check whether Zustand or another shared state solution is already installed.
5. Review relevant ReactVision/ViroReact documentation and available MCP tools before selecting APIs.

Reuse the existing AR scene navigator and build configuration.

Do not introduce another simultaneous AR session.

## Phase 2 — Create a 3D Slicer image exporter

Create a Python script named `tools/medical/export_slices_slicer.py`.

This script must run **inside 3D Slicer's Python environment**, where the Slicer API and loaded medical volumes are available.

Create a simple README explaining exactly how I should execute it using Slicer's Python Console on Windows.

Requirements:

1. Locate `CT Head` and `MRI_Elastix` using `slicer.util.getNode()`.
2. Verify both are scalar volume nodes and examine their dimensions, voxel spacing, orientations, and coordinate transforms.
3. Extract real grayscale cross-sectional images from each volume using the appropriate Slicer/VTK APIs.
4. For the first implementation, support **axial slices**.
5. Generate images in correct anatomical orientation. Account for the IJK-to-RAS geometry rather than blindly assuming NumPy array axes correspond to axial orientation.
6. Start with approximately 60–100 evenly spaced slices per modality to control application size.
7. Export 512-pixel-resolution PNG images while maintaining the original aspect ratio and preserving the entire relevant anatomy.
8. Apply consistent window/level settings within each modality so the images don't flicker in brightness while scrolling. Use sensible CT and MRI defaults, with configurable values.
9. Name files predictably:
   - `ct_axial_000.png`
   - `ct_axial_001.png`
   - `mri_axial_000.png`
   - `mri_axial_001.png`
10. Produce `metadata.json` containing modality, orientation, image count, original voxel spacing, physical slice coordinates, image dimensions, window/level settings, and any resampling details.

Place the exported image assets in an appropriate directory such as:

`assets/medical/slices/`

Make the export destination configurable.

Use the Slicer APIs and libraries available in its bundled Python installation. Do not require a second Python environment unless absolutely necessary.

Do not export UI screenshots containing Slicer controls, crosshairs, annotations, or mouse cursors.

The exported images must represent the real scan data.

**Important:** `MRI_Elastix` is already registered. Do not apply its registration transform twice. If matching CT/MRI slice positions is necessary, use a common spatial reference and document the resampling.

Do not modify or overwrite the original medical volumes or Slicer segmentations.

If the script cannot access the required volumes, provide the exact manual steps needed. Do not generate fabricated medical images.

## Phase 3 — Generate TypeScript asset mappings

Metro does not support dynamically constructing paths inside `require()`.

Create a script that scans the generated images and produces a TypeScript file containing explicit static image references.

Example:

```ts
export const mriAxialSlices = [
  require("./mri_axial_000.png"),
  require("./mri_axial_001.png"),
];
```

Generate this file automatically after image export.

Do the same for CT.

Read metadata from a generated JSON file and use it to determine image counts and slice positions.

Validate that every referenced image exists.

## Phase 4 — Implement the AR slice viewer

Create or extend the Medical Viewer with a dedicated **Scan Slices** mode.

Render the selected medical image using ViroReact's supported `ViroImage` component.

Requirements:

- Display a rectangular image panel approximately 50–60 cm wide in AR.
- Position the panel at a comfortable viewing distance.
- Preserve the image's aspect ratio.
- Allow the user to rotate and resize the panel if straightforward with existing scene controls.
- Keep the image in the AR scene, not merely as a fullscreen React Native image.
- Display CT and MRI images without reinitializing the AR session.
- Avoid keeping dozens of invisible ViroImage components mounted simultaneously.

Use one image component with a changing image source, provided that works reliably with the installed ViroReact version.

If there are texture-update or caching problems, investigate and apply a documented solution.

## Phase 5 — Add interactive TypeScript controls

Create a simple React Native overlay over the AR view.

Controls:

**Imaging modality**
- CT
- MRI

**Slice navigation**
- Slider from first to last available slice.
- Previous slice button.
- Next slice button.
- Current slice number / total slices.
- Optional physical slice position in millimeters.

**Viewer**
- Reset slice position.
- Reset panel transform.
- Return to Medical Viewer home.
- Switch back to the existing 3D Anatomy mode.

The slider should update the displayed image as the user drags it.

Use `@react-native-community/slider` if the project doesn't already have a compatible slider.

Keep slice state in React/TypeScript.

If the Viro scene doesn't react to navigator prop updates, use a supported shared-state mechanism such as the project's existing Zustand store. Do not assume mutating `viroAppProps` automatically causes reactive rendering.

When switching between CT and MRI, reset or map the slider appropriately so indices always remain valid.

If a slice fails to load, display a useful error instead of crashing.

## Phase 6 — Preserve and extend Medical Viewer modes

The Medical Viewer should ultimately have two main modes:

### 3D Anatomy

Use our existing scan-derived 3D meshes:

- Full skull
- Half skull
- No skull
- Brain visible/hidden

Preserve existing work and leave unfinished 3D features intact.

### Scan Slices

Use actual exported medical images:

- CT axial
- MRI axial
- Slider navigation
- Floating AR image panel

These are separate representations of the medical data.

For this task, **do not attempt true volume rendering or arbitrary real-time mesh clipping**.

Architect the slice viewer so sagittal and coronal orientations can be added later without rewriting the entire component.

An advanced future feature could display an anatomically registered slice plane intersecting the 3D skull and brain. Do not assume the 2D image panel is spatially registered to the meshes merely because they appear in the same AR scene.

## Phase 7 — Performance and validation

Make sure this works smoothly on a physical Android or iOS device.

- Cache or preload nearby slice images only when necessary.
- Avoid loading all full-resolution images into active textures at once.
- Keep image assets compressed.
- Avoid expensive 3D scene reconstruction when the slider moves.
- Confirm switching CT → MRI → CT works.
- Confirm rapid slider movements don't crash the application.
- Confirm returning home properly unmounts the Medical Viewer and does not leave a camera session running.
- Confirm Arena Fighter and Guess the Qubit still open normally.

Use the existing Expo development-build workflow. Do not substitute Expo Go for the ViroReact runtime.

Run the project's available type checks and tests.

## Deliverables

Implement the feature as far as possible locally.

Provide:

1. Working 3D Slicer image-export script.
2. Clear Windows instructions for running the script against my currently loaded Slicer scene.
3. Automatic image manifest generation.
4. TypeScript AR slice-viewing component.
5. React Native slider and modality controls.
6. Integration with the existing Medical Viewer.
7. Brief documentation for exporting new medical datasets later.
8. Test results and remaining manual steps.

Do not commit hundreds of megabytes of unnecessary medical files.

**Prioritize getting real MRI slices scrolling inside AR first, then add CT.**

Avoid unrelated refactoring, modifying the other XR experiences, or installing unnecessary dependencies.

If you encounter uncertainty about a ViroReact capability, verify it using the installed version's documentation and source before implementing a workaround.

Implement the solution rather than stopping after producing a plan.