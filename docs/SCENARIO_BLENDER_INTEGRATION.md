# Scenario for Blender → PATROL Manhattan assets

This project supports optional high-detail GLB replacements produced in Blender. **It does not install Blender or the Scenario extension on your computer, and does not submit paid Scenario jobs.** The current public game continues using its existing procedural models until you explicitly activate a reviewed exported model.

## Official sources and requirements

- Scenario extension (Blender 5.0+): https://github.com/scenario-labs/blender-plugin
- User guide: https://github.com/scenario-labs/blender-plugin/blob/main/docs/USER_GUIDE.md
- Local MCP: https://github.com/scenario-labs/blender-plugin/blob/main/docs/MCP.md
- Scenario agent skills (separately licensed MIT): https://github.com/scenario-labs/skills
- Scenario extension is GPL-3.0-or-later. This repo only links to it and does **not** redistribute extension code.
- Scenario may use cloud inference and paid credits; get a quote and explicit approval before running any model. Your local agent can read open scenes. `execute_python` must remain disabled unless consciously enabled and needed.

## Install on the Windows Blender machine

1. Install official **Blender 5.0 or later**. In Blender: Edit → Preferences → System → Network → **Allow Online Access**.
2. Open Edit → Preferences → Get Extensions → Repositories → **Add Remote Repository**, then add:
   
   `https://blender.scenario.com/repo/index.json`
   
   Find and install **Scenario** under Get Extensions. Alternatively use the official ZIP from https://github.com/scenario-labs/blender-plugin/releases ; keep a ZIP copy and repository copy from coexisting.
3. Open the Blender viewport, press `N`, open **Scenario**. Sign in through the Scenario browser flow or provide your own API key and secret *in Blender's preferences only*. Choose your project and output directory. Do not paste credentials into this repo, Codex prompts, or GitHub issues.
4. Open Scenario → **Agents (MCP)**. Enable the local server and use the **Connect Codex** control, which handles the active loopback URL and token. The endpoint is commonly `http://127.0.0.1:9876/mcp`, but may use another port: use the URL shown by your Blender session.
5. Check Codex's MCP connection, then load this repository. Codex can discover `.agents/skills/patrol-scenario-blender/SKILL.md` for project-specific rules. The official Scenario skill can be installed separately from the upstream MIT-licensed skills repository; our local project skill is not a global install.

**Optional Codex CLI example (PowerShell on the same Windows computer):**

```powershell
# Copy the current session token locally from Scenario > Agents (MCP).
# Never paste the token in chat or a public terminal log.
$env:SCENARIO_BLENDER_TOKEN = Read-Host "Scenario MCP session token"
codex mcp add scenario-blender --url http://127.0.0.1:9876/mcp --bearer-token-env-var SCENARIO_BLENDER_TOKEN
codex mcp list
```

If the extension shows a different port, replace 9876. Tokens rotate on Blender restart; reconnect or refresh the environment variable after restarting. Do not expose the local MCP server outside `127.0.0.1`.

## Build the first landmark

1. Choose **One World Trade Center** (`trade`) as the first hero asset. The priority is its shape, glazing and roof silhouette, not cosmetic street details.
2. In Scenario for Blender, create or refine the mesh with a distinct square podium, tapering eight-facet glass shaft and rotated-square top. Use licensed reference images only. Ask for a price quote before generation.
3. Inspect the model in Blender Material Preview. Clean topology, merge unnecessary interior faces, verify normals, UVs and proportions. UV-unwrap the mesh and bake the visible **Base Color** material into **one embedded PNG/JPEG texture atlas** on TEXCOORD_0. The PATROL renderer now reads that atlas alongside geometry, glTF baseColorFactor and optional COLOR_0 vertex colors. Other untextured surfaces may use ordinary baseColorFactors. Multiple separate Base Color textures, UV transforms and normal/metallic/roughness bitmap channels are not yet supported.
4. Move the finished asset to a Blender collection named `PATROL_EXPORT`. The object's horizontal center should be its own origin; PATROL scales it to the current gameplay height and positions it using the existing landmark transform. Do not flatten it to world coordinates, or overwrite source mesh transforms elsewhere.
5. Save as `PATROL.blend` in the repository, or point `blender` at another absolute Blender file.

Run in the repository's working directory:

```powershell
blender -b PATROL.blend --python tools/scenario_blender_export.py -- --asset trade --collection PATROL_EXPORT
```

This creates `assets/nyc/scenario/trade.glb` and validates its 2.0 container, triangle budget and size. It remains disabled initially.

After visual inspection and provenance review, activate it explicitly:

```powershell
blender -b PATROL.blend --python tools/scenario_blender_export.py -- --asset trade --collection PATROL_EXPORT --activate --license "Original generated artwork; public redistribution permitted"
```

This updates `assets/nyc/scenario-manifest.json` with `enabled:true` and the license statement; commit both changes to GitHub. Only then will `assets/nyc/nyc-realism.js` load the asset in Manhattan. Other maps are unchanged.

## Models and budgets

| ID | Model | Game-model height (not metres) | Minimum triangles |
|---|---|---:|---:|
| `trade` | One World Trade Center | 77 | 600 |
| `empire` | Empire State Building | 79 | 700 |
| `liberty` | Statue of Liberty | 31.3 | 500 |
| `chrysler` | Chrysler Building | 68 | 600 |
| `flatiron` | Flatiron Building | 17 | 450 |
| `times` | One Times Square | 35.6 | 500 |

Each GLB is limited to **8 MiB and 25,000 triangles**; the runtime currently supports standard GLB 2.0 triangle meshes, embedded base-color factors, vertex colors and **one embedded Base Color PNG/JPEG atlas** (max 4 MiB embedded source, resized to 1024 px GPU). Normal/roughness/metalness bitmap rendering is not supported yet. Keep a low-LOD version for distant flight in future asset work. Do not put API credentials, paid model download links, or unlicensed source imagery in Git.

### Quality and rollback

- The original procedural model remains available. If a model fails to load, fails the quality gate or loses its GPU context, game rendering should fall back to its existing asset.
- For immediate rollback, change its `enabled` to `false` in `assets/nyc/scenario-manifest.json` and deploy. Do **not** delete the fallback procedural geometry.
- Test on the published https://bhu103-data.github.io/patrol-flight-sim/ using **Manhattan → Free Flight**, plus **Scenic Views** for the relevant landmark. Watch for scale, rotation, material color, shadowing, black-screen errors, memory use and FPS.
- PATROL's map uses compressed fictional gameplay coordinates. GLB assets with a visually realistic form cannot make the whole NYC map physically **1:1** without independent geospatial data and a scale-system rebuild.
- Brooklyn Bridge, ships and moving traffic need their own optional GLB placement/animation adapters before Scenario outputs can replace them. Do not mislabel building-asset support as full bridge/vehicle support.

## Verify the import pipeline before enabling a model

- [Real WebGL2 GLB texture smoke test](https://bhu103-data.github.io/patrol-flight-sim/tools/scenario_glb_selftest.html) generates a temporary triangle GLB with an original embedded PNG, uploads its UV atlas and samples a rendered pixel. A green square and `PASS` mean the production decoder actually displays the Base Color map in that browser. It separately verifies that external image URIs are rejected. The page does not require Blender, logins or cloud credits.
- Run `node --test tests/scenario-glb.test.mjs` for the native loader's CI checks: textured quad, remote URI rejection, multi-atlas rejection and missing UV rejection. GitHub Actions automatically checks it for relevant asset changes.
- An in-memory sample GLB **does not** prove an actual Scenario/Blender model is accurate or optimized. After exporting a landmark and enabling it explicitly, verify its real shape, UV seams, color space, correct collision alignment, lighting, memory and FPS in Manhattan.
- If a new Pages file is temporarily 404 during rapid commits, inspect the **pages build and deployment** GitHub Actions runs; canceled builds do not serve newly committed files until a later successful deployment.



## Review an exported GLB without publishing it

Use the [local Blender model preview](https://bhu103-data.github.io/patrol-flight-sim/tools/scenario_model_preview.html) **before** enabling the asset in `scenario-manifest.json`.

1. Open the preview. It initially displays the repository's existing bundled Statue of Liberty GLB, so the WebGL renderer can be checked without installing Scenario or generating anything paid.
2. Choose the target landmark (its current *gameplay-scale* height), then choose your exported `.glb` file. The file is processed **in your browser only** — no server upload, account access or API key.
3. Rotate the model by dragging, zoom with the mouse wheel or slider, use the model angle slider, and examine the silhouette, UV seams, diffuse color, roof, crown and width/depth proportions.
4. Record the reported triangle count, footprint, height, diffuse atlas status and parse/upload duration. Click **Save review screenshot** and compare it against legally usable architectural references.
5. If the renderer says FAIL (unsupported material, external texture URI, missing UV, excessive size or invalid GLB), fix the Blender export and re-preview. **Do not enable the manifest asset solely because a file exists.**
6. After satisfactory visual QA, use the existing audited export command with `--activate`, commit both the .glb and manifest, then inspect it inside Manhattan's Scenic Views camera.

Preview limits: one embedded Base Color PNG/JPEG atlas per GLB, currently downscaled to a 1024 px GPU texture; up to 8 MiB source and native GLB triangles. The viewer is a read-only staging tool, not a shared 3D asset store and not proof of geospatial 1:1 fidelity.

