# PATROL — Lower Manhattan near-harbor window-relief pass

**Date:** 2026-11-20. **Scope:** native WebGL2 NYC map, existing official financial-district polygons. This is a resumable checkpoint, not a claim of complete 1:1 photorealism.

## Files and behavior

- `index.html` — `buildOfficialFootprintMesh`: on **detailBand 3** only, within `-110 < x < -60`, `-500 < z < -400`, only south-facing eligible edge segments, and only four lower window levels / alternating bays, add physical dark jamb-depth facets, metal frames and sill/lintel thickness. The original GIS polygon roof triangulation, height, material tags, collision lot and window count are unchanged. The maximum protrusion is **0.163 game units** outside the original polygon edge. This is an authored window typology **on real polygon geometry**, not a measured facade-window survey or Google Maps-derived mesh.
- `index.html` — adds Scenic Views → **Lower Manhattan · Window Facades**, positioned on the south harbor approach to the financial-district skyline.
- `scripts/nyc-road-browser-smoke.mjs` — captures the tenth scene-only, pixel-audited Chromium/WebGL screenshot, `09-manhattan-window-facades.png`, after the nine existing cameras.
- `tests/nyc-oti-harbor-window-depth.test.mjs` — invokes the actual production polygon renderer on the bundled municipal-snapshot fixture, comparing the real window geometry with and without the new detail gate. Guards polygon proximity, old-mesh preservation, LOD and destroyed-building fallback.
- `tests/nyc-unified-webgl-qa.test.mjs` — now asserts all ten camera output names.
- `.github/workflows/nyc-bridgehead-browser.yml` — new geometry + camera QA tests and 18-minute allowance for ten headless browser screenshots.

## Verification completed

Actual production code was evaluated against the repository's **100 bundled official polygon records** (some may not survive runtime lot/road filtering):

| Metric | Result |
| --- | ---: |
| Building records with new window-relief faces | 19 |
| Additional quads, all in the existing batched geometry | 860 |
| New vertices tested | 3,440 |
| Max protrusion beyond source polygon boundary | 0.163 game units |
| Roof-height violations | 0 |
| Old geometry removed or reordered | 0 |
| Roof/window-count changes | 0 |
| Faces introduced outside selected map corridor | 0 |
| Faces introduced in low LOD (1, 2) or destroyed lots | 0 |
| New exterior surface-tag violations | 0 |
| Updated headless screenshot script parse | valid JavaScript |

The new camera and its WebGL picture **must still be checked on an actual GitHub Actions run**. Static and mocked-GPU validation cannot establish visual quality, runtime FPS, or prove the user-visible scene is photorealistic.

## Continuation actions

1. Re-read latest `main` before any edits (many concurrent agents).
2. Verify the NYC WebGL workflow completes and inspect `artifacts/nyc/09-manhattan-window-facades.png` plus `00-harbor.png` and `01-city-loaded.png`. Look for high-rise geometry overlap, window depth, low lighting/fog, and visible black/blank frames. Change only evidence-backed defects.
3. Next improve physically bounded shopfront/door/window typologies in **ordinary, anonymous Manhattan lots**, particularly harbor-spawn to One WTC, without changing road or GIS boundaries. Consider a budgeted near-Landmark LOD rather than whole-map dense geometry.
4. Continue DUMBO brick/bridgehead clearances, then Chongqing and Alaska separately. Keep the NYC and Chongqing road, mesh and world-coordinate systems isolated.
5. Preserve all verified C185 floatplane, traffic, Cosmos, bridge, and collision interactions. Do not claim 1:1 data or photogrammetry without surveyed licensed assets and an actual rendered review.

**Game:** https://bhu103-data.github.io/patrol-flight-sim/

**Repository:** https://github.com/bhu103-data/patrol-flight-sim
