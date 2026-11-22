# PATROL_CONTEXT.md — compact active handoff (2026-11-22)

**Read this file first.** This file was ABSENT from the inspected main
`6aee03e32cd06967451007d15d5fd9502f92de36`; the installed ChatGPT
skill list also did not include `patrol-context-run`. Repo-local instructions
now at `.agents/skills/patrol-context-run/SKILL.md`. This is a new
independent handoff, NOT an earlier conversation context claimed recovered.

## Current user scope / branch
- User wants actual 2022/2026 legal-source NYC road boundaries, lanes,
  traffic signals in ORIGINAL PATROL Manhattan flight, with on/off same-camera
  WebGL screenshots, triangle/texture/frame/controls/cross-map QA.
- Current Draft **#259**: https://github.com/bhu103-data/patrol-flight-sim/pull/259
  branch `feat/nyc-dumbo-front-dock-roadbed-signal-20261122-chat`,
  base main `6aee03e3`. **DO NOT MERGE without confirmed evidence.**
- Avoid #255 One Times Square Skywalk, #256 Liberty LOD, #244 Times Square
  2022 official roadbed sample, #224 7th Avenue signals, #251 dated
  Times Square medians, #254 central QA, ferry and all non-NYC.
- Current chosen location: **Brooklyn DUMBO Front Street at Dock Street**.
  No Times Square, Liberty, media/video, paid or proprietary assets.

## Verified facts / source provenance
- Official NYC OTI 2022 `Roadbed_2022/FeatureServer/20` query at
  Front/Dock (rough anchor -73.992042,40.702634). Archived source IDs.
  CI source run #45038193142: **22 queried features, 20 polygons, 8 source
  roadbed FIDs, 577 clipped triangles, 3,714.73 m².**
- 24 triangles collapse to zero area at 0.001m source rounding; importer
  rejects them, leaving **553 renderable source triangles** under ideal
  clear terrain. Do not re-fill those 24 with fabricated road polygons.
- Static pinned JSON: `assets/nyc/dumbo-front-dock-roadbed-2022.json`.
  Reproducible fetch tool:
  `scripts/nyc-dumbo-front-dock-roadbed-fetch.mjs`; it downloads only in CI,
  not in players' browsers.
- Official 2026 NYC DOT `dumbo-bike-network-whh2026.pdf`:
  **planned** two-way south-curb lane on Front St Dock→York, starting
  implementation June 2026; photo confirms signal heads at Front/Dock.
  Does NOT document exact local 2026 bike lane widths, built status,
  elevation, signal control cycle or signal-head coordinate.
  https://www.nyc.gov/html/dot/downloads/pdf/dumbo-bike-network-whh2026.pdf
- Reuse/rights: NYC Open Data Terms
  https://data.cityofnewyork.us/stories/s/Terms-of-Use/k9k7-3cje
  official layer https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Roadbed_2022/FeatureServer/20
- **Not a 1:1 world reconstruction:** local source E/N metres mapped by
  `x=343+.32*east, z=-297-.32*north` into old fictional DUMBO game.
  No current lane widths, 3D survey or collidable curb is implied.
  Complete source/lane/signal caveats at
  `docs/NYC_DUMBO_FRONT_DOCK_OFFICIAL_ROAD.md`.

## Actual code changes and rollback
- `index.html`: only opt-in `?nycDumboRoadbed=on` inside actual Manhattan
  `selectedMap.city` street mesh; loads pinned source+Painter from local
  static assets; `window.PatrolDumboRoadQA` exposes audit; adds in-game
  `DUMBO · Front Dock Real Road` Scenic View.
- `assets/nyc/nyc-street-network.js`: injector only, no static module
  import, to preserve existing data-URL-import source tests. On verified
  source acceptance skips exactly two old DUMBO j=-9, i=16/17 strips;
  absent source or collision leaves old road network.
- `assets/nyc/dumbo-front-dock-road.js`: source-verified road triangles,
  only source-confined illustrative 2026 bike markings, static photographic
  signal-presence proxy; **not** legal signal timing/vehicle obedience.
  Preliminary isolated builder execution (terrain safe): **797 total emitted
  triangles**, **553 official**, 55 painted bike quads, 2 arrow triangles,
  two visual signal heads, ~95,640 estimated vertex-buffer bytes,
  0 new textures/extra draw calls. These are **builder numbers**, NOT
  yet production browser results and must not be sold as final.
- `tests/nyc-dumbo-front-dock-production-road.test.mjs` exact-source /
  fallback checks; `.github/workflows/nyc-dumbo-front-dock-browser.yml`
  checks real game on/off 1280x720 screenshot, source stats, WebGL error,
  software rAF P50/P95, W aircraft controls, Manhattan→Coast→Manhattan.
- `?nycDumboRoadbed=off` (default) preserves old visuals. Never touch
  main, aircraft physics, Alaska/Chongqing/Vegas/Liberty/Times Square.

## Verified exact-head QA and next steps (2026-11-22 10:40 EST)

**Last source-changing branch HEAD:** `b663baea18ee4028727ef8b7381a74abd1f6960e` (not main). Draft PR #259 base still `main 6aee03e3`; do not merge. All subsequent docs-only commits must be compared against tested source blobs if reporting unchanged code.

**Official source** [run 45039260651](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45039260651): SUCCESS. Pinned 2022 data unchanged: 22 query features, 20 polygons, 8 FIDs, 577 clipped / 24 degenerate / **553 emitted** valid official pavement triangles; 3,714.73 m² source polygon area. No live NYC API request inside game.

**Actual PATROL WebGL2** [run 45039260606](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45039260606) SUCCESS on tested head. Original [two 1280×720 PNGs + report artifact 14761032790](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45039260606/artifacts/14761032790): `front-dock-off.png`, `front-dock-on.png`, `report.json`. In-game `DUMBO · Front Dock Real Road` camera source: screenshot ON shows narrow olive/green official-confined planned bike pavement and two amber housings with red/yellow/green signal heads near the foreground street; OFF lacks them. **Scene is still visibly cuboid DUMBO; a foreground red building occludes much of the road surface**, so this proves a small live scene patch, not current georegistered 2026 NYC streets. Pixel audit 1,246/57,600 changed samples, 703 in center-road ROI; visual review, not solely automated difference.

**Live mesh** `window.PatrolDumboRoadQA`: `enabled:true`, `sourceYear:2022`, **553 official** triangles, **797 total** extra rendered triangles, **55** bike paint quads, **2** bike direction arrows, **2** static signal heads / 48 lens triangles, ~**95,640 bytes** extra vertex data (estimate from 10 float/vertex streams), **0** new textures / **0** new draw calls (batched in existing street VAO); `glError:0`, WebGL2 context intact and page errors empty. Note some original procedural strips removed: these counts are newly emitted geometry, **not a measured total-scene triangle delta**.

**Software frame interval** (Chromium SwiftShader, 30 requestAnimationFrame samples PER mode; no physical GPU): OFF P50 **1,049.9 ms**, P95 **2,233.3 ms**; ON P50 **999.9 ms**, P95 **2,049.9 ms**. Massive software intervals and noisy comparison; neither native FPS nor a proven speedup.

**Real flight/game regression:** W input changes original aircraft position `[-108,48,-588.90755]` → `[-108,48.15535,-587.74286]`, pitch delta **0.1326**; Manhattan→Coast→Manhattan map-switch in same game passes (`playing:true`, GL error 0 each). [Node regression run 45039260673](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45039260673) **473/473 pass**. [C185 #45039260672](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45039260672), [Alaska source #45039260761](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45039260761), [Alaska browser #45039260806](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45039260806) and [Cosmos #45039260741](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45039260741) all SUCCESS. NYC Bridgehead #45039260589 and Twilight #45039260662 still pending at last verification — must recheck before merge. Earlier red runs due static ES import and 24 rounded degenerates were corrected; **do not reuse those stale failures as current state**.

**Exact next steps (not work claimed done):**
1. Re-fetch PR #259 head/main and newest CI; if this docs-only update changes commit, verify `index.html`, NYC road modules, source JSON, tests and workflows are blob-identical to the tested source SHA. Recheck two pending NYC workflows.
2. Hand off to central visual QA (#254); acquire **registered** present-day Front/Dock street ground controls and sidewalks/curb geometry (source 2022 roadbed isn't 2026 as-built), check whole-source perimeter vs actual scene buildings/water in an unobstructed low-fly camera. No copying Google tiles/photos.
3. If approved, add true separately verified physical lane topology, actual controller timing/vehicle interactions and collision curb heights — **not guessed from present code** — and actual hardware GPU frame P50/P95. Existing static signals are cosmetic only; 2026 DOT bike lanes still *proposed* in the PDF. No production activation or main merge until those QA gates.
