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

## Independent façade-depth follow-up (not survey openings)

On the stacked `feat/nyc-dumbo-oti-deep-reveals-20261122-chat` branch only, each original polygon exterior wall is split into masonry strips **around** its original lightweight window bays. Glass planes now sit 0.18 PATROL units inward from the source-derived exterior, with four actual 3D return faces (left jamb, right jamb, sill and header) per opening. Each pilot also gains one **original authored**, inward-facing entry bay on a bounded long edge, preferably south-facing. This is a readability/detail treatment, **not** an NYC-measured window/door location or surveyed floorplan.

Deterministic execution of the production helper generated **45/33/51 windows** and **one door per source FID**, with **441/336/455 total quads** and unchanged **9/9/8 roof triangles**. All vertices stayed within each original worker collider envelope (including its 0.12-unit parapet allowance); no street/water/collision/height/aircraft logic, texture fetch, draw call or source WGS84 record was changed. The higher polygon budget requires exact-head real WebGL2 screenshots and frame-pacing review before merge; source-only geometry tests are not enough to claim visual or native GPU FPS success.

## QA gates

1. `node --test tests/nyc-dumbo-oti-source-silhouette.test.mjs`: authentic FID and source heights, polygon orientation, ear-clipped roof area, vertex bounds, regression/fallback.
2. Run the full repository test suite.
3. Use new same-camera WebGL2 screenshots of bridgehead street and low-flight source silhouettes; verify 3D shape and unchanged bridge/water/vehicle collisions.
4. Record additional triangles (not just call count) and software WebGL limitations. **Do not call this 1:1 NYC**.

This tiny pilot does not resolve map-wide uniform building repetition or fully replace synthetic Manhattan / Brooklyn blocks; future work must first solve coordinate and road calibration with a more complete municipal district dataset.

## FID 1080628 — bounded two-tier non-box roof detail (Draft 2026-11-22)

This one-building live-game experiment stacks on #204; it does not adopt the
48-building metre-scale preview from #243 and does not alter official WGS84
ring vertices, FID, BIN, or height. **Not a claimed surveyed 3D rooftop.**

- **Sourced planar truth:** `FID 1080628 / BIN 3389054 / HEIGHT_ROOF 121 ft`,
  12 original WGS84 vertices (11 distinct game vertices after near-duplicate
  cleanup); original source shape is concave/non-rectangular and preserved.
  The minified in-game polygon roof has area approximately 59.7244 squared
  PATROL units, not a rectangular 9×14.42 box cap.
- **New original roof treatment:** clip the *existing official source polygon*
  into two nonoverlapping north/south planar fields at `source.target[1]`.
  Their combined projected area must exactly equal the official source ring
  after the existing conservative game-envelope projection. Lower one roof
  field by 0.64 PATROL units, add a true vertical seam wall and a coping plane,
  and add two actual stone stringcourse faces along each eligible long
  exterior facade edge. **The clip line and 0.64 drop are authored geometric
  interpretation, not an official roof-ridge survey or measured real setback.**
- **Non-regression:** same source WGS84 outline and `HEIGHT_ROOF`, same
  `matchingDumboOtiPilot` LOD3/normal-graphics/city-only gate, same
  building collider and no changes to bridges/roads/floatplane/other maps;
  no new texture, GLB, image source, script dependency or draw call.
  The two other source FIDs keep their unchanged roof representation.
- **Capture:** use the workflow `nyc-dumbo-fid1080628-roof.yml` for
  fixed noon/clear source-verified production flight A-B-B-A at FID roof and
  OTI street cameras; record framebuffer, first load and rAF p50/p95, plus
  native WebGL2 PNG screenshots. SwiftShader rAF **does not** demonstrate
  consumer GPU FPS. Do not approve based only on source or unit tests.

Official additional **2014 survey roof facets** are available from
[NYC 3-D Building Model](https://data.cityofnewyork.us/d/tnru-abg2)
and [Brooklyn CD02 Rhino model](https://www1.nyc.gov/assets/planning/download/zip/data-maps/open-data/nyc-3d-model/nyc_3dmodel_bk02.zip),
but the per-FID roof surfaces have **not yet been extracted, matched and
validated**. Their model's LOD1.5 generalization omits small appendages.
**Next geospatial acceptance gate:** extract the specific BIN/roof layers,
map 2014 projected coordinates to original polygon, check survey date/changes,
then replace the authored tier if contradicted. NYC's 2014 survey cannot be
presented as a current 2026 scan.

Data rights: NYC OTI BUILDING_view (City of New York, Open Data Terms,
https://opendata.cityofnewyork.us/overview/), reviewed in PR #189/#192.
New roof split/stone detail authored in PATROL; not copied from third-party photos.

## Identity correction for FID 1080628 / BIN 3389054 — **Nexus**, not a warehouse (2026-11-22)

The earlier pilot and the first roof PR version incorrectly described this
specific FID as a historic **brick warehouse**. The official BIN resolves to
**84 Front Street, DUMBO, Brooklyn** (BBL 3000517501). Its original designer,
Meltzer/Mandl Architects, documents the project **The Nexus** as completed
2006, **12 stories**, with yellow brick and green/blue/silver panelized
cladding, not uniform nineteenth-century masonry.

Independent references (facts/style only, **no photos or proprietary
models copied into this game**):
- NYC BIN lookup / address: https://buildnyc.ai/building/84-front-street-3389054
- Architect's first-party project: https://archinect.com/meltzermandl/project/the-nexus
- Contemporary architecture documentation:
  https://www.archpaper.com/2005/07/all-rise-2/
- Official city roof/footprint fields and license remain the existing NYC OTI
  BUILDING_view https://data.cityofnewyork.us/d/5zhs-2jue
- **Official 2014 3D model limitations:** NYC OTI metadata documents mostly
  LoD1 prismatic geometries and about 100 iconic LoD2 structures; it does
  not certify an actual rooftop sub-facet for BIN 3389054. See
  https://github.com/CityOfNewYork/nyc-geo-metadata/blob/main/Metadata/Metadata_3DBuildingModel.md

### Corrected actual in-game mesh (still non-georeferenced)
The same 11-corner polygon game-fit shell now renders **12 authored
storey-level glazing rows** / 108 physically inset window panes with
four return faces per pane, plus **40 distinct shallow metal cladding
panels** raised over existing polygon-edge spandrels. The alternating
colors are restrained stylization of documented blue, green and silver
metal panel families plus yellow brick; exact panel coordinates, window
openings, rooftop centerline, floor levels and materials are *not*
licensed architectural plans or 2014 photogrammetric geometry.

At the preserved site geometry: **1,056 original game mesh quads
+ 11 roof triangles**, still one city mesh batch, no new texture/GLB.
Other two official FIDs remain 336/455 quads and 9/8 roof triangles.
Before this identity correction the same FID was 449 quads and 11
roof triangles (5 display floors, 45 windows). The increase is
**+607 quads = +1,214 renderer triangles** in this one LOD3-only lot.
Compared to original parent #204 (441 quads, 9 roof triangles) the
total is **+1,232 triangles**. No native GPU frame savings claimed.

**Not yet copied from measured plans:** architect describes an upper-floor
setback, but source OTI polygon + HEIGHT_ROOF do not give that inset
boundary. The earlier clipped two-plane roof is still an **authored
placeholder**, not an accurate eighth-floor setback. Never call the
building a historical warehouse in the merged scene.
