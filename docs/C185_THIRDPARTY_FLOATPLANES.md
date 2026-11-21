# Cessna 185 twin-float third-party model: source/rights/geometry gate
2026-11-21 · **Draft audit only** · owner: Cessna 185 third-party realistic model line.

## Non-negotiable constraints
- Keep **main**, **index.html**, flight physics, C185 game selectors and current playable aircraft intact.
- No new GLB, textures, scripts or paid licenses imported into the game's runtime.
- Do not call an unrelated four-seat high-wing floatplane an exact Cessna 185 (the 185 is a six-seat type).
- All model geometry and rights claims below must be checked against actual downloaded files, not just page previews.
- Sketchfab public model-preview payload is not an authorized replacement for official download archives.

## Existing playable model baseline
- PATROL already owns `assets/aircraft/cessna185-floats.glb` (179,472 bytes) and editable `.blend` scene (182,424 bytes).
- The reproducible, metric Blender authoring script is `tools/blender/cessna185_floatplane.py`. It contains **original procedurally authored geometry** with a 10.922 m span and dual **approximated** EDO-style floats, not manufacturer CAD or a borrowed third-party model.
- `assets/aircraft/floatplane-glb.js` is a **restricted custom triangle decoder**: FLOAT32 position accessors, baked no-transform mesh nodes, <2 MB bytes, <50,000 tris, and no texture/animation display. Replacing native GLB with generic glTF+PBR would be unsafe. This audit does not alter it.
- Independent source audit downloads original binaries only onto the free ephemeral GitHub runner and compares triangles, source rights, named float components, geometry bounds, textures, LOD, and source SHA-256.

## Source shortlist (producer metadata pending actual-binary audit)
| Candidate | Public source | Publisher rights | Publisher file/poly | Fit caveat |
| --- | --- | --- | --- | --- |
| Sketchfab **Cessna185** by **manilov.ap** | https://sketchfab.com/3d-models/cessna185-6453c2d8d08d4be6b08412794e28b152 | CC Attribution shown publicly (likely CC BY 4.0; official metadata must settle exact version) | Actual original package unverified; public web access returns 403 | Historical landplane page; no evidence of two floats; must not use preview meshes bypassing download authentication |
| 3DAssets **High Wing Single On Floats** | https://3dassets.dev/assets/aircraft-fleet-and-airfield-high-wing-single-floatplan-0000d31a | Contributor CC0, AI-assisted, no credit required | 748,272 B, 18,674 tris, 20 meshes, 10 materials, 0 embedded textures, 9 animation clips, 11.161 × 3.417 × 9.346 m | Real-looking generic **four-seat** high-wing, NOT a C185. No existing LOD stated. Flat palette materials, not PBR texture detail |
| 3DAssets **Twin-float utility plane** | https://3dassets.dev/assets/transport-collection-hd-floatplane-9c7c2a36 | Contributor CC0, AI-assisted | 243,372 B, 4,920 tris, 9 meshes, 7 materials, 0 textures, 9.4 × 3.04 × 6.57 m | Smaller trainer, lacks C185 10.922 m wingspan; no manufacturer identity |
| Innerscene **4-seat twin floats** | https://www.innerscene.com/tools/library/3d-parts/high-wing-4-seat-floatplane-twin-floats-8fde8873 | Publisher claims original CC0 with redistribution and modification | about 515 KB, 11 × 4.25 × 9.14 m nominal | Original format GLB available via public download endpoint, uncertain actual triangle/material budget and float details |
| Innerscene **amphibious twin floats** | https://www.innerscene.com/tools/library/3d-parts/high-wing-4-seat-on-amphibious-floats-4be93185 | Publisher claims original CC0 | about 617 KB, same nominal dimensions as above | 4-seat generic, amphibious undercarriage != straight float C185. Geometry not yet audited |
| FlightGear C172P float variant | https://github.com/c172p-team/c172p | GPL-2.0 and individual contributor credits | Mesh/texture package not audited here | **Cessna 172P, not 185**; multiple texture authors and GPL redistribution/source obligations. Not a plug-and-play 185 import |
| Grab3D generic CC0 seaplane | https://grab3d.com/models/vehicles/seaplane/ | Publisher CC0 claim | Styles and dimensions vary | Stylized cartoon-like source is **not** automatically an upgrade; no approval |

## Real aircraft measurement and waterline
Wipaire (manufacturer) Wipline 3000 Cessna 185 reference:
https://www.wipaire.com/wp-content/uploads/2018/06/Cessna-185-rev-4-18.pdf

- Published dimensional drawings describe around 36 feet of wingspan for this installation. PATROL baseline's 10.922 m span is consistent with C185 scale.
- Reference data describes **two separate stepped floats** with spreader bars, diagonal struts, nose, keel, water rudders and (amphibious only) retractable wheels. Keep straight-float and amphibian variants distinct.
- A glTF model's bounding `minY=0` is **not the loaded floating waterline**. Proper waterline requires hull step/buoyancy geometry, in-game water-contact screenshots and pitch/roll checks. No such result is claimed from static GLB metadata.
- Source manufacturer photos/drawings are **references only**; they are not licensed downloadable meshes and must not be distributed as model geometry.

## Release gate
All must be true before a future, separately authorized *production* PR:
1. Exact model identity (C185 6-seat), official source package retrieved through authorized download; publish source author, exact license version, attribution/modification credits and any texture third-party provenance.
2. Two separate correct float hulls and struts in the inspected geometry, not just description; Wipaire-compatible scale and waterline set from measured hull geometry.
3. Fuselage/cockpit/door/proportions close to a 185, not a C172 or generic four-seat silhouette.
4. Browser-budget check against current 179 KB, <50k-triangle strict decoder; visible high-detail hero with custom LOD and efficient materials. **A current-player asset swap cannot happen by copy/paste of glTF.**
5. Near camera, exterior, water-contact, dock and low-flight real WebGL screenshots, stable browser frame timing, and low-preset fallback. Preserve all other aircraft and maps.
6. No change to `main`, `index.html`, aircraft physics in *this* research branch; do not merge generic models for their CC0 license alone.

## Reproducibility
Workflow: `.github/workflows/c185-thirdparty-asset-audit.yml`; parser: `tools/aircraft/audit-third-party-c185.mjs`. Report artifact:
`c185-thirdparty-original-source-audit`. No binary is committed to the repository, whether downloaded successfully or not.
