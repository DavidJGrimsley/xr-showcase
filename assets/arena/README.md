# Packaged local arena assets

Copied without changing bytes from `F:/ReactNativeApps/xr-showcase-i2Workspace/temp/mike-usable-assets` on October 8, 2026. The user selected these curated files for the local Arena Fighter. The source notes are `temp/Mike-2D-Fighter-Summary-and-Plan.md` in the workspace.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| Fight_Arena.glb | 6,583,212 | `a02bdcce1731f00381511dbf9e9d796d6707a536b771480eef8ce43f7b895735` |
| Mike_Player1_Blue_AR.glb | 17,825,316 | `906e8fa6902683cebc3850806353be117e92db8ab4b8118f5e638ee112b4696d` |
| Mike_Player2_RedOrange_AR.glb | 16,934,564 | `3dcbd37716c377d2314ab40c8f4542fc0d48905189f288ae5e7e455757e47948` |
| fighter-animation-manifest.json | 11,861 | `c4de9f109460d7ee9bc7cd42168eb23d67b471bec46dc67217e88434a28228bc` |

Mike originates from the owner's Unreal project `Quasicombo-level-design/Braided_Quanta2026.uproject`, mesh `/Game/RadicalMike/Mesh/SKM_MegaMikeZ`. The manifest records the source animation asset paths. Both packs retain the 86-joint skeleton, 28,930 triangles, and 23 named clips. The red/orange variant recolors the repaired blue model's armor and LED textures. The arena is the owner's curated download whose original `.webp` extension mislabeled a GLB; it contains 200,000 triangles. No new conversion, optimization, texture processing, license grant or asset authorship is claimed by this implementation.

The float32 skin weights, explicit LINEAR animation samplers, split skinned meshes, unlit LED/lens fallback, lens adjustment and embedded image payloads remain intact. `.gitattributes` disables newline conversion for the manifest; `.prettierignore` also preserves its original bytes. `npm run test:arena` verifies hashes, GLB structure, resources, all clip names and durations, weights and repaired material metadata.

The manifest is archival export data. Its original five-step combo and planned implementation status remain unchanged. Gameplay uses only its clip names, durations, loop recommendations and hit times; the accepted local-game plan supersedes the original combo-input sequence.

## Impact sounds

Same-space multiplayer routes each impact to the receiving fighter's phone, independently of the host's main-audio setting. Solo plays both fighters' impacts. Three ViroSound slots per receiver/effect allow rapid contacts to overlap without rewinding a playing sound; misses remain silent. Visual contact flashes still appear for both fighters on both phones.

## Music and announcer recordings

The supplied recordings in the workspace's `temp/Sound` are preserved unchanged. `scripts/arena-audio-assets.py` creates AAC/M4A stereo music at a nominal 192 kbps and PCM16 stereo voice WAVs at 48 kHz. The twelve playback copies total about 21.25 MB. `sounds/audio-manifest.json` records original source paths/hashes, packaged hashes/lengths, and measured playback durations. Existing `punch_01.wav`, `punch_02.wav`, and `punch_03.wav` remain byte-identical to their Unreal sources.

The game-owned Expo Audio controller loops menu music through setup, then battle music from the first shared Ready transition through rounds, results, and rematches. Music does not restart at a round boundary. The host chooses Host phone (default), Guest phone, or Both phones for music and round announcements; each player always hears their own result. The title is spoken once per game visit. Round, Ready, and Fight lettering follows explicit authoritative cues, actual playback completion, and 150 ms buffers. Combat starts with Fight. Results follow the full existing animation presentation and remain for at least two seconds before another round/rematch can begin.

Audio uses foreground playback, no microphone permission, and explicit silent-mode playback with mixing enabled. Phone acceptance, including Viro/Expo Audio coexistence and the final mix, remains required; static asset verification and JavaScript exports cannot establish audible device behavior. See `project/agent/completions/arena-game-audio.md`.

## Original impact provenance

Copied byte-for-byte on October 10, 2026 from `C:/Users/DJLeg/Documents/Unreal Projects/Quasicombo-level-design/Project/AudioSource/Mike`. The original Unreal sources were read and left unchanged. The mapping follows Mike's existing sound selection: right punch uses `punch_01.wav`, left punch uses `punch_02.wav`, and either uppercut uses `punch_03.wav`.

| Packaged file | Bytes | SHA-256 |
| --- | ---: | --- |
| sounds/punch_01.wav | 129,854 | `27ed011cc994e00a2baa47ecc0239685ebfea10cf3ee52697934ada402cd7f4f` |
| sounds/punch_02.wav | 129,854 | `145651ba430534af16da8c0fd902a5e5361dc23199a4a9237f101f73d41ab47b` |
| sounds/punch_03.wav | 129,854 | `655c57006e250925e7eb374b2a96dec45fa790a4667632c94dafd7deab130fc9` |

All three are PCM16, stereo, 48 kHz WAVs, about 0.676 seconds each. Static Metro references package them locally. ViroSound plays the selected file at volume 0.8 for damage or 0.4 for a blocked punch, only for a new authoritative contact event; misses and attack input make no sound. Arena tests verify the hashes and WAV format, and the iOS JavaScript export includes all three files. Physical playback latency and mix still require iPhone assessment.

## Placement measurements

The arena already includes a +90° X axis conversion and a `RecenterOffset` node. Do not apply another axis conversion. Its longest horizontal span is 1.139190018 m before normalization. Scale it uniformly by `0.6 / 1.139190018`; offset its base by `0.142738473 * scale` to rest on the selected plane. The measured central fighting floor is approximately source Y=-0.027 m, giving a placed floor about 6.10 cm above the surface. This measurement still needs visual confirmation on the phone.

The fighter bind-pose bounds run from Y=-0.001067926 to 1.597503780 m. Uniform positive scale `0.12 / 1.598571706` gives a 12 cm full-height model; the small negative minimum is compensated at its feet. The lens geometry faces +Z, so Y rotations of +90°/-90° face along the fighting line. Animated poses naturally vary in height. Arena and fighters share the selected plane's transform and the same optional 90° yaw adjustment.

## Distribution and validation boundary

Static Metro asset references package these GLBs with the app's JavaScript/asset bundle. The original three models total 41.34 MB. Runtime now loads the two derived Combat_AR packs with the original arena, totaling 45.65 MB. A Metro development session serves those same local files from the development server. Neither mode fetches a Studio scene or needs Studio credentials.

The complete packs have passed file checks and an iOS JavaScript export. Earlier phone evidence applies to the prior standalone model. Rendering these complete packs together, placement, animation transitions and sustained performance on the physical iPhone remain pending; see `project/agent/completions/arena-device-validation.md`.

## Defense animation packs

The app now loads `Mike_Player1_Blue_Combat_AR.glb` and `Mike_Player2_RedOrange_Combat_AR.glb`. They append eight isolated Unreal-authored guard and Jump Back clips plus `VictoryUppercut` and the derived `HitFrontFast` reaction to each original pack (33 clips total). Original geometry, textures, skinning repairs, original animation sample payloads and all original files remain unchanged. The eight defense clips also retain their exact sample payloads. `combat-animation-manifest.json` supplements the archival manifest with source paths, timing, hashes and preview evidence. See `project/agent/completions/arena-defense-circling.md` for defense authoring and `project/agent/completions/arena-victory-uppercut.md` for the finisher; `project/agent/completions/arena-contact-counterplay.md` records the current package hashes.

`VictoryUppercut` is a new 2-second, in-place Unreal clip at `/Game/Quasicombo/Mike/Arena/AS_Mike_VictoryUppercut`, derived from read-only CalibrationStretches, UppercutR and IdleAggro sources. It adds a crouched wind-up, enlarged upward sweep, raised-fist hold and return to idle after the two original stretches. Protocol 7 retains the requirement for the full finale on both devices before result text appears. This celebration generates no combat impact or contact sound.

## Fitted combat contact

`combat-collision-data.json` supplements the animation packs with 60 Hz fitted gauntlet/body poses. Host contact sweeps apply fighter facing and lift through short active windows; center cones do not veto visible volume overlaps. `HitFrontFast` retimes the original reaction to 200 ms and blends its ending to IdleAggro, while the original HitFront stays intact for launch/landing. See `project/agent/completions/arena-contact-counterplay.md` for tuning, hashes, previews, validation, and physical acceptance.
