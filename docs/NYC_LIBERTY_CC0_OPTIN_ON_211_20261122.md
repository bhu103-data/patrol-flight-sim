# NYC Statue of Liberty — direct CC0 model import on the current NYC candidate

## Branch and scope

This is an isolated Draft child of PR #211, based on `f3645c90b79ce2bccd02731a378b7afbe18c7a7f`.
It ports the already reviewed CC0 Statue of Liberty mesh into the current
main-preserving NYC candidate. It does not change `main`, PR #211's branch,
the shared integration branch, or any other map.

This is a single landmark import proving the direct-model pipeline. It does
**not** solve the remaining Manhattan/DUMBO/Times Square building replacement.

## Source and license

- Original publisher model: [Statue of Liberty on its pedestal](https://www.innerscene.com/tools/library/3d-parts/statue-of-liberty-on-its-pedestal-c8a7318f).
- Publisher terms: [Innerscene Free Parts Library Terms](https://www.innerscene.com/tools/library/terms).
- The source page identifies the model as an original Innerscene model, CC0 1.0,
  with nominal dimensions 27.7 × 27.7 × 93 m.
- PATROL reuses the reviewed optimized GLB from PR #103 unchanged:
  `assets/nyc/scenario/liberty.glb`, 913,936 bytes, 15,900 triangles,
  one embedded Base Color atlas, SHA-256
  `34ed58d06e008adcced5e60376bbcc11d675f3d4ec01434016df92d244f33225`.
- This is an authored generic model, not photogrammetry, a georeferenced scan,
  or a certified real-world survey. The runtime scales it to 31.3 fictional
  game units at the existing Statue of Liberty game anchor; it is not 1:1 NYC.

## Runtime safety

- `assets/nyc/scenario-manifest.json` is intentionally unchanged:
  `landmarks.liberty.enabled` remains `false`.
- Only the explicit URL `?nycModels=libertyCC0` may load this model.
- Before decoding, WebCrypto SHA-256 must match the reviewed binary.
- After decoding, the renderer must report exactly 15,900 triangles and
  dimensions within the source-specific bounds (height 31.3, width/depth 9.323).
  A mismatch disposes the candidate buffers and retains the existing model.
- The aircraft collision profile is derived from the exact GLB triangles and
  activates only when that exact model is the loaded Liberty asset. Default,
  legacy, compatibility-renderer, and other-map collision paths remain unchanged.
- No terrain, Fort Wood, harbor, ferry, ship, road, bridge, flight-control,
  Alaska, Las Vegas, Chongqing, C185, or Cosmos logic is changed.

## Acceptance

The dedicated workflow:
1. Checks the exact binary SHA, GLB structure, triangle count, embedded atlas,
   model orientation, and triangle-derived collision bands.
2. Runs the dedicated runtime/collider tests and the full repository
   `tests/*.test.mjs` regression suite.
3. Starts the actual PATROL launcher in Chromium WebGL2, selects Manhattan
   and the seaplane, and compares the existing Statue view against the
   explicit CC0 opt-in view.
4. Requires the actual model to load through the real manifest path,
   source `scenario`, 15,900 triangles, expected dimensions, no page errors,
   no context loss, and WebGL error 0.
5. Captures PNG evidence only. CI uses SwiftShader, so its frame cadence is
   not native GPU FPS and cannot authorize a hardware performance claim.

The original low-poly/built-in fallback remains the default. Keep this Draft
until exact-head CI, screenshots, and native GPU frame pacing have been
reviewed. This import is one landmark only, not city-wide photorealism.
