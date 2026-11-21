# Tidewater-inspired golden hour: PATROL WebGL2 visual pass

## Provenance and scope
- Visual reference: [zzzhengqi/tidewater](https://github.com/zzzhengqi/tidewater), MIT copyright © 2026 DRG Software Solutions LLC. Reviewed `LICENSE`, `CREDITS.md`, `README.md`, `src/sky/Atmosphere.js` (Hillaire 2020 atmosphere) and `src/ocean/WaterMaterial.js` (dielectric Fresnel, GGX sun radiance).
- **Original PATROL GLSL only**, no copied Tidewater source, shaders, assets, audio, textures, sky LUT or FFT simulation. Tidewater's own third-party assets retain separate licences.
- PATROL is a *single-file native WebGL2 raymarcher*, not Three.js/WebGPU/TSL. Existing 18-mode ocean cascade, buoyancy, C185, waves, boat wakes, foam, terrain, city geometry and controls are unchanged.
- Separate open PR #126 already covers NYC gust patches / fragmented foam / caustics. Separate PR #96 handles Manhattan building-vs-world twilight haze. This PR does not duplicate or modify either feature.
- Baseline: main `b834524cc`. Separate branch only; do **not** merge directly into main or shared integration, keep Draft for concentrated visual QA.

## Implementation
- `index.html`: independent `goldenHourWeight()` bounded by actual `uSun.y`, existing twilight `uAtmosphere.y` and existing `naturalLight()` map selector; no new uniforms or raster passes.
- Sky: modest sun-azimuth-dependent peach/rose horizon and ivory sun disk on **near-horizon** daylight; original blue overhead, overcast blending, nighttime, Alaska aurora and Vegas palette remain.
- Water: low-sun reflection tint matches horizon. Extra **capped** 0.23-unit broad glint uses world-space existing facets, analytic flat-water reflection direction, existing rough GGX highlight and LOD mask; no screen-space stripe or FFT change.
- Reflections use the same existing sun/cloud/terrain-occlusion factors, so bloom-like contribution is suppressed for clouds, darkness and shadow.

## QA required before merge
1. Compile the **actual WebGL2 shader** on supported browser and capture matching harbor camera at `12:00`, `18:30`, `00:00` in Clear, with 18:30 side-by-side base/current comparisons for New York, Alaska and DC; verify sky horizon and glint continuity. No source-level success substitutes for screenshot.
2. Low flight over NYC Harbor and Tracy Arm: look for solar disk clipping, waterline edge discontinuity, glitter stepping/aliasing, wake disappearance and C185 buoyancy/flight regression; keep existing road/building boundaries.
3. Run Node regression and cross-map WebGL2 smoke, then hardware GPU profiling. Software SwiftShader rAF timings are not 60fps evidence. 
