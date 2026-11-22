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
- Files read: `nyc_osm_buildings_manhattan.parquet` and
  `nyc_osm_areas.parquet`
- CRS: EPSG:2263; transformed to WGS84 only for the bounded source-footprint
  matching audit.
- Data license: Open Database License 1.0 (ODbL).
- Attribution: © OpenStreetMap contributors.
- The package code is MIT; the bundled OSM-derived GeoParquet database is
  explicitly ODbL 1.0. The workflow checks out the exact data commit and
  includes its `inst/COPYRIGHTS` notice in the artifact.
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
