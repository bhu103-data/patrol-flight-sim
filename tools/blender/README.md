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
