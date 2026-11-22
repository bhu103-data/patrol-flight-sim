# Times Square P0 — uncompressed municipal building-geometry pilot

This is **not** a replacement NYC map yet, nor does it claim street-level
photorealism. It is an isolated operational WebGL2 proof that PATROL can
display real relative building positions and roof heights, in meters,
without fitting official buildings to the old fictional game streets.

## Source, provenance, and reuse checks

- Existing pinned snapshot: assets/nyc/times-square-footprints.json,
  captured on 2026-11-20.
- Source: NYC Office of Technology and Innovation, NYC Building Footprints
  FID / HEIGHTROOF (field units feet):
  https://data.cityofnewyork.us/d/3g6p-4u5s .
  The raw feature endpoint and WGS84 rings are in the source JSON.
- NYC Open Data general terms:
  https://data.cityofnewyork.us/stories/s/Terms-of-Use/k9k7-3cje .
  The snapshot consists of public municipal vectors, not Google/Earth/Street
  View content. Respect dataset-specific metadata and attribution requirements.
- WGS84 source coordinates are simplified to 1e-6 degree plus ArcGIS
  generalized output. Do not claim centimeter cadastral precision.
- HEIGHTROOF is feet, so roofMeters=heightFt*0.3048 with no game
  compression factor and no invented height clamping.
- Relative X/Z uses WGS84 ECEF-to-local-ENU projection, X=east, Z=south,
  horizontal 1.0 world unit=1 meter. The previous project's approximate
  One Times Square position (-73.9864883,40.756421) is the local origin,
  not a confirmed third-party surveyed ground-control marker.
- Source polygon relative locations are preserved. Absolute cadastral
  survey accuracy and independent ground-control residuals NOT yet measured.

## What runs

Serve the repository over HTTP, e.g. with:

    python3 -m http.server 8765

Visit:

    http://localhost:8765/truegeo-times-square-preview.html

The preview creates 118 real-position building massings from 120 verified
snapshot records: 2,104 wall/roof triangles, source real roof heights,
local meter coordinates, and a reference grid every 50 meters. Two FIDs
800370 and 1072214 have inner courtyard rings and are intentionally
excluded rather than falsely filled with solid roofs. No fake road mesh
is created; the grid is NOT a street map. Drag to orbit, mouse wheel to
zoom, and arrow keys for 10-meter panning. Check GitHub Actions Node and
live software-WebGL2 screenshot QA on exact HEAD before acceptance.

## Unresolved P0 gates for real street-level NYC

1. Acquire actual municipal Centerline/CSCL street polylines from
   https://data.cityofnewyork.us/d/inkn-q76z with per-dataset rights,
   fields, direction and coordinate reference checks. A centerline does
   not provide independently verified street width, sidewalk, elevation,
   or traffic-light phase durations.
2. Establish >=3 independently verified geodetic ground control points
   and report residuals (meters); the source ENU coordinate origin does
   NOT establish landmark-registration accuracy on its own.
3. Replace old procedural roads, lots, collision proxies and LED backing
   WITH official street/building layers in one common local meter frame.
   Do not overlay this pilot on existing fictional Manhattan gameplay:
   it would double buildings, block roads and change aircraft collision.
4. Build legitimate roof holes, additional source multipolygons and
   courtyard walls, with source-vintage caveats.
5. After shape and location correctness, model independently authorized
   building-specific setbacks, doors, roof utilities, brick/window
   openings, signage mounts, benches, signal lights and visual details.
   Do not copy unauthorized billboard graphics or Google tiles.
6. Camera-match source, prior game and proposed game at exact location,
   FOV, time/weather. Report source polygon error (meters), height error,
   overlap count, native GPU frame time P50/P95, triangles, VRAM and load.
   SwiftShader browser success is NOT hardware FPS evidence.

**Not claimed:** actual NYC road network, DUMBO, subway elevations,
New York photogrammetric assets, citywide ground collision or realistic
branded ads. This is a geospatial building proof, NOT a finished game map.
