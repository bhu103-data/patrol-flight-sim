# PATROL / NYC — One Times Square 2026 Skywalk source-geometry pilot

## Why this is the selected gap

The live `index.html` skyline previously carried the real municipal wedge
footprint for One Times Square (FID 57216, roof 337 ft) but its roof contained
primarily small arbitrary roof cuboids and LED staging. Adjacent projects
#233/#235/#239/#240/#248 are meter-scale *reference viewers*; #224 owns
street signals, #244 owns authentic roadbed *source preview*, #246 owns
recessed Times Square windows, #249 owns the 1515 Broadway facade.
This PR implements a **different, observable 2026 real structure** directly
in the original Manhattan gameplay: a north cantilever + steel truss +
viewing deck glass/rail form. No new standalone view or fake traffic lanes.

## Authoritative 2026 facts, and what was NOT measured

- Structural engineer DeSimone, One Times Square redevelopment:
  https://www.desimone.com/projects/one-times-square-redevelopment
  Documents a 55-foot (16.764 m) steel cantilevered deck on the 19th floor
  projecting north toward the heart of Times Square; exterior glass
  elevator/landings, trusses and rooftop construction.
- DeSimone retrospective (Oct 13, 2026):
  https://www.desimone.com/newsroom/one-times-square-redevelopment-an-enr-global-best-project
- One Times Square operator, Apr 7, 2026:
  https://onetimessquare.com/press-release/one-times-square-launches-times-square-skywalk-experience
  Confirms the Skywalk opened in 2026, with a glass walkway 19 floors above
  the plaza and wraparound observation deck.
- S9 Architecture project and photographic reference:
  https://s9architecture.com/one-times-square/
  Use this **read-only as a visual reference**. Images, proprietary BIM and
  renderings are NOT bundled or redistributed. Source 55-ft cantilever
  dimension is a factual design/engineering measurement, not photo tracing.
- Existing municipal footprint FID 57216, existing game 337-ft height:
  `index.html`, `assets/nyc/TIMES_SQUARE_GIS_NOTES.md`.
  The existing game maps the 337-ft roof to 30.9 *game* units; therefore the
  **proportional** projection is `55*30.9/337 = 5.04` game units.
  This is NOT 5.04 metres in a 1:1 Manhattan scene.

Unverified: exact width of the skywalk as built, railing height, elevation of
the 19th floor relative to these invented game floors, bracket positions,
material tint/transmission, façade entrance alignment, ground engineering
and 2026 rooftop profile. Those remain `author-authored approximation`.
The new deck Y=27.22 was chosen to clear the game's old LED stack
(max Y=26.28); it is NOT a literal measured 19th-floor height.

## Production implementation (only Manhattan landmark source)

- `index.html` adds a pure `buildOneTimesSkywalk` helper and calls it only
  inside `buildNewYorkLandmark('times')`.
- Launch actual PATROL Manhattan with `?nycSkywalk=on`; default URL is
  unchanged until separate visual acceptance. This is the original aircraft
  game, not a new demo or metric viewer.
- Six-corner relieved steel deck (actual extruded thickness, not stretched
  rectangular cuboid), two longitudinal webbed steel trusses, 3D cross-section
  handrails and edge posts, and NYC existing glass PBR material class 10.
- Existing mesh uploads and shader draw call reused; no new textures, model
  files, imported photographs, commercial dependencies or draw calls.
- The deck is a visual-only landmark pilot: old aircraft collision geometry
  is UNCHANGED and therefore incomplete for the new overhang. Do not claim
  physically collidable cantilever without a new same-geometry collision QA.
  No general changes to Manhattan traffic, buildings or aircraft, or to
  Alaska/Chongqing/Vegas/Cosmos.

## Acceptance evidence required

Same game `index.html`, same 1280×720 WebGL2, same
`One Times Square` scenic camera, HUD-free canvas captures:
`off-one-times-same-camera.png` vs `on-one-times-same-camera.png`.
`report.json` includes source-dimension/triangle counts, WebGL errors,
software WebGL RAF frame interval P50/P95 for both conditions, pixel
difference, and no new textures/draw calls. GPU frame time on actual desktop
hardware is **not** measured by SwiftShader and remains an acceptance gap.

**Reality comparison:** public S9 and DeSimone images represent external
real-world architectural reference. They do NOT publish an exact six-DoF
camera transform/FOV matching PATROL's fictional ground coordinates. Do
not label their photographs as pixel-perfect “same camera”. The only
genuinely identical cameras in the artifact are the **game baseline vs
game candidate**. The real reference is the dated engineering dimension,
north-facing projection and supported glass/truss/deck silhouette.
Real-photo six-DoF match requires camera survey/registration.

No measured citywide road widths or lane counts are inferred here.
ODbL/Google Maps tile imagery not imported; metadata and rights audited
individually for future real-asset replacements. This pilot must not
close holistic NYC realism P0 issue #229.

## Commands

```sh
node --test tests/nyc-one-times-skywalk-source.test.mjs
python3 -m http.server 8129
# Production game:
# http://localhost:8129/index.html?nycSkywalk=on
# Existing game without pilot:
# http://localhost:8129/index.html?nycSkywalk=off
```
