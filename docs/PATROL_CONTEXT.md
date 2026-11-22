# PATROL_CONTEXT.md — unified implementation handoff (NYC harbor ferry checkpoint)

**Created 2026-11-22 from inspected repository sources.** The requested original
\`docs/PATROL_CONTEXT.md\` and \`$patrol-context-run\` skill were **not present**
on inspected \`main\`, \`codex/patrol-integration-20261121\`, recent NYC branches,
the attached Project search, or the installed plugin skill catalog at the start
of this task. This file is an explicitly reconstructed, source-backed handoff,
**not a verbatim recovery of a missing file**. Do not cite it as older project policy.

## Repo and isolation
- Repository: https://github.com/bhu103-data/patrol-flight-sim
- Active task: **NYC harbor ferry / ship visuals ONLY**, on isolated draft
  [PR #258](https://github.com/bhu103-data/patrol-flight-sim/pull/258),
  branch \`codex/nyc-harbor-ferry-cc0-lod-20261122\`, from current \`main\`.
- Source of earlier handoff rules: \`docs/ACTIVE_FLIGHT_SIM_HANDOFF.md\` (last
  detailed checkpoint on 2026-11-20), plus \`docs/NYC_RECONSTRUCTION_GUIDE.md\`.
- Never overwrite \`main\`, other branches, New York terrain or harbor piers,
  Alaska/Chongqing/Vegas/Cosmos, aircraft/collision, map switching or
  \`index.html\` wholesale. Use expected blob SHA file updates and PRs.
- Do not scrape Google 3D imagery or unlicensed Sketchfab display models.
- Do not call a constructed/procedural or generic CC0 model a real NYC
  measurement or photogrammetry.

## Verified current NYC ship production baseline
- \`index.html\` defines \`SHIP_TYPES\`:
  \`cruise\` halfLength 23 / halfWidth 4.8 / top 13;
  \`ferry\` halfLength 13 / halfWidth 3.3 / top 7.5;
  \`cargo\` halfLength 18 / halfWidth 4.1 / top 9 (game units).
- \`buildShipMesh(kind)\` makes original hulls, ferry cabin/decks/railings,
  cargo containers and cruise superstructure using scene triangle primitives.
  \`tools/nyc/audit_existing_ships.mjs\` instruments this production source to
  count triangles and stores \`nyc-harbor-audit/procedural-ship-inventory.json\`.
- \`prepareCoastalTraffic()\` retains up to four closed-loop, coastline-checked
  actors (\`cruise,ferry,cargo,ferry\`), with a 96-segment pace table. Routes are
  selected from height-field samples and avoid Brooklyn Bridge and shoreline.
- \`drawCoastalTraffic()\` renders visual mesh and water wake. Ship collisions
  are separate in \`vehicleAt()\` and \`usableFloatWater()\`, including the
  C185 floatplane swept-wing test and 25-point pontoon footprint.
- Wrecks intentionally use original \`splitShipMeshes\`; imported visual LOD
  must never replace physics or wreck handling.
- Targeted regressions already exist: \`tests/floatplane-ship-clearance.test.mjs\`,
  \`tests/nyc-floatplane-dock.test.mjs\`, and harbor/bridgehead WebGL2 workflows.

## Open-licensed 3D source candidates, with evidence
1. **Primary pilot: tevy Car Ferry** (publisher: tevy, original model page:
   https://tevy.dev/models/car-ferry; page labels CC0 1.0,
   https://creativecommons.org/publicdomain/zero/1.0/legalcode).
   - Original pinned version 2026-10-27:
     \`https://tevy.dev/models/car-ferry/v1/lod0.glb\`,
     \`.../v1/lod1.glb\`, \`.../v1/lod2.glb\`.
   - Real source bytes / SHA-256 / triangles:
     LOD0 2,975,148 / \`c6afaae8bb66da747e3059d5dc17df56a221a94e6a13c8e9a199ddeb9154e0d5\` / 52,069;
     LOD1 1,106,608 / \`1013a80e4fc662e46ebbfe78bf1771f41a0fef6a46655a83705d746b123ab2b5\` / 19,775;
     LOD2 233,108 / \`619acc4a52c9405c521fc6ea5443f186231fe9fe6dc0d2f6e5d3735a98217db2\` / 5,478.
   - Original requires Meshopt, quantization and BasisU/KTX2, so PATROL's
     current custom decoder **cannot** load the original compressed files.
   - Official KTX-Software 4.4.2, SHA-256-pinned download, plus glTF Transform
     actually decoded Meshopt, restored Float32 vertices, converted KTX2
     images to PNG and resized 2K/1K/512. Verified WebGL2-ready outputs:
     LOD0 5,936,236 bytes, SHA \`143815ec7d9830970f6d568ba5ec4495d8c422b2be8e2465fc4274819fc58288\`;
     LOD1 2,176,996, SHA \`c30c18eb05f3ba2f8479bc782794b8fd7115ae6aefd2e1ac9cd244cdeb1baa91\`;
     LOD2 505,076, SHA \`7b14324877e0da022a3e3cbf27bc00206bfbc7a693b7ee3d35d85a528cfaea1b\`.
   - All three outputs have one embedded Base Color texture, no required
     extensions, and each is under 8 MiB. 3, 3 and 2 total images; other
     normal/rough maps are NOT directly used by the game renderer.
   - CC0 permits modification/commercial/redistribution, no mandatory credit;
     keep origin, version and modifications as provenance. This is a generic
     **92 m roll-on/roll-off car ferry**, not an exact NYC Ferry vessel.
2. **Kenney Watercraft Kit** https://kenney.nl/assets/watercraft-kit
   publisher Kenney, CC0 (publisher archive contains License.txt). Original
   source ZIP 1,870,991 bytes; \`ship-cargo-c.glb\` 31,600 bytes / 362 tris /
   512² external color atlas; \`ship-ocean-liner.glb\` 228,268 bytes /
   2,796 tris. Legal fallback geometry, but visibly stylized, not a substitute
   for measured harbor ferries.
3. **Innerscene small passenger ferry, 25m**:
   https://www.innerscene.com/tools/library/3d-parts/small-passenger-ferry-25-m-bb6ba356
   describes an original CC0 GLB ~8.7 MB and real-scale 25.09×7.57×8.16 m.
   Its exact binary triangles, textures, SHA and PATROL compatibility are
   **not yet independently downloaded/tested**, so DO NOT import.
4. **Sketchfab models with unclear asset-level modification and redistribution
   grants are excluded**, even when viewable or downloadable.

## Current isolated pilot implementation
- Source audit \`tools/nyc/audit_cc0_ferry_lods.py\`; build
  \`tools/nyc/build_cc0_ferry_lods.sh\`; validator
  \`tools/nyc/validate_cc0_ferry_staged.py\`; Khronos tool pin
  \`tools/nyc/install_ktx.sh\`.
- Renderer-specific loader \`assets/nyc/nyc-harbor-ferry-lods.js\` only
  uses SHA-pinned, **same-origin** staged GLBs in \`assets/nyc/harbor/\`.
  Lazy far→mid→near loading: 5,478→19,775→52,069 tris. A failed fetch,
  hash mismatch, decode failure, incompat mode or missing asset falls back
  to existing procedural ferry mesh.
- Activation strictly \`?nycHarborVessels=cc0-ferry-preview\`, NYC map only,
  smooth noncompat; never activates on default path, Alaska or other maps.
  Model scaling targets 7.5 game units high; visual dimensions must remain
  within the original ferry hull bounding contract. Only ferry kind changes,
  not cargo or cruise (those retain procedural visuals).
- Stage CI is restricted to PR #258 branch, internally owned same-repo head,
  and only creates verified \`assets/nyc/harbor\` objects after passing source
  and output SHA / texture / polygon checks. Never auto-merge.

## QA / release gates
- Real source download/format: GitHub Actions #45038185349 (success).
- WebGL2-ready decode, texture limits: #45038622301 (success).
- Pending/required before merge: direct production GLB parser WebGL2 loading
  (look for \`[PATROL NYC ferry LOD]\` console events), actual same-camera
  ferry screenshots at near/mid/far; C185 water contact, ship hits and wakes;
  NYC↔Alaska↔Chongqing↔Vegas map transitions; low/compat graphics; CSS/UI
  independent capture; FPS and asset first-load budget on at least one
  hardware WebGL2 environment. SwiftShader browser FPS is **not GPU FPS**.
- Treat CI artifacts and their run/commit as evidence; never claim a pass
  before inspecting run logs or screenshots.
- Source-Licence note: publisher CC0 dedication is recorded. A generic
  ro-ro is not automatically a license to reproduce NYC Ferry branding,
  trademarks or photographs.

## Next task after this checkpoint
Check asset stage job result, re-run broad Node + targeted ferry tests on
the exact PR head. Execute real Chromium WebGL2 near/mid/far A/B and
cross-map low-graphics QA. If missing GLBs, wrong faces, fallback unexpectedly
activated, ship/water collision changes or browser visual defects occur,
keep #258 Draft and fix on this isolated branch only.
