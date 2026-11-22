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
import os
import pathlib
import sys

import rhino3dm

HERE=pathlib.Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
from official_mn05_projection import (
    metric_to_mn05_stateplane,mn05_stateplane_to_metric,
    US_SURVEY_FOOT_IN_METRES)

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


def edge_points_from_trim(trim):
    """Read a genuine source Brep edge in its original 3-D geometry.

    A straight edge may be expressed as a LineCurve or a linear NurbsCurve;
    no sampled/approximated NURBS curves are used here.
    """
    edge=getattr(trim,"Edge",None)
    if callable(edge):edge=edge()
    if edge is None:return None
    points=None
    try:
        valid,poly=edge.TryGetPolyline()
        if valid and poly is not None:
            points=[[float(p.X),float(p.Y),float(p.Z)] for p in poly]
    except Exception:
        pass
    if not points:
        try:
            if edge.IsLinear(0.000001):
                a,b=edge.PointAtStart,edge.PointAtEnd
                points=[[float(p.X),float(p.Y),float(p.Z)] for p in (a,b)]
        except Exception:
            pass
    if not points or len(points)>1024 or len(points)<2:return None
    if any(not all(math.isfinite(v) for v in p) for p in points):return None
    return points


def source_trim_loop_points(loop):
    """Stitch actual source Trim.Edge curves in topological order only.

    Match edge endpoints within 0.05 US survey feet. Never replace a
    concavity, unknown hole or curve with a convex hull or bbox rectangle.
    """
    try:
        trims=list(loop.Trims)
        if not trims or len(trims)>1024:return None
    except Exception:
        return None
    chain=[]
    for trim in trims:
        segment=edge_points_from_trim(trim)
        if segment is None:return None
        if not chain:
            chain.extend(segment)
        elif math.dist(chain[-1],segment[0])<0.05:
            chain.extend(segment[1:])
        elif math.dist(chain[-1],segment[-1])<0.05:
            chain.extend(segment[-2::-1])
        else:
            return None
        if len(chain)>1024:return None
    if len(chain)<4 or math.dist(chain[0],chain[-1])>0.05:return None
    if any(not all(math.isfinite(v) for v in p) for p in chain):return None
    return chain


MESH_OUT=FOLDER/"times-square-original-roof-mesh.json"
MAX_SOURCE_ROOFS=2500
MAX_SOURCE_TRIANGLES=150000
MAX_SOURCE_VERTICES=250000

def original_cached_face_mesh(mesh,bbox,roof_id,brep_face_index):
    """Transform only real Rhino-cached tessellation, retaining source face IDs.

    The cached Rhino render mesh approximates a Brep: the source provided its
    vertices and faces. These are NOT new procedural roof shapes. Its z is
    preserved in raw 2014 StatePlane-model foot units until vertical datum is
    independently certified. Never add these z values to a 2022 ground y=0.
    """
    if mesh is None:return None
    count=len(mesh.Vertices)
    nfaces=len(mesh.Faces)
    if count<3 or nfaces<1 or count>12000 or nfaces>20000:
        raise ValueError("Unexpected official MN05 cached roof mesh complexity")
    points=[]
    source_bounds=[math.inf,math.inf,math.inf,-math.inf,-math.inf,-math.inf]
    for v in mesh.Vertices:
        x,y,z=float(v.X),float(v.Y),float(v.Z)
        if not all(math.isfinite(t) for t in (x,y,z)):
            raise ValueError("Non-finite official roof mesh vertex")
        source_bounds=[
            min(source_bounds[0],x),min(source_bounds[1],y),min(source_bounds[2],z),
            max(source_bounds[3],x),max(source_bounds[4],y),max(source_bounds[5],z)]
        east,north=mn05_stateplane_to_metric(x,y)
        points.append([round(east,4),round(north,4),round(z,4)])
    raw_indices=[]
    invalid_faces=0
    for face in mesh.Faces:
        # rhino3dm Python MeshFace enumeration exposes raw index *tuples*
        # in 8.35, whereas some bindings expose A/B/C/D properties.
        # This is actual source topology; never fabricate face indices.
        if isinstance(face,(tuple,list)):
            indexes=[int(k) for k in face]
        else:
            indexes=[int(getattr(face,key)) for key in ("A","B","C","D")]
        if len(indexes)==3:
            a,b,c=indexes;d=c
        elif len(indexes)==4:
            a,b,c,d=indexes
        else:
            raise ValueError("Unexpected original 2014 Rhino mesh face arity")
        source_triangles=[(a,b,c)]
        if d!=c:source_triangles.append((a,c,d))
        for triplet in source_triangles:
            if min(triplet)<0 or max(triplet)>=count:
                raise ValueError("Original Rhino source face index outside vertex pool")
            p,q,r=[[points[i][0],points[i][1],
                     points[i][2]*US_SURVEY_FOOT_IN_METRES] for i in triplet]
            u=[q[j]-p[j] for j in range(3)]
            v=[r[j]-p[j] for j in range(3)]
            cross=(u[1]*v[2]-u[2]*v[1],
                   u[2]*v[0]-u[0]*v[2],
                   u[0]*v[1]-u[1]*v[0])
            if math.hypot(*cross)<1e-5:
                invalid_faces+=1
                continue
            raw_indices.extend(triplet)
    if not raw_indices:return None
    for j in range(3):
        if source_bounds[j] < (bbox.Min.X,bbox.Min.Y,bbox.Min.Z)[j]-1.0 or (
            source_bounds[j+3] > (bbox.Max.X,bbox.Max.Y,bbox.Max.Z)[j]+1.0):
            raise ValueError("Cached Rhino source mesh exceeds its Brep source bounds")
    return {
        "sourceObjectUUID":roof_id,
        "brepFaceIndex":brep_face_index,
        "vertices":[t for p in points for t in p],
        "sourceTriangles":raw_indices,
        "vertexCount":len(points),
        "triangleCount":len(raw_indices)//3,
        "degenerateSourceTrianglesRejected":invalid_faces,
        "sourceFootBounds":[round(x,3) for x in source_bounds],
    }



def inspect():
    report={"source":"NYC DCP official 2014 Manhattan MN05, 2018 archive",
       "sourceEPSG":"EPSG:2263 NY Long Island NAD83 US survey ft",
       "role":"3D_SOURCE_ROOF_BREP_QA_ONLY_NO_2026_GAME_REPLACEMENT",
       "rootMetreBounds":BOUNDS_METRES,
       "sourceFootBounds":[MINX,MINY,MAXX,MAXY],
       "sourceVerticalDatumVerified":False,
       "meshAccepted":False,
       "roofSamples":[],"layerStats":{},"errors":[],
       "sourceMeshStats":{},"meshOutput":str(MESH_OUT),
       "sourceVerticalStatus":"UNKNOWN (raw 2014 Rhino Z retained in feet)",
       "sourceCachedMeshMeaning":"Rhino-authored cached display tessellation; not exact NURBS or 2026 surveyed roof"}
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
        source_roof_meshes=[]
        source_triangles=0
        source_vertices=0
        source_degenerate_triangles=0
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
            if len(source_roof_meshes)>=MAX_SOURCE_ROOFS:
                raise ValueError("Too many official 2014 source rooftop faces in pilot")
            if hasattr(geom,"Faces"):
                for j,face in enumerate(geom.Faces):
                    try:
                        cached=face.GetMesh(rhino3dm.MeshType.Any)
                        mesh_record=original_cached_face_mesh(
                            cached,bbox,str(obj.Attributes.Id),j)
                        if mesh_record is None:
                            counter["roofCachedMeshMissing"]+=1
                            continue
                        source_triangles+=mesh_record["triangleCount"]
                        source_vertices+=mesh_record["vertexCount"]
                        source_degenerate_triangles+=mesh_record["degenerateSourceTrianglesRejected"]
                        if source_triangles>MAX_SOURCE_TRIANGLES or source_vertices>MAX_SOURCE_VERTICES:
                            raise ValueError("True source roof tessellation exceeds bounded WebGL source mesh budget")
                        source_roof_meshes.append(mesh_record)
                        counter["roofCachedMeshFacesAccepted"]+=1
                    except ValueError:
                        raise
                    except Exception as err:
                        counter["roofCachedMeshExtractionExceptions"]+=1
                        if counter["roofCachedMeshExtractionExceptions"]<=4:
                            report["errors"].append(
                                f"Cached Rhino roof mesh extraction: {type(err).__name__}: {err}")
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
                    try:
                        cached=face.GetMesh(rhino3dm.MeshType.Any)
                        entry["cachedSourceMeshFaces"]=len(cached.Faces) if cached else 0
                        entry["cachedSourceMeshVertices"]=len(cached.Vertices) if cached else 0
                    except Exception as err:
                        entry["sourceMeshLookupError"]=str(err)[:160]
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
                                if p is None:p=source_trim_loop_points(loop)
                                part["trimCount"]=getattr(loop,"TrimCount",None)
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
        report["exactPolylineTrimBoundaryDetected"]=any(
            any(boundary.get("isExactSourcePolyline") for face in entry.get("faces",[])
                for boundary in face.get("boundaries",[]))
            for entry in admitted)
        report["sourceMeshStats"]={
            "cachedSourceRooftopMeshPatches":len(source_roof_meshes),
            "actualSourceTriangles":source_triangles,
            "actualSourceVertices":source_vertices,
            "degenerateSourceTrianglesRejected":source_degenerate_triangles,
            "roiRoofBreps":counter["roofInsideROI"],
            "roiFacadeBreps":counter["facadeInsideROI"]}
        report["readyForBoundedMeshConversion"]=(
            len(source_roof_meshes)>50 and source_triangles>100
            and source_vertices>150 and counter["roofInsideROI"]>100)
        if report["readyForBoundedMeshConversion"]:
            MESH_OUT.write_text(json.dumps({
                "schema":"patrol-mn05-authentic-2014-cached-roof-mesh-qa-v1",
                "role":"ORIGINAL_2014_MUNICIPAL_ROOF_CACHED_MESH_NOT_2026_PATROL_GAME",
                "source3dmSHA256":previous["source3dmSha256"],
                "sourceCRS":"EPSG:2263 (US survey feet)",
                "viewerCRS":"WGS84 local east/north metres",
                "originLonLat":[-73.9864883,40.756421],
                "roofZInterpretation":"RAW_2014_RHINO_SOURCE_FOOT_UNKNOWN_VERTICAL_DATUM",
                "sourceRooftop3dMeshPatches":source_roof_meshes,
                "counts":report["sourceMeshStats"]
            },separators=(",",":")))
            report["meshAccepted"]=True
        report["scannedSourceObjects"]=len(model.Objects)
    except Exception as err:
        report["errors"].append(f"{type(err).__name__}: {err}")
    finally:
        # Keep the exact source 3DM only when a same-job downstream extractor
        # explicitly requests it. The workflow removes it before artifact upload.
        if os.environ.get("PATROL_KEEP_MN05") != "1":
            SOURCE.unlink(missing_ok=True)
        if not report["meshAccepted"]:
            MESH_OUT.unlink(missing_ok=True)
        OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2))
        print(json.dumps({k:v for k,v in report.items() if k!="roofSamples"},
                         ensure_ascii=False,indent=2))
    if report["errors"] or report["layerStats"].get("roofInsideROI",0)==0:
        raise SystemExit(1)
    if not report["readyForBoundedMeshConversion"]:
        # Genuine source cached roof meshes were not found within budget;
        # do not silently substitute a flat box or synthetic roof.
        raise SystemExit(2)


if __name__=="__main__":
    inspect()
