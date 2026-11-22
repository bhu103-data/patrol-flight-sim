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
