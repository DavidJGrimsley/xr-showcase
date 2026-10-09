# Arena CPU challenge follow-up

October 9, 2026. The user reports that Arena Fighter works in landscape and requested a worthy CPU opponent. This follow-up replaces the initial forgiving CPU timings and tactics. It retains the existing orientation configuration, native scene and assets.

Red now starts after a 0.3-second nearby opening beat, with a varied 0.144–0.252-second recovery after completed attacks or stagger. Recovery deadlines persist when fighters leave/re-enter reach. It targets a 7.7–8.1 cm spacing band, follows a retreating player, and backs away from point-blank pressure at the same 8 cm/s speed as Blue.

For evasions, Red observes a new visible attack clip and waits 0.2 seconds before reacting. It attempts to step just outside reach against uppercuts and two out of three punches, then closes and counters a miss with a quick punch. It can be caught before reacting, while attacking/staggered, at close range or when cornered. It does not inspect held controls or buffered player attacks. Attack selection favors quick counters and uses an available uppercut on its regular cadence, against a staggered player or for a 15-damage finish; 10-health finishes favor a punch.

Both fighters retain 100 health, 10/15 damage, manifest clip/hit timings, three-second uppercut cooldown, reach, movement limits, minimum separation and hit interruption. Simulation tests cover pressure cadence, recovery deadlines, delayed evasion/countering, close-range vulnerability, both starting sides, corner recovery, finishing choices, repeated attack buffering and tracking/Resume/rematch state. This is a TypeScript-only gameplay update; the existing development client can test it by reloading Metro.

The draft follow-up PR is based on `phase-2-arena` while the original arena PR remains open. MDS PR Checks now also runs for that base branch so the follow-up receives the same CI verification. Device balance and sustained rendering performance remain open checks in `arena-device-validation.md`.

Validation: 42 arena/controller/input/asset checks passed. MDS Doctor CI passed with score 99 and zero errors; lint, Prettier, TypeScript, all AR/Qubit/Medical/Arena test suites, Expo Doctor (21/21) and the iOS export passed. The seven React Doctor warnings in shared code and four intentional skips remain documented in the original completion report. `git diff --check` passed. The revised CPU has simulation coverage and awaits user feedback on the phone; no new native configuration or cloud build is required.
