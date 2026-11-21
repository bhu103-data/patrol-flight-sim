# Scenario for Blender → Chongqing Hongyadong

**Current status (three-wing phototextured Blender study, NOT a final AAA/photogrammetric model):** A real Blender 5.2.1 export from [build 44855993580](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/44855993580) produced the current review model at `assets/chongqing/generated/hongyadong-study.glb`, **3,843,360 bytes, 15,996 triangles, four embedded CC0 PBR images**, SHA-256 `f370dec62721dff86df8ee5123fd84c97b69e9cfa78be55df36a821830613c42`. The artwork now uses three separately offset Bayu-style stilt-house wings per level, nonuniform roof coverage, carved window galleries, photographic roof/wood/concrete materials and shadowed eaves. The [non-force published review asset](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/44856154286) and [actual Chromium WebGL2 validation](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/44856194125) both passed with `scenario=ready`, `webgl2=true`, and a captured 1280×720 game screenshot. The production manifest now has **`enabled:true` and a recorded original-geometry/CC0 photo license**, so the reviewed Blender GLB is the **default Hongyadong facade**. Users can explicitly select **`?scenario=original`** or use the in-game environment-panel button to restore the procedural building, with automatic fallback if the GLB cannot load. This is **not** a surveyed 1:1 city asset, paid Scenario cloud generation, calibrated global ray tracing or final accepted photoreal scene.

## Files

- Local Blender authoring script: `tools/blender/chongqing_scenario_author.py`
- Official MIT-licensed Scenario Skill: `.agents/skills/scenario-blender/SKILL.md`
- Chongqing project skill: `.agents/skills/patrol-scenario-chongqing/SKILL.md`
- Optional Three.js GLTFLoader bridge: `assets/chongqing/scenario-assets.js`
- Default-activated licensed model manifest: `assets/chongqing/scenario-manifest.json`
- Reversible Hongyadong instance-index hiding: `assets/chongqing/details.js`
- Node tests: `tests/chongqing-scenario.test.mjs` and `tests/chongqing-detail.test.mjs`

The loader accepts only a reviewed same-origin `generated/*.glb`, max 8 MiB and 25,000 triangles, with embedded buffer/images. Before hiding any old facade geometry, it must fetch and validate the GLB, decode it and check scene bounds. On failure, procedural geometry remains visible. The spatial/collision index, bridge, Raffles City, Liziba monorail, vendors, ships, hotpot controls and other maps are unchanged.

Hongyadong uses shared GPU instance batches. The replacement hides **only its exact facade/roof instance ranges** and preserves the matrices for rollback. Disabling the entire shared batch would otherwise hide bridges and unrelated street details.

## Run offline Blender study (no paid generation)

Install official Blender **5.0+** and from the repository root run:

```powershell
blender -b --python tools/blender/chongqing_scenario_author.py -- --output assets/chongqing/generated/hongyadong-study.glb
```

Output is the independently tested, locally reproducible 11-level Blender GLB with recessed window bays, photographed dark roofs, balconies and wooden stilt galleries. The script was actually executed in GitHub Actions (see build above). The model uses PATROL's compressed game geometry: game anchor X=155, Y=13, Z=112 with unity scale; Blender local Y is inverted for game Z by GLB export. It is **not** a surveyed, physically accurate Chongqing city scan.

CC0 PBR images used by the current export are declared in `tools/blender/chongqing-material-inputs.json` and fetched using `tools/blender/prepare_chongqing_cc0.py`; optional separately approved Scenario textures can still be authored without changing the license requirements. Check actual GLB normals, colors, UVs, lighting, collision alignment, GPU performance and provenance before publishing it.

## Connect the official Scenario MCP on your Windows computer

1. Install the official extension from https://github.com/scenario-labs/blender-plugin or its repository `https://blender.scenario.com/repo/index.json`.
2. In Blender, enable online access and sign in. Open **Scenario → Agents (MCP) → Connect Codex**.
3. In your local Codex session, load the two repository skills above, inspect the scene with `scene_summary`, and only then proceed to model editing.
4. Use your actual local MCP endpoint shown by Blender; it often starts with `http://127.0.0.1:9876/mcp` but can use another port. Keep session tokens and API keys out of chat and GitHub.
5. Get the exact quoted Creative Units price and your explicit approval **before any paid Scenario generation**. Do not enable arbitrary MCP `execute_python` without a separate opt-in.

The browser game does not run Blender, Scenario MCP or any paid Scenario service.

## Default Blender facade, preview and explicit rollback

The rights-cleared and checksum-verified model is now already committed. Serve the repo locally; the **normal route** loads the Blender facade:

```text
http://localhost:8000/chongqing.html
```

The corresponding production URL is:

https://bhu103-data.github.io/patrol-flight-sim/chongqing.html

The same model can be forced for inspection with `?scenario=hongyadong`; use `?scenario=original` to force the pre-Blender facade. The environment panel also has a reversible Blender/Original switch. Neither option calls paid Scenario services. A failed GLB fetch, decode or geometry validation leaves the original procedural scene intact. Photographic accuracy, topographic registration and real GPU FPS remain beyond this validation.

The reviewed model is already enabled. For global emergency rollback, set `assets/chongqing/scenario-manifest.json` `hongyadong.enabled` to `false`; all original geometry and collision remain recoverable. Individual users can just switch to `?scenario=original`.

## Regression checks

```powershell
node --test tests/chongqing-scenario.test.mjs tests/chongqing-detail.test.mjs tests/chongqing-landmarks.test.mjs tests/chongqing-visual.test.mjs
```

GitHub Actions executes Blender 5.2.1 in headless mode, GLB dimensional/budget validation, Node regression tests, and Chromium WebGL2 rendered screenshots. These verify execution, **not** 1:1 survey or AAA photorealism. Performance and collision calibration still require review on user hardware.


## Verified photographic inputs (Blender PBR review)

- Wood photo: `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/wood_planks/wood_planks_diff_1k.jpg` (SHA-256 `3b0669f683e4bf10f5a55a381cfa9669a7b8dfd921901829daa3b35acc2bbdec`).
- Clay roof photo: `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/clay_roof_tiles_03/clay_roof_tiles_03_diff_1k.jpg` (SHA-256 `6719293429932a27c8ed3526b22cd65d1cd1d43194ce30fa5f4590bb3c513844`).
- Existing CC0 walls: `assets/nyc/concrete_wall_008_diff_1k.jpg` and `concrete_wall_008_nor_gl_1k.jpg` (credited in `assets/nyc/PBR_TEXTURE_SOURCES.md`).

The downloaded source photos are temporary and not checked in; Blender embeds the required images in the review GLB. The renderer still uses only approved base PBR materials, not a real city scan. The manuscript keeps initial collision volumes for safe preview. The PBR GLB is suitable for inspection, not proof of survey accuracy, realistic street-level architecture or final game art acceptance.

**Update:** The current GLB is the three-wing 15,996-triangle build above; older 24,348-triangle measurements below apply only to the superseded curved-roof prototype.

## Final isolated browser verification — November 20, 2026 (New York)

- [Chromium WebGL2 workflow 44854557026](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/44854557026) **passed** on the shipped third-pass GLB; actual page state `scenario=ready`, WebGL2 true, log reported `bytes:4425416, triangles:24348, images:4` and returned an actual 1280×720 screenshot.
- Historical note: at the time of this earlier test the model was opt-in. It was later promoted to default with a recorded CC0 license and an explicit `?scenario=original` rollback.
- The browser screenshot is an accurate representation of the prototype's remaining limits: repetitive window/floor structure, coarse neighboring towers, compressed road/river geography, simplified bridge, and no high-resolution licensed photogrammetry. The review result does not mean AAA or 1:1 Chongqing.
- Separate repository-wide checks can fail for unrelated files under concurrent development; in particular, a One World Trade Center GLB decoder test reported nonfinite JSON and a Chongqing tower road-overlap test also failed. The isolated Chongqing Blender export and WebGL screenshot checks did **not** fail. Do not conflate these statuses.
