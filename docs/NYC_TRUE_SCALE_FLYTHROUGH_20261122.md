# NYC reality P0 | first source-aligned flythrough, not a photoreal digital twin

## What runs

From the normal PATROL flight-menu map cards choose **NYC TRUE-SCALE**.
The launcher opens \`assets/nyc/nyc-true-scale-flight.html\`, an independent
WebGL2 **free-camera flythrough**. Direct URL works, too:

\`\`\`
python3 -m http.server 8765 --bind 127.0.0.1
# http://127.0.0.1:8765/assets/nyc/nyc-true-scale-flight.html
# ?quality=low disables authored windows, not official building/road data
\`\`\`

Controls: click the scene for pointer-lock mouse look, WASD move horizontally,
Q/E descend/ascend, Shift speed up, arrow keys look, Esc releases pointer.
The camera has bounded 1:1 metre movement and checks source-footprint
height prisms so it will not enter ordinary building volumes. **This does NOT
reuse PATROL's jet or seaplane models, aerodynamics or terrain collision.**
The original Manhattan map and every other map continue unchanged.

## Verified source inputs and origin reconciliation

1. **Buildings**: \`times-square-footprints.json\` carried from the official
   NYC Building Footprints FeatureServer FIDs and HEIGHTROOF (in feet,
   published polygons rounded to 1e-6 degree). Parent Draft #235's
   \`buildMeteredMassing\` projects original longitude/latitude to a local
   WGS84 tangent coordinate system with anchor (-73.9864883,40.75775).
   Roof elevations are heights above local ground in metres
   (\`HEIGHTROOF * 0.3048\`). No old \`0.32\` or 66-unit clamp. Multiple-ring
   footprints are explicitly skipped, not falsely filled.
2. **Roads**: \`nyc-dcm-centerlines-sample.json\` is a compact bounded
   extract from the *actual* NYC Department of City Planning DCM Street
   Center Line ArcGIS service. The upstream source acquisition generated
   39 road records / 138 line strings:
   [GitHub Actions run 44992897630](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/44992897630),
   artifact 14742094590 \`source.json\` / \`plan.svg\`. This local snapshot
   retains 38 road features / 89 segments with an endpoint inside the
   recorded scene box, where DCM status was City_St, build status Improved,
   and paper street was N. The extraction is **not complete city-wide**
   or a full segment clip, and geometry can extend beyond that box.
   DCM local origin (-73.9864883,40.756421) is explicitly transformed
   into the building origin using the same metre conversion. It is not
   simply rendered with the wrong offset.
3. **Visible streets**: DCM records are **centerlines**, *not surveyed
   asphalt/curb edges, medians, vehicle lanes, sidewalks, signage or street
   elevation*. To make the pilot readable, road-corridor width is estimated
   solely for graphics using bounded fractions of DCM legal Streetwidth
   attributes; the golden trace represents source centreline alignment,
   **NOT actual NYC lane markings**.
4. **Visible building facades**: source-exact shapes and height prisms are
   retained. Coloured surfaces, windows, frame relief and window lighting
   are deterministic **artist-authored illustrations**, not factual
   texture scans, surveyed glass curtainwalls or actual storefront layouts.
   High-detail windows are bounded to 6,200 panels; low-quality mode skips
   them. These additions change the silhouette presentation, not the
   source building footprints/height or mesh collision envelope.

Sources and terms:
- Building Footprints: https://services2.arcgis.com/IsDCghZ73NgoYoz5/ArcGIS/rest/services/NYC_Building_Footprint/FeatureServer/0
- DCM Street Center Line: https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/ArcGIS/rest/services/DCM_Street_Center_Line/FeatureServer/0
- NYC Open Data Terms: https://data.cityofnewyork.us/stories/s/Terms-of-Use/k9k7-3cje
- No Google Maps 3D tiles, paid imagery, external browser runtime texture
  calls, or nonredistributable asset model is present.

## 2022 OTI source roadbed — **11 actual measured-shape FIDs**, opt-in true-scale map only

This independent candidate goes beyond DCM **road centrelines** for a *bounded
piece of Times Square*. New \`assets/nyc/nyc-oti-roadbed-core-2022.json\` is
derived solely from the city-published 2022 OTI Roadbed service at
https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Roadbed_2022/FeatureServer/20.
NYC Open Data also catalogs the planimetrics and the source imagery is from
18 March 2022 Manhattan, with the planimetric update completed in 2023.
The original authoritative publicly accessible NYC OTI query was audited
in stacked source work [PR #244](https://github.com/bhu103-data/patrol-flight-sim/pull/244):
successful Actions 44993348708 / artifact 14742652611, originally 81
polygon features with 8,883 original OTI vertices.

This **small reusable core slice** consists of source FIDs
\`21362,21367,22195,22209,22454,22459,23654,23665,23947,24700,24701\`.
Three are original source-code **350010** intersection polygons; eight
are **350000** paved roadbed polygons. This is **not a full city/neighborhood
roadbed inventory**. Original 1,293 vertices across those 11 source records
were topology-preservingly reduced with 0.05m simplification followed by
0.01m coordinate rounding, leaving 229 vertices. The actual worst observed
post-rounding boundary Hausdorff difference is **0.060106m**, and worst
area difference is **0.095078%**, recomputed against the full source geometries.
The asset reports conservative ceilings 0.061m and 0.096% respectively.

The source uses the #234 local WGS84 anchor (-73.9864883,40.756421).
The playable reference viewer uses #235's different anchor
(-73.9864883,40.75775). The code reprojects the OTI anchor into the
building anchor using the **same shared WGS84 local metre function**, never
simply overlays the arrays. Roadbed source polygons are concave roof-style
ear clipped to 207 upward triangles at exactly Y=-0.075m, not collapsed
to bounding rectangles, not stretched to #248's DCM strips. Adjacent DCM
fallback bands are still **only illustrative**, especially outside these FIDs;
the source patches are rendered above the existing illustrative band to make
the geometrically evidenced asphalt border inspectable. They do not infer
lane count, line marking, sidewalk, curb, construction grades or legal
turn rules.

In the experimental NYC TRUE-SCALE scene only, the OTI source-core slice
is enabled. \`?roadbed=off\` displays the previous invented road-width bands
unchanged. \`?quality=low\` disables expensive fake windows but retains
all 11 official roadway shapes. The original 0.32-scale production NYC
aircraft map, original flight physics and other world maps are not edited.
Browser QA captures the **same aerial camera** with the source slice on/off
plus the original source flythrough screenshots and measured 3-D triangle
budgets. SwiftShader proves WebGL behavior, **not** hardware frame times.

### Source/reuse and limitations

- NYC Open Data Terms: https://data.cityofnewyork.us/stories/s/Terms-of-Use/k9k7-3cje
- NYC Roadbed dataset: https://data.cityofnewyork.us/Transportation/NYC-Planimetric-Database-Roadbed/i36f-5ih7
- Official capturing rules: https://github.com/CityOfNewYork/nyc-planimetrics/blob/main/Capture_Rules.md
- The published local source is a **modified/decreased-vertex portion** of
  public NYC OTI municipal data, not an original survey or third-party
  photogrammetric mesh. No NYC images, advertisements or Google 3-D data
  included. Record attribution, capture year, transformation and
  simplification when redistributing; verify legal terms at integration time.
- 2022 paving may differ from 2026 Times Square plazas, pedestrian space,
  curb ramps, buses and temporary changes. The map remains NOT photoreal.
- Rendering the 11 official polygons does **not** grant a certified road
  surface to aircraft physics; the collision/road elevation datum and the
  rest of the street/pedestrian network need independent measured sources.

## Actual QA gate

\`\`\`
node --test tests/nyc-times-square-metered-massing.test.mjs tests/nyc-true-scale-flythrough.test.mjs
node scripts/nyc-true-scale-flight-browser-smoke.mjs
\`\`\`

CI: \`.github/workflows/nyc-true-scale-flight.yml\`. Browser QA must open
the normal PATROL launch menu, click the experimental map, render real WebGL2
geometry, capture a before/after screenshot after moving the flight camera,
verify street and source building counts and test low-detail recovery.
SwiftShader confirms functional image rendering only, not hardware GPU FPS.

**Merging or closing Issue #229 remains blocked** until actual real CityGML
3-D roofs/building forms replace source extrusions, verified real pavements
and curbs replace the DCM visual corridor, high-resolution legally licensed
landmark/façade assets are tied to real FIDs, real elevation datum is
resolved, and near-ground/low-flight reference-camera residuals plus GPU
budgets are measured. No proposal to replace the current production
Manhattan map based on these screenshots alone.

## Scope

This independent Draft is **stacked on parent Draft #235**, preserving
the parent reference experiment. It adds the source street snapshot,
a richer source-aligned native WebGL2 3-D batch, a walk/fly camera,
a launcher option, Node/browser regression and evidence workflow.
No writes to \`main\`, integration branch, aircraft physics, other maps or
original Manhattan scene generation.
