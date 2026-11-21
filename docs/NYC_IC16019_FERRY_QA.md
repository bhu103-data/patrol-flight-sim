# PATROL · NYC Ferry IC16019 native-WebGL2 twin-hull sample

**Branch:** `review/nyc-ic16019-native-twinhull-20261121`  
**Base:** `codex/patrol-integration-20261121` @ `6d50bfda4b2d3837e550751ede49b200b140bc72`.  
**Scope:** Only the native PATROL ferry mesh, ferry-specific NYC dimensions, provenance, and directed tests. No map terrain, street, water shader, C185 aircraft, flight controls, physical ship route logic, or `main` changes.

## 1. What was actually in the game

`index.html` is the ship registry, procedural mesh generator, vessel placement/route code and renderer, **not a GLB manifest**:

- `SHIP_TYPES.ferry`: existing half length **13** and half width **3.3** game units; original 26×6.6 game-unit **single-keel** proxy. It is still used for non-NYC maps.
- `buildShipMesh('ferry')`: original native WebGL2 ship with cabin/railing/window details, port/starboard fittings, original RGB surfaces, no third-party texturing or GLB. Before this change the hull had one shared downward-facing keel across the center.
- `prepareCoastalTraffic()`: four generic ship slots (`cruise,ferry,cargo,ferry`) from each map's `shipAnchor`; **collision-checked ellipses**, NOT Pier 11–DUMBO real coordinates.
- `shipMeshes` / `splitShipMeshes`: same build path and visual/wreck rendering; `drawCoastalTraffic` keeps `mat4FromBasis([x,WATER_H+bob,z],...)`.
- `updateBoatWakes`, `drawHullWash`: native distance-tiered water foam/wakes using `boat.halfWidth`. No new wave shader or video.
- `usableFloatWater`: C185 collision checks moving boats' `halfLength`, `halfWidth` and heading. **Function unchanged**; new NYC beam is automatically included by the existing interface.

## 2. Verified external physical/route facts

- **Designer:** [Incat Crowther, 26m catamaran IC16019](https://www.incatcrowther.com/ships/ferries/commuter/ic16019/).
  - LOA **26.0m**, LWL **23.9m**, beam **8.0m**, **Draft Max 1.9m**, depth **2.8m**, service speed **25kn** (official design data).
  - **Draft Max does NOT mean normal loaded operating draft**. The designer has not established a normal operating draft, displacement line, water plane Y, hull local origin, or a CAD license for PATROL. They remain **unknown/null** in `assets/nyc/ic16019-ferry-reference.json`.
  - The IC16019 page contains photos/design imagery not licensed for GitHub reuse here. **We did not download, copy, trace or distribute** its photographs, 3D designs, names, logos or textures. New geometry is authored in PATROL's own native procedural mesh from broad public factual dimensions, not a manufacturer 1:1 scan.
- **Route identity:** [NYC Ferry East River](https://www.ferry.nyc/routes-and-schedules/east-river/), whose A/B service both stop **Wall St/Pier 11** (official landing code `2319811`) and **DUMBO/Fulton Ferry** (`2319810`). Some 2026 service is split A/B by time. The route is an official **fact**, not a PATROL digital ship track.
  - The game's NYC compressed X/Z coordinates do not currently have a source-verified **WGS84→PATROL affine/local transform**, pier waypoint, approach heading, turn radius or existing-bridge-clearance line for either official landing. These fields remain **null/unverified**; physical Pier 11—DUMBO service has **NOT** been injected into an arbitrary loop.
  - NYC Ferry's own developer-tools page states revocable license conditions for its GTFS/Developer Tools. This PR ships **no third-party raw GTFS, maps, screenshots or developer tools**, only the public landing codes and sourced facts: https://www.ferry.nyc/developer-tools/.
- The separate Gemini research chat at `https://gemini.google.com/app/95c6ee3a10119de0` could not be retrieved from the connected browser (requires originating browser context; public URL also inaccessible through search). **No unverified code from Gemini was copied or run**.

## 3. Actual minimal visual/geometry implementation

In `index.html`, `SHIP_TYPES.nycFerry` has `halfLength=13`, `halfWidth=4.0`, `top=7.5`. The existing `ferry` value remains halfWidth=3.3. Only when `selectedMap.city` is true does `prepareCoastalTraffic()` choose the NYC type; **the existing ellipse/clearance sampling, pace/speed, C185 physics and water shader stay unchanged**.

`buildShipMesh('nycFerry')` uses the same `createTriangleMesh`, `addQuad`, `addTri`, `addModelBox` and RGB renderer. The new **two lateral pontoon hulls** are under the common ferry deck, with open central water tunnel below the retained skirt; no new texture calls, shader changes, GLTF library or external network dependency. The original old ferry and other ships are untouched.

Real-source geometry test measured:
| Metric | Original non-NYC ferry | New NYC-specific ferry |
| --- | ---: | ---: |
| Triangles emitted by actual builders | **3,090** | **3,150** |
| Visual bounding width X | **6.62** game units | **8.02** game units (1cm rail fitting on each side) |
| Overall visual length Z | **26.0** | **26.0** |
| Lowest legacy hull Y | **-0.60** (local) | **-0.60** (local, **NOT** official operating draft) |
| Min absolute X of lowest hull | **0** (monohull) | **1.7424** (open central tunnel) |
| Additional triangle budget | — | **60 triangles** |

This changes **the boat's physical collision half-beam from 3.3 to 4.0 only in NYC** and so creates a conservative, wider water/floatplane clearance footprint for that new body. Do not call collisions identical: their *code* is unchanged but the ship's size reflects 8m official beam. The 7.5 game height collision descriptor remains a legacy approximation, lower than the 9.65 maximum model height: **central QA must check overhead/bridge clearance** before merge.

The 8.02 game-unit *bounding box* is from tiny bumper/rail fitting offsets. This is a model referencing IC16019 proportions, NOT an exact patented/design-model replica.

## 4. Directed QA and real runtime camera

**Node geometry & clearance tests:** `node --test tests/nyc-ic16019-twinhull.test.mjs tests/floatplane-ship-clearance.test.mjs tests/nyc-boat-optimization.test.mjs tests/nyc-waterfront-piers.test.mjs tests/nyc-floatplane-dock.test.mjs`. No duplicated full 442-test suite.

**Existing actual-game Chrome renderer smoke** (new small, single-camera test): `node tools/nyc/ic16019-ferry-runtime-webgl.mjs` after `python3 -m http.server 8899`, and with Playwright Chromium and pngjs installed. It checks the actual **3,150-triangle** render mesh upload: exactly **3,150 triangles × 3 vertices × 3 position coordinates × 4 bytes = 113,400 bytes** for position (with expected same-size norm/RGB buffers). It captures actual `#glCanvas`, verifies WebGL2/nonblank colors and console error state. A diagnostic `exactTriangleDraws` counts visible 9,450-vertex draw calls, which may be **zero** if ferry is offscreen. **Upload is not enough to assert ferry is visible in the screenshot.** Screenshot is a true game screenshot, not the third-party visual draft.

**Fixed central QA camera:**
- Map: **Manhattan**, default Viper player aircraft, no control input.
- Scenic mode: press **H**, select existing **Lower Manhattan Waterfront** preset. Preset coordinates in `index.html`: `x=-118, z=-448, height=8, bearing=258°, radius=53, rise=10`; zoom 42; noon (12), season 1, Clear.
- Capture **1280×720**, native `#glCanvas`, same game camera / environment before-vs-after. Collect actual vessel screen space if present and record original vs NYC screenshots. Offscreen/occluded boat is not visual proof.
- Central QA then test flight from `[-108,48,-594]` toward Liberty and the Brooklyn Bridge, low-quality setting, ferry wakes and collision/water takeoff around both pontoons. Never equate a software SwiftShader screenshot with verified Windows hardware fps.

## 5. Stop conditions & rollback

- New source material has **no third-party asset license dependency** because it reuses project's own original geometry and native shader. No external GLB accepted. ICC16019 rights to original photographs/CAD are **not** granted.
- If targeted CI fails or screenshot has no ferry in view, **keep PR Draft**, leave real Pier 11–DUMBO path disabled, and assign fixed-view A/B to central QA.
- Restore from `6d50bfd` only the isolated `nycFerry` profile, two-hull conditional and city-only vessel alias to revert. Other ship assets, routing, player airframes and wave shader remain unchanged.
