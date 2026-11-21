---
name: patrol-scenario-chongqing
description: Drive a connected official Scenario for Blender MCP session to refine and export original Hongyadong/Chongqing geometry for the PATROL Hotpot Pilot, while preserving existing gameplay and licensing.
license: MIT
---

# PATROL Chongqing — Scenario for Blender

Use this project skill alongside the official [scenario-blender](https://github.com/scenario-labs/skills/tree/main/skills/scenario-blender) skill and [Scenario for Blender](https://github.com/scenario-labs/blender-plugin) extension (Blender 5.0+). The project skill is not a substitute for installing or connecting the desktop extension.

## Connection and first inspection

1. Confirm the local Blender application version is 5.0+ and that the official Scenario extension is installed and enabled.
2. In Blender, open **Scenario → Agents (MCP)**, connect Codex locally with its **Connect Codex** control (or an explicitly configured bearer-token localhost connection).
3. Check MCP tool discovery, then call `scene_summary` to inspect Blender's **actual** open scene before changing anything. Do not claim this happened based only on a GitHub code edit.
4. Restrict MCP binding to 127.0.0.1, do not print or commit secrets. Treat `execute_python` as a separate privileged action needing user opt-in. Quote and obtain explicit approval before any paid Scenario model/material generation.

## What to model (in this order)

- **Hongyadong**: hillside-connected eleven visible levels, original timber brackets, dark ridged roofs, recessed window galleries, balconies, handrails, stairs, lit interior bays; prioritize layered depth and 1–2 m believable detail.
- **Qiansimen Bridge**: single tower and **single central plane of stay cables**. A separate game-placeable replacement is needed; do not replace the live bridge until its bounds and route are verified.
- **Raffles City Chongqing**: eight sail-like towers and suspended horizontal Crystal. Preserve the existing working eight towers, collision data, and train route.
- **Liziba**: through-building station, train clearance and three-car monorail. Do not alter the working passage or vehicle animation until a replacement is tested.

Use the project's existing [technical references](../../../docs/CHONGQING_HOTPOT_PILOT.md) and licensed photographs only. Never import Google Maps tiles, photogrammetry, reference site's original meshes, screenshots as unlicensed facade texture, or proprietary 3D game assets.

## Executable offline starting point

From the *repository root*, Blender 5.0+:

```powershell
blender -b --python tools/blender/chongqing_scenario_author.py -- --output assets/chongqing/generated/hongyadong-study.glb
```

This creates a deterministic Blender 3D architectural **study** even with Scenario cloud disconnected. For authored Scenario PBR maps, set local file paths under `tools/blender/scenario-material-inputs.json` (from the file's directory) and rerun. Do not claim those textures came from Scenario unless actually generated there. The batch script does not charge Creative Units, contact the API, or install the add-on.

Review the generated GLB in Blender's rendered material preview. Check actual normals, UV seams, material appearance, 11-level silhouette, size, draw calls and texture licensing. Budget: at most **25,000 triangles**, **8 MiB** per reviewed landmark model. Use one embedded UV-atlas material when targeting the legacy Manhattan WebGL2 GLB loader.

## Production rule

The Hongyadong study is **not** automatically imported into `chongqing.html`; that map uses Three.js with separate detailed geometry, local collisions and navigation. Before replacing live geometry, implement a separately reviewed Three.js GLTFLoader placement adapter with a deterministic transform, load-failure rollback and matching collider volumes. Never overlay a full Hongyadong GLB on top of the existing mesh; that doubles geometry and causes z-fighting. Do not remove or regress hotpot fire flight, WASD movement, scenery cameras, vehicles, Qiansimen bridge, Raffles City, Liziba train or the NYC/other maps.

## Required report

State whether Scenario MCP was *actually connected*, which paid generations were explicitly approved and submitted (if any), Blender script execution result, GLB output path, licensing, game activation, browser screenshot/FPS verification, and GitHub commits. Explicitly identify unverified steps.
