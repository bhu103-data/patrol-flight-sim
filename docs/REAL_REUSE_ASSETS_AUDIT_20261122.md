# PATROL | 2026-11-22 | Real-source, redistribution-aware 3D asset audit

> Research-only inventory, scoped independently from #142/#186. Nothing is
> imported, enabled, merged or published by this research commit. Asset-page
> sizes below are **displayed 4K/default download choices**, not verified
> downloaded byte counts; source polygon counts are publisher claims, not local
> mesh measurements. Unknown is deliberately written as **unverified**.

## A. Real geographic / building geometry — highest-priority source imports

| Place / target | First-party source, direct discovery/download | Actual asset & source resolution | Legal use | Integration and QA |
|---|---|---|---|---|
| NYC all 5 boroughs / DUMBO + Times Square / OTI 3D City Model | [City data.gov record](https://catalog.data.gov/dataset/3-d-building-model), [GML ZIP](https://s-media.nyc.gov/agencies/oti/DA_WISE_GML.zip), [Multipatch ZIP](https://s-media.nyc.gov/agencies/oti/DA_WISE_Multipatch.zip), [DGN ZIP](https://s-media.nyc.gov/agencies/oti/DA_Wise_DGN.zip) | **Actual city 3-D massing**, 2014 aerial survey basis; GML/Esri Multipatch/DGN ZIP. Exact tile bytes and face counts unverified. | NYC open-data [technical use rules](https://cityofnewyork.github.io/opendatatsm/publicpolicies.html); record provenance and modification disclaimer, screen any third-party material. | Extract only DUMBO/Times Square AABB in projected coordinates; triangulate GML/Multipatch -> indexed GLB/glTF; keep source height and 3D geometry separate from artist-created window detail. Before replacement compare against existing `assets/nyc` OTI data to avoid duplicates. 2K–20K tris **target** per nearby landmark, not observed source count. |
| NYC by Community District / lower Manhattan, Brooklyn | [Official community district dataset](https://data.cityofnewyork.us/City-Government/NYC-3D-Model-by-Community-District/u5j4-zxpn) | Buildings present in 2014, **Rhino 3DM**. Source ZIP/mesh stats unverified. | NYC open-data terms; no right to copy non-City imagery is inferred. | Prefer a clipped community district for download; use Rhino3DM -> OBJ -> GLB or Open3D/GDAL geometry; perform world origin, units, roof occlusion and LOD check. Do not claim 1:1 render under PATROL's compressed axes. |
| Las Vegas / resort footprints and building heights | [Overture open-map S3 catalog](https://registry.opendata.aws/overture/), [download docs](https://docs.overturemaps.org/) | Real building polygons + occasional height and roof fields; **GeoParquet** not sculpted hotels or texture-accurate model. | Source-dependent **ODbL v1.0** on OSM-derived Derivative Databases; other sources may be CDLA-Permissive 2.0. Attribute per feature and respect derivative database rules. | Query bounded Vegas Strip AABB, validate source/height individually; extrude in *separate staging scene*, do not overwrite curated Bellagio/Venetian landmarks. 1–8K tris/parcel **working target**; cannot substitute for true hotel facades. |
| Chongqing / Hongyadong adjacent block footprints | [Overture open-map S3 catalog](https://registry.opendata.aws/overture/) | Real footprints, **GeoParquet**; levels / roof heights sparse in places. No verified Hongyadong photogrammetric GLB. | **ODbL / mixed source**; hold as data-only until attribution/distribution obligations implemented. | Local bounding-box extract, preserve river crossings and stepped terrain, and compare OSM-derived polygons to named landmarks before placement. Do not label extrusions as 3D scans. |
| Chongqing / mountainous city relief | [NASA SRTMGL1 Global](https://data.nasa.gov/dataset/shuttle-radar-topography-mission-1-arc-second-global), [USGS SRTM data page](https://www.usgs.gov/centers/eros/science/usgs-eros-archive-digital-elevation-shuttle-radar-topography-mission-srtm-1) | Real Earth-observation global terrain, about **30 m raster cells**, HGT/DEM output depending distribution. Exact AOI bytes unverified. | NASA/USGS open public-sector data; preserve official credit and source tile identity. | Clip Chongqing AOI offline into quantized 16-bit elevation + seam bounds; 129x129 or 257x257 **proposed LOD tile**; no false fine street-grade claims for 30m terrain. |
| Las Vegas / hills west and east of Strip | [USGS 3DEP](https://www.usgs.gov/3d-elevation-program/), [data portal](https://www.usgs.gov/the-national-map-data-delivery/gis-data-download) | Actual USGS DEM / GeoTIFF; the project **already contains** a bounded 3DEP sample in `assets/vegas/strip-ridges-3dep.json`. | Federal **public domain**, USGS credit requested. | **Reuse existing survey sample first**. For new hills clip a new documented AOI only; convert terrain to quantized 16-bit meshes and LOD; avoid claiming a second fake DEM. |
| Alaska / coast, glaciers, lake banks | [USGS 5 m Alaska DEM](https://catalog.data.gov/dataset/5-meter-alaska-digital-elevation-models-dems-usgs-national-map-3dep-downloadable-data-coll), [3DEP guidance](https://www.usgs.gov/3d-elevation-program/about-3dep-products-services) | Real **5 m IfSAR DEM where available**, typically GeoTIFF; field coverage varies by site; exact bytes unverified. | Public domain, USGS credit. | **Check existing Alaska measured DEM and geometry first** (`docs/ALASKA_OPEN_SOURCE.md`). Only import missing AOIs, keep precise shoreline and flight collision. Separate coarse coast meshes and close glacier LOD. |

## B. Concrete mesh assets, not just references

All four publisher pages below display *real downloadable geometry* and **CC0**.
Read [Poly Haven's license](https://polyhaven.com/license). The web page
reports original high-detail models; those numbers are NOT the desired runtime
cost. Asset-specific formats include **glTF, FBX and Blend**.

| Proposed area | Real asset page | Publisher-reported source detail (default 4K selection) | Target PATROL asset budget (**proposal**) | Priority |
|---|---|---|---|---|
| Alaska rock face / Vegas cliff edge | [Rock Face 01](https://polyhaven.com/a/rock_face_01) | **20K triangles**, page displays **47.96 MB** at 4K, ~7.1 m wide; CC0. | 3K–8K triangles near camera, 600–1500 mid, impostor beyond; 1K/2K albedo+OpenGL-normal+ARM packed KTX2 | **First geometry trial** |
| Alaska stony coastline | [Coast Rocks 05](https://polyhaven.com/a/coast_rocks_05) | **1M triangles**, page displays **109.75 MB** at 4K, ~3 m wide; CC0, LoD tag. | Aggressive 5K–12K near, 800–2K mid, cull far; limited to a handful of visible coastline nodes | Conditional (too heavy as-is) |
| Alaska forest | [Fir Tree 01](https://polyhaven.com/a/fir_tree_01) | **8M triangles**, page displays **956.57 MB** at 4K, ~26.7 m wide for set; CC0 with LoDs. | 1–3K tris/tree near, 200–600 mid, cards far; texture atlas; instance repeated trees | Conditional (never load original mesh) |
| NYC ornamental historic streetlight ONLY | [Street Lamp 01](https://polyhaven.com/a/street_lamp_01) | **31K triangles**, page displays **31.41 MB** at 4K, ~3.9 m high; CC0. | 400–1200 tris close, 80–300 mid, instance; not a substitute for NYC modern traffic poles | Conditional (site style must match) |
| Chongqing wall-mounted heritage lamp ONLY | [Street Lamp 02](https://polyhaven.com/a/street_lamp_02) | **20K triangles**, page displays **26.6 MB** at 4K, ~1.7 m high; CC0. | 300–800 triangles close, 80–180 mid; only attach where photos prove style | Conditional (style evidence required) |

## C. Actual photographic PBR source textures

These are **texture maps, not 3D buildings**. Every listed individual
Poly Haven asset page marks **CC0** with OpenGL normal (nor_gl), roughness
and compatible albedo/color channels. The default full-resolution download
shown on their pages is **not** the intended runtime size.

| PATROL application | Asset | Original material and map availability | Integration target |
|---|---|---|---|
| Vegas Venetian shaft + NYC DUMBO brick | [Church Bricks 02](https://polyhaven.com/a/church_bricks_02) | Real weathered brick capture; page 4K choice **159.68 MB**; diffuse/normal OpenGL/ARM/AO | 1K albedo + normal + ARM, KTX2 preferred, brick physical-scale tiling; no novel geometry required |
| NYC warehouses | [Red Brick](https://polyhaven.com/a/red_brick) | Photographic clay bricks, page 4K choice **72.11 MB**, CC0 | 1K–2K atlased diffuse+normal; compare with existing NYC CC0 PBR first |
| Vegas Venetian cornice/Chongqing roofs (only if suitable) | [Clay Roof Tiles](https://polyhaven.com/a/clay_roof_tiles) | Weathered tile maps, 4K choice **62.67 MB** | Downsample 1K; use only on matching actual roof types, never on green metal spire |
| Alaska snow trails (already partly covered) | [Snow 01](https://polyhaven.com/a/snow_01) | True rough/trampled snow capture, 4K choice **91.83 MB** | 1K normals and roughness; **do not reimport if current Alaska texture is same source** |
| Chongqing masonry terraces | [Stone Wall](https://polyhaven.com/a/stone_wall) | Stone-block material, 8K available, 1K/2K/4K variants | 1K-2K UV-scaled, atlas 2–4 material families only |
| NYC sidewalks / Vegas forecourts | [Concrete Pavement](https://polyhaven.com/a/concrete_pavement) | Photographic pavement, CC0 | Reuse existing sidewalk atlas if already present; <=1K tile |
| Vegas Strip asphalt / NYC roads | [Asphalt 01](https://polyhaven.com/a/asphalt_01) | Road-worn scanned material, CC0 | 1K and wetness roughness in **existing** road shader; no new mesh needed |

## D. Candidate held back — never silently import

| Candidate | Why not enabled |
|---|---|
| [St Mark's Campanile in Venice, 3D Warehouse](https://3dwarehouse.sketchup.com/model/9881ab62d425f92ae05bde0b980fccb1/St-Marks-Campanile-in-Venice-Italy) | **Actual 3D model**, publisher lists **47 polygons and 428 KB**, but specific model's downstream redistribution permissions under [3D Warehouse general license](https://3dwarehouse.sketchup.com/tos/) have not been cleared for this publicly redistributable repo. It also depicts **Venice**, not a survey of the Vegas Venetian replica. Reference only. |
| [Venetian Church Campanile on Fab](https://www.fab.com/listings/05952ade-9b48-4dab-a490-214cd98d919d) | Real .glb listing, but **per-file price and right to redistribute the raw model** not verified. Excluded. |
| [Las Vegas photogrammetric/3D city marketplace](https://www.artstation.com/marketplace/p/L8p30/las-vegas-downtown-3d-scan-usa-3d-model) | Marketplace/standard license is not a verified freely redistributable source model. Excluded. |
| [Sketchfab church/bell tower from Finland](https://sketchfab.com/3d-models/bell-tower-of-lemu-church-masku-finland-bf7194b1ca384a95a80bd9333432aa49) | Model is CC BY, but **not the correct building shape** for either St Mark's or The Venetian. May serve as learning reference; do not claim it is the actual Vegas tower. |


## E. Downloadable real landmark models with explicit CC BY attribution

The following are **actual modeled/scanned 3D objects with individual publisher
pages showing "Download 3D Model" and Creative Commons Attribution**.
CC BY is not CC0: retain author name, source URL, CC BY license text/version,
and modifications in the game's NOTICE/credits and distributed package.
The hosted original download contents, source texture provenance and file
hashes have **not yet been inspected**; do not mark integrated. Sketchfab may
require an authenticated user download. Source triangle counts below are
**publisher-reported**, not our converted runtime measurement.

| Site in PATROL | Named model / creator and exact URL | Triangles | Fidelity, eligibility, budget |
|---|---|---:|---|
| NYC Statue of Liberty / Liberty Island | [Statue Of Liberty — Gravity Jack](https://sketchfab.com/3d-models/statue-of-liberty-84094e8d5e724b5c882cf576ca12e44e), CC BY | **56,900** | Modeler states ZBrush+Maya and Substance Painter PBR, UV unwrapped and game-ready. **Strongest near-term NYC GLB replacement candidate**, conditionally: inspect likeness to actual harbor statue, licensing and scene-scale anchor; target 18–35K near / 3–8K mid / impostor far (proposal). |
| NYC Statue of Liberty / alternate **Paris replica** scan | [Statue of liberty — 3Dystopia](https://sketchfab.com/3d-models/statue-of-liberty-04a8e7b1ba9142ba8cebc6108cd5bb97), CC BY | **19,800** | 4K diffuse/normal/metallic/roughness and source says scanned **Luxembourg Garden, Paris replica**. Potential cost-effective scan silhouette, but do not claim it was scanned in NY or that pedestal is included. Target 1K/2K KTX2. |
| NYC Statue of Liberty / alternate **museum replica** scan | [Statue of Liberty — Maurice Svay](https://sketchfab.com/3d-models/statue-of-liberty-c461ed8724424ad99500fd058a0ab082), CC BY | **699,100** | True photogrammetry of a roughly 3 m replica at **Musée des Arts et Métiers in Paris**, not the NY monument. Needs heavy retopo to <=30K for game and separate pedestal modeling. |
| NYC Brooklyn Bridge | [Brooklyn Bridge — Union (krprom)](https://sketchfab.com/3d-models/brooklyn-bridge-a1ea746e42d6499080d73db514848d6b), CC BY | **Unverified** | Named model of the real bridge and downloadable under CC BY. Compare suspension cable layout, arches and road deck against current PATROL bridge before importing; keep actual flight collisions. Do not treat a picture thumbnail as dimensional validation. |
| NYC Empire State Building | [Empire State Building, NYC — Brian Trepanier](https://sketchfab.com/3d-models/empire-state-building-new-york-city-ny-usa-941cad02f4db4883b40bddf4c5d20c94), CC BY | **1,500,000** | Named real landmark with confirmed CC BY. Too many triangles as-is; strong reference/high-poly bake only; target 15–40K near LOD after high→low retopo, or use NYC official city massing. |
| NYC Empire State Building / alternate | [Empire State Building — Union](https://sketchfab.com/3d-models/empire-state-building-0b5b5e4c66a7433f8f8ad24536eac167), CC BY | **Unverified** | Named downloadable variant; check original geometry/texture, size and real facade accuracy before choosing over Brian Trepanier's mesh. |
| NYC Chrysler Building | [Chrysler Building — NanoRay](https://sketchfab.com/3d-models/chrysler-building-26be9287b12d4234af009e4162135897), CC BY | **Unverified** | Named downloadable architectural model; inspect characteristic terraced stainless spire and corner eagles; 10–35K triangles proposed near budget. |
| NYC 500 Fifth Avenue | [500 Fifth Avenue — NanoRay](https://sketchfab.com/3d-models/500-fifth-avenue-ca32c74257b1447898db63dce6028e38), CC BY | **Unverified** | Actual named art deco building; good for standalone landmark, but inspect geometry and source texture rights prior to integration. |
| Vegas Venetian internal bell **only** | [Old Church Bell — vertexgrocer](https://sketchfab.com/3d-models/old-church-bell-8aa10771481c4a0d83f7a47af6fdf9e1), CC BY | **3,100** | **Photogrammetric source + manually retopologized + UV baked 2K baseColor/normal/roughness.** Strongest low-poly *real scanned bell* candidate to replace PR #186's authored 10-sided bell. **Not scanned from The Venetian**; scale/location are artistic approximations. Target 3.1K tris and 512/1K maps, conditional on final screenshot fit and attribution. |
| **Excluded on license** NYC Empire State variant | [Empire State Building — mohamedhussien](https://sketchfab.com/3d-models/empire-state-building-ab06ee0548a041a2b9a5d16c81946526), **CC BY-ND** | 188,800 | NoDerivatives: **do not remesh, modify or repackage a converted derivative**. Use as reference only; not an approved game asset. |

**Practical first real-mesh proof-of-concept:** export the 3.1K-triangle
photogrammetry church bell with full required attribution into a separate
Vegas-only test branch, or the PBR/UV game-ready 56.9K Statue of Liberty into a
NYC-only test branch. Source pages being download-enabled does not establish
that we have locally obtained the files. Do not copy imagery or textures from
pages other than the explicitly licensed download artifact.

## Mandatory import gate

1. **Before download**: capture original URL, publisher, license (and
   required credit text), AOI, revision, download file size and SHA-256;
   reject source ambiguity, proprietary texture embeds and fake location names.
2. **Before model replacement**: compare with existing PATROL asset hashes,
   authored landmark mesh, collision footprints and map-specific disposal.
   Preserve current PR #142/#186 independently; never edit `main`.
3. **Conversion**: isolate game-visible AOI and coordinate system; generate
   Blender/Assimp -> glTF 2.0 / indexed GLB; simplify without normal loss;
   transcode source PBR to KTX2/BasisU, retain 512/1K fallback; avoid 8K
   texture packages in runtime. Per-asset budgets above are targets and
   **must be measured after conversion**, not claimed as imported counts.
4. **Acceptance**: collect matched near/far fixed-camera WebGL2 screenshots,
   vertex/material/texture size and draw calls, browser first load,
   same-camera CPU/GPU frame budget on actual hardware, collision/road/water
   and flight/map-switch regressions. Unverifiable license -> never ship.

## Why this is not yet an asset-import PR

This audit verified source pages, catalog records, and published budgets. It
did **not** download large proprietary or 4K/8K bundles, triangulate GIS ZIPs,
or run a converter. It therefore makes **no claim** that any new source asset
has already been put into the game. Existing NYC/Alaska/Vegas assets are
recorded to avoid duplicate work. Generated/manually modeled city cuboids
should be replaced only after a real source subset passes all gates.
