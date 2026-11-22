# NYC MN05 — official 2014 roof/facade model import

## Runtime import
The opt-in NYC TRUE-SCALE WebGL2 viewer now loads
`assets/nyc/nyc-mn05-2014-source-mesh.json`. The asset is generated from the
official NYC Department of City Planning **NYC 3D Model by Community District**
MN05 Rhino model (2014 aerial-survey vintage), not from an AI-generated or
third-party mesh.

Source dataset: https://data.cityofnewyork.us/d/u5j4-zxpn
Official metadata: https://www.nyc.gov/assets/planning/download/pdf/data-maps/open-data/nyc-3d-model-metadata.pdf
NYC Open Data terms: https://opendata.cityofnewyork.us/overview/

## Import pipeline and provenance
- Original archive: `nyc_3dmodel_mn05.zip`, SHA-256
  `71e6242c55ca7069f67c0bfd8e6d4764c9e6020a361e6bfa77880effe7520bf2`.
- Original Rhino file: `NYC_3DModel_MN05.3dm`, SHA-256
  `b41afdad1243d12858f7f446325af30667175b1eb36e9689304a4299f1c0df57`.
- Original model is EPSG:2263 US survey feet in XY; the Rhino document reports
  Feet. The pipeline uses the original saved Brep face render meshes
  (`BrepFace.GetMesh(MeshType.Any)`), not reconstructed bounding boxes,
  fan triangulations or regenerated NURBS faces.
- Roof meshes are matched to current 2022 NYC Building Footprint FIDs with
  at least 0.60 area overlap. Current 2022 HEIGHTROOF anchors display height;
  the original 2014 per-building roof relief is preserved.
- Facade meshes are matched to one 2022 footprint boundary with at least
  0.65 coverage and no more than 1.5m boundary distance. Ambiguous shared
  party walls are rejected. Relative 2014 Z is anchored to the same-FID
  source roof and current HEIGHTROOF.
- The 627MB source 3DM and 80MB ZIP are downloaded only in CI and deleted;
  only the bounded matched source triangles and provenance are committed.

## Runtime behavior
- The true-scale scene transforms source-local east/north coordinates into the
  current WGS84 local-metre frame; it does not scale the model to fit the old
  compressed game map.
- Matched 2014 roof meshes replace the flat programmatic roof caps for those
  FIDs. Matched 2014 facade triangles are rendered over the current footprint
  wall fallback; illustrative window panels are suppressed for those FIDs.
- The 2014 geometry is **visual-only**. Existing 2022 footprint prisms remain
  authoritative for building collision, flight clearance and route logic.
- `?historical=off` disables the imported meshes for a same-camera A/B.
- The model is historical 2014, not a 2026 as-built survey. The absolute
  vertical datum is unverified. No claim of absolute altitude, complete facade
  coverage, photoreal texture or full Manhattan coverage is made.
- Source layer colors/materials were not embedded in the extracted mesh
  package; the viewer uses restrained neutral display colors. Authentic PBR
  textures are a separate license/source task.

## Initial bounded coverage
The reviewed extractor preview produced 1,974 saved roof triangles across
33 matched 2022 FIDs and 540 saved facade triangles across 30 matched FIDs.
The workflow re-extracts and revalidates these numbers from the exact original
archive before committing the runtime JSON. Any count/source/hash mismatch
fails closed.

## Acceptance gates
- Python source-geometry and CRS tests.
- Node asset schema, source identity, match thresholds and metre-frame tests.
- Browser WebGL2 same-camera model ON/OFF pixel-difference test.
- Existing NYC 1:1 source-building, DCM road, OTI roadbed, WGS84 camera and
  C185-derived optional airborne smoke.
- Native GPU performance, 2026 building-change review, absolute vertical
  datum and full-city coverage remain open; SwiftShader is not native FPS.
