# PATROL NYC — centralized reality-grade 3D acceptance (2026-11-22)

**Original QA starting code:** #211 commit
`b7441b9b20677a60128249bae0dc164e81e8f912`. The QA-only files were
merged into the still-Draft #211 branch at `1e1d8fb22c93f3b9075a5779d864877e7873b69d`,
which is the new exact-head rerun target. The earlier artifact
`14756234467` is baseline evidence from the older head only; it is **not**
a current-head performance or screenshot sign-off. The new workflow run must
record its actual checkout SHA and be inspected before accepting this QA.
This work changes *QA only*, not production `index.html`, map, flight controls,
GLB data, water, collisions, or branches from other authors.

## 1. Status discipline

Three **independent** gates are required. Do not promote one into another:

| Gate | Passing evidence | Failure/pending behavior |
| --- | --- | --- |
| Functional | real PATROL game WebGL2 PNG + no JS error, actual renderer, map/plane collision/LOD/cross-map CI | red if failed |
| Asset technical | binary GLB parse, actual triangles, material/texture presence, loader HTTP result, source/license and orientation documentation | red if unverified license, broken GLB, missing/failed load |
| **NYC geographic/visual fidelity** | independently sourced, legally reusable and dated reference; WGS84/ENU 3 control-point residuals; measured landmark/road/shoreline heights and bearings; actual matching camera FOV/pose and near/far side-by-side with mapped real-world reference; mesh topology, texture and waterline/ship design correctness | **NOT ACCEPTED until every source/camera check completed** |

All screenshot smoke, rAF cadence and triangle submit counts are **diagnostics, not realism scores**. The existing PATROL NYC uses **fictional compressed game coordinates**, so the seven fixed game cameras cannot currently be registered to exact real-world positions. Keep geographic camera matching **BLOCKED**, do not invent pose, FOV, residual or location.

## 2. Run the new seven-view real flight-map QA

```bash
python3 -m http.server 8765 --bind 127.0.0.1
npm install --no-save --no-package-lock --ignore-scripts playwright@1.56.1 pngjs@7.0.0
npx playwright install chromium
PATROL_BASE_URL=http://127.0.0.1:8765 node scripts/nyc-reality-central-3d-qa.mjs
```

The GitHub Action `nyc-reality-central-3d.yml` does this on the PR head. Artifacts:
`artifacts/nyc-reality-central-3d/central-report.json` plus unedited PNGs
at 1280×720: an **additional actual open-water aircraft-spawn screenshot**
(`00-harbor-spawn-airborne.png`), captured before opening Scenic Views,
plus seven existing game presets. The previously chosen named Waterfront
camera can point into nearby box buildings and must **not** be treated as
proof of visible ferries or shoreline simply because its label says Waterfront.
The extra open-water camera reports pixel evidence and actual aircraft spawn
state, but does not certify hull identity, berth or source coordinates.
1. Brooklyn Bridge deck and Brooklyn/BQE connection, zoom 68
2. DUMBO warehouse blocks, zoom 42
3. Statue of Liberty, zoom 42
4. Times Square street (signal, crosswalk, street furniture), zoom 42
5. 44th Street LED Canyon, zoom 42
6. Lower Manhattan window façades / skyline, zoom 42
7. Lower Manhattan Waterfront (piers, coastline, harbor; whether ship is visible **must be verified visually**), zoom 42

All use game angle=0, in-game noon, clear weather, season=1, existing Scenic Views,
same canvas, same graphics mode. The report records the *actual* scenic camera
label and sliders; geographic GPS coordinates, focal calibration, photo date,
and field of view are not provided because they are **unknown**, not implied
by “fixed camera”.

Measured: scene load wall-time, WebGL2 context/error, per-site mean/P95
`requestAnimationFrame` delta in Chromium SwiftShader, per-sample submitted
triangle draw counts (not unique physical triangles), original PNG
pixel checks, actual enabled/disabled manifest GLB file bytes/primitive
triangles/materials/textures and HTTP status when requested, in-game
`KeyW` aircraft-motion probe, and Manhattan→Copper Coast→Manhattan
switching. This is **not native GPU frame timing** and does **not test
Chongqing redirect/Alaska**; use their distinct exact-head prior CI artifacts.

## 3. Measurable geographic and material gates — currently NOT PASSED

| Target | Real independent authoritative anchor | Current accepted state |
| --- | --- | --- |
| Brooklyn Bridge | NYC DOT total length with approaches 6,016 ft (≈1,833.7 m); main suspended span 1,595.5 ft (≈486.3 m), midspan navigational clearance 135 ft (≈41.15 m); stone arches/cables/truss and true East River shoreline | compressed PATROL bridge deck `EAST_RIVER_BRIDGE` coordinates only; physical length and yaw registration absent |
| Statue of Liberty | NPS total ground-to-torch 305 ft 1 in (92.99 m), faces southeast; pedestal/Fort Wood plan and crown torch as reference | PATROL `NEW_YORK_LANDMARKS.liberty.top=31.3` game units, procedural statue, manifest scenario `liberty.enabled=false`; cannot call true-size or accurate scanned mesh |
| Times Square | NYC OTI official footprints/roof heights + dated borough roadbed polygon, actual Broadway / 7th Ave, named buildings, street signals per NYC DOT | default game buildings use ~0.32 scale; multiple reference pilots #233/#235/#236/#237/#239/#240 compete, #234 roads and #244 polygon roadbed separate; no 1:1 production cutover |
| DUMBO / waterfront | municipal building polygon FIDs, NYC roadbed, bridge and shoreline survey | reference-only 48-metric-DUMBO draft #243; game warehouse repeats and compression remain |
| Ferries / ships | source-dated vessel plans and official beam/LOA/draft and rights; actual quay waypoints and ship wake/waterline | generic game ferry 26×6.6 *game units*, no verified official port service path; NYC twin-hull proposal #104 is original approximated mesh, not manufacturer CAD |
| LOD/texture/GLB | actual GPU mesh draw+triangle per camera, traceable source license, UVs, textured PBR slot and native hardware performance | only partial GLB enabled (trade/empire/chrysler); city-sized LOD and native GPU VRAM evidence not yet proven |

Official NYC DOT bridge: https://www.nyc.gov/html/dot/html/infrastructure/brooklyn-bridge.shtml  
NPS monument: https://www.nps.gov/stli/learn/historyculture/statue-statistics.htm  
NYC building polygon: https://data.cityofnewyork.us/d/3g6p-4u5s  
NYC OTI 3-D model dated 2014: https://data.cityofnewyork.us/d/tnru-abg2  
Legal asset listing: `assets/nyc/THIRD_PARTY_NOTICES.md` + `assets/nyc/scenario-manifest.json`.

Rights caveat: a public metadata page is not itself a full license to redistribute
third-party 3-D meshes, photos, or advertisements. Do not use Google 3D Tiles
or Street View imagery as copied assets.

## 4. Related PR conflicts and merge plan

- #211 is the tested **functional integration baseline**. No photoreal sign-off.
- #233, #235, #236, #237, #239, #240 (+ #242) duplicate most of the
  120-record Times Square building/ENU reference and use different origins,
  filenames and preview engines. Choose **one**, not all.
- #234 is official DCM street centerline data, not full surveyed pavement;
  #244 has official OTI ROADBED polygons with interior-hole tessellation:
  these must be **joined in one CRS/origin** to a single chosen building layer
  before replacing the procedurally compressed scene, not overlaid.
- #238 and #243 are DUMBO-specific true metre scale previews, not the live
  road/waterfront/flight scene.
- #248 launches an opt-in true-metre **free camera** from the PATROL launcher,
  but lacks original aircraft flight dynamics, verified roadbed, current
  real facades and 3-D shoreline. This is **not a pass for original game**.
- #103 has a 15,900-triangle CC0-sourced Liberty GLB staged with
  `enabled=false`; #104 improves ferry to two hulls but documents unverified
  operational waterline/route and inherited collision envelope. Avoid
  importing their binary/geometry without targeted acceptance.

## 5. Next smallest user-visible *source* correction

On the suitable named detail/transport branch, **fix only the observable
mismatch with the strongest external documentation**. Preferred
source-level action: verify #104 proposed NYC ferry vertical *visual mesh*
top against `SHIP_TYPES.nycFerry.top` and actual ship/bridge clearance,
not only its 26×8 footprint; if visual top exceeds collision height,
update only NYC-specific collision clearance and tested route
conditions. Preserve coast/Alaska generic vessels. On the broader
reality branch, source one mapped roadbed and facade site for the
Times Square pilot; prohibit adding generic extra tower boxes as a fix.

**No videos or rendered animations.** Browser screenshot files are static.


## 6. Exact-head follow-up acceptance — 2026-11-22

### Functional evidence is green; visual/geographic acceptance remains red

- #293 `feat/nyc-metric-fid-material-preview-20261122-chat`, HEAD
  `8625ef4be8685f4ec462248f360d28507c67f01d`: **4/4 Actions pass**,
  including `NYC 1:1 official-source free-flight WebGL QA`,
  `PATROL regression tests`, Cosmos source checks and Brooklyn Bridgehead
  WebGL smoke. Its exact-head bridgehead artifact is run
  [45048583221](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45048583221),
  artifact `14764733767`. The browser report says `passed=true`,
  `graphicsError=0`, `warnings=[]`, and records the bridge, DUMBO,
  Liberty and Times Square camera captures. This is a functional browser
  smoke, not proof of real-world geometry.
- Visual inspection of the exact #293 captures finds stylized low-poly
  buildings, large flat wall areas, repeated rectangular windows and
  non-surveyed facade materials. The #293 test report itself explicitly
  records `trueFacadeVerified=false` and
  `materialEvidence=visual-proxy-only-not-as-built`. Keep the material
  change as an opt-in preview; do not promote it as photoreal facade work.
- The same report records 118 source footprint buildings, 38 DCM street
  features / 89 line segments, 11 official 2022 roadbed/intersection
  polygons (207 triangles), but `roadbedFullNYCCoverage=false`,
  `trueRoadbedVerified=false`, and `trueFacadeVerified=false`.
  It also confirms the preview is an independent free-camera scene and
  `usesOriginalAircraftPhysics=false`. The material preview adds 1,560
  wall triangles while leaving the scene total at 23,459; this is a
  bounded visual experiment, not a complete facade dataset.
- #248, stacked on #235 (which is stacked on #211), has 8/8 Actions green.
  Its true-scale flythrough report records 118 official footprint/height
  buildings, 38 DCM centerline features / 89 segments, and 11 2022
  roadbed/intersection polygons. It explicitly labels the view an
  experimental free-flight camera, not original aircraft physics; facade
  windows are artist-authored and not surveyed. Its exact screenshots
  visibly retain large blank facade planes. Do not merge it as a
  replacement for the live aircraft scene.
- #239's separate metric-massing pilot also passes its seven checks, but
  its exact low-flight image is a footprint-and-roof-height extrusion
  pilot (2,101 triangles), not a detailed architectural facade model.
  It is a useful geometry/unit reference only.

### Potential official 2014 3D building model — held out pending rights

NYC Planning's official metadata describes a city-wide 2014 aerial-survey
model with a hybrid CityGML LOD1/LOD2 specification, building roof/facade
layers and approximately 100 iconic buildings at LOD2. It reports 95% XY
positional accuracy within +/-1.25 ft and 95% Z accuracy within +/-1.6 ft.
The model is historical (2014 capture; metadata last updated 2018), not a
current-day scan. Sources:
- https://data.nyc.gov/City-Government/NYC-3D-Model-by-Community-District/u5j4-zxpn
- https://www.nyc.gov/assets/planning/download/pdf/data-maps/open-data/nyc-3d-model-metadata.pdf
- https://github.com/CityOfNewYork/nyc-geo-metadata/blob/master/Metadata/Metadata_3DBuildingModel.md

**Rights gate: do not import or redistribute this model yet.** Its metadata
says only "Open Data policies and restrictions apply" and "Access Rights:
Public"; it does not name a specific redistribution license. NYC.gov's
current Terms of Use state that materials on NYC.gov are City property with
all rights reserved, and direct users to contact the relevant agency for
permission to use City intellectual property. Until the dataset-specific
terms or written permission clearly authorize modification and
redistribution of the model files, treat this asset as **not approved**.
No model files or derivatives from this dataset were downloaded, committed,
or used in PATROL. This is a fail-closed provenance decision, not a claim
that the public dataset is unusable for every purpose.


- The existing NYC Building Footprints source snapshot (`3g6p-4u5s`) and DCM
  centerline snapshot are publicly accessible municipal datasets, but the
  checked-in provenance must not be described as CC0: the current source
  metadata/terms do not state a named SPDX/CC license in the project record.
  Retain attribution and source URLs, and treat redistribution of raw or
  derived source snapshots as a separate rights-review item. No new
  NYC-derived source snapshot was added by this follow-up.

### Current release decision

- Keep #211 Draft and keep #293/#248/#239 as isolated opt-in experiments.
- Do not duplicate the #218 BQE port; its three files remain unchanged at
  the #211 head.
- Do not call the city photorealistic or geographically certified.
- Next viable Manhattan facade path: obtain explicit reuse permission for
  the official 2014 model, **or** create original project-authored LOD2
  geometry from independently documented, redistributable source records.
  A source snapshot must record dataset/version/date, license, attribution,
  coordinate frame, feature IDs, geometry/texture budgets and camera
  residuals before any production import.
- Keep real aircraft dynamics, collision, map switching, roadbed/curbs,
  and native-hardware frame-time gates separate from the experimental
  free-camera pass.
