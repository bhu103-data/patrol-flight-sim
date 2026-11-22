# NYC Times Square: original municipal 3D building roof source gate

**THIS IS NOT A RENDERED ROOF REPLACEMENT YET.** Existing branch #251
contains authentic buildings/2022 roadbed in the same WGS84 metre frame but
still shows gray extruded facades and flat roofs. Approving visual realism
without genuine roof geometry would be incorrect.

## Original NYC model identified
- NYC Planning **NYC 3D Model by Community District**, dataset
  https://data.cityofnewyork.us/d/u5j4-zxpn
- Official NYC DCP readme:
  https://www.nyc.gov/assets/planning/download/pdf/data-maps/open-data/nyc-3d-model-metadata.pdf
- Exact borough-district sample: Manhattan Community District 05 (Times
  Square / Midtown) from official 2020 NYC Open Data report, via published
  `nyc_3dmodel_mn05.zip`. Resolve only the two nyc.gov hosts.
- Survey vintage: 2014; metadata 2018. Historical, not a 2026 BIM model.
- Source .3dm Rhino has distinct **Building_FootPrint / Building_RoofTop /
  Building_Facade / Surface_Roof Top / Surface_Foot Print / Surface_Facade**
  layers according to the municipal metadata; objects can be non-joined.
- Coordinate frame is NAD83 New York Long Island state plane **EPSG:2263,
  US survey feet**; the current PATROL reference is local WGS84 easting,
  northing and metres. Never interpret the original feet as metres or assume
  source roof height equals height above the fictional flat y=0 plane.
- Source limitation: most buildings are LoD1/1.5; around 100 iconic NYC
  buildings LoD2 roof geometry. Not every real window or 2026 roof is present.
- Original city model is provided under NYC Open Data conditions and without
  municipal warranty. Do not bundle commercial photo, street view or any
  Google/third-party tile; keep source credits.

## Current independent QA
`tools/nyc/probe-official-mn05-rhino.py` obtains the exact
published official MN05 source ZIP, with 220 MiB compressed download cap,
650 MiB per-file cap, SHA256, archive traversal safeguards and read-only
`rhino3dm` geometry inspection. It records candidate layers, object type
counts and possible mesh vertices. It uploads **metadata only** to the
workflow evidence artifact and deletes downloaded source bytes.

If either officially published download endpoint has moved or the archive
exceeds the bounded size limit, it must be reported as **blocked**. Do not
fill the scene with fake roofs or treat other people's model screenshots as
free 3D meshes.

## Minimum required before swapping real 3D into the flight view
1. Confirm actual MN05 ZIP, source surface/mesh geometry and object layer
   names. Identify at least one real roof within the current measured Times
   Square source building envelope.
2. Convert EPSG:2263 US survey feet x/y to WGS84 local easting/northing metres;
   reconcile actual source elevations and model vertical datum separately.
3. Compare official 2014 facade-roof placement against current 2026 OTI
   footprints, mark demolished/constructed/modified roofs explicitly; do
   not override newer buildings with stale 2014 geometries.
4. Extract bounded triangle meshes only for accepted buildings and list
   source UUID, roof area, triangulation validity, material licensing,
   per-building triangle/texture budget.
5. Offer an independent opt-in source geometry viewer with same-camera
   A/B, altitude and flight/collision regression. Native GPU p95 frame time
   and georeferenced real photo camera residuals are still mandatory
   before any production-map realism acceptance.

No `main`, integrated PATROL `index.html`, traffic, airplane physics,
Chongqing, Alaska, Vegas, or existing #251 asset bytes are altered here.
