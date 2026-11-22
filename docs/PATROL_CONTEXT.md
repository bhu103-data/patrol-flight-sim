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

## Outstanding / exact next checks
1. Check current exact PR HEAD and CI results for
   `PATROL regression tests` and
   `NYC DUMBO live official roadway, lane and signal WebGL2 A/B`.
   Earlier transient runs failed because the first source importer
   rejected 24 degenerate triangles and the initial street network static
   import broke data-URL source-test resolution. **Both are now code-fixed**:
   importer filters the 24 explicitly; network uses runtime injected helper.
   Do not treat the older red CI results as the latest HEAD verdict.
2. Inspect actual `artifacts/nyc-dumbo-front-dock-live/` PNGs and report
   after a successful source-identical PR-head run. Verify source pavement
   visible, no city-building intersections/water bleed, bike/signal visible.
   A script reporting simple pixel difference alone is not manual approval.
3. Read actual on/off software rAF P50/P95 and native flight/map-state
   controls. SwiftShader frame intervals are **not hardware GPU times**.
   Check independent C185, Alaska, Cosmos, bridgehead, twilight workflows.
4. If fail, fix only exact asset/helper/tests on this PR. Preserve source
   FIDs and no-guessing licensing. If pass, add absolute run/artifact URLs,
   exact sha, triangle/texture stats and unresolved hardware/photo-cam
   registration caveats to this file; keep Draft for central QA.
