# PATROL Tidewater-inspired golden hour, sky and sea — first pass

## Scope and licensing
- Research/reference: https://github.com/zzzhengqi/tidewater , checked 2026-11-21.
- Tidewater code MIT Copyright (c) 2026 DRG Software Solutions LLC. Its assets use separate licensing; see the upstream LICENSE and CREDITS.md.
- PATROL changes here are **original GLSL and JavaScript**, informed by atmospheric Rayleigh/Mie phase scattering, multiscale wave filtering and phase-gated surf foam, not copied upstream shader code. No upstream FFT kernels, WebGPU packages, three.js TSL nodes, photos, models or audio are imported.
- Tidewater ships four-cascade GPU FFT (256² each) and a compute LUT atmosphere. PATROL is still WebGL2 full-screen raymarching, with 18 analytic ocean modes, exact Fresnel and sea-level/floatplane shared sampler. Do not label it a four-cascade FFT or a faithful Hillaire LUT atmosphere.

## Actual runtime changes
1. Environment [T] now has a **Sun azimuth** slider. Default -1 = automatic solar time; 0° = +Z/north, 90° = +X/east, 180° = -Z/south, 270° = -X/west. The override maintains the original solar elevation from latitude/time/season; shared uSun drives terrain/cloud shadows, water reflections, horizon glow, and skyline shading. Moon clock is unchanged.
2. A lightweight clear-sky Rayleigh/Mie angular approximation and low-altitude aerosol horizon glow replace purely flat daylight colour, feeding both the air and existing Fresnel-reflected sky. Day/night/weather/Alaska aurora fallbacks remain.
3. Sun disk angular diameter reduced and softened to avoid a large low-poly orange disc. Distant GGX water glitter suppresses aliased high-frequency facet noise, with the specular lobe bounded by pixel angular width.
4. Shore swash foam emerges **after** the crest and has irregular, longitudinally broken sections; it reuses current water depth and foam mask. No shoreline geometry, hydrodynamic energy transport or true 3D plunging breaker is claimed.

## Evidence and performance
- Narrow tests: tests/tidewater-sun-sea.test.mjs, including compass invariants and preservation of the floatplane wave sampler.
- Fixed-camera browser workflow: .github/workflows/nyc-tidewater-sun-sea.yml. It captures New York Harbor at 19:00/330° and 19:00/359°, plus noon/Auto at an identical WebGL2 scenic view and viewport. The camera faces approximately 347°, so these azimuths place the low sun in the actual viewport. Earlier 18:30/140° and /220° captures placed the sun behind the spectator and gave false confidence from merely nonblank WebGL frames. Screenshot checks validate nonblank frames and the interactive UI; they do NOT establish photography accuracy or hardware frame time.
- No additional draw call, FFT texture, render pass, third-party asset or browser dependency in the production page. A handful of analytic shader operations are added; CI screenshot performance is SwiftShader software, not a 60 FPS guarantee.
- **Unverified / follow-up:** manual color comparison with Tidewater's golden-hour screenshots, hardware FPS/milliseconds with a 60 FPS target, realistic foam volume and beaches, all-map weather dusk/noon regression, NYC floatplane touchdown and low-graphics recovery.
- Draft stacked on #116; do not merge into main or the shared integration branch until visual QA.

## Visual screenshot follow-up: warm cloud light and correct twilight stars
In a real 19:00 New York Harbor WebGL2 screenshot, the sun is visible and reflects across the harbor, but stars were showing prematurely and clouds remained neutral grey. The updated shader gates the visible stars by solar altitude and adds weak warm forward lighting to the existing seven-sample cloud layer. No FFT import, cloud pass or extra draw call. Subsequent screenshots and hardware GPU frame timing remain required before considering this complete.

## Second screenshot-guided iteration — cloud silhouette and wave-band breakup
On the verified NYC Harbor screenshots the mid-distance water still showed nearly parallel cyan/black ribbons, and cloud tops had broad straight cutoffs. This follow-up changes only the **shading normals**: existing gust noise now varies long-wave slope contribution, the existing noise slope is mixed in only within a subpixel fade, and the current analytic wave height + floatplane pose are unchanged. Clouds shift spatial energy to the widest octave (0.66 / 0.25 / 0.09, three existing noise fetches), with a smooth density-aware vertical envelope inside the existing seven ray-march steps. Resulting photographs must be compared to the previous screenshot set, and runtime GPU timing remains an independent gate. The algorithm remains a visual approximation rather than physically resolved breaking waves or 3D FFT displacement.

## Third adjustment: avoid excessive continuous cloud shelf
The first larger 0.009-scale cloud screenshot was browser-valid but formed a broad, almost uniform ceiling over New York Harbor. This is not enough aesthetic improvement to claim AAA. Restored intermediate 0.011 spatial scale and reused the middle-octave noise to cut holes into dense cloud areas (still **exactly three noise samples**). The previous rounded vertical fade and the 7-step loop are untouched. Check the 19:00 and noon browser captures after this commit and do not equate merely nonblank WebGL frames with faithful cloud structure.

## Fourth screenshot-guided refinement — directional normals and cloud crowns
The intermediate cloud-breakup screenshot (`af23996`) passed actual WebGL2 1280×720 capture, but recognizable repeated harbor highlight stripes and nearly planar cloud top persisted. The next implementation perturbs **only Manhattan shading normal sample coordinates** with the pre-existing advected noise and its two finite derivatives, fading to zero when projected pixels are too large. It does not modify CPU floatplane ocean height, GLSL oceanHeight, scene geometry, displacement, or physics. The cloud volume now uses a density-based crown peak (0.54–0.90 of layer height) so thin cloud margins end lower than dense cloud centers, with 3 original density noise samples and 7 volume steps. Confirm actual new screenshots and tests before deciding the patch passes visual review; do not infer GPU speed from SwiftShader.
