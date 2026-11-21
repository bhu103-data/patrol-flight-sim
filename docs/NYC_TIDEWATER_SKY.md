# PATROL NYC — Tidewater-inspired sun and atmosphere pass

## Reference and licensing

- Reference project: https://github.com/zzzhengqi/tidewater
- Live reference: https://zzzhengqi.github.io/tidewater/
- Upstream declares the repository code under **MIT** (copyright 2026 DRG Software Solutions LLC). See its `LICENSE`, `src/sky/Atmosphere.js`, `src/sky/Sky.js` and `src/sky/Clouds.js`.
- This PATROL change is a **conceptual, original GLSL implementation**. It copies no Tidewater source, LUT, textures, cloud volume, assets, or scene. No third-party assets are added.

## What changed

Scope is Manhattan's native WebGL2 sky and its reflected sky contribution to the ocean. Other maps keep the previous path.

- A Rayleigh-inspired blue zenith / warm low-sun horizon gradient, keyed from the same physical sun direction and time-of-day uniforms already used by the world.
- A compact Henyey–Greenstein-like forward Mie aureole, with color shifting from warm low sun to neutral high sun and attenuation from existing cloud/fog openness.
- A solar disk with an angular radius of **0.00538 radians** (~0.308 degrees), instead of the previous oversized artistic disk. Its edge is antialiased from the actual pixel angular footprint so FOV/resolution changes do not produce a hard or unstable edge.
- A restrained twilight aerial-haze tint using the same sun elevation and twilight state.
- Both the camera sky and water-reflected sky call the same `getSky(direction, pixelAngle)`, keeping sun color and disk treatment consistent.

## Deliberately not ported

Tidewater's full Hillaire atmosphere uses precomputed transmittance / multiple-scattering / sky-view LUTs; its clouds use a temporally accumulated 3D volumetric ray marcher and separate reflection/shadow representations. PATROL currently uses native WebGL2 GLSL, not Three.js WebGPU/TSL. This pass does **not** pretend to implement that full system: no new LUT, render target, cloud raymarch, texture, FFT, or extra noise lookup is introduced. Existing cloud geometry/density and ocean wave physics remain unchanged.

## Reversibility and validation

- Compile-time visual gate: `NYC_TIDEWATER_SKY`; the new path is additionally gated by `uManhattan`. Disabling the constant restores the previous NYC sky and haze.
- `tests/nyc-tidewater-sky-atmosphere.test.mjs` checks the map gate, sun angular size/AA, Mie attenuation, reflection-path consistency, and that ocean/flight physics are untouched.
- The existing fixed-camera C185 water A/B harness adds `PATROL_COMPARE_MODE=sky-atmosphere`. It sets **07:00, autumn, clear weather**, holds the aircraft/camera and wave time fixed, and compares old vs new sky with the same reflected water. The JSON records sun direction and atmosphere values and rejects a mismatched pair.
- CI uses Chromium SwiftShader for deterministic WebGL2 compilation and screenshots. RAF pacing is not a GPU timestamp; it does **not** certify native Windows GPU FPS or 60 fps.
- Review the before/after artifact for sun visibility, halo clipping, skyline haze, and reflected sun. Keep this draft until central QA also checks noon, dusk, midnight, overcast, Alaska/DC, and a native GPU run.
