#!/usr/bin/env python3
"""Generate display-only sidewalk polygons that cannot cover NYC building footprints.

Source OTI 2022 SIDEWALK_2022/22, municipal BUILDING footprints, common local
WGS84 east/north metre frame. This is NOT an edit to the original GIS dataset,
a true 2026 sidewalk/curb survey, or a new playable road/flight map.

Outputs:
 * sidewalk-display.json: source-identified, building-masked render geometry;
 * sidewalk-occlusion-report.json: exact area reconciliation and FID overlaps;
 * sidewalk-occlusion-plan.svg: labelled geographic before/after QA.
"""
import argparse
import json
import math
from pathlib import Path

from shapely.geometry import Polygon, MultiPolygon, GeometryCollection, box
from shapely.ops import unary_union

DISPLAY_SCHEMA = "patrol-nyc-sidewalk-visual-mask-v1"
SOURCE_SCHEMA = "patrol-nyc-oti-sidewalk-curb-metre-source-v1"
CITY_ROLE = "GEOREFERENCED_SOURCE_QA_ONLY_NOT_IN_GAME"


def polygon_parts(geom):
    if geom.is_empty:
        return []
    if geom.geom_type == "Polygon":
        return [geom] if geom.area > 1e-8 else []
    if geom.geom_type in ("MultiPolygon", "GeometryCollection"):
        return [p for item in geom.geoms for p in polygon_parts(item)]
    if geom.area > 1e-8:
        raise ValueError("Unexpected non-polygonal display geometry")
    return []


def strict_polygon(rings, name):
    if not rings:
        raise ValueError(f"Missing source geometry {name}")
    p = Polygon(rings[0], holes=rings[1:])
    if not p.is_valid or p.is_empty or p.area < 1e-8:
        raise ValueError(f"Invalid source polygon {name}; no automatic buffer(0)")
    return p


def metric_bbox(city):
    origin = city["projection"]["originLonLat"]
    west, south, east, north = city["projection"]["bboxLonLat"]
    latitude = math.radians(origin[1])
    east_per_degree = (111412.84*math.cos(latitude) -
                       93.5*math.cos(3*latitude) +
                       .118*math.cos(5*latitude))
    north_per_degree = (111132.92-559.82*math.cos(2*latitude) +
                        1.175*math.cos(4*latitude))
    return box((west-origin[0])*east_per_degree,
               (south-origin[1])*north_per_degree,
               (east-origin[0])*east_per_degree,
               (north-origin[1])*north_per_degree)


def encode(poly):
    """Keep GEOS precision (six decimals); never round to fictitious grid cells."""
    if not poly.is_valid:
        raise ValueError("Invalid derived polygon; refuse to mask source silently")
    def coords(r):
        return [[round(x, 6), round(y, 6)] for x,y in r.coords]
    return [coords(poly.exterior)] + [coords(r) for r in poly.interiors]


def derive_sidewalk_display(city, sidewalks, region=None):
    if city.get("assetRole") != CITY_ROLE:
        raise ValueError("Not source-only WGS84 City footprints")
    if sidewalks.get("schema") != SOURCE_SCHEMA:
        raise ValueError("Not authentic NYC 2022 OTI sidewalk source")
    frames = [city.get("projection") or {}, sidewalks.get("projection") or {}]
    for field in ("originLonLat", "bboxLonLat"):
        if frames[0].get(field) != frames[1].get(field):
            raise ValueError("Mixed source geographic coordinate origin/bbox")
    if any(f.get("scaleMetresPerGameUnit", "missing") is not None for f in frames):
        raise ValueError("Compressed PATROL game scale is not a real-metre frame")
    if region is None:
        region = metric_bbox(city)
    buildings = []
    for b in city.get("buildings", []):
        p = strict_polygon([b["outline"]], f"BUILDING FID {b['fid']}")
        p = p.intersection(region)
        if not p.is_empty:
            buildings.append((b["fid"], p))
    if not buildings:
        raise ValueError("No source building polygons to guard")
    building_mask = unary_union([p for _,p in buildings])
    display_features, conflicts,original=[],[],[]
    before_area=0.
    removed_sum=0.
    derived_sum=0.
    skipped_zero=0
    unique_ids=set()
    for f in sidewalks.get("sidewalks", []):
        oid=f["objectId"]
        if oid in unique_ids:
            raise ValueError("Duplicate OTI SIDEWALK OBJECTID")
        unique_ids.add(oid)
        result=[]
        for n,rings in enumerate(f["polygons"]):
            source = strict_polygon(rings, f"SIDEWALK OBJECTID {oid} part {n}")
            tile_part=source.intersection(region)
            if tile_part.is_empty:
                continue
            if not tile_part.is_valid:
                raise ValueError(f"Invalid clipped sidewalk {oid}")
            original.append((oid,tile_part))
            original_area=tile_part.area
            removed_geometry=tile_part.intersection(building_mask)
            removed=removed_geometry.area
            safe=tile_part.difference(building_mask)
            if not safe.is_valid:
                raise ValueError(f"Invalid masked display polygon {oid}")
            display_parts=polygon_parts(safe)
            area=sum(p.area for p in display_parts)
            if abs(original_area-removed-area) > .00001:
                raise ValueError(f"Sidewalk area conservation failed id={oid}")
            before_area+=original_area
            removed_sum+=removed
            derived_sum+=area
            if not display_parts:
                skipped_zero+=1
            for p in display_parts:
                result.append(encode(p))
            if removed > .05:
                for fid,b in buildings:
                    intersection=tile_part.intersection(b)
                    if intersection.area>.05:
                        conflicts.append({"sidewalkObjectId":oid,
                            "buildingFid":fid,
                            "areaSquareMetres":round(intersection.area,4)})
        if result:
            display_features.append({
                "objectId":oid,"sourceId":f.get("sourceId"),
                "subtype":f.get("subtype"),"status":f.get("status"),
                "polygons":result
            })
    if before_area<=10 or not display_features:
        raise ValueError("Empty measured source sidewalk scene")
    # Two independent area checks: per-part sum and union in the source tile.
    clipped_original_union=unary_union([p for _,p in original])
    unmasked_area=clipped_original_union.intersection(building_mask).area
    clipped_safe_union=clipped_original_union.difference(building_mask)
    polygons_safe=[strict_polygon(rings,f"derived {f['objectId']}")
                   for f in display_features for rings in f["polygons"]]
    final_union=unary_union(polygons_safe)
    if final_union.intersection(building_mask).area>1e-6:
        raise ValueError("Display sidewalk still intersects original buildings")
    if abs(clipped_safe_union.area-final_union.area)>.001:
        raise ValueError("Display union does not match exact source-minus-buildings")
    if abs(before_area-removed_sum-derived_sum)>.0001:
        raise ValueError("Display mask lost GIS geometry unexpectedly")
    report={
      "schema":"patrol-nyc-sidewalk-building-visual-mask-audit-v1",
      "source":sidewalks.get("sources",{}).get("sidewalk"),
      "units":"metres and square metres, 2022 sidewalks, source-only",
      "sourceRecordsPreserved":len(sidewalks.get("sidewalks",[])),
      "counts":{"renderableSourceFeatures":len(display_features),
        "renderableSourceParts":sum(len(f["polygons"]) for f in display_features),
        "sourcePartsZeroAfterMask":skipped_zero,
        "conflictRecords":len(conflicts)},
      "areas":{"sourceClippedPartSumSquareMetres":round(before_area,4),
        "displayPartSumSquareMetres":round(derived_sum,4),
        "maskedPartSumSquareMetres":round(removed_sum,4),
        "sourceUnionBuildingOverlapSquareMetres":round(unmasked_area,4),
        "displayUnionBuildingOverlapSquareMetres":
          round(final_union.intersection(building_mask).area,8),
        "sourceUnionSquareMetres":round(clipped_original_union.area,4),
        "displayUnionSquareMetres":round(final_union.area,4)},
      "affectedOfficialObjects":sorted(conflicts,
          key=lambda x:(-x["areaSquareMetres"],x["sidewalkObjectId"])),
      "sourceGeometryMutated":False,
      "displaySubtractsBuildingsOnly":True,
      "readyForProductionFlightGame":False,
      "caveats":[
        "A 2022 sidewalk polygon overlapping an older building footprint is NOT proof of current ground access",
        "Subtracting an official building outline is a DISPLAY-ONLY occlusion mask and does NOT resolve source vintages",
        "Original official SIDEWALK polygons, IDs and area remain in untouched edges.json",
        "Viewer flat surface offsets are NOT curb elevation measurements",
        "No game navigation, collision or flight route may use this display mask without further review"]
    }
    display={
      "schema":DISPLAY_SCHEMA,"assetRole":"VISUAL_ONLY_SOURCE_PRESERVING_DERIVATION",
      "projection":city["projection"],"sourceYears":{"sidewalk":2022},
      "sourceBuildingCount":len(buildings),
      "sidewalks":display_features,
      "counts":{"sourceFeatures":len(sidewalks["sidewalks"]),
        "displayFeatures":len(display_features),
        "displayPolygons":sum(len(f["polygons"]) for f in display_features)},
      "areas":report["areas"]
    }
    return display,report


def svg_plan(city,raw,derived,report):
    tile=metric_bbox(city)
    x0,y0,x1,y1=tile.bounds
    def path(poly):
        def ring(line):
            return "M"+" L".join(f"{x:.4f},{-y:.4f}" for x,y in line)+" Z"
        return " ".join(ring(r) for r in poly)
    raw_paths="".join(
      '<path d="'+path(rings)+'" fill="#8e9eb1" opacity=".28" fill-rule="evenodd"/>'
      for f in raw["sidewalks"] for rings in f["polygons"])
    derived_paths="".join(
      '<path d="'+path(rings)+'" fill="#6ecab6" opacity=".75" fill-rule="evenodd"/>'
      for f in derived["sidewalks"] for rings in f["polygons"])
    buildings="".join(
      '<polygon points="'+" ".join(f"{x:.4f},{-y:.4f}" for x,y in b["outline"])+
      '" fill="#a14f58" stroke="#e4b6b2" stroke-width=".3"/>'
      for b in city["buildings"])
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+
      f"{x0:.3f} {-y1:.3f} {x1-x0:.3f} {y1-y0:.3f}"+
      '" width="1200" height="'+str(round(1200*(y1-y0)/(x1-x0)))+'">'+
      '<rect x="'+str(x0)+'" y="'+str(-y1)+'" width="'+str(x1-x0)+
      '" height="'+str(y1-y0)+'" fill="#13212c"/>'+
      raw_paths+derived_paths+buildings+
      '</svg>')


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--city",default="artifacts/nyc-true-scale/source.json")
    parser.add_argument("--edges",default="artifacts/nyc-curb-sidewalk-source/edges.json")
    parser.add_argument("--out",default="artifacts/nyc-curb-sidewalk-source/")
    a=parser.parse_args()
    city=json.loads(Path(a.city).read_text())
    raw=json.loads(Path(a.edges).read_text())
    display,report=derive_sidewalk_display(city,raw)
    out=Path(a.out)
    out.mkdir(parents=True,exist_ok=True)
    (out/"sidewalk-display.json").write_text(json.dumps(display,separators=(",",":")))
    (out/"sidewalk-occlusion-report.json").write_text(json.dumps(report,indent=2)+"\n")
    (out/"sidewalk-occlusion-plan.svg").write_text(svg_plan(city,raw,display,report))
    print("NYC display mask, original source untouched",json.dumps({
      "counts":report["counts"],"areas":report["areas"],
      "topConflicts":report["affectedOfficialObjects"][:5],
      "readyForProductionFlightGame":False}))


if __name__=="__main__":
    main()
