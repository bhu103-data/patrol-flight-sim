# NYC Central Park Lake — Loeb Boathouse settee (isolated draft)

## Implementation
- Changes only `assets/nyc/central-park-amenities.js`, plus a focused test and this document, on top of the known `6d50bfd` integration baseline.
- One **original PATROL-authored** park settee, five separate weathered wood seat slats and two wood back slats, open iron support frames, shaped arm rests, four individual ground-sampled feet and six bolt-head accents. Its design refers to a generic Central Park settee silhouette; it is not a survey, scan, or licensed replica of a specific physical bench.
- Game coordinates `u=9,z=163` transform to `world x=78.12,z=163` under the current Manhattan grid. This is an approximate Lake east-side test placement near Loeb Boathouse, not a GIS coordinate.
- All four footprint corners must clear the existing Lake shore equation by normalized `>1.19` before the model is drawn. High quality receives one new settee; low quality remains on its preexisting simple benches. No collision bodies, new shaders, materials, textures, extra draw calls, loading requests, changes to aircraft/traffic, or non-NYC map code.
- Existing NYC mesh batching and park-module upload is reused; appearance should be visually checked on real browser hardware rather than described as photorealistic.

## License and overlap
- No third-party asset was downloaded, copied, baked, or linked into production. The authored mesh is made entirely with existing in-repository geometry callbacks. Existing project licensing governs this original contribution.
- [PR #98](https://github.com/bhu103-data/patrol-flight-sim/pull/98) remains a **separate CC0 source/LOD audit only**, not a runtime model import. This implementation deliberately does not import tevy's compressed GLB, Meshopt, BasisU, KTX2, or other outside resources.
- Does not touch current open PRs for Brooklyn/Manhattan roads, OTI facades, Liberty, harbor, C185, Chongqing, Alaska, or Vegas.

## Budget / validation
- Incremental high-detail primitive calls (expected): 17 small boxes (7 timber slats, 4 feet, 6 bolt heads) and 12 short thin beams. No new GPU buffers or draw calls independent of the park batch.
- Dry placement and supports are deterministic functions of existing synthetic terrain; dynamically recomputed at world-building time, not per-frame.
- Run `node --test tests/nyc-central-park-lakeshore-settee.test.mjs tests/central-park-amenities.test.mjs tests/central-park.test.mjs` and normal PATROL Node CI.
- Browser acceptance: run the NYC map and the existing Scenic Views > **Central Park · Loeb Boathouse**, fix daylight/clear and 1280×720 camera, capture identical view for baseline `6d50bfd` and this PR branch. Also inspect a near-ground viewpoint `x=78.12,z=163` and the Lake shoreline; verify slat gaps and timber/iron silhouette, no submerged or hovering supports, no overlap with trails/boats, and low-quality fallback. Record actual screenshot and frame sampling if run. A static unit test is **not** screenshot or native GPU validation.

## Merge gate
Hold as a draft until same-camera WebGL evidence and parent integration compatibility are reviewed. Do not alter `main` or the shared integration branch directly.
