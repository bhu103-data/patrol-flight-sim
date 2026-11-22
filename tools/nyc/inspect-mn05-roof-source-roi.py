#!/usr/bin/env python3
"""Inspect authentic 2014 municipal MN05 Brep rooftop and facade source in the
same measured WGS84 local frame used by PATROL's 118 FID / OTI roadbed pilot.

No arbitrary new roofs/boxes or 2026 claims. Collect ROOF source topology,
valid source face boundaries and matched local coordinates before rendering.
"""
from __future__ import annotations
import collections
import hashlib
import json
import math
import pathlib
import sys

import rhino3dm

HERE=pathlib.Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
from official_mn05_projection import (
    metric_to_mn05_stateplane,mn05_stateplane_to_metric)

FOLDER=pathlib.Path("artifacts/nyc-official-mn05")
SOURCE=FOLDER/"mn05-source.3dm"
STATS=FOLDER/"mn05-probe.json"
OUT=FOLDER/"times-square-roof-source-roi.json"
# This is the source pilot envelope plus ~15 m padding to avoid cutting true
# source roof faces. It is NOT a claim of an exact current 2026 city block.
BOUNDS_METRES=(-315.0,-175.0,380.0,530.0)
BOUND_SAMPLES=[
    metric_to_mn05_stateplane(x,z)
    for x in (BOUNDS_METRES[0],BOUNDS_METRES[2])
    for z in (BOUNDS_METRES[1],BOUNDS_METRES[3])
]
MINX=min(p[0] for p in BOUND_SAMPLES)
MINY=min(p[1] for p in BOUND_SAMPLES)
MAXX=max(p[0] for p in BOUND_SAMPLES)
MAXY=max(p[1] for p in BOUND_SAMPLES)


def coords_from_curve(curve):
    """Use only EXACT linear/polyline Rhino trim boundaries.

    No interpolated guesses for NURBS, holes or curving roof faces.
    These records are preserved as source QA, not filled into polygons yet.
    """
    if curve is None or not hasattr(curve,"TryGetPolyline"):return None
    try:
        valid,poly=curve.TryGetPolyline()
        if not valid or poly is None:return None
        points=[[float(p.X),float(p.Y),float(p.Z)] for p in poly]
        if len(points)<4 or len(points)>1024:return None
        if any(not all(math.isfinite(v) for v in p) for p in points):return None
        if math.dist(points[0],points[-1])>0.02:return None
        return points
    except Exception:
        return None


def inspect():
    report={"source":"NYC DCP official 2014 Manhattan MN05, 2018 archive",
       "sourceEPSG":"EPSG:2263 NY Long Island NAD83 US survey ft",
       "role":"3D_SOURCE_ROOF_BREP_QA_ONLY_NO_2026_GAME_REPLACEMENT",
       "rootMetreBounds":BOUNDS_METRES,
       "sourceFootBounds":[MINX,MINY,MAXX,MAXY],
       "sourceVerticalDatumVerified":False,
       "meshAccepted":False,
       "roofSamples":[],"layerStats":{},"errors":[]}
    try:
        previous=json.loads(STATS.read_text())
        if previous.get("imported") is not True:
            raise ValueError("Official previous source probe did not pass")
        # Pinned exact source obtained from NYC DCP official MN05 on 2026-11-22.
        # A future municipal update needs an independent metadata review;
        # never silently present newly changed bytes as the accepted 2014 model.
        if previous.get("sha256")!="71e6242c55ca7069f67c0bfd8e6d4764c9e6020a361e6bfa77880effe7520bf2":
            raise ValueError("Original MN05 official ZIP changed from vetted provenance SHA")
        if previous.get("source3dmSha256")!="b41afdad1243d12858f7f446325af30667175b1eb36e9689304a4299f1c0df57":
            raise ValueError("Original MN05 Rhino model differs from vetted SHA")
        if hashlib.sha256(SOURCE.read_bytes()).hexdigest()!=previous["source3dmSha256"]:
            raise ValueError("Original 2014 3DM source SHA changed before ROI inspection")
        model=rhino3dm.File3dm.Read(str(SOURCE))
        if model is None:raise ValueError("Original official MN05 Rhino 3DM unreadable")
        report["readerVersion"]=str(getattr(rhino3dm,"__version__","unknown"))
        layer_names={i:str(x.FullPath or x.Name) for i,x in enumerate(model.Layers)}
        roof_indices={i for i,name in layer_names.items() if "RoofTop Surface" in name}
        facade_indices={i for i,name in layer_names.items() if "Facade Surface" in name}
        if not roof_indices or not facade_indices:
            raise ValueError("Expected original NYC MN05 rooftop/facade surface layers absent")
        report["roofLayers"]=[layer_names[i] for i in sorted(roof_indices)]
        report["facadeLayers"]=[layer_names[i] for i in sorted(facade_indices)]
        counter=collections.Counter()
        admitted=[]
        for i,obj in enumerate(model.Objects):
            idx=obj.Attributes.LayerIndex
            if idx not in roof_indices and idx not in facade_indices:continue
            kind="roof" if idx in roof_indices else "facade"
            counter[kind+"Total"]+=1
            geom=obj.Geometry
            if not hasattr(geom,"GetBoundingBox"):
                counter[kind+"MissingBounding"]+=1;continue
            bbox=geom.GetBoundingBox()
            if bbox is None:
                counter[kind+"MissingBounding"]+=1;continue
            a,b=bbox.Min,bbox.Max
            if b.X<MINX or a.X>MAXX or b.Y<MINY or a.Y>MAXY:
                continue
            counter[kind+"InsideROI"]+=1
            if kind=="facade":continue
            if len(admitted)>=80:continue
            sourceBBox=[a.X,a.Y,a.Z,b.X,b.Y,b.Z]
            mid=[(a.X+b.X)*.5,(a.Y+b.Y)*.5]
            ex,nz=mn05_stateplane_to_metric(*mid)
            result={"sourceObjectIndex":i,"sourceObjectId":str(obj.Attributes.Id),
                "rawFootBBox":[round(x,3) for x in sourceBBox],
                "localMetreCenter":[round(ex,3),round(nz,3)],
                "geometryType":type(geom).__name__,
                "faceCount":len(geom.Faces) if hasattr(geom,"Faces") else None,
                "vertexCount":len(geom.Vertices) if hasattr(geom,"Vertices") else None}
            if hasattr(geom,"Faces"):
                faces=[]
                for j,face in enumerate(geom.Faces):
                    if j>=5:break
                    entry={"faceIndex":j,
                       "faceMethods":[x for x in dir(face)
                           if "Loop" in x or "Curve" in x or "Mesh" in x][:24]}
                    loops=getattr(face,"Loops",None)
                    if loops is not None:
                        try:
                            entry["loopCount"]=len(loops)
                            boundary=[]
                            for loop in list(loops)[:5]:
                                part={"type":str(getattr(loop,"LoopType","unknown")),
                                     "methods":[x for x in dir(loop)
                                         if "Curve" in x or "Trim" in x][:20]}
                                curve=loop.To3dCurve() if hasattr(loop,"To3dCurve") else None
                                p=coords_from_curve(curve)
                                part["isExactSourcePolyline"]=p is not None
                                if p is not None:
                                    part["points"]=p[:50]
                                    part["vertices"]=len(p)
                                boundary.append(part)
                            entry["boundaries"]=boundary
                        except Exception as err:
                            entry["loopError"]=f"{type(err).__name__}: {err}"
                    faces.append(entry)
                result["faces"]=faces
            admitted.append(result)
        report["layerStats"]=dict(counter)
        report["roofSamples"]=admitted
        report["readyForBoundedMeshConversion"]=counter["roofInsideROI"]>0 and any(
            any(boundary.get("isExactSourcePolyline") for face in entry.get("faces",[])
                for boundary in face.get("boundaries",[]))
            for entry in admitted)
        report["scannedSourceObjects"]=len(model.Objects)
    except Exception as err:
        report["errors"].append(f"{type(err).__name__}: {err}")
    finally:
        SOURCE.unlink(missing_ok=True)
        OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2))
        print(json.dumps({k:v for k,v in report.items() if k!="roofSamples"},
                         ensure_ascii=False,indent=2))
    if report["errors"] or report["layerStats"].get("roofInsideROI",0)==0:
        raise SystemExit(1)
    if not report["readyForBoundedMeshConversion"]:
        # Explicitly unresolved: no valid polygon boundary yet. This is a
        # negative result for mesh acceptance, not license to fabricate.
        raise SystemExit(2)


if __name__=="__main__":
    inspect()
