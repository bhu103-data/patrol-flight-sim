# Alaska Fjords — open-source research and implementation record

## 2026-11-20/21 — Near-field glacier relief and forest silhouette pass

The existing Alaska-only `alaska-fjord-detail.js` GPU batch now creates a
**42-segment irregular glacial calving front**, each with three-dimensional
facing geometry and three stratified ice/sediment color bands (126 bounded
bands). The blue-black fracture gaps and ice overhangs are original authored
visual geometry. The measured USGS DEM remains the only terrain collision
source. The exact glacier face is not photogrammetrically scanned or mapped.

Small terrain-sampled rock talus fragments are generated only on upland
slopes with clear local elevation changes. A bounded number of short
asymmetric spruce branchlets add close-up silhouettes without billboard
cards, extra draw calls, external models or a new rendering engine.

The entire set stays inside the same Alaska-only single GPU mesh and
participates in the existing map-switch disposal and low-graphics fallback.

Validation includes static vertex bounds, counts of the new features and
the existing WebGL2 Alaska browser smoke capture. A separate opt-in review
viewpoint can be selected by opening the game with `?alaskaView=glacier`,
then choosing Alaska and starting the flight; this starts near the glacier
face at a terrain-cleared altitude. The normal Alaska flight spawn is
unchanged. The CI browser test saves both full-level and closer glacier
screenshots. These checks do not measure native hardware FPS or certify
survey-grade glacier geometry.


## 2026-11-20/21 — CC0 photographic PBR and animated calving

Photo material asset build: `tools/alaska/build_photo_atlas.py`; GitHub Actions
build `.github/workflows/alaska-photo-atlas.yml`. Original **CC0 photographic
maps** are sourced only from [Poly Haven Rock 01](https://polyhaven.com/a/rock_01)
and [Poly Haven Snow 02](https://polyhaven.com/a/snow_02),
[Forest Ground 04](https://polyhaven.com/a/forest_ground_04), and
[Forest Ground 03 / Pine Needles](https://polyhaven.com/a/forrest_ground_03), under
[Poly Haven's CC0 license](https://polyhaven.com/license). Artist: Rob Tuytel.
The separate *local* 1024×256 WebP atlases contain color, OpenGL normal RGB and
roughness A channels; the files are committed under `assets/alaska/`.
`alaska-photo-manifest.json` records provenance and layout. No network
requests to Poly Haven occur during gameplay. The build job alone downloads
1K source materials using allowlisted hostnames and a strict size cap.

The Alaska-only world raymarcher blends these four photographic surfaces with the existing
USGS-based elevation terrain at camera distances under 255 flight units,
including simple normal-mapped micro-shading and roughness-based reflectance.
It uses up to three atlas samples on qualifying nearby pixels (two albedo materials blended smoothly plus one normal/roughness fetch), to avoid visible material transition rings. Sheltered-fjord wave slopes are damped only in Alaska. **These are real
photographs, not measured on-site Alaska imagery.** Geometry is not displaced
by the normal map, and this lightweight lighting is not a complete energy-
conserving metal/rough PBR renderer.

The updated forest-floor photographs cover nearby low-elevation shores, while
snow and rock photographs cover the alpine slopes. Dense but bounded, jittered shoreline conifer
forest instances replace the legacy conical tree patches on capable GPUs;
low-graphics mode retains its original fallback.

The photos are loaded on demand when the Alaska map starts, use mipmaps,
and are freed when switching maps. Compatibility / low-detail / resource
failure keeps procedural materials, without blocking flight loading. A
separate, capped optional module `assets/alaska/alaska-ice-motion.js`
adds moving near-water floes and periodically calving shards, using the
same terrain sampler to refuse drift onto land. Motion is visual only:
no new aircraft or iceberg collisions or real observed ice velocities.
It does not physically simulate calving events.

Tests: `node --test tests/alaska-fjords.test.mjs tests/alaska-usgs-dem.test.mjs tests/alaska-photo-ice.test.mjs`.
The tests include bounded draw counts and asset/license metadata; browser
shader compilation and GPU performance must still be checked on representative
devices. Direct WebGL screenshot validation has not been claimed.


## 2026-11-20/21 — Actual USGS Tracy Arm elevation integrated

The Alaska flight menu now loads `assets/alaska/tracy-arm-3dep.json` (a baked,
**real** USGS 3DEP Bare Earth ImageServer grid). The original procedural terrain
remains a fallback if the local asset cannot be decoded or fetched. To force
that fallback, open `?alaskaTerrain=legacy` in the game URL.

- **Region:** Tracy Arm / North Sawyer Glacier, Alaska. WGS84 bounds
  longitude **-133.265 to -133.135**, latitude **57.851 to 57.923**.
- **Raster:** 256×256 cells, approximately **30.1×31.3 m** spacing in the
  downloaded raster (not native 5 m resolution). Measured maximum 1,836 m,
  ≈90.4% above 3 m altitude. Heights rounded to whole metres.
- **Source:** [USGS 3DEP public-domain dynamic service](https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer)
  requested as float32 GeoTIFF. The build script is
  `tools/alaska/build_usgs_dem.py` and only requires `numpy`, `tifffile`,
  and Python 3. The source and bounding box are embedded in the output metadata.
- **Orientation:** Source stays WGS84 / north-up in the baked data. In the game
  the grid is **rotated 90°**: game north (+Z) corresponds to geographic east,
  aligning the real fjord water corridor with the existing fictional harbor
  and flight-tour axis. This is declared rather than disguised as real compass
  bearings. Game coordinates cannot be used as GPS without reversing this mapping.
- **Scale:** Horizontal approximately 4.1–4.2 real metres per game unit.
  Vertical heights are deliberately compressed into the 75-unit terrain
  range and 100-unit flight ceiling (`min(0.04, (0.9*75-12.2)/maxElevation)`
  game units per real metre). **Not an accurate physical 1:1 map.**
- **Collision:** CPU height sample, GPU terrain atlas, nav-map and route/spawn
  altitude use the exact same resampled elevation field. The Alaska harbor and
  spawn lie over sampled fjord water after the rotation; the glacier/falls lie
  on measured uplands. Unchanged flight physics.
- **Assets:** ~175 KB of base64-encoded 16-bit heights in a JSON file, only
  fetched when Alaska starts. No runtime request to USGS, no Google Maps
  photogrammetry or third-party proprietary imagery. The source is public
  domain; source URL and metadata are retained.
- **Vegetation:** Original batched procedural coast evergreens were augmented
  with bounded nonrepeating slope-aware spruce/hemlock silhouettes. Those
  trees are generated art, not measured tree locations.
- **Safety:** The source generator refuses flat/empty/wrong-shaped data and
  checks elevation. `node --test tests/alaska-fjords.test.mjs tests/alaska-usgs-dem.test.mjs`
  validates the baked dataset and placement contracts.

This introduces **real mountains and coastline topology**, but the authored
harbor, glacier mesh, decorative trees and ice floes remain artistic. Photographic
rock/snow material is now bundled, but detailed 3D ice fields, high-resolution
terrain LOD and surveyed buildings/ports still need separate performance work.


Checked 2026-11-20. Target: `patrol-flight-sim` native WebGL2 main flight scene, existing `FLIGHT_MAPS.alaska`. Do not add a duplicate map or silently change New York, DC, Chongqing or the universe portal.

## What this change actually implements

- Original GLSL Alaska-only auroral curtains: slower coherent advection instead of global flashes; cloud/fog and night visibility.
- Alaska-only surface shader: multi-scale spruce, slate/strata, snowpack, glacier-blue ice.
- An optional one-batch original mesh under `assets/alaska/alaska-fjord-detail.js`: glacier crevasses, fractured drift ice, sparse cliff strata. GPU resources are disposed on map switches; low-fidelity mode does not load this mesh.
- All original flight physics, existing procedural terrain, Alaska landmarks, harbor, routes and boundary are preserved.
- The Alaska heightfield now has a **real USGS Tracy Arm DEM** when the baked local asset loads, while its authored harbor, glacier decoration and fauna remain artistic. The map is rotated and vertically compressed as described above; it is not 1:1 georeferenced gameplay. No third-party source code, imagery or meshes are copied or bundled. The game fetches its own lightweight local DEM JSON only when Alaska starts.

## Verified upstream references and rights

| Source | Relevance | Rights and caveats |
| --- | --- | --- |
| [USGS 5 m Alaska DEM](https://www.usgs.gov/centers/eros/science/usgs-eros-archive-digital-elevation-interferometric-synthetic-aperture-radar) / [Alaska DGGS elevation portal](https://elevation.alaska.gov/) | Accurate, real landform elevation | USGS 3DEP / IfSAR products public domain; download the selected region and preserve provenance. |
| [Alaska 2 arc-second DEM](https://data.usgs.gov/datacatalog/data/USGS%3A4bd95204-7a29-4bd4-acce-00551ecaf47a) | Statewide lower-detail LOD at ~60m | Public-domain USGS; not detailed enough alone for low-altitude glaciers. |
| [iLuzionsX/terra3d](https://github.com/iLuzionsX/terra3d) | Similar handwritten WebGL2 OSM + Terrarium terrain architecture | Inspect its LICENSE before copying source; it has not been bundled. |
| [leisurelyleon/aurora](https://github.com/leisurelyleon/aurora) | Raw WebGL2 / GLSL aurora reference | MIT; this change uses independent shader code, not an upstream copy. |
| [olawlor/AuroraRendererUnity](https://github.com/olawlor/AuroraRendererUnity) | Research-inspired 3D aurora | Unlicense/project readme states shader and datasets *not otherwise copyrighted* public domain; Unity/HLSL conversion required. |
| [Token-Gremlin/natural-disasters](https://github.com/Token-Gremlin/natural-disasters) | FFT seas, foam, atmospheric scattering, volumetric cloud techniques | MIT code; too heavyweight to import wholesale into existing single-pass game. |
| [leoawen/volumetric-clouds](https://github.com/leoawen/volumetric-clouds) | Volumetric sky lighting, god rays | MIT; Three.js renderer wrapper would need adaptation to native WebGL2. |
| [reearth/reearth-terrain](https://github.com/reearth/reearth-terrain) | Terrarium/Terrain-RGB/quantized terrain tiles | MIT *code*, but underlying Mapterhorn tiles are CC BY 4.0 and may need other attribution. |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) | Alaska street/airfield/harbor/shoreline data | ODbL; show OpenStreetMap attribution in-game and handle database/derivative terms. |
| [Poly Haven](https://polyhaven.com/license) | Photographic snow, ice, rock and bark PBR texture candidates | CC0 individual assets subject to individual source checks; not yet included. |
| [NASA image guidance](https://www.nasa.gov/nasa-brand-center/images-and-media/) | Satellite imagery and night sky reference | Follow NASA media and logo usage rules and third-party image notices. |

**Warning:** ArcticDEM Polar Geospatial Center's published exception excludes Alaska for some released imagery; do not assume that ArcticDEM's downloadable strip data can be redistributed for Alaska. Prefer USGS IfSAR.

## Next production-quality terrain integration

1. Choose **one** real bounded area (for example Juneau/Mendenhall or a Glacier Bay flight corridor) rather than claiming Denali, Fairbanks, and Juneau appear at true relative distances inside a 1,920-unit arena.
2. Fetch USGS public-domain IfSAR/3DEP DEM and its CRS/vertical-datum metadata; derive low/medium/high LOD tiles offline with GDAL. Preserve the original source attribution and acquisition date.
3. Improve the already documented WGS84 -> game-space rotation with a formal ENU transform and geospatial metadata for every authored landmark; preserve consistent terrain, collision, nav-map, waterline and spawn sampling.
4. Create real-world water masks/shoreline from licensed sources (USGS/OSM with attribution) and add further varied photographic materials with credits. Avoid Google Maps 3D/photogrammetry scraping or ambiguous model licensing.
5. Stream/cull only visible bounded tiles and pre-compress assets so GitHub Pages loads promptly; keep coarse procedural fallback for offline/slow connections.
6. Validate low-altitude flight, waterline, crash detection, spawn and map switching on mobile and desktop GPU. Compare a fixed set of surveyed reference points; never market the result as a 1:1 map until those checks pass.

## Quick checks

`node --test tests/alaska-fjords.test.mjs tests/alaska-usgs-dem.test.mjs tests/alaska-photo-ice.test.mjs`

Review on the Alaska map in clear day, dusk, clear night, overcast night and mobile low-quality graphics. The static test does not replace actual shader compilation, frame timing or screenshot comparison.
