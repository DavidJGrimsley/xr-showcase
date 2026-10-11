# Medical 3D Scan: white-cube investigation and fallback

Date: October 11, 2026 (America/New_York). Branch: `medical-scan-slices`; base commit `e798b54`. Main was not modified. This pass changes JavaScript, tests and packaged assets; it introduces no native dependency/configuration changes and launches no EAS build.

**Visibility follow-up:** The later owner screenshots (`IMG_3685.png`, `IMG_3686.png`) show the fallback reaching the phone with a partial, dark MRI and faint CT. [Current visibility and controls changes](medical-scan-visibility.md) fix the Done button, make the full scan the default, strengthen opacity and add an iOS diffuse-color correction. The no-custom-shader description, opacity numbers, cutaway defaults and phone evidence below describe the earlier fallback revision.

## Result and limits of the diagnosis

The owner's third physical trial, `IMG_3682.png`, is **failed native acceptance**: a white proxy cube replaces the anatomy. The earlier precision and material-copy corrections did not demonstrate successful drawing. They were retained, not repeated as a new purported fix.

**No current white-cube root cause has been demonstrated on the phone.** The isolated checks now make it possible to distinguish modifier application, sampler binding/decoding, numeric uniforms, camera/model coordinates, ray intersection and opacity on the actual device. A successful desktop compilation is not used to declare the native bug fixed.

To provide a working rendering route to test promptly, the default 3D Scan path now mounts **48 scan-derived transparent axial quads**, without a proxy box or custom shader. It is explicitly labelled **Stacked-slice visualization · temporary fallback**. Experimental GPU ray marching is reachable through Scan Controls → Shader diagnostics, initially forcing bright magenta. Atlas tests remain disabled until the operator closes the sheet, actually observes magenta and selects **I see magenta**. That confirmation establishes only that magenta was observed, not that atlas data or ray marching works.

The viewer still opens in Anatomy → Both. Existing anatomy choices, Scan Slices, navigation and AR session ownership remain intact. One scene/anchor serves all representations. The volume's independent placement/transform, MRI/CT selection, presets, transparency and six physical crop boundaries work in both rendering routes. Window/level and Fast/Balanced are disabled for the fallback because its presets are baked. Reset Crop/Scan/Transform, Restart AR, Reposition and Home retain their existing lifecycle behavior.

## Runtime evidence

The owner identified the installed EAS client by commit prefix **839c8e3**. Read-only EAS history maps that to finished development build **02d480be-4fe7-468c-8be2-539da629e826**, created October 10, 2026 at 9:28 PM Eastern (October 11 01:28 UTC), commit `839c8e3dcf21d1668a6fb795217f1557363c0bd2`. Its **INSTALL_PODS log explicitly records `Installing ViroReact (3.0.3)`**, at 01:29:44 UTC. This is stronger evidence than inspecting the current lockfile alone. Given the owner's identification, an older native Viro version does not explain this trial.

The phone binary was not interrogated directly from this Windows session. Viro 3.0.3 exposes no native semantic-version getter. The diagnostic sheet shows JS package version, native app/build versions, OS version, material API presence, request scope and asset-load state. Its historical EAS reference is labelled as a reference, not as live binary identification. App version/build alone cannot uniquely identify this EAS build. A matching client needs a full close/reopen and fresh Metro reload for these JavaScript/asset changes; another native rebuild is not indicated by the verified package evidence.

## Native source findings

Inspection covered installed `@reactvision/react-viro` 3.0.3 sources, its packaged Constant GLSL resources and the pinned [ReactVision renderer source](https://github.com/ReactVision/virocore/tree/e75ddffc19ea8d006baab434fca495e68556a31b/ViroRenderer).

| Area                     | Demonstrable behavior and implication                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Material creation        | `VRTMaterialManager.mm` exports void `setJSMaterials`; registration has no JS acknowledgement. Definitions can be stored until EGL context initialization, then reloaded. A queued JS call is not evidence of registration or drawing.                                                                                                                                                        |
| Shader modifiers         | Dictionary `uniforms`/`body` become newline-separated `VROShaderModifier` source. Declaration lines are moved outside `main()`. The texture-free proof uses the fragment entry's `_output_color` and avoids the whole atlas/ray body.                                                                                                                                                         |
| Native material copies   | The previously established ordinary `materials` custom-sampler omission remains relevant to the historical implementation. `VRTNode.mm`'s `shaderOverrides` explicitly copies custom sampler textures, scalar/vec3/vec4 values and authored lighting/blending/culling/depth settings. The experimental proxy retains that path. It still has not passed phone acceptance.                     |
| Texture creation         | `createTexture2D` retrieves/caches UIImage data and creates a `VROImageiOS`; custom samplers use sRGB textures. High/low/validity live in alpha, with RGBA8 and mipmaps disabled. Actual native alpha values are not established by invisible image load events.                                                                                                                              |
| Uniforms                 | Float/vec3/vec4 updates propagate to override clones. Custom vec2/matrix updates are unsupported; none are introduced. Model/camera values continue to come from Viro. Numeric, coordinate and ray diagnostic modes isolate their effects.                                                                                                                                                    |
| Blending                 | The proxy uses Constant lighting, Alpha blending, front-face culling, depth reads and no depth writes. Its compositing accumulates premultiplied RGB then divides by alpha for straight-alpha output. The fallback uses ordinary diffuse textures, Alpha blending, two-sided quads, depth reads and no depth writes.                                                                          |
| Error reporting          | Unknown material/uniform updates log through `RCTLogError`. Renderer compilation queries `GL_COMPILE_STATUS`, linking queries `GL_LINK_STATUS`; failures log `Shader compile log:`, `Failed to compile fragment shader`, `Program link log:` or `Failed to link program`. On iOS, the renderer's error macro uses `NSLog`. These core failures are not all forwarded to JS node error events. |
| Registration/mount order | Both routes now submit materials before geometry, deferring geometry over two animation frames. Cancellation guards prevent stale queued mounts. This reduces immediate same-update mounting, but cannot guarantee native completion or prove that a race caused the photographed cube.                                                                                                       |
| Resource lifetime        | Bounded names (`medicalVolume`, `medicalStack0..47`) are deleted on unmount. The native image/definition caches persist; deletion is not an image-eviction guarantee. No speculative native patch was made.                                                                                                                                                                                   |

Ray marching with correctly supplied assets does not produce an opaque white box in the desktop fixtures. Full uint16 decoding, transformed camera/model coordinates, transparent opacity, cropped intersections and the Fast/Balanced opacity calculation pass. This does not exclude an iOS compiler, binding or uniform failure. If high/low/validity all incorrectly sample opaque white, decoded scalar values saturate the appearance ramp and opacity rapidly approaches one; this is a **conditional explanation**, not an observed native result. The new byte/validity modes distinguish that condition before compositing is tested.

## Actual implementation

- `medical-volume.native.tsx` selects the fallback by default; the proxy is mounted only in explicitly selected diagnostics. It skips all atlas loads/uniforms for magenta, delays geometry mounting, captures supported node/material/update errors and records the 30-second deadline. Stale requests cannot register a newer request as ready.
- `medical-volume-diagnostics.ts` supplies nine isolated modes: magenta, high, low, validity, coordinates, numeric uniforms, ray intersections, accumulated opacity and the original ray marcher. Known valid/invalid UVs and byte expectations are generated from real data.
- `medical-volume-stack.native.tsx` creates ordinary diffuse-texture materials after scoped image readiness. `medical-volume-stack.ts` maps RAS to `(R,S,-A)`, sizes/crops the quads and reverses UV endpoints to match native `VROSurface`. Viro 3.0.3's iOS quad API expects four **flat** UV scalars despite its nested TS declaration.
- `medical-controller.ts` scopes all loads, confirmation, renderer selections and diagnostic events to session/placement/request. New requests and lifecycle transitions revoke magenta confirmation. Crop and transforms are shared across the two volume-rendering routes, independent of other medical modes. Stack depth order reverses when camera forward crosses the plane normal; camera events publish only on an order change.
- The native Scan Controls sheet contains renderer/diagnostic selection, expected texel bytes, submitted uniforms, bounded diagnostic messages and visible-plane count. A crop that falls between axial planes is explained in the sheet.
- `generate_volume_fallback.py` decodes the **validated existing atlases**, applies the original preset grayscale/density mappings and produces RGBA planes with genuinely transparent air/invalid regions. No source scene re-export or mutation was needed.

## Source and packaged data

The source remains `C:/Users/DJLeg/Documents/2026-10-08-Scene.mrb`, containing CT Head and registered MRI_Elastix. Its SHA-256 was rechecked in this pass and still equals `998783662535ddd9619709cfce38b262da9bd3ca4ff588ad80f37b228d96d598`. Existing source metadata records the NLM Visible Human Project Additional Head Images provenance, original matrices/transforms, CT acquisition correction applied once and MRI registration not reapplied. Original volumes/segmentations/transforms remain outside Git; the six existing atlases were not changed.

The fallback samples 48 axial positions from the existing **160 × 160 × 149** isotropic grid at **1.574841145 mm**. Plane separation is approximately **4.72 or 6.30 mm**, from selecting every third/fourth exported axial sample. It inherits the original uint16 scalar quantization (maximum error MRI 0.0711243 signal units / CT 0.0253285 HU), then bakes grayscale/alpha to eight-bit PNG channels. It is not a return to the original 512 × 512 × 463 resolution.

| Added assets               | Size/handling                                                                                                        |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| MRI Grayscale              | 48 × 160 × 160 RGBA PNGs                                                                                             |
| CT Bone                    | 48 × 160 × 160 RGBA PNGs                                                                                             |
| CT Soft Tissue             | 48 × 160 × 160 RGBA PNGs                                                                                             |
| All 144 PNGs               | **1,179,833 bytes (1.125 MiB)** compressed                                                                           |
| Pixel opacity              | `round(255 * min(0.22, density * 0.35) * validity)`; global plane opacity is appearance opacity / 2                  |
| Metadata                   | Source metadata SHA-256, physical positions, preset W/L, filenames/hashes/bytes and known valid/invalid atlas probes |
| Approximate decoded memory | 4.6875 MiB per preset; 14.0625 MiB for all three, before native/GPU caches, probes and other resources               |

Planes are not opacity-corrected ray integration. Visible bands, edge-on views and lack of solid grayscale crop caps are expected approximation limits. R/A cropping adjusts geometry/UVs; S cropping excludes planes. A one-exported-voxel S crop can contain zero of the 48 selected planes. The UI reports remaining planes; widening the crop restores them. Preset opacity/transparency may require tuning on the actual phone. Native cache growth, visual output, FPS and memory have not been measured.

## Validation

Automated and physical results must be read separately. Current automated results and the explicit phone protocol follow below; no physical test was performed by this agent. The latest owner-supplied phone evidence is still the failed white cube.

| Automated/local check         | Result                                                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                    | Passed lint, formatting, TypeScript, 14 AR + 108 Qubit + 73 medical tests (195 total)                                                                   |
| `npm run test:medical:shader` | Passed synthetic/real sampling, model/camera transform/opacity proofs, all nine diagnostics for MRI and CT and ordinary textured-stack previews         |
| Known byte diagnostic error   | MRI all zero; CT high 0.00000715 / low 0.00003064 / validity zero in normalized alpha against the reference bands                                       |
| Numeric uniform diagnostics   | Correct dimensions → green; deliberately incorrect dimensions → red; crop RGB and window strip respond as expected                                      |
| Stack assets                  | 144 real PNG hashes/sizes/dimensions/order verified; transparent and nonzero anatomy pixels; alpha bounded at 56/255                                    |
| Stack/controller regressions  | Crop UV/geometry/depth order, preset reload, transparency, stale loads, request revocation, Retry/reset, no shader API needed and no fallback proxy box |
| `npx expo-doctor`             | 21/21 passed                                                                                                                                            |
| `npm run build:ios`           | Passed Expo JS/asset export; this is not an Xcode build/device execution                                                                                |
| Viro TSX schema checks        | Fallback and diagnostic scene fragments: zero errors/warnings                                                                                           |
| Source bundle hash            | Rechecked and unchanged                                                                                                                                 |
| MDS Doctor CI                 | Final score 100/100, zero blocking errors; all new React findings resolved. Seven existing React warnings remain outside Medical Viewer.                |
| Exported assets               | All 150 source PNG hashes (144 stack + 6 atlases) matched in the iOS export; identical PNGs deduplicated. 336 exported assets total.                    |
| `git diff --check`            | Passed with `git -c core.autocrlf=false diff --check`.                                                                                                  |

MDS Doctor ran through the MCP `doctor_scan_project` tool with `mode: ci`, `runScripts: true` and this worktree as `projectPath`. It reran lint, types, the full unit suite, Expo Doctor and `npm run build` → `build:ios`. The final React Doctor has zero errors and seven pre-existing warnings: AR boundary complexity, dynamic ScrollView padding in AR/Home, Fast Refresh exports in Settings/theme, and an existing service await loop. There are no new Medical Viewer findings. Four CI skips cover absent API routes, undetected animation-heavy files, web SEO and the broader native build profile. They do not constitute device performance/build evidence. The CLI equivalent for a later recheck is:

```powershell
mds doctor 'F:/ReactNativeApps/xr-showcase-i2Workspace/xr-showcase-medical-scan-slices' --ci
```

All fallback assets, metadata and static mappings together occupy **1,223,137 bytes**. Desktop preview/proof files are ignored under `.expo/medical-volumes/`: `*-stack.png`, `diagnostics-proof.json`, `stack-proof.json`, `shader-proof.json`, and real atlas proofs. MRI, CT bone and soft-tissue stack previews were visually inspected: scan head shapes, transparent surrounding pixels and expected axial bands; no opaque rectangular proxy is used.

## Phone instructions: test one stage at a time

Start from the exact worktree and clear native material state by fully closing/reopening the app:

```powershell
Set-Location 'F:/ReactNativeApps/xr-showcase-i2Workspace/xr-showcase-medical-scan-slices'
npm start -- --clear
```

Connect the **identified development client** to this Metro instance. No EAS rebuild is needed for this pass's JS/assets. Verify the new **Stacked-slice visualization** label; if absent, the phone is not running this new bundle.

1. Open Medical Viewer: Anatomy → Both must remain the opening view. Place on a surface and enter 3D Scan. Expect a **head-shaped stack of translucent MRI layers**, with the left half removed, visible horizontal gaps/bands and real-world camera imagery around/between tissue. There must be **no opaque white/black cube**. Tilt above/below the scan; a perfectly edge-on view can become faint.
2. Test CT → MRI → CT, then CT Bone → CT Soft Tissue. Expect different scan-derived tissue visibility, preserved placement/crop and per-modality appearance. Transparency 100% hides tissue; reducing it reveals tissue. Test six crop boundaries, crop disable, crop wireframe, visible-plane count and all resets. Window/level/quality are disabled for this fallback and labelled accordingly.
3. For shader investigation, open Scan Controls → **Shader diagnostics**. Close the sheet. The box must be **uniform bright magenta**, with no atlas textures or ray integration involved. If white/blank, stop shader testing, capture the diagnostic status/native logs and choose Stacked slices. Do not press I see magenta unless it is actually magenta.
4. If magenta passed, reopen the sheet and select **I see magenta**. Select **High byte**, close and observe; repeat independently for **Low byte**, then **Validity**. Expect a magenta edge, matching sampled/reference grayscale bands, and a **black invalid-texel band**. MRI expected bytes are **68, 190, 255**; CT **108, 171, 255**. Validity's two valid bands should be white. Constant all-white/all-black sampled bands or disagreement with the reference indicate binding/decoding/UV failure; record which mode/modality failed and stop before ray marching.
5. Test **Coordinates**: RGB gradients follow R/A/S coordinates; walk around and change Transform scale/yaw/height. The coordinate pattern must remain attached to the box, while the camera-origin strip responds when camera coordinates cross the volume's axes. Test **Uniforms**: green indicates expected dimensions and sensible selected numeric uniforms; right-side RGB encodes normalized crop minima and the grayscale window strip changes with Window. Red indicates a failed selected-uniform check. Compare displayed submitted values and crop mm.
6. Test **Ray** independently: valid crop intersections appear green/cyan; misses magenta. Move each crop bound and walk around the box. Then **Opacity**: grayscale accumulated alpha should change with transparency/cropping; 100% transparency should produce black. Only after these stages, select **Ray marcher**. Expect MRI/CT anatomy with transparent surroundings. Any remaining white cube is still failed acceptance; record mode/preset/settings and return to the fallback.
7. Test background/resume, Reposition, Restart AR, Home and reopening all three experiences (Medical, Arena Fighter, Guess the Qubit). New sessions, modality changes, placement changes, viewer mode changes and Retry revoke shader confirmations and begin with magenta again. Selecting the next diagnostic stage retains the manual magenta confirmation. Record iPhone model, iOS, build identifier, FPS and memory if measuring performance. No 30 FPS or bounded-memory claim has been made.

The native sheet cannot see every renderer error. When available, attach the iPhone to a Mac, open **Console**, select the device, start logging and reproduce a single mode. Filter the app process and search for `Shader compile log`, `Failed to compile fragment shader`, `Program link log`, `Failed to link program`, `Material` and `medicalVolume`. Export the relevant native log interval with the mode/modality and time. An attached Xcode device debugging console is another option. Windows in this session had no connected iOS log-capture tool; **no native compile/binding error was captured**. Missing logs do not constitute successful drawing.

Regeneration commands and physical steps are also in `tools/medical/README.md`. The custom shader remains experimental pending staged device acceptance; the default fallback avoids that shader path immediately.
