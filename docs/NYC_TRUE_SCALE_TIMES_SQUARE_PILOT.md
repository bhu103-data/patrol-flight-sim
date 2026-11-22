# NYC Times Square — same-metre building and street source pilot

**Stage: source QA only. This is not yet the playable PATROL map or a photorealism claim.**

## Reason

Existing Times Square and Financial District buildings use separate compressed game-space transforms (about 0.32 versus 0.11 game units per source metre). NYC official street centerlines cannot accurately overlay these mismatched grids. Road tint, window details and signal lights alone cannot fix geography.

## Licensed public source references

Buildings: prior NYC municipal FID/HEIGHTROOF snapshot (120 entries), https://services2.arcgis.com/IsDCghZ73NgoYoz5/ArcGIS/rest/services/NYC_Building_Footprint/FeatureServer/0

Streets: NYC Department of City Planning DCM Street Center Line, https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/ArcGIS/rest/services/DCM_Street_Center_Line/FeatureServer/0

Official NYC Open Data terms: https://data.cityofnewyork.us/stories/s/Terms-of-Use/k9k7-3cje

No Google street-view, proprietary mesh or tile is copied.

## Geometry and outputs

The origin is WGS84 longitude -73.9864883, latitude 40.756421 (One Times Square reference). Plan X/east and Y/north are metres. Roof HEIGHTROOF is feet converted by exactly 0.3048 to metres. No PATROL units are mixed.

The bounded source-query area is longitude -73.9900 to -73.9822, latitude 40.7552 to 40.7610. The generated source.json records each source FID, road OBJECTID, source street status, centreline geometry, and caveats. The SVG plan uses equal physical metre units on both axes. Run the script in a connected GitHub runner; no failed fetch may silently create fake streets.

IMPORTANT: A centreline is not a curb, roadbed polygon, or verified number of driving lanes. The source can include paper or record streets. Heights and building footprints do not supply true facade photography or current ground-floor storefront details.

## Required next stages

1. Filter unbuilt/paper roads and acquire official roadbed, curb, sidewalk and plaza boundaries, with redistribution-rights review.
2. Replace a small whole neighborhood in a SEPARATE opt-in georeferenced game scene, not overlay a 1:1 geometry layer on the existing compressed game world.
3. Use the same exact transform for buildings, roads, traffic, flight collision, bridge rail and camera positions. Preserve legacy controls and map switch.
4. Compare the same real-world camera location, azimuth, FOV and height, keeping proprietary images outside the repo.
5. Verify no duplicate buildings, no roads through walls, genuine neighborhood dimensions, LOD/texture budget and native GPU frametime.

Until these steps pass, call PATROL a stylized NYC scene, not a surveyed real-world reconstruction. This draft changes no production files and is NOT approval to merge to main.
