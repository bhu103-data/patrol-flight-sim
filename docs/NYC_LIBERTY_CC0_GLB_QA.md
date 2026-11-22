# NYC Statue of Liberty — isolated CC0 GLB staging and release gate

Base: codex/patrol-integration-20261121 (6d50bfda4b2d3837e550751ede49b200b140bc72).
Branch: qa/nyc-liberty-cc0-glb-20261121.
Exclude all Brooklyn bridgehead roads in PR #100 and #102.

## Exact publisher source / license
- Innerscene, Statue of Liberty on its pedestal: https://www.innerscene.com/tools/library/3d-parts/statue-of-liberty-on-its-pedestal-c8a7318f
- CC0 1.0 per official page and terms: https://www.innerscene.com/tools/library/terms
- Official public download: https://www.innerscene.com/api/library/statue-of-liberty-on-its-pedestal-c8a7318f/download
- Existing PR #86 independently downloaded this source GLB and reported 10,533,876 bytes, 58,295 triangles, four images (8,836,053 image bytes). Reverify each conversion.
- Original is an authored generic monument, NOT a photogrammetric scan, site survey or proof of 1:1 NYC accuracy. Producer nominal dimensions are 27.7 x 27.7 x 92.996 metres, pedestal and foundation included.
- Retain attribution and SHA-256 in QA evidence even though CC0 credit is not mandatory.

## Current PATROL constraints
- MIT existing assets/nyc/statue-of-liberty.glb remains intact, as does procedural Liberty.
- Committed assets/nyc/scenario-manifest.json Liberty flag remains FALSE. No automatic switch.
- The native WebGL2 loader permits only one embedded PNG/JPEG Base Color atlas in UV0, <=4 MiB embedded, GLB <=8 MiB, <=25,000 triangles. No independent multi-atlas PBR material.
- The existing original procedural monument already has its own stone base / pedestal; a manifest-approved GLB replaces that mesh as one unit. Separate Fort Wood star-fort geometry from assets/nyc/nyc-hero.js stays visible, so visually check double foundation and penetrating geometry.
- Render-game height is 31.3 fictional units with origin (-140,-611). **Do not apply a 180-degree rotation.** Browser screenshot comparisons of original game, untouched candidate, and the rejected rotated model show the untouched candidate matches the torch-on-left / tablet-on-right harbor-facing silhouette. The bad rotation was removed from this QA branch.
- For the unchanged source geometry, a read-only asset fingerprint finds the torch top centroid at local X=-5.616 and conservative horizontal bounding-circle radius ~6.592 game units versus Fort Wood inner walkway radius 10 (>=3.407 units radial margin). This planar calculation is NOT proof of volumetric clearance or flight collision safety.

## Stage, analyze, compare — do not activate
The isolated GitHub Actions workflow nyc-liberty-cc0-webgl.yml:
1. Downloads authorized original with publisher CC0 statement, retains source SHA.
2. Installs Blender and CPU-decimates to under 25k triangles, bakes original diffuse into one 1024 px atlas without paid services or GPU training.
3. Strictly parses actual output GLB geometry/UV/images, checks byte limits, and verifies orientation and base radius without modifying model vertices.
4. Runs native WebGL2 with software Chromium at 1280x720, clear-summer-noon, Statue of Liberty Scenic View. Captures fallback first, then candidate using Playwright's browser-only manifest response override. Production files remain disabled.
5. Captures front/side/back preview, and identical harbor-south/oblique **low-altitude** before/after game screenshots. Pixel-diff guard requires a real image change in three statue-centered ROIs; downloading a GLB alone is insufficient.
6. Uploads a staged GLB, all screenshots, webgl-review.json and SHA checksums as CI artifacts. On a branch **push only**, after all checks pass, a separate protected step may commit only `assets/nyc/scenario/liberty.glb` to this QA branch if the branch HEAD still matches the tested commit. This does **not** enable the manifest and is not a merge.

CLI equivalents (after dependencies / official download):
- blender -b --python tools/nyc/bake-liberty-cc0.py -- ORIGINAL.glb assets/nyc/scenario/liberty.glb
- node tools/nyc/check-liberty-harbor-placement.mjs assets/nyc/scenario/liberty.glb
- node tools/nyc/check-liberty-glb.mjs assets/nyc/scenario/liberty.glb
- python3 -m http.server 8765
- node scripts/nyc-liberty-static-webgl.mjs


## Current staged 15.9k candidate and executed dynamic flight-collider QA (2026-11-21)

- **CURRENT staged GitHub file** `assets/nyc/scenario/liberty.glb`: **15,900 triangles**, **913,936 bytes**, one embedded **91,160-byte** PNG base color atlas, 1024×1024; verified model SHA-256 `34ed58d06e008adcced5e60376bbcc11d675f3d4ec01434016df92d244f33225` and GitHub Git blob SHA `344fb03eec240450e493516c9305fca2eb79173f`. The previous 24,399-triangle/1,175,264-byte model and its SHA are **historical** and no longer the head candidate.
- [Complete GitHub Actions #44961203209 — PASS](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/44961203209): 14 targeted tests passed, licensed original fetched/rechecked, headless Blender CPU optimized and verified the GLB, actual native PATROL WebGL2 decoder rendered candidate at HTTP 200 and GL error 0 with no page exception. Captured elevated, harbor-low and oblique-low identical-camera fallback/candidate PNG pairs plus 0°/90°/180° preview.
- The three candidate-vs-fallback image-change guards passed: **28.02%** for elevated, **46.16%** for harbor-low, **47.55%** for oblique-low (all over 10% minimum). This checks model appearance really differs, not just a successful GLB GET.
- **Browser-only real collision resolver probe now passes**: inject a temporary QA function into the served HTML response (no production edits). Calling original `checkFlightCollision(previous,next)` for a 32-unit fighter path, at 50 substeps, safely clears statue at island ground +38 and triggers exactly `Collision with Statue of Liberty` at ground +20, both with fallback and staged candidate. The browser test also samples **96** `navigationSurface` and ground values in concentric rings around Fort Wood: **maximum fallback/candidate difference = 0.000**. This proves existing runtime collision behavior is unchanged for those paths, not that every visual triangle has physically accurate collision.
- [PATROL regression #44961203192 — PASS](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/44961203192). Original `assets/nyc/statue-of-liberty.glb` and `?nycModels=legacy` rollback remain unchanged. Committed `landmarks.liberty.enabled=false`, production never activated.
- Independent screenshot reviewer of prior 24k iteration documented a centered stone base without obvious duplicate pedestal. The lower 15.9k mesh still requires central QA perspective sign-off and low-altitude flyby testing; one plane sweep is not a full hand-flown controller regression.
- **Verified tighter scenario-only collision (#130):** old Liberty collision remained an ~10.89-unit lower-body AABB even though the approved 15,900-triangle GLB base has a maximum XY-planar radius of only ~6.592 units. PR #130 introduces 16 triangle-conservative height bands computed from the *actual SHA-pinned GLB*, retaining the original +0.55-unit aircraft margin. It activates **only** when the rendered model is the 15.9k-triangle, 31.3-high approved scenario GLB with verified footprint. When the scenario is disabled, loading fails, the graphics downgrade, or another landmark/map is selected, the previous collision logic remains unchanged. This is a radial bounding approximation, not per-triangle collision or surveyed geometry.
- **Browser-tested clearance:** [Actions 44963170908](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/44963170908) completed successfully: real `checkFlightCollision` ran **12/12 non-crashing plaza-edge sweeps** at radii 8.2/9.1/10.3 and heights 5/11/20/29 (game units); real center-body collision remains `Collision with Statue of Liberty`, high overflight remains safe, and **96/96** `navigationSurface`/ground samples have zero candidate-vs-fallback delta. Source-backed Node [44963170790](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/44963170790) checked that no profile band excludes a GLB triangle (**448/448 tests passed**). These runs are on isolated PR #130, not a production release.
- **SwiftShader is not native Windows GPU**: run #44961203209 used software ANGLE/SwiftShader; fallback and candidate averaged ~929.8 ms and ~924.7 ms respectively over 37 frames on a noisy shared runner. These are **not Windows frame-rate results**. Native Chrome GPU testing is still outstanding.

## Windows Chrome native GPU verification (opt-in, not run by Actions)
After checkout of the QA branch with `assets/nyc/scenario/liberty.glb` staged, install Google Chrome, Node.js and Python. Use two PowerShell terminals:

```powershell
# Terminal 1
python -m http.server 8765
```
```powershell
# Terminal 2
npm install --no-save --no-package-lock --ignore-scripts playwright pngjs@7.0.0
$env:PATROL_LIBERTY_GPU_MODE = 'native'
$env:PATROL_BASE_URL = 'http://127.0.0.1:8765'
node scripts/nyc-liberty-static-webgl.mjs
```

Native mode opens installed Google Chrome in a visible window. The result `artifacts/nyc-liberty/webgl-review.json` records the unmasked renderer string, three explicit image comparisons, real GL errors, and the two sampled average frame durations. It refuses to call the hardware test a pass if the reported renderer is SwiftShader, llvmpipe, lavapipe, software, or Microsoft Basic Render. This is a **reproducible Windows QA test**, not a claim of having performed the Windows run in cloud CI.

## Release gate
Demand all source, licensed GLB, <=8 MiB / <=25k triangles / single <=4 MiB image, and real WebGL2 screenshot results, plus HUMAN REVIEW of:
- Torch, crown, tablet and robe silhouette and front direction toward harbor.
- Existing Fort Wood base vs candidate pedestal/foundation clearance, no duplicate masonry.
- No UV seams/material missing, nonblack render, camera-matched improvement and frame-time comparison.
- Existing `nycModels=legacy` rollback, scenario-only profile collision and other maps unchanged; preserve the 12 real plaza-edge sweeps and 96-point parity checks. This profile avoids the inherited ghost collision for the verified GLB but still requires human low-altitude flyby sign-off, not merely a structural/pixel test.

**No activation or merge** before central QA acceptance, Windows browser hardware performance, flight/collision regression, and clearance review. The documented run #33 artifact was actually inspected; subsequent changes must generate fresh successful evidence. A structural or pixel-difference test alone never proves photogrammetric accuracy, safe landings, or native GPU FPS.
