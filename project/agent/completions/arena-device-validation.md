# Local arena physical acceptance record

Prepared October 9, 2026. **Status: initial user gameplay feedback received; structured physical acceptance remains pending.** The user reports that landscape Arena Fighter works and the initial CPU is too easy. This confirms the reported orientation problem was withdrawn; it does not establish measured FPS or every visual/lifecycle check below. Automated checks and the JavaScript export are recorded separately in `phase-2-local-arena.md`.

Follow-up: the user reported the first stronger CPU was much too difficult. The current middle-difficulty tuning, multiplayer native build requirements, rounds, knockout gates and two-phone acceptance checklist are recorded in [arena-multiplayer.md](arena-multiplayer.md). That report supersedes the CPU timing and Studio-credential statements below for the new multiplayer feature; this file retains the earlier solo acceptance history.

October 10 combat follow-up: [arena-combat-revision.md](arena-combat-revision.md) supersedes the historical punch cycle, cooldown, ordinary-uppercut, control, interruption and single-Victory expectations below. [arena-defense-circling.md](arena-defense-circling.md) records guard, Jump Back and circling. [arena-victory-uppercut.md](arena-victory-uppercut.md) records the final celebration: opponent knockout, two full calibration stretches, then one big VictoryUppercut. Result text stays hidden until the whole sequence finishes on both devices. Structured physical acceptance remains pending.

## Build and device

The existing installed development client must be rebuilt for the new native orientation configuration. From `xr-showcase-phase-2-arena`, the configured physical-device profile is `development`: `eas build --platform ios --profile development`. The pull request and EAS build record track cloud build status. Install the resulting client on the registered iPhone, then start this worktree's Metro server with `npm start`. Expo Go does not provide this Viro runtime.

Record device model, iOS version, build identifier/date, Expo SDK, Viro version, testing date, power/thermal state and any screen recording. Current project dependencies are Expo 57 and ReactVision Viro 3.0.3. For development, Metro serves the checked-in GLBs; a bundled app uses its packaged assets. Studio publication and credentials are unnecessary.

## Required checks

| Check | Expected result | Observed result |
| --- | --- | --- |
| Enter Arena Fighter / Home / other routes | Arena is landscape; other routes return to portrait. Home stays reachable at both landscape orientations. Camera ownership is released. | User reports Arena landscape entry works. Other navigation/camera checks pending. |
| Permission denied / Retry | Existing shared permission and recoverable error UI remains usable. | Pending |
| Plane placement | Tap a horizontal surface at least 60 cm across. Arena base rests on it, longest dimension is about 60 cm, fighters are about 12 cm tall and feet meet the arena floor. | Pending |
| Setup | Swap sides and Rotate 90° work before Ready. Ready waits for all three models and 0.5 s of normal tracking. | Pending |
| Blue and red visuals | Skinning stays intact; colors, lenses and LEDs match the repaired source models. No giant triangles or missing mesh parts. | Pending |
| Clip tester, both fighters | Before Ready, open Test fighter clips. Validate IdleAggro, WalkForward/Backward, Combo_PunchL/R, Combo_UppercutL/R, HitFront, Defeat, DefeatedLoop, Victory and VictoryUppercut; all 32 names, including the guard and JumpBack clips, are selectable. Close the tester before Ready. | Pending |
| Repeated clips and interruptions | Consecutive left punches restart visibly. Hits interrupt attacks. After tracking loss, Resume restores idle without completing a canceled attack. | Pending |
| Hold controls | Hold Advance and Left/Right; release to stop. Opposite circle directions cancel. Jump Back fires once per touch-down. Hold Advance while tapping Punch/Uppercut with another finger: movement pauses during the clip and resumes while still held. | Pending |
| Combat | Jab sequence L,L,R,L,R,R; independent alternating uppercuts; 8/15 damage; three landed, unblocked punches earn one Uppercut window; misses preserve progress; damage resets it. Guard and hop restrictions apply; only one next action buffers. | Pending |
| CPU challenge | Red maintains spacing, pressures with shorter recovery, occasionally guards visible punches after 150 ms, evades Uppercuts after 270 ms when free, circles during recovery and counters misses, and fights when cornered. Close punches, baiting and interrupted attacks remain valid counterplay. | Initial CPU reported too easy; revised behavior awaits device feedback. |
| Phone view independence | Walk around the arena and change phone viewing angle. Movement stays in the arena-local X/Z plane, with Advance, Left/Right and Jump Back relative to the opponent; attacks lock facing. | Pending |
| Finishing punch / uppercut | Punch defeats on the floor. A lethal uppercut launches the loser through a 0.8 s arc peaking 18 cm above the floor, then lands and defeats them. Every connected Uppercut launches; nonlethal targets land through HitFront recovery. | Pending |
| Outcome / Rematch | Opponent knockout finishes before the winner plays Victory twice, then VictoryUppercut, then idle; loser settles to DefeatedLoop. Rematch waits for the presentation, resets combat and retains placement. | Pending |
| Tracking interruption | Obscure the camera or leave the tracked area. Simulation and native playback freeze; held/buffered input clears. After stable tracking, explicit Resume is required. Health, position, flight/settling and exhaustion recovery remain; rewards and queued input clear. | Pending |
| Background / Replace arena | Background during an attack, return, place again and Resume. No delayed damage. Replace arena preserves the round but requires new placement/assets. Completed outcomes return in settled poses. | Pending |
| Dynamic Type / safe areas | Health, outcome, Home, setup and combat controls remain readable and reachable at large text sizes and on both landscape sides. Touch targets are at least 44 pt. | Pending |

## Sustained performance

Test both full fighter packs together with the unchanged 200,000-triangle arena: approximately 257,860 model triangles total. Play multiple rounds for at least two minutes, including walking, hits and finishing launches. Target at least 30 FPS sustained. Record elapsed test time, average frame rate, noticeable stalls, thermal changes and memory pressure.

The development HUD shows average Viro game-loop frame cadence and sampled frame count during combat/presentation or clip preview. Waiting and paused periods are excluded; Retry resets sampling. This is an observation aid, not a GPU profiler or proof of device performance. Supplement with native profiling when available and confirm performance in a bundled build.

| Device/build | Duration | Frame cadence | Stalls / thermal behavior | Result / required optimization |
| --- | --- | --- | --- | --- |
| Not tested | — | — | — | Pending |

No asset optimization was performed in this implementation. If measurement misses the target, record the bottleneck and proposed optimization here before changing the verified assets or their hashes.

Current guard, Jump Back and circling acceptance details are in `arena-defense-circling.md`; all physical checks remain pending.

## Reliable contact and counterplay follow-up

[arena-contact-counterplay.md](arena-contact-counterplay.md) supersedes the historical full grounded-hit lock and fourth-hit extended stun. Regular Punch damage is 8 HP, grounded defense unlocks at 200 ms, one counterpunch can buffer during the last 150 ms before 350 ms recovery, and Uppercut remains counterable. The fourth-hit opportunity lasts 450 ms after recovery, with a separate 600 ms Punch rest. Protocol/invites are version 7.

Physical contact, reaction readability, held Block responsiveness, timely Jump Back, multitouch, sound/impact pause, memory, sustained frame cadence, and two-phone acceptance remain pending. The supplemental 60 Hz pose data increases the Hermes export to about 9.3 MB; record memory and thermal behavior during the sustained test.

## Current UI and three-hit follow-up

[arena-ui-refresh.md](arena-ui-refresh.md) supersedes the historical Home, clip-preview and FPS overlays above. Use the persistent Back action and minimal placement controls. Ordinary round victories use one calibration stretch; match victories, including one-round matches, use two stretches and VictoryUppercut. Uppercut now charges on the third landed, unblocked punch and shows `3/3`. Its recovery and availability timing remain unchanged. Protocol 10 requires both phones to use the updated build. Check the full title on round selection and multiplayer join, the labeled startup screen, three-hit charging, and both celebration lengths on devices; physical acceptance remains pending.
