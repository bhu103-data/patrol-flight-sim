# PATROL — external street lamp asset audit (2026-11-20)

**Status: research and producer-binary verification only. No new model has been placed in the shipped Chongqing or NYC scenes. No scene performance or screenshot comparison is claimed.**

## Why a second source search?

Sketchfab's download indicator is not the model archive. The public indexed listing for [Modern Chinese Street Lamp](https://sketchfab.com/3d-models/modern-chinese-street-lamp-ce9d029fe1c14d01b9193b2c31f7c484) names Cyrus_JS and Fotuguan Park, Chongqing. The user-supplied listing reports about **1,866 faces** and **CC BY 4.0**. We still need an authenticated official download, the actual source formats and exported triangle count, texture rights/provenance and proper author attribution. An indexed description and a 3D web preview are not enough to import or redistribute an asset. Do not scrape preview endpoints or bypass download restrictions.

## Other searched providers (no charge)

| Priority | Provider and model | Public listing | Producer-reported specs | Constraints |
|---|---|---|---|---|
| 1 | Sketchfab: Cyrus_JS Fotuguan lamp | [model](https://sketchfab.com/3d-models/modern-chinese-street-lamp-ce9d029fe1c14d01b9193b2c31f7c484) | ~1,866 faces reported; CC BY 4.0 listing | Original source and textures **not obtained/audited**, redistribution **not approved** |
| 2 | Grab3D: modern LED street light | [model](https://grab3d.com/models/city/street-light/), [producer manifest](https://grab3d.com/dl/street-light/manifest.json), [GLB download](https://grab3d.com/dl/street-light/street-light.glb) | 702,900 bytes, 5,280 triangles, 2K textures, 8.158m tall; producer reports original procedural Blender work and CC0 1.0 | First direct-download candidate for **CI binary audit**, **not yet installed** |
| 3 | tevy: Street Lamp | [model](https://tevy.dev/models/street-lamp) | LOD0 2,515 tris/788KB; LOD1 1,153 tris/253KB; LOD2 234 tris/78KB; 8.1m | CC0 claim, but GLBs use **Meshopt + KTX2**, which current simple scene asset validator rejects; requires conversion/decoder audit |
| 4 | tevy: City Street Lamp | [model](https://tevy.dev/models/city-street-lamp) | LOD0 3,600 tris/862KB; LOD1 1,858 tris/278KB; LOD2 360 tris/101KB; 9.12m | Same compressed-loader constraint; CC0 claim; not installed |
| 5 | Poly Haven: Street Lamp 01 | [model](https://polyhaven.com/a/street_lamp_01) | 31K triangles, 31.41MB source glTF bundle, ~3.9m | Verified CC0, but Victorian cast iron is **wrong style** for Fotuguan modern road and too heavy for repeated lamps |
| 6 | Open CC0 GitHub city kits | [model pack](https://github.com/kayquer/kit-cidade-lowpoly) | max 1.5K tris, 150KB, no textures | Fully redistributable, but intentionally flat/cartoon style; not suitable for PATROL realistic foreground |
| 7 | Optimized Poly Haven sample | [3D FPS asset](https://github.com/cktang88/3d-fps/tree/main/public/assets/models/props/street_lamp_01) | 261,532 bytes in that repository | Source attributed to Poly Haven CC0 in its game README; Victorian design mismatch; not imported |

### Existing game baseline

`assets/chongqing/streetlife.js` currently draws many light poles, lampheads and glints using three instanced-mesh batches. It checks road, terrain and collision clearance before placement. Existing local lights, car lights and light-quality fallbacks remain untouched. Replacing a large repeated set with individually decoded GLBs increases draw calls, geometry and memory without proving better street visuals.

### Binary admission gate (new branch only)

The new public GitHub Actions job `.github/workflows/asset-glb-audit.yml` downloads the **direct producer-hosted Grab3D GLB and manifest**, not a mirror or browser preview, with **no login, payment, or secret**. `scripts/audit-external-glb.mjs` checks:

1. glTF 2.0 magic, binary chunk integrity, dimensions of buffer views, no external payloads or unreviewed required extensions;
2. Actual index-based triangle count, ≤6,500 trial triangles, ≤1MiB single GLB, material and node count, image formats and embedded texture byte lengths;
3. The file's byte length versus the producer manifest, and disclosed procedural source and CC0 license claim;
4. SHA-256 of the actual downloaded GLB; artifacts include the manifest, producer LICENSE.txt and JSON audit report;
5. Tests that **all reviewed candidates remain disabled** and no external source is referenced by the live level.

**Failing any gate blocks consideration; it does not trigger runtime installation.** Binary and texture *authorship* cannot be proved from a GLB alone: the producer's rights statement and source evidence still need human review.

### Required visual decision after a binary passes

Only after the original GLB is audited: on an isolated branch, select **one** terrain- and building-clear modern terrace street segment, swap at most one original instanced lamp (do not add a duplicate), and keep the old instanced mesh as the exact rollback. Lock identical camera, day/night, altitude, pixel ratio and graphics setting; capture baseline/candidate screenshots from the **actual Chongqing game** with Playwright/WebGL2; report median and p95 frame time, draw calls, triangles, decode time, VRAM/texture load estimate and source GLB bytes. Repeat with the existing low-quality preset and a low-altitude flight pass. A visual change that reads poorly, causes collisions/overlaps, or worsens frame time without a clear benefit **does not ship**.

Keep all existing NYC, Alaska, waterplane, docks, bridge and cosmos features unchanged.

### NYC duplicate/identity guard

Draft [PR #67](https://github.com/bhu103-data/patrol-flight-sim/pull/67) imports a 3Dystopia scan from **Paris's Luxembourg Garden Liberty replica**, not New York's actual statue; its numerical GLB and decode results do not authenticate landmark identity. Do not merge it as a NYC original replacement. Flatiron-*inspired* undownloadable or unlicensed art is excluded. Reject ND, NC, Editorial, unknown author/texture rights, non-downloadable display-only and assets whose terms prohibit bundling in public GitHub.

**Current verdict:** keep existing original model and streetlights until authenticated file, rights review and in-game WebGL comparison all pass. There is no screenshot, frame-time or final visual improvement evidence yet.
