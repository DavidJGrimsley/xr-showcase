# Immutable handoff: Phase 3 — Medical Viewer And Product Flows
Created: 2026-10-08 (America/New_York). Do not edit this historical packet; write subsequent findings to a separate completion report.

## Assignment and authority
The user explicitly requested one worktree per Phase 2, 3 and 4 and handoffs directing each agent to finish the entire phase in one sustained pass, except user-owned work such as ReactVision Studio authoring. This packet prepares a worker assignment; no worker was launched by its creation.
Worktree: F:/ReactNativeApps/xr-showcase-i2Workspace/xr-showcase-phase-3-medical
Branch: phase-3-medical
Source repository: https://github.com/DavidJGrimsley/xr-showcase.git
Chosen task base: freshly fetched origin/main
Immutable base SHA: b09e4477f0da378b64c8ba9ed96e08b5febe6d45
Final-base default: origin/main (manifest defaultBranch: main).
PR provenance: one authoritative GitHub scan found no open/closed/merged PRs. No intermediate PR dependency or base is used.
Control repository: F:/ReactNativeApps/xr-showcase-i2Workspace/project
Control remote: git@github.com:DavidJGrimsley/xr-showcase-project.git
Canonical roadmap: [exact heading](F:/ReactNativeApps/xr-showcase-i2Workspace/project/todo.md:57); heading "Phase 3 — Medical Viewer And Product Flows".
The control info.md/todo.md have user edits and differ from the source copies. The exact tasks below are the immutable control snapshot; do not overwrite either roadmap to make them match.

## Exact selected unchecked roadmap tasks
- [ ] Implement Medical Viewer with the packaged CT-derived skull, plane placement and calibrated anatomy labels.
- [ ] Add bounded pinch/rotate gestures and reset placement; validate readability, loading errors and asset provenance on iPhone.
- [ ] Build the remaining core flows from `project/info.md` phase by phase.
- [ ] Adapt the working MVP flow for the remaining target platforms after the primary flow is stable.
- [ ] Configure EAS for building.

## Dependency evidence and readiness
The user confirms Phase 0 and Phase 1 are complete and pushed. The source checkout was clean and HEAD matched freshly fetched origin/main at the SHA above. The base contains the three thin product routes, entry screens, shared ARSessionBoundary with renderNavigator injection, permission/runtime/session controller, smoke navigator and session tests. Some roadmap boxes still show unchecked prerequisites; no roadmap reconciliation was performed and physical acceptance is not independently verified.
The selected tasks declare no dependency on an unmerged PR. These branches are independent siblings on the same base. Implement all available work without waiting for another phase's branch; do not assume sibling changes exist. Asset/device/Studio-dependent completion remains conditional as described below.

## Full-phase implementation goal
Implement the Medical Viewer scene, plane placement, loading/error/retry, bounded pinch/rotation, reset placement and calibrated label-anchor data. Use ARSessionBoundary's renderNavigator injection and preserve permission/background/route teardown. Add meaningful placement/gesture/reset/asset-validation tests.
The generic remaining-core-flows checkbox maps here to Medical Viewer only; Arena and Qubit belong to their own worktrees. Prepare Android-compatible code and configuration, but defer native Android acceptance until iOS is stable. Inspect existing eas.json and app config first and make only demonstrably necessary local changes; do not repeat completed EAS account/device work or trigger a cloud build.

## User-owned steps and dependency limits
The control roadmap explicitly defers the licensed CT-derived skull. The user supplies/selects the licensed final asset and provenance, confirms anatomical labels, and performs physical iPhone readability/placement/gesture acceptance. Prepare the asset-loading interface, provenance record requirements and anchor-calibration workflow now. A clearly labeled development proxy may support tests, but never label it CT-derived, anatomically calibrated or production-ready. If the final model is absent, keep asset-dependent completion pending and present a clear unavailable state. Do not purchase/license assets, fabricate provenance or author/publish Studio content. Android device acceptance and any cloud builds remain user steps.
Continue all independent work before reporting a blocker. If external work prevents full acceptance, deliver the complete available code, tests and exact remaining user checklist in this same pass. Do not mark the entire phase complete or claim missing assets/native acceptance are verified.

## Constraints and parallel ownership
Read AGENTS.md, project/info.md, project/style.md and project/guidelines.md first. AGENTS.md requires exact Expo SDK 57 documentation before code changes; use Expo overview and relevant task skills. Installed package types and authoritative Viro schemas/docs govern native APIs.
Own only this phase's feature/scene/controller/service/tests. Preserve the existing shared AR contracts, camera exclusivity, sessionId behavior, permission denial, background/resume and Home teardown. Prefer renderNavigator injection over shared edits. If a shared change is indispensable, keep it additive and minimal and explicitly report it for coordinator review; stop and request coordinator judgment for a cross-cutting contract redesign.
Do not modify sibling experiences, broad Home/navigation/theme behavior, canonical TODO wording/state/history, other phases, or release/branch-protection settings. Do not use the generic "remaining core flows" task to take over another worker's phase.
Keep keys out of source, public environment variables, logs, test output and screenshots. Never dump private configuration. No account/credential administration, public distribution, deployment, Studio publication, purchases, or hardware job submission is authorized by this handoff.
Use existing pins/lockfile. Do not force dependency downgrades/major upgrades to silence the recorded audit issues.
Do not auto-stash, abort Git operations, force checkout/push, delete Git internals, rebase siblings or merge into main. Stop on dirty surprise/conflict/lock and report intact state.
Recommended worker: Tier 3 — a capable high-judgment native TypeScript/AR agent selected by the user — phase-wide scene integration, state machines and external contracts exceed routine isolated Tier 2 work. qwen3-coder:30b is suitable for bounded routine substeps if available, not a substitute for unresolved contract/security judgment.

## Relevant files
src/features/medical-viewer/, src/app/medical-viewer.tsx, src/features/ar/, assets/, eas.json, app.config.ts or existing app config, tests/ar-session.test.cjs
Read project/info.md and project/guidelines.md for scope. Read project/setup-validation.md as historical setup evidence, not current device proof.

## Environment readiness
The default donor is F:/ReactNativeApps/xr-showcase-i2Workspace/xr-showcase-main. Environment discovery found no eligible .env/.env.* files outside excluded dependency/generated directories; no private environment bytes were copied. Do not infer a donor from workspace folders or read secrets to rediscover values. Any absent private runtime/build configuration requires private owner setup.

## Exact validation and completion evidence
Run from this worktree:
1. npm ci
2. npm test (lint/format, TypeScript and existing AR session tests)
3. Run the new meaningful phase tests; integrate their exact command into package scripts and record it in the completion report.
4. npx expo-doctor
5. npm run build:ios
6. MDS Doctor MCP doctor_scan_project(projectPath: "F:/ReactNativeApps/xr-showcase-i2Workspace/xr-showcase-phase-3-medical", mode: "ci", runScripts: true); fallback if unavailable: npm run mds:doctor:ci, recording the limitation.
7. git -C "F:/ReactNativeApps/xr-showcase-i2Workspace/xr-showcase-phase-3-medical" diff --check
8. git -C "F:/ReactNativeApps/xr-showcase-i2Workspace/xr-showcase-phase-3-medical" diff --stat b09e4477f0da378b64c8ba9ed96e08b5febe6d45...HEAD
9. git -C "F:/ReactNativeApps/xr-showcase-i2Workspace/xr-showcase-phase-3-medical" diff --stat origin/main HEAD
Refresh final-base evidence through the source checkout only when coordinating integration; never substitute the packet base for current final-base comparison. An unrun check is pending. JavaScript export, mock tests and schema previews do not prove native AR.

Deliver implementation commits on the assigned branch (never the source main), a separate project/agent/completions/phase-3.md report with exact changed behavior/files, test commands/results, base/HEAD SHA, remaining user actions, external blockers, shared-file changes and native acceptance status. Do not claim roadmap completion until coordinator verification and authoritative final-base merge/reachability; leave user-owned todo.md unchanged.
Complete the available phase end to end in one pass, fixing failures within scope and rerunning only affected checks. Do not stop after a stub, plan or the first checkbox. If genuine user work blocks acceptance, finish everything else and return the concrete user checklist.
