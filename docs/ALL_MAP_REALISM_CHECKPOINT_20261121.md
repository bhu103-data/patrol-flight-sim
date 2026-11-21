# PATROL all-map realism integration checkpoint — 2026-11-21

This is a **draft visual QA branch**, not a claim of 1:1 reality or a published release.

## Provenance of the integrated code

- Baseline: accepted combined `codex/patrol-integration-20261121` at `6d50bfda`, preserving its shared traffic assets, water/flight regressions, maps, and fallback renderers.
- New York: draft PR #106 Lower Manhattan official-footprint entrance/cornice geometry, plus later main changes for Central Park Bow Bridge and nonduplicating LED display content (#87/#89).
- Chongqing: draft PR #93 Hongyadong-adjacent stepped store; later main bidirectional traffic signal and hollow-window architecture, with existing Digit6 waterfront camera preserved and new Digit7 live-signal camera added.
- Alaska: draft PR #92 two near-pier cabin meshes with optional close-range detailing; underlying USGS 3DEP Tracy Arm elevation and photographic CC0 atlas unchanged.
- Las Vegas: draft PRs #107 and #108 original Strip road and ridge pilot, including corrected western normals; **not a surveyed DEM**.
- Washington DC: preserves the existing federal core and licensed CC0 material atlas; no new DC surveyed GIS was imported in this checkpoint.
- Copper Coast and Alder River Valley: preserve the existing procedural maps and aircraft collision/LOD logic; these are fictional and cannot be validated against real-world building footprints.
- Cosmos: retains existing orbit handoff/planet texture sources and original fallback; astronomical proportions remain compressed.

## Validation and merge gates

- The shared `index.html` combines 13 exact matched patch hunks from the four map PRs; no colliding hunk was accepted.
- New and existing targeted test/QA scripts were carried with each relevant change. Test passes and visual/fps results **must be verified on this combined branch**; passes on individual PRs do not prove the combined branch.
- Inspect in live WebGL2: NYC Lower Manhattan street and roof elevations; Chongqing Digit6 riverwalk and Digit7 traffic signals; Alaska pier cabins and safe harbor; Vegas distant ridge front/back lighting and Strip roadway.
- Verify NYC/Chongqing solid/water/road clearance, C185 takeoff/landing, scene switching and low graphics fallbacks before considering merge.
- Map-space city geometry is compressed artistic reconstruction, not georeferenced 1:1 building surveys; never reproduce Google Maps proprietary meshes or images.
