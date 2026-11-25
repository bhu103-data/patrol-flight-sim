# PATROL cinematic render pass

`patrol_cinematic_scene.py` is an offline Blender 4.2-compatible scene builder.
It deliberately keeps exactly two aircraft in the scene:

1. `AIRCRAFT_01_Cessna185_Floatplane` — the existing locally authored Cessna 185 GLB.
2. `AIRCRAFT_02_PatrolJet` — a small procedural patrol jet, authored in the script.

The script does not delete the repository aircraft files or alter the browser
renderer. It creates a separate `.blend` artifact and an MPEG-4 render target.

## Presets

- `nyc`: wet Manhattan-style skyline, reflective water, rain streaks, warm sunset key,
  blue-hour world lighting and fog glow.
- `alaska`: dark fjord water, procedural rock/snow cliffs, cold moon key and animated
  emissive aurora curtains.

## Run with Blender 4.2 LTS

```powershell
blender --background --python tools/blender/patrol_cinematic_scene.py -- `
  --preset nyc --output artifacts/blender/patrol-nyc.blend --render

blender --background --python tools/blender/patrol_cinematic_scene.py -- `
  --preset alaska --output artifacts/blender/patrol-alaska.blend --render
```

The script selects an exposed OptiX/CUDA/HIP/oneAPI device when available and
falls back to CPU without changing the scene. Output is written under
`artifacts/blender/`; it is not a runtime asset and should not be committed
unless the resulting render is manually reviewed.

## Current verification

- Python syntax: verified with `python -m py_compile`.
- Blender/Cycles/FFmpeg execution: not run in this environment because a
  `blender` executable is not installed or reachable on PATH.
- External models: none downloaded or enabled; license verification is not
  needed for the procedural jet and existing repo-authored floatplane.
