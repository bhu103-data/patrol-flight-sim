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

## 2026-11-22 — source-native full-area 5m IfSAR mosaic and opt-in flight LOD

A better source than the dynamic ImageServer resample has now been acquired:
the original USGS OPR QL5 IfSAR DTM GeoTIFFs from one project/workunit,
`AK_IFSAR_Sum_L4_C353_2010` / `Alaska_Mid_Accuracy_DEM_Summer_2015`.
This is the actual bare-earth DTM product, not the IfSAR DSM or radar intensity
image. USGS describes Alaska 5m 3DEP DEMs as bare-earth terrain models,
public domain, and seamless within collection projects (not guaranteed across
different projects). <Cite refs={["turn952681search0","turn952681search1","turn952681search3"]}/>

### Native source evidence

- Two adjacent original OPR GeoTIFFs, same QL5 project, each 5m source spacing:
  - `USGS_OPR_Alaska_Mid_Accuracy_DEM_Summer_2015_DTM_N5745W13330P.tif`
    99,018,238 bytes; SHA-256
    `643adef9cb8b4225e5f3fc2b82ee72efdc081bf6266d3e7d6f5b9163d2cb77ce`.
  - `USGS_OPR_Alaska_Mid_Accuracy_DEM_Summer_2015_DTM_N5745W13315P.tif`
    89,998,420 bytes; SHA-256
    `d09fa0e43ceaa20c9704e81bb9403d6aa9664199d139d2af3e05a7a27e89e6fe`.
- Source horizontal CRS ESRI:102247 (NAD83(CORS96) Alaska Albers), transformed
  into WGS84 EPSG:4326 only for the browser world frame. The source index
  identifies vertical CRS EPSG:5703 / NAVD88 / GEOID09 and QL5. The delivered
  per-tile FGDC XML says to consult original project metadata for vertical
  accuracy and does not independently expose a separate vertical GeoTIFF key.
  Therefore use NAVD88/GEOID09 as the official index-provided vertical datum;
  do NOT call these values WGS84 ellipsoid heights or survey-validated
  absolute flight altitudes.
- Both files are original-product 5m rasters from the same 2010–2012
  collection. They are not post-2025 landslide or glacier-front updates.
- Target actual WGS84 pixel bbox:
  `[-133.265,57.822,-133.135,57.952]`.
  Output grid: **1536×2880 = 4,423,680 source cells**, 0.1m height
  quantization, south-first row order, no NoData holes, **100% coverage**.
  Source elevations range 0.000–1892.424m.
- Source-tile overlap: 3,532,968 pixels, RMSE **0.161m**, P95 absolute
  **0.332m** (max 6.759m). Cross-tile boundary gradient P95 **6.603m**
  versus within-tile P95 **5.574m**, boundary P99 **9.295m**. The builder
  blocks the mosaic if coverage drops below 99.9%, boundary P95 exceeds 10m,
  overlap RMSE exceeds 0.5m, or overlap P95 exceeds 1m.
- Independent corrected dynamic ImageServer 5m sample at identical WGS84
  coordinates agrees with the source-native mosaic at RMSE **0.306m**,
  P95 absolute **0.768m** across 65,536 samples.

### Runtime integration status

The separate north-up source-scale flight page now has opt-in
`?alaskaSource=ifsar5m`. It loads the full native 5m source and renders a
**3×3 median 15m LOD mesh** to keep browser memory bounded:
512×960 mesh vertices, **980,098 triangles**, full 7.7×14.4km extent.
The underlying 5m samples remain preserved in the native data bundle; the
browser scene is explicitly 15m LOD, not a full 5m-per-vertex mesh. The
original 30m scene remains the default. This remains an independent
source-coordinate inspection camera, not the shipping C185 flight model.

The runtime manifest pins the source tile SHA-256 values, source project,
horizontal/vertical CRS metadata, 100% coverage, overlap and boundary seam
metrics, public-domain provenance, and source data vintage. The loader rejects
any bundle that fails those gates or attempts a cross-origin asset fetch.

**The 2.69MB base64 runtime data file is generated by CI and is not committed
to this PR's repository tree yet.** The QA workflow stages it only inside its
disposable checkout. To run the new mode locally, download the
`alaska-tracyarm-5m-source-sample` artifact from the latest successful
`Alaska source-exact 5m Tracy Arm sample build` run, then copy:
- `alaska-tracyarm-ifsar5m-manifest.json` →
  `assets/alaska/tracy-arm-ifsar5m-manifest.json`
- `alaska-tracyarm-ifsar5m-delta2-int16.bin.gz.b64` →
  `assets/alaska/tracy-arm-ifsar5m-delta2-int16.bin.gz.b64`

Then open `/tracy-arm-true-scale.html?alaskaSource=ifsar5m`.
Without both files, the page explicitly falls back to the corrected 30m
source and displays a warning. The GitHub Pages deployment will not contain
the native 5m mode until these two generated files are added to the repository.

### Do not blend with the legacy 30m map

Native 5m versus legacy 30m source comparison (using the old TIFF's true
GeoTIFF pixel bbox) remains very different: RMSE **85.67m**, P95 absolute
**224.91m**. This is a different source lineage / vertical-reference
compatibility question, not a tile seam. The native 5m mosaic is internally
continuous and covers the complete independent scene, so it does not need
the old 30m terrain to fill gaps. Do NOT stitch or blend it into the legacy
30m map based on visual smoothing. Keep it as a separate full-area source
mode until source vertical transformation and C185 collision/water coupling
are independently validated.

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

Historical dynamic 5m ImageServer samples and the old 30m source were
initially compared using incorrect requested bboxes; those old 169m values
are obsolete. The corrected dynamic 5m sample differs from the legacy 30m
source by 22.956m RMSE, while the source-native full-area 5m IfSAR mosaic
differs by 85.67m RMSE / 224.91m P95 absolute. The native IfSAR tiles are
internally continuous, but they are NOT compatible with the legacy 30m
heightfield for safe cross-LOD stitching. Keep them as separate full-area
source modes.

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
