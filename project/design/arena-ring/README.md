# Wider ring design reference

`arena-ring-reference.png` is the selected low-profile concept for Viro Studio's image-to-model input. It was generated with the built-in image tool using the supplied boxing-ring inspiration, Mr. DJ's Arcade artwork, and a title reference rendered from the game's bundled lettering. It is a design reference; the app's GLB and gameplay dimensions have not been changed.

## Source artwork

- `arena-title-exact.svg` and `arena-title-exact.png`: exact bundled glyphs and palette, with Neo in SecondaryTitleFont (Bitcount Ink, slnt=-8) and both Rock 'Em Sock 'Em and Robots in TitleFont (Nabla). The PNG has a transparent background.
- `mrdjs-arcade-skirt-art.png`: unchanged copy of the user's original `D:/Media/ContentCreation/Mrdjsarcade1.png`, 479 x 481 pixels. Preserve its 479:481 aspect ratio on every physical skirt face. Fit it with uniform scaling; do not stretch its UV mapping across a wide rectangle.
- `ring-image-prompt.txt`: reusable image prompt including the proportions and branding constraints.

The generated reference depicts compact nearly square side badges. Generated image/model lettering may still differ from the exact source art. Use the source textures above when preparing the final GLB to preserve the real typography and logo proportions, including the unseen side faces.

## Intended game dimensions

At default scale, the existing ring's longest horizontal span is 0.60 m and its fighting floor is approximately 0.061 m above the table. The proposed ring is 1.5 times wider and deeper (approximately 0.90 m across, 2.25 times the area), with the same floor, rope and post heights and the same fighter size.

During import, fit horizontal dimensions independently of vertical dimensions; preserve the fighting floor alignment. Increasing the visual ring alone will not increase playable space: the authoritative movement boundary and shared prediction geometry must be updated together and checked on both phones. No app source, runtime asset, match rules or protocol were changed by this design-reference work.
