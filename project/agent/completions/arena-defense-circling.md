# Arena Fighter: guard, Jump Back and circling

Follow-up: [arena-victory-uppercut.md](arena-victory-uppercut.md) adds the big Uppercut after both stretches. It supersedes this report's earlier two-play finale, protocol 5 and 31-clip package hashes. The eight defense animation samples remain unchanged; validation results below record the initial defense delivery.

Implemented locally on October 10, 2026 in `xr-showcase-phase-2-arena`, branch `arena-multiplayer`. This document supersedes the previous combat round's movement and defense notes. Existing AR placement, arena dimensions and setup transforms remain unchanged. No dependencies or haptics were added. The unrelated generated-file change remains untouched.

## Combat behavior

Held Block raises the guard in 100 ms. Frontal punches are absorbed with no health damage, defender combo reset, attacker combo credit or fourth-hit stun. Uppercuts break through and launch normally. Guard drains 15 stamina/second and costs 30 per blocked punch, from a capacity of 100. The exhausting punch is absorbed; guard drops for 650 ms and needs a release and fresh press. Grounded, unguarded stamina regenerates at 35/second after a 600 ms delay. Raising guard requires 25 stamina. Regeneration also applies during grounded attack/landing recovery once the guard delay has elapsed; hopping pauses it during flight without adding a guard delay. Actual damage still clears punch progress and earned rewards.

Block is rejected during attacks, hit recovery, launches, landing, hops and exhaustion. Holding guard rejects attacks and Jump Back; Advance and circling run at 40% speed. Releasing plays a 100 ms lowering transition with one attack or hop buffer. An earned Uppercut can replace a buffered Punch and is reserved once. A buffered hop is not replaceable. Guard never extends the existing Uppercut expiry. Derived fourth-hit stun includes the maximum guard-lowering buffer delay, Uppercut startup and a simulation-step margin.

Jump Back is one command per touch-down, with captured backward facing, at most 6 cm travel, 2.5 cm lift, 400 ms total duration and 250 ms recovery. Preparation and landing each last two frames at 30 fps; flight lasts eight. Travel uses cubic ease-out during flight. Circular boundaries clamp its straight path; less than 1 cm available travel rejects it. It cannot steer, attack or block and grants no invulnerability. Punch contact stops travel, settles existing lift for 100 ms, then starts full grounded HitFront or Defeat. Uppercut contact launches from the current lift. The hop clip continues during punch settlement instead of restarting its takeoff. A hop buffered during guard lowering keeps its accepted direction and starts travel from the position at the end of lowering.

Held Left/Right orbit the opponent independently of the phone. Opposite inputs cancel; combining Advance and circling spirals inward at a capped 8 cm/second. Both fighters' moves and Uppercut steps resolve from the same preceding positions, inside a 14 cm radius with 5.5 cm separation. A stationary opponent is never pushed. Free fighters face the opponent; attacks capture and hold facing. Punch/Uppercut contact cones have 20°/30° half-angles, with the existing 8.5 cm/6 cm contact ranges and 300 ms/480 ms contact times. Uppercuts retain their 3 cm startup step and 800 ms, 18 cm launch.

The CPU retains its opening delay and varied recovery, uses occasional visible-punch guarding after 150 ms and legal Uppercut hop evasion after 270 ms, and alternates short circling beats during recovery. Shared restrictions and stamina apply, including fourth-hit stun; an earned Uppercut takes priority.

## Controls, feedback and synchronization

Seven independently tracked controls use curved `rotate-left`/`rotate-right` icons with constant Left/Right labels above Jump Back/Advance. Block sits above Punch; Punch/Uppercut occupy the bottom pair. Default targets are 108 × 56 pt with 12 pt gaps. Larger text uses two stacks when height permits and the grid on short viewports, retaining at least 44 pt targets. Geometry depends on viewport, safe areas and font scale only. The `x/4` row, two guard meters and the absolute Uppercut glow have reserved geometry.

Blocked contact has a small cool-colored flash, configurable 20 ms host hitstop and the existing hand-selected punch sound at volume 0.4. Damage retains its existing 35/70 ms pause and volume 0.8. Reduced motion uses one subdued flash. Networking, input collection and AR tracking continue during fighter hitstop. Impact IDs are deduplicated across repeated packets and renderer remounts.

Protocol and invites are version 5; version 4 and earlier are incompatible. Block-down, Block-up, Jump Back and attacks share ordered, acknowledged commands with epoch, round and stale-command protection. Guests suppress repeated pending hops and Uppercuts. The host validates all movement, facing, guard, stamina, damage and motion. Snapshots carry X/Z, yaw, lift, guard state/stamina/recovery and hop/settling elapsed state. Guests interpolate X/Z, lift and free yaw; committed facing follows the host immediately.

Portrait freezes stamina, reward timers, motion and presentations without creating a new epoch. Held controls clear; a held guard lowers after the hold ends. Genuine interruptions clear rewards and queued commands while preserving remaining hop, flight, settling and exhaustion recovery. Rematches restore full stamina. Knockout descriptors preserve interrupted lift and settlement. The opponent finishes knockout before Victory plays twice; results stay hidden until both plays and both devices' presentations finish.

## Animation assets and evidence

Eight new AnimSequences are saved under `/Game/Quasicombo/Mike/Arena` in the authorized open Unreal project: BlockEnter, BlockHold, BlockExit, BlockHit, BlockAdvance, BlockStrafeLeft, BlockStrafeRight and JumpBack. `Project/ArenaDefenseAuthoring.py` bakes them in place from read-only Mike sources; `Project/ArenaDefenseInspect.py` records the source-track inspection. Both Uppercuts provide fist/wrist references, while separately authored raised arms hold a breathing pose. Movement combines those arms with source leg gait. The hop retimes JumpStart, JumpApex and JumpEnd; app motion owns whole-body lift and travel.

All **105 RadicalMike source `.uasset` files** retain their original SHA-256 hashes. The two previously modified Unreal project paths are preserved. Original fighter packs, arena GLB and archival manifest retain their exact hashes. Derived packs append eight clips to the original 23 while preserving the entire original binary prefix, mesh/skin/material/image structures, original accessors and animation samples. App references use the new packs statically through Metro.

| Derived file | Bytes | SHA-256 |
| --- | ---: | --- |
| Mike_Player1_Blue_Combat_AR.glb | 19,453,620 | `1e3b41e311b3fa49ff8deff87192c1c5b284081801be8a26be6531e4db155716` |
| Mike_Player2_RedOrange_Combat_AR.glb | 18,562,872 | `9082d579326decf10c38bbd08364dc4576359f30b7edcd34f4c9f3b8a1f03023` |

The supplemental `assets/arena/combat-animation-manifest.json` records durations, loop flags, source paths, source export/sample hashes, original hashes and preview inspection. Each appended clip's 258 channels matches its Unreal export byte-for-byte. `scripts/arena-defense-pack.py` stages and verifies packs, then requires a current preview inspection before packaging. `scripts/arena-defense-preview.py` rendered 14 front/three-quarter views across guard, all guarded movement variants and three hop stages. All were inspected before packaging. Selected renders are retained in `arena-defense-previews/` beside this document; these are Blender appearance checks.

## Automated validation

- Arena tests: **228 passed**, including real HUD touch handlers/geometry, guard lifecycle, blocking and combo preservation, Uppercut breakthrough, hop contact/settlement, both sides, circular movement and committed cones, simultaneous movement and launches, CPU defense, ordered/coalesced commands, duplicate feedback, interruptions, protocol incompatibility, asset/sample hashes and sound packaging.
- Full existing suite: **373 tests passed** (AR 14, Qubit 108, Medical 23, Arena 228).
- Lint and typecheck: **passed**, with no lint warnings. The existing Node test-runner module-type notices remain unchanged.
- iOS JavaScript export: **passed**, 2,653 modules and 36 packaged assets, including both derived fighter packs and all three WAVs.
- `git diff --check`: **passed**.

## Physical iPhone acceptance — pending

Record device, iOS/build versions, landscape side, font scale, thermal/power state and recording. Test a bundled build as well as Metro. The existing launch/landing HitFront transitions have no dedicated airborne/landing asset and need actual device assessment.

| Check | Expected observation | Status |
| --- | --- | --- |
| Button rectangles | Seven stable targets in both landscape orientations; safe-area anchors, constant labels, no glow/progress/stamina layout shifts. Large text fits short viewports. | Pending |
| Multitouch | Guard + Advance or either circle; two movement fingers; independent attack finger; releases/cancels leave no stuck input. Held Jump Back and attacks never repeat. | Pending |
| Guard readability | Both fists near cheeks, forearms protect the face, tucked elbows and a stable stance. Enter/hold/hit/exit and moving guard remain clear. | Pending |
| Block rules | Startup is vulnerable; punches preserve combo progress; exhaustion absorbs its last punch, drops guard and requires a fresh press. Guard never extends Uppercut availability. | Pending |
| Circling direction | Left/Right orbit correctly from both starting sides and phone viewpoints. Advance + circle moves inward; fighters face each other until an attack commits. | Pending |
| Dodge timing | A hop can miss an incoming path/range but remains hittable. Boundary clamping and hop recovery are readable; no steering during flight. | Pending |
| Contact and interruption | Both hands connect visibly; committed punches can be circled. Punches settle a hop smoothly; Uppercuts launch continuously from existing lift. | Pending |
| Launch / landing / victory | Every Uppercut launches, nonlethal targets recover, lethal targets defeat, launched winners settle, opponent knockout completes before two Victory plays and result text. | Pending |
| Feedback | Damage versus blocked flashes are distinct; 20/35/70 ms pauses feel responsive; sound starts on contact once at 0.4/0.8 volume; reduced motion remains subdued. | Pending |
| Lifecycle | Portrait freezes timers and flight; tracking/app interruption clears controls/rewards but resumes remaining motion and exhaustion correctly. | Pending |
| Sustained performance | Multiple rounds and at least two minutes of guarded movement, circling, hops, hits and launches, aiming for ≥30 FPS; record stalls, heat and memory pressure. | Pending |
| Two-phone match | Progress, stamina, X/Z/facing, impacts, interruptions and the two-play result gate agree on both phones. | Pending; relay limitation |

The previously documented relay TLS/routing failure remains separate. Simulated transport and multiplayer tests do not establish successful two-phone acceptance.
