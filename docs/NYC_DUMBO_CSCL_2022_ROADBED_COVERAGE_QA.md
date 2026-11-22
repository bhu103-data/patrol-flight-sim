# NYC DUMBO · Source pavement vs official street centerlines

This diagnostic is stacked on Draft #284, not part of PATROL's production flight map.

## Method

Read exactly three municipal-source snapshots already committed in the parent stack:

- 404 physical IDs from NYC CSCL inkn-q76z, of which 213 are source-coded at-grade and produce 295 independent line segments.
- 48 source NYC OTI building exterior rings; four line-vs-building discrepancies remain visible, not silently snapped.
- 2022 OTI ROADBED Front Street / Dock Street subset, 577 source triangles, 553 valid rendered triangles after removing the 24 source-export rounding degenerates.

All are projected into the existing local 1:1 DUMBO metre frame. Intersect each straight centerline segment against **every** actual historical-pavement triangle. Merge overlapping parameter intervals before adding lengths, so duplicated/overlapping triangles are never double-counted. This avoids summing road triangle area as though it were unique surface coverage (source #270 previously measured 6.67% overlap by area).

The CI writes `artifacts/nyc-dumbo-metric/cscl-roadbed-source-coverage.json` containing official physical IDs, street names, total centerline lengths, pavement-covered lengths, percent, and the four building-source conflicts.

## Interpretation and strict boundaries

The ROADBED snapshot is **not** a complete DUMBO street map. Its Front/Dock subset covers a small part of a much larger CSCL AOI. Therefore a road centerline outside these 2022 polygons is **not a closed, missing or non-drivable 2026 street**, and a covered segment is **not automatically legally drivable**.

Source year and age differ (buildings/CSCL and historical roadbed). No lane widths, 3-D road elevation, bridge/BQE level, active signal timing, physical curb heights, 2026 DOT as-built state or photogrammetric building façades have been established.

The tests enforce that the original four CSCL/OTI building discrepancies remain **visible as unresolved**, not erased by false alignment. The new files do not change the original `index.html`, runtime flight-map coordinates, vehicle routes, collision meshes, shaders or other cities. This is a data-quality gate before any street navigation or real-world geometry cutover.
