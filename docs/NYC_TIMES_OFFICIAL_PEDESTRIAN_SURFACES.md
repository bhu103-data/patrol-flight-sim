# Times Square source P0 — real official plaza and sidewalk polygons

**Standalone municipal-source QA layer, not the live PATROL flight map.**
Child of the existing official 2022 OTI Roadbed polygon draft #244,
which itself depends on official building FIDs and DCM centerlines in #234.

## Genuine geometry
- NYC OTI PLAZA_2022, FeatureServer/16 (hard-surface public plazas,
  including raised/plaza subtype):
  https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Plaza_2022/FeatureServer/16
- NYC OTI SIDEWALK_2022, FeatureServer/22 (ROW and interior sidewalk):
  https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Sidewalk_2022/FeatureServer/22
- Existing roadbed dataset #244:
  https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Roadbed_2022/FeatureServer/20
- Existing official DCM (DCP) Street Centerline in #234:
  https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/ArcGIS/rest/services/DCM_Street_Center_Line/FeatureServer/0
- Existing NYC OTI Building Footprints snapshot FID and HEIGHTROOF,
  read-only from current repo.

All polygon WGS84 output positions are mapped by the *same*, uncompressed
local east/north metre converter and origin as #234 and #244. Feature
OBJECTID, SOURCE_ID, SUB_FEATURE_CODE, STATUS, all polygon rings and holes
are preserved in source-only QA. **Neither source URL nor geometry is an
invented constant-width road strip**. The local ENU projection should
not be advertised as a cadastral horizontal accuracy certificate.

Official NYC capture rules:
https://github.com/CityOfNewYork/nyc-planimetrics/blob/main/Capture_Rules.md
General NYC OpenData terms:
https://data.cityofnewyork.us/stories/s/Terms-of-Use/k9k7-3cje

The source planimetrics use March 2022 Manhattan aerial imagery, with
later citywide planimetric updates (2022-23). This is not guaranteed to
represent street or plaza changes as of November 2026. Source data and
rules require current redistribution/derivative review before static
bundling into a distributed game.

## Run (GitHub Actions only; no production changes)

1. Run the parent official DCP source pipeline to produce
   artifacts/nyc-true-scale/source.json.
2. Run the existing official OTI roadbed pipeline to produce
   artifacts/nyc-roadbed-source/roadbed.json.
3. Run scripts/nyc-times-pedestrian-plaza-source.mjs, fetching the
   actual public PLAZA + SIDEWALK polygon GeoJSON from municipal APIs.
4. Inspect artifacts/nyc-oti-pedestrian-source/pedestrian-surfaces.json
   and pedestrian-roadbed-overlay.svg.
5. Inspect the actual browser PNG and JSON; fake copy/paste rectangles
   or unsupported street width should fail QA.

## Interpretation of polygon classes
- Roadbed polygons show paved **roadbed mapping**, not confirmed 2026
  traffic right-of-way, number of open lanes or street signal state.
- Plaza polygons identify mapped public hardscape/plazas in 2022.
  A central pedestrian plaza must not be treated as car-drivable
  just because a road centerline exists there.
- Sidewalk polygons distinguish mapped ROW versus interior walkways;
  the source does not establish accessible curb ramps or 3D elevation.
- Layer boundaries can differ by vintage and mapping rules; any
  building/roadbed/plaza/sidewalk overlap gets recorded for explicit
  review rather than silently snapped to fictional paths.

**Visual realism NOT ACCEPTED** until physical facades, actual plaza
paving and curbs, sidewalk elevations, cameras aligned to independently
verified control points, bridge/rail grade, legitimate LED placements,
traffic control and measured real-GPU frame-time performance are
implemented as a bounded *replacement* to existing compressed roads.
No main or shared game renderer changes in this child PR.
