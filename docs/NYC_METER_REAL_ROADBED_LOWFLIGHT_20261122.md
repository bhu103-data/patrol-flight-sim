# PATROL New York: verified 2022 OTI roadbed within true-metre flythrough

**Status: standalone source-aligned WebGL2 pilot, NOT production flight map.
2026 photographic realism still FAIL.**

## Source chain and why this is different
- Parent #234: official NYC DCP DCM 1:1 metre centerlines plus municipal
  Times Square building footprints (118 rendered masses, 39 DCM road records).
- #247: official-road low-flight camera and continuous obstacle detection
  against 118 municipal source building outlines.
- #250/#251: historical TUM/NYC EPSG:32118 median GML; remains opt-in OFF.
- **Existing independent #244, reused unchanged**: NYC Office of
  Technology & Innovation **ROADBED 2022** polygon FeatureServer layer 20:
  https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Roadbed_2022/FeatureServer/20
  NYC dataset terms: https://data.cityofnewyork.us/stories/s/Terms-of-Use/k9k7-3cje
  2022 Manhattan imagery, not a November 2026 field survey.
  The approved reader and source tests are ported exactly from #244; no
  invented constant-width tarmac strip is used as the default image.

## Actual new integration
- Exact same local WGS84 tangent metre origin as the source buildings and
  DCM road lines. Hard-fails if source origins differ.
- Reuses original #244 ring/hole geometry, with published SUB_FEATURE_CODE
  metadata preserved; Earcut source-area deviation <=0.0005, and finite
  vertex/triangle checks. The source QA run reported 81 real road polygons,
  including 22 actual intersection polygons; 8,552 usable triangles after
  rejecting 88 near-zero-area triangles.
- In the **standalone source WebGL scene only**, official 2022 roadbed
  surfaces render ON by default. A checkbox can disable them and another
  checkbox can show the previous **unverified street ROW width hint**; ROW
  hints are OFF by default to avoid fake asphalt and double geometry.
- The 2015–2017 TUM painted median remains a distinct source-verified
  toggle, also OFF by default; mixing time periods is visibly labeled.
- Low-flight W/S/A/D Q/E / Shift camera and building polygon sweep remain.
  This does NOT introduce real aircraft physics, traffic lanes, signal
  timing, route permission, or physical road colliders.
- Browser QA captures **the same camera** with 2022 OTI pavement OFF then
  ON and asserts different WebGL canvas PNG hashes; it also retains TUM
  historic-layer A/B and input-driven street-height/flight screenshots.
- A roadbed triangle-centroid audit against the 118 source building
  footprints must find **zero** triangles inside building footprints.
  This is one numerical screen: it is NOT a full 3-D road/facade intersection
  proof and does not substitute for fixed-camera visual review.

## Limits and follow-on 3D asset work
Buildings in this source preview are *polygon extrusions with flat roofs*
rather than true published roof structures or licensed facade
photogrammetry. The citywide official NYC 3-D Building Model is a 2014
aerial snapshot, largely hybrid LOD1/2, not a current 2026 detailed facade
database. See:
https://github.com/CityOfNewYork/nyc-geo-metadata/blob/main/Metadata/Metadata_3DBuildingModel.md

**Next true visual priority:** import a **bounded, licensable 2014 3-D
roof/wall model** with verified CRS (the NYC 3-D model uses EPSG:2263) and
correct vertical datum; explicitly reconcile against the 2022 roadbed
and current 2026 building inventory. Use official source ID lookup,
time-accurate replacements for new/rebuilt roofs, and 2–3 registered
WGS84 photo camera comparisons. Do not add random procedural windows
and call them surveyed. Keep production NYC untouched until coherent
street+building+collision+airport/flight integration passes independent QA.

## Reproduce exact-head CI
The workflow
`.github/workflows/nyc-times-true-scale-flight.yml` obtains real
NYC DCM and OTI roadbed data, actual TUM historical CityGML, triangulates
OTI roadbed with `earcut@3.0.1`, serves the new source viewer, and performs
Node regression plus Chromium WebGL screenshot/camera/flight acceptance.

`main`, shared integration, PR #244 and #248 are not modified.
No background data scraper, unauthorized imagery or paid API used.
