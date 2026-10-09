# Medical Viewer: MRI brain and Both mode
Immutable handoff created 2026-10-09 (America/New_York). Do not edit this historical packet.

## Assignment
Branch: medical-brain-both
Worktree: F:/ReactNativeApps/xr-showcase-i2Workspace/xr-showcase-medical-brain-both
Goal: complete the task end to end once the user supplies the brain and half-skull models.
Recommended worker: Tier 2 — GPT-6.1 Sol, extra high — bounded extension of the existing Medical Viewer with careful multi-asset loading and controller tests.

Exact task under "Phase 3 — Medical Viewer And Product Flows":
- [ ] Add the user-supplied MRI-derived brain 3D model to Medical Viewer and a third dropdown option, Both, that displays the user-supplied half-skull and brain models together; the user will supply both models when implementation starts.

Canonical control repository: F:/ReactNativeApps/xr-showcase-i2Workspace/project
Control remote: git@github.com:DavidJGrimsley/xr-showcase-project.git
[Canonical TODO](F:/ReactNativeApps/xr-showcase-i2Workspace/project/todo.md)
Source remote: https://github.com/DavidJGrimsley/xr-showcase.git
Chosen base: freshly fetched origin/main
Immutable task-base SHA: 37bc04ef2fdfc52c44a1155aa5b40fd322f121c4
Final-base default: origin/main (manifest defaultBranch: main).
Dependency evidence: Medical Viewer PR #2 was authoritatively merged into main at 2026-10-09T00:33:00Z; the selected base is its merge commit. No unmerged PR is required. PR #1 (Qubit) is also merged. Arena PRs #3/#4/#5 remain open and outside this assignment.
Source main is clean but behind origin/main; this worktree starts at the verified remote base without altering source main.
The control and source TODO copies differ; preserve unrelated task text, status, history and links. Only this exact new task was added to each applicable copy.

## Readiness and owner steps
The user will supply both the MRI-derived brain model and half-skull model when implementation starts. Do not launch implementation merely because this packet exists.
Request exact local asset paths, formats, provenance/license information and intended anatomical alignment when starting. Never infer MRI derivation, licensing or calibrated accuracy from a filename. Do not purchase, generate or substitute models or expose patient-identifying data. Preserve supplied assets until agreed optimization is needed.
No ReactVision Studio authoring is assigned. Use the existing native Viro scene; any later need for Studio authoring requires user direction.
Physical iPhone alignment/readability/gesture acceptance is owner work; implement and test everything available before returning its checklist. Final asset integration cannot be claimed complete until the supplied models are available.

## Expected behavior
Retain the existing Skull option and full-skull behavior. Enable Brain using the supplied MRI-derived model. Add the third option labeled "Both" on both iOS and Android pickers.
Skull shows the existing full skull; Brain shows the supplied brain; Both shows the supplied half-skull and brain simultaneously. Do not add a fourth half-skull menu option or replace the full skull.
Use one shared placement anchor and parent transform for Both so placement, translation/height, scale, rotation and reset affect the pair together. Inspect units, origin, orientation and bounds of supplied assets; establish documented per-model offsets/scales for alignment rather than assuming their coordinates match.
Preserve placement where appropriate when switching modes and existing reset semantics. Prevent old load/error callbacks from changing a newly selected mode. Both becomes ready only when both required models load successfully; loading, partial failure, retry and missing-asset states must remain honest and recoverable.
Apply label visibility according to the selected model. Do not reuse full-skull anchors blindly for the half-skull or invent clinically calibrated brain labels. Confirm requested anatomical labels with the owner if not supplied. Keep educational visualization wording.
Preserve native accessible dropdowns, safe-area HUD controls, gestures, AR camera exclusivity, permission states, background/resume, lost-plane handling and Home teardown.

## Files and constraints
Read AGENTS.md, project/info.md, project/style.md and project/guidelines.md first. Follow AGENTS.md's exact Expo SDK 57 documentation requirement before writing code and load the Expo overview skill.
Relevant files: src/features/medical-viewer/medical-models.ts, medical-model-picker.native.tsx, medical-controller.ts, medical-scene.native.tsx, medical-info.native.tsx, medical-viewer-screen.native.tsx, assets/medical/, tests/medical-controller.test.cjs and tests/medical-assets.test.cjs.
Keep changes local to Medical Viewer/assets/tests and narrowly necessary docs. Shared AR contracts, Arena, Qubit, account configuration, credentials, dependencies and release settings are outside scope. Preserve lockfile and existing Viro/Expo versions.
Stop and report intact state on unexpected dirty state, conflict, lock or in-progress Git operation. No auto-stash, force operations, merges to main or remote publishing are part of this preparation.
Environment discovery found no eligible .env/.env.* files in the source donor outside dependency/generated directories; no private environment files were copied.

## Validation and delivery
Run from this worktree:
- npm ci
- npm test
- npm run test:medical
- npx expo-doctor
- npm run build:ios
- MDS Doctor MCP doctor_scan_project(projectPath: "F:/ReactNativeApps/xr-showcase-i2Workspace/xr-showcase-medical-brain-both", mode: "ci", runScripts: true); if unavailable, npm run mds:doctor:ci and record the limitation.
- git -C "F:/ReactNativeApps/xr-showcase-i2Workspace/xr-showcase-medical-brain-both" diff --check
- git -C "F:/ReactNativeApps/xr-showcase-i2Workspace/xr-showcase-medical-brain-both" diff --stat 37bc04ef2fdfc52c44a1155aa5b40fd322f121c4...HEAD
- git -C "F:/ReactNativeApps/xr-showcase-i2Workspace/xr-showcase-medical-brain-both" diff --stat origin/main HEAD

Extend meaningful tests for all three selections, availability, Both's two-asset readiness/partial failure/retry, stale callbacks after switching, common transform/reset and existing teardown. Include asset format/provenance/bounds checks appropriate to supplied files.
Record exact commands/results, task-base and HEAD SHA, model provenance, alignment decisions, remaining owner acceptance and changed files in project/agent/completions/medical-brain-both.md. JavaScript export/mock tests do not prove physical AR or anatomical accuracy.
Commit implementation only on medical-brain-both. Do not mark the canonical checkbox complete before coordinator verification and final-base integration. Finish all authorized available work in one pass rather than stopping after menu scaffolding; return explicit asset/owner blockers if unresolved.
