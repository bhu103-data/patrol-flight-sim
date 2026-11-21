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
