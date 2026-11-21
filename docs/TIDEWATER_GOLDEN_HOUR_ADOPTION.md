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

## Actual A/B and clipping correction
- First WebGL2 run [44962775827](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/44962775827) produced four matched actual PNGs and no browser errors. First-pass candidate dusk vs pinned main dusk increased upper 40%-screen mean RGB by **(+14.73,+8.54,+1.87)**, but also increased >=250-channel pixels **2.424% → 4.847%**. Actual images showed an oversized near-sun white region, so the first pass failed artistic acceptance despite passing functional smoke.
- This correction suppresses added peach near the solar core via a continuous angular gate, warms the surrounding wider sky, and gently lowers the existing solar halo only near sunset. No changes to real solar direction, solar disk, ocean height, wakes, physics or map scene. **Needs fresh same-camera screenshots and QA before acceptance.**

## Ivory sun refinement and screenshot negative controls
- Corrected dusk WebGL2 [run 44963282115](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/44963282115): 1280×720 four matched screenshots; actual `candidate-dusk.png` upper-sky mean delta vs baseline **(+21.68,+8.17,-2.87)**, clipped share **1.451% vs old 2.597%**; JS warnings zero, WebGL error zero. Noon and midnight also rendered.
- In the screenshot the sharp disk remained visibly small/yellow compared with the user's bright creamy-white disk reference. Refined only solar-disk radius (bounded by existing golden-hour sun elevation) and ivory tint, with unchanged daylight/night disk, haze geometry, waves, sunrise direction and shadow casters.
- The smoke now fails if candidate dusk has clipped share above `min(4%,baseline+0.5pp)` or sky red-minus-blue warming below **+8 RGB channel units** relative to the *same* baseline camera. This is a functional/color acceptance guard, **not** photorealism certification. Updated code needs new screenshot CI proof.
