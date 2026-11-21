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
- Render-game height is 31.3 fictional units with origin (-140,-611). The procedural front faces negative game Z. Verify source GLB orientation relative to harbor BEFORE activation.

## Stage, analyze, compare — do not activate
The isolated GitHub Actions workflow nyc-liberty-cc0-webgl.yml:
1. Downloads authorized original with publisher CC0 statement, retains source SHA.
2. Installs Blender and CPU-decimates to under 25k triangles, bakes original diffuse into one 1024 px atlas without paid services or GPU training.
3. Strictly parses actual output GLB geometry/UV/images and checks byte limits.
4. Runs native WebGL2 with software Chromium at 1280x720, clear-summer-noon, Statue of Liberty Scenic View. Captures fallback first, then candidate using Playwright's browser-only manifest response override. Production files remain disabled.
5. Captures front/side/back candidate preview PNGs and uploads the staged GLB, screenshots, webgl-review.json and checksums as Actions artifacts only.

CLI equivalents (after dependencies / official download):
- blender -b --python tools/nyc/bake-liberty-cc0.py -- ORIGINAL.glb assets/nyc/scenario/liberty.glb
- node tools/nyc/check-liberty-glb.mjs assets/nyc/scenario/liberty.glb
- python3 -m http.server 8765
- node scripts/nyc-liberty-static-webgl.mjs

## Release gate
Demand all source, licensed GLB, <=8 MiB / <=25k triangles / single <=4 MiB image, and real WebGL2 screenshot results, plus HUMAN REVIEW of:
- Torch, crown, tablet and robe silhouette and front direction toward harbor.
- Existing Fort Wood base vs candidate pedestal/foundation clearance, no duplicate masonry.
- No UV seams/material missing, nonblack render, camera-matched improvement and frame-time comparison.
- Existing nycModels=legacy rollback, flight collision and other maps unchanged.

**No activation or merge** before visual review and explicit central QA acceptance. A successful structural audit or pixel-diversity check is not visual orientation proof. Browser results remain unverified until the workflow run completes and its artifacts are actually reviewed.
