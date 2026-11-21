# PATROL · Times Square mapping and signage provenance (V8)

Updated: 2026-11-20. This document distinguishes what was actually
verified on an external map from what remains a scaled game approximation.

## Geographic and placement references

- **Google Maps** — https://www.google.com/maps/@40.758557,-73.985441,17z
  Read-only inspection of One Times Square, Duffy Square / TKTS,
  Broadway's diagonal relation to 7th Avenue, and the Times Square EDITION.
  **NO Google images, map tiles, meshes, or Street View data are redistributed.**
- **NYC Department of Transportation** — Times Square Broadway and 7th Avenue
  street/plaza/crosswalk and one-way circulation plan:
  https://www.nyc.gov/html/dot/downloads/pdf/renewable_tsq_plazabtwn46_45.pdf
- **Times Square Alliance** — source listing exact commercial display
  locations and facing descriptions:
  https://www.timessquarenyc.org/business-community/advertisement-sponsorships
- **City of New York Building Footprints** — published footprint and roof-height
  layer (ArcGIS public service) for subsequent **survey/geometry-level** import:
  https://services2.arcgis.com/IsDCghZ73NgoYoz5/ArcGIS/rest/services/NYC_Building_Footprint/FeatureServer/0
  The service returned GeoJSON but extracting all requested polygon rings
  failed during this session. **No official GIS polygons or height values
  were represented as verified placements in this commit.**

## Game-space road anchors (fictional compressed scale)

- Seventh Avenue is X=12, running north/south.
- Broadway diagonal is `X=18-0.43*(Z-5)`.
- W 42nd/43rd/44th/45th/46th/47th streets are placed at
  Z=-40/-19/-2/14/31/50, respectively.
- One Times Square is a **separate existing landmark** south of 42nd at
  X=23, Z=-47.5, now with one north-facing billboard.
- Duffy/TKTS red steps remain at X=-0.9, Z=42.8, between 46th and 47th.
- This is still a compressed stylized world. These coordinates are NOT
  survey-grade or directly convertible into actual building dimensions.

## Architectural sites (approximated game X/Z, only where verified in street order)

| Real venue (district address) | Game X | Game Z | Billboard placement rationale |
|---|---:|---:|---|
| One Times Square, 42nd | 23 | -47.5 | South end, faces north into the bowtie |
| 3 Times Square, 42nd–43rd | -14 | -29 | West-side block |
| 7 Times Square, 42nd/7th | 48 | -30 | Southeastern screen, toward plaza |
| 1500 Broadway, 43rd | 40 | -10 | Large street-facing horizontal canvas |
| 1530 Broadway, 43rd–44th | -14 | -10 | Digital Beast near plaza |
| 1515 Broadway, 44th–45th | 39 | 6 | Broadway east side |
| 1540 Broadway, 44th–45th | -15 | 6 | Silvercast broad billboard |
| 1535 Broadway / Marriott Marquis, 45th–46th | 44 | 22 | Multi-face building display |
| 1552 Broadway, 45th–46th | -16 | 22 | Tall Lightyear Media screen |
| 1565 Broadway, 46th–47th | -17 | 40 | Two separate vertical-stack screens |
| 1557 Broadway, 46th–47th | 27 | 40 | Two distinct Duffy-facing panels |
| TSX Broadway, 46th–47th | 44 | 41 | Tall wraparound-inspired screen |
| 2 Times Square, 47th–48th | 4 | 61 | Tapered wedge footprint behind TKTS |
| Times Square EDITION / 20 Times Square, 47th/7th | 27 | 61 | North Star toward Duffy Square |

**Do not interpret these game coordinates or boxes as faithful NYC
building-footprint surveys.** The site order and addresses are grounded;
the dimensions, precise shapes and x/z offsets remain artistic approximations.

## Visual uniqueness and performance

- One side of each named building receives its curated primary screens.
  Only mapped corner venues receive a secondary angled/wrap canvas.
- Existing `nyc-led.js` draws distinct original static artwork with
  session-unique IDs. A finite set of base design families still exists;
  therefore visual resemblance can occur despite unique artwork IDs.
- Rebuilding nearby scenery uses the existing single scenery mesh and
  static LED atlas, not extra independent scene renderers.
- Buildings were checked to avoid the 7th Avenue road, Broadway corridor,
  and the six mapped cross streets. City-scale collisions/LOD are still
  approximate.
- Preserve the original WebGL2 engine, old maps, flight, harbor water,
  and subway overlay when upgrading building shapes with real GeoJSON.

## Next geometry-quality milestone

Fetch small, paginated batches of City-issued building footprint polygons
with HEIGHTROOF, transform through a reviewed WGS84→local-map basis,
and replace these temporary approximated bounding volumes with vetted
polygonal extrusions. Verify in Chrome, including signage facing,
collision meshes, FPS, and daytime/nightside screenshots.
