# Scenario for Blender → Chongqing Hongyadong

**Status:** An actual review-only GLB was generated using **Blender 5.2.1** in [GitHub Actions run 44853187676](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/44853187676) and committed to `assets/chongqing/generated/hongyadong-study.glb`. The 972,500-byte model contains **13,808 triangles**, 7 glTF materials and **no photo texture images**; SHA-256: `2998ef1a88ce3065ad94528152911af286b507f796e69756f4da3b6f6fed41c9`. [Publishing run](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/44853333799) passed. No paid Scenario cloud generation, photoreal texture review, or measured GPU FPS has been performed. **The production Chongqing map still uses its original geometry; the model is opt-in preview only.**

## Files

- Local Blender authoring script: `tools/blender/chongqing_scenario_author.py`
- Official MIT-licensed Scenario Skill: `.agents/skills/scenario-blender/SKILL.md`
- Chongqing project skill: `.agents/skills/patrol-scenario-chongqing/SKILL.md`
- Optional Three.js GLTFLoader bridge: `assets/chongqing/scenario-assets.js`
- Disabled-by-default manifest: `assets/chongqing/scenario-manifest.json`
- Reversible Hongyadong instance-index hiding: `assets/chongqing/details.js`
- Node tests: `tests/chongqing-scenario.test.mjs` and `tests/chongqing-detail.test.mjs`

The loader accepts only a reviewed same-origin `generated/*.glb`, max 8 MiB and 25,000 triangles, with embedded buffer/images. Before hiding any old facade geometry, it must fetch and validate the GLB, decode it and check scene bounds. On failure, procedural geometry remains visible. The spatial/collision index, bridge, Raffles City, Liziba monorail, vendors, ships, hotpot controls and other maps are unchanged.

Hongyadong uses shared GPU instance batches. The replacement hides **only its exact facade/roof instance ranges** and preserves the matrices for rollback. Disabling the entire shared batch would otherwise hide bridges and unrelated street details.

## Run offline Blender study (no paid generation)

Install official Blender **5.0+** and from the repository root run:

```powershell
blender -b --python tools/blender/chongqing_scenario_author.py -- --output assets/chongqing/generated/hongyadong-study.glb
```

Output is a review-only GLB of eleven terraced levels, recessed windows, dark roofs, balconies and timber details. The output has not been executed or rendered here. The model uses PATROL's compressed game geometry: game anchor X=155, Y=13, Z=112 with unity scale; Blender local Y is inverted for game Z by GLB export. It is **not** a surveyed, physically accurate Chongqing city scan.

Optional Scenario-created, licensed PBR textures can be referenced by local path under `tools/blender/scenario-material-inputs.json`. Check actual GLB normals, colors, UVs, lighting, collision alignment, GPU performance and provenance before publishing it.

## Connect the official Scenario MCP on your Windows computer

1. Install the official extension from https://github.com/scenario-labs/blender-plugin or its repository `https://blender.scenario.com/repo/index.json`.
2. In Blender, enable online access and sign in. Open **Scenario → Agents (MCP) → Connect Codex**.
3. In your local Codex session, load the two repository skills above, inspect the scene with `scene_summary`, and only then proceed to model editing.
4. Use your actual local MCP endpoint shown by Blender; it often starts with `http://127.0.0.1:9876/mcp` but can use another port. Keep session tokens and API keys out of chat and GitHub.
5. Get the exact quoted Creative Units price and your explicit approval **before any paid Scenario generation**. Do not enable arbitrary MCP `execute_python` without a separate opt-in.

The browser game does not run Blender, Scenario MCP or any paid Scenario service.

## Preview, activate, roll back

Once a **real, rights-cleared** model is present at `assets/chongqing/generated/hongyadong-study.glb`, serve the repo locally and visit:

```text
http://localhost:8000/chongqing.html?scenario=hongyadong
```

After committing the model, the same preview is available through:

https://bhu103-data.github.io/patrol-flight-sim/chongqing.html?scenario=hongyadong

The query string requests the existing Blender model only; it does not generate new models or spend Scenario credits. The review GLB now exists in GitHub, so the browser may load it. If loading fails, the original procedural geometry remains visible. Actual rendering quality and browser GPU FPS still require review.

After real-game visual testing, FPS checks, geospatial placement and license review, set the manifest's `enabled` to `true` and enter a verified `license` statement. To revert production, set `enabled` to `false` and remove the preview query. The original geometry remains recoverable.

## Regression checks

```powershell
node --test tests/chongqing-scenario.test.mjs tests/chongqing-detail.test.mjs tests/chongqing-landmarks.test.mjs tests/chongqing-visual.test.mjs
```

GitHub Actions executes script syntax and Node tests. These **are not** proof of an actual Blender viewport render, full WebGL screenshot, frame-rate benchmark or 1:1 photographic accuracy.
