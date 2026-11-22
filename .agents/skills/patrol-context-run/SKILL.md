---
name: patrol-context-run
description: Resume PATROL work from docs/PATROL_CONTEXT.md, verify exact repo state, update the same file at the end.
---
# PATROL context-run

1. Read `docs/PATROL_CONTEXT.md` before reading old chat history or changing code. The file is a concise handoff, **not a substitute for live GitHub evidence**.
2. Check current `main`, listed branches/PRs, conflicts, source licenses and any exact-head CI runs. Do not overwrite main, unrelated city code or another PR.
3. Work only on the scope of the current user request. If a handoff detail is stale, update it with verified evidence; do not invent results.
4. Require actual PATROL flight-map browser screenshots and measured geometry/texture/frame/performance/flight/cross-map regression for visual patches. Distinguish SwiftShader rAF and native GPU timings; distinguish source photographic reference from registered camera alignment.
5. At end compress **what changed, commit/PR, evidence status, failures, next exact command/action, and blocked assumptions** back to `docs/PATROL_CONTEXT.md` on the same branch.
6. Use public/legal source data only; preserve source IDs/versions/terms and do not import or screenshot proprietary map tiles.
