# Medical UI review images

`previous-device-sheet.png` is the owner's earlier iPhone report (`IMG_3687.png`), before the scan sheet width/contrast fixes. It is historical evidence, not a capture of the saved medical baseline.

The four `*-preview.png` images show the updated medical control tree through Expo UI's browser implementations at 390 × 844. They cover Anatomy, Scan Slices, the scan controls sheet, and Medical Information. The preview substitutes AR/native modifiers and automatically completes asset loading so the controls can be inspected without a camera. Scientific images and actual native rendering are not simulated.

The updated sheet was also checked at 320 × 568, 844 × 390, and 1024 × 768. Its scrolling body is bounded independently of the pinned Done header; larger widths cap content at 560 points. Component tests cover native measurements and large text. Physical iPhone acceptance remains required.
