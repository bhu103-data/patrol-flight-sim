# Lower Manhattan OTI pedestrian facade and roofline patch — 2026-11-21

## What changed
- Production `index.html`, **only** `buildOfficialFootprintMesh` (the original NYC OTI 100-building official geometry renderer). No new building or Manhattan block rectangles, no edits to existing DUMBO PR #97 warehouses or bridgehead traffic/road PRs #88/#100/#102. No changes to water, weather, Alaska, Las Vegas, collision indices, plane controls.
- Existing municipal polygon walls and ear-clipped roofs retained without height changes. At most **two** bounded architectural entry/window assemblies per near-field official building, on selective harbor/street-oriented edges. At most **eight** short eave cornice strips per building, placed below its existing roof line, not new boxes or separate meshes. Original native shader surface tags 9 and 10 reused, no added texture or draw call.
- Source real data fields: `DOITT_ID`, projected geometry and `HEIGHT_ROOF` from `assets/nyc/official-financial-footprints.json`. The data snapshot includes 100 buildings and existing compressed PATROL game projection, **not** 1:1 meter scale. This source supplies **building footprint and height**, *not* storefront, door, window, cornice dimensions: those are clearly labelled original, bounded **artistic** details, not official survey observations.
- Nearby landmark GLBs are already available: `assets/nyc/scenario/trade.glb`, `empire.glb`, `chrysler.glb`, enabled under existing `scenario-manifest.json`; never replace them with new boxes. Existing Poly Haven CC0 `assets/nyc/asphalt_04_*.jpg`, `concrete_wall_008_*.jpg` and existing render shader reused. No new models/textures downloaded.

## Provenance and license
- Official New York City Office of Technology and Innovation (OTI) Building Footprints dataset: https://data.cityofnewyork.us/City-Government/BUILDING/5zhs-2jue
- Metadata: https://github.com/CityOfNewYork/nyc-geo-metadata/blob/main/Metadata/Metadata_BuildingFootprints.md
- NYC Open Data terms: https://data.cityofnewyork.us/stories/s/Terms-of-Use/k9k7-3cje
- Snapshot and extraction query: `assets/nyc/official-financial-footprints.json` and `assets/nyc/OFFICIAL_FOOTPRINTS_README.md`.
- Materials: Poly Haven CC0 per `assets/nyc/PBR_TEXTURE_SOURCES.md`; all new surface geometry authored directly for PATROL, no outside photos, model imports or GPU training.

## Budgets and verification
- **Added** up to 2 entry assemblies × 6 facade faces, 8 cornice facade faces per eligible downtown building; no independent WebGL draw call, no additional GLB or texture bandwidth.
- No source roof polygons or source HEIGHT_ROOF altered. The game's polygon collision and original district geometry remain authoritative. These strips are **visual**, with offsets below 0.14 compressed game units from a confirmed building wall. Distinct per-building triangle budget can be tested via callback counts.
- Directed test: `node --test tests/nyc-oti-downtown-envelope.test.mjs tests/nyc-oti-footprints.test.mjs` and normal production regression tests.
- Visual QA: use existing `scripts/nyc-road-browser-smoke.mjs` fixed city camera `09-manhattan-window-facades.png` and bridgehead camera `02-brooklyn-bridgehead.png` in base vs this PR at 1280×720 and same weather/quality. Also check 3D window/door reveals using closer low-flight camera and low-quality behavior. Record actual image and browser frames, not screenshot capture latency as FPS.
- **Do not claim more realism than observed:** This is a near-flight street entrance/cornice refinement to already-source-matched downtown buildings, not a new surveyed DUMBO geometry set or complete city reconstruction.
