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
