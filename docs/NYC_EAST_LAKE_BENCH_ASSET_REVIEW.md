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


## Actual source audit — **PASSED** (2026-11-21)
[Read-only workflow #44922819943](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/44922819943) downloaded source GLBs from both official publishers. Parser decoded the **actual Meshopt-compressed vertices and triangle indices** on tevy and validated their world-space dimensions; it cross-checked original file byte lengths, SHA-256 and triangles against immutable publisher `models.json` version 1. All source artifacts were **temporarily staged in GitHub Actions only**.

| Publisher / LOD | GLB bytes | Actual triangles | World-space W × H × D | Embedded textures / materials | SHA-256 |
|---|---:|---:|---|---|---|
| tevy LOD0 | **955,736** | **3,512** | **1.800 × 0.9182 × 0.6843 m** | **3 KTX2**, 921,286 texture bytes; **1 PBR material** | `9525b92636291def968243fb78f9d13ae18597b4835006c6d0b7056591e49787` |
| **tevy LOD1 (preferred review)** | **300,552** | **1,880** | **1.800 × 0.9160 × 0.6843 m** | **3 KTX2**, 278,202 texture bytes; **1 PBR material** | `f2003970d7ff91e969b9c56689c543a1f8a4716fb24464e96753a32fc396fb8f` |
| tevy LOD2 | **92,956** | **728** | **1.800 × 0.9182 × 0.6700 m** | **3 KTX2**, 80,548 texture bytes; **1 PBR material** | `0b949f38ee02166fda12acf6438e8f6dc344a0d8b04aa1df85acc2766c0ef694` |
| **Innerscene original** (uncompressed fallback) | **111,032** | **944** | **1.800 × 0.8400 × 0.5850 m** | **2 PNG 2048×2048**, 73,671 texture bytes; **2 simple materials** | `4d2bc2cc792a8a164b7f9357fd63c73f0d263cbfc0b5a36505209fd5232aa58e` |

**Actual texture dimensions:** tevy LOD1 KTX2 has **1024×512, 1024×512, 512×256** images; LOD2 has **512×256, 512×256, 256×128**. KTX2 is encoded using Basis Universal. tevy PBR material uses **Base Color, Metallic-Roughness and Normal** texture channels. Innerscene's fallback uses **only Base Color** and no normal or roughness maps. Two 2048×2048 RGBA PNG textures could occupy roughly 32 MiB of uncompressed GPU memory before mipmaps despite a 111 KB download.

**Critical integration blocker (do not change loader in this PR):** all three tevy GLBs require `EXT_meshopt_compression`, `KHR_mesh_quantization` and `KHR_texture_basisu` **with KTX2/Basis transcoding**. PATROL's custom game geometry loader does **not** support these as copy-over. This source audit used `meshoptimizer@1.3.0` (MIT) only on the short-lived CI runner; no new dependency is shipped in the game. A later approved runtime sample would need **offline conversion to ordinary baked/uncompressed, supported GLB materials**, or an explicitly authorized separate loader PR. This branch chooses neither.

**Spatial gate verified by executing the actual `central-park.js` shoreline definitions:** proposed local center `u=9,z=163` has The Lake normalized distance **1.2837** (required >1.20), avoids the Loeb model center/footprint, and is **23.33 game units** from the nearest existing procedural park bench. This proves a *candidate center* is not in water/at an existing seat; it does **not** prove full bench footprint clearance or exact photographic appearance. Test center and corners in centralized QA before any render enablement.

**Verdict:** Stage **tevy LOD1 + LOD2** plus **Innerscene fallback** in the auditable source ZIP. Source rights, measured counts, sizes and uncompressed vertex coordinates are **verified**; photorealistic visuals, game placement, GPU footprint and PATROL integration are **not verified**. The permanent integration baseline remains untouched. A lower-quality direct-PNG fallback is technically simpler but visually less detailed; do not enable either by default.
