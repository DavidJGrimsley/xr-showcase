# Shared medical/qubit Transform controls and two-foot defaults

Date: 2026-10-08 (America/New_York).

Implemented on `phase-3-medical`, based on `3becf248c79457dc6d5c63a2fcc201996f24e13d`,
for [PR #2](https://github.com/DavidJGrimsley/xr-showcase/pull/2). The owner requested
the qubit screen change as part of this update. Earlier completion records are
historical; this report supersedes their default-height and controls descriptions.

Implementation commit: `8b84d8f7c5290e365671bca042bb07c44bcb6a1b`
(`feat: share transform controls with qubit and raise default height`).

## Current behavior

- Skull and Bloch sphere start **two feet (0.6096 metres)** above the selected
  surface. Height represents the gap below the skull/sphere base; scale changes
  preserve that gap. Sphere centre height includes its scaled radius.
- Both screens use the same native Transform widget: Scale, Rotate, Height,
  and Reposition / Done. Size remains bounded to 0.5–3 times the original,
  yaw wraps through a full turn, and height remains bounded to 0–5 feet.
  The dark shell, native sliders, accessibility values, 48-point targets, and
  stacking behavior are shared. The medical main controls remain unchanged
  apart from their new default height. Qubit replaces its −/+ buttons with
  Transform beside the Simulator/Hardware dropdown.
- Qubit display rotation applies to the outer sphere node; the state vector's
  preparation/collapse animation and quantum circuit retain their behavior.
  Changing Scale, Rotate, or Height leaves an active measurement or queued
  hardware job running without new submissions or cancellations.
- Qubit Reposition preserves display pose, ends the round through the existing
  cancellation path, and returns to surface selection. A late submission is
  cancelled without accepting its result. Surface loss uses the same cleanup.
- Reset Qubit preserves size, yaw, and height. Background/resume preserves these
  preferences within the current screen but requires placement again. Restart AR
  restores default size, yaw, and two-foot height. A later visit starts fresh.
- Manipulation requires placement and normal tracking. Slider/native gesture
  handoffs use start baselines; invalid endings release controls. Qubit callbacks
  carry session, placement revision, and round identities, rejecting callbacks
  after reposition, reset, teardown, or session replacement. Both info sheets
  describe the updated controls and default height.

The shared AR permission/camera/background boundary, quantum networking and job
journal, dependency pins, EAS profiles, source scans, skull GLB, and label data
remain unchanged.

## Validation

- `npm test`: lint/Prettier, TypeScript, 14 AR tests, 108 qubit tests, and
  23 medical tests passed (**145 total**).
- New/updated qubit tests cover two-foot defaults, scale/height limits, constant
  base height during scaling, yaw wrapping, consecutive gestures, slider
  handoffs, tracking interruption, reset/reposition/restart/resume, stale
  callbacks, active measurement preservation, queued hardware polling, and
  cancellation on Reposition including late acknowledgement.
- MDS Doctor CI (`mode: "ci"`, `runScripts: true`), timestamp
  `2026-10-08T23:41:46.604Z`: **99/100**, zero errors, 15 passed checks and four
  appropriately skipped. Expo Doctor passed 21/21. React Doctor reports the
  same seven retained warnings in shared AR/Home layout, shared AR complexity,
  Settings/theme exports, and sequential local-data work; none in the new widget
  or either updated experience.
- CI's iOS Hermes export passed and packages the skull GLB.
- `npx expo export --platform android --max-workers 2 --output-dir dist/medical-qubit-android`:
  passed; skull GLB packaged.
- Updated qubit Viro scene: zero schema errors/warnings; iOS and Android platform
  support checks passed. Medical geometry/provenance/label checks remain passing.
- Git working-tree, staged, and branch diff checks passed.

## Physical acceptance pending

Verify both screens' visible two-foot gap, sliders, gestures, large-text layout,
screen-reader controls, Reposition, restart defaults, and background/resume on
iPhone and Android. On qubit, check that displayed yaw leaves pole/state labels
and animations understandable, and exercise Transform during measurement and a
hardware queue before using Reposition. Updated native behavior is not established
by local exports or controller tests. No additional EAS build or deployment was
requested for this update; the existing development client can load the new bundle.
