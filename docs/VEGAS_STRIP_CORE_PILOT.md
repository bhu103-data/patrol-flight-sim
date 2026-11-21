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
| USGS 3DEP DEM elevation datasets | https://www.usgs.gov/3d-elevation-program/about-3dep-products-services | USGS identifies its 3DEP data as US public domain | **Not yet downloaded or imported**; subsequent georeferenced replacement requires raster provenance, extent and resampling check |
| OpenStreetMap road/building data | https://www.openstreetmap.org/copyright | ODbL 1.0 with attribution/share-alike rules | **Not imported or enabled**; require ODbL compliance review first |
| Third-party Las Vegas casino models / photo facades | None verified | Not approved | **None downloaded/used** |

## Geometric/performance budget (incremental)
- Static mountain triangles: **216** (2 sides × 18 segments × 6 triangles); flat/faceted colors, no new textures.
- Core pavement repair geometry: **9 quads = 18 triangles**, flush with existing asphalt; overall **234 triangles** incremental.
- New GPU textures, shader programs, instanced draw calls, network fetches, off-site models: **0 introduced directly**. Actual renderer draw-call behavior and GPU driver timings require a WebGL screenshot run.
- Target for native WebGL2 / SwiftShader baseline: incremental first-load JS (not including preexisting HTML): **< 5 KiB** source-code budget; incremental dynamic GPU time **≤0.3 ms/frame** at 1280×720 on the project QA machine; FPS target **≥30** in the same fixed camera and graphics-quality setting. These are *acceptance limits*, **not measured results**.
- The mountain profile is a placeholder silhouette, not a claimed Spring Mountains or Sunrise Mountain surveyed elevation field. Its world positions deliberately remain `|x|>=686` to avoid existing casino/road collision footprints. The distant scenery should be checked for clipping and flat-shaded facets.

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
