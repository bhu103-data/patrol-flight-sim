# PATROL water reflection — local GPU QA (2026-11-22)

This is local integration evidence, not PR acceptance.

## Compared source states

- Baseline: `6d50bfda4b2d3837e550751ede49b200b140bc72`
- Candidate: `9fcea6380f532133bab7b16e96fbc8d91143380f`
- Candidate production change: `reflDir.y = abs(reflDir.y)` → `max(reflDir.y, 0.002)` in `index.html`.

The local three-way integration with ferry state `de2059f9679fab218a85d0a717e2f34b5cf4e04f` completed without a textual conflict. The combined local tree loaded Manhattan at 1280×720, contained both the water clamp and ferry code, and emitted no page or console errors during the smoke run. `tests/tidewater-water-viewfix.test.mjs` passed, but it only verifies source text.

## Fixed-camera A/B

The test harness held the water shader time, camera altitude, exposure inputs, cloud (`0.16`), twilight (`0`), viewport and resolution constant. It captured the same harbor camera at solar elevations 1°, 4° and 15°, facing toward and away from the sun.

- Renderer: `ANGLE (Intel, Intel(R) Iris(R) Xe Graphics, Direct3D11)`
- Canvas/FBO: 1280×720
- 175 rAF samples per case; both states averaged 16.70 ms median and about 16.72–16.73 ms P95.
- Browser/page errors: 0 in all 12 cases.
- Local artifacts: `artifacts/water-qa-20261122/`

The clamp changes the image but does **not** pass the visual defect criterion. The large curved horizon/globe-like band remains visible in both states. In the lower-water ROI, candidate-versus-baseline mean absolute pixel difference was 0.72–1.02 levels for the sun-visible direction and 5.90–7.04 levels for the opposite direction; therefore the patch does not demonstrate removal of the reported globe-like artifact and affects the opposite direction more strongly in this fixed-camera setup.

## GPU boundary

Windows reports both adapters healthy:

- Intel Iris Xe, driver `32.0.101.7085`
- NVIDIA GeForce MX450, driver `32.0.15.9595`

The browser actually selected Intel Iris Xe D3D11. This is valid local hardware-GPU evidence, but it is **not** MX450 evidence. Do not claim NVIDIA validation until the browser's `UNMASKED_RENDERER_WEBGL` reports the NVIDIA adapter.

## Decision and next test

Do not integrate the clamp as the finished fix. First classify the persistent curved band by temporarily rendering diagnostic colors for (1) sky/atmosphere, (2) reflected sky, (3) terrain/shore fog and (4) any space/sphere object, then repeat the same six fixed-camera cases. Only integrate a cause-level fix when the band disappears without breaking ferry rendering, seaplane contact, map switching or non-NYC maps.
