#!/usr/bin/env python3
"""Spatially compare 2014 BK02 source footprint surfaces with 2022 OTI FIDs.

No geometry is merged. The output is an evidence report for later review.
"""
from __future__ import annotations
import collections,json,math,pathlib,statistics,sys
from shapely.geometry import Polygon,Point
from shapely.ops import unary_union
from shapely.validation import make_valid
HERE=pathlib.Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
from official_bk02_projection import DUMBO_ORIGIN,M_PER_DEG_LON,M_PER_DEG_LAT
ROOT=pathlib.Path(__file__).resolve().parents[2]
ART=pathlib.Path("artifacts/nyc-official-bk02")
MESH=ART/"dumbo-2014-source-mesh.json"
OTI=ROOT/"assets/nyc/dumbo-oti-metric-48.json"
OUT=ART/"dumbo-2014-oti-2022-match.json"

def local_ring(ring):
    return [((lon-DUMBO_ORIGIN[0])*M_PER_DEG_LON,
             -(lat-DUMBO_ORIGIN[1])*M_PER_DEG_LAT) for lon,lat in ring]

def valid_polygon(g):
    if not g.is_valid:g=make_valid(g)
    if g.geom_type not in ("Polygon","MultiPolygon"):
        polys=[x for x in getattr(g,"geoms",[]) if x.geom_type=="Polygon"]
        g=unary_union(polys) if polys else Polygon()
    return g

def patch_xy_centroid(patch):
    v=patch["vertices"]
    return Point(statistics.fmean(v[0::3]),statistics.fmean(v[1::3]))

def patch_z_values(patch):
    return patch["vertices"][2::3]

def footprint_geometry(patches):
    grouped=collections.defaultdict(list)
    for p in patches:
        if p["kind"]!="footprint":continue
        v=p["vertices"];idx=p["triangles"]
        for i in range(0,len(idx),3):
            pts=[(v[idx[i+k]*3],v[idx[i+k]*3+1]) for k in range(3)]
            tri=Polygon(pts)
            if tri.area>.0005:grouped[p["sourceObjectUUID"]].append(tri)
    result={}
    for uid,parts in grouped.items():
        g=valid_polygon(unary_union(parts))
        if not g.is_empty and g.area>1.0:result[uid]=g
    return result

def source_relative_height(uid,footprint,patches):
    foot_z=[];roof_z=[];facade_z=[];roof_count=0;facade_count=0
    # The original 2014 model has no BIN on these surface layers. Associate
    # by spatial position only and retain counts to expose ambiguous matches.
    zone=footprint.buffer(2.0)
    for p in patches:
        if p["kind"]=="footprint" and p["sourceObjectUUID"]==uid:
            foot_z.extend(patch_z_values(p))
        elif p["kind"] in ("roof","facade") and zone.covers(patch_xy_centroid(p)):
            vals=patch_z_values(p)
            if p["kind"]=="roof":roof_z.extend(vals);roof_count+=1
            else:facade_z.extend(vals);facade_count+=1
    base=statistics.median(foot_z) if foot_z else None
    top=statistics.median(roof_z) if roof_z else (max(facade_z) if facade_z else None)
    height=(top-base) if base is not None and top is not None else None
    return {"sourceRelativeHeightRhinoFeet":height,
      "sourceFootprintMedianZRhinoFeet":base,
      "sourceRoofMedianZRhinoFeet":statistics.median(roof_z) if roof_z else None,
      "sourceRoofPatchCount":roof_count,"sourceFacadePatchCount":facade_count}

def main():
    mesh=json.loads(MESH.read_text());oti=json.loads(OTI.read_text())
    if mesh.get("schema")!="patrol-nyc-dumbo-bk02-2014-cached-roof-facade-mesh-v1":
        raise ValueError("Unexpected official BK02 mesh schema")
    if mesh.get("source3dmSha256")!="c22a7e7225425e01b5f50e5d68f6dc75b93a9d05c8a4ae566f1c1d40ec981493":
        raise ValueError("Unreviewed BK02 2014 source SHA")
    patches=mesh["meshPatches"];source=footprint_geometry(patches)
    if not source:raise ValueError("No source footprint surfaces for spatial match")
    current=[]
    for f in oti["features"]:
        poly=valid_polygon(Polygon(local_ring(f["ring"])))
        if poly.is_empty or poly.area<1:raise ValueError("Invalid current OTI footprint FID "+str(f["fid"]))
        current.append({"fid":f["fid"],"bin":f["bin"],"heightRoofFt":f["heightRoofFt"],
          "groundElevationFt":f["groundElevationFt"],"geometry":poly})
    pairs=[]
    for i,f in enumerate(current):
        for uid,g in source.items():
            inter=f["geometry"].intersection(g).area
            union=f["geometry"].union(g).area
            iou=inter/union if union else 0
            ratio=g.area/f["geometry"].area if f["geometry"].area else 0
            distance=f["geometry"].centroid.distance(g.centroid)
            if iou>0.01:
                pairs.append({"otiIndex":i,"sourceUUID":uid,"iou":iou,
                  "centroidDistanceM":distance,"sourceToOtiAreaRatio":ratio,
                  "sourceAreaM2":g.area,"otiAreaM2":f["geometry"].area})
    pairs.sort(key=lambda p:(-p["iou"],p["centroidDistanceM"]))
    assigned_oti=set();assigned_source=set();assigned={}
    for p in pairs:
        i=p["otiIndex"];uid=p["sourceUUID"]
        if i in assigned_oti or uid in assigned_source:continue
        assigned_oti.add(i);assigned_source.add(uid);assigned[i]=p
    rows=[];status_counts=collections.Counter()
    for i,f in enumerate(current):
        candidates=[p for p in pairs if p["otiIndex"]==i]
        top=candidates[0] if candidates else None
        chosen=assigned.get(i)
        p=chosen or top
        if p is None:status="no-overlap-candidate"
        elif p["iou"]>=.85 and p["centroidDistanceM"]<=1.0 and .85<=p["sourceToOtiAreaRatio"]<=1.15:
            status="high-confidence-footprint-match"
        elif p["iou"]>=.60 and p["centroidDistanceM"]<=2.5 and .60<=p["sourceToOtiAreaRatio"]<=1.40:
            status="possible-footprint-match"
        else:status="low-overlap-or-changed-building"
        status_counts[status]+=1
        height=None
        if p:
            height=source_relative_height(p["sourceUUID"],source[p["sourceUUID"]],patches)
        delta=None
        height_status="not-comparable"
        if height and height["sourceRelativeHeightRhinoFeet"] is not None:
            delta=height["sourceRelativeHeightRhinoFeet"]-f["heightRoofFt"]
            dm=abs(delta)*.3048
            height_status="within-2m" if dm<=2 else ("within-5m" if dm<=5 else "height-difference-over-5m")
        rows.append({"otiFid":f["fid"],"otiBin":f["bin"],
          "otiHeightRoofFt":f["heightRoofFt"],"matchStatus":status,
          "assignedOneToOne":chosen is not None,
          "source2014ObjectUUID":p["sourceUUID"] if p else None,
          "footprintIoU":round(p["iou"],6) if p else None,
          "centroidDistanceM":round(p["centroidDistanceM"],3) if p else None,
          "sourceToOtiAreaRatio":round(p["sourceToOtiAreaRatio"],5) if p else None,
          "secondBestIoU":round(candidates[1]["iou"],6) if len(candidates)>1 else None,
          "heightComparisonStatus":height_status,
          "heightDeltaFeet":round(delta,2) if delta is not None else None,
          "sourceHeightEvidence":height})
    report={"schema":"patrol-nyc-dumbo-bk02-2014-to-oti-2022-footprint-match-v1",
      "sourceZipSha256":mesh["sourceZipSha256"],"source3dmSha256":mesh["source3dmSha256"],
      "sourceVintage":2014,"currentFootprintVintage":2022,
      "sourceCoordinateFrame":"EPSG:2263 US survey feet XY -> DUMBO local east/south metres",
      "sourceZUnits":"Rhino document Feet; absolute vertical datum unverified",
      "heightComparison":"relative roof minus footprint Z only; not absolute elevation or 2026 status",
      "sourceFootprintObjects":len(source),"otiBuildings":len(current),
      "uniqueOneToOneAssignments":len(assigned),"candidatePairs":len(pairs),
      "matchCounts":dict(status_counts),"matches":rows,
      "releaseRule":"No automatic import. Only high-confidence XY matches are candidates; 2014 age and relative height must be reviewed independently."}
    OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps({k:v for k,v in report.items() if k!="matches"},indent=2))
    print("MATCH_SAMPLE",json.dumps(rows[:12],indent=2))
if __name__=="__main__":main()
