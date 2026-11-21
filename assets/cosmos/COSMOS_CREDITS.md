# PATROL Cosmos: source and asset attribution

The optional Universe Explorer is reached from any PATROL map via the U key, the orbit button, or (when supported by a level) climbing to its orbital handoff altitude. It deliberately uses a separate Three.js scene so the existing city shaders, collisions, building assets, and vehicles do not need to be enlarged to astronomical coordinates.

## Software reference

**The Earth Migration Project** by 玛卡巴卡, https://github.com/oxomkbk/earth-migration

Copyright (c) 2026 玛卡巴卡. MIT License. See the [upstream MIT license](https://github.com/oxomkbk/earth-migration/blob/main/LICENSE). The space scene adapts design ideas from the project's js/beyond/solar.js and js/beyond/galaxy.js: separate world scales, stylized/compressed orbital radii, a four-arm barred Milky Way, and a 15-degree logarithmic spiral. This is a **new, lightweight adapter**, not a vendor copy of the upstream full simulation, star catalogue, HDR compositor, or complete assets. The original upstream software remains available under MIT terms.

The use of modified software is permitted under MIT, including keeping the original copyright and permission notice in substantial copies. The repository and this credits file should remain distributed with this attribution.

## Planet / sky image assets

The optional textures and star-field resources are loaded at runtime from the upstream repository's assets/planets/ and assets/sky/ directories (not copied into PATROL's Git history). Upstream credits list the planetary images as **Solar System Scope**, licensed **CC BY 4.0**. Source: https://www.solarsystemscope.com/textures/ — license https://creativecommons.org/licenses/by/4.0/.

Images used as available: Sun, Mercury, Venus, Earth day, Earth clouds, Moon, Mars, Jupiter, Saturn, Uranus, Neptune, and Pluto. The Earth's optional city-light layer uses the NASA-derived upstream earth/earth_lights_2048.png and is shaded only on its night hemisphere. Render geometry, stars, markers, nebula-like colors, orbit rings, and ship proxies in PATROL are newly authored. If remote texture loading fails, colored bodies remain visible; **the universe view requires the Three.js CDN and an internet connection**.

The artistic solar system intentionally uses nonphysical planet sizes/distances to keep a browser-scale overview readable. Its sky panorama is oriented using the same equatorial-to-ecliptic transform as the MIT-licensed reference project. The near-sky stellar point cloud now loads the upstream 42,000-star catalog from assets/sky/stars.bin and falls back to procedural stars if it cannot be fetched. The zoomed-out 3D Milky Way arms remain artistic and procedurally sampled, not a physical galactic stellar survey.

Sky attribution: NASA Goddard Space Flight Center Scientific Visualization Studio, Deep Star Maps 2020, derived from Gaia DR2 / Hipparcos-2 / Tycho-2, public domain, as credited by the upstream project. We do not claim that these star points carry precise catalog parallax distances, because the browser sky projects their catalog directions to a shell for stability. The fictional Copper Coast and Alder River Valley have no assigned real Earth latitude/longitude.

## How it works

- assets/cosmos/portal.js: shared launch and optional high-altitude handoff, with a return to the originating map.
- space.html: full-window space view with destination selector, speed control, and navigation panels.
- assets/cosmos/cosmos.js: Three.js planetary scene and galaxy scene, generated in bounded point-cloud batches.
- Controls: U to enter/leave the universe, drag to orbit, scroll/pinch to zoom, WASD translate, Q/E move vertically, Shift speed up.

The universe **does not** change city flight physics, map bounds, or the 1:1 quality of buildings. The ascent handoff is a scene/scale transition, not a physically continuous 100-kilometer trajectory.
