# NYC DCP 2014 Times Square matched GLB preview

## Purpose

This PR is a bounded extraction experiment stacked on the official MN05 source
audit. It does not change the PATROL runtime, replace the current 2026
building-footprint source, or alter collision/traffic logic.

## Extraction path

1. Download the official NYC DCP Manhattan CD5 2014 3DM archive to an ephemeral
   GitHub runner; do not commit the 77 MB archive or 627 MB extracted model.
2. Read cached render meshes from the official Brep surfaces with the
   MIT-licensed rhino3dm reader.
3. Build 2014 footprint polygons from the FootPrint Surface layer.
4. Match those polygons one-to-one to the current 2026 Times Square building
   footprints using polygon intersection/coverage, IoU and centroid distance.
5. Assign facade/roof surfaces to the 2014 footprint using polygon containment
   and a normal-offset test for vertical facade panels.
6. Keep the current 2026 HEIGHTROOF value. Export only matches with a
   conservative 0.75–1.25 vertical scale ratio.
7. Export a per-FID GLB and an isometric PNG for visual review.

## Acceptance thresholds

- DCP/current footprint IoU >= 0.60.
- DCP and current footprint coverage >= 0.78 each.
- Centroid distance <= 2.5 m.
- Height scale ratio between 0.75 and 1.25.
- At least 10 accepted buildings before the artifact is considered ready for
  visual review.

All distances are evaluated in EPSG:2263 US survey feet and converted to
metres for reporting. The Rhino file reports UnitSystem.Feet; the
polygon-overlap match is an empirical placement/scale check, not a survey
certification.

## What this preview can and cannot prove

The 2014 model has actual footprint, roof and facade surface geometry, but
facade surfaces are geometric planes, not photographic textures. This
experiment can improve building massing, roof setbacks and silhouette. It
does not create windows, storefronts, Times Square LED screens, current
building alterations, collision meshes or current-day traffic.

The GLB and PNG are QA artifacts only. They are not enabled in the game and
are not production assets until same-camera browser screenshots, map/flight
regression, triangle budget and license/attribution review pass.

## Sources and attribution

- NYC Department of City Planning, NYC 3D Model by Community District (2014),
  Manhattan CD5.
- Official model metadata:
  https://github.com/CityOfNewYork/nyc-geo-metadata/blob/master/Metadata/Metadata_3DBuildingModel.md
- NYC Open Data terms:
  https://data.cityofnewyork.us/stories/s/Terms-of-Use/k9k7-3cje
- Current building footprint source is recorded in
  assets/nyc/times-square-footprints.json.
- Build-time tools: rhino3dm (MIT), pyproj (MIT), Shapely (BSD),
  trimesh (MIT), matplotlib (PSF).

Attribution: NYC Department of City Planning, NYC 3D Model (2014); extracted
and transformed subset; current 2026 footprint heights retained where the
geometry match passes the stated thresholds.
