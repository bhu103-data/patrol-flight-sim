# Chongqing map provenance and permissions

Checked 2026-11-20:

- Reference experience: <https://lab.ytdeepsea.com/games/chongqing/>
- Reference credits: <https://lab.ytdeepsea.com/games/chongqing/credits.html>
- The reference credits identify Poly Haven materials and skies as CC0, Blender Studio Human Base Meshes as CC0, selected Wikimedia references as CC BY/CC BY-SA, and Hunyuan3D-2 output under Tencent's Community License.
- The reference site's generated facade/train textures are stated there as CC BY-SA 4.0. This project does **not** copy those files, the reference site's code, map tiles, photos, or 3D models.
- This map is original procedural geometry and code, using only public place names and high-level landmark concepts. No OpenStreetMap data is included.

Before adding any third-party Chongqing asset, record its URL, creator, exact license, attribution text, and whether redistribution is permitted here.

## Photographic material upgrade (20 November 2026)

The Chongqing scene reuses **six existing 1K Poly Haven CC0 PBR JPEGs** already in this PATROL repository. The latest optional visual pass additionally streams two verified 1K CC0 textures from the same source at runtime, with embedded procedural fallbacks. Original file provenance is recorded in [assets/nyc/PBR_TEXTURE_SOURCES.md](assets/nyc/PBR_TEXTURE_SOURCES.md) and licensed under [Poly Haven CC0](https://polyhaven.com/license).

- `assets/nyc/concrete_wall_008_diff_1k.jpg`, `concrete_wall_008_nor_gl_1k.jpg`, `concrete_wall_008_arm_1k.jpg`: concrete photographic base color, tangent-space normal and roughness used for towers, exposed walls, terrain.
- `assets/nyc/asphalt_04_diff_1k.jpg`, `asphalt_04_nor_gl_1k.jpg`, `asphalt_04_arm_1k.jpg`: photographic asphalt color/normal/roughness used on streets.
- `assets/chongqing/pbr.js`: original procedural 512px ceramic roof-tile, weathered stone-block and reflective glass atlases to fill gaps where no appropriately licensed texture is bundled.
- The rounded pilot model is procedural geometry authored in PATROL, not imported from the reference experience.

**Official real-world reference:** [Chongqing Urban Management Bureau](https://cgj.cq.gov.cn/zwgk_173/zfxxgkml/rdjyhzxta/202504/t20250429_14569421.html) describes Qiansimen Jialing River Bridge as a *single-tower single-cable-plane cable-stayed bridge*, main bridge length 720m. This source was used to correct the formerly inaccurate arched bridge silhouette. [Chongqing official Hongyadong description](https://www.cq.gov.cn/zjcq/cycq/jplyxl/dsy/dsjp/202608/t20260826_15982330.html) and [local history reference](https://dfz.cq.gov.cn/zqlswh/fjms_417821/202311/t20231102_12510878.html) guide the stilt-house, river-facing galleries and cliffside architecture.

**Scope warning:** despite photographic PBR surfaces and higher-detail geometry, the reconstruction uses fictional compressed coordinates and custom-authored buildings; it is **not** 1:1 georeferenced terrain, surveyed geometry, Google 3D Tiles, licensed drone photogrammetry, or accurate real-time raytraced water reflections. Gameplay flight is also an original independent implementation inspired by MIT-licensed [Petalwake](https://github.com/jjcm/petalwake).


## Optional CC0 photographic wood and roof textures — 20 November 2026

Direct runtime textures (not bundled binary assets):

- [Wood Planks](https://polyhaven.com/a/wood_planks) — source: `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/wood_planks/wood_planks_diff_1k.jpg` — timber columns, balcony window lattice and carved window frames
- [Clay Roof Tiles 03](https://polyhaven.com/a/clay_roof_tiles_03) — source: `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/clay_roof_tiles_03/clay_roof_tiles_03_diff_1k.jpg` — pitched roofs and curved eaves

Both original texture URLs were independently located in the Poly Haven public asset library, displayed by the image viewer, and are covered by [Poly Haven CC0](https://polyhaven.com/license). CC0 does not require public author attribution, and **no provider or original model name is displayed in the game's scenery**. The project retains source URLs here for engineering provenance and maintenance.

The code loads only these diffuse maps directly; it does not imply that unlicensed photos, reference-game assets, Google 3D tiles or a downloaded 1:1 building model have been imported. If either external URL is unavailable or blocked by CORS, the scene keeps its original local procedural wood/tile atlas and remains playable.

The close-range traditional roofs are custom curved 3D surfaces rendered through a single instanced mesh. They are not an imported high-resolution third-party building model. Their proportions remain artistic.
