# NYC Times Square OSM 3D-tag coverage audit

**Status:** source-only audit. This PR does not add OSM data to the game,
does not create facade geometry and does not change aircraft physics,
collisions, the production Manhattan scene or any other map.

## Why this audit exists

The current official-footprint pilots restore a metric coordinate frame,
but visible facade windows/materials are artist-authored. The official
NYC 2014 3D model is held out pending a dataset-specific redistribution
license. OpenStreetMap is a separate candidate with an explicit ODbL 1.0
license and documented 3D-building tags.

## Pinned data and license

- Data repository: https://github.com/kjhealy/nycosm
- Pinned commit: `75ec01ced7fdd85619493d59f4e7e9236e0990fd`
- Extract date: 2026-10-18 (Geofabrik New York State extract)
- Acquisition: pinned GeoParquet checkout; no live Overpass API request
- Files read: `nyc_osm_buildings_manhattan.parquet` and
  `nyc_osm_areas.parquet`
- CRS: EPSG:2263; transformed to WGS84 only for the bounded source-footprint
  matching audit.
- Data license: Open Database License 1.0 (ODbL).
- Attribution: © OpenStreetMap contributors.
- The package code is MIT; the bundled OSM-derived GeoParquet database is
  explicitly ODbL 1.0. The workflow downloads the three exact public blobs
  from the pinned commit and verifies each Git blob SHA-1 before parsing.
  The original `inst/COPYRIGHTS` notice is included in the artifact.
- No raw OSM data is committed or uploaded as an artifact. A temporary
  clipped JSON sample exists only during the CI job and is deleted with the
  runner. The report exports aggregate coverage only, not FID ↔ OSM ID pairs.

References:
- https://www.openstreetmap.org/copyright
- https://osmfoundation.org/wiki/Licence/Licence_and_Legal_FAQ
- https://wiki.openstreetmap.org/wiki/Simple_3D_buildings
- https://github.com/kjhealy/nycosm
- https://github.com/kjhealy/nycosm/blob/main/inst/COPYRIGHTS

## What is measured

The Python extractor reads only Manhattan building features and area-layer
features tagged `building:part`, then clips geometries to the exact WGS84
bbox already stored in `assets/nyc/times-square-footprints.json`. It
temporarily transforms the clip bbox to EPSG:2263 for intersection with
the source GeoParquet geometries. It writes only the clipped temporary
sample for the Node audit; the raw sample is not retained.

The Node audit counts building ways, building relations and building parts,
then attempts a conservative join to the existing NYC official footprint
snapshot. A whole-building way is matched only when it is the unique
candidate within 8 m centroid distance and its area ratio is between 0.5
and 2.0. Ambiguous matches are reported, never selected by guesswork.
The exported artifact contains aggregate counts and match-quality ranges
only; it does not export municipal FID ↔ OSM element-ID pairs or source
geometry.

For unique matches and for all building ways separately, the audit counts
the presence of:
`height`, `building:levels`, `building:part`, `roof:shape`,
`roof:height`, `roof:material`, `building:material`,
`building:colour`, `name`, and `wikidata`.

This is a coverage report, not a building survey. OSM is volunteer-maintained;
missing tags are unknown and must not be filled with assumptions. Many NYC
OSM footprints were originally imported from municipal footprint data, so
the OSM layer is not independent survey evidence. The report does not prove
facade dimensions, billboard placement, window layouts or photorealism.

## Promotion gate

Do not create or import 3D facade assets from this audit until:
1. tag coverage is sufficient for the specific buildings selected;
2. any OSM-derived database/asset bundle retains ODbL and attribution;
3. missing values remain explicitly unknown rather than guessed;
4. resulting original geometry is separately tested for scale, topology,
   triangles, texture budget, collision and matched-camera visuals.

A successful workflow means only that the pinned, bounded source extraction
and coverage analysis completed. It is not a production map or realism
acceptance.


## First measured result — 2026-11-22

GitHub Actions run
[45053459214](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45053459214)
passed the pinned-source download, blob-integrity checks, Python extraction,
Node audit and repository regression jobs. The 7-day artifact contains only
`report.json` and the original ODbL `COPYRIGHTS.txt` notice.

- Official footprint snapshot: 120 features; 118 valid single-ring
  footprints considered.
- Pinned OSM extract: 138 elements — 130 whole-building ways, 3 building
  relations and 5 building-part elements.
- Conservative whole-building joins: 96 unique matches, 13 ambiguous and
  9 unmatched. The median centroid separation is 0.931 m; the maximum is
  6.96 m. Matched area ratios range from 0.6722 to 1.8291.
- Among the 96 unique matches, `height` is present on 78 (81.3%),
  `building:levels` on 8 (8.3%), `roof:shape` on 6 (6.3%),
  `roof:material` on 6 (6.3%), `building:material` on 1 (1.0%),
  `building:colour` on 6 (6.3%), `name` on 60 (62.5%) and
  `wikidata` on 46 (47.9%). No matched feature has `roof:height`.

### Interpretation

OSM is useful as a **secondary identity and height cross-check** for this
bounded Times Square sample, but it is not a reliable source for detailed
facade construction: floor-count, roof-shape and material tags are sparse.
Do not synthesize missing storeys, window spacing, roof setbacks or cladding
from absent tags. The 13 ambiguous and 9 unmatched footprints remain
unassigned. OSM is volunteer-maintained and may share municipal geometry
lineage; these matches are not independent survey verification.

The result does not change the promotion gate: no OSM runtime import, no
generated facade meshes and no claim of photorealism. Any future asset work
must be separately scoped to uniquely matched buildings and retain ODbL
attribution/share-alike obligations.
