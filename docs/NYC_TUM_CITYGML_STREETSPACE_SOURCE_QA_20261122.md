# NYC TUM CityGML street-space source QA

## Goal

Evaluate a larger, source-backed street-space dataset for the separate 1:1 Times Square flythrough. This is a **research/QA pipeline only**. It does not import data into the game, change road collision, replace the current DCM centerline sample, or alter the production Manhattan map.

## Source and provenance

- Project: TUM Chair of Geoinformatics, 3D City Model of New York City
- Project page: https://www.asg.ed.tum.de/gis/projekte/new-york-city-3d/
- Workbench repository: https://github.com/tum-gis/3d-model-new-york-city
- Source lineage: datasets from the NYC Open Data Portal; TUM says the data is supplied for free usage, NYC Open Data terms apply, and copyright remains with the original NYC dataset providers.
- No SPDX license identifier or CC0 dedication is asserted. Preserve original provider references and attribution.

## Bounded archives in this QA

| Dataset | Archive | Published compressed size |
|---|---|---:|
| Roadbeds | `NYC_CityGML_LoD2_Roadbed.zip` | 134.9 MB |
| Intersections | `NYC_CityGML_LoD2_Intersection.zip` | 7.9 MB |
| Road markings / median painted | `NYC_CityGML_LoD2_Median_Painted.zip` | 3.9 MB |

Not downloaded in this pilot: the 2.4 GB all-buildings archive, 1.3 GB sidewalks, 2.02 GB curbs, and other citywide classes. They are separate follow-up candidates.

## Times Square ROI

WGS84 bbox derived from the already-present official NYC footprint sample, with a small surrounding buffer:

`[-73.991040, 40.753539, -73.981483, 40.761460]`

The pipeline records the actual source CRS, layer names, geometry types, source feature counts, ROI feature counts, vertex counts, extents, archive SHA-256 and converted GeoJSON byte sizes. The output is an Actions artifact, not a committed runtime asset.

## Known limitations from the source publisher

- The model was generated from earlier NYC Open Data snapshots (project-era 2015–2017), not a 2026 as-built survey.
- TUM documentation states that street-space objects currently have a 0 m base height and are not adapted to terrain.
- TUM warns that automatically generated street-space objects can be faulty in complex scenarios.
- The CityGML geometry is not automatically equivalent to current drivable pavement, surveyed curb heights, live lane closures, traffic-signal locations or legal flight clearance.

## Acceptance gates before any runtime import

1. Download and archive integrity pass; record SHA-256.
2. GDAL reads every relevant CityGML layer and reports its actual CRS.
3. Roadbed and intersection layers return non-empty Times Square ROI features.
4. Preserve original feature identifiers and attributes; do not silently snap conflicting geometry.
5. Validate ring closure, polygon validity, duplicate/overlapping surfaces and vertical coordinate semantics.
6. Reconcile street-space XY against current OTI footprints/centerlines; report residuals and conflicts.
7. Establish a terrain/vertical alignment method before assigning road elevations.
8. Convert only the bounded ROI to a compact, source-attributed format; measure vertices, triangles, textures, first-load and WebGL frame cost.
9. Keep `runtimeImportAllowed=false` until the above checks and visual A/B review pass.

## Current decision

Candidate worth testing for more complete roadbeds and intersections. **Not yet approved for runtime import.** This PR must remain Draft until the CI artifact has been inspected and source CRS/feature topology/vertical behavior are understood.
