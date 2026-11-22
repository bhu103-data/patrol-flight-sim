#!/usr/bin/env python3
"""Independent 2D source topology audit, no 3D curb or game surface synthesis.

Inputs: LIVE OTI 2022 SIDEWALK/CURB/CURB_CUT snapshot (from sibling fetch
step), PINNED #259/#270 official ROADBED 2022 source JSON. This audit never
modifies the original geometries and does not silently eliminate overlaps.
"""
import json
import math
import sys
from collections import Counter
from pathlib import Path
from shapely.geometry import Polygon, box, shape
from shapely.ops import transform, unary_union
from shapely.validation import explain_validity
from shapely import make_valid

OUTPUT = Path("artifacts/nyc-dumbo-front-dock-pedestrian-source")
ROAD_PATH = Path("assets/nyc/dumbo-front-dock-roadbed-2022.json")

def audit(source, road):
    if source.get("schema") != "patrol-dumbo-front-dock-oti-pedestrian-source-only-v1":
        raise ValueError("Mismatched pedestrian snapshot")
    if source.get("sourceVintage") != 2022 or road.get("year") != 2022:
        raise ValueError("Mixed official year")
    if source.get("bboxWgs84") != road.get("queryBbox"):
        raise ValueError("Source bbox not aligned with pinned 2022 roadbed")
    if source.get("sourceRoadOrigin") != road.get("origin"):
        raise ValueError("Source origin not aligned with pinned 2022 roadbed")
    for name, expected in (("sidewalk", 22), ("curb", 4), ("curbCut", 5)):
        layer = source.get("layers", {}).get(name)
        if not isinstance(layer, dict) or f"/{expected}" not in layer.get("layerUrl", ""):
            raise ValueError("Missing original NYC OTI layer " + name)
    origin = road["origin"]
    phi = math.radians(origin["lat"])
    m_lon = 111412.84 * math.cos(phi) - 93.5 * math.cos(3*phi) + .118 * math.cos(5*phi)
    m_lat = 111132.92 - 559.82 * math.cos(2*phi) + 1.175 * math.cos(4*phi)
    project = lambda geom: transform(
        lambda lon, lat, z=None: ((lon-origin["lon"])*m_lon, (lat-origin["lat"])*m_lat),
        geom)
    a,b,c,d = road["clipMetres"]
    clip = box(a,b,c,d)
    road_triangles = [Polygon(record["v"]) for record in road["triangles"]]
    renderable = [p for p in road_triangles if p.area>1e-8]
    if len(road_triangles)!=577 or len(renderable)!=553:
        raise ValueError("Pinned 2022 official roadbed source changed")
    pavement = unary_union(renderable)
    invalid = []
    sidewalks = []
    for item in source["layers"]["sidewalk"]["features"]:
        geom = project(shape(item["geometry"]))
        if not geom.is_valid:
            invalid.append({"id":item["objectId"],"reason":explain_validity(geom)})
            # Diagnostic repair ONLY: original polygon remains unchanged in source.json.
            geom = make_valid(geom)
        sidewalks.append((item["objectId"], geom.intersection(clip)))
    clipped_sidewalks = unary_union([geom for _,geom in sidewalks])
    overlap = clipped_sidewalks.intersection(pavement)
    per_record = [
        {"id":fid,"overlapM2":round(geom.intersection(pavement).area,6)}
        for fid,geom in sidewalks
    ]
    per_record.sort(key=lambda r:-r["overlapM2"])
    audit_lines = {}
    for name in ("curb","curbCut"):
        entries = source["layers"][name]["features"]
        lines=[(entry["objectId"], project(shape(entry["geometry"])).intersection(clip),
                entry.get("subtype")) for entry in entries]
        total_length=sum(line.length for _,line,_ in lines)
        near_length=sum(line.intersection(pavement.boundary.buffer(1.0)).length
                        for _,line,_ in lines)
        audit_lines[name]={
            "sourceFeatures":len(entries),
            "lengthWithinRoadClipM":round(total_length,6),
            "lengthNearOfficialRoadEdgeWithin1mM":round(near_length,6),
            "nearEdgeFraction":round(near_length/total_length,6) if total_length else None,
            "sourceSubtypes":dict(Counter(str(code) for _,_,code in lines))
        }
    sidewalk_overlap=overlap.area
    report = {
        "schema":"patrol-dumbo-front-dock-oti-road-sidewalk-2d-topology-v1",
        "sourceVintage":2022,
        "readOnly":True,
        "road":{"sourceTriangles":len(road_triangles),
                "nondegenerateTriangles":len(renderable),
                "areaSummedTriangleM2":round(sum(p.area for p in renderable),6),
                "unionPavementAreaM2":round(pavement.area,6)},
        "sidewalk":{"features":len(sidewalks),"originalGeometryInvalid":invalid,
                    "sourceAreaInsideRoadClipM2":round(clipped_sidewalks.area,6),
                    "sidewalkRoadbedOverlapM2":round(sidewalk_overlap,6),
                    "principalOverlapSourceFids":per_record[:8]},
        "edges":audit_lines,
        "topologyReleaseGate":"BLOCKED_UNRESOLVED_SOURCE_OVERLAP" if
                sidewalk_overlap>.1 or invalid else "SOURCE_ONLY_NOT_APPROVED_FOR_GAMEPLAY",
        "caveats":[
            "2022 ROADBED and SIDEWALK polygons have conflicting boundaries. Preserve source IDs; do not delete or move vertices to hide overlap.",
            "Unions can differ from summed source triangle area due overlapping pavement features.",
            "This is a 2D planimetric audit only, not verified curb heights, accessibility slopes, collision, 2026 as-built or native GPU FPS.",
            "No geometry exported as game meshes, no arbitrary source rounding or automatic topology repairs."
        ]
    }
    return report

def main():
    source=json.loads((OUTPUT/"source.json").read_text())
    road=json.loads(ROAD_PATH.read_text())
    result=audit(source,road)
    (OUTPUT/"topology-audit.json").write_text(json.dumps(result,indent=2))
    print("DUMBO_OTI_PEDESTRIAN_TOPOLOGY "+json.dumps(result))
if __name__=="__main__":
    try: main()
    except Exception as exc:
        print("DUMBO_TOPOLOGY_SOURCE_ERROR",str(exc),file=sys.stderr)
        sys.exit(1)
