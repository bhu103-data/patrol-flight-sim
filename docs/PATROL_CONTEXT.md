# PATROL_CONTEXT — unified continuation record

_Initialized 2026-11-22 (New York) from actual current repository state and
`docs/ACTIVE_FLIGHT_SIM_HANDOFF.md`. **The named file
`docs/PATROL_CONTEXT.md` was absent** on the checked main/head branches;
`$patrol-context-run` was not present in the connected installed skill list.
This is a new, explicitly recorded handoff, NOT a claim that an older
`PATROL_CONTEXT.md` was read._

## Repository and safety
- Repo: https://github.com/bhu103-data/patrol-flight-sim
- Last inspected main: `6aee03e32cd06967451007d15d5fd9502f92de36` (Chongqing)
- Preserve main and all shared integration branches; isolated branch only.
- Do not overwrite unrelated NYC traffic, Times Square, Manhattan, Alaska,
  Vegas, Chongqing, cosmic scene, seaplane/floatplane, or flight control code.
- Existing true-metre #238/#243 NYC previews are NOT already in the gameplay
  city world; the live PATROL scene still uses compressed world coordinates.
- User-requested flight control/map switching/water-buoyancy preservation is a
  hard regression gate, not implied by unit tests alone.

## Current narrowly scoped effort — one DUMBO official polygon roof
- Working branch:
  `feat/nyc-dumbo-fid1080628-roof-terrace-20261122`.
- Parent: #204 branch `feat/nyc-dumbo-oti-deep-reveals-20261122-chat`,
  parent head `53f00bd16b6520c161ed85db81f9fa3bf2065ebc`.
- #189 source QA -> #192 real Brooklyn OTI polygon pilot ->
  #204 physically recessed facade windows -> **this bounded roof extension**.
  Do not reimplement #182 synthetic rooflights or #123 two different
  special heritage warehouse roofs.
- One near visible pilot: source FID 1080628 / BIN 3389054 /
  HEIGHT_ROOF 121 ft / 12 original source exterior vertices,
  original game proxy center x=366.89, z=-346.09.
- Original source: NYC OTI `BUILDING_view` ArcGIS
  https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/BUILDING_view/FeatureServer/0
  from official NYC BUILDING dataset
  https://data.cityofnewyork.us/City-Government/BUILDING/5zhs-2jue
  under NYC Open Data terms
  https://opendata.cityofnewyork.us/overview/
- Inherited #192/#204 source rings are real; their uniform fit to fictional
  game lots is **not** georeferencing or a 1:1 district.
- This branch's new `index.html` geometry keeps the original OTI polygon
  roof exterior, adds two clipped, jointly area-preserving planar fields
  with 0.64 PATROL-unit authored step, a vertical join, coping and physical
  stone facade stringcourses. **Inner tier line, pitch and 0.64-unit drop
  are new artistic geometry, NOT actual surveyed roof facets.**
- 2014 OTI city 3D model / BK02 archival 3dm source
  https://data.cityofnewyork.us/d/u5j4-zxpn has potential roof surfaces,
  but this FID's surfaces have NOT been located or matched. No falsely
  sourced heights, current facade photo scans or fake CityGML input.
- No new GLB, external texture, network request or runtime library;
  old LOD3-only source-pilot gate and fallback stay; existing worker building
  collider envelope, roads, bridges, map switching and plane systems unchanged.

## Files changed for the roof task
- `index.html`: one FID-only clipped real polygonal roof and masonry layers
- `tests/nyc-dumbo-oti-source-silhouette.test.mjs`: permits the
  explicitly bounded two-height roof for this FID only
- `tests/nyc-dumbo-fid1080628-roof.test.mjs`: executes actual production
  source geometry and checks area, triangle winding, planar roof levels,
  unchanged other FIDs, and conservative road/flight proxy bounds
- `tools/nyc/dumbo-fid1080628-roof-ab.mjs`: fixed source cameras and
  SwiftShader WebGL2 A-B-B-A screenshot/first-load/rAF evidence
- `.github/workflows/nyc-dumbo-fid1080628-roof.yml`: full
  Node cross-map tests + side-by-side actual PATROL before/after browsers
- `assets/nyc/DUMBO_OTI_SOURCE_NOTES.md`: provenance and caveats
- `docs/PATROL_CONTEXT.md`: this checkpoint

## Evidence and QA gate
- Run `node --test tests/*.test.mjs` against this exact branch HEAD.
- Actions workflow must report passed source topology, no shell/road
  boundary intrusion, and WebGL2 errors 0 on both production flight scenes.
- Review **actual** same-camera FID rooftop and street screenshots,
  full-size PNG rather than CSS/HUD; preserve first-load elapsed time and
  rAF p50/p95 with software renderer limitations. A changed PNG or green
  build does **not** prove roof measurements or photorealism.
- Follow existing city/collision/floatplane QA workflows; if any fail, leave
  PR Draft and report exact path/reason. Check file diff and branch parent
  before merging into the main integration candidate.
- Current status: code pushed on independent branch, exact-head QA underway;
  **NOT MERGED**. Populate CI run IDs, exact commit and measured budget after
  actual Actions results, without fabricating a result.

## Outstanding required tasks
1. Extract and identify 2014 archival BK02 rooftop surfaces for this actual
   BIN; validate their scope and current applicability before calling inner
   roof setbacks `official`.
2. Compare bridge-to-DUMBO real street/building coordinate fit: current
   game placement is a historical compressed prototype, not true georef.
3. Human inspect occlusions, facade and skyline, close low flight and
   aircraft/collider clearance with real GPU hardware frame-time.
4. Coordinate parent #204 and the parallel source-derived #243, traffic
   integration #211, and other active geometry PRs; do not merge stack out of
   order or overwrite others.
