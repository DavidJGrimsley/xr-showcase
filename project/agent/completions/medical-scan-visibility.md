# Medical scan visibility and controls follow-up

October 11, 2026. Worktree: `medical-scan-slices`. Changes are JavaScript, PNG assets and tests; no native rebuild was made or needed. The existing uncommitted fallback work is preserved.

The owner supplied `IMG_3685.png` and `IMG_3686.png`, showing a dark, partial MRI stack and a very faint CT stack, plus a Metro error at the Scan Controls Done button. These confirm that some fallback scan imagery reaches the phone; they do not establish successful experimental ray marching.

## Findings and changes

- The Done button passed a raw string child to Expo UI's universal Button. Its installed iOS implementation forwards children to SwiftUI, where strings are unsupported. It now uses `label="Done"`, matching the [SDK 57 Button API](https://docs.expo.dev/versions/v57.0.0/sdk/ui/universal/button/).
- The half-head was intentional cropping, not a half-volume export: the previous default set the left RAS boundary to the midpoint. New sessions and Reset Scan now use full dataset bounds. The former Reset Crop button is labelled Full Scan. All six crop sliders still work.
- The packaged source metadata identifies full `CT Head` and registered `MRI_Elastix` volumes, resampled to a shared 160 × 160 × 149 grid. Each fallback preset samples 48 positions across the complete inferior/superior extent. Original source atlases and registration were not changed.
- [VROImageiOS](https://github.com/ReactVision/virocore/blob/e75ddffc19ea8d006baab434fca495e68556a31b/ios/ViroKit/VROImageiOS.cpp) converts images to premultiplied RGBA. The installed Constant shader samples that RGB directly, and [Alpha blending](https://github.com/ReactVision/virocore/blob/e75ddffc19ea8d006baab434fca495e68556a31b/ViroRenderer/VRODriverOpenGL.h) multiplies by alpha again. This demonstrates a darkening defect in the fallback's iOS texture path; the precise share of the photographed faintness caused by it is not measured on-device.
- `medical-stack-color.ts` supplies a small iOS fragment modifier: convert sampled linear RGB back to encoded sRGB, divide by source texture alpha, then return to linear RGB. Node opacity remains independent. The ordinary diffuse texture is retained; there are no custom samplers, custom uniforms or proxy boxes. Android does not use this correction.
- Regenerated all 144 stack PNGs with alpha `min(0.40, density * 0.70) * validity`, capped at 102/255 rather than 56/255. Air and invalid regions remain zero alpha. PNGs total **1,235,361 bytes**. Default appearance opacity is 1.6, giving node opacity 0.8 and initial Transparency **20%**. At strongest tissue, effective alpha is 0.32 per plane versus about 0.11 previously.

## Verification

- `npm test`: passed lint, formatting, TypeScript and all **195** tests (14 AR, 108 Qubit, 73 medical).
- `npm run test:medical:shader`: passed the existing shader/diagnostic fixtures, a new **48-probe** premultiplied sRGB regression, and full MRI/CT Bone/CT Soft Tissue stack previews. The regression uses the installed native Constant shader template and checks RGB recovery, zero-alpha air and independent node opacity. A white texel at source alpha 56/255 produces RGB 10/255 before correction and 255/255 after, with unchanged output alpha 45/255 at node opacity 0.8. These are desktop GPU results, not phone measurements.
- The preview now uploads premultiplied image bytes and applies the actual correction; it also selects the correct CT Soft Tissue preset state. MRI and CT Bone previews were visually inspected: full head shapes, bright tissue, transparent surrounding pixels and visible axial bands.
- `npm run build:ios`: passed, exporting 336 assets. `git -c core.autocrlf=false diff --check`: passed.
- Started `npm start -- --clear --port 8081` in an owned terminal session. Metro is receiving iOS bundle requests and reports `VRTMaterialManager lookup: FOUND`. No repeated raw-text error appeared in the inspected log interval. Native shader errors are not all forwarded to Metro.

## Device check and remaining limits

Fully close/reopen the existing development client and reconnect to port 8081 so native material/image caches are refreshed. Place the Medical Viewer and open 3D Scan. Expect the full MRI head with substantially clearer gray tissue; CT Bone should show a brighter skull. Scan Controls should open and Done should dismiss without the text-string error. The initial Transparency value is 20%; lower it toward 0% for a denser stack. Full Scan restores all crop bounds. CT Soft Tissue reveals different structures from CT Bone.

The revised controls and visibility have **not yet been confirmed on a physical phone**. This remains a 48-plane approximation: horizontal bands and faintness when viewed exactly edge-on are expected. Move slightly above or below the layers to see them. Experimental ray marching retains its separate diagnostic gate and remains unverified. Native performance and memory have not been measured.

## Scan Controls layout follow-up

The owner subsequently reported improved scan visibility and supplied `IMG_3687.png`: Scan Controls opened as a white sheet with pale text extending past both screen edges. The raw-text exception was gone, but usable sheet layout had not been established.

The sheet used `RNHostView matchContents` without an explicit content width. Its native ScrollView and React Native content therefore lacked a consistent horizontal constraint. The default sheet background also stayed light while the child text was styled for dark appearance. This pass applies the width-measurement pattern already used in Medical Info: measure the full native Column and constrain both header and scroll content to that width, capped at 560 points for larger devices. The presentation explicitly uses a dark background and preferred dark color scheme, rather than relying on the outer Host's environment to style the sheet's internal Host.

Done is pinned beside the title; Appearance and Crop have separate panels with readable labels. Window, Level and ray quality are shown only when the experimental shader is selected, because they cannot change the baked slice images. Renderer selection, byte probes and shader details are behind Diagnostics. The main caption is now `3D preview · scan layers`; Medical Info explains that the preview stacks 48 images and full volume rendering remains under testing. Cropping, presets, transparency, shader gates and existing AR ownership are preserved. Empty crops display a specific recovery message.

Lint/formatting, TypeScript, the 73 existing medical tests and diff whitespace checks passed. Metro remains running on port 8081 and rebundled the updated iOS modules. **The revised sheet's physical appearance, scrolling and dismissal still require a phone check**; the screenshot establishes the preceding layout failure, not the success of this repair.
