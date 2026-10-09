# Medical Viewer assets

The packaged skull is derived from the owner's `Skull3D.obj` segmentation, exported
from 3D Slicer. The original OBJ and downloaded scans stay outside the application
at `F:/ReactNativeApps/xr-showcase-i2Workspace/temp/medical-scans/VisibleHumanHead/`.
Neither the scan files nor patient metadata are packaged or committed.

Source: [NLM Additional Head Images](https://data.lhncbc.nlm.nih.gov/public/Visible-Human/Additional-Head-Images/README),
specifically its [CT series](https://data.lhncbc.nlm.nih.gov/public/Visible-Human/Additional-Head-Images/MR_CT_DICOM/CAT/).
This is the additional head collection, not the original Visible Human Male body scan.
The collection credits Peter Ratiu and colleagues at Brigham and Women's Hospital /
Harvard Medical School. [NLM's Visible Human project page](https://www.nlm.nih.gov/research/visible/visible_human.html)
describes its public-domain image library and links this collection. Both source
references and attribution are recorded in `assets/medical/skull-provenance.json`.

## Rebuilding

Run `npm ci` first. Node must be on PATH. The preparation tool was validated with
Blender 5.0.1 on Windows:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe' --background --factory-startup --python 'scripts\prepare-medical-skull.py' -- --source 'F:\ReactNativeApps\xr-showcase-i2Workspace\temp\medical-scans\VisibleHumanHead\From3DSlicer\Skull3D.obj'
npm run test:medical
```

The script requires Slicer's `SPACE=LPS` header, hashes the source, removes zero-area
triangles and connected fragments whose longest bounding-box dimension is below
0.1 mm, then simplifies the retained geometry. Larger disconnected structures are
retained; this is deliberately not a largest-island filter. Decimation targets
149,000 triangles before geometry validation and subsequent degenerate-face cleanup.
The final mesh must stay within 150,000 triangles and 10 MiB. GLB is uncompressed,
uses one opaque ivory material, has no textures, and needs no external resources.

LPS coordinates enter Blender without the OBJ importer's automatic rotation.
Blender's glTF conversion maps `(x, y, z)` to `(x, z, -y)`. Units change from
millimetres to metres. Horizontal centring and the final floor correction are
recorded in the provenance transform. The final model is about 17 cm wide, 21 cm
tall and 22 cm deep. Scale 1 follows the scan; the controls clamp display scale to
0.5–3. The original source is never overwritten.

## Labels and review

`skull-labels.json` records surface ray intersections for frontal bone, parietal
bone, zygomatic bone and mandible. The rays are defined in the preparation script
against the final mesh, not against a generic skull. Exported-surface distance is
checked by the asset tests. Review renders of the original and simplified skull
preserved the silhouette, eye sockets, nasal opening, teeth and jaw; coloured
anchor renders were inspected at the forehead, side of the cranial vault, cheek
and chin. This establishes mesh calibration, not clinical anatomical validation.

Labels default off. Their anchors and leader positions rotate/scale with the skull;
text and marker sizes stay constant in world space. Physical phone readability
and the owner's confirmation of the anatomical locations remain pending.

Brain is intentionally unavailable. A future brain export needs its own verified
source/transform and labels. A combined view additionally needs verified CT/MRI
registration; the current skull's centring transform must be accounted for.
