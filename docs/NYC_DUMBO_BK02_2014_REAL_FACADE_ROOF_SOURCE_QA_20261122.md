# NYC DUMBO — official BK02 2014 roof/facade geometry source gate

**Purpose:** inspect genuine municipal roof and facade geometry for the existing 48-building DUMBO metric AOI. This is a separate research viewer, not a replacement of the 2026 PATROL flight map.

## Verified public source

- NYC Department of City Planning: **NYC 3D Model by Community District**, public dataset, one Rhino `.3dm` model per community district.
- Brooklyn Community District **BK02** covers DUMBO, Brooklyn Heights, Downtown Brooklyn, Fort Greene and surrounding areas.
- Original geometry derives from DOITT's **2014 aerial survey**; DCP readme metadata is dated 2018. It is not a 2026 as-built model.
- Official DCP metadata documents separate layers for `Building_FootPrint`, `Building_RoofTop`, `Building_Facade`, `Surface_Foot Print`, `Surface_Roof Top`, and `Surface_Facade`.
- The model is public NYC data subject to NYC Open Data terms and source attribution. **Do not label it CC0 or use commercial street-view imagery.** DCP disclaims warranties of completeness, accuracy and fitness.
- Source horizontal CRS is NAD83 / New York Long Island **EPSG:2263 in US survey feet**. It must never be read as WGS84 degrees or metres.
- DCP describes a hybrid LoD1/LoD2 model. Most buildings are LoD1/1.5; roughly 100 iconic buildings have LoD2 roof geometry. Small rooftop structures may be absent.

**BK02 layer-name correction:** the actual archived model inventory uses `Buildings::Surface_RoofTop`, `Buildings::Surface_Facade`, and `Buildings::Surface_FootPrint`. These are the selected cached surface layers for this pilot. The parallel `Buildings::Building_RoofTop`, `Building_Facade`, and `Building_FootPrint` catalog family is deliberately excluded from this extraction scope; its geometry relationship to the `Surface_*` family has not been established and must not be assumed. MN05's separate `RoofTop Surface` / `Facade Surface` aliases remain supported by the exact layer classifier.

## Executable work in this branch

1. `tools/nyc/probe-official-bk02-rhino.py` downloads only the official BK02 ZIP endpoints with 400 MiB compressed and 2 GiB 3DM limits, SHA-256, ZIP traversal protection, object-count limit and read-only `rhino3dm` inventory. The original ZIP is deleted immediately.
2. `tools/nyc/official_bk02_projection.py` converts EPSG:2263 XY through PROJ to the same DUMBO local east/south metre frame used by the 48 OTI building source. Vertical datum is explicitly unverified.
3. `tools/nyc/inspect-bk02-source-roi.py` derives the bounded AOI from the 48 current OTI building rings, pads by 25 m, and extracts only original Rhino cached face meshes from roof, facade and footprint surface layers. Original source UUID, face index, raw Z, triangle indices and source bounds are retained. No invented face or roof geometry is generated.
4. `tools/nyc/dumbo-2014-source-preview.html` renders the extracted original cached meshes in an isolated WebGL2 viewer. Raw 2014 Z is normalized relative to the lowest extracted Z solely for preview; it is not a certified elevation datum.
5. Python geometry/source tests and Chromium screenshots gate extraction and display. CI uploads only the bounded source-mesh JSON, provenance and screenshots; the 3DM/ZIP are never uploaded or committed.

## Accuracy boundaries

- **Source geometry:** 2014 Rhino cached tessellation of DCP roof/facade/footprint surfaces. Cached mesh is the source file's display tessellation, not exact NURBS/Brep trim topology.
- **Current reference:** 2022 OTI 48-building footprints and heights. These are not overwritten.
- **Not verified:** exact 2014-to-2022 per-building identity, source building BIN/FID, 2014-to-2026 change history, absolute vertical datum, exact window/door geometry, authentic surface photographs/PBR textures, or native GPU performance.
- No 2014 mesh is imported into the active PATROL map, aircraft physics, collision or road network in this PR.

## Required next acceptance gate

Before any runtime integration, spatially match each 2014 source footprint/roof/facade patch to the 2022 OTI FID/BIN using measured overlap and height agreement; reject demolished, rebuilt, expanded or ambiguous buildings. Verify vertical unit/datum and compare source mesh to fixed DUMBO eye-level/low-flight cameras. Keep unmatched buildings on the current 2022 footprint/height source. Run native GPU P50/P95 frame pacing, draw/triangle/texture budgets, collision and flight regressions before proposing merge.

This PR remains Draft and is stacked on #290. It does not modify `main`, #211, the production NYC map, or other cities.
