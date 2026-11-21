# PATROL NYC — Scenario for Blender authoring bridge

Official Scenario plugin: https://github.com/scenario-labs/blender-plugin

**This is an optional OFFLINE modeling and material-authoring workflow.**
The Blender extension is **not copied into PATROL**, and the browser never
executes Blender, the plugin, MCP, or Scenario's API.

## Prerequisites and license

- Blender **5.0 or newer**; install the Scenario extension only from
  `https://blender.scenario.com/repo/index.json` or verified official releases.
- The plugin uses **GPL-3.0-or-later**, and is experimental. The independent
  PATROL exporter script does **not** import or redistribute the addon.
- To generate new textures/models, Scenario needs a user-authorized account
  and API access. Calls can consume **Creative Units**; check costs before
  running a generation. Never commit API keys, passwords, tokens, or output
  assets whose redistribution licenses are unclear.
- The plugin's local MCP server requires a running and authorized Blender
  scene. It is not available inside this ChatGPT conversation; no paid
  model generation or local installation has been performed here.

## Author real materials rather than repeating flat wall paint

Make **original, seamless** 2K PBR textures in Scenario, selecting
material style per scene type. Suggested material briefs:

| Type | Visual brief |
|---|---|
| limestone | Indiana limestone / layered pale masonry, warm-grey stone, subtle bedding and weathered mortar joints |
| glass | Manhattan tinted curtain wall, fine dark metal mullions, neutral blue-grey glazing |
| brick | Weathered NYC masonry brick, realistic grout, medium roughness, restrained staining |
| terracotta | 1920s ornamental terracotta, warm glazed ceramic, chipped high-frequency edge detail |
| metal | NY architectural aluminum/stainless steel paneling, anisotropic brushed grain |
| concrete | Sidewalk granite and grey poured concrete, aggregate variation, soft worn edges |

Use Scenario's Blender UI to generate PBR image maps and export them to
a local folder. Set their paths relative to
`tools/blender/scenario-material-inputs.json`; empty strings mean use
offline fallback materials. Texture keys:
`basecolor`, `normal`, `roughness`, and `metallic`.
**Do not copy imagery from Google Street View or existing real ad campaigns.**


## Local Scenario MCP (optional)

The **official** Scenario for Blender extension exposes a local MCP JSON-RPC
endpoint (default: `http://127.0.0.1:9876/mcp`) while Blender is running and
**Allow Online Access** is enabled. Copy the actual URL from
**Scenario > Agents (MCP)** in Blender, because the port is configurable.
Documentation: https://github.com/scenario-labs/blender-plugin/blob/main/docs/MCP.md

An agent such as Codex can use an **HTTP MCP connection** to that loopback
endpoint after you explicitly configure the connection on your own computer.
This ChatGPT conversation is **not** connected to that localhost server.

Safety and reproducibility:
- Keep access local to `127.0.0.1`; never expose it through a public tunnel.
- The plugin is experimental; do not execute unreviewed model instructions.
- Inspect the scene and source data before asking Scenario to generate models.
- A generated model/PBR material may consume Creative Units. Require a
  **user-reviewed exact quote and separate approval** before each paid action.
  Tool descriptions alone are not a server-enforced spending guarantee.
- Save outputs to a dedicated local folder, and update only the texture
  paths in `scenario-material-inputs.json`. Review files and permissions
  before importing or committing them.
- The independent Blender export script uses `bpy`, not the addon API:
  it can author geometry offline even when Scenario MCP is disconnected.

## Offline generation

Open the repository in a terminal with Blender 5.0+ installed:

```shell
blender --background --python tools/blender/nyc_scenario_author.py -- --source assets/nyc/times-square-footprints.json --output assets/nyc/generated/times-square-study.glb --materials tools/blender/scenario-material-inputs.json
```

The script reads the **120 actual NYC municipal building polygons** and
height attributes, creates spatially anchored mesh extrusions, applies
selected Scenario PBR images or fallback Blender Principled materials,
and exports a GLB for **offline verification**.

The game's current WebGL2 renderer ALREADY reads the same official
GIS snapshot through `assets/nyc/nyc-gis-infill.js` and displays a
road-clipped subset as **visual-only infill**. This separate Blender
GLB is for art review and baking, not a file to place blindly on top of
the live GIS scene: doing so doubles geometry and collisions.

## Required validation before replacement

1. Inspect the GLB in Blender, especially complex concave roofs and
   outward-facing surface normals.
2. Compare the geo-calibration and building footprints against verified
   NYC roads and Google Maps **as reference only**.
3. Validate material license, texture sizes, UVs and compressed GLB size.
4. Extend the WebGL2 GLB loader to use PBR textures and replace—not overlay—
   corresponding native GIS objects. Confirm collision bounds.
5. Test close-up daylight and night scenes, FPS and GPU memory on desktop
   and mobile. Only then push the exported model as a production asset.

The current two-point NYC-to-game transform is **compressed and
approximate**. The Scenario addon does not make inaccurate footprints
survey-grade or automatically deliver photo-realistic AAA visuals.
