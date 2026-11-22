# NYC Liberty: opt-in actual CC0 sculptural geometry in live PATROL

## Scope / branch ownership

This is a **child Draft of #103**, which already owns the verified source
mesh, collision profile and original-publisher license audit. **Do not copy
the GLB to a second branch or merge this child independently of #103.**
PR #103's stored exact binary is reused in this stack. The new change is
limited to native PATROL live render selection; normal default city and all
other maps stay unchanged.

To view the feature on the staged branch (serve from a localhost HTTP origin):

\`\`\`sh
python3 -m http.server 8765
# open http://127.0.0.1:8765/index.html?nycModels=libertyCC0
# choose Manhattan and start existing flight, then choose Statue of Liberty scenic view
# compare: http://127.0.0.1:8765/index.html?nycModels=normal
# original procedural rollback: ?nycModels=legacy
\`\`\`

## Authenticated source & legal rights

* Innerscene 3D Parts Library, **Statue of Liberty on its pedestal**:
  https://www.innerscene.com/tools/library/3d-parts/statue-of-liberty-on-its-pedestal-c8a7318f
* Publisher library terms, **CC0 1.0**, explicitly permit modifications and
  redistribution: https://www.innerscene.com/tools/library/terms
* Original is a manually authored GLB, **NOT** a georeferenced
  photogrammetry scan, current real-world survey or certified replica.
* Parent #103's Blender CPU decimation + UV baked atlas is reused *unchanged*:
  SHA-256 \`34ed58d06e008adcced5e60376bbcc11d675f3d4ec01434016df92d244f33225\`;
  exactly **15,900 triangles**, embedded single Base Color atlas,
  source height ~93 m before the legacy game transform.
* Runtime still displays it at **31.3 fictional game units** at the existing
  Liberty Island scenic coordinates; this is **not** NYC 1:1 WGS84. The model
  replaces a low-detail existing visual, not the terrain, island outline,
  Fort Wood earthworks, ferry routes or any water surface.

## Runtime control and safety

* Only the explicit \`?nycModels=libertyCC0\` option can override a disabled
  manifest entry, and only for \`kind=liberty\`, file
  \`scenario/liberty.glb\`, target height \`31.3\`.
* Browser WebCrypto SHA-256 validates actual GLB bytes **before decoding**;
  requires secure context (https or localhost). The actual decoded geometry
  must have the exact measured 15,900 triangles and collision-compatible
  width/depth/height; otherwise dispose the rejected candidate buffers and
  retain the previously loaded bundled/fallback model.
* Existing source-derived height-band radial collider from parent #103 stays
  automatically active **only** if actual candidate rendered; legacy and
  other map physics do not change. No scene mesh or material changes for
  Alaska, Las Vegas, Chongqing, ship models or C185 flotation.
* Neither \`scenario-manifest.json\` nor the default Manhattan map is
  enabled/changed. A new opt-in URL is not interpreted as a blanket
  geospatial-accuracy claim.

## Browser acceptance

Dedicated workflow \`nyc-liberty-runtime-optin.yml\`:
1. SHA-256 of the actual committed candidate, checked GLB triangle/atlas
   constraints and parent measured collider test.
2. Real PATROL launcher with *seaplane* selected, then actual Manhattan
   camera using fixed noon-clear settings; normal bundled Liberty vs CC0
   candidate use the same view, and the close harbor camera is injected only
   into the test browser response.
3. Screen-only canvas PNGs (not video or offline animations). The exact live
   loader must return \`source=scenario\` and 15,900 triangles, measured
   dimensions and WebGL error 0, not just an HTTP 200.
4. Pixel comparison restricted to Statue-centred view; near-camera test also
   samples the pedestal and surrounding Fort Wood. Print frame-time p50/p95
   from **SwiftShader only**, not native GPU claims.

**Merge gate:** exact-head CI pass, visually inspect harbor front and low
pedestal for overlap, confirm licensed source attribution in repository
notices on integration, native GPU frame pacing and flight/water/map regression
before merge. If these are absent, keep Draft. This single model is not a
solution to Manhattan roofs/roadbeds, Brooklyn bridgehead, ship design, ferry
route, shoreline georeferencing or the project's overall NYC realism P0.
