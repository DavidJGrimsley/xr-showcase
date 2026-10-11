# Immutable handoff: Phase 2 — Arena Fighter And Data Boundary
Created: 2026-10-08 (America/New_York). Do not edit this historical packet; write subsequent findings to a separate completion report.

## Assignment and authority
The user explicitly requested one worktree per Phase 2, 3 and 4 and handoffs directing each agent to finish the entire phase in one sustained pass, except user-owned work such as ReactVision Studio authoring. This packet prepares a worker assignment; no worker was launched by its creation.
Worktree: F:/ReactNativeApps/xr-showcase-i2Workspace/xr-showcase-phase-2-arena
Branch: phase-2-arena
Source repository: https://github.com/DavidJGrimsley/xr-showcase.git
Chosen task base: freshly fetched origin/main
Immutable base SHA: b09e4477f0da378b64c8ba9ed96e08b5febe6d45
Final-base default: origin/main (manifest defaultBranch: main).
PR provenance: one authoritative GitHub scan found no open/closed/merged PRs. No intermediate PR dependency or base is used.
Control repository: F:/ReactNativeApps/xr-showcase-i2Workspace/project
Control remote: git@github.com:DavidJGrimsley/xr-showcase-project.git
Canonical roadmap: [exact heading](F:/ReactNativeApps/xr-showcase-i2Workspace/project/todo.md:49); heading "Phase 2 — Arena Fighter And Data Boundary".
The control info.md/todo.md have user edits and differ from the source copies. The exact tasks below are the immutable control snapshot; do not overwrite either roadmap to make them match.

## Exact selected unchecked roadmap tasks
- [ ] Integrate the existing Studio Fight Arena scene using sceneId and documented native plugin configuration.
- [ ] Verify two fighters and idle/attack/hit/defeat clips/triggers; implement health, winner feedback and restart with an authoritative combat controller.
- [ ] Verify plane placement, model scale and restart behavior on iPhone; do not treat a published scene name as proof that combat works.
- [ ] Implement the initial data layer using local dummy data with Expo SQLite.

## Dependency evidence and readiness
The user confirms Phase 0 and Phase 1 are complete and pushed. The source checkout was clean and HEAD matched freshly fetched origin/main at the SHA above. The base contains the three thin product routes, entry screens, shared ARSessionBoundary with renderNavigator injection, permission/runtime/session controller, smoke navigator and session tests. Some roadmap boxes still show unchecked prerequisites; no roadmap reconciliation was performed and physical acceptance is not independently verified.
The selected tasks declare no dependency on an unmerged PR. These branches are independent siblings on the same base. Implement all available work without waiting for another phase's branch; do not assume sibling changes exist. Asset/device/Studio-dependent completion remains conditional as described below.

## Full-phase implementation goal
Integrate the existing Fight Arena scene a46c0453-e96b-4d66-8e4b-1f603e20a274 from ReactVision project f3eab820-8174-4b7b-a79e-854dab36e16a. Verify StudioSceneNavigator and native plugin props using installed Viro 3 types and authoritative documentation/schema tools. Reuse ARSessionBoundary's renderNavigator injection; mount exactly one navigator. Implement an authoritative combat controller, health, winner/restart feedback, native accessible controls, loading/retry and teardown. Inventory the available fighters, clips and triggers read-only if connected tools permit; a scene title is not proof of combat readiness. Write meaningful combat-state tests.
The SQLite task is a local dummy-data boundary only: reuse the retained src/services/local-data.native.ts adapter where practical. Do not create an unrelated product database, backend or additional flow. Record the task's limited role given project/info.md's no-new-app-database policy.

## User-owned steps and dependency limits
ReactVision Studio scene/model/animation/trigger authoring and publishing belong to the user. Do not edit Studio remotely. Prepare exact required clip/trigger names, their intended contracts and a concise Studio checklist. If authoring readiness cannot be verified, complete the surrounding controller/integration code with an explicit recoverable unavailable state; never invent real clips or imply combat is verified. The user supplies any missing licensed fighter assets and private Studio build credentials and performs physical iPhone placement/scale/restart acceptance.
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
src/features/arena-fighter/, src/app/arena-fighter.tsx, src/features/ar/, src/services/local-data.native.ts, tests/ar-session.test.cjs
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
6. MDS Doctor MCP doctor_scan_project(projectPath: "F:/ReactNativeApps/xr-showcase-i2Workspace/xr-showcase-phase-2-arena", mode: "ci", runScripts: true); fallback if unavailable: npm run mds:doctor:ci, recording the limitation.
7. git -C "F:/ReactNativeApps/xr-showcase-i2Workspace/xr-showcase-phase-2-arena" diff --check
8. git -C "F:/ReactNativeApps/xr-showcase-i2Workspace/xr-showcase-phase-2-arena" diff --stat b09e4477f0da378b64c8ba9ed96e08b5febe6d45...HEAD
9. git -C "F:/ReactNativeApps/xr-showcase-i2Workspace/xr-showcase-phase-2-arena" diff --stat origin/main HEAD
Refresh final-base evidence through the source checkout only when coordinating integration; never substitute the packet base for current final-base comparison. An unrun check is pending. JavaScript export, mock tests and schema previews do not prove native AR.

Deliver implementation commits on the assigned branch (never the source main), a separate project/agent/completions/phase-2.md report with exact changed behavior/files, test commands/results, base/HEAD SHA, remaining user actions, external blockers, shared-file changes and native acceptance status. Do not claim roadmap completion until coordinator verification and authoritative final-base merge/reachability; leave user-owned todo.md unchanged.
Complete the available phase end to end in one pass, fixing failures within scope and rerunning only affected checks. Do not stop after a stub, plan or the first checkbox. If genuine user work blocks acceptance, finish everything else and return the concrete user checklist.
