---
name: patrol-scenario-blender
description: Create and review Blender/Scenario high-detail Manhattan landmark GLBs for PATROL's WebGL2 flight sim. Use when updating NYC visual realism with Scenario for Blender MCP.
license: MIT
---

# PATROL + Scenario for Blender

Official extension: https://github.com/scenario-labs/blender-plugin (GPL-3.0-or-later).
Official MCP skill: https://github.com/scenario-labs/skills/tree/main/skills/scenario-blender (MIT).
This project skill is a PATROL-specific adapter, not a bundled copy of the extension.

## Preconditions

- Work on the existing `bhu103-data/patrol-flight-sim` repo; preserve other maps, air controls, ship and bridge collision.
- Check Blender version >=5.0 and Scenario extension enabled. Read current Blender scene with `scene_summary` if `scenario-blender` MCP is connected.
- Use the actual MCP endpoint shown in Blender > Scenario > Agents (MCP); commonly `http://127.0.0.1:9876/mcp`. Never assume this remote/chat session can reach the user's localhost.
- MCP token and Scenario key stay on the user's machine. Never commit or quote them.
- Review any Scenario generation's quoted price and get the user's approval *before* submitting paid work. Never run `execute_python` without the user's separate opt-in to Python execution.
- Use licensed reference photography, NYC official architectural facts and original assets; never scrape Google Maps photogrammetry.

## Priority

1. One World Trade Center: square base -> octagonal transition -> rotated-square crown, glass segmentation, rooftop mast.
2. Empire State: stepped limestone shafts, art-deco piers, layered window recesses.
3. Statue of Liberty: correct copper drapery, crown, torch, pedestal and weathering.
4. Chrysler, Flatiron, One Times Square.
5. Brooklyn Bridge / vehicles / boats: keep existing procedural geometry until a separate loader and model-placement contract is implemented.

## Workflow

1. Inspect existing geometry and `assets/nyc/scenario-manifest.json`; pick one enabled=false landmark.
2. Generate or edit a model through the connected Scenario for Blender tools only after approving cost. Check viewport render and silhouette against permitted reference material. Do not promise photogrammetric 1:1 accuracy.
3. Keep only the meshes to export under a Blender collection named `PATROL_EXPORT`, centered in local horizontal coordinates, vertical Y-up on GLB export. For textured models UV-unwrap and bake material Base Color into **one PNG/JPEG atlas**, exported embedded in the GLB with TEXCOORD_0; optionally add COLOR_0 vertex colors. PATROL now renders one Base Color atlas per GLB and baseColorFactor but does not yet support normal/metalness/roughness bitmap channels or multiple diffuse atlas images.
4. Export in a desktop Blender session:

   ```powershell
   blender -b PATROL.blend --python tools/scenario_blender_export.py -- --asset trade --collection PATROL_EXPORT --license "Original artwork; commercial use confirmed"
   ```

5. Inspect the GLB and provenance. Only after approval run the same command with `--activate` to enable the manifest entry. Keep `assets/nyc/scenario/` files <=8 MiB and <=25,000 triangles per landmark.
6. Commit the GLB and the updated manifest. Confirm the same-origin asset loads under GitHub Pages, test Free Flight and Scenic Views, and check silhouette, z-fighting, collision, shader state and FPS. If any issue, set `enabled:false` to fall back immediately.
7. Never write Scenario API credentials or local MCP bearer tokens into `.env`, README, manifests or source. Do not auto-spend cloud credits.

## Output contract

Report exactly which GLB file was generated, whether it is activated, GitHub commit, visual test status, and what remains unverified. No claim of AAA or survey accuracy without independent measurement.
