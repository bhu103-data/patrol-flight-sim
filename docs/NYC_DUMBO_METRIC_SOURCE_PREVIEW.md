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

## One genuine, dated pavement source — opt-in preview extension (#259 source reuse)

The isolated preview optionally overlays **2022 NYC OTI planimetric ROADBED**
pavement polygons along **a single Front Street / Dock Street corridor**.
Source: [NYC Planimetric Database Roadbed](https://data.cityofnewyork.us/Transportation/NYC-Planimetric-Database-Roadbed/i36f-5ih7);
source endpoint `Roadbed_2022/FeatureServer/20`, pulled and triangulated by
[#259](https://github.com/bhu103-data/patrol-flight-sim/pull/259),
official-source [CI #45038357404](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45038357404)
artifact `14761060037`. We reuse the **identical pinned source bytes** from
`assets/nyc/dumbo-front-dock-roadbed-2022.json` (source Git blob
`32bb7bbb37d95ff4b5be2234f35bc4793190efca`); this source file's
byte identity must be checked again before integration. Attribution and NYC
Open Data Terms apply; no commercial imagery/tiles are used.

The source contains **22 returned records, 20 polygon parts**, 8 contributing
feature IDs, **577 serialized triangles**, approximately **3,714.73 m²**
of **summed serialized triangle area (NOT unique pavement coverage)** in the bounded clip. Source vertices were rounded to
**0.001 m**, producing **24 degenerate microtriangles** after rounding;
`prepareOfficialDumboRoadbed` omits these for rendering (553 valid
WebGL triangles), while retaining the original read-only source and
recording the count and area. This is a data-quality observation rather
than invented replacement geometry.

**Independent topology check, not yet a CI gate:** Unioning the 553
nondegenerate triangles using Shapely in the recorded source's *east/north
metre plane* yields approximately **3,467.03 m² of distinct polygon
coverage**. The triangle-area sum is **3,714.84 m² after rounding**;
the difference, approximately **247.81 m² (6.67%)**, is overlapping
official source triangles, not newly invented streets. The 2022 pavement
polygons must not be counted as disjoint parcels. Opaque pavement rendering
can overdraw those coincident surfaces. This snapshot only proves the
limited 2022 *pavement geometry*, not whole-street connectivity or verified
present-day dimensions.

The source's road X/east and Y/north local coordinates are inverted to
WGS84 at their **own** `(-73.992042, 40.702634)` origin, then transformed
through the **same** `dumbo-oti-metric.mjs` WGS84-to-preview meter
conversion used by the 48 building source polygons (X/east, Z/south).
**No per-road shift, uniform re-scaling, or visual-only snapping** is
applied. This remains a **flat `y=-0.035` reference overlay**, not a
driveable street surface or a curb/elevation reconstruction. Some of the
48 buildings fall outside this narrow road corridor.

Do **not** infer any 2026 lane counts/directions, signage, traffic
signal phase, subway alignment, pedestrian crossing or bridge placement
from a **2022 pavement boundary**. The source AOI has not been expanded
to Washington Street/Manhattan Bridge; 2026 DOT changes and current
landmark construction need separate dated validation.

Validation on the exact stacked branch:
`node --test tests/nyc-dumbo-metric-preview.test.mjs tests/nyc-dumbo-metric-roadbed.test.mjs`,
then `tools/nyc/dumbo-metric-browser-smoke.mjs` via the dedicated
WebGL2 workflow. A nonblank screenshot or successful SwiftShader CI is
**not** a photorealism/hardware GPU acceptance.

## Limitations / release blockers

1. **No complete, source-aligned road network** yet. The single official 2022 Front/Dock paved polygon AOI is only a limited overlay; NYC [CSCL / LION](https://www.nyc.gov/content/planning/pages/resources/datasets/lion) is needed for connectivity, direction and current road topology, but is **not yet joined/loaded**. Verify Washington Street and the **Manhattan Bridge** separately.
2. **No real elevation surface** or ground-to-bridge connections; current ground is a flat datum and `HEIGHT_ROOF` converted only relative to that. No actual storefronts, roof plants, apertures, fire escapes, or PBR; source records do not validate these.
3. **No existing PATROL colliders or game coordinate migration** — flight controls, Manhattan traffic, Alaska/Vegas/Chongqing, low-quality fallbacks and `main` remain untouched. A true map switch needs a deliberately coordinated cutover of terrain, roads, bridge, flight spawn, collision and camera, with map-specific QA.
4. **No native-GPU 60 FPS claim**. Software-rendered screenshots can establish nonblank WebGL but not hardware FPS; triangulation/texture budgets and real PC perf tests remain mandatory.

**Decision gate:** Keep this a Draft PR until genuine WebGL screenshot and test evidence is attached. This asset snapshot and preview prove that a shared metric coordinate system is feasible; they do **not** prove a faithful real-world NYC flight experience.
