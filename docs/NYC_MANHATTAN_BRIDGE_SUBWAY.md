# PATROL NYC — Manhattan Bridge subway / architecture structure pilot

## Reality vs gameplay
- Today's **Brooklyn Bridge** carries road and pedestrian traffic, **not** B/D/N/Q subway trains. The previous fictitious DUMBO elevated loop must remain disabled (`BROOKLYN_RAIL.enabled=false`).
- The **Manhattan Bridge**, just to its north, has four operating subway tracks, two on each side: **B/D** on the north tracks, **N/Q** on the south tracks. Manhattan portals connect toward Grand Street and Canal Street respectively. A static pair of D/Q example trains is **not** a simulated timetable.
- **Brooklyn Bridge–City Hall (4/5/6)** is underground beneath Centre Street: it is not a bridge-span train. No invented aboveground 4/5/6 or visible York Street F line is added.

Sources:
- MTA corridor overview: https://future.mta.info/next-twenty-years/bottleneck-report
- MTA subway map: https://www.mta.info/maps/subway-line-maps
- MTA City Hall station map: https://www.mta.info/document/2806
- Manhattan Bridge track reference: https://www.nycsubway.org/wiki/Manhattan_Bridge

## Implementation
- New `assets/nyc/manhattan-bridge-subway.js` is **original code, not copied** from @arafune, Blender MCP, Tripo or Google Maps. Follows the construction process: separate load-bearing piers, towers, catenary, hangers, deck, cross braces, four ballast/track sets, rail hardware and light fixtures instead of solid floating boxes.
- Insert the script synchronously before PATROL's native renderer in `index.html`; build the geometry **once** inside `buildStreetScene`, using existing batched `box`, `addQuad` and `addRideBeam`. Reuse existing `streetMeshes.train` in `drawCityTraffic`, only while `selectedMap.city`. No new library, textures, renderer, sound, network download, or control changes.
- Hard budget: <= 20,000 additional shader geometry triangles, two runs × four existing cars maximum 8 extra draws, and 455-unit camera-distance culling. No new terrain collider/bridge collision hook; the supports must be visually checked against the terrain/boat clearance.
- PATROL coordinates here are **compressed invented game space**: span X=-30..201, center Z=-285, deck Y=26.0; bridge positioning, truss spans, pier heights and station approaches are **not surveyed Manhattan Bridge measurements**. This is a staging pilot, not a 1:1 reconstruction.
- Existing realistic NYC OTI GIS footprint branches handle Manhattan architecture; don't duplicate/rewrite those in this rail feature.

## Evidence needed before any merge
1. `node --test tests/nyc-manhattan-bridge-subway.test.mjs` and full Node regression; load New York and other maps.
2. On Chrome WebGL2: use both Brooklyn Bridge View and DUMBO Warehouse Blocks cameras, check D/Q cars at 10, 25 and 40 seconds; ensure no train traverses the road-only Brooklyn Bridge, no catenary collision with skyline, no floating piers, no submerged train, and no repetitive flashing at tunnel limits.
3. Day/dusk/night screenshot A/B: inspect rails, column/stone interface, bridge silhouette and water reflections. Compare WebGL timing/draw calls with the same camera. SwiftShader performance is not proof of 60fps.
4. If visual geometry conflicts with an existing footprint or waterway, switch off **only** the new script call/traffic loop and adjust positions against grounded GIS, rather than trimming unrelated city assets.

## Rights
Code is original in this PR; no third-party image, mesh, Tripo asset, audio, or model files copied. Public reference photographs remain reference only. License details for future imported third-party GLBs must be audited separately.

## Dedicated spectator QA
- In the NYC game press **H → Scenic Views → Manhattan Bridge · Subway Tracks**. Fly controls stay unchanged; leave the view to resume.
- The NYC bridgehead WebGL smoke captures `10-manhattan-bridge-subway.png` after checking that the real browser loaded the module, its four tracks and two train runs, and that WebGL2 did not report an error. This does not itself certify correct geographic placement or photorealism.
