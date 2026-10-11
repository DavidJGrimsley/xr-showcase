# Medical UI review images

`previous-device-sheet.png` is the owner's earlier iPhone report (`IMG_3687.png`), before the scan sheet width/contrast fixes. It is historical evidence, not a capture of the saved medical baseline.

The six `*-preview.png` images show the updated medical control tree through Expo UI's browser implementations at 390 × 844. They cover Anatomy, Scan Slices, the scan controls sheet, Medical Information, the shared transform editor, and its XYZ Position controls. The preview substitutes AR/native modifiers and automatically completes asset loading so the controls can be inspected without a camera. Scientific images and actual native rendering are not simulated.

The updated sheet was also checked at 320 × 568, 844 × 390, and 1024 × 768. Its scrolling body is bounded independently of the pinned Done header; larger widths cap content at 560 points. Component tests cover native measurements and large text. Physical iPhone acceptance remains required.

The previews include the compact-control pass: 44-point buttons, narrower model selection, smaller gaps, dense transform sliders, and short labels with complete accessibility names. Native picker/slider hit regions use their platform implementation; their browser rendering is supplementary evidence.

Robots, Qubit, and all Medical representations now share the editor shown in `transform-controls-preview.png` and `position-controls-preview.png`. Scale/Rotate and Position/Reposition/Done use wrapping rows; Position has left/right, up/down, and forward/back sliders. Component tests verify all five wrappers against their real controllers. Actual scene motion still needs phone acceptance.
