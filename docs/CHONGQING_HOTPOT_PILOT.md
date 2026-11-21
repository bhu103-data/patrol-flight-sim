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


## Recognizable modern landmark pass — 20 November 2026

This pass adds **Raffles City Chongqing / Chaotianmen** and the **Liziba Line 2 through-building monorail** as modeled 3D landmarks with real architectural proportions rather than random rectangular towers.

### Raffles City and The Crystal

The project's architect [Safdie Architects](https://www.safdiearchitects.com/projects/raffles-city-chongqing) describes eight sail-inspired towers: six southern towers of about 250 m and two northern towers of about 350 m. The project's operator [CapitaLand](https://www.capitaland.com/en/about-capitaland/newsroom/news-releases/international/2020/jun/CapitaLand-opens-250-metre-high-glass-bottom-Exploration-Deck-at-RCCQ.html) describes The Crystal as a 300 m-long, 32.5 m-wide, 26.5 m-high horizontal skybridge over four 250 m towers.

`assets/chongqing/landmarks.js` creates eight original curved/chamfered facade volumes, story mullions, a commercial podium, a 300×32.5×26.5 world-unit elliptical glass tube, structural ribs, mechanical roof detailing and link arms. Tower heights are approximately 250 and 350 game units. A physical collision volume protects the podium and Crystal's landable rooftop. Adjacent decorative/background towers are excluded to avoid occupying the landmark footprint.

### Liziba Station

The [Chongqing municipal government](https://english.cq.gov.cn/specials/explore/PhotoPerfectSpots/202608/t20260810_15912642.html) describes Liziba Station on Line 2 as a straddle-type monorail station integrated into a residential/commercial building. An [architecture/history description](https://www.ichongqing.info/2022/01/06/which-came-first-liziba-station-or-its-residential-building/) describes its distinctive train-through-building design.

In the game it is a 19-storey station block with a real through-opening around the monorail height, separated lower/upper/side colliders, windows and a station sign. A three-car animated rail vehicle follows the curved elevated guideway. The prior wide metal slab rail and stationary block cars were removed in favor of a concrete straddle-monorail guidebeam with piers. Both landmarks are in the mini-map and discoverable through their exploration tasks.

### Validation and scope

Run `node --test tests/chongqing-landmarks.test.mjs` and `node --test tests/chongqing-spatial.test.mjs`. The landmark test covers the eight towers, Crystal length and collider, the physically open Liziba tunnel, train motion and GPU instance capacity; five landmark tests passed in the isolated JavaScript mock runner. No GPU rendering test, measured FPS or public Pages deployment verification was available. The city layout remains a compressed artistic arrangement — **not** surveyed 1:1 coordinates, photogrammetry or an exact topology of Chongqing.

**Scenic navigation:** press **1** for the Hongyadong riverfront, **2** for Raffles City/The Crystal, **3** for Liziba Station, and **4** to return to the hotpot start. Press **H** to hide the HUD for a cinematic view and **H** again to restore it. These optional viewpoint shortcuts reposition the avatar without editing or restarting the map. The `Battery Saver` quality setting hides select detailed facade bands and lights but retains all key landmarks and the moving monorail.


## Visual-fidelity pass: cliff connection, curtain walls and urban haze — November 2026

This pass addresses three specifically visible sources of the earlier low-poly/cartoon appearance:

1. **Facades:** `pbr.js` adds an original 768px physically shaded curtain-wall atlas. Lit and unlit office interiors, floor slabs, metal window mullions, reflection streaks and ceiling-scale details appear at real floor spacing. All eight Raffles sails now sample it using UV units derived from approximately **7.5 game units per office floor**, rather than stretching one colored glass patch across a 350-unit tower. Ordinary office windows now use distinct physical glass-pane materials rather than recursively repeating a complete window atlas inside every small pane.
2. **City structure and night sky:** The previous scattered background tower coordinates were replaced by deterministic blocks aligned with the two riverbank terraces, reserving landmark footprints and roads. `atmosphere.js` adds a texture-free camera-following sky dome with humid horizon glow and restrained cloud haze, preserving the night scene without cartoon stars or external assets.
3. **Hongyadong anchored to real terrain:** the locally sculpted rear cliff now connects lower riverfront levels to the upper-city road, with stone retaining terraces, river-level masonry arches, two elevated pedestrian decks and a raised street with railings. The connecting decks contribute explicit landing/collision surfaces to the existing spatial index, so they are playable, not empty decoration. The hillside now uses a purpose-authored shale/grit/moss material instead of applying photographic building-concrete wallpaper to natural slopes.

**Material provenance:** The six pre-existing Poly Haven CC0 1K photographs still come from `assets/nyc/`; added curtain-wall, rocky hillside and sky materials are original procedural resources generated at runtime. See [CHONGQING_LICENSES.md](../CHONGQING_LICENSES.md).

**Regression checks:** a mocked Three.js scene successfully instantiated the new facade, terrain and sky material pipeline without overflow; verified six local photograph paths, eight Raffles towers, three-car Liziba train and approximately 10k batched details (count varies with the exact sample obstacle distribution). `tests/chongqing-visual.test.mjs` covers the materials and atmosphere interface; the existing `tests/chongqing-landmarks.test.mjs` and `tests/chongqing-spatial.test.mjs` cover landmark geometry and collisions. This is structural test coverage, **not a real GPU render, authoritative 1:1 georeference or FPS guarantee**.


**Hotpot storefront correction:** The restaurant now uses the adjacent uphill doorway grade as its floor reference. Exposed lower-side foundation piers and a local pavement platform connect it to the steep road; the `E` interaction checks both the actual doorway distance and vertical position so the player cannot eat through the building from a rooftop or high above it. The start remains near the hotpot shop.

**Final integrity check for this pass:** all six Chongqing JavaScript modules parsed successfully; 11 existing landmark/spatial regression cases passed in the same JavaScript mock test harness, and 10 visual-structure assertions passed for local CC0 texture paths, glass and natural hillside materials, sky camera-follow, elevated-deck colliders and Raffles bindings. The three additional tests in `tests/chongqing-visual.test.mjs` are checked into GitHub for direct `node --test` execution. As before, there has not been a full real GPU screenshot/FPS test or a confirmed public GitHub Pages deployment from this environment.


## Direct CC0 texture and actual curved roof upgrade — 20 November 2026

The most visible Hongyadong foreground wood, railings and carved lattice bars now use Poly Haven **CC0 1K photographic wood** loaded directly from its verified CDN. The pitched roof material uses a **CC0 1K photographic clay tile** image. The game does not display third-party asset names on its HUD, buildings or shops. See the source ledger in [CHONGQING_LICENSES.md](../CHONGQING_LICENSES.md); CC0 does not require a visible attribution notice.

The traditional roof geometry was rebuilt: each of the 11 floor levels has 3 *real curved pitched roof meshes* with raised eave corners, modeled UVs and a ridge line. All 33 roof modules are rendered in one InstancedMesh rather than dozens of angled cube slabs. Both landward and riverside windows now have real-depth timber grid frames, batched into one more InstancedMesh with the full lattice layer hidden in Low graphics mode.

Performance/robustness: the default local material atlas stays present until the optional CC0 photo finishes loading; a failed HTTPS request leaves the local fallback intact. This adds **two optional remote image requests**, so older statements that Chongqing uses only six bundled material images describe the earlier version, not this one. A new regression suite `tests/chongqing-detail.test.mjs` validates 33 curved roof instances, actual surface curvature, window lattice visibility and instance capacity; three checks passed in the isolated JavaScript runner.

These changes use licensed real photographic *textures* and original detailed *geometry*, not a georeferenced high-poly scan of actual Chongqing buildings. Real browser visual inspection and a frame-rate benchmark remain outstanding.


## Chongqing city streets, organic trees and local shadows — 20 November 2026

The latest hero corridor now has a self-contained `assets/chongqing/streetlife.js` module that adds **10 animated cars**, including **5 yellow urban taxis** with a black-and-white check belt and roof lamps. Cars use a custom curved/chamfered six-meter sedan shell, translucent tinted windows, physically rounded wheels, metal hubs, headlights and tail lamps. Their speed follows the riverbank/terrace streets, and a pilot at street level cannot walk directly through nearby cars.

The city road layer adds **312 centerline stripe instances**, **312 curb sections** and **108 stylized street lamps** as a small number of draw batches. The nearest passing car may receive two dynamically aimed short-range SpotLights; headlights are disabled for distant/high-altitude pilots and in Battery Saver mode. The original road network stays unchanged.

**Source for the city taxi paint scheme:** Chongqing Municipal Transportation Commission's legal guidance ([2024 explanatory text, section on taxi livery](https://jtj.cq.gov.cn/zwgk_240/zfxxgkml/zcjd/wzjd/202405/P020240511544854567390.pdf)) identifies lemon-yellow central Chongqing taxi bodies and a black/white checker waistline. Our vehicles are newly authored geometry; no automobile manufacturer's protected logo or third-party car mesh was imported. The original provider names of texture source assets are not rendered in the game HUD.

Old repeated conical trees have been replaced by broadleaf-like ellipsoid/icosahedral crowns, variably sized foliage clusters, branches and trunks, all in three instanced render groups. Distribution avoids major roads, landmark visibility and the hotpot starting area.

Lighting is upgraded to a player-following **single 1024² soft directional shadow map** with a roughly 290-unit-wide local shadow area. The pilot, near-field roofs, tower silhouettes and cars cast shadows; the existing ground, stone, bridges and road meshes receive selected shadows. Only **High** graphics enables background tree crown shadow casting. **Battery Saver** disables the directional shadow pass and some ornamental traffic detail, to protect weak GPUs.

Run `node --test tests/chongqing-streetlife.test.mjs` and `node --test tests/chongqing-vegetation.test.mjs` for the new tests, in addition to the previous geometry, interaction and PBR tests. The corresponding mock-JavaScript checks passed: five traffic/batching checks and four tree/shadow-budget checks. **Real browser graphics, authoritative 1:1 geographic correspondence, and actual FPS remain unverified**, so this is still a compact artistic simulation, not a photogrammetric digital twin.


## Damp asphalt and operational crossing — 20 November 2026

A new no-download procedural module, `assets/chongqing/wetstreets.js`, adds **192 irregular wet-asphalt patches** and **102 faint roadside light reflection strips**. The patches share one slightly glossy physically based material; soft amber strips share one small locally generated alpha map. These **two batched meshes** follow the curved road centerlines and approximate road elevation instead of floating on a flat plane. This is low-cost artistic specular light, **not** real ray-traced reflections or a rainy weather simulation. In Battery Saver mode both optional layers are hidden.

`assets/chongqing/streetlife.js` now also includes a **10-stripe pedestrian crossing** on the upper riverside road near the hotpot entrance and **two timed traffic signal heads**, with alternating red/green lens visibility. Westbound cars in that lane actually stop short of the crossing on red and resume during the next green interval; signal timing is not merely cosmetic. The crossing, lamps and posts use existing box instancing and are not branded or copied from protected game artwork.

Safety/performance: the new road effect uses only two draw groups, a lightweight generated 64×128 texture and no additional network requests. The traffic signal uses a deterministic 36-second cycle (24 seconds green, 12 seconds red). Vehicle/state snapshots are available only when explicitly requested for tests, not allocated per animation frame.

Tests: `node --test tests/chongqing-wetstreets.test.mjs` checks geometry indices, UVs, draw groups, material values and low-quality mode; `node --test tests/chongqing-streetlife.test.mjs` includes a 140-second traffic simulation confirming red-light stopping and subsequent green-light release. The wet road mock generated 192 puddles + 102 reflected lamp strips with valid indices; 7 traffic test cases passed. These are JavaScript-level tests; no browser-based WebGL image comparison or FPS benchmark has been performed.

**Accuracy note:** This crossing is a fictional local gameplay improvement in a compressed Chongqing reconstruction. Do not mistake it for a surveyed crossing location, a genuine street-level photo, or a 1:1 asset replacement.
