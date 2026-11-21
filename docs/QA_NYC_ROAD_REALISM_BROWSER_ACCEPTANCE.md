# Independent browser acceptance — NYC road realism (not yet verified)

**Target repository:** `bhu103-data/patrol-flight-sim`  
**Target branch:** `codex/nyc-road-realism`  
**Target production commit:** `d7aff2d7e73daf9dbbd1141c0d80fcc01f471ac1`  
**Date:** 2026-11-21  
**Status:** **BLOCKED — NO BRANCH-SPECIFIC GAME BROWSER RENDER OR SCREENSHOT.** This document is a QA handoff, not an acceptance certificate.

## Evidence available and limitations

- The GitHub branch and target SHA were verified. It changes NYC road network, bridgehead presentation, rendering hookup and tests.
- The only discoverable Actions run for that exact SHA when checked was `44870480483` (**PATROL Cosmos source checks**, success). This is not a NYC road or floatplane screenshot.
- Connected browser tab access returned: `Browser access requires the originating browser context`.
- A local Chromium executable was available, but the target branch could not be cloned (`Could not resolve host: github.com`); on an empty local page the WebGL2 capability check returned `false`. Therefore no branch-specific live game view could be opened in this environment.
- TinyFish browser execution has usage-based pricing and was **not run**, per no-payment requirement.
- Old `main` or PR screenshots are **not** evidence for this branch. No screenshots or visual pass/fail claims were fabricated.

## Reproducible free browser inspection plan (not executed)

Use a local checkout at the exact target SHA and a current Chromium supporting WebGL2. Serve the repository via a local static HTTP server; open `index.html`, start Manhattan, and hide the HUD only **during** full-resolution canvas capture. Record the exact SHA and WebGL2 context state in the evidence manifest.

For apples-to-apples captures, set the game's scene controls to **time 12 / season 1 / weather Clear** and **time 21 / season 1 / weather Clear**, keeping the camera coordinates, zoom, screen size (1280×720) and quality preset constant between lighting variants. Verify the control values in the browser before each capture. Do not infer that a screenshot is day/night merely from its filename.

### Required independent views

| View | Inspect | Pass/fail evidence required |
| --- | --- | --- |
| Brooklyn Bridge deck and western bridgehead approach | Asphalts join continuously without dead ends, curb cuts, building encroachment, road/deck separation and bridge collision clearance | Scene-only screenshot, close oblique street screenshot, visible road connection in both directions |
| DUMBO warehouse street level | Lanes (avenue multi-lane, side-street one-way arrows), consistent painted widths, no markings through sidewalks/buildings | Day and night close-ups of the *same* junction and screenshot coordinates |
| Traffic signal poles and heads | Faces point toward actual driving direction, poles avoid lane center, lamps and markings are visible at night | Matched front/back approach shots; label which directions should show signal heads |
| Parked cars/taxis | Fully curbside, correct heading, no intersection blocking, no overlap with moving traffic lane, curb or facade | Street-level camera plus angled overhead; record vehicle position and offending junction if any |
| C185 floatplane harbor view | Aircraft and two floats visible; float-to-waterline contact plausible; no underwater hull clipping or water appearing through floats at rest and during takeoff/landing | Identical camera before/after water contact, side profile and near-water oblique frames; name selected airplane and map |

### Classification protocol

- **PASS**: exact-SHA live WebGL screenshots show the full targeted geometry, weather/time controls are recorded, no relevant overlapping meshes or visible clipping at inspected positions.
- **FAIL**: screenshot plus camera/map/time and reproducible steps reveal a specific visual, collision, camera, signal-facing or float-waterline defect.
- **NOT TESTED**: missing exact-SHA browser render, failed WebGL initialization, camera/aircraft not shown, or ambiguous image. This is the current classification for **all** visual items.

Do not change `index.html`, `assets/`, `scripts/`, `tests/`, vehicle controls, shader, map placement or other agents' 3D models as part of this independent QA handoff. If later screenshots reveal a defect, open an evidence-backed issue without silently modifying production code.

## Result

**Brooklyn Bridge approach:** NOT TESTED  
**DUMBO lanes and signals:** NOT TESTED  
**Parked vehicles:** NOT TESTED  
**C185 waterline / dual-float clipping:** NOT TESTED  

**One next action:** Obtain a functioning free WebGL2 browser and the exact `d7aff2d7` branch checkout, then capture the matched day/night bridgehead + DUMBO + C185 views before making any acceptance claim.
