# PATROL DUMBO — source-true NYC CSCL street-centreline pilot

**Status:** geographically sourced **three-building + street-centreline diagnostic**, not a fully rebuilt borough or flight-simulator city. This is intentionally independent of `main`, integration, NYC traffic simulation and the original game map. The user reports that cosmetic texture/window updates are nowhere near real-world fidelity; this pilot fixes the core geographic coordinate mismatch rather than adding another façade treatment.

## Official dataset and immutable freeze

- Owner: **NYC Office of Technology and Innovation**, NYC Open Data.
- Current NYC Street Centerline (CSCL): https://data.cityofnewyork.us/City-Government/Centerline/inkn-q76z
- Not the historical PlowNYC copy `dpb9-ubdh`.
- Published dataset metadata describes physical road-bed centreline polylines with address attributes, names, directions, roadway types and source street-width fields. These are **centerlines, not surveyed curb polygon boundaries**.
- Original retrieval: `tools/nyc/collect_dumbo_cscl.mjs`, source API `https://data.cityofnewyork.us/resource/inkn-q76z.json` with a spatial bbox and `boroughcode='3'`. Exact SoQL query, extraction time and original feature IDs are embedded in `assets/nyc/dumbo-cscl-official-snapshot.json`.
- Bounding box WGS84: **west -73.9945, south 40.6988, east -73.9845, north 40.7048**.
- Snapshot read by GitHub Actions in run #45038721615: **404 unique `physicalid`** records; **55 official street names**, **1,333 WGS84 vertices**; 0 rejected. Raw provenance artifact `14760239631`.
- The source record-array content is pinned to SHA-256 **`21af6bf980db1605c7929207499d7d96066c2f71e7f8381c75036e033b5a0cb2`**. Run #45039004006 rechecked that exact source content and froze it once on the isolated feature branch. Extraction timestamp may differ across identical-content reads; the **records** hash is the data-identity check.
- Terms: https://data.cityofnewyork.us/stories/s/Terms-of-Use/k9k7-3cje — retain official attribution and source limitations.

## Explicit geospatial / vertical-boundary handling

- Source data `MultiLineString` lon/lat coordinates are retained. Display is clipped against the exact WGS84 bbox, then projected to the **same WGS84 ECEF→ENU metre frame used by the three OTI building polygons**. No independent street-grid rotation, per-building resize, or forced road snapping.
- Conservative diagnostic subset: only source `roadwayType` **1 or 2** and source `fromLevelCode='13'` and `toLevelCode='13'` with source `status='2'`. These are **code-based eligibility filters** for a single flat visualization, **not a verified assertion** that Level 13 equals a specified NYC ground elevation.
- **213 source street records**, **295 bounded line pieces**. Preserve **191 excluded records** with their original physical IDs / level codes; many are BQE/bridge/paths. Named ordinary **BRIDGE ST** is not an elevated bridge deck and is not excluded by text matching.
- Distinct multi-level **Brooklyn Bridge**, **Manhattan Bridge**, BQE and access ramp lines **are NOT mapped to a made-up y=0 deck elevation**. Their `fromLevelCode`/`toLevelCode` do not provide absolute heights. Source centreline geometry is a legitimate start for 2D alignment; actual 3D profiles require bridge engineering drawings, verified height datums and safe collision routing before rendering bridges as physical drivable geometry.
- Diagnostic street traces are fixed **1.8-metre-wide teal guide ribbons** for visibility, **NOT roadway/curb/sidewalk surveyed widths**. Actual streets and intersections in the real flight world must be rebuilt separately with official pavement/curb data and grades; no lane counts or signals are inferred here.
- The three official building polygons and height-above-ground references are unchanged from [#238](https://github.com/bhu103-data/patrol-flight-sim/pull/238); the diagnostic ground is flat y=0 solely to show 2D **relative georeferenced plan-position**. A verified vertical datum, site terrain and orthometric elevations remain unmeasured.

## Test and explicit non-claims

- `tests/nyc-dumbo-cscl-meter-streets.test.mjs`: exact original snapshot SHA, 404 FIDs and 55 names; 213 eligible / 191 excluded; 295 actual clipped line pieces; 34 rendered distinct street names, ~10 km of traced line length; zero out-of-bounds points; correct positive-Y guide ribbon normals (590 triangles); shared source-coordinate placement with all three official buildings. It must fail if a dataset update or geometry rewrite silently changes the audited content.
- The existing `tools/nyc/smoke_dumbo_true_scale.mjs` now asserts all source requests HTTP 200, 590 WebGL road triangles, 90 original building geometry triangles, actual WGS84 source building locations, no browser/GL errors and three screenshot vantage points.
- Source 2026 road centrelines and official OTI building footprints are **not** photogrammetry, street-facing textures, current NYC construction, or full building exterior architecture. This remains visually simple and can only validate real-world *horizontal geometry*.
- No new proprietary imagery, paid tiles, external runtime network requests, remote third-party WebGL dependencies, changes to vehicle traffic, collisions, flight physics or any other map. This is not production-ready geospatial city integration.

Next defensible step: source a *contiguous real Brooklyn corridor* of verified curb/building geometry, correct bridge elevations, district LOD and licensed façade materials; compare source-registered fixed cameras to real named intersections; validate local road/aircraft collision on metre-scale geometry; test native Windows hardware GPU p50/p95 and first load before merging.
