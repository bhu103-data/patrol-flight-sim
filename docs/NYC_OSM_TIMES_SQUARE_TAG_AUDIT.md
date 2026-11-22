# NYC Times Square OSM 3D-tag coverage audit

**Status:** source-only audit. This PR does not add OSM data to the game,
does not create facade geometry and does not change aircraft physics,
collisions, the production Manhattan scene or any other map.

## Why this audit exists

The current official-footprint pilots correctly restore a 1:1 metre frame,
but their visible facade windows/materials are artist-authored. The official
NYC 2014 3D model is held out pending a dataset-specific redistribution
license. OpenStreetMap is a separate candidate with an explicit ODbL 1.0
license and documented 3D-building tags.

## Data and license

- Query: OpenStreetMap Overpass API, restricted to the exact WGS84 bbox
  stored in `assets/nyc/times-square-footprints.json`.
- Elements: ways and relations tagged `building`; source geometries and
  original tags are read only for the audit.
- License: Open Database License 1.0 (ODbL).
- Attribution: © OpenStreetMap contributors.
- Adapted/derived OSM databases must remain under ODbL 1.0 and retain
  attribution. The audit report records the endpoint, query and retrieval
  timestamp. No raw OSM snapshot is committed to the repository.

References:
- https://www.openstreetmap.org/copyright
- https://osmfoundation.org/wiki/Licence/Licence_and_Legal_FAQ
- https://wiki.openstreetmap.org/wiki/Simple_3D_buildings
- https://github.com/kjhealy/nycosm (NYC OSM extract dated 2026-10-18;
  MIT package code, ODbL dataset)

## What is measured

The report counts OSM building ways, relations and building-part features,
then attempts a conservative join to the existing NYC official footprint
snapshot. A way is matched only when it is the unique candidate within 8 m
centroid distance and its area ratio is between 0.5 and 2.0. Ambiguous
matches are reported, never selected by guesswork.

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
1. matched feature IDs and geometry are reviewed against the exact official
   source footprint;
2. tag coverage is sufficient for the specific buildings selected;
3. any OSM-derived database/asset bundle retains ODbL and attribution;
4. missing values remain explicitly unknown rather than guessed;
5. resulting original geometry is separately tested for scale, topology,
   triangles, texture budget, collision and matched-camera visuals.

A successful workflow means only that the bounded source query and coverage
analysis completed. It is not a production map or realism acceptance.
