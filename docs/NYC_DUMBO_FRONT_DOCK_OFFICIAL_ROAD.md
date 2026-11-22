# NYC DUMBO Front Street at Dock Street — official source, not a 3-D survey

## Scope and ownership

Draft PR #259, based on current `main` `6aee03e32cd06967451007d15d5fd9502f92de36`.
Does NOT include #255 One Times Square Skywalk, #256 Liberty CC0 GLB, Times Square,
#244 Times Square OTI polygons, #224 Times 7th Avenue signals, ferry or Alaska.
One 2022 DUMBO roadbed sector plus a 2026 NYC DOT *planned* bike treatment
and DOT-photographed signal presence. No fictional replacement for the rest of NYC.

## Open NYC government data / reuse

- NYC OTI 2022 planimetric ROADBED official polygon layer:
  https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Roadbed_2022/FeatureServer/20
- Official catalog:
  https://data.cityofnewyork.us/Transportation/NYC-Planimetric-Database-Roadbed/i36f-5ih7
- NYC Open Data Terms:
  https://data.cityofnewyork.us/stories/s/Terms-of-Use/k9k7-3cje
- Capture rules: https://github.com/CityOfNewYork/nyc-planimetrics/blob/main/Capture_Rules.md
  ROADBED polygons bound pavement and intersections separately; this is not a
  survey of legal lane widths or active signal controllers.
- NYC DOT DUMBO Bike Network 2026 (project begins June 2026):
  https://www.nyc.gov/html/dot/downloads/pdf/dumbo-bike-network-whh2026.pdf
  Specifically **planned** two-way protected lane on south curb of Front
  Street from Dock to York, and a DOT photograph labeled Front Street at Dock
  Street showing signals. The same PDF contains a separate *illustrative*
  proposed green bike lane image from S. 4th Street, NOT a measured photo or
  engineering drawing of Front/Dock. We link the PDF but embed no images.
- Geo anchor: Front/Dock approximately lon -73.992042, lat 40.702634
  (approximate transit-stop intersection, not a field-surveyed traffic pole).

## Exact bounded source-to-game path

`scripts/nyc-dumbo-front-dock-roadbed-fetch.mjs` fetches the official 2022
ArcGIS FeatureServer, preserves source IDs and clips each earcut triangle to
an East/North metre rectangle [-35,-23,+190,+23], after local WGS84 projection.
Static, committed output: `assets/nyc/dumbo-front-dock-roadbed-2022.json`
(22 official candidate records; 8 FIDs within bounded pavement; 20 source
polygons; 577 clipped triangles in captured source; 24 disappear at 0.001-m
rounding, leaving 553 physically renderable official faces). Source area
before rounding: ~3,714.73 square metres. The source isn't fetched by a
player's browser; no authentication, external photo or proprietary mesh.

**PATROL IS NOT 1:1:** `gameX = 343 + eastMetres * 0.32`;
`gameZ = -297 - northMetres * 0.32`; every physical metre = 0.32
existing fictional PATROL units. This is a uniform local similarity mapping,
NOT a survey-grade world registration, not aligned to every old city block.
Do not infer widths or grades as present-day metres inside the legacy game.

On actual `index.html?nycDumboRoadbed=on`, the existing Manhattan-only
async `nyc-street-network.js` importer reads this JSON, runs schema, FID,
finite-coordinate and no-degenerate checks and paints approved source
triangles into the **existing street mesh draw batch**. Only after source
acceptance does it skip precisely two 24-unit generic road strips at grid
(j=-9, i=16 and i=17). The original source shapes are kept, not expanded
from a centerline guessed width. Full-footprint terrain and building
safety checks can clip the rendering further. Missing data, invalid JSON,
unsafe/wet source polygons or opt-out restores conventional streets.
The original traffic paths, vehicle collision and all aircraft code are
untouched. Default parameter OFF; `?graphics=compat` also preserves old
fallback.

2026 DOT two-way bike proposal: only approved 2022 pavement receives
separate originally authored olive lane patches, modest separators and
direction arrows. **The centerline, precise 2026 bike width, actual
installation/completion status and geometry are NOT measured.** Signal heads
are static 3D amber housing with red/yellow/green lenses based on DOT's
dated intersection photograph. **They do NOT encode actual signal timing
or control unrelated vehicles.** A green bulb in a software preview is not
proof of a real-world active light.

## QA gates — must pass before merge

- Node: `node --test tests/nyc-dumbo-front-dock-production-road.test.mjs`
  and main `PATROL regression tests`, exact current PR head.
- Actual original PATROL game `index.html` named Scenic View
  `DUMBO · Front Dock Real Road`, 1280×720 WebGL2 OFF vs ON;
  two unedited screenshots and `report.json` uploaded by
  `.github/workflows/nyc-dumbo-front-dock-browser.yml`.
  Check polygon is visible, no 2D upside-down triangles / wet shoreline /
  signal clipping; compare two source-equivalent camera poses.
- Source QA on actual game should include emitted official triangles and
  rejected counts, 2026 planned bike paint, signal heads, no new textures,
  no added draw calls (same batch), triangle and GPU-buffer budget.
- Frame intervals P50/P95 from Chromium SwiftShader are only software
  event-loop rAF, **NOT actual native GPU frame timings**.
- Real-aircraft W-key pitch/position motion and
  Manhattan→Coast→Manhattan map switching; independent Alaska/C185,
  Cosmos, NYC Brooklyn Bridgehead workflows should remain green.
- This is not a photograph-to-game six-DoF matched reference pose: DOT's
  photo lacks published focal length/camera coordinates. Same-camera
  screenshots compare actual GAME before and after. Original 2026 DOT PDF
  is external site reference only; no photo or video redistribution.
- Do not merge while unresolved overlap with original background geometry,
  missing real-time road rules, curb heights or native GPU hardware timings
  is being passed off as a fully accurate modern New York City model.

## Files / rollback

`index.html`, `assets/nyc/nyc-street-network.js`,
`assets/nyc/dumbo-front-dock-road.js`, source JSON, source fetch tool,
two scoped QA workflows and focused tests. Restore original URL (remove
`?nycDumboRoadbed=on`) for instantaneous per-launch rollback.
Default production Manhattan, non-NYC maps and controls stay unchanged.
