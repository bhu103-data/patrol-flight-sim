# NYC official sidewalks, curb lines and curb cuts — source QA only

This is a child of **#244**, the 2022 NYC OTI ROADBED polygon source. It makes no changes to PATROL production flight/map/traffic and does not turn centerline widths into road meshes.

## Verified official REST layer types and source IDs
- [Sidewalk_2022 /22](https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Sidewalk_2022/FeatureServer/22): **polygon**; ROW sidewalk `380000`, interior sidewalk `380010`.
- [Curb_2022 /4](https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Curb_2022/FeatureServer/4): **polyline**; source subtype `225000`. OTI records curbs only where they exist within right-of-way.
- [Curb_Cut_2022 /5](https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Curb_Cut_2022/FeatureServer/5): **polyline**; midblock curb-cut `222600`, corner curb-cut `222700`.
- These are from **2022** aerial planimetrics and do not describe all 2026 as-built infrastructure; refer to [NYC data reuse terms](https://data.cityofnewyork.us/stories/s/Terms-of-Use/k9k7-3cje).
- Curb polylines in the service declare `HasZ:true`, but neither feature Z nor underlying EPSG:2263 feet are silently assumed to be compatible with the reference game Y coordinate. Z is **not imported**, only its existence is flagged for later vertical datum analysis.

## What the child actually creates
- Fetches small bbox-bounded, paginated official GeoJSON data in the exact parent origin WGS84 → east/north metre transform.
- Preserves sidewalk polygons with holes, curb and curb-cut source lines, SOURCE_ID/OBJECTID, category/status, without fabricating right-of-way widths or replacing missing cuts with a guessed ramp.
- Outputs a source-only `edges.json` and `sidewalk-curb.svg` clipped **for display**, never warped into fake local geometry.
- Same robust fail-on-error behavior as #244; malformed service responses and missing required sidewalk/curb features cannot silently become cubes.

## Explicit unfinished blocking work
The eventual 3D geometry must reconcile sidewalk polygon with roadbed boundaries and buildings; separately verify curb vertical datum, curb-cut elevations, accessibility, road/bridge levels and physical traffic/driving routes. Flat reference patches cannot be described as scanned or site-surveyed streets.

No main, #211, #234, #244, #247, #250, Alaska, Chongqing, Las Vegas, aircraft physics or map switch modifications.

## Actual 1:1 WebGL2 reference, not a survey rendering

The child now adds `scripts/nyc-sidewalk-curb-webgl-preview-build.mjs` and `tools/nyc/sidewalk-curb-browser-smoke.mjs`. The builder uses the **original polygons** with Earcut plus its per-polygon area-deviation check; the 54 OTI sidewalk shapes generate 11,192 kept triangles (114 numerically degenerate triangles were excluded) and retain 86 rings. It adds 201 official curb features and 217 official curb-cut features as measured 2D lines. The browser checks the exact same origin as 118 NYC source buildings and the parent's 81 OTI roadbed polygons. Different camera-orbit PNGs are required; rasterized 2D outlines are not treated as complete 3D sidewalk profiles.

Reference color-height offsets `y=.05/.057/.090` are **only to avoid Z-fighting in the flat WebGL QA viewer**. These values are not source-measured curb heights or sidewalk elevation differences, and must never be used for vehicle collisions, accessible ramp grades or real roadway drains. Source imagery belongs to 2022; no claim of present-day facade/street textures.

## Topology source-quality blocker, not silently fixed

`tools/nyc/official-street-topology-audit.py` runs source polygons through an independent Shapely (BSD) topology audit against the official 1:1 source building footprints. It publishes `topology-audit.json` with roadbed-versus-sidewalk and roadbed-versus-building overlap area, sidewalk-versus-building overlap area, and original curb length lying within 1 metre of a source roadbed boundary.

A local inspection of the same downloaded source data found that roadbed/sidewalk and roadbed/building area overlaps are zero, while sidewalk/building polygons overlap approximately **29.5 square metres** in the bounded tile. Example source pairs to review include sidewalk `9867` vs building FID `300973`, sidewalk `10668` vs FID `935825`, and sidewalk `10422` vs FID `941790`. The audit must **report**, not erase, these source discrepancies. They may come from footprint chronology, source capture rules or features such as overhangs. Exact-head CI decides if these findings replicate; even a green source topology check does **not** set `readyForProductionFlightGame:true`.

Future implementation must compare these cases against authoritative local footprint/curb/ground information, and retain the draft gate until resolved.
