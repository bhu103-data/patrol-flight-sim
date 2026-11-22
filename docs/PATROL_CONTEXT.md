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
  stone facade stringcourses. **Inner tier line, two flat elevations and 0.64-unit drop
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


## Verified runtime handoff — same-camera FID1080628 A/B (2026-11-22)
- **Working Draft PR:** https://github.com/bhu103-data/patrol-flight-sim/pull/264
  (child of #204). Latest visual/code branch before this checkpoint:
  `cf3e1cb14588ff8cb7403fb1076a1091d4ef1897`.
  `main` and other PR branches were not updated.
- **Measured exact live production geometry** (same original OTI polygon):
  - Before #204: 441 quads + 9 roof triangles;
  - After: 449 quads + 11 roof triangles;
  - Net **+8 quads/+2 triangles = +18 rendered triangles** in existing
    batched city mesh, with no new separate draw call, GLB, texture or import.
  - 6 stone facade stringcourse quads, 2 roof step/coping quads, same
    45 windows/1 door, source projected exterior polygon area
    **59.7243776392 PATROL units²** both before and after.
  - Source FID 1080628, BIN 3389054, HEIGHT_ROOF 121 feet, original 12
    WGS84 source points. Game x/z and 0.64 step **not** true survey coordinates.
- [Node and source/geometry QA run 45038610113](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45038610113):
  **10/10 targeted; 480/480 full cross-map Node tests passed**.
  C185 live WebGL, Alaska WebGL and bridgehead live traffic checks also passed
  on original `cf3e1cb` head. Independently check run details for remaining
  Brooklyn bridgehead browser and latest matched-camera workflow before merge.
- **Actual A/B matched-browser artifact:**
  [run 45038471784](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45038471784),
  [artifact 14760329307](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45038471784/artifacts/14760329307).
  Original #204 SHA `53f00bd16b6520c161ed85db81f9fa3bf2065ebc` vs candidate
  `ec72ece1ba17cf7fce7a5304c0021229428e12ec` (same production mesh
  code as later doc-only head). Actual native PATROL WebGL2 canvas screenshots
  `baseline-fidRoof.png`, `candidate-fidRoof.png`, and paired OTI street
  screenshots. **Passed true 1075×605 SwiftShader WebGL2 test, errors []**.
  Human inspection: near-flying FID warehouse roof step clearly changes;
  street facade view has only a small top-edge difference, does **not** prove
  map-wide visual authenticity. Pixel audit on fixed roof ROI x470–810,
  y265–480: ~15.17% of pixels exceed RGB sum difference 30; full-frame
  ~1.24%. Street full-frame changed ~0.044%; this is visual change only,
  **not** fidelity to licensed street photography or reality.
- **First flight scene load** over four ABBA passes (software runner):
  baseline 3339 ms / 2864 ms; candidate 2873 ms / 2829 ms. Under this
  runner, no proof of faster initial load or native GPU improvements.
- **rAF p50 ms** for roof camera: baseline [50.0,1233.3], candidate
  [1066.6,1049.9]; street: baseline [966.7,1233.3], candidate
  [949.9,1016.7]. Software frame pacing is extremely variable between
  iterations, so **native GPU frame budget NOT verified**. A-B-B-A report
  lists descriptive roof +64.93% and street -10.61%; these are not
  reliable optimized frame-time improvements.
- **Remaining hard blockers:** need actual BK02 surveyed geometry for inner
  roof surfaces, uniform true road/building geolocation, close hand-flown
  aircraft/collision + map-switch evidence, native GPU timing and human
  street-level architectural matching. Keep Draft; merge parents in order.

## 2026-11-22 follow-up — critical building-identity correction

**Supersedes earlier "brick warehouse" language for FID 1080628.**
Independent verified BIN/address linkage:
`FID 1080628 / BIN 3389054 / BBL 3000517501` corresponds to **Nexus at
84 Front Street, Brooklyn**, a **12-story 2006 condominium**. Architect
Meltzer/Mandl's first-party description: https://archinect.com/meltzermandl/project/the-nexus
and https://www.archpaper.com/2005/07/all-rise-2/ describe a modern
building with yellow brick and blue/green/silver metal-clad components.
The old 5-row red-brick warehouse look was factually wrong.
- Production `index.html` changed only for `source.fid===1080628`: now
  12 source-referenced levels, 108 inset glazing bays, 40 polygon-edge
  attached metal spandrel panels; yellow brick, blue-green-silver palette,
  original collision/lot, source ring and original authored roof tier retained.
  **Color pattern and individual windows are original stylization**, not
  copied copyrighted facade images, photographic textures, measured
  window patterns or official LoD2 surfaces.
- Corrected FID geometry count: 1,056 quads + 11 roof triangles vs
  original #204 441 quads + 9 roof triangles. Difference 615 quads and
  2 roof triangles => **+1,232 triangle faces** (two per quad), one city
  draw batch, no new texture/asset/network. Other two source FIDs
  remain 336/455 quads. All vertices stay bounded to old proxy.
- Source rights and identity references added to
  `assets/nyc/DUMBO_OTI_SOURCE_NOTES.md`.
- The original roof split remains NOT from measured 2014 3D; official
  NYC metadata states the bulk of 2014 building models are LoD1 with
  roof details mainly on ~100 iconic LoD2 structures. A free BK02 .3dm
  archive would need exact-building extract; no correct inner geometry
  can be asserted merely from metadata.
- New `scripts/nyc-dumbo-nexus-map-switch-browser.mjs` and workflow
  `.github/workflows/nyc-nexus-map-switch-webgl.yml` launch actual PATROL
  **seaplane Manhattan -> Alaska -> Manhattan** inside one session,
  verify `selectedMap`, craft, world-space flight pose, WebGL health,
  draw 3 actual canvas screenshots. This is not full manual flying.
- Previous roof A/B and 480/480 tests apply to the OLD 5-level facade
  only; the new 12-storey facade requires **fresh exact-head CI** with
  screenshots/load/rAF and central flight/bridgehead regression.
- **Merge gate:** keep #264 Draft on #204, do not touch main.
  Inspect source-correct modern facade plus low-flying view, transition
  check and triangle/frame-time budgets before acceptance; document exact
  head SHA and Actions artifacts only after the new jobs pass.

## Exact code-head verification — Nexus identity / PBR and flight maps (2026-11-22)

**Supersedes all earlier references to a historic warehouse at BIN 3389054.**
The verified building is `The Nexus, 84 Front Street, Brooklyn` (12-story
condominium completed 2006), source https://archinect.com/meltzermandl/project/the-nexus.
Architectural yellow-brick / blue-green-silver-metal material identity is
corroborated by https://www.archpaper.com/2005/07/all-rise-2/.
The official OTI `BUILDING_view` ring provides only exterior footprint and
`HEIGHT_ROOF=121 ft`, not measured individual window openings or a
precise eighth-floor setback.

**Production geometry commit verified:** `c88bda8039555e08a7d8a28f96575e09de5dc177`.
- Code uses existing PBR **paint/metal surface tag 4** on actual forward
  polygon-edge metal panels and window header accents; the alternate
  Brooklyn surface 12 brick mortar shader must NOT shade metal cladding.
- Executing the **actual GitHub index.html mesh function** (not a mock)
  yields 1,056 quads, 11 roof triangles, 148 metal-tagged quads,
  108 recessed glazing panes, 40 extra raised metal spandrels,
  and 12 authored glass rows on FID1080628. Only the public
  identification/building material TYPES and 12 stories are sourced;
  mesh bay coordinates and coloring are artistic approximations.
  Other source FIDs: 336 and 455 quads, with ZERO metal-tag4 quads.
- Relative to parent #204: +615 quads / +2 roof triangles =
  **+1,232 triangles** for one LOD3 near-flight building, still
  existing single city mesh batch; no new JS runtime dependency,
  GLB, photo, network fetch, texture or extra draw call.
- [Source/geometry and cross-map run 45040365081](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45040365081):
  **11/11 source-specific tests and 481/481 all Node regressions passed**,
  inspected from the raw Actions job log for this exact source code SHA.
- [Exact-code-head same-session seaplane map-switch run 45040365043](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45040365043)
  succeeded: Manhattan -> Alaska -> Manhattan, glError 0, aircraft stays
  seaplane, correct world flags, finite flight pose, no browser errors,
  three nonempty actual WebGL2 PNG screenshots. Scene-load measurements
  22.553s, 24.288s, 22.266s on software Chromium; not hardware FPS.
  [Evidence artifact 14761177549](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45040365043/artifacts/14761177549).
- **Still pending** on this exact code SHA: source-identity correct
  A/B low-flying DUMBO building screenshots/SwiftShader ABBA timing;
  Brooklyn bridgehead 9-camera images and full WebGL Alaska/C185
  confirmations may still be queued/ongoing. No source-derived
  eighth-floor roof setback or local GPU hardware frame timing.
- Draft PR #264 stays stacked on #204; do NOT merge or enable for all
  users before reviewing the actual screenshots and real source caveats.
