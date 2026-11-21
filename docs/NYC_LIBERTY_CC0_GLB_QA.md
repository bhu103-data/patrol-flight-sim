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


## Verified candidate and actual browser evidence (2026-11-21)
- Source (original) file is 10,533,876 bytes. Optimized candidate from verified Actions run #44957802221 is **1,175,264 bytes**, **24,399 triangles**, one **97,198-byte, 1024×1024 PNG atlas**.
- Candidate SHA-256: `9cc07527071938ae18c85df0f039a25159d855bb4b5cadc3a11e06200adb94c0`. Reproducing the bake should confirm this exact value or explain the Blender/runtime difference.
- On [run #44957802221](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/44957802221), 14 existing tests passed, license/source retrieval passed, native SwiftShader WebGL2 rendered 1280×720 9 before/after/preview images with GL error 0, candidate response HTTP 200, and no browser exceptions. The run is complete and successful.
- Independent visual review of the actual run #33 screenshots shows torch screen-left, candidate detailed stone pedestal centered within existing Fort Wood walks, no obvious external-wall penetration in two low-angle cameras. **This is not a watertight mesh intersection computation**, and the art is not a surveyed replica.
- Browser software animation-frame averages from run #33: fallback **525.6 ms**, candidate **740.1 ms** (37 frames). These are SwiftShader software timings and NOT Windows GPU FPS. Hardware performance may be much better or worse; hardware validation remains outstanding.
- The original `assets/nyc/statue-of-liberty.glb` and `?nycModels=legacy` rollback path remain unchanged. The QA branch may include the candidate binary for reproducible review, but production `assets/nyc/scenario-manifest.json` Liberty `enabled=false` is a hard gate.

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
- Existing nycModels=legacy rollback, flight collision and other maps unchanged.

**No activation or merge** before central QA acceptance, Windows browser hardware performance, flight/collision regression, and clearance review. The documented run #33 artifact was actually inspected; subsequent changes must generate fresh successful evidence. A structural or pixel-difference test alone never proves photogrammetric accuracy, safe landings, or native GPU FPS.
