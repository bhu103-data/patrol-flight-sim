# NYC Times Square — first true-metre geometry reference

This is a **reference pilot only**, not a production NYC flight-map replacement.
Open `nyc-times-square-metric-pilot.html` through a local server (or a PR
preview). Drag to orbit, scroll to zoom; the grid is spaced at 50 metres.

## What actually changes

- The existing 2026-11-20 official NYC `assets/nyc/times-square-footprints.json`
  snapshot contains 120 geometries. The independent reference builder reads
  WGS84 vertices, converts them with WGS84 Earth-centred/East-North-Up geometry,
  and represents one metre as one scene unit. Heights come only from
  `heightFt * 0.3048`; missing, invalid, multi-ring/holey or untriangulatable
  shapes are rejected and reported, not filled with made-up geometry.
- Preliminary scan on the snapshot found 118 single-ring valid polygons,
  2 rejected; final results must be confirmed by Node and browser QA on the
  PR head. No procedural roads, generated lot clearance, forced building
  replacement, fictional plaza tiles or compressed 0.32 coordinate factor.
- The viewer is isolated. It does **not** modify `index.html`, flight physics,
  collision, map switching, traffic, subway or production scenery.

## What remains NOT real

This is actual **meter-scale plan geometry**, not photorealism. The roof is a
flat extrusion from a measured footprint/height field, not a current LOD2 roof.
The viewer uses fabricated neutral colors, a flat local ground at Y=0, no
terrain absolute elevation, no authored-verified window/door positions,
traffic, street widths, bridges, legal advertising or current storefronts.
It must **not** be described as a 2026 3-D scan.

NYC official 3-D model is predominantly based on the **2014** building survey;
it cannot automatically be treated as current. When street centerlines,
roadbed geometry, curb lines and high-detail building models are imported,
preserve their source dates, original units, attribution and rights. Verify
NYC Open Data portal policies and any dataset-specific third-party notices:
https://opendata.cityofnewyork.us/ and
https://www.nyc.gov/opendata/get-started/FAQs.

## Required gate before flight-map integration

1. Obtain roadbed/curb/plaza shapes with verified reuse rights and documented
   CRS and publication dates; do not infer carriageway widths from centerlines.
2. Use **one** geospatial transformation for roads, building polygons, ground,
   street furniture, dynamic vehicles, collisions, aircraft spawn and cameras.
   Compare at least three independently known control points and report
   horizontal residuals in metres; reject footprint-road overlaps.
3. Replace, do not overlay, the old compact pilot Times Square blocks/streets;
   keep an opt-in rollback and independent compatibility fallback.
4. Retain survey-derived shape, then enhance actual hero facades with
   independently documented setbacks, storefront cadence, recessed bays,
   roof equipment and sign brackets. No stolen Street View/3D tiles.
5. Fixed-real-world camera A/B against source, measured roof-height errors,
   triangles/draw calls/VRAM/first load and hardware frame P50/P95.
   Check red/amber/green signals, bridge/rail clearance, NYC-other-map
   switching and aircraft flight.
6. A passing Node test or SwiftShader WebGL2 render is **not** approval for
   scene-level NYC visual fidelity. Issue #229 remains the overarching blocker.

## Validation

```sh
node --test tests/nyc-metric-geometry-pilot.test.mjs
python3 -m http.server 8000
# visit http://localhost:8000/nyc-times-square-metric-pilot.html
```

Source: NYC OTI official City Building Footprints:
https://data.cityofnewyork.us/d/3g6p-4u5s
(Existing repository snapshot; no external binary models or imagery added.)
