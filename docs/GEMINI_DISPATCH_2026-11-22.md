# Gemini dispatch — PATROL realistic maps

Use the canonical state in [`PATROL_CONTEXT.md`](./PATROL_CONTEXT.md) and the
cross-agent handoff in [`AI_AGENT_HANDOFF_2026-11-22.md`](./AI_AGENT_HANDOFF_2026-11-22.md).
The asset table supplied on 2026-11-22 is research input, not verified project
state. Every agent must re-open the primary source and quote the exact licence
or data-use clause before recommending repository inclusion.

## 1. NYC asset and licence audit

Re-check the proposed NYC Open Data, Overture, Poly Haven, NPS, Sketchfab and
NYC Ferry sources. Produce a pass/fail table with direct source URL, exact
licence, modification and redistribution rights, attribution text, download
format, measured file size and measured mesh/texture budget. Reject assets that
require login but cannot be downloaded in the current session, have unclear
licensing, or conflict with project redistribution. Do not claim integration.

## 2. Lower Manhattan and DUMBO geometry

Verify dataset identifiers, field names, units, bounding-box order and CRS for
Lower Manhattan and DUMBO. Propose one deterministic conversion path to the
project's metre-scale right-handed Y-up coordinates. Include winding, normals,
roof triangulation, building-part handling, LOD, draw-call and collision rules.
Flag every unverified assumption. Output an implementation checklist only.

## 3. Liberty and ferry model review

Compare current repository assets and PR candidates with authoritative physical
dimensions. For the Statue of Liberty, verify crown, torch, drapery, statue and
pedestal proportions plus attribution requirements. For the ferry, verify hull,
waterline, cabin windows, deck and railings, then propose a legal lightweight
GLB/LOD path. Do not invent triangle counts or claim Blender work was run.

## 4. Water and PR conflict review

Review PR #151 against PR #104 and the current production shader paths. Define
the minimum reversible fix and an A/B matrix for sun-facing and opposite-facing
views at 0.5–1.5°, 4° and 15° solar elevation. Separate static code review from
GPU evidence. Keep PR #151 draft unless the required evidence exists.

## 5. Central QA synthesis

Deduplicate the four outputs. Produce a merge/defer/reject matrix tied to exact
files and PRs. Acceptance requires in-game near/far screenshots, first-load and
frame-time evidence, map-switch and flight-control regression, licence records,
and no replacement of existing controls or collision without evidence.
