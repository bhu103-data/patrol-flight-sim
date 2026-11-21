# PATROL · two-player-aircraft runtime and CC0 fighter GLB review

**Isolation:** `review/two-aircraft-fleet-and-cc0-jet-20261121` derived from integration commit `6d50bfda4b2d3837e550751ede49b200b140bc72`. **NOT MERGED**. No `main` or shared integration branch changes, no deletion of old source functions or model files, no flight physics/collision adjustments.

## 1. Active player aircraft — exactly two

There is **no existing external JSON runtime aircraft manifest** in this build. `index.html` is the actual user-facing aircraft radio selector, `AIRCRAFT` flight stats registry and `aircraftMeshes` GPU mesh registry. The new `assets/aircraft/active-fleet.json` is a **documentation/provenance inventory**, cross-checked by tests; it does not add a second competing runtime manifest loader.

| Player aircraft | Current integrated mesh | Origin / license | Geometry / metric size | State |
|---|---|---|---|---|
| **Viper Jet** (`fighter`) | `index.html::buildFighterMesh()` | Original fictional PATROL procedural art; no third-party author/texture | **700 triangles** measured by invoking the actual source mesh-building function against a triangle counter; X 4.34, Y 1.16, Z 4.60 **game units**, NOT 1:1 metres; no bitmap/PBR textures, local shader per-triangle colors | **ACTIVE**. All 4 combat hardpoints/missile/flight controls retained |
| **Cessna 185 Floatplane** (`seaplane`) | `assets/aircraft/cessna185-floats.glb`, source `.blend`, authoring `tools/blender/cessna185_floatplane.py`, decoder `assets/aircraft/floatplane-glb.js`; procedural fallback `index.html::buildCessna185FloatMesh()` | Original PATROL Blender authoring; approximated float/airframe, **not certified Cessna CAD** | **179,472 bytes, 3,736 tris, 10.922 m span, 7.8105 m length**, ~3.665 m high bounding box. Blender vertex normals, RGB materials, **0 embedded texture images** | **ACTIVE**. Global cross-map water taxi/touchdown/recovery preserved |

**Archived without deleting source:** `saucer` / UFO (`index.html::buildSaucerMesh()`), `jetpack` / Mark 42 Armor (`index.html::buildJetpackMesh()`). Removed their **radio controls**, live `AIRCRAFT` entries and **eagerly allocated GPU meshes**; the original builder sources remain in the same file and are not called. Unknown/old radio selections fall back to Viper; launching Chongqing only passes `fighter` or `seaplane` instead of deprecated `jetpack` ID.

**Cross-map limitation:** Chongqing has an independent Three.js game and still shows its legacy hotpot **humanoid pilot avatar** for non-seaplane flight. This is NOT a third selectable aircraft, but also **not the identical Viper mesh**; the change only aligns the bridge's aircraft metadata and preserves the prior gameplay. Do not claim two identical visuals across every map. Non-player ambient aircraft/background scenery elsewhere are unrelated to the player fleet and not deregistered.

## 2. New realistic-looking source, licensed and **actually downloaded + rendered**

**Candidate:** [Stealth Fighter v1 by tevy](https://tevy.dev/models/stealth-fighter).
- **Publisher/creator:** tevy public asset collection; no separately named mesh artist. tevy explicitly publishes this **original fictional, unbranded** stealth twin-tail jet under **Creative Commons CC0 1.0**. Public GitHub redistribution/derivative use permitted without attribution under the publisher's CC0 claim. Not an F-15, F-22 or certified Viper reproduction. [CC0 legalcode](https://creativecommons.org/publicdomain/zero/1.0/).
- **Original source is free / no login:** permanent version-pinned `https://tevy.dev/models/stealth-fighter/v1/lod{0,1,2}.glb` and [published model hash+size index](https://tevy.dev/models.json).
- **Actual publisher file verification:** free GitHub Actions downloaded all three original GLBs; checks actual SHA-256/byte count and indexed triangle counts against the source's official manifest. All pass. Not merely a screenshot or a model page guess.
- **Original source metrics** (with embedded KTX2 PBR color/normal/ORM images):
  - LOD0: **1,750,204 bytes, 40,467 tris, 25 material entries, 3 KTX2**; SHA-256 `94df90b86313ef38c4713de502bf1c8cd51a43021602b1a0595f28de112b18e3`
  - LOD1: **631,756 bytes, 13,269 tris, 25 material entries, 3 KTX2**; SHA-256 `1ea0d82a1e84b3f96b7f9c667617854416da5c8abfb534435d2196609472463a`
  - LOD2: **229,388 bytes, 3,976 tris, 17 material entries, 3 KTX2**; SHA-256 `b3c1b2c9f8a1a768c1d2fc8e19614101ebc2023641d61ea983c35185ea3c8dee`
- Source requires `EXT_meshopt_compression`, `KHR_mesh_quantization`, `KHR_texture_basisu`. The **current PATROL flight runtime does not support these extensions or GLTF PBR texture mapping**, and converting to only RGB surface color would discard the source's realism. **Not enabled or copied into live assets.** Original archives remain in read-only GitHub Actions artifact.
- **Real isolated browser GLB import passed:** `tools/aircraft/preview-cc0-fighter-webgl.mjs` invokes actual Three.js `GLTFLoader` + `MeshoptDecoder` + `KTX2Loader` against original LOD1 and LOD2 GLBs in Chromium SwiftShader WebGL2. Physical bounds LOD1 = **11.6949 × 3.9404 × 18.0845 m**, original author says 11.7 × 3.95 × 17.72 m (difference within source bounds test). **50 model meshes, 25 unique used materials, 3 unique texture handles, 10 normal-mapped mesh material uses**, model pixels visibly present. LOD1 source mesh **13,269 tris**, scene including ground grid **~26,542 rendered tris, 104 draw calls**. The background-minus-model ROI changed **38,723 pixels**, mean subject brightness ~79.72/255. LOD2 also passed with **3,976 source triangles**. Screenshots available in artifact.
- **Do not claim real GPU fps:** the renderer is **GitHub Ubuntu headless Chromium with SwiftShader**; browser frame timestamps include a ~1.08-second outlier. Windows Chrome hardware performance, PATROL runtime PBR, and model conversion to existing `aircraftMeshes` are **not tested**. No runtime swap approved.

**Deliberately rejected for runtime import now:** [Innerscene CC0 F-15-style jet](https://www.innerscene.com/tools/library/3d-parts/f-15-eagle-fighter-jet-e1d11142) publisher advertises **2.8 MB, about 48k triangles and 4K UV textures**: exceeds the current C185-like 2MB source budget, and would replace a fictional Viper with an inappropriate real aircraft name, so no original source import was attempted. [tevy Delta Fighter](https://tevy.dev/models/delta-fighter) is a different single-engine canard/delta silhouette and was not downloaded.

**Cessna 185:** previous [Draft PR #80](https://github.com/bhu103-data/patrol-flight-sim/pull/80) established that the Sketchfab CC BY 4.0 C185 is a **landplane**, official GLB download needs authorized login, and generic floatplanes fail precise airframe identity. Per request, we **did not repeat** those source audits or substitute other aircraft.

## 3. Directed tests actually run

GitHub Actions on this isolated branch:
- `node --test tests/two-aircraft-active-fleet.test.mjs tests/floatplane-global.test.mjs tests/cessna185-seaplane.test.mjs` **PASS**, including original 3,736-triangle Blender GLB, dimensions and runtime registry.
- `node --check tools/aircraft/{audit-cc0-stealth-fighter,preview-cc0-fighter-webgl,two-aircraft-browser-smoke}.mjs` **PASS**.
- `node tools/aircraft/audit-cc0-stealth-fighter.mjs` **PASS** in CI after source downloads.
- `node tools/aircraft/preview-cc0-fighter-webgl.mjs` **PASS**; original PBR source loaded, both model screenshots not black, no page/console errors.
- `node tools/aircraft/two-aircraft-browser-smoke.mjs` **PASS**; actual `index.html` game: two chooser entries, both launch in **NYC**, both actual screenshots nonblack, no page/console errors, C185 original GLB returned **HTTP 200 / 179,472 bytes** and original Blender load message appeared. Viper chase screenshot is the existing procedural mesh; the CC0 model is only in its own preview.

**CI run and attachments:** https://github.com/bhu103-data/patrol-flight-sim/actions/runs/44924873645
- `two-active-aircraft-live-game-webgl2`: two actual Manhattan flight screenshots + JSON.
- `fighter-cc0-source-real-webgl2-preview`: LOD1/2 source GLB 3D screenshots, all three original source binaries, verified hashes/metadata + JSON; all **review-only**.
- Tests run in free GitHub-hosted Linux Chromium **software WebGL2**. They are not user's local Windows Chrome, direct GPU screenshot or full all-map performance regression.

## 4. Central QA fixed capture conditions

1. **Actual game Viper**: NYC Manhattan map, `fighter`, default **CHASE** camera (`viewIdx=0`), no keyboard control, selected hero spawn `x=-108,y=48,z=-594`, yaw=0; `1152×720` framebuffer, default environment and quality. The aircraft moves automatically at 23.5 game units/sec; capture at **first confirmed flight frame** (check GPS/position timestamp if pixel-accurate A/B).
2. **Actual game C185**: same map/CHASE/viewport, `seaplane`, no water-start, same initial spawn `x=-108,y=48,z=-594`, yaw=0; wait for `[PATROL] Blender Cessna 185 loaded` message before capture. The C185 descends toward harbor automatically; the tested screenshot displayed `FLOATS · WATER LANDING · APPROACH LEVEL`.
3. **Isolated third-party jet**: original GLTFLoader 960×540, fov 42°, sky `#b4cdda`, fixed floor/grid, sun and hemisphere, camera scaled from actual world bounds at `(size.x*0.86,size.y*1.55+5,size.z*0.94)`, aimed at `y=size.y*.42`. Same view LOD1 and LOD2, compare matte paint, canopy and control surfaces. **Cannot use this screenshot as proof of PATROL integration.**
4. **Windows central QA**: use same branch in Windows Chrome hardware WebGL2, check texture mapping and actual GPU memory, draw calls, UI only two choices, all maps incl. Chongqing exception, performance/collisions, water start/touchdown, launch/recovery. Do not promote CC0 fighter without compatible runtime loader and genuine in-game before/after.

## 5. Minimal rollback / blocked upgrade

- Restore the two original archive radio labels, `AIRCRAFT` entries and original `aircraftMeshes` constructors from `6d50bfd` to revert this optional two-aircraft policy; the source builder functions, original C185 Blender/GLB and all existing map logic are still present.
- New external model is a verified, legally sourced **candidate only**. User explicitly requires quality and no fake completion: model is NOT yet a real PATROL player-craft GLB upgrade because source KTX2/Meshopt shading would be lost under the custom renderer. Need a separately reviewed, bounded material-aware import/conversion and actual Windows Chrome QA before replacing the fighter, not a silent runtime loader rewrite.
