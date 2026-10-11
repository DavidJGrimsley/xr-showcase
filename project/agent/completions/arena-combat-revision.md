# Arena combat rewards and impact revision

October 10, 2026. Implemented locally on the existing `arena-multiplayer` branch in `F:/ReactNativeApps/xr-showcase-i2Workspace/xr-showcase-phase-2-arena`. This record supersedes the combat rules and cooldown/control expectations in earlier Arena completion records, including `arena-combat-position.md`. Existing AR placement, shared frames, arena transforms, models and archival manifest remain unchanged. The pre-existing generated-file change was left alone. No dependency, native configuration or haptic behavior was added; this delivery does not commit, push or merge the branch.

## Combat behavior

Each fighter earns an Uppercut by connecting four punches. Attack start, misses and idle time do not advance or erase partial progress. Taking damage clears progress, an earned opportunity and buffered attacks. CPU and both humans use the same controller rules. Punch hands remain independently random at actual attack start; Uppercut hands alternate when an Uppercut actually starts.

The fourth contact makes Uppercut available immediately, including during that punch's recovery. An accepted Uppercut reserves and consumes the opportunity, resets progress, and replaces a queued Punch. Repeated requests and all unearned requests are rejected. Expiry occurs one configurable second after the fourth punch finishes recovery. Fighter time, including this window, pauses during hitstop and portrait holds. Fourth-hit stun is derived from the remaining punch recovery plus the reward window, 0.48-second Uppercut startup and one 60 Hz simulation step. Expiry without consumption also clears the completed counter.

Punch impact stays at the manifest's 0.30-second time and Uppercut impact at 0.48 seconds. An Uppercut steps forward up to 3 cm between 0.10 and 0.40 seconds, bounded by the existing arena limits and 5.5 cm minimum separation. Punch contact range stays 8.5 cm; Uppercut contact range starts at 6 cm. Both fighters' motion is applied before contact eligibility, and all hits due in a step are collected before damage/stagger resolution.

Every connected Uppercut launches its target through the shared 0.8-second parabolic arc with an 18 cm apex. Nonlethal targets land at floor height, restart grounded HitFront for its full recovery, then return to combat. Lethal targets land into Defeat and DefeatedLoop. Launch and landing reject movement, attacks and additional damage. A surviving winner struck by a simultaneous Uppercut launches before Victory; simultaneous lethal hits remain a draw.

The winner waits in IdleAggro until their own flight and the opponent's complete knockout finish. Once the opponent settles into DefeatedLoop, the winner plays the unchanged 2.3-second Victory dance twice, using a distinct animation command for each play. Local presentation time begins only after the renderer applies each command. Outcome text, the score result and Match complete stay hidden through both plays; multiplayer results also wait for both devices' completed presentations. Portrait holds freeze the celebration. Renderer recreation restarts the current clip without adding a third complete dance. Draws settle without a Victory clip.

The middle CPU retains its 0.5-second opening beat, 0.27-second reaction to a visible attack, and varied 0.32/0.40/0.56-second recovery. It approaches roughly 7 cm, retreats for spacing below 6 cm, and attempts occasional visible-attack evasion on every fourth observed threat. It prioritizes an earned Uppercut after a 0.2-second reaction beat while its target is grounded. It does not read held controls or queued attacks.

## Controls and confirmed-contact feedback

All four controls use fixed geometry for the current viewport and font scale: 108 × 56 pt by default with 12 pt gaps and safe-area anchors. Larger text uses stacked groups. Raw touch controls preserve independent movement fingers, issue an attack on touch-down, and show a press state. Holding an attack does not repeat it. Punch and Uppercut labels stay constant. Uppercut stays visible and disabled until earned, with a secondary-color glow on an absolute, non-interactive layer. A fixed-height row beneath the attacks shows only `x/4`; its height is determined by font scale, never combat state.

Confirmed contacts produce a small, single flash and host-controlled fighter hitstop: initially 35 ms for punches and 70 ms for Uppercuts, configurable in `ARENA_RULES`. Only fighter simulation and native fighter animation pause; networking, touch collection, the Viro game loop and AR tracking continue. Reduced motion uses a subdued flash. Guest transforms stop at the authoritative contact pose during hitstop, interpolate airborne lift with horizontal motion during flight, and settle directly to grounded lift for landing.

Mike's three original WAVs were copied without changing their Unreal sources. Right punches play `punch_01.wav`, left punches `punch_02.wav`, and Uppercuts `punch_03.wav`, using existing ViroSound at volume 0.8. Six paused sound instances cover simultaneous contacts on both fighters. Sound errors do not block combat. Asset provenance, lengths and hashes are recorded in `assets/arena/README.md`.

The control anchoring and press feedback follow [Apple's game-interface guidance](https://developer.apple.com/videos/play/wwdc2024/10085/). Hitstop and coherent sound are initial tuning candidates informed by the [impact-feedback study](https://arxiv.org/abs/2208.06155), which identifies them as influential features; the study does not establish these specific durations as optimal. Playback uses the documented [ViroSound pause, volume and seek API](https://viro-community.readme.io/docs/virosound), checked against the installed Viro 3.0.3 implementation.

## Multiplayer and lifecycle

Protocol and invite version advance from 3 to 4. Snapshots remove cooldowns and include landed-punch progress, Uppercut availability/window, launch/landing mode and elapsed time, unique impact identity/kind/hand, and authoritative impact-pause state. The host validates rewards and commands and owns damage, stepping, flight, landing and expiry. The guest suppresses additional Uppercut submissions while one awaits acknowledgment. Existing stale-command, serial, epoch and acknowledgment guards remain intact. Reload both clients and create a fresh invite; earlier versions are rejected.

New impact transitions bypass normal 20 Hz replication pacing. A cursor owned by the match consumes each fighter's impact identity once, surviving renderer recreation. Duplicate packets and repeated consumption cannot replay flash or sound. Genuine tracking, app or connection interruptions clear progress, opportunities and pending attacks while preserving the remaining logical flight/landing state. Portrait holds preserve progress, opportunities, queued follow-through, flight and presentation time; stable landscape recovery still gates resumption. Knockout, round advancement and rematch clear rewards and pending inputs.

## Automated validation

| Check | Result |
| --- | --- |
| `npm run test:arena` | 163 passed, zero failed |
| `npm test` | Lint/Prettier, TypeScript and all 308 tests passed: AR 14, Qubit 108, Medical 23, Arena 163 |
| `npm run build:ios` | JavaScript export passed; all three GLBs and all three WAVs included |
| `git diff --check` | Passed |
| Source/packaged WAV comparison | SHA-256 matches for all three copies |
| Existing models and manifest | All original byte lengths and SHA-256 hashes pass |

Controller regressions cover contact counting, miss/time preservation, damage resets, reward timing/expiry, buffer priority, single consumption and unearned rejection. Maximum-range late follow-through is checked for both fighters, both punch hands, both Uppercut hands and swapped sides. Other cases cover bounded steps, nonlethal/lethal flight, grounded recovery, immunity, simultaneous launches/draws, a launched winner, and both launch and landing interruption. Isolated pre-earned fixtures exercise simultaneous resolver cases without changing production reward rules.

Match/transport tests cover forged requests, synchronized rewards and flight, acknowledgment and duplicate/coalesced input, impact deduplication and immediate writes, guest contact-pose freezes, portrait holds, interruption/recovery, stale generations, compatibility and the existing two-device presentation gate. Celebration regressions cover grounded and launched knockouts on both sides, two separate complete Victory commands, delayed renderer acknowledgment, renderer recreation during the second play, portrait holds and a delayed guest blocking results. HUD tests render the actual component with native/runtime doubles and inspect control dimensions, constant labels, counter-row height, anchored margins, absolute glow and independent touch handlers at normal and larger text, and confirm result text is absent until the second dance finishes. Sound tests verify packaged WAV hashes and PCM format. These tests do not render native Yoga/Viro or measure device audio, appearance or performance.

Node's existing module-type warning and Metro's color-environment warning are non-fatal. No package metadata was changed to silence unrelated warnings.

## Physical iPhone acceptance: pending

Use the current worktree's Metro bundle with the existing installed Viro development client. No new native dependency requires a rebuild for this revision. Record device/iOS/build IDs, text size, landscape direction, thermal/power state, network conditions and a screen recording. On each phone, check:

| Check | Expected observation | Result |
| --- | --- | --- |
| Actual control rectangles | Measure default 108 × 56 pt targets and 12 pt gaps. Bounds stay fixed across 0–4 progress, glow, reservation, disabled state, hit, launch and landing. Both landscape directions and large text remain reachable inside safe areas. | Pending |
| Touch feedback and multitouch | Touch-down highlights and attacks once. Hold Advance/Retreat while tapping either attack with another finger; release/cancel each independently. Holding an attack never repeats. Check two movement fingers and mixed touch batches. | Pending |
| Reward timing | Four visible contacts earn the glow immediately. Buffer during fourth recovery, replace a queued Punch, and try a late follow-up near expiry. Misses preserve partial progress; damage clears it. | Pending |
| Visible contact | Check PunchL/R and UppercutL/R for blue/red and both starting sides, including maximum punch spacing, arena corners and an evading CPU. The step must look deliberate and contact must correspond to the pose/flash. | Pending |
| Nonlethal launch and landing | Confirm every landed Uppercut flies through the complete arc, settles on the floor, plays grounded HitFront once, then regains control. Inputs and extra damage remain blocked throughout flight/recovery. | Pending |
| Knockout and simultaneous hits | Lethal Uppercut lands into Defeat/DefeatedLoop. A struck surviving winner lands before celebrating. Draws and both devices' completed presentations gate results/rematches. | Pending |
| Victory timing and results | Winner waits until the opponent finishes Defeat and settles into DefeatedLoop, then plays Victory twice (2.3 seconds per play). No victory/result text appears during either play. Results/rematches appear after the second play and, in multiplayer, after both devices finish. Check portrait holds and camera recreation during both plays. | Pending |
| Impact pause | Compare 35 ms Punch and 70 ms Uppercut pauses for weight and responsiveness. AR view/tracking and touch collection continue. Repeated contacts should not visibly restart old clips or hitch networking. | Pending |
| Flash and reduced motion | Check single flashes at the contact point, subtle brightness, no cycling/pulse, and subdued flashes with Reduce Motion enabled. | Pending |
| Sound timing | Confirm the right/left/Uppercut file choices at volume 0.8, silence on misses/rejected inputs, one sound per impact, and coherent timing with the flash/contact pause. Check rapid same-hand and simultaneous contacts, load delay, mute/audio route and background/resume. | Pending |
| Lifecycle | Rotate during a reward, reserved follow-up and flight. Obscure tracking or background during flight and landing; recover and Resume without renewed damage or reward. Recreate the renderer and confirm old feedback does not replay. | Pending |
| Sustained performance | Play at least two minutes with both unchanged fighter packs and the 200,000-triangle arena. Record average Viro frame cadence, stalls and thermal state; target at least 30 FPS. Compare CPU cadence and counterplay. | Pending |

The assets contain no dedicated airborne or landing clip. Procedural lift uses HitFront, then restarts HitFront grounded for nonlethal landing; assess pose continuity, held final poses and recovery after renderer teardown on the actual device before accepting the visual result. JavaScript export is not a native iPhone acceptance test.

The previously documented relay TLS/routing failure remains a separate unresolved limitation. Simulated transport tests cannot establish successful two-phone acceptance, real latency or shared-anchor accuracy. Retain the [relay incident report](../handoffs/2026-10-09-arena-relay-incident.md) and perform the two-phone checks in `arena-multiplayer.md` when a working official relay is available. This revision does not claim to resolve that service failure.
