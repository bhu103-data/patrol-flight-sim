# Murray Hill midrange silhouette — DATA/GEOMETRY PROTOTYPE ONLY

Base: `6d50bfda4b2d3837e550751ede49b200b140bc72`. Independent draft, never merge as a rendering feature in its current form.

## Geographic scope
WGS84 rectangle west -73.9815, south 40.7485, east -73.9765, north 40.7520 (Midtown East / Murray Hill). Outside Times Square, DUMBO and the earlier Lower Manhattan OTI financial-district footprint sample. All extracted polygons must remain in or immediately near this rectangle.

Official source: NYC Office of Technology and Innovation BUILDING footprint service https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/BUILDING_view/FeatureServer/0 ; NYC dataset https://data.cityofnewyork.us/City-Government/BUILDING/5zhs-2jue ; source metadata https://github.com/CityOfNewYork/nyc-geo-metadata/blob/main/Metadata/Metadata_BuildingFootprints.md and NYC Open Data terms https://data.cityofnewyork.us/stories/s/Terms-of-Use/k9k7-3cje . Retain these links with derivative snapshots. Data is publicly supplied for reuse under NYC Open Data terms, with attribution; no copied photography or paid 3D assets.

## What the sample does
- `node scripts/nyc-murray-hill-footprints.mjs assets/nyc/murray-hill-footprints.json` generates a bounded, deterministic, source-backed polygon and HEIGHT_ROOF (feet) snapshot; the missing-height, invalid, duplicate and courtyard cases are skipped.
- `assets/nyc/murray-hill-silhouette.js` emits **visual-only** base footprints and limited convex inset roof terraces. Inset size and split height are *authored approximations*, not NYC roof-setback or elevation measurements. Projection uses its own local comparison origin, **NOT** validated gameplay coordinates; no claim of 1:1 game placement.
- No production `index.html`, terrain worker, collision, streets, GIS Times Square mesh or DUMBO geometry is changed. This module is NOT loaded by PATROL. Snapshot download from live OTI source was blocked in this connector session; no real block has been rendered and no screenshot is claimed.

## Local scope check
`node --test tests/nyc-murray-hill-silhouette.test.mjs` — 3 tests passed against synthetic input; real source-query execution was not validated.

## Centralized QA / integration gate
First retrieve snapshot and audit IDs, footprint geometry, missing heights and reuse terms. Then align official lat/lon to *existing* PATROL city projection, clip against mapped streets, exclude named landmark volumes, and only then implement runtime visual replacement with collision unchanged. For comparable screenshots, use exactly the same 1920x1080 viewport, FOV 65°, noon lighting, normal quality, clear weather, camera altitude 85 game units, and a fixed camera matrix captured **after** selecting a real Murray Hill street axis; record the matrix, look-at target and before/after branch SHA. Inspect oblique roof silhouette and street-level near edge from the same camera. Follow with low quality and no street overlap spot checks. Do not assert city-space camera coordinates before GIS alignment; no WebGL QA was run here.
