# PATROL NYC 1:1 — source-FID material replacement foundation (Draft)

## What changed in executable code
The launcher-accessible **NYC TRUE-SCALE** Times Square scene now accepts
`?materials=preview`. This explicitly opt-in route fetches
`assets/nyc/nyc-material-slots.json`, validates it in
`nyc-metric-material-slots.mjs`, applies wall material shader ID **3, 4
or 5 per original municipal building FID** in
`nyc-true-scale-neighborhood.mjs`, and uses project-authored light
procedural brick, curtain-glass or stone shader variations. No image files
or third-party textures are downloaded. Scale of invented surface pattern
is in **1 world unit = 1 metre**.

The default URL / `?roadbed=off` / `?roadbed=only` logic does **not**
load this catalog or change materials. `?quality=low` still suppresses
authored window panels without removing the underlying building source
polygons. Material preview does **not** change the count, coordinates,
normals, roofs, street paths, 2022 OTI polygons, or building collision.
Original Manhattan aircraft physics, C185 and all other maps are untouched.

## Accuracy boundaries
- Real: NYC municipal BUILDING source FIDs / HEIGHTROOF / outlines
  (already present in the 118-building 1:1 reference), source position,
  2022 OTI core road shapes and real NYC DCM line positions.
- **Not real**: brick/glass/stone selection by height or individual FID,
  color, simulated mortar scale, facade grids, real glass composition,
  measured windows/entrances, ground elevations, or complete 2026 streets.
  Even the 1515 Broadway FID override is **ART DIRECTION**, not an
  as-built material record or vetted PBR photo.
- No photogrammetry, no authentic PBR albedo/normal/ORM maps, no 6DoF
  photograph comparison, and no native GPU performance acceptance.
  Original project-authored procedural math does not imply scanned reality.

## Strict material asset replacement contract
Until a real asset has **individually verified** rights and provenance,
keep its `externalTextures: null`. A future material import must separately
supply, and pass explicit review of:

1. Original source URL, publisher/creator, provenance capture date, exact
   license text/version, redistributable status, attribution and any
   model releases or usage restrictions. Public visibility alone is **not**
   permission to ship copyright photos, Maps captures or 3D tiles.
2. Spatial identity: building FID, street elevation, face heading, survey
   photo source/time, camera alignment/FOV, facade dimensions, real
   window/door positions and any edited geometry.
3. PBR channels: albedo in sRGB, linear normals/roughness/metallic/AO,
   consistent metres-per-tile, lawful seams and tangent space; no generic
   photo projected onto an incorrect wall.
4. Optimized WebGL2 packaged assets, per-LOD texture & draw-call budget,
   color/roughness A/B at same daylight/wet/night street camera; device-GPU
   P50/P95 frame times, not GitHub CI SwiftShader cadence.
5. Source-fidelity labels: **measured geometry**, **source-matched material**
   and **artist-generated substitute** are distinct acceptance states.
   Missing evidence must be displayed as missing, not guessed.

Current material manifest schema `patrol-nyc-fid-material-slots-v1`
intentionally **rejects non-null external texture paths**, and future
rights-vetted imports require an explicit schema/loader upgrade and QA
rather than silently loading arbitrary hosted imagery.

## Reproduce / evidence
From repository root in the Draft child of #282:

```sh
node --test tests/nyc-true-scale-flythrough.test.mjs tests/nyc-metric-material-slots.test.mjs
python3 -m http.server 8765 --bind 127.0.0.1
# Existing program (no new materials):
# http://127.0.0.1:8765/assets/nyc/nyc-true-scale-flight.html
# Only vetted-source ROADBED polygons, no invented DCM asphalt:
# http://127.0.0.1:8765/assets/nyc/nyc-true-scale-flight.html?roadbed=only
# Original procedural FID material prototype (source geometry identical):
# http://127.0.0.1:8765/assets/nyc/nyc-true-scale-flight.html?materials=preview
```

Dedicated `nyc-true-scale-flight.yml` now checks the source geometry,
material slots, negative rights test, optional WebGL2 shader and a real
fixed aerial before/after PNG. **Do not merge until exact-head Actions
pass and inspect the original artifact screenshots**. This feature is
a material replacement *foundation*, not finished realistic Manhattan.

Base: #282 Draft; parent #273 measured 2022 roadway core; ancestor #248
optional 1:1 Times Square flight launcher. Keep each parent Draft,
and do not touch `main` or #211.
