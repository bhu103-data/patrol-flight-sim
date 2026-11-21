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

The Alaska map now uses a compact **USGS 3DEP public-domain bare-earth elevation grid** sampled around Tracy Arm / North Sawyer Glacier. The 256×256 local grid is roughly 30–31 m between samples, with real mountain and water-channel terrain from the source, compressed vertically to fit PATROL's flight ceiling. Game north is rotated 90° relative to geographic north to keep the original fictional harbor and spawn on the fjord. This **is not a 1:1 georeferenced replica**. Glacier crevasses, irregular floating ice, coastal spruce silhouettes, and the existing slow auroral curtains accompany the new topography. The original Alaska terrain loads automatically if the local data is missing; add `?alaskaTerrain=legacy` to the game URL to compare the original version.

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

## Universe Explorer / 从每张地图进入宇宙

Every PATROL map (Manhattan, Washington DC, Las Vegas, Alaska Fjords, Copper Coast, Alder River Valley, and the standalone Chongqing pilot) now offers **🚀 ORBIT / 宇宙 [U]**. Press **U** or click the button to enter a dedicated 3D space scene. The standard flight maps also hand off while climbing at their Y=100 ceiling; the Chongqing pilot hands off after climbing above Y=650. Use the navigation panel to visit Earth, Moon, Sun, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto, the solar system, or a procedurally modeled Milky Way. The Earth-orbit sky attempts to load NASA-derived panorama and the 42,000-star upstream catalog, with procedural fallback if either is unavailable. Drag to orbit, wheel or pinch to zoom, move with WASD, fly vertically with Q/E, and hold Shift for faster movement. Press U or use the return link to go back to the originating city.

This is a **scale transition**, not an expansion of the terrain boundary into physical astronomical coordinates. Solar sizes/orbits are compressed for playability; the galactic point cloud is artistic rather than a real stellar catalog. The city renderers, vehicle collisions, and original local maps remain separate. The optional cosmos uses Three.js r180 via CDN and remotely fetched planetary maps, so internet access is needed for full visuals. Architecture is adapted from [oxomkbk/earth-migration](https://github.com/oxomkbk/earth-migration) (MIT); planet texture credit: Solar System Scope (CC BY 4.0). Read [Cosmos credits and limitations](assets/cosmos/COSMOS_CREDITS.md).


### Recent Chongqing landmark improvements

The Chongqing map now has a separate [Raffles City / Liziba modeling module](assets/chongqing/landmarks.js) with the eight Chongqing Raffles towers, The Crystal horizontal glass skybridge, and a three-car moving Line 2 monorail passing through a 19-floor Liziba-inspired station. These landmarks have dedicated landing/collision bounds, minimap markers and exploration objectives. Buildings are hand-authored procedural models; their relative positions are compressed and **not claimed to match surveyed Chongqing coordinates**. Smoke and regression tests: `node --test tests/chongqing-landmarks.test.mjs` and `node --test tests/chongqing-spatial.test.mjs`.


### Chongqing photographic roof and timber detail

The latest update adds two optional **CC0 1K photographic material streams** for timber beams and ceramic roofs, plus **33 curved pitched roof meshes** with raised eave corners and timber lattice window frames. Their provider names are not shown in the game; asset URLs and license information remain in [CHONGQING_LICENSES.md](CHONGQING_LICENSES.md). A local procedural material fallback is preserved for offline or failed requests. These are real material photographs, **not** a copyrighted 3D city scan or a 1:1 imported Hongyadong building model.

Additional regression tests: `node --test tests/chongqing-detail.test.mjs` and `node --test tests/chongqing-visual.test.mjs`.
