# Times Square official roadbed polygon source — opt-in QA

**Not a playable PATROL NYC map, measured current street elevation, lane network, or photographic reconstruction.** The existing compressed 24×33 game-space NYC street grid remains unchanged.

## Why this adds different evidence than PR #234
PR #234 projects official DCM street **centerlines** and 118 municipal building footprints to a common local east/north metre reference. Centerline widths are a right-of-way attribute, not actual asphalt polygons. This child source-only pilot fetches official OTI **ROADBED 2022** polygons, including the distinct roadbed (350000), intersection (350010), driveway (350030), and shoulder (350020) subtypes. It does NOT invent strip widths around street lines.

## Authoritative data and caveats
- NYC OTI public ArcGIS: https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Roadbed_2022/FeatureServer/20
- 2022 imagery, updated planimetrics in 2023; not an assertion of 2026 conditions.
- Capture rules: https://github.com/CityOfNewYork/nyc-planimetrics/blob/main/Capture_Rules.md — roadbed is the **polygon interior to pavement edges**, and intersections are separate geometries.
- Reuse/terms: https://data.cityofnewyork.us/stories/s/Terms-of-Use/k9k7-3cje — original data only fetched during QA; do not commit downloaded parcels or copyrighted photos until permission/attribution audited.
- Origin, bounding box and approximate local WGS84 metre transform are exactly PR #234's `ORIGIN`, `BBOX`, `toLocalMeters`.
- The polygon dataset is planimetric (2-D), not 3-D. Roadway slopes, grades, curbs, lanes and traffic directions must be derived separately and independently checked.
- Times Square Broadway public plazas and future pedestrianization are **not encoded** by this sample as present-day material facts.
- NYC's 2025 DUMBO Belgian block restoration is **not represented by 2022 imagery**.

## CI acceptance of this source slice
The dedicated workflow executes the original #234 DCM/roof source acquisition, runs real Node tests, downloads the current bounded OTI roadbed polygon features and publishes:
- `roadbed.json`: original OTI feature IDs, source class, all polygon rings incl. interior holes, source frame, area-neutral metre coordinates
- `overlay.svg`: fixed same-metres visual overlay of source building plan, actual roadbed polygons and clipped official street centerlines. The bounding box crops **presentation only**, without distorting source geometry.

Fail rather than generate substitute rectangles if the official source is unavailable or does not return polygons. Maintain separate Draft, do not merge to main or #211, do not claim gameplay fidelity.

## Hard blockers before game deployment
1. Reconcile 2022 roadbed polygons with 2025/2026 local changes, plazas and curb updates.
2. Import and validate official curb and sidewalk polygons, extrude elevation and check real vertical separations at bridges and underpasses.
3. Put all streets, building massing, vehicles, collision, cameras and flight in a **single noncompressed 1:1 metre** system. Replace whole neighborhoods rather than lay a road polygon on top of the old fictional grid.
4. Triangulate full polygons with holes; ensure no invalid winding, duplicate roads, water overlap, pavement/building conflict, or degenerate triangles.
5. Match pedestrian-height and low-flying fixed cameras to legal reference views, then check draw counts and hardware FPS.

This pilot deliberately leaves all production rendering and physics untouched.
