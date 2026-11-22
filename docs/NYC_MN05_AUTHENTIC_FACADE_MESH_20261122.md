# NYC MN05 authentic facade mesh audit — 2026-11-22

## Purpose
The 1:1 Times Square footprint preview still renders anonymous massing blocks. This isolated child of the authentic 2014 roof-mesh source chain tests whether NYC DCP's original **Facade Surface** layer contains reusable saved Rhino Brep face meshes. It does not modify PATROL's production Manhattan map or claim photorealism.

## Original municipal source
- NYC Open Data: https://data.cityofnewyork.us/d/u5j4-zxpn
- Official 2014 MN05 source archive: https://www.nyc.gov/assets/planning/download/zip/data-maps/open-data/nyc-3d-model/nyc_3dmodel_mn05.zip
- ZIP SHA256: `71e6242c55ca7069f67c0bfd8e6d4764c9e6020a361e6bfa77880effe7520bf2`
- Original Rhino SHA256: `b41afdad1243d12858f7f446325af30667175b1eb36e9689304a4299f1c0df57`
- Horizontal source CRS: NAD83 / New York Long Island, EPSG:2263, US survey feet; projected to the same local WGS84 East/North metre anchor as the 2022 footprint and roadbed preview.
- Original model unit system must be read from the 3DM settings and must equal Rhino `Feet` before any relative Z conversion is permitted.
- The 2014 absolute vertical datum remains unverified. Relative source Z is therefore anchored per building's highest accepted source roof point to the newer 2022 OTI `HEIGHTROOF`; this is a visual alignment, not a surveyed 2014/2026 absolute elevation.

## Geometry extraction and matching
- Read only original saved `BrepFace.GetMesh(MeshType.Any)` faces from the official `Buildings::Facade Surface` layer.
- Preserve vertical triangles whose XY projection is a line; do not discard them as zero-area plan polygons.
- Split original quads only along their stored diagonal. Do not regenerate surfaces, use bounding-box lofts, or infer facades from photographs.
- Match each source facade object to one 2022 building FID by projected wall-line overlap with the true footprint boundary (1.5 m tolerance). Ambiguous shared party walls are rejected, not assigned arbitrarily.
- Require a plausible matched source roof anchor and ensure each facade's relative Z lies within the current building height envelope. Reject out-of-range faces.
- Source 2014 roof relief that exceeds the 2022 height attribute is rejected per FID. This prevents erroneous historic object matches from creating impossible roof towers.
- Only bounded, source-derived JSON and WebGL screenshots are retained as short-lived CI artifacts. The 627 MB original Rhino file is deleted in the same CI job and is never uploaded or committed.

## Fidelity and release limits
The NYC DCP metadata describes a one-time 2014 aerial model, a hybrid LOD1/LOD2 product, and approximately 100 iconic LOD2 buildings. It describes captured roof structures and separate facade/ground layers, but excludes some small roof appendages and generalized complex roofs. This is not a current 2026 facade survey or photogrammetry texture set.

This PR is **source and preview QA only**:
- no production game import, no collision, no aircraft changes, no map switch changes;
- no use of 2014 source Z as an absolute elevation;
- no claims of as-built 2026 condition or photographic/PBR facade materials;
- no hardware GPU performance claim (Chromium SwiftShader is software rendering).

Release gate: exact-head source extraction, roof/facade FID matching, source/holes/unit tests, same-camera facade ON/OFF WebGL2 screenshots, and full PATROL regression must pass. Keep Draft until the resulting counts, rejected records, screenshots, attribution, and performance impact are reviewed.
