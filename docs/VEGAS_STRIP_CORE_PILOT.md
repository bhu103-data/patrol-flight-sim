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
- Static mountain triangles: **768** (2 sides × 48 segments × 8 triangles); flat/faceted colors, no new textures.
- Core pavement repair geometry: **9 quads = 18 triangles**, flush with existing asphalt; overall **786 triangles** incremental.
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
