# NYC Times Square — 1:1 official-street low-flight prototype

This **separate** meter-scale view is a first *flyable source-geometry*
iteration. The original PATROL NYC map uses compressed fictional geometry
and remains untouched. This is not the final game, not a real street
surface/crosswalk reconstruction, and absolutely not photogrammetry.

## Actual sources
- Existing official NYC Building Footprints snapshot:
  `assets/nyc/times-square-footprints.json` (FID + HEIGHTROOF),
  source https://services2.arcgis.com/IsDCghZ73NgoYoz5/ArcGIS/rest/services/NYC_Building_Footprint/FeatureServer/0
  retrieved 2026-11-20.
- Live NYC DCP DCM Street Center Line:
  https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/ArcGIS/rest/services/DCM_Street_Center_Line/FeatureServer/0
- Existing parent #234 generates two *coincident in metres* source datasets
  `source.json` and `plan.svg`. 2026-11-22 exact run artifact
  14741924171 contained 118 official building outlines, 39 DCM road features,
  66 clipped line portions. The source snapshot is derived/rounded,
  not survey-georeferenced street-level facade imagery.

## New production-independent features
- A **real interactive low-flight viewer** on the same measured building/road
  coordinates. Free yaw/pitch, 25 m/s normal or 68 m/s boost, W/S forward and
  backward, A/D sideways, Q/E vertical, Shift boost.
- Fly starts on an **actual DCM non-paper, improved** road segment.
  No spawn is invented if official roads are absent or obstructed.
- Collision checks the actual official building outline polygon and
  HEIGHTROOF-derived block roof elevation, with 1.2m camera radius.
  Segment substeps <=1.5m avoid passing through a narrow building in one
  high-speed frame. Collision-aware wall slide retains free-axis motion.
- The viewer retains its original full-city orbit mode; returning from fly
  mode restores the original uncompressed aerial reference.
- The data has an unknown terrain elevation datum, so all visual buildings
  are grounded at y=0 and roof y=HEIGHTROOF*0.3048; **the flight height
  is relative to illustrative y=0**, not accurate altitude above NYC.
- Live hover status reports local east/north/height METRES and blocked hits,
  not invented traffic/lanes.
- Exact browser QA captures full aerial view, real DCM street eye, and
  an input-driven low-flight view, asserting camera movement, source counts,
  correct units, intact WebGL2, and zero building interior collisions.

## What this is NOT
- No street ROW width is interpreted as pavement width, lane count or curb.
  The blue lines are actual DCM street centerlines, not road surfaces.
- Buildings are *uniform placeholder masses* with source polygon shapes
  and relative roof heights, not real windows, setbacks or glass facades.
- No road traffic, signal phases, One Times Square LED screenshot, subway,
  bridge, terrain DEM, real pilot physics or full NYC streaming world.
- No changes to original PATROL game `index.html`, `main`, aircraft controls,
  collision system or sibling NYC/Chongqing/Alaska/Vegas development branches.
- Playwright/SwiftShader rendering is valid software WebGL2 visual proof but
  **not native GPU performance**.

## Reproduce
At repository root with Node 22 and network access to the official DCM service:
```bash
node --test tests/nyc-times-true-scale-pilot.test.mjs tests/nyc-times-true-scale-flight.test.mjs
node scripts/nyc-times-true-scale-pilot.mjs
cp tools/nyc/true-scale-preview.html artifacts/nyc-true-scale/preview.html
cp tools/nyc/true-scale-flight.mjs artifacts/nyc-true-scale/flight.mjs
python3 -m http.server 8765 --directory artifacts/nyc-true-scale
# Open http://localhost:8765/preview.html
```
Install Playwright Chromium to run `node tools/nyc/true-scale-flight-browser-smoke.mjs`.

## Required milestone before replacing current NYC
1. Separate open-data streetbeds/curbs, sidewalk polygons and actual plaza.
2. Measured ground/terrain elevation and horizontal control points; actual
   building HEIGHTROOF is relative, not sea-level.
3. Source-verifiable external building facade meshes, lawful photo PBR,
   real roof/courtyard triangulation. The two hole-bearing buildings are
   currently excluded from rendering by the original source pilot.
4. Make this geographic frame the common one for traffic/collision/planes,
   remove (not overlay) old regional grid buildings and LED anchoring.
5. Real WGS84 fixed cameras, documented source-photo comparisons, strict
   building/road spatial-error metrics and native GPU FPS frame budget.

Do not label this demo **finished realistic Manhattan**. It is the first
bounded *flyable official-coordinate* scene with meaningful source collision.
