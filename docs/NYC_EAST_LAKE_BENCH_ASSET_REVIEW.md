# PATROL NYC · The Lake east-shore bench, source-grounded near-view asset sample

**Scope:** one proposed park furnishing near the Loeb Boathouse / Lake eastern shoreline. **Base:** `codex/patrol-integration-20261121` @ `6d50bfda4b2d3837e550751ede49b200b140bc72`. Independent review branch only. No `index.html`, geometry loader, map collision, water physics, vehicle road, central park building, or main/integration write.

## Avoid duplicate work
- Read current open PRs before this review. PR #86 covers NYC **landmark GLB** source rights and rejects heavy Statue of Liberty; do not duplicate. PR #88 is DUMBO bridgehead traffic, #81/#82/#84 DUMBO asphalt, #83 Manhattan facade. None owns this small Central Park seating-source candidate.
- `assets/nyc/central-park-amenities.js` has procedural benches in a regular edge-only sequence (park-local `u=+31` or `-31`, `z=68..342`). No purpose-made lake east-bank bench appears near this chosen `u=9,z=163`. The park already includes Bow Bridge, the Lake, Loeb Boathouse, many water-safe paths, and rowboats; do **not** rebuild these.

## Real park identity and limitations
- The [Central Park Conservancy](https://www.centralparknyc.org/articles/central-park-benches) describes the *Central Park settee* as an old **cast-iron frame with wooden slats**, typically **five on seat + two on back**, with the park's deep green finish. These are location-specific visual references, **not redistributable original CAD**.
- The suggested vendor bench is a generic public-domain **cast-iron-and-wood** design, **not a surveyed or manufacturer-certified reproduction of the park's specific seven-slat settee**. The tevy page describes five seat slats and **three back slats**. If future work selectively removes one back slat and repaints green, document that original change rather than claim off-the-shelf precision.
- The PATROL park is a *compressed invented game coordinate system*, not GPS-accurate. Sample positioning is an intentional near-view experiment, not a claim that this exact bench physically exists at that spot in New York.

## Publisher-owned source candidates
| Asset | Original source / author | Explicit adaptation and public GitHub redistribution rights | Publisher-listed footprint | LOD and geometry | Status |
| --- | --- | --- | --- | --- | --- |
| **Park Bench v1** (preferred) | [tevy](https://tevy.dev/models/park-bench), original credited to **tevy (publisher)**; no individual artist named | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) per pinned version model page **and** official `models.json`; no mandatory attribution | Publisher description 1.8 m length, 0.45 m seat height; catalog `dimensions` are in metres and Y-up | Three individually pinned **LOD0 3,512 tris / 933 KB**, **LOD1 1,880 tris / 294 KB**, **LOD2 728 tris / 91 KB**; exact SHA256/GLB size/texture confirmed or rejected by workflow | **Read-only sample**, LOD1 preferred for 1 park bench, LOD2 for low quality |
| Timber slats on cast legs | [Innerscene original](https://www.innerscene.com/tools/library/3d-parts/park-bench-timber-slats-on-cast-legs-e4bff625) (publisher Innerscene; individual artist not named) | Publisher states original **CC0**; may alter, distribute and use in commercial games | **1.800 × 0.585 × 0.840 m**; listed GLB **108 KB** | LOD unspecified; actual triangles, embedded textures, SHA, bounds measured by workflow | **Fallback only**, no inference of photographic real-world similarity |
| Grab3D Park Bench | [Grab3D publisher](https://grab3d.com/models/city/park-bench/) | CC0 (publisher claim), no required attribution | 1.80 × 0.70 × 0.88 m | 8,656 triangles / 942 KB / 2K textures, explicitly labeled lightweight *stylized* by publisher | **Screened out before extra source audit**: high triangle cost relative to tevy LOD1; not a higher-fidelity NYC-specific model |

**Important:** The source archives have no presumed proprietary New York bench manufacturer’s CAD, logos, plaques or advertisement textures. CC0 provenance is from the named original publisher, not an independent legal proof of every texture author. If source and embedded texture provenance differ, stop.

### Official immutable GLB files
- `https://tevy.dev/models/park-bench/v1/lod0.glb`
- `https://tevy.dev/models/park-bench/v1/lod1.glb`
- `https://tevy.dev/models/park-bench/v1/lod2.glb`
- `https://www.innerscene.com/api/library/park-bench-timber-slats-on-cast-legs-e4bff625/download`

Official tevy index: `https://tevy.dev/models.json`. The workflow refuses a mismatch between actual downloaded **SHA-256, byte length, and triangle count** and the vendor's pinned version metadata; any unsupported extension or unrealistic dimension also fails. It includes the alternative Innerscene geometry inspection and exact texture/primitive reports.

**Do not infer photo realism from GLB metadata alone.** Colors/wood roughness, normal maps and shading need A/B rendering before release. Innerscene's 108 KB file may contain only flat materials; this is not an automatic advantage.

## Proposed one-bench location (NOT currently rendered)
- **PATROL local:** `u=9, z=163`. **PATROL world:** `x=30+0.24*163+9 = 78.12, z=163`. Y should be sampled from `sampleTerrainHeight(x,z)`, not guessed. Bench back on lawn side, facing the Lake.
- Lake shoreline: verify against real code `PARK_WATERS`, `normalizedWaterDistance(u,z,feature)`; require every lake distance **greater than 1.20** at the proposed center and avoid painted shoreline paths. This is a *candidate* placement with no site collision or physical survey.
- Loeb Boathouse existing center is `u=18,z=157`, building ~`9.1×5.8` in PATROL game-space. The proposed bench center is **9 units aside, 6 units longitudinally**; do not add a collider. The nearest existing **procedural** bench is more than 15 game-space units away (source check in asset audit).
- Keep one center-mounted bench only. No continuous fence segments, walkway redrawing, touching terrain, or multiple instances before seeing a verified camera frame.

## Fixed-view centralized WebGL QA hand-off
1. **Existing built-in view**: `Central Park · Loeb Boathouse` from `index.html`: `x=85.68,z=157,height=3,bearing=175,radius=17,rise=6.8`. Capture full daylight before/after with same perspective, same selected map, same FOV/time and same quality tier. Bench target world XZ = `(78.12,163)`.
2. **Near pedestrian view**: fixed `x=78.12,z=163` target, camera **at terrain height +1.6m** on path, aimed at one bench from 4-7m. Keep water and Boathouse in context, without walking through geometry.
3. **Second context view**: existing built-in `Central Park · Bow Bridge`, `x=52.24,z=151,height=2,bearing=225,radius=21,rise=6.4`. This checks broad scene continuity; the bench itself may be outside the frame and must not be counted visible unless shown.
4. Report real WebGL2 pixels, source fetch success, draw calls, triangles/texture upload cost and software **vs real GPU** timing separately; ensure low-quality mode LOD2/procedural fallback. Recheck zero water/terrain/path intersection in both presets, no unexpected collision/mission changes.

## Hard budgets and acceptance
- High view: aim for **≤350 KB** original LOD1, **≤2,500 tris** per bench and no external URLs at game runtime.
- Low view: aim for **≤120 KB** LOD2 and **≤900 tris**; if budget exceeded, keep the existing geometric bench.
- No missing PBR images/unsupported GLTF extensions. One short-lived source inspection artifact, no uncontrolled online preview dependency or repeated park furniture.
- Confirm color/slat count/material realism in screenshot. **Do not call this a one-to-one Central Park settee without adapting the correct seat/back count and validating the shape.**
- Full real-device browser/fps/physics regression remains with **centralized QA**, not this asset sourcing branch.

## Reversibility
This branch changes only **audit/script/workflow/docs**. The GLBs remain downloadable by pinned URLs or attached as temporary **GitHub Actions artifacts** after source integrity passes; they are **not checked into** runtime `assets/nyc` and no active game loads them. Deleting this Draft PR's three review files leaves the base byte-for-byte unchanged.

Source audit: `node tools/nyc/audit-east-lake-park-bench.mjs` (runs in workflow after downloading pinned GLBs). Only minimal syntax and geometry/site checks are within this PR; do not repeat the integration owner's 442-node full regression suite.
