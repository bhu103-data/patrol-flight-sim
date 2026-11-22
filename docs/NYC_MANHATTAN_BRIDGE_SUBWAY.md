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

## Source-governed geometric calibration (CC BY 4.0)
- **Source model and credits**: *Manhattan Bridge Digital Twin: a source-governed control skeleton.* Ethical Tech CoLab, 2026. https://github.com/Ethical-Tech-CoLab/manhattan-bridge-3d. Under its [LICENSE.md](https://github.com/Ethical-Tech-CoLab/manhattan-bridge-3d/blob/main/LICENSE.md) the control data and model are **CC BY 4.0**; builder code is MIT. All numeric adaptation below retains this attribution. No upstream mesh, photo or code was copied into this game.
- Fetched and inspected real upstream `mesh/glb/control_skeleton.glb`: 976,600 bytes, 103 meshes, 317 primitives, 15 materials, no bundled photo textures, coordinate authoring axes `+X` toward Brooklyn and `Z` up rotated to glTF Y-up. It is an inspectable 3D **control skeleton, not a finished photogrammetric mesh**. No runtime GLB added in this PR because PATROL needs a placement/LOD/atlas review.
- Source `viewer/metadata/build_report.json` (`controls_m`) provides: full suspended span 890.016 m, main span 448.056 m; lower deck datum +42.18432 m; upper deck +49.3776 m; saddle +98.298 m; cable mid +49.3776 m; anchorage +41.148 m above high water. These are sourced reference figures, **not** exact elevations in the compressed game.
- Game towers are 119 units apart; target ratio `231 × 448.056 / 890.016` ≈ 116.3 units (within 4%). Use the existing water-to-lower-deck gap to calibrate tower and cable vertical proportions. However, **two upper roadways are lifted as needed** to preserve the existing 3.13-unit-tall subway car's clearance: game-space safety wins over claiming exact prototype scale.
- The updated bridge now models a **central lower roadway and two separate raised side roadways**, open-pylon steel towers and a bounded catenary/sag rather than a single elevated center slab and over-tall towers. GPU budgets and current MTA car mesh stay unchanged; no new GLB asset is enabled.

This project and authors are credited for the dimensional selection and control data. The geometry scripting and primitive construction in PATROL remain independently authored.

## Top-face lighting and normal regression
- The lower street deck, both subway track-bed slabs and the two upper side roads use upward-facing flat normals. In earlier versions, the original quad winding produced **downward normals** for the northern track bed and for the newly raised roadway quads. WebGL deliberately renders double-sided geometry, but directional lighting still consumes the wrong face normal.
- The bridge builder now tests each normal's Y component and reverses any downward horizontal quad at generation, before the single shared native mesh is uploaded.
- `tests/nyc-manhattan-bridge-subway.test.mjs` checks the real 330 generated horizontal quads are nondegenerate, up-facing and planar; no changes to GIS, city roads or aircraft shaders.
- Same-camera Chrome WebGL2 screenshots are still required after this fix. The sampled software-renderer screenshot duration is not a reliable production FPS benchmark.

## Lower-deck rail detail / geometry batching (post-visual QA)
- Photo references (study only, no media copied): `Manhattan Bridge North Side Subway Tracks` by Marcin Wichary, Wikimedia Commons and `Subway tracks on the Manhattan bridge` by biwook, Wikimedia Commons. These show narrow yellow service walkways, structural lattice and train tracks. Do not claim hand-authored safety walkway width is an exact MTA dimension.
- Seven continuous flat top-face quads now cover the two track beds, the two raised roads, the center lower roadway and two outside maintenance footwalks; previous 330 separate co-planar quads were redundant and frequently caused seams.
- Eight long continuous running rail beams replace 336 overlapping/co-linear rail segments. Sleepers, truss panels and bridge support segmentation are still modeled.
- Yellow dual-height maintenance handrails with uprights are added along the two track-adjacent outside edges. They are original simplified game geometry, not copied assets.
- Native source-geometry budget **14,582 triangles**, **1,221 component calls** (1,108 beams, 106 boxes, seven quads). Previous calibrated baseline had ~18,660 triangles and 1,830 calls. Reducing geometry is a structural optimization, not an FPS guarantee.
- An additional Scenic Views entry `Manhattan Bridge · Subway Rail Level` provides an unobstructed low oblique inspection angle beneath the physically correct upper road decks. The special browser QA captures `11-manhattan-bridge-rail-level.png` alongside the original `10-manhattan-bridge-subway.png`.
- Both the new camera and the optimized geometry require a **new Chrome WebGL2 screenshot review** before merge.

### Maintenance path clearance
- The existing shared subway car mesh extends about 1.365 game units laterally from its centre at the cab glazing. The outer rail axis is ±9.5.
- Earlier walkway inside-edge offset ±10.78 was nearly tangent to the car's glazed envelope, an unsafe near-overlap. Increase the inside-edge offset to ±11.15, leaving **0.285 game units** of side clearance while preserving a **0.53 game-unit** walk strip to the outer edge at ±11.68. This is a **game-model safety clearance**, not an official MTA platform dimension.
- The dedicated unit test reads the game-space offset and rejects any later change that moves the maintenance path within 0.25 of the subway car's real generated window/door geometry.
