# DUMBO Front / Dock — official 2022 sidewalk, curb and curb-cut source audit

This independent draft performs a bounded municipal-data acquisition only.
It does not render new streets, modify original PATROL flight, or approximate heights.

## Official source identity and reuse

- WGS84 bounding extent: [-73.99270, 40.70215, -73.98955, 40.70309].
- Road origin WGS84 (-73.992042, 40.702634), identical to the existing #270 OTI 2022 roadbed source.
- [SIDEWALK 2022 /22](https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Sidewalk_2022/FeatureServer/22) polygons with holes.
- [CURB 2022 /4](https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Curb_2022/FeatureServer/4) polylines.
- [CURB_CUT 2022 /5](https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Curb_Cut_2022/FeatureServer/5) polylines.
- [City terms](https://data.cityofnewyork.us/stories/s/Terms-of-Use/k9k7-3cje) and [NYC planimetric capture rules](https://github.com/CityOfNewYork/nyc-planimetrics/blob/main/Capture_Rules.md). Preserve city attribution and original record ID, source ID, subtype, status and WGS84 geometry.

The small bbox is an intersecting-feature query, not a clipping operation:
an original source polygon may extend outside the requested rectangle. All
rings/holes and polylines are saved unchanged in the QA artifact. No source
geometry is secretly re-snapped to old fictional city lots.

## Reproducible, fail-closed extraction

On Node 22 run:
1. node --test tests/nyc-dumbo-front-dock-pedestrian-source.test.mjs
2. node tools/nyc/collect-front-dock-pedestrian-source.mjs

A new isolated free GitHub Actions workflow executes the same sequence. Artifact
source.json contains whole official GeoJSON geometries/IDs plus provenance;
audit.json gives per-layer record/vertex/page counts and dated source details.
If official required SIDEWALK/CURB is missing, a page is invalid, a duplicate
ID is found or a source request times out, the workflow fails. CURB_CUT can be
empty for this small bounding box; an empty official return is not permission
to invent any curb ramps. CURB_CUT features can denote vehicular driveways
and must not be labelled accessible pedestrian curb ramps without other evidence.

## Hard nonclaims and next gate

2022 planimetrics are NOT 2026 as-built NYC, including the DUMBO bike
proposal or 2025 restoration. Data include no validated sidewalk/crosswalk
elevation, curb-face height, wheelchair ramp grade, signal timing or
street-level photograph rights. No source Z is applied.

After extraction, a SEPARATE opt-in 1:1 metric viewer can intersect these
official polygons with #270's 553 roadbed triangles and 48 source buildings.
A registered topological audit, genuine WebGL2 street and oblique screenshots,
visual no-overlap, road-to-sidewalk boundaries, low-quality fallback and real
Windows GPU P50/P95 must precede any gameplay change. Do not transplant the
Times Square-only sidewalk pilot #262 into Brooklyn. Do not combine #284's
four flagged centerline/building intersections with active driving lanes.
No change to main, #259, flight control, other maps or source JSON.
