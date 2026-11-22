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
- No Google Maps 3D tiles, paid imagery or external runtime texture calls are used. The opt-in 1:1 scene requests only the cited public NYC OTI vector geometry; no nonredistributable model is included.

## 2022 OTI source surfaces — full bounded Times Square tile (online runtime)

The 1:1 reference scene now requests all three official 2022 NYC OTI polygon layers
for the same bounded Times Square WGS84 query envelope used by source audit PR
[#269](https://github.com/bhu103-data/patrol-flight-sim/pull/269):

| Official layer | ArcGIS FeatureServer | Audited source inventory |
|---|---|---:|
| Roadbed_2022 | \`/Roadbed_2022/FeatureServer/20\` | 81 features / 81 polygons |
| Plaza_2022 | \`/Plaza_2022/FeatureServer/16\` | 17 features / 17 polygons |
| Sidewalk_2022 | \`/Sidewalk_2022/FeatureServer/22\` | 54 features / 54 polygons |

The independently inspected source artifacts are #244 artifact 14742652611
(81 roadbed polygons / 8,883 vertices) and #269 artifact 14762041114
(17 plaza polygons / 594 vertices; 54 sidewalk polygons / 11,436 vertices).
The pedestrian inventory includes 1 plaza interior ring and 32 sidewalk interior
rings. Runtime parsing retains those holes rather than filling courtyards or
pedestrian cutouts. The 2022 source vintage is not a current 2026 field survey.

The bounded query envelope is
\`[-73.9900, 40.7552, -73.9822, 40.7610]\` (WGS84). Each original lon/lat
coordinate is transformed directly into the building scene's local tangent
metre frame with the same WGS84 conversion used for source buildings and
DCM centerlines. The runtime rejects an incompatible local origin, incomplete
source inventory, duplicate OBJECTIDs, malformed rings and area-changing
triangulation. No polygon is stretched to a guessed road width.

The scene uses Mapbox Earcut **v3.2.4** to triangulate concave polygons and
interior rings. Its ISC license is retained at
\`assets/nyc/EARCUT-LICENSE.txt\`; source is vendored at
\`assets/nyc/earcut.mjs\`. Browser geometry is bounded by the existing
1:1 Times Square pilot and its measured triangle budget.

When the complete OTI surface set is available, the guessed DCM-width asphalt
bands and gold centreline-looking trace are suppressed. Roadbed, plaza and
sidewalk polygons are rendered as separate visual categories. Millimetre-scale
Y offsets are only to prevent z-fighting; they are **not surveyed elevations**.
The DCM source lines remain for geographic alignment and safe spawn selection,
not as proof of vehicle access or legal routes.

The complete vector layers are fetched from the public OTI ArcGIS endpoints
only when this opt-in experimental scene is opened. If network access or source
validation fails, the scene falls back to the checked-in, simplified 11-FID
roadbed core and labels the fallback in its QA object. Query
\`?surfaces=off&roadbed=off\` disables both the live source layers and the local
roadbed fallback for a controlled same-camera comparison. \`?quality=low\`
still retains official surface geometry while disabling authored window panels.

This is a **bounded 2022 surface-geometry pilot**, not a full NYC pavement
inventory. It does not infer 2026 traffic access, road closures, curb heights,
crosswalks, lane markings, sidewalks' current walkability, storefronts,
elevation datum, aircraft collision or complete city coverage. The production
Manhattan aircraft map, original flight physics and other world maps remain
unchanged.

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
- Rendering official 2022 roadbed/plaza/sidewalk polygons does **not** grant a certified road surface to aircraft physics; current access, collision, surveyed elevation, lane/curb geometry and the rest of NYC need independent measured sources.

## Actual QA gate

\`\`\`
node --test tests/nyc-times-square-metered-massing.test.mjs tests/nyc-true-scale-flythrough.test.mjs tests/nyc-oti-surface-runtime.test.mjs
node scripts/nyc-oti-surfaces-browser-smoke.mjs
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

This independent Draft is stacked on the current #211 integration candidate
through the #321 1:1 runtime branch. It adds a source-aligned native WebGL2
reference scene, the experimental free-flight camera, and an online official
2022 OTI surface-vector layer with offline roadbed fallback, Node/browser
regression and same-camera evidence. It does not replace the production
Manhattan aircraft map or change aircraft physics, other maps or \`main\`.
