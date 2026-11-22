# PATROL NYC — centralized reality-grade 3D acceptance (2026-11-22)

**Authority / starting code:** exact merged flight candidate #211, commit
`b7441b9b20677a60128249bae0dc164e81e8f912`.
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
