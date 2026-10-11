# Medical Viewer 3D Scan — implementation and local validation

Date: 2026-10-11 (America/New_York).

**Current status:** The subsequent owner trial (`IMG_3682.png`) also failed with a white cube. The implementation/validation below is historical, not a successful device-rendering claim. The current branch defaults to a transparent stacked-slice fallback and contains isolated, gated shader diagnostics. See [the white-cube investigation and delivery report](F:/ReactNativeApps/xr-showcase-i2Workspace/xr-showcase-medical-scan-slices/project/agent/completions/medical-white-cube.md) for current behavior, evidence and device instructions.

## Delivered behavior

Medical Viewer now has **3D Anatomy**, **Scan Slices**, and **3D Scan**. It still opens in **3D Anatomy → Both**. The implemented slice panel and four anatomy selections are preserved. All three representations share the existing AR navigator, scene, plane selector and selected surface, with independent scale/yaw/height.

The initial implementation described below used a left-half cutaway and a proxy ray marcher. The current default shows the **full registered MRI** using stacked slices, with corrected iOS color handling and stronger opacity. See [the visibility follow-up](medical-scan-visibility.md) for current behavior and validation. The diagonal 135° orientation and 55 cm longest extent centred 0.6096 m above the selected surface are retained. No mesh registration, fusion or native renderer replacement was added.

MRI/CT switching retains the physical crop and volume placement, restoring each modality's appearance. Scan Controls opens a native scrollable Expo UI sheet with MRI Grayscale, CT Bone/Soft Tissue, window, level, transparency, Balanced/Fast quality, cropping enable/box visibility, and all six physical boundaries. Crop pairs retain at least one exported voxel. Reset Crop reveals the whole extent; Reset Scan restores selected appearance/cutaway; Reset Transform restores only the volume pose. Transform, Reposition, Restart AR and Home use the existing session lifecycle.

The shader uses ray/box intersection, bilinear alpha atlas sampling plus interpolation of adjacent axial tiles, validity-normalized scalar decoding, front-to-back compositing, step-corrected opacity, approximate gradient lighting, grayscale crop faces and early termination. Balanced uses 192 ray samples and Fast uses 96. Camera/model transforms come from Viro; custom matrix and vec2 bridge updates are avoided.

Three keyed invisible image probes establish asset readiness before material binding. Native load events have no image identity, so session/placement/request guards reject stale callbacks after selection, retry, mode change, backgrounding or teardown. The request has one 30-second deadline across loading/binding. Missing assets, load/binding failures and unsupported shader APIs have explicit states; recoverable failures offer Retry. Shader uniform updates and native slider changes coalesce per frame; teardown cancels pending work and deletes the bounded `medicalVolume` material. Probe success and queued material creation do not establish correct GPU drawing.

## Source and packaged assets

The exporter ran against `C:/Users/DJLeg/Documents/2026-10-08-Scene.mrb` in an isolated **3D Slicer 5.12.4** process. Source bundle size is **1,323,777,421 bytes**, SHA-256 **998783662535ddd9619709cfce38b262da9bd3ca4ff588ad80f37b228d96d598**. Its hash was rechecked after export and is unchanged. Source voxel/geometry/transform fingerprints and segmentation modification times also matched before/after export. Original volumes, segmentations, bundle and transforms remain outside Git.

Sources are **CT Head** and **MRI_Elastix**, attributed to the NLM Visible Human Project Additional Head Images collection, Brigham and Women's Hospital / Harvard Medical School, Peter Ratiu and colleagues. CT's nonlinear acquisition correction is applied once through world-to-parent-to-IJK resampling. Registered MRI geometry is sampled directly without reattaching MRI_Elastix_Transform. Source matrices, transform-chain fingerprints, voxel hashes and provenance are retained in packaged metadata.

| Property | Result |
| --- | --- |
| Original volume dimensions | 512 × 512 × 463 each |
| Original spacing | Approximately 0.489062 × 0.489062 × 0.503247 mm |
| Common exported dimensions | 160 × 160 × 149 |
| Common isotropic spacing | 1.5748411454494644 mm |
| Exported samples | 3,814,400 per modality; 3.14% of original count |
| Atlas layout | 13 columns, 149 padded axial tiles, 2106 × 1944 RGBA8 |
| MRI scalar range | −446.873261867035 to 8875.406321267688 signal units |
| CT scalar range | −1200 to 2119.803414741027 HU |
| MRI maximum quantization error | 0.07112429952030652 signal units |
| CT maximum quantization error | 0.025328474036541593 HU |
| Six compressed atlas PNGs | 11,822,292 bytes, 11.27 MiB |
| PNGs + metadata + static mapping | 11,829,278 bytes |

Scalar values use independent 16-bit unsigned quantization, with high/low bytes in separate PNG alpha channels and a third alpha validity atlas. Window/level remains interactive: MRI 5589/2671.5, CT Bone 1800/400, CT Soft Tissue 150/40. Alpha bypasses installed iOS Viro's sRGB conversion of custom sampler colour channels. One-texel gutters repeat tile edges, linear sampling interpolates spatially, and mipmaps are disabled. Atlas rows increase RAS A and tile Z increases S; world RAS maps to Viro X=R, Y=S, Z=−A.

## Local validation

| Check | Actual result |
| --- | --- |
| Real isolated Slicer export | Passed, both modalities; source nodes unchanged |
| Source bundle SHA-256 after export | Matches original |
| Slicer spatial and packing tests | 14/14 passed |
| Companion manifest validation | Both series passed geometry, scalar, PNG CRC/hash/size, gutter, validity and count checks |
| Synthetic production shader proof | Compiled/rendered in Chrome SwiftShader WebGL2 inside installed Viro iOS Constant GLSL template; no GL error |
| Synthetic trilinear sampling vs CPU | Full 0–65535 scalar range, maximum error 0.00171875 scalar units |
| Model/camera transform invariance | Translation, yaw and scale; maximum RGBA error 0.000000715256 |
| Fast/Balanced homogeneous opacity | Maximum alpha difference 0.0000169947743 |
| Opacity vs closed-form CPU calculation | Error 0.0000174009835 |
| Real MRI atlas sampling vs CPU | Maximum error 0.00142354752 signal units |
| Real CT atlas sampling vs CPU | Maximum error 0.000385906432 HU |
| Real MRI/CT reference and shader previews | Visually inspected MRI cutaway and both CT presets |
| `npm test` | Passed lint, TypeScript, AR, Qubit and medical suites |
| `npm run test:medical` | 67/67 passed, including existing anatomy/slice tests |
| `npm run test:medical:shader` | Passed synthetic and real asset proofs |
| `npx expo-doctor` | 21/21 passed |
| `npm run build:ios` | Passed Metro/Hermes iOS JS and asset export |
| Volume assets in exported bundle | All six source PNG hashes found; identical validity atlases deduplicated |
| Viro volume JSX schema validation | 0 errors, 0 warnings |
| MDS Doctor CI | 100/100, zero errors; React Doctor has seven existing warnings outside this feature |
| `git diff --check` | Passed |

Slicer tests cover asymmetric orientation, oblique IJK geometry, nonlinear CT-style parent correction, registration once, source fingerprint preservation, validity, atlas byte/gutter orientation, quantization and malformed/missing manifest inputs. Controller/native wiring tests cover defaults, presets, crop limits, modality round trips, independent transforms, rapid control updates, scoped probes, retries, deadline, unsupported API, shader-update errors, interrupted gestures, mode changes and teardown. Existing AR ownership/background/resume tests are retained.

Slicer references use the same packaged quantized values and transfer functions, with an unlit grayscale cut plane. VTK and app volume-lighting approximations differ; inspection confirms the intended orientation, cut face, scan anatomy and preset behavior, not pixel-identical lighting. Desktop previews are generated at `.expo/medical-volumes/reference/{mri-grayscale,ct-bone,ct-soft-tissue}.png` and `.expo/medical-volumes/*-shader.png`; these images and proof JSON remain ignored local artifacts.

MDS's remaining warnings concern AR boundary complexity, existing dynamic ScrollView padding, existing non-component exports and an existing service await loop. No new Medical Viewer warning remains. Node's module-type and Metro colour-environment notices are informational.

## Regeneration and trial

Exact Windows Python Console/headless export commands, manifest generation, Slicer spatial tests, shader proof and physical acceptance steps are in [tools/medical/README.md](F:/ReactNativeApps/xr-showcase-i2Workspace/xr-showcase-medical-scan-slices/tools/medical/README.md). The exporter automatically validates and generates static references under `assets/medical/volumes/`. Run Prettier on generated metadata/mappings and reload Metro after regenerating assets. No new dependency or native build configuration was introduced.

For a phone trial, run `npm start` from this worktree and reload the existing iOS development client. Open Medical Viewer, place on a surface, then select **3D Scan**. The source and Slicer preparation are already complete.

## Physical acceptance — two failed trials; texture-binding correction awaits retest

The owner's first iPhone trial failed: `IMG_3669.png` (MRI) and `IMG_3670.png` (CT) show an opaque white/black proxy box with horizontal stripes instead of anatomy. This is failed native acceptance, despite the successful earlier desktop tests. No physical iPhone was operated by the coding agent. Device model, iOS/client versions, measured FPS and measured memory remain unavailable. `build:ios` here is an Expo JS/asset export, not an Xcode native build or device test.

The shader's atlas samplers previously inherited GLSL's low precision. They now explicitly use `highp`, and sampled alpha values enter `highp` temporaries before 16-bit decoding arithmetic. A high-precision destination alone does not promote operations on low-precision operands. This corrects a precision defect but does **not** establish that it caused the photographed box or that the phone result is fixed. The desktop proof now reads the installed iOS Constant shader and surface definition directly, preserving its material alpha/intensity pipeline; it also covers the complete uint16 range and transformed camera/model coordinates. SwiftShader still does not test native sampler binding, UIImage decoding, Apple's GPU or the installed client binary.

The second owner trial, `IMG_3676.png` (MRI) and `IMG_3677.png` (CT), still failed: an opaque mostly white box with surface texture replaces the earlier black/white result. The precision correction did not resolve native drawing.

Native inspection then identified a definite atlas-binding defect. Installed `ios/ViroReact/Views/VRTNode.mm` applies the `materials` prop through `std::make_shared<VROMaterial>(sourceMaterial)`. The core copy constructor copies numeric shader uniforms but initializes the custom texture map empty. This omission was verified in the **installed arm64 ViroKit binary**, SHA-256 `dfd54f391a941c584e1c23e4c40af4a05ebb46ef43d2ea70c8a1db594294169b`, as well as the renderer source. Thus the geometry's material lacks all three custom atlas textures, even though image probes and shader creation succeeded. The exact appearance of missing native texture bindings is not established by a desktop simulation.

The box now uses Viro's existing **`shaderOverrides`** prop. Its iOS path explicitly copies `getShaderUniformTextures()` into the geometry's merged material, preserving the high-byte, low-byte and validity atlases. Authored lighting/blending/culling/depth settings and scalar/vec3/vec4 updates are retained. Modality changes already remount the box after loading, so live texture-uniform updates are unnecessary. No native code, dependency or build configuration was changed.

The scene regression asserts that the actual rendered box uses the override path. The shader harness now also checks installed Objective-C source for the explicit sampler copy and authored render-property merge before manually binding WebGL textures. The previous harness bypassed material cloning entirely, which explains why its numerical sampling checks did not detect this defect. These added checks cover source contracts and wiring, not execution on an iPhone.

After this correction, `npm test` passes (14 AR, 108 Qubit, 67 medical tests, lint and TypeScript), `npm run test:medical:shader` passes synthetic/real sampling and native-template compilation, and `npm run build:ios` passes with 195 assets. MRI/CT sampling errors and homogeneous opacity errors remain within the table's bounds. Desktop MRI cutaway was inspected again. The source volumes and packaged atlases were not regenerated.

After the texture-binding correction, the same 189 unit tests, lint and TypeScript passed. The shader proof passed the new iOS binding contract check, full-range sampling, transforms, cropping, transparency and quality checks; real MRI/CT sampling errors remained unchanged. MDS Doctor CI reran the iOS export via `npm run build` → `build:ios` and Expo Doctor (21/21 passed), with zero errors and the same seven unrelated React warnings. Volume JSX schema validation returned zero errors/warnings. Physical drawing, FPS and memory remain unverified pending another owner trial.

MDS Doctor CI was rerun after the correction: score 100, zero errors, Expo Doctor 21/21 passed and the same seven existing React Doctor warnings outside Medical Viewer. Its four skips cover absent API routes, undetected animation-heavy files, web SEO and the full native build profile; none establishes phone rendering/performance. `git -c core.autocrlf=false diff --check` passed.

Read-only EAS history found finished development build `02d480be-4fe7-468c-8be2-539da629e826`, created 2026-10-11 01:28 UTC (October 10 at 9:28 PM Eastern), recorded commit `839c8e3dcf21d1668a6fb795217f1557363c0bd2`. That commit's lockfile resolves Viro 3.0.3, matching this worktree. The prior finished development build also records the same native package pins. Build history cannot identify which binary is installed on the phone. No native dependency, lockfile, app configuration or EAS profile change was introduced by this feature or correction, and no EAS build was launched during debugging.

Retest by stopping/restarting Metro with `npm start -- --clear` from this worktree, fully closing/reopening the development client, and opening 3D Scan again. A full restart clears native materials that can survive Fast Refresh. If the current client was built before the native dependency upgrade, build/install the development profile with `eas build --platform ios --profile development`. Rebuilding an already matching client does not by itself verify or correct shader behavior.

The acceptance checklist covers walking around/inside the scan, CT→MRI→CT, all presets/window/level/transparency, six crop boundaries/box toggle, Fast/Balanced, transformations, background/resume, Home and reopening Medical/Arena/Qubit. Target sustained ≥30 FPS in Fast during a representative 60-second walk-around; measure memory after 1/10/30 modality round trips and Home/reopen. Record device model and actual measurements.

Installed Viro's native UIImage cache and material-definition dictionary persist until bridge invalidation. Deleting a material does not establish image eviction. One modality's three decoded RGBA atlases require roughly **46.85 MiB** before probes/caches/other scene resources; repeated-switch memory remains a device acceptance item. If native shader compilation or atlas decoding fails, report that specific limitation before considering native renderer changes.

Work is recorded on the `medical-scan-slices` branch for review and device testing. Physical acceptance of the texture-binding correction remains pending. Earlier slice completion evidence is preserved as historical validation of that feature.
