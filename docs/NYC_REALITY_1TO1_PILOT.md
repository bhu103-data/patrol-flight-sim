# NYC Reality 1:1 geometry pilot (experimental; NOT released)

## Why this is separate from PATROL's Manhattan map

The existing Manhattan map uses invented, compressed game coordinates. Its
Times Square GIS supplement can only insert a small number of official
footprints into old empty lots; overlaying a full municipal district would
double existing buildings and obstruct its fictional roads. This pilot **does
not modify the playable Manhattan scene or claim it has been reconstructed**.

The experimental page `/nyc-reality.html` instead uses uncompressed WGS84
east/north/up tangent-plane metres, with its origin approximately at One
Times Square (longitude -73.9864883, latitude 40.756421).

## What is actually implemented

* Directly consumes the existing 2026-11-20 NYC public Building Footprints
  snapshot, `assets/nyc/times-square-footprints.json`, with 120 original FIDs.
* Preserves coordinates in local WGS84 east/north/up **metres**, rather than
  reusing the 0.31974 gameplay transform.
* Renders **118** closed single-ring footprint extrusions using uncompressed
  `heightFt * 0.3048` vertical dimensions. The other **two** records have
  multiple rings and are intentionally withheld until courtyard/hole geometry
  can be handled correctly.
* Provides free 3D camera movement, street-height and aerial views, a 50-metre
  measurement grid (not a roadway), and selectable original source FIDs.
* Adds deterministic Node geometry tests. No Google, Street View,
  third-party screen image, or proprietary 3D asset is embedded.

## Deliberately NOT implemented / acceptance failures

* Not a photoreal NYC city and not a source-accurate facade reconstruction:
  the muted roof/wall materials are **illustrative**.
* Not full Times Square: the 120-record snapshot is an incomplete bounded
  extraction, and historical/modern building identities still require
  verification.
* **No** municipal LION/CSCL street geometries, roadbed widths, sidewalks,
  turning logic, traffic signals or pedestrian plazas in this pilot.
* Ground is a flat visual zero datum rather than a surveyed NYC elevation
  surface; original municipal roof HEIGHTROOF values are heights above ground,
  not absolute terrain elevations.
* No PATROL aircraft, collisions, mission triggers or map switching in this
  **separate test viewer**.
* A 2014 NYC official 3D model may provide real roof topology, but must be
  checked against present-day buildings and its terms before importing.
* No browser WebGL screenshot, FPS, first-load or memory benchmark has been
  collected by this patch itself.

This evidence gate is only **1:1 metric building placement**, not completed
architectural fidelity or flight-scene acceptance. Do not merge as a
realism-complete feature.

## Local QA

Run an ordinary static server from the repository root:

```sh
python3 -m http.server 8000
# Open http://localhost:8000/nyc-reality.html in a WebGL-capable browser
node --test tests/nyc-reality-georef.test.mjs
```

The viewer imports Three.js r180 from the jsDelivr CDN, so it needs network
access. Keys: WASD move, E/Q vertical, Shift faster, drag look.
Use the **Aerial** and **Street-height** buttons to inspect relative massing.
The grid is 50 m. Compare actual FIDs and coordinates, not invented facade art.

## Mandatory next changes before real visual acceptance

1. Load a **source-exact, bounded NYC LION/CSCL** subset and validate
   intersections/traffic directions in the same ENU metres.
2. Import verified NYC 3D building roof polygons (CityGML or legal alternative),
   retaining unique IDs and source timestamps. Replace rather than overlay
   provisional extrusions.
3. Establish real ground-level elevations, curb lines and street/bridge
   connections, plus an official-data-to-building ID mapping.
4. Transfer a strictly tested zone into PATROL's actual flight/collision and
   camera architecture. Remove competing procedural parcels rather than
   leaving invisible collision volumes behind.
5. Capture fixed georeferenced camera screenshots against licensed reference
   views at day/night, profile WebGL2 and collect source and license records.
   Require explicit visual QA; passing unit tests alone is insufficient.

## Public data references

* Bundled municipal footprint snapshot documentation:
  `assets/nyc/TIMES_SQUARE_GIS_NOTES.md`
* NYC OTI BUILDING dataset: https://data.cityofnewyork.us/d/3g6p-4u5s
* NYC CSCL street centerline: https://data.cityofnewyork.us/d/inkn-q76z
* NYC Planning LION: https://www.nyc.gov/content/planning/pages/resources/datasets/lion
* NYC Planning 3D model: https://data.cityofnewyork.us/d/u5j4-zxpn
* NYC Open Data terms: https://data.cityofnewyork.us/stories/s/Terms-of-Use/k9k7-3cje

The repository's original footprint source files stay unmodified.
