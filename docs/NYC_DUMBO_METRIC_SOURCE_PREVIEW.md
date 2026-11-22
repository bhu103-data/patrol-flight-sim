# PATROL DUMBO NYC official-source **metric-scale staging**, not game-map replacement

**Scope** — additive preview only, a strict dependency of [DUMBO OTI source PR #189](https://github.com/bhu103-data/patrol-flight-sim/pull/189) and the prior 3-building polygon / recessed-window draft chain [#192](https://github.com/bhu103-data/patrol-flight-sim/pull/192) → [#204](https://github.com/bhu103-data/patrol-flight-sim/pull/204). This PR is **not** a 1:1 interactive Manhattan, a road/collider patch, a 2026 photogrammetric scan or a georeferenced shipping game map. It does not modify the production `index.html`, DUMBO traffic/bridge surfaces, shaders or aircraft.

## Snapshot and provenance

- Official source: **New York City OTI `BUILDING_view`**, dataset `5zhs-2jue`, [NYC Open Data](https://data.cityofnewyork.us/City-Government/BUILDING/5zhs-2jue). Original retrieved source was produced by the existing #189 read-only source QA workflow [run `44987962280`](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/44987962280), artifact **`14740960211`**, `2026-11-22T05:06:50.006Z`.
- Raw archive member `official-dumbo-source-pilot.json` SHA-256: `df606b9da502ec4e0dc048e8b3bd866214b6f267c45f692288225dcfb36432ef`. Candidate list was **48** of 159 geometrically eligible records from 184 returned. Snapshot captures **original WGS84 polygon exterior rings**, the source FID and BIN, `HEIGHT_ROOF` (feet **above ground**, not absolute roof elevation), and optional ground-elevation metadata.
- Licenses: New York City Open Data terms apply; retain source attribution and modification notice, and review distribution requirements before publishing reused snapshots. **No Google Street View, Google Maps, proprietary 3D Tiles, commercial buildings or textures copied.** Data may be historical; do not assert that the 48 structures or storefronts represent the present day.
- Reused snapshot in `assets/nyc/dumbo-oti-metric-48.json` is a conservative JSON subset of that earlier official QA artifact; does **not** add unlabeled fabricated polygons. Incomplete footprint sample: **48 buildings ≠ all DUMBO**. No holes/multipolygons. The baseline #204 preview's 3 WGS84 rings remain unmodified.

## Geometric method and visual checks

- All buildings use **the same origin** `lon=-73.989°, lat=40.702°`; a WGS84 local-meter approximation calculated *once at the origin*, X=east, Z=south. **1 meter = 1 preview unit**, with **no per-building translate, scale, crop, collider-fitting or artificial roof-height clamp**. `roofY=HEIGHT_ROOF*0.3048`, with an explicitly flat `y=0` ground datum pending a verified DUMBO terrain dataset.
- Each exterior ring produces a set of roof triangles via bounded ear clipping and walls for each original edge; the code rejects invalid / impossible topology instead of substituting a box. This is **source-faithful building massing, not façade photorealism**. The 25-meter lines in the preview are **reference rulers, not NYC road or subway alignments**.
- Interactive WebGL2 preview: serve the repository locally (`python3 -m http.server 8765 --bind 127.0.0.1`) and open `http://127.0.0.1:8765/tools/nyc/dumbo-metric-preview.html`. Drag to orbit, scroll to zoom, `T` for overhead; separate north-up footprint inset. No external runtime dependency, 3D service or API key. For CI, run `node --test tests/nyc-dumbo-metric-preview.test.mjs`; browser QA uses the dedicated workflow and `tools/nyc/dumbo-metric-browser-smoke.mjs` with Playwright and `pngjs` installed.
- The historical #204 fake proxy centers for source FIDs 1080628 / 1031082 / 1051309 produce inconsistent meters-to-game ratios: **0.160, 0.467 and 0.300** game units per meter for each respective pair. The new isolated preview instead retains official relative source distance by construction.

## Limitations / release blockers

1. **No road source mesh** yet. Official [NYC CSCL / LION](https://www.nyc.gov/content/planning/pages/resources/datasets/lion) is authoritative for street centerline topology, but it is **not yet joined/loaded**. Verify DUMBO Washington Street and its correct **Manhattan Bridge** alignment and station approaches separately.
2. **No real elevation surface** or ground-to-bridge connections; current ground is a flat datum and `HEIGHT_ROOF` converted only relative to that. No actual storefronts, roof plants, apertures, fire escapes, or PBR; source records do not validate these.
3. **No existing PATROL colliders or game coordinate migration** — flight controls, Manhattan traffic, Alaska/Vegas/Chongqing, low-quality fallbacks and `main` remain untouched. A true map switch needs a deliberately coordinated cutover of terrain, roads, bridge, flight spawn, collision and camera, with map-specific QA.
4. **No native-GPU 60 FPS claim**. Software-rendered screenshots can establish nonblank WebGL but not hardware FPS; triangulation/texture budgets and real PC perf tests remain mandatory.

**Decision gate:** Keep this a Draft PR until genuine WebGL screenshot and test evidence is attached. This asset snapshot and preview prove that a shared metric coordinate system is feasible; they do **not** prove a faithful real-world NYC flight experience.
