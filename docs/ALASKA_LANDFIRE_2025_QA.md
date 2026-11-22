# Alaska LF2025 Tracy Arm GIS cross-check — QA only

**Date:** 2026-11-21 EST / 2026-11-22 UTC  
**Scope:** USGS LANDFIRE LF2025 EVT/EVC/EVH versus the PATROL USGS 3DEP Tracy Arm bare-earth heightmap.  
**Status:** Real official data acquired and analyzed; **NOT integrated into the game**.

## Reproducible evidence

- GitHub Actions: https://github.com/bhu103-data/patrol-flight-sim/actions/runs/44987731439
- Downloaded artifact name: `alaska-tracy-arm-official-gis-samples`, ID `14740187670` (retention 7 days).
- Workflow: `.github/workflows/alaska-official-aoi-fetch.yml`
- Offline diagnostic: `tools/alaska/audit_landfire_aoi.py`
- Current in-game DEM: `assets/alaska/tracy-arm-3dep.json`
- Official data: USGS LANDFIRE LF2025 Alaska 3-layer ImageServer (U.S. public domain). All datasets were resampled and source SHA-256 is recorded in the artifact report.
- TIFF inputs: 3 × 132,299 bytes, EPSG:3338, one band signed Int16. Reprojected to EPSG:4326 bounds `[-133.265,57.851,-133.135,57.923]` with nearest neighbor, 256×256, **south-first** rows. PATROL's 90-degree in-game rotation must be applied exactly once later.

## Measured results (65,536 colocated cells)

| Metric | Cells |
| --- | ---: |
| USGS DEM elevation ≤ 3 m (approximate water only) | 6,293 |
| LANDFIRE EVC code 11 (water) | 13,658 |
| Classified as water by both | 5,253 |
| EVC water / DEM land | 8,405 |
| EVC non-water / DEM water | 1,040 |
| Total water-class disagreements | **9,445 (14.4119%)** |
| EVC tree class (110–199) | 11,563 |
| Original EVC trees on DEM approximate water | 148 |
| Remaining after excluding DEM water and a full-cell shore margin | 11,209 |
| Remaining after preserving current game forest radius and authored harbor/glacier no-tree corridors | **5,192** |
| Final candidates on DEM water | **0** |
| Final candidates in protected scenic corridors | **0** |

The 11,209 → 5,192 reduction comprises **5,837 cells outside the existing scene's radius (765 game units)** and **180 inside protected scenic corridors**. The initial audit report combines both as `removed_by_scenic_protection_cells=6017`; do not misinterpret that field as 6,017 glacier/harbor conflicts.

### Fixed game position checks

- Alaska respawn (-19,-667): DEM 0 m, EVC 11 = water, no tree.
- Harbor (151,-525): DEM 0 m, EVC 11 = water, no tree.
- Upper glacier (130,558): DEM 399 m, EVC 146 = tree, but final protected candidate **false**. The authored glacier exclusion is essential.

## Output/asset budgets

- Diagnostic final candidate mask: `qa/safe_tree_dem_margin1.southfirst.u8.gz`, **3,473 bytes** compressed, 65,536 bytes decoded; SHA-256 `f80dc6735deff655002c89acc1e994f387ae97fb3462672998f686fe11ff438b`.
- Approximate DEM water diagnostic: `qa/dem_water.southfirst.u8.gz`, 450 bytes compressed.
- **These are QA-only masks**, not render textures or measured individual tree locations.
- Existing conifer geometry, lighting, aircraft controls, collision, waterlines, and low-graphics fallback are unchanged, so no new GPU frame time was measured.

## Release blocker and next decision

**Do not use LANDFIRE water code 11 to overwrite PATROL's coastline or collision.** The 14.41% disagreement may arise from differing classification sources, sampling, historical changes, and/or DEM shoreline treatment; its cause has **not** been isolated. NOAA AK1803-CM-T surveyed shoreline would be an independent arbiter, but the attempted NOAA WFS capabilities endpoint returned HTTP 404 and an actual shoreline vector is **not yet obtained**.

No authored asset represents a photogrammetric Sitka spruce or true individual tree location. Before optionally integrating a vegetation mask, test candidate gating with terrain height/slope, keep the existing 940-tree scene cap and glacier/harbor exclusions, preserve compatibility and map disposal, and capture fixed-camera WebGL2 screenshots/FPS on representative hardware.

This PR should remain **draft / unmerged** until the shoreline discrepancy is reconciled and runtime tests have been completed.


## 2026-11-22 — Additional real-data disagreement diagnostics

These statistics were independently calculated offline from the actual Actions artifact \`alaska-real-gis-safe-forest-qa.zip\`, reprojecting \`LANDFIRE_EVC_AOI.tif\` to the exact same 256×256 EPSG:4326/south-first grid as \`qa/dem_water.southfirst.u8.gz\`. Distances are **image-cell** distances to the shoreline of **either** product, not horizontal positional errors or a surveyed tidal datum.

- 9,445 water classification mismatches (14.4119% of 65,536 cells).
- **8,522/9,445 (90.2%)** are within 8 image cells of at least one dataset's coastline.
- **923** disagreements are farther than 8 image cells from both shorelines.
- A brute-force integer translation of the LANDFIRE water layer over offsets in [-10,+10]×[-10,+10] cells did not resolve disagreement: the best **overlap-normalized** mismatch rate remained about **13.99%** versus **14.41%** unshifted. These rates are computed on different valid overlap extents and must not be misrepresented as direct coastline positional accuracy.

**Interpretation:** A one-off image flip/translation is not a sufficient cure; shoreline geometry/classification/vintage/vertical-datum and terrain-product differences need independent adjudication. Do NOT replace physics water/shoreline or invent a surveyed coast.

### NOAA official alternatives, verified network outcome

- The documented NGS AK1803-CM-T project exists and has NGS-derived, older project shoreline; its NSDE distribution is not a verified direct per-project ZIP yet.
- The current NOAA NSDE home page \`https://nsde.ngs.noaa.gov/\` is accessible and references official CUSP vector index at \`/cusp/cuspidx/{z}/{x}/{y}.pbf\` with project/tile downloads under \`/downloads/{name}.zip\`. Index-name resolution and individual archive retrieval must be **measured**, not guessed.
- The **NOAA CUSP Alaska composite ZIP** \`https://geodesy.noaa.gov/dist_shoreline/Alaska.zip\` is a different product from project-specific NGS AK1803. GitHub Actions HEAD verification on run \`44988250654\`: **138,630,643 bytes**, HTTP 200, modified 2026-11-10. It includes multiple contemporary sources; verify per-feature provenance/reuse conditions before *redistributing* any derived geometry.
- NGS WFS/WMS \`/GeoServer/NSDE/ows\` endpoints tested via both \`www.ngs.noaa.gov\` and \`geodesy.noaa.gov\` returned HTTP 404; do not claim WFS data acquired.
- Staged isolated QA probes \`tools/alaska/probe_noaa_shoreline.py\`, \`tools/alaska/fetch_noaa_cusp_index.py\`, and \`tools/alaska/clip_noaa_cusp.py\` have **no approved runtime-data integration**. A CI job that has not run successfully is not a fetched dataset.

Source and official metadata: https://www.fisheries.noaa.gov/inport/item/60585 and https://nsde.ngs.noaa.gov/more.html.
