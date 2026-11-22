# Tracy Arm source-fidelity audit — not photorealism acceptance

## IMPORTANT 2026-11-22 correction: georeferencing proven wrong in prior renders

USGS 3DEP ImageServer `exportImage?f=json` confirmed that the existing
256×256 original raster's **ACTUAL** WGS84 pixel extent is
`[-133.265,57.822,-133.135,57.952]`, **NOT** its historically stored
requested extent `[-133.265,57.851,-133.135,57.923]`.
The source covers approximately 7.7 km east-west and **14.4 km north-south**,
not the previously claimed 7.7×8.0 km. Its old sample spacing is about
30×56 m, not 30×31 m. Source evidence is pinned in
`assets/alaska/tracy-arm-3dep-actual-extent.json`.
The prior area/spacing claims in the archived discussion below are obsolete.

The root cause is the Esri ArcGIS ImageServer default
`adjustAspectRatio=true` for square output images. The old 30m export
was widened in latitude. The first apparent 2.108m comparison was based
on an earlier 5m export whose own bbox had also been widened; it is NOT a
valid comparison for the corrected 5m source. The corrected 5m export
uses `adjustAspectRatio=false` and the official actual WGS84 bbox. Its
comparison with the original coarse grid is **22.956m RMSE / 63.050m P95
absolute** over 65,536 samples. Four edge P95s are west 8.738m, east
73.668m, south 0.001m and north 82.894m. The source is not ready to stitch.
The old 30m source itself was unchanged on fresh export (65,536/65,536
quantized pixels identical). Never apply a hand-tuned positional shift.

The updated independent flight pilot reads the official true extent,
while the updated 5m extractor sends `adjustAspectRatio=false`,
checks USGS returned `f=json` extent and includes source GeoTIFF tags.
**All historical 5m tile artifacts predating this fix are invalid for
WGS84 source-geography rendering; the new strict decoder rejects them.**
Use ONLY the corrected new CI artifact when the new workflow finishes.

The legacy integrated PATROL Alaska map is unchanged; this is a pilot,
NOT a surveyed current glacier or a finished C185 simulation. Production
collision/sea/glacier mapping and native GPU acceptance remain OPEN.

The user-facing target is the **actual Tracy Arm terrain, shoreline, ice front,
near-coast forest and flight behaviour**, not a game scene with more procedural
texture layers. This draft documents exactly what was measured and what is
still unproven.

## Proven terrain and geodesy

- Source regional bbox: `[-133.265,57.851,-133.135,57.923]` in WGS84
  EPSG:4326. Its original baked source has 256×256 elevation cells at about
  30 m spacing, with a 1836 m source maximum. The old *integrated* Alaska map
  rotates the raster 90 degrees and compresses vertical scaling to match its
  fictional flight route; the separate `tracy-arm-true-scale.html` does not.
- The separate north-up terrain preview uses local WGS84 ECEF→ENU **metres**:
  the actual old raster footprint is approximately 7.7 km east-west ×
  14.4 km north-south. The original 1836 m elevations are not compressed.
  The raster's source-specific vertical datum is not established by the
  old dynamic-service TIFF tags, so this is not a survey-grade
  absolute-elevation claim.
- Official USGS 5 m Alaska product footprint intersected all **9/9** sample
  points in a 3×3 test over this bounding box. Project/workunit:
  `AK_IFSAR_Sum_L4_C353_2010`, collection ~2010–2012, index
  `dem_gsd_meters=5`, project vertical CRS EPSG:5703 (NAVD88), GEOID09.
  **Index metadata does not automatically certify the vertical CRS of
  an arbitrary dynamic image export.**
- The corrected small 256² Float32 export for
  `[-133.1886140472,57.8750248162,-133.1682218903,57.8863189338]`
  uses the explicit `adjustAspectRatio=false` parameter. The current
  artifact reports 4.715×4.911m spacing, 100% valid pixels, 521.443m
  maximum and TIFF SHA256
  `2c370501049c8fb779ec6a12982bb62c660c75bd6a64466781aa7503cf816a76`.
  This is a dynamic service export, not yet a pinned native OPR GeoTIFF.
  It is not safe to merge because the east and north edges differ from
  coarse source by 73.668m and 82.894m P95.
- The local experimental 5 m tile and fallback full ~30 m scene **both
  rendered and moved the camera in Chromium WebGL2** in run
  [45039658872](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45039658872).
  Do not infer real Windows GPU performance from SwiftShader.

## Source consistency — merger blocked

The 5 m source raster differs from a bilinear sampled old 30 m grid by
**169.1291 m RMSE** and **386.5136 m P95 absolute height difference** at
nominally matched geographic coordinates. Such a gap cannot safely be hidden
by color, normal maps or geometry smoothing.

Run the independent test:

```bash
python tools/alaska/build_usgs5m_tracyarm_pilot.py
python tools/alaska/audit_usgs_dem_source_consistency.py
```

The second command re-requests the original baked **exact** USGS ImageServer
URL and compares it with the locally saved old raster, then publishes:
`artifacts/alaska-tracyarm-registration-audit.json`.

The audit independently quantifies source change, sampled source-cell
registration, candidate 30 m pixel shifts, water/land disagreement and all
four edge difference distributions. **A height-edge P95 greater than 10 m is
not a shippable stitch.** Even a clean P95 requires visual/flight QA;
automatically shifting the raster to minimize error is not a valid real-world
GIS alignment method. If the dynamic service changes data source depending
on requested resolution/mosaic rules, pin a verified source-native product,
not an undocumented mixed mosaic.

## Inspect in the browser

Start an HTTP server from the repo root, then open:

- `/tracy-arm-true-scale.html` — always displays the original full 30 m DEM.
- `/tracy-arm-true-scale.html?alaskaDetail=5m` — tries a local small
  high-resolution source tile. For now that JSON exists **only as a CI
  artifact**, not a committed runtime asset. Download the
  [artifact of run 45039658872](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45039658872)
  and copy `alaska-tracyarm-five-metre-tile.json` to
  `assets/alaska/tracy-arm-five-metre-tile.json` in the local checkout;
  otherwise the browser will explicitly fallback to the existing 30 m source.

The file is intentionally NOT auto-pushed to the production game. The
small 5 m tile is completely isolated, has no original C185 flight physics
and does not blend with coarse neighbouring tiles. Browser fly-camera
screenshots prove rendering, not likeness to an on-location flight.

## Blocking changes still needed

1. Identify source-native 5 m GeoTIFF product and source-specific vertical
   datum; verify geography/cell centres against independent control points.
2. Obtain source-consistent neighbouring tiles, fit LOD with actual
   georeferenced edge constraints, without inventing elevation at missing
   coverage or hiding a 169 m source disagreement.
3. Use authoritative NOAA surveyed shoreline and known collection epoch,
   rather than assuming the bare-earth elevation alone defines the present
   water or glacier boundary.
4. Obtain properly licensed on-site orthophotos and vegetation/rock
   distribution data, compare matched WGS84 coordinates, ground heights,
   look-direction and FOV with real references. Current Poly Haven CC0
   textures are legitimately reusable but **not Tracy Arm photographs**.
5. Move the source-accurate terrain into the original flight/collision model
   *only after* both geospatial and frame-time QA; preserve compatibility and
   other maps. Do not call the 2010–2017 data a post-2025 glacier survey.

These gates are not replaced by 100% passing Node, Actions, or software
WebGL tests. Keep PR #232 **Draft** and leave `main` untouched.
