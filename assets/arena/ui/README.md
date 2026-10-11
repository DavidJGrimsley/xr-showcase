# Arena UI assets

Arena menus bundle `menu-background.png`, copied from the supplied `IMG_3659.png`. The app uses a centered cover crop and an SVG vignette fading within the outer 8% of each edge. Camera screens do not use this artwork.

Display lettering is bundled in `lettering.json`:

- **TitleFont:** Nabla, including its layered dimensional outlines and gradients, recolored with the Arena blue/purple palette.
- **SecondaryTitleFont:** Bitcount Ink glyph contours instantiated at `slnt=-8`, using Arena purple. Monochrome contours preserve its ink shapes without the thousands of repeated COLR paint layers.
- **Body:** static Noto Sans regular/semibold, Noto Serif for the tagline, and Noto Sans Mono for codes and numbers. The fonts are subset to Latin and punctuation and use Arena-specific native family names.

All fonts are pinned to the Google Fonts commit recorded in `font-provenance.json`; each source hash and OFL license is included. Glyph paints use direct paths and solid colors in place of zero-length gradients. Empty space-glyph paths are omitted: iOS can draw their gradient across the whole SVG canvas when there is no contour to clip. Routes and invite URLs retain `arena-fighter`.

Regenerate with Python 3.11 or newer and these helper dependencies:

```text
pip install blackrenderer==0.8.2 fonttools==4.66.1 uharfbuzz==0.56.3
python scripts/arena-ui-assets.py --fetch-fonts
```

The first run caches the pinned sources under ignored `.expo/arena-font-sources/`. Subsequent `python scripts/arena-ui-assets.py` runs use only local files and work offline. The application never downloads fonts. The helper shapes text with HarfBuzz, derives SVG outlines with FontTools, and renders Nabla's color layers through Black Renderer.
