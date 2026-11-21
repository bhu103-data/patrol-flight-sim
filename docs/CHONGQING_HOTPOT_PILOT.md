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

The camera-visible Chongqing corridor now has eleven tiered Hongyadong-inspired floors with pitched rooflets, cantilever balconies, window bays, lanterns, timber supports, parapets and a stepped approach; the red Qiansimen-inspired truss crossing was relocated beside this landmark in the **fictional compressed layout**. Distinct skyline crowns, roof mechanical rooms, blue/amber facade accent strips, street shops with 14 unique signs, terrace roads, stone stairs, trees with layered crowns, lighted river cruises and water glints improve the scene near the player.

Rendering stays compact: the detailed corridor uses pooled Three.js InstancedMesh geometry, three 256px procedural roof/stone/wood textures, a handful of strategically positioned point lights, and no downloaded third-party building meshes or photos. The player includes goggles, helmet, animated running limbs, a chili flightpack and flame light. Camera clipping against the original tower collider list is reduced, and the super-jump now responds to each individual Space press rather than auto-repeating while held.

**Testing scope:** JavaScript modules parsed and the detail builder ran through a mocked geometry/scene test with 300 sample building colliders, producing 4,164 batched detail primitives without overflowing pools. This is a **structural smoke test**, not a real WebGL/browser render or an FPS benchmark. Open the live page and check graphics, controls, landmarks and frame rate in your browser before treating this as a production release. Visual geography, dimensions and textures are artistic approximations rather than surveyed or photographic reconstruction.
