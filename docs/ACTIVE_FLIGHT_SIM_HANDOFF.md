# PATROL Flight Simulator — active continuation handoff
_Last verified: 2026-11-20 (New York local date). This is a living implementation checkpoint, not a claim that the whole game is complete._

## Current runnable and source state
- Repository: https://github.com/bhu103-data/patrol-flight-sim
- Play: https://bhu103-data.github.io/patrol-flight-sim/
- NYC roof/setback fix merged as PR [#65](https://github.com/bhu103-data/patrol-flight-sim/pull/65), commit `784c29c4bc3571608e570d9420f8e478fef733b0`.
- GitHub Pages deployment for that commit **succeeded**: https://github.com/bhu103-data/patrol-flight-sim/actions/runs/44863867024
- Subsequent commits may be present: **always re-read latest `main` before editing** and merge changes with a PR or an expected-SHA ref lease. Do not overwrite entire `index.html` from a stale branch.

## Recently completed and checked
1. **Alaska USGS grounding — [PR #49](https://github.com/bhu103-data/patrol-flight-sim/pull/49).** Real bundled DEM checked; research-camp huts were silently skipped because the original site could not pass ground placement. Corrected site, surveyed full 7×7 foundation, stilts and vegetation clearances. Test: `tests/alaska-research-camp-grounding.test.mjs`.
2. **Brooklyn Bridgehead density — [PR #58](https://github.com/bhu103-data/patrol-flight-sim/pull/58).** Actual `generateTerrain` tested against official polygon assets; bridgehead samples improved from 31 parcels / 17 gapfills / 4095 area to 39 / 25 / 4557, while retaining water/road/rail/airstrip guards. Test: `tests/nyc-bridgehead-generator.test.mjs`. This is still a compressed game, not surveyed 1:1 street geometry.
3. **NYC approved landmark GLBs survive direct WebGL2 fallback — [PR #61](https://github.com/bhu103-data/patrol-flight-sim/pull/61).** The loader no longer disables approved Empire/Chrysler/One WTC assets merely because offscreen framebuffer composition failed. Real Chromium loaded the three meshes, counted GPU draws and passed both normal and forced-direct WebGL2 modes. Tests: `tests/nyc-direct-render-landmarks.test.mjs`, `tools/verify-nyc-active-landmarks.cjs`, `.github/workflows/nyc-active-landmarks-browser.yml`.
4. **NYC anonymous-tower setback roofs — [PR #65](https://github.com/bhu103-data/patrol-flight-sim/pull/65).** The real `buildCityBuildings` renderer had a roof ledge 9.12 units wide over a 3.87-unit top-tier crown (2.36× the crown), plus floating equipment and strips. All roof ledges, rooftop HVAC, vents, vertical facades, horizontal courses, Art Deco fins and antennae now follow their supporting tier footprints. Across 13 actual generated facade styles (same test lots), substantial top-roof overhangs dropped **62 → 0** with 52 extra batched tiny roof components and no per-building draw calls. The 13 samples are not a census of all NYC. New test: `tests/nyc-roof-setback-grounding.test.mjs`. Real Chromium nine-view NYC browser smoke: https://github.com/bhu103-data/patrol-flight-sim/actions/runs/44863361098 (success, nine nonblank PNGs and zero reported WebGL errors). Final `main` Node and static checks passed; Pages deployed.
5. Parallel contributions added Brooklyn window-depth and roof-gravel shader variation. PR #65 was rebased onto that later `main` rather than replacing the other team's 41 shader lines.

## Outstanding visual goals (NOT completed)
- **Priority 1 — Ordinary Manhattan buildings around spawn and along the view toward Liberty Island.** Current screenshots still show obvious box-shaped anonymous buildings and repetitive pasted-on windows, despite landmark GLBs, facade textures and improved roof placement. Upgrade individual building silhouettes, true depth in street-visible shopfront/window reveals, nonrepeating roof mechanical forms and authorized photo/PBR materials **without claiming photogrammetry**.
- **Priority 2 — Brooklyn Bridge / DUMBO coverage and road–structure clearance.** Current bridgehead density remains sparse (9.2% occupied area in the earlier measured focus box). Increase only road-safe, dry, nonoverlapping footprints with independent tests and render screenshots; preserve bridge clearance and boat paths.
- **Priority 3 — Chongqing photorealism and terrain/road/building overlap.** Keep the Hongyadong, Qiansimen Bridge, Raffles, Liziba and hotpot-pilot features, inspect the current `assets/chongqing` builders and existing road-clearance tests before modification. Do not copy NYC street geometry into Chongqing.
- **Priority 4 — Alaska fjord, shore and ice.** Protect USGS DEM shoreline and dry village/research-camp pads. Confirm ice floes do not sit on ground, and honor water takeoff/landing physics.
- **Priority 5 — Performance and licensing.** Limit detailed 3D/model tiles to landmark and near-spawn focus zones. Prefer approved/redistributable CC0 geometry and textures. No Google Maps imagery/3D tile scraping or shipping copyrighted replica assets. Use game-scale language unless georeferenced survey data is actually available.

## Regression and continuation protocol
1. Read latest `main`, open PRs and Actions before touching a file. There are **concurrent agents** and earlier PR merges may go stale.
2. Reproduce a visible defect with the **production code paths** and quantitative/bounded geometry (not only regex assertions).
3. Preserve scene collision, real road footprints, bridge/vehicle clearances and existing animation/aircraft systems. Avoid global shader changes affecting non-NYC maps.
4. Test `node --test tests/*.test.mjs` and relevant live WebGL workflows. `.github/workflows/nyc-bridgehead-browser.yml` captures nine NYC cameras and validates nonblank pixels, plus `tests/nyc-roof-setback-grounding.test.mjs` on PRs.
5. For before/after reviews, reuse the exact camera scripts and save screenshots as GitHub Actions artifacts. Read the actual report and source commit before declaring success.

**Next code task:** Audit the ordinary Manhattan tower shopfront and window geometry visible from `00-harbor.png` and `01-city-loaded.png`, then replace one limited near-spawn class of flat facade panes with physically bounded, realistic mullion/reveal assemblies using existing CC0 materials and the current batched mesh. Measure mesh cost and validate road/building footprint clearances, non-NYC fallback, and nine-view Chromium images. Do not broaden this into an uncontrolled whole-map rebuild.
