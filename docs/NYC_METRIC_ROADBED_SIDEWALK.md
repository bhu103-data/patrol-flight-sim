# Times Square municipal Roadbed and Sidewalk polygon pilot

**Status:** independent Draft stacked on #240. **Not** a flyable/photoreal/finished road-surface replacement.

## Why this is a separate stage

#240 establishes metres, an explicit local WGS84 ECEF→ENU origin, 118 source building shells, original-source NYC CSCL street axes and NYC historic curb lines. A street centerline even with a `streetwidth` attribute is **not** an accurate roadbed boundary. A curb line alone is **not** a filled roadway surface. Therefore this follow-up handles the actual municipal roadbed and sidewalk **MultiPolygon footprints**, including holes and discontinuities, without manufacturing a rectangular street strip.

## Verified official dataset identities; historical time basis

- **Roadbed:** NYC Open Data [NYC Planimetric Database: Roadbed](https://data.cityofnewyork.us/d/i36f-5ih7), SODA `/resource/i36f-5ih7.json`, `the_geom` = `MultiPolygon`.
- **Sidewalk:** NYC Open Data [NYC Planimetric Database: Sidewalk](https://data.cityofnewyork.us/d/vfx9-tbb6), SODA `/resource/vfx9-tbb6.json`, `the_geom` = `MultiPolygon`.
- The city's [Planimetrics Capture Rules](https://github.com/CityOfNewYork/nyc-planimetrics/blob/main/Capture_Rules.md) and [2022 source metadata](https://services6.arcgis.com/yG5s3afENB5iO9fj/arcgis/rest/services/Roadbed_2022/FeatureServer) describe 2022 aerial photography (Manhattan March 18, 2022), with updates completed in 2023. **No claim of November 2026 curb/sidewalk or restored pedestrian-plaza conditions.**
- The enclosed source data are NYC Open Data; each source/version retains provenance. No Google photos, 3D tiles, user-submitted textures, third-party trademarks or paid API.

## Data collection and measured geometry

Run the following from this branch in a proper internet-connected checkout:

```sh
node tools/nyc/fetch-times-square-cscl.mjs
node tools/nyc/fetch-times-square-curbs.mjs
node tools/nyc/fetch-times-square-planimetrics.mjs
python3 -m http.server 8765
# Open http://localhost:8765/nyc-metric-pilot.html
```

The new step requests only the existing #240 WGS84 bounding box `[-73.9902,40.7548,-73.9824,40.7605]` using `within_box(the_geom,...)`, with a 2000-record fail-closed cap per source. It does **not** invent missing side streets or roadbed fills. It preserves all original WGS84 external and internal polygon rings, rejects invalid/unclosed geometries, and keeps any inner holes. Source `SOURCE_ID` is not assumed globally unique; an audit-only positional row ID is attached without changing the source value.

The raw results are written as two versioned, timestamped **QA artifacts**, not checked into the normal game runtime:
- `artifacts/nyc-metric-pilot/roadbed-polygons.json`
- `artifacts/nyc-metric-pilot/sidewalk-polygons.json`

The independent WebGL2 preview calls `buildMetricPlanimetricOutlines`. Every exterior ring and hole boundary is converted with the **same** `wgs84ToLocalMetres` as official buildings, CSCL and curbs. The visible line work is clipped only at the preview's geographic boundary; full source coordinates are retained in artifact JSON. Roadbed boundaries are pink; sidewalk boundaries green; CSCL is orange and historic curbs cyan.

## Important exclusions and merge blockers

- **Only polygon outlines now:** no tessellated filled roadbed, sidewalks, medians, crosswalks, curb heights, pavement material, storm drains, surfaces, physical contact or vehicle collider generation. Filling a polygon using a naive triangle fan would incorrectly bridge holes and intersections. A hole-aware renderer requires its own geometric acceptance: triangle-area reconciliation, no out-of-bound vertices and robust behavior with multiple exterior/inner rings.
- **Not current authoritative street details:** intersection closures, Times Square pedestrian plaza borders, 2022–26 street works and street furniture need more recent independent source audit. Source geometry differences must be reported, not silently “fixed” by artist.
- **Not in `index.html`**: original Manhattan remains compressed; no flight, aircraft, control, collisions, traffic, water, Alaska, Vegas, Chongqing, or Cosmos changes.
- **No survey residuals yet:** 3+ independent official control points in the same frame still needed. A coordinate transform is not a surveyed scene-reconstruction certificate.
- **No real hardware GPU acceptance:** CI SwiftShader WebGL2 screenshots validate source geometry and console errors only, not FPS P50/P95, VRAM or real-device loading time.

## Acceptance gates

1. CI must actually retrieve and timestamp both real NYC datasets, not use fabricated local polygon fixture for the screenshot.
2. Source audit must report accepted/rejected records, outer rings, inner rings, vertices, URL and bounding box; `inputRows>=3` and not truncated.
3. The same official geographic perimeter must be visible in both oblique and north-up WebGL2 shots beside buildings, centerlines and curbs. No JS/WebGL errors or context loss.
4. Node geometry/regression must pass and preserve the existing game. The parent #240 must remain Draft until the existing historic curb layer is independently verified.
