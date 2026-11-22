# Tracy Arm source-fidelity audit — not photorealism acceptance

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
  the full original region is approximately 7689 m east-west × 7990 m
  north-south, and the original 1836 m elevations are **not compressed**.
  The raster's source-specific vertical datum has not been independently
  established by the bundled old GeoTIFF metadata, so this is not a
  survey-grade absolute-elevation claim.
- Official USGS 5 m Alaska product footprint intersected all **9/9** sample
  points in a 3×3 test over this bounding box. Project/workunit:
  `AK_IFSAR_Sum_L4_C353_2010`, collection ~2010–2012, index
  `dem_gsd_meters=5`, project vertical CRS EPSG:5703 (NAVD88), GEOID09.
  **Index metadata does not automatically certify the vertical CRS of
  an arbitrary dynamic image export.**
- A **real** official 256² Float32 TIFF was extracted from ImageServer for
  the small bbox
  `[-133.1886140472,57.8750248162,-133.1682218903,57.8863189338]`.
  Requested pixel spacing is approximately 4.715 m × 4.911 m;
  valid pixel fraction 100%, local peak 776.73 m, TIFF SHA256
  `1be5b08b0e62595a7676932bbecf11952020bb4ede3e58d05f8aca5516605e61`.
  This **does not** verify 5 m full-scene product continuity.
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
