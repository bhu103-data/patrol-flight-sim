# NYC MN05 roof cached-mesh topology QA

## Scope

This child adds an independent topology gate to the exact 2014 NYC DCP MN05
roof mesh extracted by PR #285. It consumes the bounded source JSON artifacts
already produced by the parent workflow; it does not download or re-parse the
627 MB Rhino file itself and does not duplicate the Rhino 8.35 mesh-face API
adapter.

## Independent checks

- Validates all 1,403 cached roof patches and 10,669 source triangles.
- Checks finite coordinates, valid triangle indices, edge incidence,
  non-manifold edges, boundary vertex degree, closed boundary loops,
  degenerate triangles and self-intersections in the local XY plane.
- Preserves multiple boundary loops: 62 roof patches have more than one loop.
- Matches mesh boundary-loop counts to the original Brep loop counts for all
  80 source objects included in the parent ROI sample.
- Compares the mesh source-foot bounds to those sampled original Brep bounds.
  The explicit maximum allowed outside distance is 0.05 US survey feet.
- Writes a compact topology report artifact.

## Verified result for the pinned source

The parent artifact currently produces 1,403 valid patches; loop distribution
is 1,341 / 55 / 5 / 1 / 1 for one through five loops. All 80 sampled Brep loop
counts match the mesh loop counts. Maximum mesh bbox overrun is 0.031 ft.

## Limits that remain

No exact trim polyline was available in the 82 sampled trim records, so this
does not prove exact NURBS perimeter/area deviation. It also does not prove
vertical datum, current 2026 building geometry, per-building OTI FID identity,
or suitability for the live PATROL map. The 2014 source remains a separate
historical geometry source. Source Z stays raw; no game runtime import is
authorized by this QA.
