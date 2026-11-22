# Tracy Arm NOAA CUSP real shoreline — source-backed read-only QA

**2026-11-22 UTC.** This document records a reproducible shoreline dataset acquisition and does **not** authorize a game shoreline or collision change.

## Official source and redistribution

- NOAA Shoreline Data Explorer: https://nsde.ngs.noaa.gov/
- Actual NOAA CUSP index grid: https://nsde.ngs.noaa.gov/cusp/cuspidx/{z}/{x}/{y}.pbf
- Actual source archive resolved from tiles over the Tracy Arm AOI: https://nsde.ngs.noaa.gov/downloads/N55W135.zip
- InPort NOAA CUSP metadata: https://www.fisheries.noaa.gov/inport/item/60812
- CUSP can incorporate non-NOAA sources. In *this* Tracy Arm AOI, all seven intersecting features have \`DAT_SET_CR=NOAA\`. Retain every original source attribute. Metadata states no access restrictions; NOAA requests credit and warns data are not for litigation. These lines are **historical mean high water** not 2026 live shore observations.
- Source ZIP byte count: **28,034,114**, SHA-256 **\`9e201b91c7f9e2b17282068e582ec178e71e0317dede11423e0a946813b79a79\`**. ZIP CRC and Shapefile components verified. Contains 26,357 source shoreline features.
- CRS: **EPSG:4269 (NAD83)**, converted explicitly to EPSG:4326 for AOI comparison.

## Verified 256×256 Tracy Arm clip

- Bbox: \`[-133.265,57.851,-133.135,57.923]\` WGS84.
- Extracted: **7 LineString segments**, **1,525 vertices**, **22,397.60 metres** of clipped linework.
- Every \`ATTRIBUTE\` = \`Natural.Mean High Water\`.
- \`SOURCE_ID\` codes: \`GC10439\` (4 lines) and \`GC11400\` (3 lines).
- \`SRC_DATE\` feature counts: \`19910101\` × 4; \`20150422\` × 1; \`20171207\` × 2.
- Source \`HOR_ACC\`: 5 and 6.5 (as textual provenance; do not treat as uniform positional accuracy for current date).
- Output \`tracy-arm-cusp-qa-only.geojson\`: **64,032 bytes**, SHA-256 **\`009ba8b665651722cb821f29ef9cf209e6bae6ab1da9f0f010e7ca40b4e6ce6d\`**.

This is **not** the exact same product as the discrete NOAA AK1803-CM-T shoreline survey, and the 1991 segments are particularly old. Historical mixed-vintage lines must not be described as a current 2026 coast. The current NOAA CUSP product is not an authoritative, closed polygon defining water/land physics.

## Third-party QA comparison (not a runtime physics test)

At the existing 256×256 WGS84 DEM AOI (~30×31m/cell), NOAA mean-high-water shorelines rasterize to **906 touched cells**. Using distance in metres to the nearest raster *water-class transition*:

| QA metric | PATROL USGS 3DEP DEM elevation ≤3m | USGS LANDFIRE LF2025 EVC code 11 |
|---|---:|---:|
| Median distance from NOAA line cells to class boundary | 688.8 m | 0.0 m |
| NOAA line cells within 60m of boundary | 9.6% | 96.0% |
| NOAA line cells within 120m of boundary | 18.4% | 99.3% |
| NOAA line cells within 240m of boundary | 29.4% | 100.0% |

The DEM low-elevation water proxy and EVC water mask disagree in **9,445 / 65,536** pixels (14.4119%). NOAA CUSP lines are visibly closer to the LANDFIRE water classification. This does **not** prove a graphics/collision bug: the DEM shoreline proxy is an elevation threshold, NOAA is mean high water, products may share underlying source data, and PATROL may interpret elevation differently at runtime. Determine whether the 3DEP original service returned different source elevations or nodata interpolation before any game-engine intervention.

## Reproducible implementation and evidence

- Existing GIS data downloader and CRS/forest audit in [draft PR #184](https://github.com/bhu103-data/patrol-flight-sim/pull/184).
- NOAA CUSP tile discovery: \`tools/alaska/fetch_noaa_cusp_index.py\`.
- Protected, bounded NOAA-only extraction: \`tools/alaska/clip_noaa_cusp_tracy_arm.py\`.
- Runs only as a conditional step of existing \`PATROL regression tests\` workflow **when \`pull_request.number == 201\`**. Main and other PRs do not execute these steps.
- CI source download and clip: [Actions run 44990187091](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/44990187091); artifact \`noaa-cusp-tracy-arm-pr201-results\`. The first version incorrectly reported full shapefile count after Fiona filtered iteration; fixed in follow-up code by capturing the collection count before filtering. This did **not** affect extracted geometry, exact SHA or line counts.
- A local detailed QA package has the 7-line GeoJSON, source-provenance report, water-class distance comparison, figure, and reproducible scripts.

**Release guardrails:** No runtime import, no asset replacement, no water/collision/floating physics change, no vegetation rendering changes, no claimed WebGL frame-rate result, and no merge of #184/#201 pending independent review.


## 2026-11-22 — Live USGS 3DEP source re-download (root-cause narrowing)

**GitHub Actions [run 44990363088](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/44990363088) succeeded**, including original Node regressions, NOAA CUSP download/clip and \`tools/alaska/audit_usgs_3dep_live.py\`. Its provenance/diagnostic JSON is under \`3dep-live-qa/usgs-3dep-live-vs-baked.json\` in the NOAA QA artifact.

The exact \`sourceQuery\` embedded in \`assets/alaska/tracy-arm-3dep.json\` was executed again against USGS 3DEP. The returned raw image is a **256×256 Float32 TIFF, 262,982 bytes**, SHA-256 \`e402a8bf8e4b92484e0df01f3e25bd433251b826b8b42d5882ac9c4b4c607136\`, maximum ~1,835.73m.

Running the original baker's south-first flip, nodata handling, nonnegative elevation clamp, rounding and U16 conversion **exactly reproduced every one of the 65,536 baked pixels**: **0 mismatches**, maximum delta **0m**, mean delta **0m**. There are **6,293** low-elevation proxy-water cells (\`<=3m\`) in both the current USGS service and game-baked asset.

Of **906 NOAA CUSP shoreline-covered raster cells**, **814** have USGS elevation **above 3m** both in the live service response and baked asset.

**Conclusion:** this large-scale discrepancy is **not caused by corruption of the baked 3DEP asset, a changed live USGS DEM response, or the baker's south-first row flip**. It is a **mismatch between the 3DEP terrain elevation source/low-height water proxy and historical CUSP / LANDFIRE shoreline interpretation**. The QA does not independently prove which DEM regions are incorrectly assigned land versus missing bathymetry. The game's full water/flight collision logic has not yet been audited in WebGL2. Keep DEM, physics, floats and game shoreline unchanged; investigate a separately sourced shoreline/water mask and terrain-water coupling on an isolated *future* implementation branch with fixed-camera evidence.

The USGS DEM is still valid as the project's documented elevation slice; it must not be marketed as high-precision NOAA hydrographic shoreline or bathymetry. CUSP dates and NOAA mean-high-water vertical datum remain historic and do not grant 2026 shoreline accuracy.
