# Alaska Tracy Arm LF2025 conservative shoreline preview — DRAFT

**Status:** opt-in experiment, disabled by default; never merge or call it a verified coastline until browser/collision QA is complete.

## Scope and provenance

- Repo base: current `main`, separate branch `codex/alaska-landfire-shore-preview-20261122`. This work does **not** cherry-pick or overwrite QA branches #184/#201.
- Licensed source: public-domain USGS LANDFIRE 2025 Alaska Existing Vegetation Cover (EVC) (water category **11**). Official raster service: https://lfps.usgs.gov/arcgis/rest/services/Landfire_LF2025/LF2025_EVC_AK/ImageServer
- Original AOI source TIFF SHA-256: `8b944c3691523848d6708ae744077d9e137df21ac1c08cc4ed60e4dd6ec736e2`. CRS EPSG:3338, 256×256 signed Int16, resampled nearest-neighbor into EPSG:4326 bounding box `[-133.265, 57.851, -133.135, 57.923]`.
- Generated asset: `assets/alaska/landfire-evc-water-preview.json`, water code 11 as 256² south-first uint8 classes, run-length encoded with unsigned LEB128 lengths and base64. Total **13,658 water-class pixels**, 807 runs, raw 65,536 bytes; a ~2.2KB shipped metadata file. No original photo or externally licensed texture is embedded.
- The source is a **coarse vegetation-cover water classification**. It is **not** the NOAA N55W135 mixed-vintage mean-high-water line dataset, current bathymetry, or a full authoritative land/sea boundary.
- Separate read-only QA found 7 NOAA-credited line segments dating from 1991/2015/2017, 1,525 vertices, 22.40km: see draft #201. These lines are NOT baked into this runtime preview.

## Default safety and opt-in

Start Alaska with normal URL and the game uses **exactly the unchanged USGS 3DEP terrain, floatplane checks and fallback**. To request an experimental local preview, add:

```text
?alaskaShore=landfire-preview
```

The preview is loaded **only for Alaska** with a successfully loaded, matching USGS DEM, and only outside `graphics=compat` mode. Missing/invalid asset, fetch timeout, `alaskaTerrain=legacy` and other maps retain the existing baseline. Low-performance compatibility mode is not modified.

Game-terrain production worker uses the source-backed class-11 mask, matched in the same south-first/rotated 256×256 grid as 3DEP. On the **opt-in** path it only submerges a 3DEP grid sample when all are true:

1. `measuredHeight(u,v)>1m`, so existing submerged cells are not changed.
2. `measuredHeight(u,v)<=12m`, capping potential visual/physics edits to low-lying land.
3. `measuredWaterClass(u,v)===true`, with nearest-neighbor sampling to preserve the categorical source.

The existing C185 start/132-unit eastbound takeoff corridor, harbor dock/cabin safety buffers and upper glacier corridor are protected from opt-in reclassification. In the 1024×1024 terrain grid, **7,088** potential low-lying classified cells were found; **660** fall in the protected start/harbor corridors (255 launch, 405 harbor), leaving **6,428** preview cells (about **0.61%** of the grid). These are source/worker-grid counts, not an assertion of visual accuracy or safe landing rate.

No existing aircraft, float physics, docks, ships, map switching, terrain sampler, shader, or texture atlas is modified directly; terrain geometry changes **only inside this opt-in test**. The existing 25-point float contact check continues to query the resulting terrain.

## Upstream conflict and measured scale

Across 65,536 source-aligned cells, LANDFIRE classifies 13,658 as water, while 3DEP/terrain classification disagrees dramatically:
- **337** source cells have EVC water class AND DEM elevation **1m < h <= 12m** (conservative preview candidates);
- **8,197** EVC water cells have DEM elevation **>12m**, including **7,339 >100m**, so they remain **untouched** by this pilot;
- conversion operates at the production 1024×1024 terrain grid using interpolated elevations. **337 is not a count of changed game pixels**; bilinear interpolation produces the above 6,428 remaining 1024-grid candidates after safety buffers.

This preview cannot resolve the full historical coast mismatch; increasing the threshold to carve high cliffs would be unsafe and is explicitly outside scope. No assertion that LANDFIRE is more accurate than 3DEP for all shoreline/terrain points is made.

## Verification / blockers

- Data decoder test should verify the SHA-256 of the expanded 256² uint8 raster:
  `266c062c4ff2cecb3091e329a74c3e5747404d8947097a1e01279c8f11eb9f28`.
- Node tests must verify the opt-in-only height changes, water-cell count, authoritative worker function extract and valid fallbacks.
- Before approval, obtain real WebGL2 A/B screenshots in a fixed camera, compare DEM and experimental modes, test Alaska floatplane 132-unit start corridor, other map switching, low-GPU `graphics=compat` path, 25-point foot-contact, GPU FPS/first-load behavior, and unchanged unflagged default. The live visual evidence must show actual game canvases (not GIS QA figures).
- PR is **draft / unmerged** until evidence is collected. No change to `main` or other active feature branches.

## How to reproduce

```sh
node --test tests/alaska-landfire-water-preview.test.mjs
node --test tests/*.test.mjs
```

The official source and this derived experimental file are distributable public-domain government data; retain origin, hashes, coordinate transform, acquisition date, and modification history. No claim is made for any separate proprietary models, photographs, or third-party CUSP component.


## Regression gate: C185 shallow-bank protection

The first 1024-grid floatplane regression detected that the experimental water mask turned the known non-landable shallow bank north of the Alaska spawn `(-19,-631)` into usable water. Rather than weakening the test, the preview now **excludes** the existing published spawn, 132-unit safe takeoff corridor, authored harbor and glacier front. The default game was never affected. The updated test exercises the 25-contact production safety gate before considering this pilot mergeable.
