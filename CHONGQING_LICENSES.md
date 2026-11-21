# Chongqing map provenance and permissions

Checked 2026-11-20:

- Reference experience: <https://lab.ytdeepsea.com/games/chongqing/>
- Reference credits: <https://lab.ytdeepsea.com/games/chongqing/credits.html>
- The reference credits identify Poly Haven materials and skies as CC0, Blender Studio Human Base Meshes as CC0, selected Wikimedia references as CC BY/CC BY-SA, and Hunyuan3D-2 output under Tencent's Community License.
- The reference site's generated facade/train textures are stated there as CC BY-SA 4.0. This project does **not** copy those files, the reference site's code, map tiles, photos, or 3D models.
- This map is original procedural geometry and code, using only public place names and high-level landmark concepts. No OpenStreetMap data is included.

Before adding any third-party Chongqing asset, record its URL, creator, exact license, attribution text, and whether redistribution is permitted here.

## Photographic material upgrade (20 November 2026)

The Chongqing scene now reuses **six existing 1K Poly Haven CC0 PBR JPEGs** already in this PATROL repository, without downloading or redistributing additional image files. Original file provenance is recorded in [assets/nyc/PBR_TEXTURE_SOURCES.md](assets/nyc/PBR_TEXTURE_SOURCES.md) and licensed under [Poly Haven CC0](https://polyhaven.com/license).

- `assets/nyc/concrete_wall_008_diff_1k.jpg`, `concrete_wall_008_nor_gl_1k.jpg`, `concrete_wall_008_arm_1k.jpg`: concrete photographic base color, tangent-space normal and roughness used for towers, exposed walls, terrain.
- `assets/nyc/asphalt_04_diff_1k.jpg`, `asphalt_04_nor_gl_1k.jpg`, `asphalt_04_arm_1k.jpg`: photographic asphalt color/normal/roughness used on streets.
- `assets/chongqing/pbr.js`: original procedural 512px ceramic roof-tile, weathered stone-block and reflective glass atlases to fill gaps where no appropriately licensed texture is bundled.
- The rounded pilot model is procedural geometry authored in PATROL, not imported from the reference experience.

**Official real-world reference:** [Chongqing Urban Management Bureau](https://cgj.cq.gov.cn/zwgk_173/zfxxgkml/rdjyhzxta/202504/t20250429_14569421.html) describes Qiansimen Jialing River Bridge as a *single-tower single-cable-plane cable-stayed bridge*, main bridge length 720m. This source was used to correct the formerly inaccurate arched bridge silhouette. [Chongqing official Hongyadong description](https://www.cq.gov.cn/zjcq/cycq/jplyxl/dsy/dsjp/202608/t20260826_15982330.html) and [local history reference](https://dfz.cq.gov.cn/zqlswh/fjms_417821/202311/t20231102_12510878.html) guide the stilt-house, river-facing galleries and cliffside architecture.

**Scope warning:** despite photographic PBR surfaces and higher-detail geometry, the reconstruction uses fictional compressed coordinates and custom-authored buildings; it is **not** 1:1 georeferenced terrain, surveyed geometry, Google 3D Tiles, licensed drone photogrammetry, or accurate real-time raytraced water reflections. Gameplay flight is also an original independent implementation inspired by MIT-licensed [Petalwake](https://github.com/jjcm/petalwake).
