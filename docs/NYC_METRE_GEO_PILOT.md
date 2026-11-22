# PATROL NYC: first **metric**, georeferenced Times Square building massing pilot

**Status:** independent evaluation pilot, **not a production city replacement**, not flyable, not photorealistic. The NYC realism P0 remains open: https://github.com/bhu103-data/patrol-flight-sim/issues/229

## Why this exists

Previous official source building FIDs were squeezed into an invented game map: `assets/nyc/nyc-gis-infill.js` uses an empirical ~0.32 game-unit/metre XY transform and `heightFt * .3048 * .32` with a 66-unit roof clamp. The upstream snapshot itself still holds geodetic positions and roof heights. Merely making its arbitrary boxes shinier is not a faithful Manhattan reconstruction.

This pilot removes **only the geometry scale error inside a separate viewer**. The original game and all active NYC, Alaska, Chongqing, Vegas, sky, water, traffic and aircraft PRs are untouched.

## Open the real-data pilot

From a checkout of this branch:

```sh
python3 -m http.server 8765
# Open http://localhost:8765/nyc-metric-pilot.html
```

Uses stock **WebGL2 with no Three.js, tile API, key, Google Earth assets or photo scans**. Mouse drag rotates; wheel zooms; top-down north-up and oblique buttons are provided. The visible grey 50-metre grid is a scale reference, **NOT a street map**.

The page imports `assets/nyc/nyc-metric-footprints.mjs` and the existing official-source `assets/nyc/times-square-footprints.json` (120 source records, retrieved 2026-11-20). Coordinates are WGS84 longitude/latitude; HEIGHTROOF values are in US feet, converted with the exact `0.3048` metre/foot coefficient. Model basis is an **east/north/up local ENU tangent plane** at approx One Times Square, `lon=-73.9864883, lat=40.756421`. GPU coordinate convention is X=east, Z=south, Y=positive up. ECEF uses WGS84 ellipsoid semimajor axis 6378137 m and inverse flattening 298.257223563. **No 0.32 horizontal or vertical scale, invented rotation, or min/max roof-height clamp.**

Source polygon exteriors are cleaned only of ~1.5 cm near-collinear and ~2.5 cm duplicate quantization noise; roofs are ear-triangulated with area reconciliation and uniform vertical walls added at recorded roof heights. Such extrusion is a **Level-of-Detail 1 geometric approximation**; the walls, colors and flat base plane are not surveyed building façade surfaces or ground elevations. Attributes preserve each original FID and roof height, and skip/reject records rather than invent missing values. **Polygons with inner rings/holes are deliberately rejected** until explicit hole-safe polygon tessellation exists.

The viewer reports original input size, number built/rejected, triangle budget, horizontal bounds and maximum geometric height. It has a browser-visible `window.PatrolNycMetricQA()` audit hook returning those values and source IDs. **No maps or buildings are silently installed into `index.html`.**

## Source and redistribution

- NYC Open Data BUILDING: https://data.cityofnewyork.us/d/3g6p-4u5s; original source snapshot metadata included in `times-square-footprints.json`, originally queried through https://services2.arcgis.com/IsDCghZ73NgoYoz5/ArcGIS/rest/services/NYC_Building_Footprint/FeatureServer/0.
- City policy on dataset use, accurate data-version/source identification and disclaimer: https://cityofnewyork.github.io/opendatatsm/publicpolicies.html — NYC Open Data is freely usable but this is **not** labelled as CC0, and the city does not guarantee dataset accuracy or fitness.
- No new external assets are downloaded or distributed in this patch.

## Explicitly UNVERIFIED before a real Times Square scene replacement

1. **Streets and sidewalks absent:** City CSCL https://data.cityofnewyork.us/d/inkn-q76z and DCP Digital City Map street centerlines https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/DCM_Street_Center_Line/FeatureServer/0 must be **fetched/version-pinned** and transformed through the identical ENU frame; CSCL's original coordinate system is EPSG:2263 (NAD83, US survey feet). DCP's `Streetwidth` is an attribute and must not be treated as measured curb/driveable pavement width without validating roadbed and pedestrian-plaza topology. Need separate actual curb/sidewalk edges and traffic signals.
2. **Heights not geodetic elevations:** HEIGHTROOF can represent above-ground roof-height estimate, but terrain surface/basement grade and source roof-detail accuracy are unknown. This pilot sets zero ground plane intentionally; camera and collision must use the same later calibrated vertical datum.
3. **No facade survey:** Entrances, signed LED screens, glass recesses, storefronts and rooftop equipment remain missing. These should follow a curated evidence and license process. Generic facade texture or uniform windows cannot be advertised as real.
4. **No city-wide conversion:** Current PATROL map coordinates, camera scripts, traffic routes, bridgehead, East River, Manhattan Bridge tracks and flight-plane physics are on a compressed system. Do not force the 1:1 geometry onto it; **replace roads, buildings, crosswalks, cameras and collision together** in a deliberately scoped opt-in scene.
5. **No multi-control-point geodetic audit yet:** One ENU origin is a coordinate-frame definition, not a surveyed ground-control calibration. Need >=3 independently sourced control points and error residuals in metres versus official street/feature data. **No fictitious accuracy error bars are claimed.**
6. **No native GPU performance proof:** Node unit tests enforce geometry sanity. A browser WebGL2 screenshot and performance report for this exact SHA and representative real hardware are outstanding. No FPS or photorealism claim.

## Next merge gate

After road-edge data are lawfully retrieved, a future separate opt-in `TimesSquareMetricPilot` game scene must **replace** the local procedural road/building massing with source-matching GIS; then use matched cameras over Times Square Street, Duffy, 44th LED Canyon and a Brooklyn/harbor regression scene. Reject missing/extra buildings, intersecting road polygons, incorrect roof-height ratios, subway placement mistakes, missing context-loss fallback and performance regressions.

Until then, keep this isolated pilot Draft and the live game unchanged.

## 2026-11-22 next step — actual municipal street axes in the SAME ENU metre frame

A second, separately verified municipal source has now been added: [NYC Open Data official Citywide Street Centerline (CSCL), `inkn-q76z`](https://data.cityofnewyork.us/d/inkn-q76z). Unlike the old invented grid, CSCL stores full WGS84 `MultiLineString` source coordinates, official street-name strings, road-type codes, traffic directions and numbers of travel lanes. The published city [CSCL metadata](https://github.com/CityOfNewYork/nyc-geo-metadata/blob/main/Metadata/CSCL_Pub.md) documents its native NAD83 State Plane feet source; this particular SODA output is explicitly geographic lon/lat.

**Observed fetch QA:** `tools/nyc/fetch-times-square-cscl.mjs` queried one fixed small bounding box (`-73.9902..-73.9824 longitude`, `40.7548..40.7605 latitude`) from the live official site, selecting only source fields and ordering by `physicalid`. GitHub Actions run [45038506150](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45038506150) fetched **44 valid records, 14 distinct street names, zero rejected geometries**. This is the number returned by that **run**, not a claim of all roads in Manhattan or an immutable city-wide sample.

### Reproduce the visible road-coordinate overlay (no live game requests)

```sh
node tools/nyc/fetch-times-square-cscl.mjs
python3 -m http.server 8765
# open http://localhost:8765/nyc-metric-pilot.html
```

The bounded fetch produces `artifacts/nyc-metric-pilot/cscl-centerlines.json`; preserve this file and its `queryUrl`/`fetchedUtc` for audit. `assets/nyc/nyc-metric-centerlines.mjs` uses exactly the SAME `wgs84ToLocalMetres` function and reference origin as the existing 118 plotted buildings, drawing the official axes in orange, with no arbitrary game-scale 0.32, roadway smoothing or hand-placement. Browser CI now **requires** a nonempty official street layer to PASS, alongside the measured building model. Failure to fetch means no roadway pass, rather than a synthetic fallback masquerading as source GIS. Public API data may change over time, so a run's audit artifact and timestamp matter.

**Narrow scope:** a `streetwidth` field is retained as source metadata but **not** rendered as an asphalt rectangle or curb. The 2015/2025 [NYC Planimetric Curbs](https://data.cityofnewyork.us/d/5xvt-8cbk), [Sidewalk](https://data.cityofnewyork.us/d/vfx9-tbb6), and roadbed/plaza layers have not yet been pulled and calibrated for this preview. Precise crosswalks, One Times Square island plazas, pedestrian access, road grades and traffic-signal positions still require those layers and a documented source date. CSCL centerline alone cannot assert actual carriageway or pedestrian curb width. This preview does not yet bring the metre scene into gameplay or the aircraft controls.

**Dataset provenance:** NYC Open Data policy, original fields including `physicalid`, road type, `trafdir`, `from_level_code/to_level_code` and `streetwidth` are kept separately; no imagery, Google tiles, proprietary meshes or new paid service was introduced. Files from the fetch live in a CI artifact until separately reviewed/committed — the checked-in PR contains fetch and renderer code, not a claim to have baked a static 44-record snapshot into source control.
