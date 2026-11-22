# NYC Times Square: uncompressed metre-frame foundation (NON-RENDERED)

## Why this exists
The current PATROL Manhattan map uses a compressed, rotated, hand-authored
world coordinate system. Adding official GIS polygons over that system produces
road/building intersections and duplicates. Painting more details on the
procedural scene is not a fix for wrong geography.

This branch creates **one independently testable geographic basis**, using the
existing official Times Square source snapshot from 2026-11-20. No production
game or player map loads it yet. It is neither a 1:1 visual digital twin nor a
photorealistic replacement.

## Verified input
- `assets/nyc/times-square-footprints.json`: NYC Building Footprints source,
  official FIDs / HEIGHTROOF (feet), WGS84 polygon vertices, 120 features.
- 123 polygon rings total, of which 3 represent extra rings (courtyards or
  other rings that must NOT be silently flattened without topology evidence).
- Approximate input vertex envelope: lon -73.989540..-73.982983,
  lat 40.755039..40.759960. ~553m east-west and ~547m north-south.
  The query bbox and feature intersection mean this is NOT a guaranteed
  complete reconstruction of the rectangle.
- Max roof-height field: 270.5862 m above building ground, not MSL, not
  including any undocumented spires.

## Implementation
- `assets/nyc/nyc-times-metric-frame.js`: WGS84 local short-distance tangent
  projection. One Times Square approximate point (-73.9864883, 40.756421)
  is the scene origin. +X east, +Z north, +Y up; one unit = one metre in
  this **independent** frame. No 0.31974 game scaling, no 0.32 height scaling,
  no 66-unit cap, no cutting a real building against fictional roads.
- All original rings, including extra rings, retained as coordinate arrays.
  No roofs/facades are fabricated here and no ring is filled or triangulated.
- FID uniqueness, ring closure/area, metre-scale and round-trip tests.
- `checkTimesSquareReconstructionGate`: warns against calling the project
  geographically complete before street, elevation, licensed facade and
  real reference-alignment work is actually done.

## Why NOT connected to the game yet
The existing `assets/nyc/nyc-street-network.js` documents its roads as
**game-space, not GIS**; older Times Square masses and LED billboard backing
also use its fabricated reference frame. Overlaying a metre-scale city into
it would create broken intersections, duplicate buildings and missing
collisions. Only a coordinated region replacement can be valid.

## Concrete replacement acceptance order
1. **Source roads**: obtain a bounded WGS84 sample from the municipal CSCL
   `inkn-q76z` (or verified NYC LION), including street names/traffic
   direction/type, with source snapshot/attribution. The current environment
   did not successfully fetch that source; no roads are invented.
2. **Common scene**: align official street centerlines and building rings in
   the same local metric frame; preserve all ring and intersection topology.
   Check road width and lane direction from separate city data; centerlines
   alone do **not** prove lane width or signal phases.
3. **Replace, not overlay**: remove old programmatic buildings **and**
   street grid in an isolated Times Square region when the new full
   geometry/collider/navmesh is complete.
4. **Vertical reference**: obtain terrain/ground elevations with an explicit
   vertical datum; HEIGHTROOF is a relative building roof height.
5. **Real appearance**: source-verifiable entrances, setbacks, roofs,
   windows, LED supports, and lawful photographic materials/3D assets. NYC
   polygon exteriors alone are insufficient for photorealism.
6. **Sign-off**: fixed WGS84 camera poses and real georeferenced reference
   images, report horizontal/height/road-topology errors, real browser and
   native hardware frame cost, and all flight/map-switch regressions.

### Reproducible tests
```bash
node --test tests/nyc-times-metric-frame.test.mjs
```

No `main`, integration branch or in-game default is modified by this
research/data foundation; do not merge it as proof of visible realism.
