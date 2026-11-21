# Chongqing free asset candidates

Checked 2026-11-20 against the providers' public license pages. This catalog is deliberately split into **landmark geometry**, **replaceable materials**, and **generic street furniture**.

## Landmark geometry

Hongyadong, Qiansimen Bridge, Raffles City/The Crystal, and Liziba remain original procedural PATROL geometry. No generic Western building model is substituted for a Chongqing landmark. The existing reversible Hongyadong GLB loader remains disabled until a same-origin file passes the existing manifest, license, transform, triangle-budget, and visual checks.

## Replaceable materials

| Candidate | Provider / creator | License | Link | PATROL status |
|---|---|---|---|---|
| Concrete Wall 008 | Poly Haven contributors | CC0 | [asset](https://polyhaven.com/a/concrete_wall_008) · [license](https://polyhaven.com/license) | Bundled and already used by the PBR adapter |
| Concrete 014 | ambientCG contributors | CC0 1.0 | [asset](https://ambientcg.com/view?id=Concrete014) · [license](https://docs.ambientcg.com/license/) | Candidate only; procedural fallback remains active |

Poly Haven states that its HDRIs, textures, and models are CC0 and redistributable. ambientCG states that downloadable assets are CC0 1.0 and may be included in a game. No paid account or cloud generation is used here.

## Generic street furniture

| Candidate | Creator | Source size / geometry | License | Decision |
|---|---|---:|---|---|
| Street Lamp 01 | Josh Dean / Poly Haven | 31.41 MB / 31K tris | CC0 | Downloadable candidate; review-only because the active corridor already uses instanced lamps |
| Street Lamp 02 | Josh Dean / Poly Haven | 26.6 MB / 20K tris | CC0 | Downloadable candidate; review-only wall-light study |

Sources: [Street Lamp 01](https://polyhaven.com/a/street_lamp_01), [Street Lamp 02](https://polyhaven.com/a/street_lamp_02), [Poly Haven license](https://polyhaven.com/license).

The source meshes are not silently loaded into the game: their sizes and triangle counts would be wasteful for a repeated corridor. The existing low/high-quality instanced street-light implementation is retained for performance, collision, and rollback. A future import must be same-origin, retain the procedural fallback, and pass a fixed-camera WebGL comparison.

## Verification

- Catalog: `assets/chongqing/free-assets.js`
- License and separation tests: `node --test tests/chongqing-free-assets.test.mjs`
- Existing visual/regression suites remain unchanged and are run alongside this catalog test.
- Scenario for Blender is not called; no paid generation, account, token, or cloud asset is involved.
