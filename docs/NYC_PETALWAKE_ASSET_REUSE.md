# NYC asset reuse and Petalwake MIT integration — 2026-11-21

## Provenance and scope

- Upstream: [jjcm/petalwake](https://github.com/jjcm/petalwake), source file [src/world/town.js](https://github.com/jjcm/petalwake/blob/main/src/world/town.js), repository tree inspected at `25443cef0eba802052d9ef24c94ba3c4157b6f2e`.
- License: **MIT License**, Copyright (c) 2026 Jacob Miller. [Upstream LICENSE](https://github.com/jjcm/petalwake/blob/main/LICENSE). This project retains the MIT notice in the adapted file below. Distribution must retain that notice.
- Actual integrated code: `assets/nyc/petalwake-chunk-lod.js`. Petalwake's chunk AABB distance/three LOD choice was adapted to dependency-free JavaScript. This module additionally implements a PATROL-specific deterministic spatial budget. `assets/nyc/nyc-street-network.js` **imports and uses** that budget for existing bridgehead and Manhattan street fixtures, retaining clearance/water and existing budget guards. This is an active runtime module, unlike PR #95's unconnected Midtown geometry prototype.
- Do not copy Petalwake's `assets/town/*.bin`, `assets/terrain/height.u16`, textures, GLBs, Three.js shaders or post effects into New York. They depict another fictional environment, are often multi-megabyte assets, and their fit/attribution would need individual audit. **No model training or generation was used.**

## PATROL asset inventory (verified paths at shared integration `6d50bfd`)

| Category | Existing asset path / implementation | Source or recorded license | Action |
|---|---|---|---|
| NYC hero architecture | `assets/nyc/scenario/{trade,empire,chrysler}.glb` | PATROL-original geometry; same-origin manifest explicitly permits redistribution | Reuse unchanged; never duplicate as city cuboids |
| Liberty / Empire base meshes | `assets/nyc/{statue-of-liberty,empire-state}.glb` | World Architecture Atlas 3D, MIT (see `assets/nyc/THIRD_PARTY_NOTICES.md`) | Retain as existing fallback, no new import |
| NYC roof/brick/city façades | `index.html` city builder + `assets/nyc/nyc-gis-infill.js`; `official-financial-footprints.json` | PATROL procedural + NYC OTI publicly released data with dataset terms | Preserve authoritative lot outlines and collision; avoid DUMBO duplication |
| Road/sidewalk concrete and asphalt | `assets/nyc/asphalt_04_*.jpg`, `concrete_wall_008_*.jpg` | Poly Haven CC0, recorded in PBR and third-party notices | Existing shader reuse; no new textures |
| Road network, signals and DOT furniture | `assets/nyc/nyc-street-network.js` | PATROL authored geometry; sampled references are not survey models | **Existing fixture emission budget optimized**; do not introduce extra fixtures or lanes |
| Shared traffic light | `assets/shared/kenney-traffic-light.glb`, `kenney-traffic-light-blender.glb` | Existing Kenney asset license record: `assets/shared/KENNEY_CITY_KIT_ROADS_LICENSE.txt` | Audit existing usage before any replacement; not duplicated here |
| Trees and park furniture | `assets/nyc/central-park-amenities.js`, `central-park.js` | Existing PATROL generated meshes | Keep; no Petalwake fantasy trees imported |
| Airplane / float parts | `assets/aircraft/cessna185-floats.glb` | Existing PATROL asset; check dedicated provenance before redistribution | No change, no new parts |
| Water | Existing PATROL procedural harbor/fresnel renderer in `index.html` | PATROL code | Preserve; no Petalwake water copy |

The above inventory is *not* a claim that every asset is currently selected for runtime draw; runtime activation depends on manifests, texture loader, camera visibility and local rendering settings. No license-incomplete third-party asset was added.

## Runtime safety and performance

- The existing street clearance, shoreline guards, route geometry, collision, materials and signal timings are untouched.
- A bridgehead street-fixture chunk is limited to 8 already-supported fixtures; other NYC chunks to 12, on top of the existing bridgehead cap of 22 and global Manhattan cap of 82. No new mesh resources are allocated per fixture and no new renderer passes are introduced.
- **Measurable expectation, not verified FPS:** fewer decorative fixture quads/beams in overly dense areas, with identical road/vehicle paths. CPU budget map is bounded by the number of existing candidate locations; compare draw calls and FPS under the same camera before/after.
- No global terrain quadtree, weather particles or post-processing integration: Petalwake's pipelines are Three.js-specific and require separate compatibility/performance measurements. Do not call them implemented.

## QA

Run:
```
node --test tests/nyc-petalwake-chunk-lod.test.mjs tests/nyc-brooklyn-street-furniture.test.mjs tests/nyc-road-clearance.test.mjs
```

Then existing Brooklyn Bridgehead WebGL workflow: same viewport and camera matrices from `scripts/nyc-road-browser-smoke.mjs` on base and PR; report actual screenshot filenames, measured render times and any browser console failures. Compare `streetFurniture`, `brooklynStreetFurniture` and rejected road/shore overlaps, not merely whether Chromium starts. Test low quality separately. A successful legacy smoke does not verify this code until its job head SHA matches the latest commit.
