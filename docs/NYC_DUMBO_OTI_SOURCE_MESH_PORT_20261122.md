# DUMBO official OTI source mesh port onto the main-preserving NYC candidate

Date: 2026-11-22

## Scope

This isolated child of PR #211 ports the already tested #204/#264 three-building
OTI source-mesh pilot onto the latest main-preserving candidate. It changes
only the three existing DUMBO procedural building shells whose lot centers
match the verified source targets. The source records are:

| OTI FID | BIN | HEIGHT_ROOF | PATROL proxy center |
|---:|---:|---:|---:|
| 1080628 | 3389054 | 121 ft | (366.89, -346.09) |
| 1031082 | 3000135 | 83.41 ft | (390.63, -346.49) |
| 1051309 | 3344163 | 86.5 ft | (358.67, -280.37) |

FID 1080628 / BIN 3389054 is The Nexus at 84 Front Street, a 12-storey
condominium completed in 2006, not a historic warehouse. Its 12-storey rhythm,
yellow-brick/metal-panel interpretation and two-tier roof are authored detail
grounded in the documented building identity, not a surveyed 3D facade/roof.
The 2014 city model roof facets have not yet been matched to this FID.

## Sourced truth versus authored game fit

- NYC OTI BUILDING_view supplies the three exterior WGS84 footprint rings and
  HEIGHT_ROOF values. Original source vertices and FIDs are retained in the
  runtime pilot and provenance notes.
- The rings are uniformly miniaturized into the three existing road-cleared
  procedural PATROL building lots. The old city uses compressed game-space
  coordinates: **this is not georeferenced, not 1:1 and not a complete DUMBO
  district replacement**.
- The Nexus 12-storey count and material palette are based on the architect's
  public project description; individual window, metal-spandrel and roof-tier
  positions remain authored interpretation, not as-built survey.
- The mesh uses the existing shared city-building batch and existing shader
  tags. No new GLB, external photograph, runtime texture, dependency, network
  request, per-building draw call, traffic controller, road mesh, collision
  proxy, terrain, water or flight-control change is intended.
- Existing worker collision envelopes and road-cleared lot selection remain
  the authoritative gameplay proxies. The visual mesh must stay within those
  bounds and may not silently change collision height.

## Exact-parent acceptance

Parent #211 exact base: 91fb2191040e088ec26b2cd884aedffc0e5e6171 (main remains
6aee03e32cd06967451007d15d5fd9502f92de36). The workflow compares the real
PATROL game at this exact parent against the candidate using the same Chromium
SwiftShader WebGL2 fixed cameras and an A-B-B-A order. It must report all three
OTI FIDs actually emitted by the production helper, 1280x720 screenshots,
GL errors, first-load and rAF P50/P95, plus the two original OTI roof and
street camera modes. A separate browser check verifies Manhattan→Alaska→
Manhattan seaplane map switching.

SwiftShader timings are software-renderer diagnostics, not native Windows GPU
FPS. The pilot is accepted only if the exact-head full Node suite, live A/B,
cross-map smoke, and human screenshot review pass. No ancestor CI is a
substitute. Keep the child Draft; do not merge to main automatically.

## Known next realism work

The three buildings improve source-derived silhouette, recess depth and roof
shape but do not solve the remaining repeated box shells, real GPS registration,
current road/sidewalk conflicts, real-world facade material survey, city-wide
street geometry, or rain reflections. Keep those as separate evidence-backed
workstreams.
