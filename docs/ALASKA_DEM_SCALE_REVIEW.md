# Alaska DEM relief scale and ridgeline-normal check (2026-11-21)

This QA pass uses the existing **USGS 3DEP** public-domain bare-earth elevation
asset `assets/alaska/tracy-arm-3dep.json` as supplied; it adds no DEM,
copyrighted imagery, textures or offline animation. No source GIS correction is
claimed, and the six-cabin harbor remains a **fictional authored location**.

## Georeferencing and distortion in the existing flight world

- Source bounding box (EPSG:4326): longitude **−133.265 to −133.135**,
  latitude **57.851 to 57.923**, 256×256 unsigned 16-bit height samples.
- The baked manifest states approximately **30.1 m** spacing east/west and
  **31.3 m** north/south, covering **7.706×8.013 km**. These are source
  metadata approximations, not a freshly downloaded or reprojected survey.
- Existing worker intentionally rotates the raster **90°**:
  game north (+Z) samples geographic east; game east (+X) samples geographic
  north in reverse. This keeps current harbors, player spawn and glacier in
  the established world, not geodetic compass alignment.
- Both map axes use `MAP_SPAN=1920`: approximately **4.013 metres per game
  Z unit**, **4.173 metres per game X unit**. The game therefore suppresses
  the source's ~4% horizontal aspect difference.
- For the asset's **1836 m** maximum, the existing terrain clamp
  `min(0.04, (75×0.9−12.2)/1836)` yields **0.03012 game Y units per
  source metre**. One game vertical unit represents about **33.2 m**,
  compared with **4.0–4.17 m** horizontally; actual relative relief is
  compressed by approximately **8.0–8.3×**. This is not an exact physical
  1:1 mountain, coastline or vertical exaggeration.
- Samples at or below 1 m are assigned underwater height by existing worker
  policy; do not infer measured tide datum from the runtime shoreline.

## What this minimal runtime patch actually changes

The **land-fragment normal only** in `index.html`: when `uAlaska` is
selected, four existing `terrainHeight` samples now use a distance-aware
finite-difference footprint `clamp(0.85 + hitDist×0.007, 0.85, 3.50)`.
The maximum radius is **below half of the 7.5-game-unit DEM cell**. This
softens coarse-cell slope lighting at a distance without new samples or
changing any height sample, triangle, ridge silhouette, coastline, water
position, flight ceiling, collision, harbor, or low-graphics fallback.
All non-Alaska maps keep the fixed 0.85 value.

## Evidence and merging rules

Review same-camera native-game WebGL2 source-exact baseline
`38a9be192ca14cf5d47f6991d050b4093357f044` and this patch at
glacier/high-slope and coastal positions in daylight. Require no missing
terrain, no new invalid horizon edge, stable shoreline, and an acceptable
software Chromium RAF frame budget. RAF pacing is **not GPU frametime**.
Full USGS horizontal reprojection, real-height mountains and 1:1 coastline
must be designed **jointly** with all placement, landing and collision
systems in a separate scoped change; no silent height exaggeration here.
