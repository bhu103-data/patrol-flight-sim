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
- Exact DCP layers: Building_FootPrint, Building_RoofTop, Building_Facade,
  FootPrint Surface, RoofTop Surface and Facade Surface.
- Geometry types, Brep face counts and cached render-mesh availability.
- Objects intersecting the Times Square envelope.
- Any available BIN, DOITT_ID and SOURCE_ID user strings.
- A bounded sample of surface objects and their bounding boxes.

Only the compact audit report is uploaded as a GitHub Actions artifact. The raw
district model is downloaded to the ephemeral runner and is not redistributed
by this PR.

## First source inspection findings

The initial audit successfully downloaded the official MN05 archive (77 MB
compressed; 627 MB extracted) and read the 3DM model. The file contains
233,503 Rhino objects, of which 19,908 intersect the Times Square pilot tile.
The tile contains 9,383 Brep objects, so the source is substantially richer
than the 118 simplified extrusions in the current 1:1 scene.

The model's actual layer names are:

- Linework: Building_FootPrint, Building_RoofTop, Building_Facade.
- Brep surfaces: FootPrint Surface, RoofTop Surface, Facade Surface.

No BIN, DOITT_ID or SOURCE_ID user strings were found on the sampled
intersecting objects. Any building association therefore needs a deterministic
spatial/footprint match, not a guessed ID join. The Rhino file reports
UnitSystem.Feet while the published coordinate reference is EPSG:2263
(US survey feet); the transform must be verified before export.

The follow-up audit now samples cached Brep render meshes using
rhino3dm.BrepFace.GetMesh(MeshType.Any). If cached meshes are absent,
rhino3dm alone cannot mesh these Breps; a separate, license-verified
tessellation path is required before any geometry can be integrated.

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
