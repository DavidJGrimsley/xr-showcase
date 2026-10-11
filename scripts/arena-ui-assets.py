"""Bake Arena lettering and static Noto fonts; no font service is used by the app.

Requires: blackrenderer==0.8.2 fonttools==4.66.1 uharfbuzz==0.56.3
Bootstrap: python scripts/arena-ui-assets.py --fetch-fonts
Offline regeneration: python scripts/arena-ui-assets.py
Sources are pinned to a Google Fonts commit and accompanied by their OFL licenses.
"""
import hashlib
import argparse
import json
from pathlib import Path
import re
import tempfile
import xml.etree.ElementTree as ET
from urllib.parse import quote
from urllib.request import urlopen

from blackrenderer.render import renderText
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools import subset
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
import uharfbuzz as hb

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets/arena/ui"
COMMIT = "bd8f81ddb5c74d5c8897b36ad88b440266245103"
BASE = f"https://raw.githubusercontent.com/google/fonts/{COMMIT}/ofl/"
SOURCES = {
    "nabla": "Nabla[EDPT,EHLT].ttf",
    "bitcountink": "BitcountInk[CRSV,ELSH,ELXP,SZP1,SZP2,XPN1,XPN2,YPN1,YPN2,slnt,wght].ttf",
    "notosans": "NotoSans[wdth,wght].ttf",
    "notoserif": "NotoSerif[wdth,wght].ttf",
    "notosansmono": "NotoSansMono[wdth,wght].ttf",
}


def compact_svg(svg, prefix):
    """Round contours and scope paint/clip IDs while retaining direct glyph paths."""
    svg = re.sub(r'[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?',
                 lambda m: str(round(float(m.group()), 3)).rstrip('0').rstrip('.') if '.' in m.group() else m.group(), svg)
    ET.register_namespace('', 'http://www.w3.org/2000/svg')
    root = ET.fromstring(svg)
    # SvgXml instances also share a DOM on web; all paint/clip IDs must be unique.
    ids = {e.attrib['id'] for e in root.iter() if 'id' in e.attrib and not e.attrib['id'].startswith(prefix)}
    result = ET.tostring(root, encoding='unicode')
    for identity in sorted(ids, key=len, reverse=True):
        result = result.replace(f'id="{identity}"', f'id="{prefix}-{identity}"').replace(f'#{identity})', f'#{prefix}-{identity})')
    return normalize_svg(result)


def normalize_svg(svg):
    """Keep native glyph paints self-contained and omit paints without contours.

    Each glyph layer carries its own contour. This avoids shared Use templates
    retaining native paint/bounds state across differently transformed letters.
    A zero-length gradient is a solid paint, not a Core Graphics gradient.
    Space glyphs have no contour: painting their gradient on iOS can bypass
    clipping and fill the entire SVG canvas, obscuring previously drawn glyphs.
    """
    ET.register_namespace('', 'http://www.w3.org/2000/svg')
    root = ET.fromstring(svg)
    ns = '{http://www.w3.org/2000/svg}'
    contours = {e.attrib['id']: e for e in root.iter(ns + 'path') if 'id' in e.attrib}
    solid = {}
    for gradient in root.iter(ns + 'linearGradient'):
        if (gradient.attrib.get('x1', '0') == gradient.attrib.get('x2', '100%') and
                gradient.attrib.get('y1', '0') == gradient.attrib.get('y2', '0')):
            stops = list(gradient)
            if stops:
                solid[gradient.attrib['id']] = stops[-1].attrib['stop-color']
    for element in root.iter():
        fill = element.attrib.get('fill', '')
        if fill.startswith('url(#') and fill[5:-1] in solid:
            element.set('fill', solid[fill[5:-1]])
        if element.tag == ns + 'use':
            identity = element.attrib.get('href', '')[1:]
            if identity in contours:
                contour = contours[identity]
                element.tag = ns + 'path'
                element.attrib.pop('href')
                element.set('d', contour.attrib['d'])
    for parent in list(root.iter()):
        for child in list(parent):
            if (child.tag == ns + 'linearGradient' and child.attrib.get('id') in solid) or (
                    parent.tag == ns + 'defs' and child.tag == ns + 'path') or (
                    child.tag == ns + 'path' and not child.attrib.get('d', '').strip()):
                parent.remove(child)
        if parent.tag == ns + 'defs' and len(parent) == 0:
            parent.text = None
    root.set('preserveAspectRatio', 'xMidYMid meet')
    return ET.tostring(root, encoding='unicode')


def bitcount_svg(path, text):
    """Use the font's monochrome contours, avoiding thousands of COLR paint layers.

    Nabla retains its layered color renderer. Bitcount's glyph outlines preserve
    its ink/dot shapes and the requested variable slant with a single Arena paint.
    """
    font = TTFont(path)
    glyphs = font.getGlyphSet(location={"slnt": -8})
    shaping = hb.Font(hb.Face(path.read_bytes()))
    shaping.set_variations({"slnt": -8})
    buffer = hb.Buffer()
    buffer.add_str(text)
    buffer.guess_segment_properties()
    hb.shape(shaping, buffer)
    names = font.getGlyphOrder()
    pen = SVGPathPen(glyphs)
    bounds = BoundsPen(glyphs)
    scale = 100 / font["head"].unitsPerEm
    x, y = 0, 0
    for info, position in zip(buffer.glyph_infos, buffer.glyph_positions):
        transform = (scale, 0, 0, -scale,
                     (x + position.x_offset) * scale, -(y + position.y_offset) * scale)
        glyph = glyphs[names[info.codepoint]]
        glyph.draw(TransformPen(pen, transform))
        glyph.draw(TransformPen(bounds, transform))
        x += position.x_advance
        y += position.y_advance
    left, top, right, bottom = bounds.bounds
    width, height = right - left + 6, bottom - top + 6
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{left-3} {top-3} {width} {height}">'
           f'<path fill="__SECONDARY__" d="{pen.getCommands()}"/></svg>')
    return svg, width, height


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fetch-fonts', action='store_true', help='Bootstrap the pinned font cache; subsequent runs are offline.')
    args = parser.parse_args()
    cache = ROOT / '.expo/arena-font-sources' / COMMIT
    def source(family, filename):
        path = cache / family / filename
        if not path.exists():
            if not args.fetch_fonts:
                raise SystemExit('Font cache missing. Bootstrap once with --fetch-fonts, then regenerate offline.')
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(urlopen(BASE + family + '/' + quote(filename), timeout=60).read())
        return path
    OUT.mkdir(parents=True, exist_ok=True)
    provenance = {"commit": COMMIT, "secondaryAxes": {"slnt": -8}, "sources": {}}
    with tempfile.TemporaryDirectory(prefix="arena-lettering-") as temporary:
        temp = Path(temporary)
        files = {}
        for family, filename in SOURCES.items():
            url = BASE + family + "/" + quote(filename)
            files[family] = source(family, filename)
            data = files[family].read_bytes()
            (OUT / f"{family}-OFL.txt").write_bytes(source(family, 'OFL.txt').read_bytes())
            provenance["sources"][family] = {"url": url, "sha256": hashlib.sha256(data).hexdigest()}

        for family, weight, name in [
            ("notosans", 400, "ArenaNotoSans"),
            ("notosans", 600, "ArenaNotoSansSemibold"),
            ("notoserif", 400, "ArenaNotoSerif"),
            ("notosansmono", 400, "ArenaNotoMono"),
        ]:
            font = TTFont(files[family])
            axes = {a.axisTag: a.defaultValue for a in font["fvar"].axes}
            axes["wght"] = weight
            font = instantiateVariableFont(font, axes, inplace=True)
            # Distinct native names also work in SwiftUI Font.custom, without RN aliases.
            for record in font["name"].names:
                if record.nameID in (1, 4, 6, 16):
                    record.string = name.encode(record.getEncoding())
                elif record.nameID in (2, 17):
                    record.string = "Regular".encode(record.getEncoding())
            subsetter = subset.Subsetter()
            subsetter.populate(unicodes=list(range(0x20, 0x250)) + list(range(0x2000, 0x2070)))
            subsetter.subset(font)
            font.save(OUT / f"{name}.ttf")

        phrases = {
            "TitleFont": ["Rock 'Em Sock 'Em", "Robots", "Ready"] + [f"Round {n}" for n in range(1, 6)],
            "SecondaryTitleFont": ["Neo", "Fight!", "You Lost", "Draw"]
                + [f"You Win {a}-{b}" for a in range(4) for b in range(4)],
        }
        lettering = {}
        for role, texts in phrases.items():
            lettering[role] = {}
            for index, text in enumerate(texts):
                if role == "SecondaryTitleFont":
                    svg, width, height = bitcount_svg(files["bitcountink"], text)
                    lettering[role][text] = {"width": width, "height": height, "svg": compact_svg(svg, f'{role}-{index}')}
                    continue
                target = temp / f"{role}-{index}.svg"
                renderText(files["nabla" if role == "TitleFont" else "bitcountink"], text, target,
                           fontSize=100, margin=3, backendName="svg",
                           variations={"slnt": -8} if role == "SecondaryTitleFont" else None)
                svg = target.read_text(encoding="utf-8")
                # Keep COLR geometry/gradients. Map every paint color to the Arena palette.
                colors = list(dict.fromkeys(re.findall(r"#[0-9a-fA-F]{6}", svg)))
                for color_index, color in enumerate(colors):
                    token = "__PRIMARY__" if color_index % 2 == 0 else "__SECONDARY__"
                    svg = svg.replace(color, token)
                svg = svg.replace('fill="black"', 'fill="__PRIMARY__"')
                viewbox = re.search(r'viewBox="([^"]+)"', svg)
                if viewbox:
                    _, _, width, height = map(float, viewbox.group(1).split())
                else:
                    width = float(re.search(r'width="([\d.]+)', svg).group(1))
                    height = float(re.search(r'height="([\d.]+)', svg).group(1))
                    svg = svg.replace("<svg ", f'<svg viewBox="0 0 {width} {height}" ', 1)
                lettering[role][text] = {"width": width, "height": height, "svg": compact_svg(svg, f'{role}-{index}')}
        (OUT / "lettering.json").write_text(json.dumps(lettering, separators=(",", ":")), encoding="utf-8")
        (OUT / "font-provenance.json").write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf-8")
        print(f"Baked {sum(map(len, phrases.values()))} display phrases and four static Noto fonts.")


if __name__ == "__main__":
    main()
