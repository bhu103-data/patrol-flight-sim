# Alaska Fjords — open-source research and implementation record

Checked 2026-11-20. Target: `patrol-flight-sim` native WebGL2 main flight scene, existing `FLIGHT_MAPS.alaska`. Do not add a duplicate map or silently change New York, DC, Chongqing or the universe portal.

## What this change actually implements

- Original GLSL Alaska-only auroral curtains: slower coherent advection instead of global flashes; cloud/fog and night visibility.
- Alaska-only surface shader: multi-scale spruce, slate/strata, snowpack, glacier-blue ice.
- An optional one-batch original mesh under `assets/alaska/alaska-fjord-detail.js`: glacier crevasses, fractured drift ice, sparse cliff strata. GPU resources are disposed on map switches; low-fidelity mode does not load this mesh.
- All original flight physics, existing procedural terrain, Alaska landmarks, harbor, routes and boundary are preserved.
- The glacier and fjord positions are **stylized flight-scale geometry, not surveyed Alaska**. No USGS raster has been imported in this patch. No third-party source code, imagery, meshes, textures, or new runtime network request is copied or bundled.

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
3. Define a documented WGS84 -> local tangent-plane transform; convert real horizontal meters and heights into *one explicit flight game scale*, and use that exact transform in terrain mesh, shader, collision, nav-map, waterline and spawn.
4. Create real-world water masks/shoreline from licensed sources (USGS/OSM with attribution) and photographic landscape textures with their own credits. Avoid Google Maps 3D/photogrammetry scraping or ambiguous model licensing.
5. Stream/cull only visible bounded tiles and pre-compress assets so GitHub Pages loads promptly; keep coarse procedural fallback for offline/slow connections.
6. Validate low-altitude flight, waterline, crash detection, spawn and map switching on mobile and desktop GPU. Compare a fixed set of surveyed reference points; never market the result as a 1:1 map until those checks pass.

## Quick checks

`node --test tests/alaska-fjords.test.mjs`

Review on the Alaska map in clear day, dusk, clear night, overcast night and mobile low-quality graphics. The static test does not replace actual shader compilation, frame timing or screenshot comparison.
