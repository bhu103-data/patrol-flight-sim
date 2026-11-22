#!/usr/bin/env python3
"""Exact source-geometry topology QA, not an algorithm to 'repair' NYC streets.
Uses Shapely (BSD) only in GitHub Actions, not the PATROL game runtime.
All shapes use PR #234's local WGS84 east/north metre frame. Read source only.
"""
import json
import math
from pathlib import Path
from shapely.geometry import Polygon, LineString, box
from shapely.ops import unary_union

ROOT = Path("artifacts")
EDGES = json.loads((ROOT / "nyc-curb-sidewalk-source/edges.json").read_text())
ROAD = json.loads((ROOT / "nyc-roadbed-source/roadbed.json").read_text())
CITY = json.loads((ROOT / "nyc-true-scale/source.json").read_text())

def assert_source_frames():
    frames = [v["projection"] for v in (EDGES, ROAD, CITY)]
    if not all(frame["originLonLat"] == frames[0]["originLonLat"] for frame in frames):
        raise ValueError("Mixed NYC coordinate origins cannot be compared")
    if not all(frame["bboxLonLat"] == frames[0]["bboxLonLat"] for frame in frames):
        raise ValueError("Different NYC geographic audit bounding boxes")
    if not all(frame.get("scaleMetresPerGameUnit") is None for frame in frames):
        raise ValueError("Compressed PATROL game units illegally mixed with GIS metres")

def audit_region():
    origin = CITY["projection"]["originLonLat"]
    west, south, east, north = CITY["projection"]["bboxLonLat"]
    phi = math.radians(origin[1])
    m_lon = 111412.84 * math.cos(phi) - 93.5 * math.cos(3*phi) + .118 * math.cos(5*phi)
    m_lat = 111132.92 - 559.82 * math.cos(2*phi) + 1.175 * math.cos(4*phi)
    return box((west-origin[0])*m_lon,(south-origin[1])*m_lat,
               (east-origin[0])*m_lon,(north-origin[1])*m_lat)

def polygons(features,region,kind):
    all_shapes,invalid = [],[]
    for feature in features:
        for rings in feature["polygons"]:
            p = Polygon(rings[0], holes=rings[1:])
            if not p.is_valid:
                invalid.append({"kind":kind,"sourceObjectId":feature["objectId"]})
                continue
            p = p.intersection(region)
            if not p.is_empty: all_shapes.append((feature["objectId"],p))
    return all_shapes,invalid

def record_overlap(sidewalks, buildings, region):
    hits = []
    for sid,side in sidewalks:
        for building in buildings:
            b = building["shape"]
            if not side.intersects(b): continue
            overlap = side.intersection(b).area
            if overlap > .05:
                hits.append({"sidewalkObjectId":sid,"buildingFid":building["fid"],
                             "areaSquareMetres":round(overlap,3)})
    return sorted(hits,key=lambda x:x["areaSquareMetres"],reverse=True)

def collect_curb_lines(region):
    segments=[]
    for feature in EDGES["curbs"]:
        for part in feature["parts"]:
            if len(part)>1:
                line=LineString(part).intersection(region)
                if not line.is_empty:segments.append(line)
    return segments

def run():
    assert_source_frames()
    region = audit_region()
    sidewalks,bad_side = polygons(EDGES["sidewalks"],region,"sidewalk")
    roadbeds,bad_road = polygons(ROAD["roadbeds"],region,"roadbed")
    buildings=[]
    bad_buildings=[]
    for b in CITY["buildings"]:
        shape=Polygon(b["outline"])
        if not shape.is_valid:
            bad_buildings.append(b["fid"])
            continue
        shape=shape.intersection(region)
        if not shape.is_empty: buildings.append({"fid":b["fid"],"shape":shape})
    if bad_side or bad_road or bad_buildings:
        raise ValueError("Invalid official polygon coordinates: "+str({
            "sidewalk":bad_side[:8],"roadbed":bad_road[:8],
            "buildingFids":bad_buildings[:8]
        }))
    S=unary_union([p for _,p in sidewalks])
    R=unary_union([p for _,p in roadbeds])
    B=unary_union([b["shape"] for b in buildings])
    curb_lines=collect_curb_lines(region)
    if not curb_lines:raise ValueError("No NYC curb geometry in source region")
    curb_union=unary_union(curb_lines)
    coverage=curb_union.intersection(R.boundary.buffer(1)).length/max(curb_union.length,1)
    road_side_overlap=R.intersection(S).area
    road_building_overlap=R.intersection(B).area
    sidewalk_building_overlap=S.intersection(B).area
    overlaps=record_overlap(sidewalks,buildings,region)
    source_pass=(road_side_overlap<=.05 and road_building_overlap<=.05
                 and coverage>=.95)
    result={
      "schema":"patrol-nyc-official-source-topology-qa-v1",
      "sourceYears":{"roadbed":2022,"sidewalk":2022,"curb":2022},
      "units":"metres / square metres; source-only, clipped to same BBOX",
      "counts":{"roadbedPolygons":len(roadbeds),"sidewalkPolygons":len(sidewalks),
        "buildingFootprints":len(buildings),"curbParts":len(curb_lines)},
      "tileSquareMetres":round(region.area,3),
      "areas":{"roadbedSquareMetres":round(R.area,3),
        "sidewalkSquareMetres":round(S.area,3),
        "buildingFootprintSquareMetres":round(B.area,3),
        "roadbedSidewalkOverlapSquareMetres":round(road_side_overlap,3),
        "roadbedBuildingOverlapSquareMetres":round(road_building_overlap,3),
        "sidewalkBuildingOverlapSquareMetres":round(sidewalk_building_overlap,3)},
      "curbLengthMetres":round(curb_union.length,3),
      "curbLengthWithinOneMetreRoadbedBoundaryRatio":round(coverage,5),
      "topSidewalkBuildingSourceConflicts":overlaps[:25],
      "sourceTopologyPass":bool(source_pass),
      "sourceBuildingsSidewalkConflict":sidewalk_building_overlap>.05,
      "readyForProductionFlightGame":False,
      "blockingLimitations":[
        "Source sidewalk/building overlaps require feature-specific investigation; never automatically delete municipal source polygons",
        "No verified roadbed, sidewalk, curb or bridge vertical datum; never create measured curb risers or collisions from flat 2022 data",
        "Existing game roads and building masses use compressed separate coordinate transforms",
        "2022 aerial sources cannot certify today's DUMBO paving, sidewalk ramps or current traffic layout"
      ]}
    path=ROOT/"nyc-curb-sidewalk-source/topology-audit.json"
    path.write_text(json.dumps(result,indent=2)+"\n")
    print("NYC true-metre official street topology QA",json.dumps({
      "sourceTopologyPass":source_pass,
      "roadbedSidewalkOverlap":result["areas"]["roadbedSidewalkOverlapSquareMetres"],
      "roadbedBuildingOverlap":result["areas"]["roadbedBuildingOverlapSquareMetres"],
      "sidewalkBuildingOverlap":result["areas"]["sidewalkBuildingOverlapSquareMetres"],
      "curbBoundaryCoverage":result["curbLengthWithinOneMetreRoadbedBoundaryRatio"],
      "readyForProductionFlightGame":False
    }))
    if not source_pass: raise RuntimeError("Source topology gate failed; inspect topology-audit.json")

if __name__=="__main__":run()
