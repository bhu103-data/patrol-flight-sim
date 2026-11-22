# PATROL NYC — Tidewater-inspired sun and atmosphere pass

## Reference and licensing

- Reference project: https://github.com/zzzhengqi/tidewater
- Live reference: https://zzzhengqi.github.io/tidewater/
- Upstream declares repository code under **MIT** (copyright 2026 DRG Software Solutions LLC). Reviewed `LICENSE`, `src/sky/Atmosphere.js`, `src/sky/Sky.js` and `src/sky/Clouds.js`.
- This PATROL change is an **original native GLSL implementation informed by the published rendering concepts**. No Tidewater source code, LUTs, textures, cloud volumes, audio, meshes, fonts or scene assets are copied.

## What changed

Scope is Manhattan's native WebGL2 sky and the reflected-sky contribution to the ocean. The existing water-detail work in stacked PR #126 remains the parent; this PR does not replace it. Other maps keep the previous sky path.

- Rayleigh-inspired blue zenith / warm low-sun horizon gradient, keyed from PATROL's existing sun direction and time-of-day uniforms.
- A compact Henyey–Greenstein-like forward Mie aureole, shifting from warm low sun to neutral high sun and attenuated by the existing cloud/fog openness.
- A solar disk with angular radius **0.00538 radians** (~0.308 degrees), instead of the previous oversized artistic disk. Its edge is antialiased from the current pixel angular footprint to remain stable across FOV/resolution.
- A restrained twilight aerial-haze tint using the same sun elevation and twilight state.
- The camera sky and water-reflected sky both call `getSky(direction, pixelAngle)`, so sun color and disk treatment remain consistent in the view and ocean reflection.

## Deliberately not ported

Tidewater's full Hillaire atmosphere uses precomputed transmittance / multiple-scattering / sky-view LUTs; its clouds use a temporally accumulated 3D volumetric ray marcher with separate reflection/shadow representations. PATROL currently uses native WebGL2 GLSL, not Three.js WebGPU/TSL. This pass does **not** claim to implement that full system: no new LUT, render target, cloud raymarch, texture, FFT, loop, or extra noise lookup is introduced. Existing cloud density and ocean wave physics remain unchanged.

## Reversibility and validation

- Compile-time visual gate: `NYC_TIDEWATER_SKY`; the new path is additionally gated by `uManhattan`. Disabling the constant restores the previous NYC sky and haze.
- `tests/nyc-tidewater-sky-atmosphere.test.mjs` checks the map gate, sun angular size/AA, Mie attenuation, reflected-sky consistency, and that ocean/flight physics remain untouched.
- The existing fixed-camera C185 water A/B harness adds `PATROL_COMPARE_MODE=sky-atmosphere`. It pins **07:00, autumn, clear weather**, aims the fixed camera along the actual sun direction, holds aircraft and wave time fixed, and compares old vs new sky with the same reflected water. The JSON records and compares sun direction, atmosphere values and weather.
- CI uses Chromium SwiftShader for deterministic WebGL2 compilation and screenshots. RAF pacing is not a GPU timestamp; it does **not** certify native Windows GPU FPS or 60 fps.
- Review the before/after artifact for sun visibility, halo clipping, skyline haze, reflected sun and water color. Keep this draft until central QA also checks noon, dusk, midnight, overcast, Alaska/DC, and a native GPU run.
