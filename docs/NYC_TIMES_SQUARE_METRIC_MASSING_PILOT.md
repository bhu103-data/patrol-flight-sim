# Times Square source-relative, metre-scale massing pilot (NOT released game map)

**Status:** isolated proof of geometry and unit system only; blocked for in-game replacement or photorealistic acceptance. No claim of 1:1 streets/traffic/photography.

## Why the current PATROL city is visibly wrong

The existing official Times Square GIS layer uses a game projection about 0.31974 PATROL units per geographic metre and a manually authored road/street grid; of 120 official source geometries, its earlier source-overlap investigation found just 1 that survives strict clipping/placement around fictional streets and protected venue boxes. Authentic source rings in the old compressed map are *not* authentic spatial relations.

Approximate anchor values already documented by PATROL:
- One Times Square: WGS84 (-73.9864883, 40.756421), old game (23,-47.5).
- Duffy Square: WGS84 (-73.98528,40.75889), old game (-0.9,42.8).

NYC source-relative ellipsoidal tangent-plane displacement is **E≈102.03 m, N≈274.18 m, total≈292.55 m**, while the old map's XY plane proxy is **≈93.41 game units**, 0.3193 old-game units/actual metre. Those approximate external reference anchors are not three surveyed GCPs or a complete city alignment.

## Data reused, no downloaded city meshes

- Original already-stored dataset: `assets/nyc/times-square-footprints.json` fetched from NYC government official Building Footprints FeatureServer, 2026-11-20, WGS84 six-decimal polygon approximation, FID and `HEIGHTROOF` in feet.
- 120 unique source FIDs. The new isolated pilot renders **118** simple-exterior-ring buildings with valid source heights. It intentionally **skips 2 multipart/holed cases** rather than filling a surveyed courtyard with fake solids.
- Source-relative East/North units come from WGS84 ellipsoid linearization around One Times Square. East and North each use the correct local radii of curvature; **no 0.319 compressed scale or ~35° game rotation**. World Y is source `HEIGHTROOF×0.3048` metres **above a zero datum**, not an absolute roof elevation; ground DEM/elevation not yet imported.
- CPU geometry computes triangulated concave roofs and wall facets. Measured source-pilot triangle budget with this frozen snapshot: **2,101 triangles**, shared one draw (plus 50 m meter grid).
- WGS84 rings were rounded at original source extraction; do not call that exact cm-level surveyed location.
- The temporary six muted colors are **not verified real facade materials**. No photo meshes, billboard art or copied ads.
- Source attribution: https://data.cityofnewyork.us/d/3g6p-4u5s ; official source query https://services2.arcgis.com/IsDCghZ73NgoYoz5/ArcGIS/rest/services/NYC_Building_Footprint/FeatureServer/0 . Observe NYC Open Data Terms: https://data.cityofnewyork.us/stories/s/Terms-of-Use/k9k7-3cje .

## Inspect the actual geometry

Static local server from repository root: `python3 -m http.server 8766`, then visit `http://localhost:8766/nyc-metric-pilot.html`. Browser requires WebGL2. Switch between street, low flight and top-down source scale, mouse drag to orbit and wheel to zoom.

Run source tests: `node --test tests/nyc-times-square-metric-massing.test.mjs`. Exact-head GitHub Workflow `nyc-metric-massing-pilot.yml` captures **three real WebGL2 PNGs + JSON with source count, triangle count and browser errors**, if Chromium starts successfully. SwiftShader is a functional smoke, NOT native-GPU performance.

## P0 blockers (not implemented, must be verified before real NYC swap)

1. Georeferenced NYC OTI street centerline (CSCL `inkn-q76z`) or DCP LION must be sourced, licensed, version-pinned and checked for *road-bed* vs official paper street; retain actual direction/width and distinguish pedestrian Broadway segments. Official dataset index: https://data.cityofnewyork.us/d/inkn-q76z . No roads are invented in this pilot: visible grid means **50 metre coordinates only**.
2. Three or more independent control points with residual **metres**; fix orientation and exact building entrance/camera viewpoints, plus one consistent elevation datum.
3. Reconstruct real one-block buildings and streets **together** as a replace-not-overlay layer in PATROL. Existing hand-placed Times Square buildings, GIS ghosts, roads, billboards, physics colliders and lights are NOT modified by this PR.
4. Source-verified facade depth, cutbacks, rooftop structures and street signs; original licensed imagery/textures or CC0 materials only. Orthogonal WebGL2 source geometry is not photorealism.
5. A/B with current release at fixed camera/lens, real authorized street/photo reference, readable report of footprint/height error (metres), collision/traffic and NYC↔Alaska/Chongqing/Vegas transition. Native physical GPU FPS P50/P95 and memory budget, including low-graphics fallback.

**Release:** Draft only. Do not merge or enable in the playable map on CI success alone. Tracks P0 issue #229; this branch is intentionally isolated to prevent replacing real flight/collision logic with an incomplete second NYC scene.
