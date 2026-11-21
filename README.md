# PATROL Flight Simulator

PATROL is a WebGL 2 flight simulator for the browser. Fly over Manhattan, Washington, DC, Las Vegas, the Alaska Fjords, Alder River Valley, or Copper Coast in a Viper jet, a UFO, or a jetpack. Select **? Random Map** for a surprise destination.

The Manhattan map includes a compressed Times Square district shaped by the diagonal of Broadway and the through lanes of Seventh Avenue. Walk signals, traffic lights, trees, street lamps, and numbered crossings line pedestrian plazas with illuminated storefronts, the TKTS red steps, and the ball atop One Times Square.

Manhattan is the default map. New York Harbor has rolling swell, sun glitter and moonlight, with calmer water in the sheltered channels and intermittent foam near shore. Open **Scenic Views → New York Harbor** for a low vantage point, and use **T** to switch between daylight, dusk, and night.

In Las Vegas, see the Bellagio's curved tower, fountains and lakeside promenade, the Venetian's canal and campanile, Caesars Palace's stone arcades, Wynn's illuminated entrance, and the Luxor pyramid. Las Vegas and Manhattan both have walking crowds, police patrols, and a curbside police stop. Explore the Sphere and ride along with the roller coaster or Ferris wheel using **Scenic Views**.

The expanded Washington, DC map now spans the federal core from the Pentagon and Tidal Basin through the National Mall to Capitol Hill and Union Station. It includes flight-scale interpretations of the White House, U.S. Capitol, Washington Monument, Lincoln Memorial, World War II Memorial, Jefferson Memorial, Smithsonian museums, federal office buildings, Kennedy Center, Union Station, the Pentagon, Potomac shoreline, 20 named roads, street signs, crosswalks, parks, lamps, trees, pedestrians, and traffic. Shared pedestrian and vehicle meshes, distance culling, and batched static geometry keep the larger district practical on mobile hardware. The terrain includes a water-filled Potomac, Washington Channel, and Tidal Basin. The Capitol dome, Jefferson Memorial rotunda, memorial columns, and Tidal Basin cherry trees are modeled with the bundled Three.js r180 geometry classes. [National Park Service map](https://www.nps.gov/nama/planyourvisit/maps.htm)

The Viper now has a clear framed canopy with a visible helmeted pilot, harness, visor, and oxygen mask. The former jetpack option is a gold-and-red Mark 42-inspired armored flyer rebuilt with tapered anatomical proportions, a faceted helmet and faceplate, layered chest and abdominal armor, shoulder bells, articulated gauntlets, knee and shin plates, armored boots, compact back thrusters, four repulsor exhausts, emissive eyes and arc reactor, twin palm lasers, assisted landing, collision recovery instead of destruction, and a dedicated JARVIS-style first-person HUD.

[Play PATROL on GitHub Pages](https://bhu103-data.github.io/patrol-flight-sim/)

## Chongqing Hotpot Pilot (new)

Choose **Chongqing · Hotpot Pilot** on the map selection screen, or open [the Chongqing level](https://bhu103-data.github.io/patrol-flight-sim/chongqing.html) directly. This is an additional Three.js 3D character-exploration level; existing aircraft maps and controls are unchanged. Explore a stylized Hongyadong, river crossings, hillside towers, elevated rail, cable cars, and a Chongqing hotpot shop. Walk with WASD, sprint with Shift, super-jump with Space, toggle flight with F, ascend with Space, descend with Ctrl, and press E near the restaurant for temporary spicy fire propulsion. Drag the view to turn the chase camera. This is an artistic compressed city, **not** a georeferenced 1:1 replica. The latest visual pass reuses existing **CC0 1K photographic PBR concrete/asphalt materials**, adds tiled roofs, riverside Hongyadong galleries and accurate **single-pylon Qiansimen cable-stayed bridge typology**, plus a round-proportioned pilot; no Google or other licensed city mesh is copied. The level loads Three.js r180 from a CDN and needs an internet connection.

[Chongqing technical notes and Petalwake credits](docs/CHONGQING_HOTPOT_PILOT.md)


## Alaska Fjords — surveyed Tracy Arm terrain

The Alaska map now uses a compact **USGS 3DEP public-domain bare-earth elevation grid** sampled around Tracy Arm / North Sawyer Glacier. The 256×256 local grid is roughly 30–31 m between samples, with real mountain and water-channel terrain from the source, compressed vertically to fit PATROL's flight ceiling. Game north is rotated 90° relative to geographic north to keep the original fictional harbor and spawn on the fjord. This **is not a 1:1 georeferenced replica**. Glacier crevasses, irregular floating ice, and multi-whorl coastal spruce/hemlock silhouettes accompany the new topography and slow auroral curtains. Near the aircraft, the glacier has subtle longitudinal ice flow veins, sparse dark fractures, layering, blue grazing-angle light and CC0 photo snow micrograin; far-away terrain stays on the simpler shader to limit GPU load. Real **CC0 photographic rock, snow, forest soil, and pine-needle ground** atlases with normal/roughness detail load only on Alaska in the high-quality renderer. Additional water-constrained ice floes drift slowly, and bounded fragments periodically drop at the glacier edge. These are visual additions, not a physics-based calving simulation. The original Alaska terrain loads automatically if the local DEM is missing; add `?alaskaTerrain=legacy` to the game URL to compare the original elevation (photographic materials remain available).

[USGS Alaska data source, format, build instructions, and limitations](docs/ALASKA_OPEN_SOURCE.md).

## Controls

- **Mouse**, **WASD**, or the **arrow keys** steer.
- **Space** changes the flight camera.
- **N** opens the map and landmark labels.
- **C** fires the fighter cannon or the armor's twin palm lasers.
- **G** toggles fighter landing gear or the armor's assisted landing mode; hold boost after landing to launch again.
- **T** opens the time, season, and weather controls.
- **H** opens Scenic Views in Manhattan, Las Vegas, and Washington, DC. In Washington, select a landmark or use **Start Auto Tour** to cycle through seven views.
- **Esc** closes the active panel or returns to the flight menu.

## Run locally

Serve the repository root with a static HTTP server, such as `python3 -m http.server 8000`. Open `http://localhost:8000` in a browser with WebGL 2 enabled. No build step is required.

The game opens with the full ocean, atmosphere, and post-processing effects. If WebGL is interrupted, use **Reload full graphics** to retry. If WebGL 2 cannot initialize, turn on graphics acceleration in a supported browser and restart it.

## Washington, DC materials

The DC map loads its material atlases in the background when a flight starts. They include photographic base color, tangent-space normal detail and roughness for five surfaces. Roads and paths use separate materials so the same photo does not cover the entire scene. [Poly Haven CC0 license](https://polyhaven.com/license)

- [White Sandstone Blocks 02](https://polyhaven.com/a/white_sandstone_blocks_02) for stone masonry
- [Asphalt 02](https://polyhaven.com/a/asphalt_02) for streets
- [Concrete Pavement](https://polyhaven.com/a/concrete_pavement) for sidewalks and paths
- [Leafy Grass](https://polyhaven.com/a/leafy_grass) for the National Mall lawns
- [Marble 01](https://polyhaven.com/a/marble_01) for the domes and columns

The world is built to fit the game's flight area. The Times Square layout references the Broadway pedestrian plazas and Father Duffy Square. [Times Square Alliance](https://www.timessquarenyc.org/business-community/planning-an-event)

## Chongqing research and permissions

Research reference: [Chongqing browser experience](https://lab.ytdeepsea.com/games/chongqing/) and its [credits page](https://lab.ytdeepsea.com/games/chongqing/credits.html), checked 2026-11-20. The credits identify Poly Haven assets as CC0, Blender Studio Human Base Meshes as CC0, selected Wikimedia references as CC BY/CC BY-SA, Hunyuan3D-2 under its Community License, and generated facade/train textures as CC BY-SA 4.0. This project reuses none of the reference site's code or downloaded media; the Chongqing scene is newly authored from public place concepts and original procedural geometry. See [CHONGQING_LICENSES.md](CHONGQING_LICENSES.md) for the provenance record.

## Central Park / 曼哈顿中央公园

Manhattan now includes a terrain-aware Central Park, oriented along the existing compact Manhattan street grid (game coordinates, not surveyed GIS). The 59th–110th Street green corridor contains individually meshed curved shorelines for The Pond, The Lake, Turtle Pond, Conservatory Water, the Jacqueline Kennedy Onassis Reservoir, and Harlem Meer; curved walk/loop drives, 65th/79th/86th/97th Street transverses, Sheep Meadow, Great Lawn, North Meadow, and the Conservatory Garden. Bethesda Terrace and Fountain, Bow Bridge, and Belvedere Castle have their own geometry; tree crowns are tapered organic clusters rather than billboard textures. The simulation carves shallow water basins into the NYC terrain and excludes ordinary street-grid asphalt from the park interior. Shore-adjacent pedestrian and vehicle paths now detour around the six lakes on stable dry sides; the compressed 79th/86th Street transverse routes avoid Turtle Pond and the Reservoir rather than submerging in park water. The park shows on the radar/minimap and adds named locations. The optional scene uses bounded density (165 low / 350 high, including Mall trees), a single city draw batch, and safely disposes that batch on map changes. Manhattan starts with a slightly sharper adaptive 3D framebuffer (84% desktop / 67% smaller screens, compared with the old 73% / 59%) to improve lake and skyline edges; it still reduces resolution automatically when frames run slowly, and all non-Manhattan maps retain their existing values. Trees are visual scenery, while major stone structures may have collision bounds. The relative layout references the [Central Park Conservancy's official map](https://www.centralparknyc.org/visit/maps) but is not an exact 1:1 reconstruction or licensed satellite imagery. Central Park additionally has original game-scale models of the **Zoo, Loeb Boathouse, Strawberry Fields radial paving, Gapstow Bridge, Conservatory Garden flowerbeds, lamps and benches**. During a Manhattan flight, press **P** or select **Central Park [P]** to open a Reservoir overview without teleporting the aircraft. The Scenic Views menu also offers eight park viewpoints (Bethesda Terrace, Bow Bridge, Belvedere Castle, Great Lawn, Zoo, Strawberry Fields and Boathouse). Select **Resume Flight** to return to the same aircraft. Park amenities share the existing WebGL geometry batch, with no new renderer.

## Universe Explorer / 从每张地图进入宇宙

Every PATROL map (Manhattan, Washington DC, Las Vegas, Alaska Fjords, Copper Coast, Alder River Valley, and the standalone Chongqing pilot) now offers **🚀 ORBIT / 宇宙 [U]**. Press **U** or click the orbit button. **Manhattan embeds the Cosmos renderer inside the existing flight page**, preserves the current aircraft in memory, and offers return with **U/Esc**; it automatically hands off at flight Y=180. The other flight maps still open the standalone `space.html` at the Y=100 ceiling, and Chongqing retains its separate Y=650 handoff. Use the navigation panel to visit Earth, Moon, Sun, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto, the solar system, or a procedurally modeled Milky Way. The Earth-orbit sky attempts to load NASA-derived panorama and the 42,000-star upstream catalog, with procedural fallback if either is unavailable. Drag to orbit, wheel or pinch to zoom, move with WASD, fly vertically with Q/E, and hold Shift for faster movement. Press U or use the return link to go back to the originating city.

This is a **scale transition**, not an expansion of the terrain boundary into physical astronomical coordinates. Solar sizes/orbits are compressed for playability; the galactic point cloud is artistic rather than a real stellar catalog. The city renderers, vehicle collisions, and original local maps remain separate. The optional cosmos uses Three.js r180 via CDN and remotely fetched planetary maps, so internet access is needed for full visuals. Architecture is adapted from [oxomkbk/earth-migration](https://github.com/oxomkbk/earth-migration) (MIT); planet texture credit: Solar System Scope (CC BY 4.0). Read [Cosmos credits and limitations](assets/cosmos/COSMOS_CREDITS.md).


### Recent Chongqing landmark improvements

The Chongqing map now has a separate [Raffles City / Liziba modeling module](assets/chongqing/landmarks.js) with the eight Chongqing Raffles towers, The Crystal horizontal glass skybridge, and a three-car moving Line 2 monorail passing through a 19-floor Liziba-inspired station. These landmarks have dedicated landing/collision bounds, minimap markers and exploration objectives. Buildings are hand-authored procedural models; their relative positions are compressed and **not claimed to match surveyed Chongqing coordinates**. Smoke and regression tests: `node --test tests/chongqing-landmarks.test.mjs` and `node --test tests/chongqing-spatial.test.mjs`.


### Chongqing photographic roof and timber detail

The latest update adds two optional **CC0 1K photographic material streams** for timber beams and ceramic roofs, plus **33 curved pitched roof meshes** with raised eave corners and timber lattice window frames. Their provider names are not shown in the game; asset URLs and license information remain in [CHONGQING_LICENSES.md](CHONGQING_LICENSES.md). A local procedural material fallback is preserved for offline or failed requests. These are real material photographs, **not** a copyrighted 3D city scan or a 1:1 imported Hongyadong building model.

Additional regression tests: `node --test tests/chongqing-detail.test.mjs` and `node --test tests/chongqing-visual.test.mjs`.


### More realistic Chongqing night streets

`assets/chongqing/streetlife.js` adds 10 moving cars (5 yellow Chongqing-style taxis), realistic road markings, curbs, 108 streetlights and nearby aimed vehicle headlights. Distant conical trees were replaced with varied broadleaf clusters and branches; the active area has a localized soft shadow system, which can be disabled with Low graphics. Texture license records remain in [CHONGQING_LICENSES.md](CHONGQING_LICENSES.md). No source-provider names are placed in the game UI. Further regression checks: `node --test tests/chongqing-streetlife.test.mjs` and `node --test tests/chongqing-vegetation.test.mjs`.


### Chongqing wet-street update

Wet asphalt now features 192 custom-shaped local puddles and 102 subtle light-reflection strips in two GPU-friendly batches. A pedestrian zebra crossing near the hotpot district has 2 operating traffic signals; westbound cars stop on red and continue on green. Low graphics mode hides extra wet-road layers. Both the effects and street furniture are locally authored, with no provider branding. Regressions: `node --test tests/chongqing-wetstreets.test.mjs`, `node --test tests/chongqing-streetlife.test.mjs`. These effects are approximations rather than actual screen-space / ray-traced urban reflections or a 1:1 georeferenced road.


### Chongqing ferry boarding and WebGL regression

The Chongqing scenic map now features three moving Jialing River ferries with detailed passenger decks, hulls and wakes. The player may land on a cruise deck and travel with it; ferry markers and a new exploration objective appear in the game. The old 300-unit climb restriction was corrected, leaving the intended 650-unit orbit entry and 725-unit safety limit. Day/Dusk/Night now also controls traffic headlights and artificial road reflection strips.

Testing: `node --test tests/chongqing-*.test.mjs`; optional real Chromium screenshots: [Chongqing workflow](.github/workflows/chongqing-visual.yml) and [browser smoke script](scripts/chongqing-browser-smoke.mjs). WebGL screenshots and frame rate remain **unverified until a real Actions/browser run completes**. Models are original artistic recreations, not scanned 1:1 architecture.


### New York / Chongqing road-and-building clearance

NYC generated building lots now reserve Manhattan's main street corridors; new street surfaces and crossings check the complete road/sidewalk envelope. Chongqing background towers reserve all six curved roads and two bridge approaches, with final road segments clipped after all landmark colliders are registered. Chongqing taxis, streetlights, road paint, zebra crossings and wet asphalt use the same no-building occupancy query.

Tests and limitations: [NYC & Chongqing road clearance](docs/NYC_CHONGQING_ROAD_CLEARANCE.md). Run `node --test tests/nyc-road-clearance.test.mjs tests/chongqing-road-clearance.test.mjs tests/chongqing-street-occupancy.test.mjs`. A GitHub Actions Chromium visual check is configured; real screenshots and FPS remain unverified until that check successfully runs.
