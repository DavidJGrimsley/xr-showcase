# Arena Fighter — Reliable Contact and Defensive Counterplay

Implemented locally October 10, 2026 in `F:/ReactNativeApps/xr-showcase-i2Workspace/xr-showcase-phase-2-arena`, branch `arena-multiplayer`. No commit, push, deployment, native build, or Unreal source edit was performed for this revision.

## Combat and inputs

Punch damage is **8 HP**; Uppercut remains **15 HP**. Four Punches plus Uppercut remove **47 HP**. Fourth contact grants one counterable Uppercut, clears a queued regular Punch, and adds no extended defender stun.

| Rule | Fighter simulation time |
| --- | ---: |
| Grounded Punch flinch / defense lock | 200 ms |
| Counterpunch startup allowed | 350 ms after damage |
| Counterpunch input buffer | Final 150 ms of recovery |
| Guard startup | 100 ms after defense lock |
| Uppercut input deadline | 450 ms after fourth-Punch recovery |
| Regular-Punch rest | 600 ms after fourth-Punch recovery |
| Punch contact window | 0.300–0.367 s |
| Uppercut contact window | 0.480–0.547 s |
| Total contact tolerance | 1 mm |

Block accepts held intent throughout grounded Punch flinch and preserves it through further ordinary Punch damage. It raises when legal, subject to stamina/exhaustion, without draining stamina while pending. Release cancels intent; guard takes priority over a queued counterpunch. Block remains unavailable during the fighter's own attack. Lowering preserves its existing buffer rules without bypassing counterpunch recovery.

Jump Back requires a fresh press after the 200 ms lock; early presses are discarded. Travel, lift, preparation, landing, bounds, recovery, and vulnerability remain. One counterpunch buffers, starts on the first eligible simulation step, and clears on further damage or interruption. Holding an attack never repeats it.

Uppercut can reserve during fourth-Punch recovery, consumes once, and retains queue priority. Movement, hopping, or a counterpunch can defeat it. Damage clears combo progress and the opportunity; consuming/losing the opportunity does not erase Punch rest. CPU uses shared restrictions, with visible reactions, occasional guard/evasion/counterpunch, circling, opening delay, and varied recovery.

## Contact and assets

`scripts/arena-contact-bake.py` skins the repaired GLBs and bakes all **33 clips at 60 Hz**. Body boxes fit posed mesh groups by dominant joint. The cuboid head uses fighter-local axes; other parts follow joint axes. Mike's gauntlet spans skin weights: its striking box fits hand vertices plus the distal 17.5 mm of forearm vertices, excluding the elbow/upper arm. The baker verifies identical positions, weights, joint assignments, and animation samples for both colors.

`arena-contact.ts` interpolates fitted boxes, applies facing and host-owned X/Z/lift, and sweeps relative motion through 240 Hz pose slices using continuous translation separating-axis tests. Broad-phase bounds derive from these volumes. Center distance/cones no longer reject intersecting volumes; captured attack facing still allows circling to evade. Contact occurs once per attack, simultaneous candidates resolve together, and impact events carry contact X/Y/Z. Guard outcomes, launch/landing immunity, hitstop, sounds, and deduplication remain.

These are fitted boxes, not per-triangle collision. Device review must assess tight head/gauntlet corners and fast transitions.

The derived packs append `HitFrontFast`: HitFront retimed to 200 ms, with its final 50 ms blended to IdleAggro's start. Original HitFront remains for launch/landing. All earlier 32 clips, geometry, textures, repaired skinning, original GLBs, archival manifest, and WAV hashes remain intact. No dependencies or haptics were added.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| Mike_Player1_Blue_Combat_AR.glb | 19,978,136 | `ac3afd1fa615a2ea5b34de72f22a5780a158369e7b425d619dfcc5cd3b69833f` |
| Mike_Player2_RedOrange_Combat_AR.glb | 19,087,388 | `a8436e15934cfc82c0f1bbc8c10b63d07289b9787656d5ffcfcf49a362bd7ba5` |
| combat-collision-data.json | 4,056,398 | `d2c0cb91e8b18fcb5076f014ec6d74c95618690f601a39326e1f1a981f231d4f` |

Current fighters plus the unchanged arena total 45,648,736 bytes. Pose data increases the Hermes export from approximately 6.3 MB to 9.3 MB; physical memory and sustained cadence require measurement.

## Controls, protocol, lifecycle, and presentation

All seven rectangles, labels, safe-area anchors, reserved progress row, and guard meters are preserved. Punch, Uppercut, Block, and Jump Back publish independent input acceptance. Held intent and buffered/pending commands receive press feedback without moving controls.

**Protocol/invites are version 7.** Six and older are rejected. Snapshots add pending Block, buffered counterpunch, defense lock, Punch recovery/rest, and separate Punch/Uppercut availability. Host validates and executes actions. Repeated pending counterpunch submissions are suppressed; distinct ordinary start/follow-up presses and ordered guard commands remain coalescible. Sequence, acknowledgment, epoch, stale-command, interpolation, duplicate and remount protection remain.

Portrait freezes timers, rewards, motion, and presentation. Genuine interruptions clear intent, buffers, rewards, and grounded attack recovery, while preserving remaining Punch rest and airborne/exhaustion recovery. Round/rematch resets clear new state.

Victory remains: finish opponent knockout, play both complete calibration stretches, then VictoryUppercut; reveal results only after the complete sequence and both devices' presentations. AR placement, transforms, arena size/bounds/separation, and the unrelated `src/uniwind-types.d.ts` change were retained.

## Preview evidence and reproduction

The development-only collision overlay runs through the existing Blender preview tool, outside the native scene. Green shows body boxes; orange shows the gauntlet. Reviewed 24 renders: both hands, frontal contact, mirrored 25-degree side contact, mirrored 80-degree off-path miss, and close Uppercut contact from front, overhead, and three-quarter views. Eight fast-reaction renders cover 50/100/150/200 ms from two views.

- [Left-hand contact views](arena-contact-previews/contact-sheet-L.png)
- [Right-hand contact views](arena-contact-previews/contact-sheet-R.png)
- [Fast reaction views](arena-contact-previews/fast-reaction-sheet.png)
- [Render scenarios](arena-contact-previews/contact-renders.json)

Use bundled numpy Python to run `scripts/arena-contact-bake.py`. It stages packs in `.expo/arena-contact`, appends HitFrontFast only when absent, and checks preserved payloads and both colors. Render with Blender:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.0/blender.exe' --background --python scripts/arena-defense-preview.py -- --stage .expo/arena-contact --contact
& 'C:/Program Files/Blender Foundation/Blender 5.0/blender.exe' --background --python scripts/arena-defense-preview.py -- --stage .expo/arena-contact --reaction
```

After reviewing, save `previews/contact-inspection.json` with staged pack hashes and collision SHA, then run the baker with `--package`. Format the supplemental animation manifest afterward. Collision JSON stays compact under `.prettierignore` to retain its bake hash. Do not use the older defense packager alone and omit the reaction clip.

## Validation

- **288 Arena tests passed.** Added pressure escape, pending/released guard, 200/350 ms timing, lowering/guard priority, buffer invalidation/expiry, fourth-hit rest/deadline, counterable finisher, interruptions, both hands/sides, side contact/off-path miss, relative sweeps, airborne lift, and single-contact coverage. Existing stamina, hop, bounds, simultaneous launch/draw, CPU, feedback, and result gates pass under revised behavior.
- Multiplayer additions cover host rejection with acknowledgment, synchronized pending guard/counterpunch, coalesced release/order, repeated commands, and required version-7 fields. Existing packet duplicates, remount feedback, flight/position/facing/stamina, lifecycle, and presentation checks pass.
- Asset tests verify original hashes, all earlier animation sample hashes, collision coverage/hashes, fast reaction's Idle endpoint, independently skinned source head poses for both hands/colors, and sound bytes/format.
- **Full suite: 433 tests passed** — 288 Arena, 14 AR, 108 Qubit, 23 Medical. `npm test` includes passing lint and typecheck.
- iOS JavaScript export passed: 2,655 modules, 36 assets, approximately 9.3 MB Hermes bundle.
- `git diff --check` passed. Existing Node module-type notices remain.

Logs: `.expo/arena-contact-{tests,full-test,typecheck,lint,export-ios}.log`.

## Physical iPhone acceptance — pending

1. Check both Punch/Uppercut hands while circling both directions, at visible range and arena boundaries. Compare gauntlet/body overlap against flashes, sound, HP, and off-path misses. Check hop/settling contact and launch immunity.
2. Hold Block immediately after damage. Verify its short flinch/startup, follow-up protection, preserved startup intent, release cancellation, stamina, and exhaustion behavior.
3. Press Jump Back before/after the lock. Early taps must not hop later; timely fresh taps should escape with space, remain vulnerable, stop at bounds, and settle smoothly after contact.
4. Buffer one counterpunch using multitouch with movement/Block. Check accepted feedback, no hold repetition, lowering timing, unchanged control positions, large-text fit, and both landscape orientations.
5. Tap Punch continuously through four contacts. Assess the rest, short Uppercut cue, counter/guard/circle/hop choices, reaction readability, and finisher feel under actual touch/playback latency.
6. Check hitstop lengths, sound timing, reduced-motion flashes, native transitions, complete two-stretch + finisher, and no early result text.
7. Test portrait, tracking loss, background/reconnection, and rematch for freezing versus clearing, including remaining rest/flight/exhaustion.
8. Play at least two minutes in a bundled build; record device/build, FPS/cadence, memory, thermal behavior, stalls, and animation/network timing. Pose data requires physical sustained-performance review.

The existing relay TLS/routing failure remains separate. Simulated multiplayer does not establish two-phone acceptance. Both phones require matching protocol-7 builds for physical multiplayer validation.
