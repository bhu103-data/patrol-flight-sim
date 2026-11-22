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
