# PATROL_CONTEXT — 集中 QA / Liberty PR 去重交接

> Status: **new handoff file created 2026-11-22 in an independent QA branch**. Searches of `main`, #211, #253, #256 and repository default-branch code search did **not** find an existing `docs/PATROL_CONTEXT.md`. Do **not** mistake this newly created file for a previously read user's context. The requested `$patrol-context-run` skill was not available in the current installed skill list or repository paths; audit followed the verified GitHub PR and artifact data directly. Future readers should reconcile any separately maintained context before replacing it.
>
> **NO MERGES, NO MANIFEST ENABLE, NO main writes.** This document lives only on `qa/patrol-context-liberty-253-256-20261122-chat` until separately reviewed.

## 0. State to resume

- Repo: `bhu103-data/patrol-flight-sim`.
- `main` observed baseline: `6aee03e32cd06967451007d15d5fd9502f92de36`.
- Functional integration Draft [#211](https://github.com/bhu103-data/patrol-flight-sim/pull/211): `b7441b9b20677a60128249bae0dc164e81e8f912`. This file's parent branch is #211; this docs-only QA branch **does not** import Liberty into #211.
- NYC geography/photorealism P0 [#229](https://github.com/bhu103-data/patrol-flight-sim/issues/229) stays **NOT ACCEPTED** regardless of any green WebGL smoke.
- No video/animation generated. No manifest activation, no production feature changes, no PR merged or closed as part of this audit.

## 1. Evidenced binary and rights

Asset: `assets/nyc/scenario/liberty.glb`, **exact same Git blob** on current #103, #253 and #256:

| Property | Verified value |
| --- | --- |
| Git blob SHA-1 | `344fb03eec240450e493516c9305fca2eb79173f` |
| Binary SHA-256 checked by exact-head Node jobs | `34ed58d06e008adcced5e60376bbcc11d675f3d4ec01434016df92d244f33225` |
| Bytes | `913,936` |
| Triangles | `15,900` |
| Textures | 1 embedded baked 1024×1024 Base Color PNG atlas; no KTX2/Basis |
| Runtime height | **31.3 compressed PATROL game units**, **not** true 92.996 m NYC scale |
| Source | [Innerscene original Statue on pedestal](https://www.innerscene.com/tools/library/3d-parts/statue-of-liberty-on-its-pedestal-c8a7318f) |
| Permission | [Publisher's Free Parts Library terms](https://www.innerscene.com/tools/library/terms) and item page declare CC0 1.0, modification and redistribution permitted; **publisher-declared rights**, no independent provenance warranty |
| Geographical status | Artistic reconstruction; no photogrammetry, real-orientation or GPS camera calibration |

The same blob identity was read **directly from three complete Git trees** (not inferred solely from PR descriptions), with `truncated=false`. Both exact-head source CI jobs recomputed the binary SHA-256 and checked triangles/atlas.

## 2. PR inventory and overlap

| PR | Head / actual branch base | Evidence and disposition |
| --- | --- | --- |
| [#103](https://github.com/bhu103-data/patrol-flight-sim/pull/103) | `c566814be9648da3fc939ba721a13fa18da31d3c` / `codex/patrol-integration-20261121` | **KEEP** one source binary and original CC0/license + per-height collider tests; remains Draft. Manifest remains disabled. |
| [#130](https://github.com/bhu103-data/patrol-flight-sim/pull/130) | `304ad7cac8c441303994f0039858b9e4bf115442` / older #103 baseline | **DO NOT REOPEN/MERGE SEPARATELY**: closed, not merged, but the current #103 and #130 have byte-identical `index.html` blob `0718a0ed...`, actual 16-band collision test blob `d609068c...`, and static WebGL QA script blob `6dd8575a...`. These source-level collision changes already exist in current #103. |
| [#253](https://github.com/bhu103-data/patrol-flight-sim/pull/253) | `9d8b05a8e4b42d64f825aa041d0ea374dd362ab2` / current #103 head | **DO NOT MERGE as a second Liberty feature**. Uses `?nycModels=libertyCC0`; valuable implementation of **SHA-256 before decode**, exact triangle and dimensions refusal, 2-camera seaplane A/B. Transfer these safety guards to chosen feature PR with own tests; preserve exact-head evidence. Keep Draft untouched in this QA turn. |
| [#256](https://github.com/bhu103-data/patrol-flight-sim/pull/256) | `10cfa432fbd77350e66a66d45da1550b3d5cfb10` / #130's closed branch | **CONDITIONALLY KEEP as sole prospective live-feature candidate**. Opt-in `?nycLibertyCC0=1`, same 15.9k GLB, near/mid/far selection, explicit `?nycModels=legacy` rollback, forced network-failure fallback. Must **retarget/rebase onto current #103** after reviewing resulting diff and **port #253 runtime SHA+dimensions gate** before any merge review. |
| [#211](https://github.com/bhu103-data/patrol-flight-sim/pull/211) | `b7441b9b...` / main | **HOLD** functional integration as-is. No Liberty change from #253/#256 merged here. |

**Only safe proposed path (conditional, NOT executed):** current #103 as the single asset/collider source → **rebase/retarget #256 to current #103** and port only #253's missing fail-closed pre-decode SHA-256 + exact dimension protection → run full exact-head review and merge-gate approval later. **No merge of #130 or #253 as sibling changes**, and **do not apply both URL switches**. #130's closed PR is not the same as a merged dependency; its materially relevant collision file content has independently been confirmed present in #103.

#253 and #256 diverge and **both modify `assets/nyc/nyc-realism.js`** with incompatible query controls, fallback and buffer lifecycle handling. #256 additionally edits `index.html` plus **the manifest metadata** (`license` filled; `reference_only=true`) but manifest `landmarks.liberty.enabled` is **still false** at both exact heads. No default activation.

## 3. Exact-head CI and actually inspected browser PNGs

- **#253** exact head 5/5 workflows SUCCESS, including [native PATROL WebGL run 45026120432](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45026120432) and [4 unedited 1280×720 PNGs+JSON, artifact 14755549829](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45026120432/artifacts/14755549829). Normal model = 292 triangles, CC0 scenario = 15,900, dimensions 9.323×31.3×9.323, actual game seaplane selected, one HTTP 200 CC0 GLB fetch, no JavaScript/GL errors. Matched front/harbor-close ROIs change **27.40% / 26.73%** of sampled pixels; this is visible geometry difference, **not** survey fidelity. SwiftShader software rAF p50/p95 baseline **705.2 / 1405.6 ms**, CC0 **721.4 / 1437.4 ms**, n=40 each (not real Windows GPU FPS).
- **#256** exact head 8/8 workflows SUCCESS. [Native PATROL WebGL run 45026859333](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45026859333) with [4 unedited 1280×720 PNGs+JSON, artifact 14755174984](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45026859333/artifacts/14755174984): default, source-optin, explicit legacy rollback, forced CC0 GLB network-failure. Opt-in network HTTP 200, WebGL error 0; actual `near-cc0` = 15,900 tris with texture, bundled `libertyLow` = 292 tris and existing procedural = 1,532 tris; all four render without GL error. Visual ROI changed **20.8116%** of sampled pixels vs baseline; single flight-scene load timings 3561 / 3182 / 3286 / 3388 ms (default/optin/rollback/network-fail); no validated native GPU frame budget. [Source-and-crossmap run 45026859333](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45026859333) did **452/452** Node tests. Existing C185/Alaska/bridge/Cosmos workflows also passed.
- **Real in-game visual review**: the changed statue has articulated robe/crown/torch/stone podium vs bundled low model and visible single pedestal. Fort Wood and shoreline remain **stylized non-survey**. Screenshots are valid actual PATROL flight scenes, but there are **no GPS+FOV registered real-world same-pose reference photos**. #256 browser report proved **near** LOD only: mid and far are source-coded assertions, **not independently captured distance-graded aircraft+eye flight screenshots**.
- **Collision evidence**: current #103/#130 16 radial height-band conservative collider verified by 12 game-resolver low-flyby sweeps (radius 8.2/9.1/10.3 game units × heights 5/11/20/29), 96 navigation-surface parity samples Δ=0, and source-bound radius max 6.592 vs Fort Wood inner walkway radius 10 ⇒ **3.408 game-unit planar clearance proxy**. This is not watertight mesh collision, real pedestrian clearance, real GPS scale, or manually flown water/shoreline proof.

## 4. Blocking discrepancy — runtime binary identity in #256

**Source-inspected, not inferred**: #256's `assets/nyc/nyc-realism.js` has **no `crypto.subtle.digest` / pre-decode SHA-256**. It allows the staged `scenario/liberty.glb` on the opt-in flag when disabled in manifest, subject to manifest path/license and decoder triangle-minimum. The opt-in LOD selection later checks `photoModel.triangleCount===15900`, but **triangle count is not a cryptographic hash or complete collision-fingerprint**. A subsequently swapped different 15.9k-triangle GLB could retain this tag and trigger source-specific 16-band collider without matching source geometry. #256's **Node CI verifies the committed bytes at build time only**, not the actual bytes delivered by the browser.

#253 already has a better **pre-decode** `crypto.subtle.digest('SHA-256', bytes)` exact guard and checks decoded 15,900 tris and physical game dimensions 9.323×31.3×9.323, disposing rejected GPU resources and leaving old fallback. **Port this narrow guard to #256 instead of merging #253's duplicate opt-in switch.** Retain `enabled=false`; no blank license bypass that would enable unknown assets.

## 5. Next executable acceptance (one smallest QA-to-merge step)

**Assigned target #256; perform on its own child/repair branch, NOT main/shared integration:**
1. Rebase/retarget its single live-feature branch onto current #103 only after inspecting ancestry/diff and ensuring #130's identical 16-band collider is not added twice. Preserve one opt-in URL `?nycLibertyCC0=1`, default and `?nycModels=legacy`.
2. Port exact #253 pre-decode SHA-256 + dimensions bound; enforce enabled=false as a strict default. Inject a **different GLB payload with the same triangle count** via Playwright request interception (or byte-corrupt an otherwise same-size file) and verify fail-closed → original low-poly/procedural model, model-specific radial collider **not** armed, zero GL errors; also verify valid exact-hash payload accepts near CC0.
3. Capture true **near, mid and far** original-game aircraft+camera distance cases (same graphical environment/recorded FOV), asserting 15,900 near, 292 mid, and chosen 292 far (two unique mesh levels), plus forced GLB failure and explicit rollback. Capture `index.html` native WebGL 1280×720 screenshots and JSON with GL errors, load timings, triangle counts, old-fallback references.
4. Run source-specific **actual** sweep collision around Fort Wood and a **manual or instrumented low-altitude C185/fighter flyby** with terrain/shoreline parity, old-v-new source alignment, and record software rAF mean/P95. Separately obtain Windows hardware GPU frame-time/FPS evidence before approving default feature. Do **not** call these screenshots a genuine photo-matched 1:1 Statue.
5. Review parent license/legal attribution on the final branch, all C185/Alaska/Cosmos/NYC exact-head regressions, and isolated bridge/boat side effects. **Only then consider release approval**, with a separate approval to ever enable the manifest.

Expected next artifacts: valid-source/forged-source/failure/rollback JSON, 3 distance-tier in-game PNGs, GLB content hash plus Git blob, mean/P95 software-frame intervals and explicit separate native-GPU result. **If any artifact is missing, conclusion remains BLOCKED.**

## 6. Evidence pointers

- [Publisher's CC0 item](https://www.innerscene.com/tools/library/3d-parts/statue-of-liberty-on-its-pedestal-c8a7318f), [CC0 library terms](https://www.innerscene.com/tools/library/terms).
- [#103 base source/collider](https://github.com/bhu103-data/patrol-flight-sim/pull/103), [closed/superseded #130](https://github.com/bhu103-data/patrol-flight-sim/pull/130), [#253 runtime SHA guard](https://github.com/bhu103-data/patrol-flight-sim/pull/253), [#256 LOD/fallback](https://github.com/bhu103-data/patrol-flight-sim/pull/256).
- [#253 screenshots](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45026120432/artifacts/14755549829), [#256 screenshots](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45026859333/artifacts/14755174984).
- Central NYC realism acceptance [#229](https://github.com/bhu103-data/patrol-flight-sim/issues/229).

**Resume instruction:** read this file; check #103/#253/#256 latest heads and exact Git trees first; if any head changed, refresh evidence before acting. Never report functional CI green as photorealism approved. No merge, manifest enable, or source/code edits were made during this audit; only this docs-only handoff branch was created.


## 7. Continuation: exact runtime fingerprint child QA (2026-11-22)

- **New independent child Draft [#272](https://github.com/bhu103-data/patrol-flight-sim/pull/272)**, based exclusively on #256 `10cfa432fbd77350e66a66d45da1550b3d5cfb10`, head initially `7e2dc74f32bb35d9492b810e63f4e33f00536f12`.
- Branch: `fix/nyc-liberty-cc0-failclosed-sha-20261122-chat`. Exactly **three text paths** changed relative to pinned #256: `assets/nyc/nyc-realism.js`, `tests/nyc-liberty-cc0-production-optin.test.mjs`, `scripts/nyc-liberty-production-lod-browser.mjs`. No changes to actual GLB, `index.html`, `scenario-manifest.json`, main, #103, #211, #253, #256 or this handoff's base.
- Runtime source fix: ported from #253 the **exact SHA-256 check of received GLB before decoder or GPU allocation**, and then guards indexed 15,900 triangles + decoded dimensions 9.323×31.3×9.323 before marking `mesh.source='scenario'`. Failure keeps original bundled model and does **not** arm CC0 radial collider. The selected URL query remains only #256's `nycLibertyCC0=1`; manifest default stays disabled.
- Browser negative-control test: intercept **HTTP 200** Liberty GLB, mutate exactly one BIN data byte without changing glTF JSON, size or indexed 15,900-triangle count; verify runtime reports SHA mismatch, keeps bundled **292-triangle** model and refuses scenario-shape collision and near CC0 LOD. Also retain four existing real PATROL game cases: default, genuine source, legacy rollback, HTTP failure. Five static browser PNGs and JSON on success.
- **CI was queued at the time of this handoff update**, e.g. [exact-head workflow 45038906061](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45038906061). **DO NOT state success until the updated exact-head Actions and artifacts are inspected.** Fix only #272 if QA script fails; do not hide a failing test.
- This is a security/collision correctness gate, **not** a merge or geographic/photoreal performance approval. Other P0 blockers remain: mid/far actual camera+aircraft LOD snapshots, Fort Wood low-altitude sweeps, parent #103 source/rights approval and rebase of #256 onto #103, native Windows GPU mean/P95 frame time.

**Resume after this note:** first fetch #272 current head, workflow conclusion and artifact; if changed, reread source; inspect the specific tampered `report.scenarios` entry for source/triangle/hash/collision refusal, then record final verdict in #256 and here. No merge or manifest activation.


## 8. Negative-control browser QA attempt and corrected wait (2026-11-22)

- #272 initial head `7e2dc74f32bb35d9492b810e63f4e33f00536f12`: [exact-head CI #45038906061](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45038906061). Source tests **5/5 PASS**, full Node **453/453 PASS**, committed CC0 source hash+triangles verified. Its browser job **FAIL**, so do not report this head as green. [Failure artifact #14761335298](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45038906061/artifacts/14761335298).
- Real browser default screenshot loaded bundled **292 triangles**, HTTP 200, GL error 0, source-specific collider false. Real valid opt-in loaded **15,900 triangles** at **9.323031×31.3×9.323031**, `source=scenario`, `sourceColliderEligible=true`, `near-cc0`, atlas loaded, GL error 0, with ROI change **0.33198644**. This establishes original source is not broken by the pre-decode runtime SHA protection.
- **Exact browser failure**: 60 s `page.waitForFunction` timed out at **legacy rollback** because it expected a nonzero imported GLB triangle count even when `nycModels=legacy` intentionally disables ALL imports and uses procedural geometry. This was a **QA test-logic defect**, not evidence of a regression in game GLB decoding or loading. The same-triangle-count forged-GLB case had **not yet executed** at this failed head.
- Narrow QA-only correction `6bab899a1ad88d46d6ca927e8f3242a217e59a7f`: skip waiting for an imported GLB **only** in the intentional legacy rollback branch, while still waiting for a real bundled or scenario GLB in normal/opt-in/network-failed/tampered cases. No game source/manifest/GLB change in this correction.
- [Exact-head re-run #45039416009](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45039416009) is queued at this checkpoint. **Critical negative test still pending**, as are browser PNG review and bridgehead exact-head CI. If failure reoccurs, preserve failure evidence and repair on #272 only. No merge, no manifest enable.


## 9. Verified binary-spoof negative control (2026-11-22)

**Exact child source HEAD:** `6bab899a1ad88d46d6ca927e8f3242a217e59a7f`, only three paths changed from #256 and only the test-script rollback wait changed after first CI failure. [Liberty exact-head browser & source workflow #45039416009](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45039416009) **SUCCESS (both jobs)**. [Five static in-engine 1280×720 PNGs + JSON artifact #14761162927](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45039416009/artifacts/14761162927) independently downloaded, JSON parsed, five unmodified PNGs visually inspected.

| Tested actual Manhattan scenario | GL error | Source-tri count | Candidate-specific collider eligible | Expected result |
| --- | --- | --- | --- | --- |
| Default | 0 | 292 bundled | false | exact baseline scene, no new CC0 request |
| Genuine `nycLibertyCC0=1` | 0 | 15,900 original CC0 | true | `near-cc0`, texture true, received GLB HTTP 200 |
| `nycModels=legacy` override | 0 | 0 imported (pure procedural) | false | rollback without candidate requests |
| Forced original GLB network failure | 0 | 292 bundled | false | safe fallback with expected failure warning |
| **Forged same-triangle-count HTTP 200 GLB** | **0** | **292 bundled** | **false** | **runtime SHA mismatch and fallback, not candidate geometry** |

The last test changed precisely one source BIN byte at offset **1504**, old value 154 → 155, while preserving GLB JSON, **913,936** bytes, and **15,900** indexed triangles; the browser served HTTP 200. The loader rejected it *before decode* with `scenario liberty: Liberty CC0 SHA-256 mismatch; retain bundled fallback`, kept 292-triangle GLB, `PatrolLibertyLodQA=null`, `sourceColliderEligible=false`, WebGL error 0. This **proves the specific forged-payload gate**; do not overinterpret it as a comprehensive cryptographic security audit of all possible malicious files.

The genuine candidate runtime dimensions were **9.323031×31.3×9.323031**, camera vs aircraft distances **34.83/41.24** compressed game units, selected `near-cc0`, source-specific collider true. Measured fixed-camera ROI changed **33.72%** of thresholded sampled pixels vs bundled baseline, which is visual evidence of replacement **not** a photoreal similarity score. Initial load times (one CI environment observation): default **3810 ms**, genuine **3278 ms**, legacy **3466 ms**, network failure **3404 ms**, tampered **3246 ms**; no native-GPU P95/FPS.

**Manual visual reality verdict remains FAIL:** authentic-ish CC0 sculptural mesh improves robe, torch, crown and pedestal, but the island/plaza, quay, ferry and skyline remain stylized, not 1:1 surveyed. Actual near/mid/far independent **in-game aircraft+camera** LOD snapshots not yet present; **mid/far remain unproven at runtime**, regardless of source code.

The source publisher's current [library terms](https://www.innerscene.com/tools/library/terms) explicitly allow CC0 modification and redistribution, and the [item page](https://www.innerscene.com/tools/library/3d-parts/statue-of-liberty-on-its-pedestal-c8a7318f) labels CC0, with original nominal 27.7×27.7×93m. Both disclaim survey/engineering accuracy. `liberty.enabled=false` remains unchanged.

**Status at this handoff write:** source, Cosmos, Blender and liberty exact-head browser workflow passed; separate NYC bridgehead exact-head workflow `#45039416015` was still running. Do not assert 5/5 until it finishes. Draft #272 remains unmerged. Next: exact-head bridgehead result, mid/far actual view+aircraft distances, low Fort Wood sweep / hardware GPU measurements; reconcile #256 onto current #103 only after evidence approval.


## 10. Original downloaded GLB topology and three real tier cameras (2026-11-22)

- The actual candidate binary was downloaded as the original `assets/nyc/scenario/liberty.glb` with GitHub export [run #45040623754](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45040623754), artifact `patrol-liberty-cc0-verified-glb`, and locally SHA-256 rechecked as `34ed58d06e008adcced5e60376bbcc11d675f3d4ec01434016df92d244f33225`. Exact **913,936 bytes**, **22,685** POSITION vertices, **15,900** indexed faces, one primitive/material/texture, one embedded **1024×1024 PNG** atlas (91,160 bytes), source bounds X/Z ±13.85m, Y 0–92.996582m. No generated replacement was substituted.
- A fresh pure-standard-library check of the **original indexed triangle topology** found zero repeated-index triangles, **3,661 connected components** in index space and **22,288 boundary edges** (no edges incident to more than two faces). Many disconnected index components reflect duplicated vertices/UV seams and do NOT by themselves prove visible holes. After coordinate welding at 10⁻⁴ units there were still ~**298** components and **12,762 boundary edges**. The mesh is **not watertight by indexed topology**, so do **not** describe it as a closed solid suitable for exact watertight volume/physical collision.
- Source geometry was independently rescaled by `31.3 / 92.99658203125` and triangle-clipped to every 2-game-unit vertical band. Measured max radial distance in **all 16 bands** was no larger than the built-in source-specific `libertyScenarioBandRadii`, with smallest positive rounding surplus ~**0.000099** game units (plus the code's separate **0.55-unit aircraft collision cushion**). The 16-band conservative proxy is therefore source-backed **for this exact SHA-pinned GLB**. This check does **not** certify sliding collision, shoreline, seaplane waterline or physical sculpture accuracy.
- New independent **test-only** Draft [#292](https://github.com/bhu103-data/patrol-flight-sim/pull/292), head `6523492f8d426fe16b2f4a6935dd41169ddfecef`, based on #272, contains **exactly two new QA files**: `scripts/nyc-liberty-three-tiers-real-browser.mjs` and `.github/workflows/nyc-liberty-three-tiers-real-qa.yml`. Actual original PATROL Manhattan WebGL2 is served unchanged; a **browser-only test response hook** moves the **actual in-game plane object** and existing Liberty Scenic camera to reproducible positions. This is not a pilot-flown route and never modifies production `index.html`, GLB or manifest.
- Expected measured scene: near eye 56 / plane 59 game units → `near-cc0` 15,900 triangles; mid eye 180 / plane 207 → `mid-bundled-glb` 292; far eye 340 / plane 371 → `far-bundled-glb` 292. The actual renderer's plane/eye distance, LOD label/draw tris, camera FOV/pose, WebGL errors, original **three PNGs** and 10-sample mean/P95 SwiftShader `requestAnimationFrame` intervals must all be reported. Distances are **compressed game units, not survey metres**; this is a deterministic pose audit rather than real-world same-camera photography. Mid/far share a single 292-triangle mesh, so there are **two distinct geometries across three labels**, not three mesh resolutions.
- [#292 Actions #45041346294](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45041346294) was queued at this checkpoint, source/regression separate workflow #45041346290 already succeeded. **Do not claim LOD/PNG/mean/P95 success yet.** If QA fails, inspect the actual Actions failure and fix only its QA-only branch. The P0 reality verdict stays RED, even if all three tiers later pass.

**Resume priority:** first examine #292 exact-head CI and 3 screenshot artifacts, then validate independent physical low-altitude ferry/Liberty Island flyby and a hardware GPU profile. Keep #103 → #256 + #272 hash guard as the only conditional merge chain. #292 remains QA-only evidence, not a new source feature. Do NOT merge or enable manifest.


## 11. Final exact-head real LOD and SHA-pinned swept-collision acceptance (2026-11-22)

**Independent QA Draft [#292](https://github.com/bhu103-data/patrol-flight-sim/pull/292) current head:** `7739170618365021b73a26aa5580085bcee15dcb`, based on already-validated #272. **Three of three exact-head workflows SUCCESS**: regression [#45042101685](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45042101685), original PATROL near/mid/far [#45042101565](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45042101565), and source SHA collider [#45042101768](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45042101768). Delta relative to #272 is **four QA-only paths**: two browser scripts and two Action workflows; **zero** changes to `index.html`, `assets/nyc/nyc-realism.js`, manifest, GLB, flight physics or scenery. No merge performed.

**Exact-head three-tier artifact:** [#14761629890](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45042101565/artifacts/14761629890) (three original in-game 1280×720 PNGs + JSON), downloaded and verified. *Actual* in-game Scenic camera/aircraft horizontal distances and renderer-selected budget:

| Tier | Eye/aircraft distance (fictional game units) | Actual selected renderer budget | SwiftShader real-rAF mean / P95, ms (n=10) |
| --- | --- | --- | --- |
| near | 56 / 59 | `near-cc0`, **15,900 tris** | **529.98 / 1599.90** |
| mid | 180 / 207 | `mid-bundled-glb`, **292 tris** | **618.30 / 2066.60** |
| far | 340 / 371 | `far-bundled-glb`, **292 tris** | **314.99 / 850.00** |

All three original PNGs valid, no page/console WebGL errors, real renderer GL error 0, source model `scenario` exactly 15,900 triangles with embedded texture; sample camera FOV **56.34°** in prior original run and no GPS camera alignment. This is proof of **three selection thresholds with only TWO unique mesh budgets**. Software rAF P95 is volatile (prior same-code head #6523492f returned near/mid/far 2166.6/2483.2/1516.5ms); it is **not** hardware GPU time.

**Exact-head authenticated source collider artifact:** [#14761239554](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45042101768/artifacts/14761239554) contains original in-game WebGL PNG and JSON, downloaded and visually inspected. `source=scenario` and 15,900 GLB triangles, committed `liberty.enabled=false`, initial scene load **3260 ms**, no GL errors before or after the test, no page errors. Directly invoked **unchanged game production `checkFlightCollision`** (0.65 game-unit swept substeps) on **12** perimeter corridors, covering heights 5/11/20/29 and radii 8.2/9.1/10.3, all **NO collision**. Overflight at ground + **38** on x = mark±16 recorded **NO collision**. Center body sweep at ground + **20** from mark.x-16 to +16 recorded **`Collision with Statue of Liberty`**. This verifies collision-envelope compatibility with the **exact SHA-pinned source** in the original renderer. It does **not** prove an actual pilot flew the path or all aircraft orientations and speed/floatplane waterline cases.

**Actual visual review remains FAIL for geographic realism:** screenshots show a better-articulated Liberty figure and pedestal, but unrealistic box skyscrapers, synthetic river/ship silhouettes, approximate Liberty Island paving/shoreline and compressed scale (31.3 game units vs source height ~93m). These are not GPS-registered same real-world camera photographs, so no 1:1 NYC release approval. The original GLB is not watertight; radial 16-band conservative collision remains a proxy, not exact triangle-mesh physics.

**Merge decision unchanged:** #103 is the single source/CC0/collider basis; #130 is closed and its collision edits already exist in #103; #253 excluded from second merge but runtime SHA guard preserved in child #272; **only #256 + validated #272 protection** is a conditional future opt-in feature candidate (after reviewing rebase onto current #103). #292 is QA evidence only. No merge, no main writes and **no manifest activation** during this session. Hardware Windows GPU mean/P95 and manually flown low-altitude C185 passage around Fort Wood remain outstanding, as do city-scale landmark/shoreline/water fidelity.

**Next task:** verify source PR heads remain unchanged, then run a real C185 water-start/low-altitude, **player flight dynamics** passage with externally controlled navigation and log aircraft pose plus collision history, on an isolated QA branch only; do not substitute deterministic `checkFlightCollision` test paths for an actual flown route. Obtain native hardware GPU time separately. If unavailable, mark these gates **BLOCKED** rather than infer passing.
