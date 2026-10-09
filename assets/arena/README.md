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

## Placement measurements

The arena already includes a +90° X axis conversion and a `RecenterOffset` node. Do not apply another axis conversion. Its longest horizontal span is 1.139190018 m before normalization. Scale it uniformly by `0.6 / 1.139190018`; offset its base by `0.142738473 * scale` to rest on the selected plane. The measured central fighting floor is approximately source Y=-0.027 m, giving a placed floor about 6.10 cm above the surface. This measurement still needs visual confirmation on the phone.

The fighter bind-pose bounds run from Y=-0.001067926 to 1.597503780 m. Uniform positive scale `0.12 / 1.598571706` gives a 12 cm full-height model; the small negative minimum is compensated at its feet. The lens geometry faces +Z, so Y rotations of +90°/-90° face along the fighting line. Animated poses naturally vary in height. Arena and fighters share the selected plane's transform and the same optional 90° yaw adjustment.

## Distribution and validation boundary

Static Metro asset references package these GLBs with the app's JavaScript/asset bundle. The three models total 41.34 MB. A Metro development session serves those same local files from the development server. Neither mode fetches a Studio scene or needs Studio credentials.

The complete packs have passed file checks and an iOS JavaScript export. Earlier phone evidence applies to the prior standalone model. Rendering these complete packs together, placement, animation transitions and sustained performance on the physical iPhone remain pending; see `project/agent/completions/arena-device-validation.md`.
