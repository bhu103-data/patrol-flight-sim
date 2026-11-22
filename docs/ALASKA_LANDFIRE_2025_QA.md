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
