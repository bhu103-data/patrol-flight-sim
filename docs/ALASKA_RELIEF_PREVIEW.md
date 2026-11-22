# Alaska USGS DEM — bounded high-relief preview

This is an **explicit opt-in experimental game mode**, not a surveyed-scale
Tracy Arm reconstruction or a new downloadable model. Normal Alaska gameplay,
all other maps, terrain legacy fallback, floatplane flight controls and the
existing elevation asset remain unchanged by default.

## How to inspect

Open the PATROL build containing this branch with
`?alaskaRelief=preview`, then select **Alaska**. The mode is enabled only
after `assets/alaska/tracy-arm-3dep.json` successfully decodes.
`?alaskaRelief=preview&alaskaTerrain=legacy` deliberately retains original
relief (75 units). Any error loading the DEM retains the legacy/standard
scale. Relaunching a map resets the scale.

| Exact in-game scale | Standard | Preview |
| --- | ---: | ---: |
| USGS source maximum elevation | 1836 m | 1836 m |
| Terrain field scale / GPU `uTerrainScale` | 75 | 95 |
| Formula | `(75*.90 - 12.2)/1836` | `(95*.90 - 12.2)/1836` |
| Maximum world Y (ideal source cell) | 67.5 | 85.5 |
| Existing flight ceiling | 100 | 100 |
| Minimum theoretical peak-to-ceiling clearance | 32.5 | 14.5 |
| Maximum source-to-world relative relief | ~8× compressed | ~6× compressed |

The actual 1024-cell resampled terrain peak can be slightly lower. **Neither
profile is 1:1**: the 256² USGS source is oriented 90° into the compact game
map, and vertical/horizontal game scaling remains different.

## Safety and budget

- One shared scalar is used by the DEM height-buffer worker, CPU
  `sampleTerrainHeight` and GLSL `uTerrainScale`. Do **not** scale only
  the visible raymarched mountains without collision heights.
- The `water = 12.2` baseline, underwater 4.5-unit carve, actual source DEM
  positions, 1024² terrain texture and 118-step raymarch cap are unchanged.
- No new models, polygon triangles, elevation images, photo materials,
  draw calls or network downloads. The installed DEM is USGS 3DEP public
  domain. The source is already shipped; no new attribution needed.
- Legacy fallback uses 75 even when the query parameter is present.
- Higher land may reduce aerial clearance, change procedural vegetation
  visibility and reveal collision issues in narrow fjords: do not merge
  without actual C185 water physics, fixed-view WebGL2, cross-map and
  target-hardware GPU checks.
- Native Chromium SwiftShader RAF intervals are **not** GPU frame timing.
  Preserve this as a Draft until graphics and flight QA pass.

## Repeatable acceptance

The source-exact `alaska-relief-preview-qa.yml` job compares integrated
baseline `38a9be19` with preview mode at the *same* two west/east USGS
ridge camera poses, same shader time 42, noon/clear summer, and same internal
framebuffer. It records actual peak, west/east slope, sea collision height
and software RAF p50/p95. The extra C185 real-physics fixture must prove
preview-enabled float taxi, hard touchdown, docked brake and real GLB
rendering; it must not bypass the shipped physics.

Do not merge this preview into `main` or the shared integration branch until
the latest revision is accepted. PR #183 normal-only shading and PR #190
calving-front geometry are separate scopes.

## Windows native-GPU verification (manual, not run by Actions)

Requires Windows D3D11 graphics hardware, Microsoft Edge, Git, Python 3 and
Node.js 22+. Check out the feature branch and run from repository root:

    pwsh -File .\tools\alaska\run-relief-gpu-bench.ps1

The PowerShell launcher starts a localhost static web server, installs pinned
Playwright 1.56.1 (open-source, no paid service), and launches visible Edge
with ANGLE D3D11. The Node benchmark compares integration SHA 38a9be19
to opt-in Alaska relief 95 on the SAME west/east cameras, frozen GPU time 42,
noon/clear/summer, viewport 1280x720 and fixed 0.60 internal render scale.

Evidence: artifacts/alaska-relief-hardware-*.png and
artifacts/alaska-relief-hardware-gpu.json with GPU renderer identity, p50/p95,
RAF pacing, click-to-ready wall-clock times, sample counts, camera parity and
baseline/preview ratios. The GPU timer is WebGL2's
EXT_disjoint_timer_query_webgl2 on the fullscreen terrain/sky/water shader pass
ONLY, not all GPU draw calls or total game frame time. RAF and GPU durations
must not be confused.

If the Edge adapter is SwiftShader/software, the renderer cannot be verified,
the timer extension is unavailable, fewer than 20 valid samples resolve, or
camera/internal framebuffer comparison fails, the command exits with an
UNVERIFIED hardware gate rather than claiming a PASS. A clean sample collection
still requires human inspection of visual frames and GPU p50/p95 before merge.

Temporary HTML test copies are removed by the script; actual index.html,
shipped assets and physics are not changed. Hardware GPU QA and real device
load-time thresholds remain OPEN until results are attached to PR #212.
