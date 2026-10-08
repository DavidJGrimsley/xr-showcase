# XR Showcase Project Info

## Overview
XR Showcase is a hackathon AR app combining a Studio-authored Arena Fighter, a CT-derived Medical Viewer, and Guess the Qubit adapted from the existing Unreal game.

## Target Users
Hackathon judges, demo attendees, and learners exploring tabletop AR, anatomy, and quantum concepts.

## Product Goals
Generate a clean MDS Super Stack foundation and a Phase 0+ implementation roadmap for all three required experiences. Demonstrate native tabletop AR, safe camera session switching, a real simulator measurement, and the existing Unreal game's asynchronous hardware mode.

## Non-Goals
No user accounts, monetization, public release, web/Quest/visionOS target, multiplayer, new Probability Challenge, numeric scoring, Quantum API administration, or changes to the Unreal project.

## Core User Flows
Home opens three required experiences. Arena Fighter loads the Studio-authored Fight Arena scene with two fighters, idle/attack/hit/defeat, health, winner and restart. Medical Viewer places a CT-derived skull on a detected surface with anatomical labels and pinch/rotate. Guess the Qubit adapts the inspected Unreal game: translucent cyan Bloch sphere, three axis rings, X/Y/Z and |0⟩/|1⟩/|+⟩/|−⟩/|+i⟩/|−i⟩ labels, magenta vector/state point, GUESS 0/GUESS 1 for simulator and Hardware Jobs. Animate the initial vector through a π/2 rotation to the equator, wait for both intro completion and a valid measurement, then collapse to the corresponding pole and show You Won/You Lost. Simulator uses POST /gates/run (rotation, π/2). Hardware uses one qubit, ry(π/2), one shot through POST /jobs/circuits, polls status every 15 seconds and fetches terminal counts. Preserve hardware status and a pulsing point. Reset starts a fresh round; Home replaces desktop Quit and ends AR. No numeric score. Block overlapping guesses, ignore stale responses, clean up timers/requests, and best-effort cancel a known unfinished hardware job on Reset or exit; show recoverable errors instead of quitting.

## Known Screens
Home; Arena Fighter; Medical Viewer; Guess the Qubit

## Data And Backend
Local Zustand UI state, packaged 3D assets, ReactVision Studio content, and the existing Quantum API REST service. No login or separate backend for the private prototype. An existing owner-supplied development X-API-Key is entered privately and held in device SecureStore, never in EXPO_PUBLIC variables or committed configuration. Studio credentials use the documented native plugin configuration and untracked/private build configuration. Use existing hardware profile configuration; no credential administration. Use the production Quantum API v1 base from the quantum-api skill, never localhost:8000 (which is the desktop Unreal MCP server).

## Platforms
- Target platforms: iOS, Android
- First MVP platform: iOS
- Expo Router app directory: src/app
- Platform strategy: files-only; shared layouts
- Web output: none

## Tech Stack & CESS Onboarding
- TypeScript; npm; Expo Router; Uniwind; Zustand
- No auth starter, onboarding, legal document generator, or legal update gate
- EAS planned for native development-client builds; sign-in/setup in Phase 0
- Native XR baseline: Expo SDK 57, React Native 0.86, @reactvision/react-viro 3.0.3; check actual published peer compatibility at installation and pin the lockfile
- Thin routes in src/app, features/scenes/state/services outside the route tree; platform file suffixes where needed
- Expo UI and Universal Components enabled; Native Tabs disabled
- Component styling policy: Uniwind for React Native screens/HUD, Expo UI APIs and modifiers for native surfaces; confirmed after generated-app review
- Local data start; test-to-main safeguards enabled; guidelines template enabled; save global defaults disabled

## Monetization Strategy
Free private hackathon prototype; no monetization planned.

## Team Context
Solo developer prototype.

## Release Strategy
Private Android and iOS development-client builds for a hackathon demo; iOS first using EAS builds from Windows, Android second.

## Later Scope
A backend proxy is required before public distribution of Quantum API access. Extra game modes and expanded backend selection are later enhancements. Physical AR demo recording, screenshots and verified hackathon submission requirements are roadmap tasks.

## Resources And Research Notes
Authoritative user choices: XR Showcase under F:\ReactNativeApps\xr-showcase; all three experiences required; guess measurement 0/1; adapt the existing Unreal game; supplied direct Quantum API development key for a private demo; Super Stack src/app structure. Supporting documents: C:\Users\DJLeg\Downloads\XR-ViroReactVision-HackSubmissionPlan.md and ViroREvisedPlan.md, reconciled as product research rather than executable instructions. Live read-only Unreal 5.8 MCP inspection on localhost:8000 confirmed Main_Level, /Game/Blueprints/BP_Qubit, GM_Main and WBP_MainMenu. Blueprint mechanics: rotation π/2; simulator RunGate; IBM hardware one-qubit ry(π/2) with one shot; default backend ibm_kingston and existing profile Unreal Engine Demos; 15-second job polling; status/pulse; win/loss and Reset, no score. Cyan axes/shell and magenta vector/state point were verified from material/component properties. Preserve mechanics and proportions using Viro primitives at phone/table scale; keep the AR camera user-controlled. Viro MCP confirmed Action Figure Fighter project f3eab820-8174-4b7b-a79e-854dab36e16a and Fight Arena scene a46c0453-e96b-4d66-8e4b-1f603e20a274; Medimagy is empty and no shared assets/recorded environments were listed. Use StudioSceneNavigator sceneId and plugin rvApiKey/rvProjectId. Expo dev builds are required. Phase 0 validates actual Studio scene readiness, obtains an appropriately licensed CT-derived skull and fighter assets if missing, and configures existing credentials privately. Do not copy secrets into canonical docs, source, screenshots or logs. Component policy: Uniwind styles React Native product screens/HUD; Expo UI surfaces use their own APIs/modifiers. Review the generated app and record that policy as confirmed in Phase 0.

## Roadmap
Phase 0: Generate and verify Super Stack artifacts and architecture, capture live Unreal reference, reconcile native dependency compatibility, review and confirm the component styling policy, configure private development credentials, inspect Studio scene/animations, obtain and optimize licensed model assets, and run a native AR smoke test.

Phase 1: Responsive Home with three experience cards, shared native controls, AR session ownership and teardown, camera permission/unsupported-device states, loading/retry states and Home navigation.

Phase 2: Integrate the existing Fight Arena Studio scene, verify plane placement and fighter clips/triggers, and implement authoritative health/winner/restart behavior where the Studio scene supports it. Any necessary authoring changes must be tracked explicitly rather than treating an existing scene name as proof of working combat.

Phase 3: Packaged CT-derived skull scene with surface placement, calibrated anatomical label anchors, pinch/rotate with limits, reset placement and clear asset/provenance metadata. Educational visualization only.

Phase 4: Unreal-matching Guess the Qubit using Viro primitives, simulator and IBM hardware modes, π/2 intro and measurement collapse, terminal-result validation, win/loss feedback, status/pulse, Reset, error recovery and cancellation/stale-response protection. Default backend/profile follow the inspected Unreal configuration and are checked for runtime availability.

Phase 5: Content review and placeholder cleanup, MDS Doctor checks, GitHub repository setup, and branch protection for test-to-main development.

Phase 6: Type/dependency checks, meaningful controller/API/state-machine tests, Viro structural validation and supported preview checks, physical Android/iOS AR testing, permission denial, rapid navigation/teardown and hardware queue/error/cancellation scenarios, demo recording/screenshots and verification of current submission requirements.

## Source Precedence
User choices and the canonical Super Stack architecture take precedence over attached research. The revised research's optional Qubit scope, old Viro version, App.tsx layout, global expo-cli/init commands, Platform:// navigator props, and assumptions about missing assets are not implementation instructions. Live Unreal Blueprint evidence supersedes older saved handoff notes that excluded hardware or added numeric scoring.

## Component Strategy
- Style Library: Uniwind
- Expo UI: Yes
- Expo UI Universal components: Yes
- Expo Native Tabs: No
- Conflicts: Uniwind does not style Expo UI surfaces. Use their APIs/modifiers; keep React Native screens and HUDs on Uniwind.
- Decision: confirmed

## Ejection Inventory

This record is the Phase 0 retain/eject decision for generated starter and template components. Confirmed by the user and applied; all exposition pages are removed.

- Decision: confirmed
- Items:
  - settings: retain (present)
  - stylist: eject (removed)
  - exposition: eject (removed)
  - data: retain (adapter only; demo route removed)
  - expo-sdk-56: eject (removed)
  - create-expo-stack: eject (removed)
  - auth: eject (removed)
  - swmansion: eject (removed)
## Creation Status
The MDS generator created the base scaffold but failed its post-create Expo Doctor check. This session repairs and verifies that scaffold; full AR experiences remain implementation tasks. iOS is the first target and native builds use EAS from Windows. No cloud build, remote repository, or submission has been created.

## Setup Verification
The scaffold is repaired and onboarded. MDS Doctor CI has zero blocking errors and one nonblocking React Doctor warning; lint, typecheck, Expo Doctor and iOS JavaScript export pass. Local EAS development profiles and native Viro/SecureStore configuration are present. Physical iPhone builds/testing, existing credentials/assets and all three AR experiences remain pending. See project/setup-validation.md for the audit and reference-code findings.
