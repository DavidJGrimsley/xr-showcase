# Arena Fighter: victory Uppercut

Implemented locally on `arena-multiplayer`, October 10, 2026. App changes are confined to `xr-showcase-phase-2-arena`; animation authoring uses the authorized open `Quasicombo-level-design` Unreal project. Existing work, unrelated generated-file and Unreal changes, AR placement, arena size and fighter transforms are preserved.

The winner waits for the opponent's complete knockout, plays the original 2.3-second CalibrationStretches (`Victory`) twice, then plays one new 2-second `VictoryUppercut`. Results and Rematch stay hidden until the entire sequence has finished. Multiplayer also waits for both devices' renderer acknowledgments and completed presentations. Each play receives a distinct animation command. A renderer remount restarts its current clip only; portrait holds freeze the finale. Draws retain their existing double-knockout behavior.

## Animation and packaging

New Unreal asset: `/Game/Quasicombo/Mike/Arena/AS_Mike_VictoryUppercut`. `Project/ArenaVictoryAuthoring.py` bakes 60 frames at 30 fps on Mike's 86-track skeleton, using read-only CalibrationStretches, UppercutR and IdleAggro poses. It blends from the stretch's final pose, crouches into a 300 ms wind-up, sweeps upward through 650 ms, holds the raised fist through 1.05 seconds, then returns to idle. The enlarged right-arm sweep and hold distinguish it from the combat Uppercut. Root and skeleton translations remain in place. The celebration causes no damage or impact sound.

All 105 RadicalMike source assets and eight previously authored defense `.uasset` files retain their SHA-256 hashes. Only the new Unreal animation and its authoring script were added in this round. Original app GLBs and the archival manifest retain their exact hashes. Derived packs retain all 31 previous animation sample hashes and append the new clip's 258 channels, matching its Unreal export byte-for-byte. Endpoint tests check the stretch/idle handoffs within tiny Unreal source-compression differences.

Front and three-quarter Blender renders were inspected for wind-up, rising fist, hold and return. The animation preview shows both stretches followed by the finisher; it is a Blender appearance preview, not Viro or phone evidence.

![Two stretches and one big Uppercut](F:/ReactNativeApps/xr-showcase-i2Workspace/xr-showcase-phase-2-arena/project/agent/completions/arena-victory-previews/victory-sequence.gif)

| Derived file | Bytes | SHA-256 |
| --- | ---: | --- |
| Mike_Player1_Blue_Combat_AR.glb | 19,821,016 | `1370c228d11a35d5ff02d2387823bbe4e9bf671a572208a1bac2923205682070` |
| Mike_Player2_RedOrange_Combat_AR.glb | 18,930,268 | `43b3f99410d65b075d501d9546462a0b7010081ab8d0aaab0974878c4db4e061` |

The supplemental combat manifest records duration, source paths, sample hashes and preview inspection. Static Metro references keep loading the derived packs. Protocol/invites advance from 5 to 6 because earlier builds cannot play or validate `VictoryUppercut`; incompatible invites and packets are rejected.

Reproduction uses `Project/MenuTools/editor_console.py Project/ArenaVictoryAuthoring.py` in Unreal. In this worktree, run `scripts/arena-defense-pack.py` with `--raw "C:/Users/DJLeg/Documents/Unreal Projects/Quasicombo-level-design/Saved/ArenaDefense" --extra-report "C:/Users/DJLeg/Documents/Unreal Projects/Quasicombo-level-design/Saved/ArenaDefense/victory-authoring.json" --stage .expo/arena-victory`. Render with Blender using `scripts/arena-defense-preview.py -- --stage .expo/arena-victory --victory --motion`, inspect the output, record a current `previews/inspection.json`, then repeat packaging with `--package`. The eight-clip defense authoring script need not run again.

## Validation

- Arena: **233 tests passed**, covering both winner colors, grounded/launched opponents, exactly two stretches and one finisher, full renderer-acknowledged duration, hidden result text/Rematch, delayed guest playback, duplicate packets, remounts, portrait holds, compatibility, source/sample integrity, endpoint poses and in-place motion.
- Full existing suite: **378 tests passed** — AR 14, Qubit 108, Medical 23, Arena 233.
- Lint and typecheck: **passed**, no lint warnings. Existing Node module-type test-runner notices remain unchanged.
- iOS JavaScript export: **passed**, including both updated derived GLBs and all three contact WAVs.
- `git diff --check`: **passed**.
- Physical iPhone playback and two-phone acceptance: **pending**. The existing relay TLS/routing failure remains a separate limitation; simulated multiplayer does not establish successful two-phone acceptance.

## Physical checks

For both fighter colors and starting sides, confirm the opponent finishes knockout before the first stretch, both stretches finish, the larger Uppercut reads clearly, and the return to idle is smooth. Check that the arm clears the face, feet meet the arena floor, and no result text, score or Rematch appears early. Repeat with one device delayed, portrait during the finisher, and renderer interruption. Confirm stable control geometry and sustained performance in Metro and bundled builds. Use matching protocol-6 builds on both devices.
