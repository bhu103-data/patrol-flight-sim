# Official 2022 Times Square pedestrian surfaces, metre-scale low-flight pilot

**This is NOT photoreal 2026 Manhattan or the default PATROL aircraft game.** This separate reversible viewer now combines real original NYC building footprints/roof heights, DCP DCM centerline data, 2022 OTI roadbed polygons, and 2022 OTI sidewalk/plaza surfaces and curb/curb-cut lines within ONE uncompressed WGS84 local metre frame.

## Source provenance and limits
- Roadbed polygon source: https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Roadbed_2022/FeatureServer/20
- Plaza polygon source: https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Plaza_2022/FeatureServer/16
- Sidewalk polygon source: https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Sidewalk_2022/FeatureServer/22
- Curb source: https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Curb_2022/FeatureServer/4
- Curb-cut source: https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Curb_Cut_2022/FeatureServer/5
- DCP DCM street centerlines: https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/ArcGIS/rest/services/DCM_Street_Center_Line/FeatureServer/0
- NYC OTI building footprints: repository's municipal FID/HEIGHTROOF snapshot.
- Official capture rules: https://github.com/CityOfNewYork/nyc-planimetrics/blob/main/Capture_Rules.md
- General open-data terms for redistribution review: https://data.cityofnewyork.us/stories/s/Terms-of-Use/k9k7-3cje

All data reflects source characteristics and vintage, NOT a November 2026 field survey. Nothing from proprietary 3D tiles, Street View photography or unauthorized advertising art is copied. Data is obtained during GitHub source QA and stays in QA artifacts, not a distributable game package.

## True geometry behavior

- Source files from existing independently validated PR #269 and PR #262 are reused in a new isolated branch on current source base PR #234; other draft PRs are not modified.
- Polygon rings, interior holes, official IDs, WGS84 metres and 2022 source provenance are retained. Independent sidewalk queries must report the same OBJECTID set.
- Build-time Earcut triangulation checks area preservation; an unavailable source, mismatched projection or invalid ring aborts the build, not a fictional fallback.
- Draw source sidewalks, plazas, curbs and curb-cuts with distinct colors alongside the source roadbeds and real building footprint extrusions. Vertical Y offsets of 0.10-0.18m are **only to separate rendering layers, NOT measured curb height or terrain elevation**.
- Existing low-flight keyboard controls and 1.2m building-outline swept collision stay unchanged. A 2022 curb line is NOT an aircraft/vehicle collision barrier, legal crossing, open lane or road-routing instruction.
- An overlay toggle allows same-browser, same-camera ON/OFF screenshot QA. Previously invented uniform-width street envelope is computed only for QA and NOT rendered.

## Verified source conflicts and remaining blockers

- PR #269 showed bounded Broadway DCM centerlines within official 2022 roadbed for **49.07%** of their length and mapped plaza for **39.44%**. Do not equate a DCM centerline with a vehicle-drivable path.
- PR #262 independent topology QA showed **0 square metres** of roadbed/building or roadbed/sidewalk overlap, but **29.492 square metres** of sidewalk/building outline overlap. The apparent differences must be reviewed against original municipal source dates/geometry; do not silently move or delete polygons.
- PR #271 found a Broadway centerline crosses building FID 981369 by about 8.44m, while real 2022 roadbed/building overlap is **0 square metres**; an administrative centerline is not a physical pavement edge.
- The pilot still lacks current curb grade and ramps, 2026 plaza and traffic timing, facade/roof topology, lawful street textures, surveyed 3D datum, source-photo matched control points, native GPU hardware timing and real aircraft/map integration. NYC realism P0 issue #229 remains OPEN.

## Exact-head acceptance

GitHub Actions must refetch municipal data, validate exact origins/IDs, triangulation/holes and topology, render actual low-flight WebGL2, exercise keyboard collision and capture overlay OFF/ON screenshot PNGs from the same pose and browser. Verify zero WebGL errors/page errors. No main, shared integration, or full game flight/render source changes; keep draft until reviewed.