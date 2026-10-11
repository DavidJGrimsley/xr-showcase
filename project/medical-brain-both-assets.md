# Medical Viewer supplied models

The owner supplied Skull3D.obj, Skull3D-Half.obj, and MRI_Elastix mask.obj from F:/ReactNativeApps/xr-showcase-i2Workspace/temp/medical-scans/VisibleHumanHead/From3DSlicer on 2026-10-09, and confirmed the same NLM Additional Head Images dataset and brain/skull registration in Slicer. The source copies are preserved. The supplied full-skull OBJ hash matches the source of the existing packaged skull, which stays unchanged.

The dropdown contains Skull, Brain, Half Skull, and Both. Both is the default when opening a fresh Medical Viewer. Skull displays the original full skull; Brain and Half Skull display their own supplied surfaces; Both displays Half Skull and Brain together. There are no stand-ins. Reposition and Restart AR retain the selected mode; leaving and reopening creates a fresh controller with Both selected.

Both shares one plane anchor and parent height, scale, and yaw. Switching modes preserves placement and pose, starts a new load attempt, and invalidates older model callbacks. Both becomes ready only after its two slots finish loading; Retry reloads the pair after either failure. Only the original full Skull has labels. Brain and Half Skull anchors/names need owner approval before adding labels.

## Source conversion and alignment

Each OBJ declares SPACE=LPS. Exported coordinates are treated as LPS millimetres, consistent with the existing full-skull source and observed bounds. Both new assets use the exact same origin and LPS-to-model matrix recorded in assets/medical/skull-provenance.json. The conversion is baked into vertex coordinates, so each child uses position [0,0,0], rotation [0,0,0], and scale [1,1,1]. The common parent performs user transforms. No independent centering, grounding, anatomical rotation, scale matching, or new registration adjustment is applied.

The output frame is Y-up metres, anterior +Z, anatomical left +X. The half-skull occupies the anatomical-left side, preserving the exposed opposite side for viewing the brain. Source hashes, bounds, conversion matrix, simplification, budgets, attribution, and owner confirmation are recorded in brain-provenance.json and half-skull-provenance.json.

| Asset | Source triangles | Packaged triangles | Bytes |
| --- | ---: | ---: | ---: |
| Full skull (unchanged) | 6,053,660 | 145,991 | 3,395,900 |
| Brain | 948,928 | 65,000 | 1,171,144 |
| Half skull | 2,343,564 | 79,817 | 1,272,044 |

Both totals 144,817 rendered triangles and 2,443,188 bytes of packaged geometry. The preparation pipeline removes sub-0.1 mm disconnected debris and degenerate faces, then simplifies surfaces. Brain is a single connected source surface; the half-skull retains multiple anatomical components. Models use opaque matte bone ivory and brain rose for readable educational presentation. Display colours do not classify tissue clinically.

To regenerate using the installed Blender 5.0.1, from this repository, invoke Blender with --background --factory-startup --python scripts/prepare-medical-models.py -- --source-directory "F:/ReactNativeApps/xr-showcase-i2Workspace/temp/medical-scans/VisibleHumanHead/From3DSlicer" --registration-confirmed --preview-directory .expo/medical-integration/preview.

This uses the existing cleaner and skull matrix, leaves sources untouched, writes two GLBs and their provenance records, and optionally renders local inspection images. All packaged GLBs are self-contained, without Draco or external textures. The script's registration flag records the owner's confirmation, not a computed registration accuracy result.

## Acceptance

Geometry/hash/bounds tests and the combined offline preview verify conversion integrity and shared coordinates. They do not establish clinically calibrated registration accuracy or native AR performance. Physical iPhone acceptance remains owner work: test all four selections before/after placement, rapid switching during loading, failure/retry, Both pinch/rotate and transform sliders, Reposition/Restart, background/resume, lost planes, Home teardown, safe-area layout, Dynamic Type, and VoiceOver. Repeat native menu and placement checks on Android. Confirm visual pair alignment and original Skull label readability on the device.

The [NLM project page](https://www.nlm.nih.gov/research/visible/visible_human.html) describes the image data as public-domain, and the [collection README](https://data.lhncbc.nlm.nih.gov/public/Visible-Human/Additional-Head-Images/README) identifies the source collection. Attribution remains Courtesy of the U.S. National Library of Medicine, with Brigham and Women's Hospital / Harvard Medical School, Peter Ratiu and colleagues. Educational visualization only; segmentation and labels are not clinically validated.
