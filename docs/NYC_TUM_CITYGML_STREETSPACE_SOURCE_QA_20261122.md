# NYC TUM CityGML street-space source QA

## Goal

Evaluate a larger, source-backed street-space dataset for the separate 1:1 Times Square flythrough. This is a **research/QA pipeline only**. It does not import data into PATROL runtime, change road collision, replace the current DCM centerline sample, or alter the production Manhattan map.

## Source and provenance

- Project: TUM Chair of Geoinformatics, 3D City Model of New York City
- Project page: https://www.asg.ed.tum.de/gis/projekte/new-york-city-3d/
- Workbench repository: https://github.com/tum-gis/3d-model-new-york-city
- Source lineage: NYC Open Data Portal. TUM states the dataset is provided for free usage, NYC Open Data terms apply, and copyright remains with the original NYC dataset providers.
- No SPDX license identifier or CC0 dedication is asserted. Preserve original provider references and attribution.
- NYC Open Data's FAQ says there are no restrictions on use of Open Data; the NYC Open Data technical standards note that DoITT may require source, version and modification identification when data is republished or incorporated into an application. Preserve TUM's per-object external references, the original NYC agency dataset links, source vintage and any PATROL transformations. See https://www.nyc.gov/opendata/get-started/FAQs and https://cityofnewyork.github.io/opendatatsm/publicpolicies.html.

## Bounded archives in this QA

| Dataset | Archive | Published compressed size |
|---|---|---:|
| Roadbeds | `NYC_CityGML_LoD2_Roadbed.zip` | 134.9 MB |
| Intersections | `NYC_CityGML_LoD2_Intersection.zip` | 7.9 MB |
| Road markings / median painted | `NYC_CityGML_LoD2_Median_Painted.zip` | 3.9 MB |

Not downloaded in this pilot: the 2.4 GB all-buildings archive, 1.3 GB sidewalks, 2.02 GB curbs, and other citywide classes. They are separate follow-up candidates.

## Times Square ROI

WGS84 bbox derived from the already-present official NYC footprint sample, with a surrounding buffer:

`[-73.991040, 40.753539, -73.981483, 40.761460]`

The pipeline records archive SHA-256, GML layer names, actual source CRS, geometry types, source/ROI feature counts, vertex counts, extents, geometry validity, projected areas and area-attribute comparisons. It converts only intersecting features to GeoJSON.

## First exact source run

The initial bounded extraction completed with:

- Roadbed: 96 ROI features / 12,662 vertices; source layer has 72,580 features.
- Intersection: 38 ROI features / 685 vertices; source layer has 22,854 features.
- Median painted / road markings: 21 ROI features / 210 vertices; source layer has 7,826 features.
- All three layers are `MultiPolygonZ` in **EPSG:32118 — NAD83 / New York Long Island (metres)**.
- All emitted Z values are 0.0. The source road-space objects are not terrain-draped.
- Local Shapely 2.1.2 review found all 155 emitted polygons valid and non-empty.
- Intersection area attributes match projected geometry within 5% for 38/38 features; median-painted area attributes match for 21/21. Roadbed area attributes match within 5% for 74/96; retain these outliers for source-feature review rather than silently discarding them.

The archive checksums and complete per-feature output are retained in the Actions artifact.

## Current 2026 road-network cross-check

The workflow also queries the NYC Open Data CSCL endpoint for the same ROI. CSCL is updated weekly and the October 31, 2026 release reported 122K rows. The report compares TUM roadbed centroids with the nearest current CSCL lines and records street-name, physical-ID and traffic-direction matches.

TUM/LION direction codes map as follows, based on the official LION/CSCL metadata:

- `W` = with segment direction → CSCL `FT`
- `A` = against segment direction → CSCL `TF`
- `T` = two-way → CSCL `TW`
- `P` = pedestrian/non-vehicular → CSCL `NV`

The mapping is a QA comparison only; do not use 2016 TUM traffic attributes as current vehicle-routing truth.

## First-run current-CSCL reconciliation and spatial-match correction

The first exact source artifact (Actions run `45061998734`, artifact `14769459548`) successfully downloaded all three archives, extracted the Times Square ROI, and completed the CSCL comparison calculations. The run was marked failed only because the final report gate read a nonexistent `featureCount` key; the comparison helper actually returns `featureCountIntersectingExactRoi`. A child fix adds a regression test for that report contract.

Independent review of the retained first-run artifact found 96 TUM roadbed-to-CSCL comparisons:
- Street-name match: 96/96.
- Physical-ID candidate exists: 90/96.
- Direction-code agreement: 95/96.
- 2016 TUM total-lane count agrees with current CSCL: 68/95 (71.6%); treat the TUM lane count as stale.
- Original physical-ID matching had four spatial outliers above 10m: West 44th, 45th, 46th and 47th Streets. The 2016 TUM physical-ID segmentation does not always align with current CSCL segment splits.

A narrowly bounded fallback is now added: when a TUM physical-ID candidate is more than 10m from the roadbed centroid, and a same-normalized-name CSCL segment is closer, the comparison selects the closer same-name segment while preserving the original physical-ID candidate distance and mismatch flag. Recalculation against the retained first-run artifact reduces the selected-match centroid distance from p50/p95/max **0.777 / 8.760 / 109.188m** to **0.765 / 3.534 / 8.962m**; all 96 selected matches are then within 10m. The four ID mismatches remain explicitly counted, not hidden. The updated exact-head workflow rerun reproduced these results: run `45064002794` completed successfully and produced artifact `14769743909`. The report status is `pass`, with no errors and three explicit source-quality warnings. The physical-ID fallback, exact-ROI count contract, and current-CSCL comparison are therefore CI-verified on the child PR head.

The 2016-vs-current lane disagreement and the 22/96 roadbed area-attribute outliers remain source-quality warnings. This does not authorize TUM lane routing or runtime geometry import.

## Exact-head TUM 2016 vs OTI 2022 geometry crosswalk

A separate child QA workflow fetched the official NYC OTI `Roadbed_2022/FeatureServer/20` layer for the same ROI and compared it to the TUM CityGML polygons in **EPSG:32118 metres**. Exact-head evidence: PR #326 HEAD `e64740ba`, Actions run `45065035899`, artifact `14770054332`. The source QA, PATROL regression and Cosmos workflows all passed.

The OTI query returned 134 features in the ROI: **96 roadbed (350000)** and **38 intersection (350010)**. TUM returned the same 96 roadbed and 38 intersection features. All compared geometries were valid and non-empty; neither source had zero-area ROI clips.

| Comparison | Roadbed | Intersection |
|---|---:|---:|
| TUM union area | 130,376.524 m² | 9,675.012 m² |
| OTI 2022 union area | 132,484.074 m² | 9,542.823 m² |
| Intersection area | 122,092.231 m² | 8,781.740 m² |
| TUM coverage by OTI | 93.646% | 90.767% |
| OTI coverage by TUM | 92.156% | 92.025% |
| Intersection over union (IoU) | **86.733%** | **84.148%** |
| Centroid distance p50 / p95 / max | 0.926 / 4.628 / 9.857 m | 0.926 / 1.433 / 1.841 m |

All 96 TUM roadbeds and all 38 TUM intersections intersect the corresponding OTI union. Polygon-to-nearest-OTI distance is 0m at p50, p95 and max for both classes, indicating that the source polygons touch or overlap even where centroids differ.

**Decision:** OTI 2022 is the newer planimetric source and should be the primary roadbed/intersection shape source for this bounded sample. TUM is useful as a historical semantic/source cross-reference, not as a replacement for the 2022 shapes or as current traffic truth. The high XY overlap does not supply road elevation: OTI is planimetric, while TUM street-space Z is 0m and not terrain-adapted. It does not authorize runtime import, road collision, lane routing or traffic simulation.

## Known limitations from the source publisher

- The model is a 2015–2017-era generation, not a 2026 as-built survey.
- TUM documentation states street-space objects currently have a 0 m base height and are not adapted to terrain.
- TUM warns that automatically generated street-space objects can be faulty in complex scenarios.
- The 2016 street-width, lane-count and traffic-direction attributes may be stale; use current CSCL for direction and road type.
- The CityGML geometry is not automatically equivalent to current drivable pavement, surveyed curb heights, live lane closures, traffic-signal locations or legal flight clearance.

## Acceptance gates before any runtime import

1. Download and archive integrity pass; record SHA-256.
2. GDAL reads every relevant CityGML layer and reports its actual CRS.
3. Roadbed and intersection layers return non-empty Times Square ROI features.
4. Preserve original GML IDs and source attributes; do not deduplicate by segment ID alone.
5. Validate ring closure, polygon validity, duplicate/overlapping surfaces and source area discrepancies.
6. Reconcile street-space XY against current OTI footprints/centerlines; report residuals and conflicts.
7. Establish a terrain/vertical alignment method before assigning road elevations.
8. Convert only the bounded ROI to a compact, source-attributed format; measure vertices, triangles, first-load and WebGL frame cost.
9. Keep `runtimeImportAllowed=false` until the above checks and visual A/B review pass.

## Current decision

Candidate worth testing for more complete roadbeds, intersections and median markings. **Not yet approved for runtime import.** This PR must remain Draft until the updated CSCL comparison and topology/vertical review are inspected.
