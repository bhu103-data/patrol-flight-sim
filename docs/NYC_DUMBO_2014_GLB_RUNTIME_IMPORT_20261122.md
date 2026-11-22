# DUMBO 2014 official source mesh — GLB runtime import

Status: isolated, opt-in historical source overlay in the DUMBO 1:1 metric preview. It is not a production-map replacement.

## Imported geometry

- Source: NYC Department of City Planning, NYC 3D Model by Community District — BK02.
- Vintage: 2014 aerial survey (the published DCP metadata/readme describes the 2014 model).
- Original archive SHA-256: e16f1dae5521f02835042ac5a6a36f3750603b03170d218d7d6b9f2a616c6ff1.
- Original Rhino 3DM SHA-256: c22a7e7225425e01b5f50e5d68f6dc75b93a9d05c8a4ae566f1c1d40ec981493.
- Extracted source patches: 2,093 facade, 314 roof, 82 footprint.
- Original cached source mesh: 8,541 triangles and 13,738 vertices.
- GLB runtime asset: assets/nyc/dumbo-bk02-2014-source.glb; three material groups; 8,541 triangles.
- The viewer draws 7,475 roof/facade triangles as a translucent ghost overlay; the 1,066 footprint triangles remain in the GLB/provenance but are omitted from the overlay to keep the 2022 pavement visible.

## Coordinates and modifications

- Source XY: EPSG:2263 NAD83 New York Long Island, US survey feet.
- Rhino document Z: feet; absolute vertical datum is unverified.
- Viewer frame: DUMBO local east/up/south metres, origin WGS84 [-73.989, 40.702].
- XY is converted to the local metre frame; Z is converted from feet to relative metres from the minimum extracted source Z. This is a visual normalization, not a sea-level or terrain elevation.
- Original cached Rhino triangle topology is retained without simplification. Per-vertex normals are calculated from the cached triangles. Three flat PBR base colours are assigned by source layer; no facade textures, windows, signage or advertising are fabricated.
- The 2014-to-2022 match report records 41 unique one-to-one assignments; it also classifies 42 candidates as low-overlap/changed and 6 as having no overlap. A diagnostic translation of +3.5022m east / -0.4438m south makes 34 samples high-confidence, but that translation has not been independently verified and is NOT applied. Do not treat this report as a current building-ID map.

## Runtime behavior and safety

- Open tools/nyc/dumbo-metric-preview.html and click “2014 source mesh” or press M.
- The 2014 mesh is a visual-only historical layer. It does not participate in collision, aircraft physics, road routing or current building replacement.
- Existing collision remains the 48-building 2022 OTI roof-prism camera safety model. The source layer must not change its building count, spawn, sweep results or flight controls.
- The original 2022 OTI building massing, 2022 Front/Dock roadbed, official CSCL centerline guides and F low-flight camera remain intact.
- Browser CI uses SwiftShader for functional WebGL evidence only. It is not native GPU P50/P95 performance proof.

## Data use and attribution

This is not CC0 and is not presented as a Creative Commons-licensed asset. The NYC Open Data public-data policy states that public datasets are available without restrictions or licensing requirements and asks users to identify the source, version and modifications when republishing or incorporating data into an application. The project records those details in assets/nyc/dumbo-bk02-2014-source-provenance.json.

Attribution: Source: NYC Department of City Planning, NYC 3D Model by Community District — BK02, 2014 aerial survey, via NYC Open Data. Modified by PATROL: bounded roof/facade/footprint cached-mesh extraction, EPSG:2263 US survey foot XY conversion to local DUMBO metres, Rhino Z conversion to relative metres, GLB 2.0 packaging, calculated normals and visualization-only material colours.

Official references:
- https://data.cityofnewyork.us/stories/s/Terms-of-Use/k9k7-3cje
- https://www.nyc.gov/opendata/get-started/FAQs
- https://cityofnewyork.github.io/opendatatsm/publicpolicies.html
- https://www.nyc.gov/assets/planning/download/pdf/data-maps/open-data/nyc-3d-model-metadata.pdf

The City disclaims warranties of completeness, accuracy, content and fitness. This 2014 model is not a 2026 as-built model; its vertical datum is unverified; do not use it for collision, navigation clearance or altitude claims.
