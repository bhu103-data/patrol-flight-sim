# DUMBO OTI building-outline pilot — sourced, compressed, not geolocated

- **Data owner:** New York City Office of Technology and Innovation (OTI).
- **Dataset:** NYC Open Data BUILDING (`5zhs-2jue`), [official dataset](https://data.cityofnewyork.us/City-Government/BUILDING/5zhs-2jue).
- **Public REST source:** `https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/BUILDING_view/FeatureServer/0`.
- **Source fields:** `OBJECTID`, `BIN`, `HEIGHT_ROOF`, exterior WGS84 polygon rings. `HEIGHT_ROOF` is measured in **feet above ground**, not a rooftop elevation or a floor count.
- **NYC terms:** [NYC Open Data Terms](https://data.cityofnewyork.us/stories/s/Terms-of-Use/k9k7-3cje); retain provider attribution. No Google Maps photos, 3D Tiles or proprietary street imagery have been used.
- **Snapshot:** GitHub Actions [run 44987962280](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/44987962280), 2026-11-22; [source artifact 14740960211](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/44987962280/artifacts/14740960211).
- **Official query box:** longitude -73.9935..-73.9855, latitude 40.6995..40.7045 (DUMBO / Brooklyn), filtered Brooklyn BIN and HEIGHT_ROOF. The service returned 184 features, 159 passed conservative source validation; up to 48 candidates retained in the short-lived review artifact.

## Limited game rendering

The runtime pilot reuses three authentic **exterior source ring shapes**, unmodified in WGS84 before fitting. The records are:

| Source OBJECTID/FID | BIN | HEIGHT_ROOF (ft) | PATROL proxy center (x,z) |
| --- | --- | ---: | --- |
| 1080628 | 3389054 | 121 | 366.89, -346.09 |
| 1031082 | 3000135 | 83.41 | 390.63, -346.49 |
| 1051309 | 3344163 | 86.5 | 358.67, -280.37 |

**These source buildings are NOT physically located at the listed PATROL coordinates.** PATROL is a highly non-uniform compressed fictional recreation; this preview fits each official footprint's two-dimensional topology **uniformly** into one already road-cleared procedural building lot. It is a rights-cleared *shape and height-reference pilot*, not a georeferenced city replacement. Do not use the PATROL placement for address lookup, GIS distance, building census or survey claims.

- The existing worker-generated proxy `x/z/w/d/h` is unchanged and remains the **conservative collision volume** and maximum main roof elevation.
- Source `HEIGHT_ROOF` only controls the *relative number of visible floor bands*. We do **not** misrepresent it as an exact in-game roof height: that would require consistent 1:1 district calibration, roads and new worker height/collision rules.
- The browser's existing shared building mesh emits wall quads and ear-clipped roof triangles **bounded within** the original proxy; small raised edge trim at most 0.12 units above the old roof. No per-building draw calls or textures.
- Window locations/materials are original lightweight game interpretations, **not** claimed as surveyed apertures.
- The three pilot site matches require normal quality LOD3, city map, intact local parcel, no registered OTI footprint. Distant/low graphics and other maps retain existing generated buildings.
- Polygon holes and courtyards are excluded from this small pilot; do not use the same method for holed source geometries.

## QA gates

1. `node --test tests/nyc-dumbo-oti-source-silhouette.test.mjs`: authentic FID and source heights, polygon orientation, ear-clipped roof area, vertex bounds, regression/fallback.
2. Run the full repository test suite.
3. Use new same-camera WebGL2 screenshots of bridgehead street and low-flight source silhouettes; verify 3D shape and unchanged bridge/water/vehicle collisions.
4. Record additional triangles (not just call count) and software WebGL limitations. **Do not call this 1:1 NYC**.

This tiny pilot does not resolve map-wide uniform building repetition or fully replace synthetic Manhattan / Brooklyn blocks; future work must first solve coordinate and road calibration with a more complete municipal district dataset.
