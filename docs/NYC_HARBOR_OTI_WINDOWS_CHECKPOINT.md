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


## 2026-11-20 additional verified NYC visual and screenshot QA

- **PR #71 merged**, squash `3b64ee6fe4d2e51e02a5197a11c4798381944c07`. Original 10-view QA wrongly accepted a tenth image facing a close facade and an inherited bridge zoom. A verified independent harbor `09` screenshot (run 44866575861) showed a real Lower Manhattan skyline. The 10-view WebGL run **44867332550** completed with 10 nonblank PNGs; the tenth bright-sky fraction was **0.672767857** and `colorBins=116` with no warnings. Postmerge independent `09` on **main**, run **44867831476**, also succeeded with `colorBins=124`, `upperSkyFraction=0.679910714`, `webgl=true`, `error=0`, no errors/warnings. Postmerge Pages deployment **44867830976 succeeded**. Production map/physics untouched; screenshots are visibility evidence, not a realism score.
- **PR #72 and #73 closed without merge**. Although synthetic anonymous short-shop storefront tests passed, the actual `generateTerrain` + `setupCityLots` path produced **zero qualifying anonymous short Times Square parcels** in the existing map fixture. Its 10-view screenshot still had the blank pink-brown street wall. No dead geometry code merged.
- **PR #74 merged**, squash `a934deea6cba5c962bab49862c21b096082db772`. The real `buildTimesSquareDistrict` route builds 13 named municipal-footprint sites via `buildOfficialFootprintMesh` with `detailBand=4`. Their ground floor had no shop windows. Added authorized polygon-following ground retail glass, jambs and metal surround: **13/13 actual sites affected, 517 extra quads**, ≤.132 game-unit protrusion, original polygon/roof/physical bounds intact, existing batch and glass tags reused. New test `tests/nyc-times-ground-storefronts.test.mjs`. PR Node regression **44868473333 passed 421/421**, full 10-camera WebGL **44868473379 succeeded** with ten screenshots, no runtime warnings, NYC facade sky fraction **0.672098214**; C185 browser **44868473338** and Alaska browser **44868473352** both succeeded, as did Alaska source checks and Cosmos.
- **Residual verified visual defect:** Even in the new PR #74 Chromium screenshot `05-times-square-street.png`, a large flat pink-brown block **still occupies the right foreground**. The 13 mapped building facade changes are real in geometry, but it is **not verified** that they affect that specific rectangle. Do not call the big blank-wall issue fixed. Follow up by identifying the exact production mesh/quad responsible for the pink-brown wall (including billboard backplates, custom district geometry and city-building lots), then add a camera-specific before/after PNG test instead of adding hypothetical anonymous lots.

**Next:** Compare the actual screen pixel/hit location against the game camera and active scene geometry; fix the actual mesh only once identified, preserve other maps. Continue anonymous Manhattan skyline silhouette and material improvements in a bounded corridor. Always read latest main and Actions before edits; do not claim 1:1 survey accuracy or photogrammetry.
