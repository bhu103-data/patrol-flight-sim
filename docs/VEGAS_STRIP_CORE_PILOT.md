# PATROL Las Vegas — Strip core + distant ridges, pilot v1

## Scope and state
- Branch-only pilot against integrated commit `6d50bfd`. No changes to map selector, aircraft physics, vehicle routes, existing landmark footprints/colliders or global renderer.
- Existing Vegas map already uses `VEGAS_BOULEVARD=-35`, cross streets (Harmon `z=-218`; Flamingo `z=-115`), and landmark models for Bellagio, Caesars, Venetian, Wynn, Luxor, Sphere and rides. Coordinates are **compressed fictional game units**; the boulevard has not been reprojected to true GIS geometry.
- The patch introduces a built-in original procedural ridge study along the far east/west scenery band and localized dark seams/tonal pavement breakup between Harmon and Flamingo. These are *visual-only* geometry with no new colliders, no physical road layout changes. NOT an actual imported DEM or 1:1 Las Vegas model; visual and geographic fidelity remain provisional.
- The geometric addition is made in `buildVegasStrip`, so it is built only for Vegas and uses the same existing draw batch and terrain-height sampler.

## Data/source and license register
| Item | Source | Copyright/license | Included in this branch? |
|---|---|---|---|
| Core visual triangulated ridges and pavement joints | Original PATROL Javascript authored for this pilot | Project-authored code; repository license governs reuse | **Yes**, no third-party assets |
| Existing Vegas roads, hotels, lights, aircraft and controls | Prior PATROL code in integrated baseline `6d50bfd` | Existing project's notices apply; unchanged by pilot | Reused unchanged |
| County Strip corridor / hotel-order reference | https://www.clarkcountynv.gov/government/departments/public_works_department/resort-corridor-las-vegas-strip | Reference only; reuse license for actual PDF/vector drawing **not verified** | **No PDF, GIS, textures or map tiles copied** |
| USGS 3DEP DEM elevation datasets | https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer | US Government public domain (official USGS 3DEP) | **Imported** as verified 49×3 measured ridge profiles in `assets/vegas/strip-ridges-3dep.json`; original 256×128 floating-point GeoTIFF retained in source workflow artifact |
| OpenStreetMap road/building data | https://www.openstreetmap.org/copyright | ODbL 1.0 with attribution/share-alike rules | **Not imported or enabled**; require ODbL compliance review first |
| Third-party Las Vegas casino models / photo facades | None verified | Not approved | **None downloaded/used** |

## Geometric/performance budget (incremental)
- Static mountain triangles: **1,536** for measured 2D USGS 3DEP surfaces (2 sides × 48 rows × 8 grid cells × 2 triangles); **768** in the procedural fallback, no new textures.
- Core pavement repair geometry: **9 quads = 18 triangles**, flush with existing asphalt; overall **1,554 triangles** incremental when USGS measured surface loads (**786** in fallback).
- New GPU textures, shader programs, instanced draw calls, network fetches, off-site models: **0 introduced directly**. Actual renderer draw-call behavior and GPU driver timings require a WebGL screenshot run.
- Target for native WebGL2 / SwiftShader baseline: incremental first-load JS (not including preexisting HTML): **< 5 KiB** source-code budget; incremental dynamic GPU time **≤0.3 ms/frame** at 1280×720 on the project QA machine; FPS target **≥30** in the same fixed camera and graphics-quality setting. These are *acceptance limits*, **not measured results**.
- A **USGS-measured mountain profile is now available as the preferred render source** (but the surface mesh is still a compressed game-space 3D interpretation, **not native-resolution 1:1 topography**). When its asset fails validation, the old procedural fallback remains. Its world positions deliberately remain `|x|>=686` to avoid existing casino/road collision footprints. The distant scenery should be checked for clipping and flat-shaded facets.

## Fixed-camera QA / screenshot matrix
Use one fresh Chromium launch and the existing Las Vegas map selector. Near camera = Scenic Views **Strip Street View**; flight-distance camera = **Bellagio**, both angle `0`, same 1280×720 WebGL2 screenshot viewport and environment presets. On software SwiftShader, the internal 3D canvas can render at reduced resolution (observed 704×396); report that separately. Captures are deterministic interface settings rather than falsely claimed surveyed camera poses.

| Shot | Camera target | Zoom | Clock | Check |
|---|---|---:|---|---|
| `vegas-core-near-noon.png` | Strip Street View | 70 | 12:00 | Near roadway seams, building/road overlap |
| `vegas-core-far-noon.png` | Bellagio | 24 | 12:00 | Skyline and both far mountain wings from flight distance |
| `vegas-core-near-night.png` | Strip Street View | 70 | 00:00 | Contrast, casino lights, black/blank frames |
| `vegas-core-far-night.png` | Bellagio | 24 | 00:00 | Mountain silhouette and existing night sky |
The automated screenshot script is `scripts/vegas-core-browser-smoke.mjs`. Screenshots must be attached as actual artifacts after running; no screenshot files or FPS measurements are asserted in this PR before execution.

## Targeted verification
```sh
node --test tests/vegas-strip-core-ridge.test.mjs
# In a local HTTP server from repository root, with Playwright Chromium installed:
node scripts/vegas-core-browser-smoke.mjs
```
Central QA must compare the same four settings against baseline `6d50bfd` and inspect live navigation, vehicles, lod, night lighting, water start and flight controls. Do not call this an accurate real-city map until legally sourced coordinate/DEM/footprint datasets and camera-matched WebGL evidence have been integrated.

## Evidence from first successful browser run (2026-11-21)
- GitHub Actions run [44957668461](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/44957668461) completed successfully; four actual Vegas screenshots plus JSON report were archived. Headless SwiftShader, `graphics=compat`, CSS screenshots 1280×720, internal canvas 704×396.
- Measured start-to-verified-frame: **10,167 ms**; WebGL2 context present and `getError()==0`; browser errors: zero.
- **Observed software frame cadence: 90 frames, 321.1 ms/frame, ~3.11 FPS.** This does not pass the aspirational 30 FPS target; compare against the untouched integrated baseline before judging incremental cost, and do not interpret JS requestAnimationFrame as GPU-only time.
- Screenshot review: near Strip facades remain flat/blocky, the previous far camera stayed effectively at street level and did not establish clear mountain visibility. The script now uses Bellagio for the flight-distance camera and CI runs the exact same screenshot script against clean `6d50bfd` as a regression control. Authentic GIS/DEM precision remains **not achieved**.

## Same-camera before/after evidence — refined scene baseline
- Run [44958150919](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/44958150919) successfully captured eight screenshots: four current-branch and four untouched `6d50bfd` using **the same** real-browser Scenic Views settings and SwiftShader. First-load baseline **9.572 seconds** vs. candidate **8.718 seconds**; mean requestAnimationFrame interval **284.99 ms** vs. **288.69 ms** (+1.30%), approximated software FPS **3.51** vs. **3.46** (-1.28%). This is software rendering, **not GPU frame time** and does not meet 30 FPS.
- The sample hills are visibly present in the distant daytime and night Bellagio views but were faceted and unnaturally slab-like. Revised to 48 segments per side (768 mountain triangles, 786 total) and warmer strata. Review the new captured screenshots before acceptance; actual DEM import and authentic casino models remain separate work.

## Imported official Vegas 3DEP elevation profile (2026-11-21)
- Acquisition: `scripts/fetch-vegas-usgs-3dep.py` fetched real **single-band float32** elevation TIFF from the USGS 3DEP ImageServer using `bbox=-115.395,36.035,-114.965,36.245`, EPSG:4326, 256×128 output pixels, elevation in **meters**. Reprojection uses the service's actual GeoTIFF georeferencing; the server expanded the latitude range to `36.0325…36.2475` to preserve image aspect ratio, recorded in JSON.
- Raw source SHA-256: `856259460e4e687285eb40949ab8764e7543ccf09e9f81177a8d2152bdb8046d`, verified against the exact 131,894-byte GeoTIFF from Actions source run [44961565037](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/44961565037).
- Measured elevation ranges: west **1015.99–1727.41 m**, valley center **630.12–683.35 m**, east **506.45–1179.14 m**. The 49 samples progress from south `36.035°N` to north `36.245°N`; west/east values use the highest height across a bounded longitude strip and valley-center samples use median elevation. These are **actual 3DEP source-derived values** with resampling, not invented per-point elevations.
- Game mesh: existing 768-triangle outer mountain geometry samples relative elevation against valley center and scales heights by 0.23 game units per source meter, clamped to 12–160 game units. This affects **visual background ridges only**, **not** road/building footprints, flyable city ground surface, collisions, aircraft or map-selection logic. It is not an orthometric 1:1 mountain surface, nor a full 3DEP terrain replacement across the Strip.
- Local runtime strictly decodes the profile in `assets/vegas/usgs-ridges.js`; missing or invalid sources deliberately leave the old original procedural fallback. The fixed-camera candidate smoke requires the live browser console to report the real verified source checksum before labeling it survey-backed.
- The whole Vegas map is **not survey-grade** until projected road/parcel/building footprint data and high-resolution 3DEP ground tiles are integrated with collision/traffic/flight semantics and checked at normal hardware frame rates. Casino photo/model licenses remain separate.

## 2D USGS height surfaces beyond the original 1D silhouette
- The earlier 49-point west/east peak-height profiles were an authentic but heavily reduced representation; the browser screenshots showed coarse wall-like mountain slopes. The current `ridgeSurface` now contains **two actual measured 49×9 grids** sampled at known EPSG:4326 longitudes/latitudes from the *same verified source TIFF*.
- West longitude samples run from `-115.305°` towards `-115.391°`; east from `-115.045°` towards `-114.968°`; latitude samples span `36.035°N` to `36.245°N`, with 49 rows. Elevation values are stored as little-endian unsigned 16-bit **decimeters** with Base64 encoding. These 882 source pixels are original USGS 3DEP samples, not interpolated from the 1D maxima/median samples.
- The gameplay build maps this reduced raster into **1,536 terrain triangles**, retains original Vegas city/roads/landmarks and flight collision rules, and continues to use a safe fallback if the gridded file fails strict checks. No material/texture download is introduced.
- This is a **genuine georeferenced, resampled and spatially compressed source-driven terrain replacement for the distant mountain wings**; it is NOT a full-native-resolution 3DEP triangulated city ground, and the chosen 256×128 service export should not be described as 1-meter DEM resolution. Collisions and flyable ground are not 1:1 GIS matched.

## Census TIGER 2026 verified centerline: Harmon–Flamingo core pilot
- Official public-domain source: U.S. Census Bureau, Clark County NV All Roads 2026, https://www2.census.gov/geo/tiger/TIGER2026/ROADS/tl_2026_32003_roads.zip . TIGER road geometries and registered TIGER trademarks are distinct; no map tiles or casino art are redistributed. Original ZIP SHA-256 `dba759001381d6c502160dc6f8b1987bef4e89544ac475943820cd870f07fbf9`, obtained and verified in [GitHub Actions #44963916607](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/44963916607).
- `scripts/fetch-vegas-tiger-strip.py` reads the TIGER polyline shapefile and name attributes, traces 25 WGS84 roadway positions from `36.1073°N` to `36.1151°N` at Las Vegas Boulevard; retained feature LINEARIDs `11021149140424`, `1106087834952`. The source geometries are **true geographic road-centerline samples**, not simulated GPS readings. This strip is *approximately* Harmon–Flamingo; the sampling-window endpoints are not independently surveyed intersection stop bars.
- `assets/vegas/strip-centerline-tiger-2026.json` contains the real WGS84 coordinates and derived 25 lateral offsets after removing the linear road-axis trend. Largest sampled residual: **0.239 game units**. This is intentionally not 1:1 world-size road reprojection; the existing gameplay coordinate system is compressed and all traffic routes remain at the original layout.
- `assets/vegas/tiger-strip.js` strictly checks SHA, sample order, WGS84 coordinate bounds, offset consistency and a 0.35-unit safety bound. In Las Vegas only, the game's nine **flush cosmetic asphalt repair joints** between z=-210 and z=-122 track the verified centerline, while road body, median, crosswalks, signals, car traffic, sidewalks, physics and collision remain unchanged. Missing or invalid TIGER assets revert to the original straight-joint positions.
- A full road **scale** replacement would require geodetic GIS projection applied to all roads, parcels, traffic segments and solid-object collision footprints together; it is **not** claimed here. TIGER also does not specify operating lane width, directions, signal phases or building shape. No license-unverified Clark County feature layer has been imported.

## TIGER measured-centerline live browser QA (2026-11-21)
- [GitHub Actions run #44964135597](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/44964135597) **SUCCESS**. Four Las Vegas candidate and four unmodified `6d50bfd` screenshots captured under matching near/far, noon/night cameras; WebGL2 valid, zero page errors. Candidate launch logs independently confirmed USGS source SHA `856259460e4e687285eb40949ab8764e7543ccf09e9f81177a8d2152bdb8046d` and TIGER source SHA `dba759001381d6c502160dc6f8b1987bef4e89544ac475943820cd870f07fbf9`.
- Baseline versus candidate same software runner: startup 8.475 vs 9.030 seconds (+6.55%); mean requestAnimationFrame interval 228.51 vs 232.40 ms (+1.70%); estimated SwiftShader frame rate 4.376 vs 4.303 FPS (-1.67%). **These are not real hardware GPU timings; the 30 FPS budget remains unverified.** The extra startup includes loading two local source-derived JSON files (USGS and TIGER), not just changed road geometry.
- The Strip road surface and cars appear visually **almost identical** between baseline and candidate because actual residual road bend is under 0.24 game units, affecting only nine shallow seam quads. This is an authenticity and licensing pilot rather than a claim of photorealistic street replacement. Existing stylized box buildings remain and require separately licensed detailed models / building footprints.
- Check the screenshot artifact `vegas-strip-core-webgl` on the linked run before any merge. Real physical lane widths and signal behavior are not sourced by TIGER and were intentionally not changed.

## TIGER road detail and independent measured asset startup — 2026-11-21 follow-up
- The original visually minor nine cross-asphalt repair joints remain; a further 48 longitudinal sub-lane pavement seams (24 × 2 sides) now track the same validated Census TIGER centreline at ±7.14–7.22 game units, *inside the existing ~8.575-unit asphalt half-width*. They are project-authored fictional asphalt detail, **not separately measured real-world seams**. The source-backed part is the road centreline curvature only.
- Measured USGS and TIGER loaders now run concurrently under `Promise.all` with independent error handlers. The previous sequential source fetch introduced unnecessary launch latency; parallelism is a targeted optimization, **not** a promise of faster GPU frame times.
- Geometry budget for the measured 2D USGS ridge + roads: **1,536 mountain + 114 pavement = 1,650 extra triangles**, **0 external textures/colliders**. Original procedural DEM fallback adds 768 mountain + 114 pavement = 882 triangles. This figure is not the total scene-wide triangle count.
- `tests/vegas-tiger-strip.test.mjs` checks real source checksum, road displacement, each authored seam's full width and longitudinal sampling, no route/flight reference changes, and source absence fallback; `tests/vegas-strip-core-ridge.test.mjs` checks geometry bounds and budget. Camera-matched screenshots and startup metrics require the Vegas-specific Chromium Actions run on the current head; do not use results from an older commit as proof for this update.
