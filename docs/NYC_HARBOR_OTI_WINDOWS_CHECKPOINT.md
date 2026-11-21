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
- **Historical defect, now superseded by PR #79:** Even in the PR #74 Chromium screenshot `05-times-square-street.png`, a large flat pink-brown block **still occupies the right foreground**. The 13 mapped building facade changes are real in geometry, but it is **not verified** that they affect that specific rectangle. Do not call the big blank-wall issue fixed. Follow up by identifying the exact production mesh/quad responsible for the pink-brown wall (including billboard backplates, custom district geometry and city-building lots), then add a camera-specific before/after PNG test instead of adding hypothetical anonymous lots.

**Historical next action (completed by PR #79):** The exact street-wall mesh was located and repaired on FID 384606. See the dated acceptance below. Further work must first identify a distinct, reproducible visual defect on latest main.

## 2026-11-21 — Times Square FID 384606 wall FIXED, screenshot verified

This supersedes the historical PR #74 residual blank-wall finding above. **PR #79** was squash-merged as [`fa2ad44b`](https://github.com/bhu103-data/patrol-flight-sim/commit/fa2ad44b3a526f539ab0c70079b72e2026a0d01e) after actual Chromium WebGL visual acceptance. No duplicate fix of the old pink-brown wall should be attempted without NEW screenshot evidence.

- **Exact cause**: the real NYC GIS infill `assets/nyc/nyc-gis-infill.js` skipped all window quads for actual public building footprint **FID 384606** (height `5.97993216` game units), because the old generic window gate required `h>=9`. Its brown polygon wall occupies the **right foreground** of `05-times-square-street.png`, not the 13 named landmark sites or anonymous terrain parcels.
- **Scoped repair**: only FID 384606's qualifying west-facing polygon edge segments receive shallow storefront panes, doors, metal jambs and upper glazing in the existing GIS draw batch. **201 added quads, 34 glass-tagged**, edge protrusion at most `0.079` game units. All **35 original source buildings, 76 clipped pieces, 226 roof triangles, 2,200 pre-existing window quads and every original wall quad** survive unchanged. No street, city boundary, collider, aircraft or Chongqing mesh changes.
- **Pixel before/after**, fixed 1280×720 viewport, 05 camera ROI `[930,1180,190,320]`: blue-glass characteristic samples from **0%** before to **58.54%** after; luminance standard deviation from about **0.96** to **8.60**. This is evidence that the specific previously blank wall changed, **not** a 1:1 realism score.
- **Testing**: `tests/nyc-times-fid384606-storefront.test.mjs` validates the actual 120-record bundled municipal fixture, original polygon/roofs, bounded distance, and glass. `scripts/nyc-road-browser-smoke.mjs` now rejects the original blank ROI by pixel content.
- **Actual CI**: [PR #79](https://github.com/bhu103-data/patrol-flight-sim/pull/79): [425/425 Node](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/44870822646) and [10/10 PR WebGL screenshots](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/44870822645) passed. [Postmerge `fa2ad44b` 10-camera](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/44871238431) passed with `rightWall.coolGlassFraction=0.5853846154`, `colorStdDev=8.6033839`, `09.upperSkyFraction=0.6723214`.
- **Latest main visual acceptance**: concurrent [PR #78](https://github.com/bhu103-data/patrol-flight-sim/pull/78) merged as `f91f9c783e310284af3aaa5be106ab4958f1bc11`. [NYC 10-camera run 44871437047](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/44871437047) succeeded; [Chongqing eight-view run 44871437109](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/44871437109) also succeeded with `passed:true`, empty warnings, and flight climb `302 -> 320.011`. [Main Node 427/427](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/44871437075) and [Pages deployment](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/44871436560) succeeded.

**Remaining quality debt:** The scenery is still game-scale and materially stylized, not surveyed photogrammetry. Future work should isolate *new*, reproducible high-impact visual defects with before/after camera evidence rather than reworking the now-fixed FID 384606 or re-adding dead anonymous Times Square parcels. NYC/Chongqing/Alaska aircraft and map systems must remain separate.
