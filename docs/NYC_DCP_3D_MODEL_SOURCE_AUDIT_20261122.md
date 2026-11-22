# NYC DCP Manhattan CD5 2014 3D model — source audit

## Why this source is being inspected

The Times Square 1:1 scene still has simple extruded building volumes. NYC DCP
publishes a 2014 3D building model by community district. The official model is
a hybrid LOD1/LOD2 dataset; the published metadata describes distinct building
footprint, roof, facade and surface layers, with a limited set of iconic
buildings receiving LOD2 treatment. It may provide genuine roof/facade geometry
to replace selected box-like volumes, but it is not assumed to contain
photographic facade textures, windows or storefronts.

This is a **source inspection only**. No model geometry is enabled in PATROL by
this PR, and the raw district model is not committed to the repository.

## Source, age, terms and attribution

- Publisher: NYC Department of City Planning / NYC Open Data.
- Dataset: NYC 3D Model by Community District.
- District file: [Manhattan CD5 model](https://www1.nyc.gov/assets/planning/download/zip/data-maps/open-data/nyc-3d-model/nyc_3dmodel_mn05.zip).
- Metadata: [NYC 3D Building Model metadata](https://github.com/CityOfNewYork/nyc-geo-metadata/blob/master/Metadata/Metadata_3DBuildingModel.md).
- Terms: [NYC Open Data Terms of Use](https://data.cityofnewyork.us/stories/s/Terms-of-Use/k9k7-3cje).
- Model vintage: 2014 one-time capture; not a current 2026 building survey.
- Attribution to NYC Department of City Planning and identification of source
  version/modifications are retained. NYC Open Data does not warrant accuracy
  or completeness; dataset-specific provider terms still apply.

The source audit uses the same bounded Times Square WGS84 envelope as the
2022 OTI surface pilot:

    [-73.9900, 40.7552, -73.9822, 40.7610]

The audit transforms that envelope to EPSG:2263 (NAD83 / New York Long Island,
US survey feet) and counts model objects intersecting it.

## What the audit records

- Original ZIP and 3DM byte sizes and SHA-256 hashes.
- Rhino model unit system.
- Layer names and object counts for building footprint, rooftop, facade,
  surface roof, surface footprint and surface facade layers.
- Geometry types and mesh/Brep face counts.
- Objects intersecting the Times Square envelope.
- Any available BIN, DOITT_ID and SOURCE_ID user strings.
- A bounded sample of object metadata and bounding boxes.

Only the compact audit report is uploaded as a GitHub Actions artifact. The raw
district model is downloaded to the ephemeral runner and is not redistributed
by this PR.

## Integration gate

Do not integrate the model unless the audit proves:

1. Times Square building layers are present in the Manhattan CD5 model.
2. The actual Rhino model unit system and EPSG:2263 coordinate interpretation
   agree with the published metadata.
3. Surface roof/facade geometry can be mapped to existing official building
   footprints or stable source identifiers without arbitrary nearest-box joins.
4. Selected geometry can be converted to a bounded GLB with a measured
   triangle/texture budget and without losing roof holes or facade topology.
5. The source license/terms and attribution are recorded beside any extracted
   asset.

If the model only provides blank facade planes, it may improve rooflines and
building silhouettes but does not solve storefront/window/LED realism. The
2022 OTI roadbed/plaza/sidewalk data remains the separate ground-surface source;
the 2014 3D model is not used for current roads, traffic access, collision or
surveyed elevation.
