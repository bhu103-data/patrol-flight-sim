# DUMBO Front / Dock — official 2022 sidewalk, curb and curb-cut source audit

This independent draft performs a bounded municipal-data acquisition only.
It does not render new streets, modify original PATROL flight, or approximate heights.

## Official source identity and reuse

- WGS84 bounding extent: [-73.99270, 40.70215, -73.98955, 40.70309].
- Road origin WGS84 (-73.992042, 40.702634), identical to the existing #270 OTI 2022 roadbed source.
- [SIDEWALK 2022 /22](https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Sidewalk_2022/FeatureServer/22) polygons with holes.
- [CURB 2022 /4](https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Curb_2022/FeatureServer/4) polylines.
- [CURB_CUT 2022 /5](https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Curb_Cut_2022/FeatureServer/5) polylines.
- [City terms](https://data.cityofnewyork.us/stories/s/Terms-of-Use/k9k7-3cje) and [NYC planimetric capture rules](https://github.com/CityOfNewYork/nyc-planimetrics/blob/main/Capture_Rules.md). Preserve city attribution and original record ID, source ID, subtype, status and WGS84 geometry.

The small bbox is an intersecting-feature query, not a clipping operation:
an original source polygon may extend outside the requested rectangle. All
rings/holes and polylines are saved unchanged in the QA artifact. No source
geometry is secretly re-snapped to old fictional city lots.

## Reproducible, fail-closed extraction

On Node 22 run:
1. node --test tests/nyc-dumbo-front-dock-pedestrian-source.test.mjs
2. node tools/nyc/collect-front-dock-pedestrian-source.mjs

A new isolated free GitHub Actions workflow executes the same sequence. Artifact
source.json contains whole official GeoJSON geometries/IDs plus provenance;
audit.json gives per-layer record/vertex/page counts and dated source details.
If official required SIDEWALK/CURB is missing, a page is invalid, a duplicate
ID is found or a source request times out, the workflow fails. CURB_CUT can be
empty for this small bounding box; an empty official return is not permission
to invent any curb ramps. CURB_CUT features can denote vehicular driveways
and must not be labelled accessible pedestrian curb ramps without other evidence.

## Hard nonclaims and next gate

2022 planimetrics are NOT 2026 as-built NYC, including the DUMBO bike
proposal or 2025 restoration. Data include no validated sidewalk/crosswalk
elevation, curb-face height, wheelchair ramp grade, signal timing or
street-level photograph rights. No source Z is applied.

After extraction, a SEPARATE opt-in 1:1 metric viewer can intersect these
official polygons with #270's 553 roadbed triangles and 48 source buildings.
A registered topological audit, genuine WebGL2 street and oblique screenshots,
visual no-overlap, road-to-sidewalk boundaries, low-quality fallback and real
Windows GPU P50/P95 must precede any gameplay change. Do not transplant the
Times Square-only sidewalk pilot #262 into Brooklyn. Do not combine #284's
four flagged centerline/building intersections with active driving lanes.
No change to main, #259, flight control, other maps or source JSON.


## Independently measured current source overlap (2026-11-22 run)

The first verified source artifact [run 45041048665](https://github.com/bhu103-data/patrol-flight-sim/actions/runs/45041048665)
contains 11 actual SIDEWALK features/3,161 vertices, 46 CURB features/1,609
vertices and 28 CURB_CUT features/211 vertices. Each is retained verbatim in
the uploaded original source.json; this is not a new user-facing game mesh.

A separate GEOS/Shapely 2.1.2 audit projects those original WGS84 shapes
against the unchanged #270/#259 2022 ROADBED source origin and clip.
It preserves road triangle duplicates and all original municipal IDs, and
records the *union*, rather than comparing misleading summed source areas.

First independently measured audit (areas in square metres; not a survey):
- 553 nondegenerate ROADBED triangles: 3714.84 summed area; only about
  3467.03 m² union area owing to overlapping source triangles.
- 11 valid SIDEWALK polygons: about 1839.87 m² within road audit clip,
  with **about 160.63 m² polygon intersection with the ROADBED union**.
  Largest sidewalk contributor FIDs: 50716 (~74.61m²), 50417 (~58.62m²),
  50509 (~26.03m²). Do not silently remove or snap any of these.
- Official CURB lines total 647.20m inside the clip, about 89.49% of
  clipped line length within 1 metre of the roadbed union boundary.
- CURB_CUT lines total 44.74m inside the clip, with 28 source records.
  Some are DRIVEWAY curb cuts, **not** verified accessible pedestrian ramps.

These represent *cross-layer planimetric disagreements*, not proof the
road source or pedestrian source is erroneous. No street collision or 2026
ramp implementation should be enabled while the exact overlap is unresolved.
The file topology-audit.json is preserved beside the full source.json.
To reproduce locally after source extraction:
1. python -m pip install shapely==2.1.2
2. python tools/nyc/audit-front-dock-pedestrian-topology.py

The audit deliberately reports topologyReleaseGate as
BLOCKED_UNRESOLVED_SOURCE_OVERLAP when overlaps exist; this **does not
cause the SOURCE QA workflow itself to fail**, because valid raw data should
still be collected and preserved. It is **not permission to merge into
production**. The missing vertical datum, current field survey, real GPU and
real overlap attribution must be resolved separately.
