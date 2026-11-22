# PATROL_CONTEXT.md — single-file continuation | 2026-11-22 11:03 EST

## State and hard constraints
- Default branch: `main`, verified `6aee03e32cd06967451007d15d5fd9502f92de36`. **No main merge/write.**
- Current Draft PR **#259** https://github.com/bhu103-data/patrol-flight-sim/pull/259
  branch `feat/nyc-dumbo-front-dock-roadbed-signal-20261122-chat`, base `main`.
- **Last code/QA-changing tested source head** `6d4f0bf7c9bdb80e08be08f460f3d01e5749575f`. Documentation-only commits may follow. Confirm byte-identical production/test/CI blobs against this SHA when resuming.
- User wants only **actual NYC flight-map DUMBO Front/Dock road boundary, lanes, signal heads**, no videos, no paid/proprietary data, no fake photo matching, no changes to Alaska/Chongqing/Vegas/flying. Avoid duplicating #255 Times Square rooftop, #256 Liberty, #224 Times 7th Ave signal, #244 Times Square source roadbed, #254 central reality QA and ferry.
- Repo-local `$patrol-context-run`: `.agents/skills/patrol-context-run/SKILL.md`. The original `main` lacked this skill and this handoff file; both were created in PR #259. Read THIS file first, then live PR/CI; do not reread long chat.
- **DO NOT MERGE PR #259** until true 1:1 georeferenced replacement, lane/control validity, collision/curb QA and native GPU hardware frame measurements are reviewed. Current feature is opt-in `?nycDumboRoadbed=on`; default URL/off retains old city.

## Verified official data, rights and historical limits
- NYC OTI 2022 planimetric ROADBED polygon FeatureServer/20:
  https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Roadbed_2022/FeatureServer/20
  City terms https://data.cityofnewyork.us/stories/s/Terms-of-Use/k9k7-3cje
  official capture rules https://github.com/CityOfNewYork/nyc-planimetrics/blob/main/Capture_Rules.md
  Pinned exact source IDs/geometry `assets/nyc/dumbo-front-dock-roadbed-2022.json`, offline fetch script `scripts/nyc-dumbo-front-dock-roadbed-fetch.mjs`. NO in-game ArcGIS access; no external imagery.
- Source query: 22 features, 20 polygons, 8 unique ROADBED FIDs; 577 clipped faces, 24 degenerate after 0.001-m rounding, **553 valid official triangles**. Source area **3,714.73 m²**; recomputed area after rounding **3,714.84 m²**, deviation ~0.003%. This validates clipping arithmetic, not legal 2026 lane placement.
- NYC DOT DUMBO network planning PDF (implementation *begins June 2026*):
  https://www.nyc.gov/html/dot/downloads/pdf/dumbo-bike-network-whh2026.pdf
  shows Front St Dock→York south-curb **planned** two-way facility and traffic signal presence in a dated street photograph; cannot infer built status, exact head location, phase timing, curb/elevation or actual bike lane width.
- **NOT survey-scale**: game uses `x=343+.32*eastMetres`, `z=-297-.32*northMetres` into fake 24×33 Manhattan/DUMBO grid. No legal as-built metres/roadway collision claim. See `docs/NYC_DUMBO_FRONT_DOCK_OFFICIAL_ROAD.md`.

## Real defect resolved this turn: polygon-vs-old-grid holes
- Previous PR implementation hardcoded deletion of two old j=-9 strips, despite actual 2022 polygons covering only 12/21 and 2/21 centerline samples. This would produce artificial pavement holes.
- `assets/nyc/dumbo-front-dock-road.js` now calculates dense **21 longitudinal × 5 across-width** approved-source coverage before allowing ANY old road strip removal:
  j=-9,i=15: **35/105 (33.33%)**; i=16: **54/105 (51.43%)**; i=17: **40/105 (38.10%)**. **0 fully covered segments => 0 deleted.** `sourceOverlayOnly:true`; old street network remains continuous, OTI polygon is a 2022 sourced thin VISUAL overlay, NOT replacement. Never move original govt source polygons merely to fit fictional blocks.
- Layer now at `streetY+.090`, a visually thin **+.004 game-unit bias** over old asphalt at `streetY+.086`; previous +.150 floating plate eliminated. No claimed real road grade.
- `assets/nyc/nyc-street-network.js` only skips officially FULLY covered segments; original `index.html` imports source painter only on selected Manhattan city + explicit opt-in. Invalid source/unsafe geometry restores old roads. `window.PatrolDumboRoadQA` exposes actual scene stats. New second original-game high-angle Scenic View `DUMBO · Front Dock Road Aerial` avoids the old foreground warehouse camera occlusion; NOT a detached preview.
- Source-builder / actual flight runtime: **553 accepted official** triangles, **797 added scene triangles** including 55 illustrative bike-paint quads, 2 arrows, 2 STATIC signal heads, 48 signal lens faces; ~**95,640-byte estimated vertex buffer**, **0 new textures and 0 extra draw calls** (shared street batch). Older original streets now stay emitted; 797 is *emitted additive triangles*, not net whole-city triangle count or true GPU allocation measurement.
- No changes to vehicle signal obedience, plane controls or other map physics. Static signal lights are appearance ONLY, no invented 2026 controller cycles.

## Verified exact-code QA — all nine workflows SUCCESS on `6d4f0bf7`
- **[Real DUMBO WebGL2 run 45040555457](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45040555457)**, exact source. [Five-file original artifact #14760939412](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45040555457/artifacts/14760939412): `front-dock-off.png`, `front-dock-on.png`, `front-dock-aerial-off.png`, `front-dock-aerial-on.png`, `report.json` — **1280×720 original game**, source/LOD unchanged; aerial hides only HUD. WebGL2 context valid, `glError=0`, JS/page errors []. Street same-camera 1,147/57,600 changed sampled pixels (center ROI 552/22,220); aerial 2,206/57,600 (ROI 847/22,220). MANUAL screenshot inspection: only narrow green paint and static signal heads visibly added, no entire roadway gap after old roads retained; blocky warehouse towers still dominate. Not an accurate full-road/curb or photo-to-game 6DoF reconstruction.
- **Software-only SwiftShader requestAnimationFrame timing, 30 samples each**: OFF P50 **1200 ms**, P95 **4449.9 ms**; ON P50 **1299.9 ms**, P95 **5849.8 ms**. This test is extremely slow/variable software rendering, NOT native GPU timings and NOT a robust causal performance delta. Hardware P50/P95 FPS blocker remains.
- Original aircraft W input: position `[-108,48,-588.51745]` → `[-108,48.15534882,-587.35276474]`, pitch +0.1326. Original game Manhattan→Coast→Manhattan map switch passes (`playing:true`, GL errors 0).
- [Node full regression #45040555388](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45040555388): **473/473 PASS** including source continuity and rollback.
- [Official OTI source #45040555403](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45040555403) PASS.
- [NYC Bridgehead WebGL #45040555348](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45040555348) PASS.
- [NYC twilight #45040555361](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45040555361) PASS.
- [C185 WebGL #45040555505](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45040555505) PASS.
- [Alaska WebGL #45040555443](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45040555443) PASS.
- [Alaska source #45040555346](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45040555346) PASS.
- [Cosmos #45040555414](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45040555414) PASS.

## Exact next actions — do NOT claim completed
1. Read this file; query live `main`, PR #259 and diff from `6d4f0bf7` to final HEAD. Only docs-only modifications after validated code should be acceptable without new source QA; recheck current checks and open PR #255/#256 conflicts before any future port/merge.
2. For real-world realism P0: obtain licensed **current 2026** road/curb/marking controls and building/traffic positions in a common **1:1 ENU/metre CRS** for the entire DUMBO sector. Replace the fictional road and building grid together; do NOT fudge old grid or fabricate legal signal phasing. Model sidewalk slopes/curbs and collision, then do real street/low-fly photo-to-game registered 6DoF comparison, with no imported Google tiles.
3. Recheck per-building source/road/shoreline physical overlap and actual moving vehicles vs source curb, survey official signal phasing only if documented. Keep Static red/amber/green signals NOT active real controls.
4. Acquire native hardware GPU frame P50/P95 alongside visual A/B and central reality QA (#254), and verify other maps/flight. Keep Draft and default-off until these blockers are closed.
