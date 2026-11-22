# PATROL context handoff — NYC sunward water and distant false globe
Last authoring date: 2026-11-22

> **Source recovery caveat.** The user asked to continue from an existing
> \`docs/PATROL_CONTEXT.md\` using \`$patrol-context-run\`. On 2026-11-22 the
> exact file was absent from \`main\`, the integration branch and checked
> working water branches, and that named skill was not installed in the
> available skill catalog. This file is **newly established**, not an
> assertion about unread earlier handoff instructions. Do not silently treat
> it as a recovered/complete previous context.

## Current code baseline and ownership

- Repo: \`bhu103-data/patrol-flight-sim\`; inspected current \`main\`
  commit \`6aee03e32cd06967451007d15d5fd9502f92de36\`.
- Dedicated branch: \`fix/nyc-water-sunward-horizon-moon-20261122\`
  based exactly on that SHA. **Main / shared integration / existing PR
  branches were not edited.** Do not merge without exact-head QA.
- Scope: only \`index.html\`'s NYC-controlled GLSL reflection ray and
  angular lunar projection; other shader modes retain existing behavior.
  No new 3D assets, images, video, animations, noise, render passes or
  underwater color hacks.
- In-progress and relevant earlier PRs: #151 (open draft, first recorded
  invalid \`abs(reflectionRay.y)\` diagnosis); #228 (other, separate NYC
  crosswind normal experiment); #131 (independent sky atmosphere work).
  Do not merge #151 and this port wholesale or overwrite them. Current
  branch ports a **restricted NYC-only** horizon ray fix onto recent main,
  plus the separately identified oversize moon angular error.

## Source-derived root cause / why not just change the water tint

1. In original live \`index.html\` \`WORLD_FS\` water shading,
   \`vec3 reflDir = reflect(rd,wn)\` was immediately followed by
   \`reflDir.y = abs(reflDir.y)\`. For downwards reflections, an
   invalid below-horizon direction was forcibly mirrored into upper
   celestial sky. The sun-facing water could thus sample an unrelated
   bright disk/upper sky, making an Earth-like curved arc.
   The RGB water pigment, Fresnel, wave spectrum, refracted floor and
   normal basis were **not changed**.
2. \`getSky\` included a detailed procedural lunar globe with angular
   radius \`0.026\` rad (1.49 degrees radius), versus near-real
   \`0.00455\` rad (0.26 degrees radius). In NYC this could look like
   a giant Earth far above the city. The NYC-only angular radius and
   dot gate are corrected; texture and palette unchanged. Other maps
   retain original sky angular behavior.
3. The separately textured, NASA EPIC \`Sphere Show\` is **Las
   Vegas-specific**, not a NYC sky map: \`prepareSphereShow()\`
   disposes the mesh, clears center/impact, hides the control, returns
   immediately unless \`selectedMap.vegas\`. Runtime QA checks NYC
   \`sphereMesh===null\`; no evidence to justify deleting or modifying
   legitimate Vegas Sphere Show assets.
4. All \`uWorld.sun/uWorld.moon\` inputs are already calculated by
   \`sampleFlightEnvironment\` and bound in the main loop. There is
   no second reflection texture/sky framebuffer whose colors should
   be tweaked to conceal the invalid geometry.

## Minimal reversible source change

\`\`\`glsl
// Only for Manhattan: preserve all other maps' previous lookup behavior.
reflDir.y = uManhattan ? max(reflDir.y, 0.002) : abs(reflDir.y);
float moonAngularRadius=uManhattan?0.00455:0.026;
float moonMinDot=uManhattan?0.9999895:0.99958;
\`\`\`

The \`getSky\` ray uses \`moonAngularRadius\` instead of constant \`0.026\`.
There is no alteration to \`floatOceanHeight\`, ferry collision/body,
\`waterborne\` or \`usableFloatWater\`, water seaplane pose, flight
controls, map transition, GL uniforms or sunlight wavelength.

## Real browser QA protocol / pending exact-head result

- Dedicated workflow \`.github/workflows/nyc-sunward-water-globe.yml\`;
  script \`scripts/nyc-sunward-water-globe-browser.mjs\`.
- Reproduces the original live shader in a **test-browser HTML response
  only**, and compares it with the committed fix, without deploying a
  second executable map or altering the source \`index.html\` at runtime.
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
