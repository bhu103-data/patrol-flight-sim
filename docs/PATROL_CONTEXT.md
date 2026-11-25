# PATROL — canonical compact context

_Purpose: one-file handoff for new chats. Read this file instead of prior conversation transcripts. Last compacted: 2026-11-22 (New York)._

## Product and invariants

- Repository: `https://github.com/bhu103-data/patrol-flight-sim`
- Deliverable: a playable browser WebGL flight game, not an offline video or animation render.
- Preserve existing flight controls, map switching, collision, routes, seaplane water landing/buoyancy, and unrelated maps.
- Prefer legally reusable existing geometry, textures and code. Record source and license. Do not ship assets with unclear redistribution rights.
- Never present Blender previews, screenshots, GIS coordinates or passing CI as proof that an asset is integrated into the production flight map.
- Do not perform GPU training. Use Blender only for missing lightweight game assets or optimization.

## Visual acceptance priority

1. Manhattan: Lower Manhattan skyline and street-visible facades; real silhouettes, setbacks, roof equipment and nonrepeating facade depth.
2. Brooklyn: Brooklyn Bridge approaches and DUMBO brick warehouses, roads, lanes, signals and waterfront.
3. Statue of Liberty: crown, torch, drapery, pedestal and correct statue-to-base proportions.
4. New York Harbor vessels: ferry-first hull, waterline, windows, deck, rails and real-time wake.
5. Water/sky: fix sun-direction-dependent water failure and identify the distant fake globe as sky sphere, leaked space object or LOD placeholder; do not hide it only by recoloring.
6. Alaska and Las Vegas: separate licensed DEM/GIS/asset samples with map-switch and flight regression.

Visual reference: Saltline's rainy harbor mood may guide wet asphalt, cold-gray sky, restrained warm lights, fog and bloom, but its code/art/gameplay must not be copied without permission.

## Verified baseline

- The detailed historical checkpoint is in `docs/ACTIVE_FLIGHT_SIM_HANDOFF.md`; consult it only when the selected task needs older PR/test evidence.
- Previously recorded merged baseline includes NYC roof/setback work and browser smoke coverage. Recheck current `main`, open PRs and Actions before relying on any PR number or commit.
- Existing NYC Scenario integration files include `assets/nyc/scenario-manifest.json`, `assets/nyc/nyc-realism.js`, and `assets/nyc/scenario/*.glb`; never enable a missing or unreviewed model.
- Extracted Gemini and Claude research notes are preserved in `docs/AI_AGENT_HANDOFF_2026-11-22.md`; they are leads, not verified implementation evidence.
- GitHub-verified on 2026-11-22: draft PR `#255` (`feat/nyc-one-times-skywalk-20261122-chat`, head `6d84be4544c8b02938ab53a7c3a4817c234d761f`) adds an opt-in One Times Square north Skywalk to the live flight map. It is open, mergeable and unmerged. Reported WebGL/Node checks are green, but native GPU performance and protrusion collision remain unverified.
- GitHub-verified on 2026-11-22: draft PR `#256` (`feat/nyc-liberty-cc0-optin-lod-20261122-chat`, head `10cfa432fbd77350e66a66d45da1550b3d5cfb10`) adds opt-in Liberty CC0 GLB LOD/rollback using a pinned 15,900-triangle asset. It is open, mergeable, unmerged and stacked on unmerged parent work; native GPU and manually flown low-altitude collision remain unverified.

## Current work streams

### A — NYC production-map realism

- Replace flat/block-like anonymous buildings only through bounded production code paths.
- First sample: Brooklyn Bridge Brooklyn end through DUMBO waterfront, followed by Lower Manhattan visibility from that route.
- Acceptance: same-camera near-flight and bridge-distance screenshots, geometry/material provenance, triangle/texture budget, first load, average/P95 frame time, WebGL errors, controls and map-switch regression.

### B — Landmark and vessel assets

- Audit current GLBs before sourcing replacements.
- Candidate assets must have direct source, explicit modification/redistribution license, format, triangle count, texture size and download size.
- Keep manifest `enabled:false` until the actual GLB loads in the production map and passes visual/performance checks.

### C — Water and distant-globe defect

- Reproduce from both sun-facing and opposite flight directions using the same exposure and camera altitude.
- Trace view vector, reflection/refraction, normal/tangent space, environment map, sky/space visibility and map-state LOD selection.
- Fix the cause, then verify harbor vessels, seaplane contact and non-NYC maps.
- Local-only QA on 2026-11-22 compared `6d50bfd` with water-clamp state `9fcea63` at the same 1280×720 harbor camera, fixed shader time, cloud `0.16`, twilight `0`, and solar elevations 1°/4°/15° in both directions. Intel Iris Xe D3D11 rendered all 12 cases with zero browser errors and about 16.70 ms median frame interval; artifacts are in `artifacts/water-qa-20261122/` and the compact report is `docs/WATER_REFLECTION_LOCAL_QA_2026-11-22.md`.
- The clamp does not pass visual acceptance: the large curved horizon/globe-like band remains in both states, while the opposite-direction water ROI changes more than the sun-visible direction. Treat the source-text test as static coverage only, not proof of a visual fix.
- Follow-up diagnostics on 2026-11-22 isolated sky, reflected-sky, fog and sphere paths with solid-color modes. At the fixed 1° camera, replacing only reflected-sky color preserved the curved Fresnel boundary but removed the false white globe. Fog produced no matching contour and the Manhattan scene had no sphere hit. Root cause: the water environment term sampled the solar/lunar discs and then added a second GGX glint.
- Commit `f882e26` on branch `codex/water-horizon-duplicate-fix-20261122` keeps the visible sky discs, excludes them from the water environment sample, retains the dedicated GGX glint, and reduces its clipping cap. Diagnostic modes are URL-opt-in; normal URLs remain on mode zero.
- Six fixed-camera final captures (1°/4°/15° × sun-facing/opposite) ran on Intel Iris Xe D3D11 with no context loss, about 16.60–16.70 ms median and 16.80–16.90 ms P95 frame interval. The broad duplicate globe is gone; the real sun streak remains. Evidence is local in `artifacts/water-diag-20261122/` in the diagnostic worktree. Targeted tests `water-diagnostic-modes.test.mjs` and `tidewater-water-viewfix.test.mjs` pass (3/3).
- A local, uncommitted combination with ferry state `de2059f` merged without textual conflict and loaded Manhattan with both code paths at 1280×720 and no console/page errors. Runtime coexistence is smoke-verified only; ferry wake/contact and manual flight remain unverified.
- Windows sees Intel Iris Xe and NVIDIA MX450 as healthy, but the browser selected Intel. Do not claim MX450 evidence until `UNMASKED_RENDERER_WEBGL` identifies NVIDIA.

### D — Cross-map samples

- Alaska and Las Vegas remain independent work streams; do not copy NYC geometry or materials wholesale.
- Require licensed source evidence, near/far same-camera screenshots, load/frame measurements, map switching and flight regression.

### E — Central integration and QA

- Deduplicate overlapping branches/PRs before merging.
- Build a conflict matrix and a safe merge order.
- One active continuation per work item. Do not create duplicate chats for the same unfinished item.

## Required verification

1. Inspect latest `main`, current branch, working tree, open PRs and CI before editing.
2. Reproduce the visible defect in production code, not a detached preview.
3. Make a minimal reversible change and preserve unrelated user modifications.
4. Run targeted tests, then applicable Node/browser/WebGL checks.
5. Record actual screenshots/artifacts, source commit, model/texture budgets and failures. Mark anything not executed as unverified.

## Next action

For the selected water item, verify commit `f882e26` with the ferry/wake and seaplane water-contact paths, then run one Alaska and one Las Vegas map-switch smoke. Keep the diagnostic switch opt-in and judge completion only from game screenshots, frame timing, WebGL state and flight behavior.

## Compact handoff template

```text
Work item:
Verified change:
Evidence (files/tests/artifacts/commit):
Unverified:
Blocker:
Exact next action:
```
