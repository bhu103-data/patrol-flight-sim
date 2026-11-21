# Chongqing Hotpot Pilot: implementation and credits

This additive mini-level is part of PATROL. The existing Manhattan, DC, Las Vegas, Alaska, Alder Valley and Copper Coast engines and controls remain unchanged.

## Launch and controls

Open [Chongqing Hotpot Pilot](../chongqing.html) or select **Chongqing · Hotpot Pilot** in PATROL's map menu.

- **WASD / arrow keys**: move relative to the orbit camera; drag to rotate the camera
- **Shift**: sprint on foot, boost in flight
- **Space**: high jump on foot, ascend in flight
- **Ctrl**: descend in flight
- **F**: toggle free flight
- **E**: eat hotpot near the restaurant, enabling a temporary flaming propulsion trail

Three.js r180 loads from jsDelivr at runtime. Internet access is needed to load the JavaScript module; this is not an offline build. The level uses a procedural, bounded 3D city and instanced towers/windows to avoid a large asset download. Water uses a simple wave-and-Fresnel shader. The Chongqing architecture is **an artistic interpretation**, not 1:1 surveyed topography or fully accurate building geometry.

## Third-party inspiration

- **Petalwake** by Jacob Miller (@pwnies): https://github.com/jjcm/petalwake
- Original license: MIT, Copyright (c) 2026 Jacob Miller, https://github.com/jjcm/petalwake/blob/main/LICENSE
- Inspiration: arcade low-level flight, smooth following camera with speed-based pullback, and particle wake aesthetics.
- The Chongqing level's code is a separate implementation and does **not** directly copy Petalwake source files or ship its textures/3D assets.
- Three.js (MIT): https://github.com/mrdoob/three.js/blob/master/LICENSE

This prototype is not a substitute for physical flight simulation and does not use Google photorealistic 3D tiles or other proprietary city mesh datasets.

## Detailed hero-zone pass — 20 November 2026

The camera-visible Chongqing corridor now has eleven tiered Hongyadong-inspired floors with pitched rooflets, cantilever balconies, window bays, lanterns, timber supports, parapets and a stepped approach; the Qiansimen-inspired single-pylon cable-stayed crossing was relocated beside this landmark in the **fictional compressed layout**. Distinct skyline crowns, roof mechanical rooms, blue/amber facade accent strips, street shops with 14 unique signs, terrace roads, stone stairs, trees with layered crowns, lighted river cruises and water glints improve the scene near the player.

Rendering stays compact: the detailed corridor uses pooled Three.js InstancedMesh geometry, photographic CC0 1K concrete/asphalt PBR surfaces and lightweight procedural ceramic roof/stone/glass textures, a handful of strategically positioned point lights, and no downloaded third-party building meshes or photographic city images. The player includes goggles, helmet, animated running limbs, a chili flightpack and flame light. Camera clipping against the original tower collider list is reduced, and the super-jump now responds to each individual Space press rather than auto-repeating while held.

**Testing scope:** JavaScript modules parsed and the detail builder ran through a mocked geometry/scene test with 300 sample building colliders, producing 4,164 batched detail primitives without overflowing pools. This is a **structural smoke test**, not a real WebGL/browser render or an FPS benchmark. Open the live page and check graphics, controls, landmarks and frame rate in your browser before treating this as a production release. Visual geography, dimensions and textures are artistic approximations rather than surveyed or photographic reconstruction.

## Performance and controls upgrade — 20 November 2026

- **Reduced render overhead:** eliminated the older duplicated Hongyadong object hierarchy and now renders the stacked building cores with the instanced detailed facade. Basic boxes share one unit-cube geometry instead of allocating separate GPU meshes for each shape.
- **Indexed collisions:** `assets/chongqing/spatial.js` bins buildings into 72-unit cells. Its conservative foot/head bounds support collision sliding, different-height building volumes, descending onto roofs, and a water-level landing floor. This replaces the full-building scans made by the chase-camera rays.
- **Adaptive graphics:** Auto mode targets comfortable responsiveness by adjusting device pixel ratio every ~2.7 seconds using measured frame durations; the switch below the mini-map cycles Auto → High → Battery Saver. Low mode hides ornamental glints, dust and extra tree crowns, preserving the main scene. Press **P** for FPS, draw calls, triangle count and current pixel ratio; an optional `?quality=low`, `?quality=auto`, or `?quality=high` query parameter selects the initial mode.
- **Input improvements:** the mobile version has a left virtual movement joystick, separate hotpot/fly/boost/ascend/descend buttons, touch-camera orbit and pixel-density-conscious viewport sizing.
- **Reduced per-frame garbage:** camera ray tests reuse vectors; fire particles reuse pooled vectors and stop drawing when inactive. Perspective projection updates are avoided when FOV changes are too small to matter. The page handles lost WebGL contexts and reloads the scene on restoration.
- **Regression tests:** run `node --test tests/chongqing-spatial.test.mjs` to exercise side collisions, height limits, cell boundaries, stacked roofs, safe landings and empty-city behavior without an npm install.

Validation so far: source parse checks and source-linked structural smoke tests for the procedurally generated detail layer; six collision test cases passed through the same test logic in a JavaScript sandbox. No actual desktop/mobile GPU FPS measurement has been performed, so frame-rate improvement is a design intent, **not a verified benchmark**. The GitHub Pages address is the configured preview URL, but its public deployment was not confirmed from this session.

## Realistic material and engineering correction — 20 November 2026

**Key correction:** the official Chongqing municipal description identifies Qiansimen Jialing River Bridge as **single-tower, single-cable-plane cable-stayed**; its main bridge is 720 meters long in the real world. The old inaccurate red arch was removed. The in-game crossing now has one pale tower, a central fan of suspension cables and an illuminated steel lattice beneath the deck. Source: [Chongqing Municipal Urban Management Bureau](https://cgj.cq.gov.cn/zwgk_173/zfxxgkml/rdjyhzxta/202504/t20250429_14569421.html). The game-space deck remains compressed for performance and gameplay.

The material pipeline now **reuses six actual CC0 1K photographic PBR maps already included in PATROL**: Poly Haven concrete and asphalt color/normal/ARM textures in `assets/nyc/` (see [provenance](../CHONGQING_LICENSES.md)). `assets/chongqing/pbr.js` supplements them with original 512px weathered stone, ridged ceramic roof tiles, and reflective window atlases; realistic roughness/normal/clearcoat shaders replace several flat colors. Road and terrain geometry now provide explicit UVs. Tenanted tower facades have floor slabs and mullions, and the Hongyadong-inspired building has a river-facing tiered waterfront gallery.

For the player's close view, the former box head, chest, arms and legs were replaced with rounded, human-proportioned procedural geometry, flight goggles, neck collar, jacket, gloves, boots, small jet housing and articulated limb pivots. The river uses a subdued nighttime Fresnel response and animated warm reflection ribbons. Ferry hulls have curved bow profiles and illuminated passenger windows. Floating guide signs at the bridge and monument were removed.

For surface continuity the large terrain mesh increased to **208×148 cells** and hillside terraces use a smoothed transition. Urban haze obscures most decorative stars. The game keeps the previous performance controls (Auto/High/Battery Saver, FPS HUD), collision index and original PATROL maps.

**Validation and limitation:** module syntax checks passed for `chongqing.js`, `details.js`, `pbr.js` and `spatial.js`. A non-graphics mock exercised both the photographic PBR path loader and the instanced detail builder: six local texture paths, 14 storefront signs, 31 new scene colliders and 9,449 instanced detail primitives in about 20 render groups, without buffer overflow. This is not an actual WebGL screenshot test or measured frame-rate result. The public GitHub Pages endpoint could not be verified from this environment.

**Accuracy:** the rebuild is designed to look substantially less cartoon-like, but remains a custom compressed scenic model, **not yet an exact photographic reconstruction or georeferenced digital twin**. Achieving street-level 1:1 would require actual surveyed geometry and legitimately licensed high-resolution facades, which this commit does not include.
