# Phase 3 — Floating placement and Transform controls

Date: 2026-10-08 (America/New_York).

The [shared medical/qubit Transform update](phase-3-qubit-transform-update.md)
supersedes this record's one-foot default and documents the current two-foot
defaults, shared widget, and latest validation.

Implemented on `phase-3-medical`, based on `7d78dfc538d5c352d2e583d716f70a9eb3878dda`.
Implementation commit: `5e14c4c851fa1dcaa2d0fce7f550ea7e05bb343b`
(`feat: add floating medical model and transform controls`).
This update supersedes the original delivery's controls and grounded runtime pose.
The prepared GLB and its calibration/provenance remain unchanged.

## Behavior

- The skull's base starts 0.3048 metres (one foot) above the selected surface.
- Main row 1: native model dropdown and **Transform**. Main row 2: **Labels** and
  **Restart AR**. Brain appears disabled in the dropdown; Both remains omitted.
- Transform replaces the bottom controls while leaving the AR model visible.
  Its four rows are **Scale**, **Rotate**, **Height**, and **Reposition / Done**.
  Native sliders adjust size from 0.5–3 times the original, yaw through a full
  turn, and height from 0–1.524 metres (five feet). There are no numeric readouts
  or extra captions. Controls stack at narrow widths or larger text sizes.
- Height offsets the prepared mesh's base independently of scale and yaw;
  labels follow all three transforms. Pinch and two-finger yaw rotation remain.
- Reposition and selected-plane loss preserve height, size, yaw, and labels.
  Reposition closes Transform and returns to surface selection. Plane loss also
  returns to the main controls; a later placement does not reopen Transform.
- Restart AR restores original size/yaw and one-foot height, retaining the label
  preference. Background/resume preserves preferences but requires new placement.
  A later visit creates fresh screen defaults.
- Slider manipulation requires a loaded, placed model and normal tracking.
  Session, placement, and load-attempt guards reject stale slider callbacks.
  Size/yaw sliders defer to the corresponding active native gesture, preventing
  gesture-baseline jumps. A model error releases active gesture baselines so the
  sliders remain usable after Retry.
- The info sheet describes floating placement, dropdown availability, Transform,
  its ranges, Reposition, and restart defaults. Credit and educational-use text
  remain available through the header info button.

Universal Expo UI Picker does not expose per-item disabled state in the pinned
version. The selector therefore uses a SwiftUI menu picker on iOS and a native
Compose dropdown on Android. Sliders use universal Expo UI. No dependency pins,
shared AR lifecycle, sibling experience, EAS profiles, or source scans changed.

## Validation

- `npm test`: lint/Prettier, TypeScript, 14 AR tests, 102 qubit tests, and
  23 medical tests passed (**139 total**).
- Medical tests cover absolute slider values, finite inputs, size/height limits,
  yaw wrapping, slider/gesture handoffs, independent height, placement loss,
  reposition, retry, restart/resume, and callbacks from older load attempts,
  placements, and torn-down sessions. Existing GLB/provenance/anchor checks pass.
- `npx expo-doctor`: 21/21 passed.
- `npx expo export --platform ios --max-workers 2 --output-dir dist/medical-ios`:
  passed; skull GLB packaged.
- `npx expo export --platform android --max-workers 2 --output-dir dist/medical-android`:
  passed; skull GLB packaged.
- Viro scene validation: zero errors or warnings; iOS/Android support check passed.
- MDS `doctor_scan_project` with `mode: "ci"`, `runScripts: true`: 99/100,
  zero errors, 15 checks passed, four appropriately skipped. Final scan timestamp:
  `2026-10-08T23:08:00.296Z`. React Doctor reports seven retained warnings in
  shared AR/Home ScrollViews, shared AR complexity, Settings/theme exports, and
  sequential local-data work; none are in the medical feature. The initial
  medical controls complexity finding was fixed by extracting status and main
  controls components. The CI scan rechecked lint, types, all tests, Expo Doctor,
  and the iOS export after the final code changes.
- `git diff --check` and staged diff checks passed. Original and prepared asset
  blobs are unchanged by this update.

## Physical acceptance pending

On iPhone, verify the visible one-foot gap over tables/floors, all three sliders,
pinch/rotation responsiveness after slider adjustments, constant base height
while resizing, labels, and the disabled Brain dropdown item. Check Transform's
four rows, Done, Reposition, and the info sheet at large text sizes and with
VoiceOver. Exercise loading/error Retry, selected-plane loss, restart defaults,
background/resume, and rapid navigation. Android native layout, TalkBack, and AR
behavior also remain pending. Local exports and tests do not establish these
device results.

The previously requested [iOS development build](https://expo.dev/accounts/mrdj2u/projects/xr-showcase/builds/99b29592-feb6-4eb1-a4e4-0b213f788800)
completed successfully for commit `7d78dfc`; this update uses the same native
dependencies and can run through that development client with the current Metro
bundle. No additional cloud build or store deployment was requested for this
update.
