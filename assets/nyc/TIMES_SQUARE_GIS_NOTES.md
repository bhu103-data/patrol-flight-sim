# Times Square — NYC GIS footprint snapshot and alignment audit

Created 2026-11-20. This is a source-backed data extraction, **not** a
claim that the deployed game already uses 1:1 GIS geometry.

## Verified source
- NYC Government, **NYC Building Footprints**, feature layer:
  https://services2.arcgis.com/IsDCghZ73NgoYoz5/ArcGIS/rest/services/NYC_Building_Footprint/FeatureServer/0
- Endpoint metadata confirms the actual primary key field is **FID**,
  building roof-height field is **HEIGHTROOF**, and source coordinates
  are ESRI State Plane feet (the query requested output in WGS84).
- Query: WGS84 envelope lon -73.9885..-73.9835,
  lat 40.7560..40.7595, `geometryPrecision=6`,
  `maxAllowableOffset=0.000012`, paginated 20 records per request,
  `orderByFields=FID`.
- Count-only query returned **121** intersecting features.
  Snapshot stores **120** distinct FIDs passing polygon and height
  validation; one excluded due to incomplete/invalid height or geometry.
- Data file: `assets/nyc/times-square-footprints.json` (~27 KB).
- IMPORTANT: `heightFt` is **feet**, converted to meters by
  `heightFt * 0.3048`. Real source records often have blank NAME.
- No Google map textures, proprietary 3D tiles or screenshots
  are embedded in the project.

## Spatial calibration research
- One Times Square actual coordinate: approx
  lon -73.9864883, lat 40.756421 (reference for game X=23, Z=-47.5).
- Duffy Square actual coordinate: approx
  lon -73.98528, lat 40.75889 (reference for game X=-0.9, Z=42.8).
- A two-control-point similarity transform has approximate
  0.31974 game units / real meter and 35.23 degree rotation.
  This is an empirical **game-only** projection, not a 1:1 scale.
- Initial automatic fit audit on 120 real footprints against
  existing 13 manually placed venue boxes and compressed streets:
  100 features have centroids within expanded scenery bounds,
  57 avoid the 13 venue boxes, 19 avoid approximate roads, and
  only **1** remains inside existing compact Times Square boundaries
  while avoiding road and authored massing overlaps.
- Therefore a naive overlay would create substantial doubled buildings
  and buildings protruding into Broadway/7th Avenue, and must NOT
  be enabled in default fly mode without replacing the game street
  network and billboard backing geometry together.

## Next implementation gate
1. Import surveyed/OSM street centerlines with compatible license
   and calibrate the map using more than two control points.
2. Transform the official footprint polygons in a separate city-scene
   layer with winding, roof triangulation and strict object caps.
3. Replace — not overlay — the old procedural Times Square building
   and road geometry, preserve gameplay collision volumes, reattach
   each LED screen to the correct building facade and validate its
   outward normal.
4. Open Scenic Views > Times Square Street Level / 44th Street LED Canyon
   to review the result, compare against official maps, and run FPS
   and shader tests before enabling by default.

The current main branch improves Times Square facades and offers
street-level inspection cameras; the GIS file is an **offline
asset ready for controlled integration**, not a survey-derived live
replacement of the whole neighborhood.
