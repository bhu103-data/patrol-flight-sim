# PATROL context handoff — NYC sunward water and distant false globe
Last authoring date: 2026-11-22

> **Source recovery caveat.** The user asked to continue from an existing
> `docs/PATROL_CONTEXT.md` using `$patrol-context-run`. On 2026-11-22 the
> exact file was absent from `main`, the integration branch and checked
> working water branches, and that named skill was not installed in the
> available skill catalog. This file is **newly established**, not an
> assertion about unread earlier handoff instructions. Do not silently treat
> it as a recovered/complete previous context.

## Current code baseline and ownership

- Repo: `bhu103-data/patrol-flight-sim`; inspected current `main`
  commit `6aee03e32cd06967451007d15d5fd9502f92de36`.
- Dedicated branch: `fix/nyc-water-sunward-horizon-moon-20261122`
  based exactly on that SHA. **Main / shared integration / existing PR
  branches were not edited.** Do not merge without exact-head QA.
- Scope: only `index.html`'s NYC-controlled GLSL reflection ray and
  angular lunar projection; other shader modes retain existing behavior.
  No new 3D assets, images, video, animations, noise, render passes or
  underwater color hacks.
- In-progress and relevant earlier PRs: #151 (open draft, first recorded
  invalid `abs(reflectionRay.y)` diagnosis); #228 (other, separate NYC
  crosswind normal experiment); #131 (independent sky atmosphere work).
  Do not merge #151 and this port wholesale or overwrite them. Current
  branch ports a **restricted NYC-only** horizon ray fix onto recent main,
  plus the separately identified oversize moon angular error.

## Source-derived root cause / why not just change the water tint

1. In original live `index.html` `WORLD_FS` water shading,
   `vec3 reflDir = reflect(rd,wn)` was immediately followed by
   `reflDir.y = abs(reflDir.y)`. For downwards reflections, an
   invalid below-horizon direction was forcibly mirrored into upper
   celestial sky. The sun-facing water could thus sample an unrelated
   bright disk/upper sky, making an Earth-like curved arc.
   The RGB water pigment, Fresnel, wave spectrum, refracted floor and
   normal basis were **not changed**.
2. `getSky` included a detailed procedural lunar globe with angular
   radius `0.026` rad (1.49 degrees radius), versus near-real
   `0.00455` rad (0.26 degrees radius). In NYC this could look like
   a giant Earth far above the city. The NYC-only angular radius and
   dot gate are corrected; texture and palette unchanged. Other maps
   retain original sky angular behavior.
3. The separately textured, NASA EPIC `Sphere Show` is **Las
   Vegas-specific**, not a NYC sky map: `prepareSphereShow()`
   disposes the mesh, clears center/impact, hides the control, returns
   immediately unless `selectedMap.vegas`. Runtime QA checks NYC
   `sphereMesh===null`; no evidence to justify deleting or modifying
   legitimate Vegas Sphere Show assets.
4. All `uWorld.sun/uWorld.moon` inputs are already calculated by
   `sampleFlightEnvironment` and bound in the main loop. There is
   no second reflection texture/sky framebuffer whose colors should
   be tweaked to conceal the invalid geometry.

## Minimal reversible source change

```glsl
// Only for Manhattan: preserve all other maps' previous lookup behavior.
reflDir.y = uManhattan ? max(reflDir.y, 0.002) : abs(reflDir.y);
float moonAngularRadius=uManhattan?0.00455:0.026;
float moonMinDot=uManhattan?0.9999895:0.99958;
```

The `getSky` ray uses `moonAngularRadius` instead of constant `0.026`.
There is no alteration to `floatOceanHeight`, ferry collision/body,
`waterborne` or `usableFloatWater`, water seaplane pose, flight
controls, map transition, GL uniforms or sunlight wavelength.

## Real browser QA protocol / pending exact-head result

- Dedicated workflow `.github/workflows/nyc-sunward-water-globe.yml`;
  script `scripts/nyc-sunward-water-globe-browser.mjs`.
- Reproduces the original live shader in a **test-browser HTML response
  only**, and compares it with the committed fix, without deploying a
  second executable map or altering the source `index.html` at runtime.
- Both phases enter **formal PATROL Manhattan flight**, select a genuine
  C185 seaplane and water start, lock same eye height/coordinates, weather
  Clear, summer, 18:30 dusk, NYC quality 2, and the same GPU ocean wave
  time. Capture identical sunrise-facing and opposite azimuth scenes;
  capture a separate midnight scene facing computed moon for false-globe
  angular-size comparison. The test-only camera override never ships.
- Inspect original PNGs, frame-time p50/p95 (SwiftShader RAF **not** native
  GPU frame timing), WebGL errors, boat count, real ship collision
  presence and C185 waterborne status. Launch Alaska and Vegas in the
  original renderer to prevent cross-map regressions. A source test
  checks original physics/moving vessel and map-switch APIs survive.
- **Pending:** initial CI, screenshot visual examination, native GPU
  performance and persistent same-document Vegas→NYC map-switch trial.
  Do not label passed until checked. No film/offline animation created.

## Merge/revert and unresolved user-facing quality

- Revert this branch's source commit if matched-game sunward vs anti
  geometry or visible moon fails. Keep the PR Draft until both halves are
  actually accepted; do **not** merge water hue or horizon gradients as
  substitute.
- This is not a 1:1 photogrammetric NYC earth/sky system. Authentic
  shorelines, boat assets and city geometry remain separate projects.
- Relevant integration owners and flight invariants: keep existing
  C185 buoyancy and water impacts, ferry wakes and collision, map
  selection, Manhattan bridgehead and every other contributor's changes.

## Verified 2026-11-22 browser evidence and actual acceptance (NOT theoretical)

**Full fixed-height sun/anti/moon browser QA RUN PASSED** at exact head `b1d4cb15a6e21af00956b467dabd808ece398fd2`, [GitHub Actions run 45038788905](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45038788905), [original 6 PNGs + report artifact 14760553712](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45038788905/artifacts/14760553712). All screenshots are 1280×720 genuine canvas captures from the actual PATROL C185 Manhattan flight.

- Both modes, **fixed camera world eye** `[-61.006911668, 22.8, -569.424055]`, locked clear/summer 18:30, same sun vector `[-0.919251668,0.154427743,0.362116615]`; direct rendered ocean shader time pinned to 20.0 only within browser test HTML. Both sunward/anti-sunward were recorded, and midnight moon was recorded separately.
- **C185 remained waterborne**, no crash; **4 ships present**, moving-vessel collider returned `ship`, boat wake half-width 4.8; NYC Sphere Show `sphereActive:false`, game GL error 0 and context not lost. Tested actual original-map seaplane launches in **Alaska and Vegas** too: both game-playing, GL error 0, no context loss. Do not claim complete same-document map-switch yet.
- **False globe/Moon visual PASS:** In the original moon view, central 100×100 bright moon disc occupied ~233 pixels (same RGB threshold); corrected view has ~5 pixels. Actual screenshots personally inspected. Legitimate Vegas Sphere Show is untouched. This is physically informed apparent angular radius, NOT a repaint.
- **Sunward water visual FAIL / remains unresolved:** direct before/after sunward screenshot is almost identical. In the sunward water ROI, mean max RGB channel difference ~0.10/255 with only ~0.07% of pixels differing by more than 20 channel units; strong hard white sunlight and broad cyan water patches remain. Correcting the formerly invalid reflection hemisphere alone did not visibly fix them. **Do NOT merge/claim water realism acceptance** based solely on successful WebGL CI.
- **Software-only RAF**: before p50/p95 `202.2/331.5 ms`, after `208.0/387.5 ms` over 15 sampled intervals per comparison, NOT a native GPU benchmark, no 60 FPS claim. The adaptive offscreen FBO resolutions differed between independent anti-sun screenshot loads (819×461 vs 947×533), although eye, color settings and output 1280×720 matched. This limits subtle anti-direction pixel comparisons.
- Other exact-head results: PATROL Node regression, Cosmos source, Alaska source, **C185 WebGL2** and Alaska browser WebGL all passed. NYC Brooklyn Bridgehead and twilight-haze workflows were still pending at review: **not counted successful**.
- First attempt [run 45038513670](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45038513670) failed because a daytime pixel-brightness threshold misclassified a valid dark moon screenshot as blank. Fixed the threshold in `b1d4cb1`; 2nd browser run passed. No original screenshot was edited or replaced.

### Isolated follow-up investigation (source of sunwater highlight)

The direct physically-based solar GGX glint `waterDGGX(...) * waterVSmith(...) * waterFresnel(...) * ndl` and pixel footprint / world-space long-wave slopes were **unmodified in the first patch**. The independent physical solar glint likely dominates the white reflection stripe, since sky-reflection hemisphere flip barely affects pixels, but this is an **unverified hypothesis**. To determine component ownership without changing production colors, `scripts/nyc-sunward-component-isolation-browser.mjs` and dedicated workflow create identical live-flight test-only ablations of GGX glint, reflected sky, foam/crest shading and normals, with fixed diagnostic offscreen scale. Those temporary ablations are for finding the true cause; they must **NOT be merged as production fixes** or represented as a visual upgrade.

### Merge gate status

**Overall PR #263 stays Draft and water visual acceptance remains FAIL; moon angular correction PASS.** Before choosing a smallest separate sun-glint/normal-space production fix, inspect component isolation screenshots and actual p50/p95, preserve unchanged ferry/floatplane wave displacement and 1:1 cross-map behavior. The user expressly forbids hiding the defect with ad-hoc water color adjustments.

## 2026-11-22: real browser component isolation and minimal NYC-only production correction

**Real-world viewport causal isolation passed:** [GitHub Actions run 45039981222](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45039981222), [original full-resolution PNGs and report artifact 14761218799](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45039981222/artifacts/14761218799). The original live PATROL seaplane Manhattan flight was loaded five times: baseline and four temporary shader-component ablations. Equal 1280×720 screenshots, fixed internal 704×396 WebGL resolution, same exact eye/camera and sun vector, 18:30 clear/summer, same GPU ocean time. 4 ships active, safe C185 water-start and ship collider all intact. Browser reported `passed:true`; no shader, WebGL or JS errors.

**Causal results, measured on x=320..899, y=410..684 sun-facing water ROI (159,500 output pixels)**:

| Test-only component | Blue-green water mask (% pixels) | White glint pixels | Interpretation |
| --- | ---: | ---: | --- |
| Original | 43.05% | 939 | Broad implausible cyan patch and white solar glint |
| Remove GGX direct glint | 44.09% | 0 | GGX owns white sun reflection, **not** the cyan artifact |
| Remove sky Fresnel reflection | sky and water generally darken, cyan persists | direct glint remains | Sky reflection is not the dominant source of green patch |
| Remove view-sun crest emission | **3.89%** | **889** | Removes visually false cyan patch while preserving actual solar glint |
| Flat wave normal | cyan remains | white reflection broadens | Not a surface-normal-space sign error |

Threshold for blue-green mask: `G - R > 16`, `B - R > 16`, `G > 64`, `B > 75`; white-glint threshold `R,G > 200, B > 185`. Thresholds are **diagnostics from raw PNG pixels**, not ground-truth photometry, NYC sea-state spectra, or objective realism percentages. Source images were personally inspected: the no-crest screenshot removes cyan bands while remaining white reflection is visible. SwiftShader RAF p50 is baseline 262.7ms / noGGX 259.1ms / noReflection 245.0ms / noCrest 232.7ms / flatNormal 255.3ms; software rendering is **not native GPU FPS certification**.

**Actual production edit:** `index.html`, NYC-only guard `if(!uManhattan)` on a legacy additive view-dependent `waterCol += vec3(0.025,0.24,0.18)*crest*back*...` after Beer-Lambert, Fresnel and refraction, before GGX. This is **removal of physically unjustified camera-facing emitted light**: the prior `back` term depends on the horizontal sun/camera azimuth, with no `N·L`, microfacet BRDF or energy conservation. This is **not** a replacement water tint/color adjustment and does not change real GGX white solar reflection, wave displacement, normals, boat wakes or any shader constants for non-NYC maps. The earlier independent NYC reflection hemisphere and procedural-moon-angle fixes remain.

**Actual head QA guard:** `scripts/nyc-sunward-water-globe-browser.mjs` now reconstructs the **pre-PR** unguarded crest, old moon and reflection-ray shader in a browser-only HTML response for the before image; production new shader is the after image. QA fixes internal render resolution across cases to 0.55 scale, locks same height/exposure/world sun/ocean phase, measures cyan mask and preserved white glint pixels, requires 55% reduction in cyan share and retention of at least 65% of white-glint pixels. `tests/nyc-sunward-horizon-optics.test.mjs` asserts source of emitted crest is Manhattan-gated and unchanged true sun glint / ocean normals / refraction remain. The actions workflow also verifies C185 water contact, moving-vessel collision, Alaska/Vegas game launches and WebGL errors.

**Status at authoring:** corrected source committed to the same **Draft PR #263** after diagnostic proof; **new exact-head production A/B and cross-map tests have not yet completed**. Keep draft until full raw screenshot review. Same-document live Vegas→NYC map switching and native GPU frame-time benchmark remain untested. Never claim full map photorealism.
