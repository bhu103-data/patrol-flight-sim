# NYC: live full-tile OTI 2022 surfaces in the 1:1 Times Square viewer

**Status: isolated Draft QA branch.** This extends the opt-in NYC true-scale flight reference viewer. It does not modify the default Manhattan game map, aircraft physics, traffic, collision, map switching, Alaska, Vegas or Chongqing. It is not a photoreal or 2026 as-built acceptance.

## What is now rendered

The viewer requests the original public NYC OTI ArcGIS GeoJSON at page runtime and triangulates it locally. It does not check the downloaded municipal geometry into the repository.

| Layer | Official OTI source | Verified tile count |
|---|---|---:|
| Roadbed polygons | [Roadbed_2022 /20](https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Roadbed_2022/FeatureServer/20) | 81 features, including 22 intersections |
| Plaza polygons | [Plaza_2022 /16](https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Plaza_2022/FeatureServer/16) | 17 |
| Sidewalk polygons | [Sidewalk_2022 /22](https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Sidewalk_2022/FeatureServer/22) | 54 |
| Curb polylines | [Curb_2022 /4](https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Curb_2022/FeatureServer/4) | 201 features |
| Curb-cut polylines | [Curb_Cut_2022 /5](https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Curb_Cut_2022/FeatureServer/5) | 217 features |

The bounded query is WGS84 [-73.9900, 40.7552, -73.9822, 40.7610]. Each source coordinate is transformed to the existing viewer's TIMES_SQUARE_ORIGIN east/north metre frame before mesh creation. One world unit remains one metre. Source OBJECTIDs are retained in the QA report.

## Geometry and rendering rules

- Polygon holes are triangulated with vendored Mapbox Earcut v3.0.2 (ISC); the original license is included at assets/nyc/vendor/EARCUT-LICENSE.txt.
- Earcut deviation is checked at <= 0.0005; degenerate triangles are counted and excluded. No polygon is replaced by a rectangle or triangle fan.
- The full official roadbed mesh replaces the old 11-FID subset when the full source fetch succeeds. All guessed DCM-width asphalt bands are suppressed in that mode; DCM centerline audit traces remain.
- Roadbed, sidewalk, plaza, curb and curb-cut layers have separate visibility controls.
- The render-only Y offsets are roadbed -0.075m, sidewalk 0.10m, plaza 0.12m, curb 0.16m, and curb-cut 0.18m. They only separate drawing layers. They are **not** measured road elevation, curb rise, ramp slope or vertical datum.
- Curb source Z is not consumed. No collision, route, lane, traffic-light or accessibility semantics are inferred from these planimetric features.

## Rights and provenance

Sources are queried directly from NYC OTI at runtime. No raw OTI feature collection or compiled full-tile mesh is committed by this change. See the [NYC Open Data Terms of Use](https://data.cityofnewyork.us/stories/s/Terms-of-Use/k9k7-3cje): the City disclaims warranties of completeness, accuracy and fitness for purpose, and additional agency terms may apply. This document does not assert a blanket redistribution license.

All planimetrics are from 2022 imagery, not a November 2026 field survey. The 2022 roadbed outlines do not prove current vehicle access, legal lane usage, signal phases, pavement material or present-day construction.

## Known source conflict — preserved, not silently repaired

Independent source-topology QA on the same bounded tile reports zero roadbed/building overlap and zero roadbed/sidewalk overlap, but **29.492 m² of sidewalk/building footprint overlap**. This viewer preserves the source geometries and reports the conflict; it does not move or delete municipal features. The separate #279 visual-only sidewalk display mask is not silently applied here.

## QA acceptance

The PR workflow must prove:

1. Source URLs, pagination, unique OBJECTIDs, WGS84 conversion, polygon holes and triangle-area deviation.
2. At least 70 roadbeds, 5 plazas, 40 sidewalks, 150 curbs and 150 curb cuts; plus the measured triangle/segment budget.
3. Browser WebGL2 loads all five official layers, renders separate meshes, suppresses guessed asphalt bands, and captures same-camera layer on/off evidence.
4. The existing 3.2m street-eye spawn, 1.2m building clearance, movement, optional C185 subset and cross-map/game regressions remain intact.

SwiftShader validates browser rendering logic only; it is not native GPU performance evidence. The viewer remains a separate reference experiment, not the default PATROL game map.
