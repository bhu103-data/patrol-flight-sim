#!/usr/bin/env python3
"""Extract only genuine cached 2014 BK02 Rhino roof/facade/footprint meshes
inside the 48-building DUMBO OTI source AOI. Original Z remains unverified.
"""
from __future__ import annotations
import collections,hashlib,json,math,pathlib,sys
import rhino3dm
HERE=pathlib.Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
from official_bk02_projection import (
    stateplane_to_dumbo_metres,dumbo_metres_to_stateplane,
    source_bounds_from_oti,US_SURVEY_FOOT_IN_METRES)

ROOT=pathlib.Path(__file__).resolve().parents[2]
FOLDER=pathlib.Path("artifacts/nyc-official-bk02")
SOURCE=FOLDER/"bk02-source.3dm"
PROBE=FOLDER/"bk02-probe.json"
OTI=ROOT/"assets/nyc/dumbo-oti-metric-48.json"
REPORT=FOLDER/"dumbo-2014-source-roi.json"
MESH_OUT=FOLDER/"dumbo-2014-source-mesh.json"
PAD_METRES=25.0
MAX_PATCHES=20000
MAX_SOURCE_TRIANGLES=350000
MAX_SOURCE_VERTICES=500000
MAX_VERTICES_PER_PATCH=16000
MAX_FACES_PER_PATCH=24000

def source_roi():
    a,b,c,d=source_bounds_from_oti(OTI)
    bounds=(a-PAD_METRES,b-PAD_METRES,c+PAD_METRES,d+PAD_METRES)
    corners=[dumbo_metres_to_stateplane(x,z)
      for x in (bounds[0],bounds[2]) for z in (bounds[1],bounds[3])]
    return bounds,(min(p[0] for p in corners),min(p[1] for p in corners),
                   max(p[0] for p in corners),max(p[1] for p in corners))

def face_mesh_record(mesh,bbox,source_uuid,face_index,kind,layer_name):
    if mesh is None:return None
    count=len(mesh.Vertices);nfaces=len(mesh.Faces)
    if count<3 or nfaces<1 or count>MAX_VERTICES_PER_PATCH or nfaces>MAX_FACES_PER_PATCH:
        raise ValueError("Unexpected BK02 source cached mesh complexity")
    vertices=[]
    raw_bounds=[math.inf,math.inf,math.inf,-math.inf,-math.inf,-math.inf]
    for v in mesh.Vertices:
        x,y,z=float(v.X),float(v.Y),float(v.Z)
        if not all(math.isfinite(t) for t in (x,y,z)):
            raise ValueError("Non-finite original BK02 mesh vertex")
        raw_bounds=[min(raw_bounds[0],x),min(raw_bounds[1],y),min(raw_bounds[2],z),
                    max(raw_bounds[3],x),max(raw_bounds[4],y),max(raw_bounds[5],z)]
        east,south=stateplane_to_dumbo_metres(x,y)
        vertices.extend([round(east,4),round(south,4),round(z,4)])
    triangles=[];degenerate=0
    for face in mesh.Faces:
        if isinstance(face,(tuple,list)):idx=[int(v) for v in face]
        else:idx=[int(getattr(face,k)) for k in ("A","B","C","D")]
        if len(idx)==3:a,b,c=idx;d=c
        elif len(idx)==4:a,b,c,d=idx
        else:raise ValueError("Unsupported original Rhino face index arity")
        for tri in ((a,b,c),) if d==c else ((a,b,c),(a,c,d)):
            if min(tri)<0 or max(tri)>=count:
                raise ValueError("Original Rhino mesh index outside vertex pool")
            p=[vertices[tri[0]*3:tri[0]*3+3],
               vertices[tri[1]*3:tri[1]*3+3],
               vertices[tri[2]*3:tri[2]*3+3]]
            u=[p[1][k]-p[0][k] for k in range(3)]
            v=[p[2][k]-p[0][k] for k in range(3)]
            cross=(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],
                   u[0]*v[1]-u[1]*v[0])
            if math.sqrt(sum(t*t for t in cross))<1e-6:
                degenerate+=1;continue
            triangles.extend(tri)
    if not triangles:return None
    # Cached display meshes must remain inside their original Brep bounds.
    for k,(lo,hi) in enumerate(((bbox.Min.X,bbox.Max.X),
                                (bbox.Min.Y,bbox.Max.Y),
                                (bbox.Min.Z,bbox.Max.Z))):
        if raw_bounds[k]<lo-1.0 or raw_bounds[k+3]>hi+1.0:
            raise ValueError("Cached mesh escaped original Rhino Brep bounds")
    return {"kind":kind,"layer":layer_name,"sourceObjectUUID":source_uuid,
      "brepFaceIndex":face_index,"vertices":vertices,"triangles":triangles,
      "vertexCount":count,"triangleCount":len(triangles)//3,
      "degenerateSourceTrianglesRejected":degenerate,
      "sourceBoundsUSSurveyFeet":[round(v,3) for v in raw_bounds]}

def inspect():
    bounds_m,bounds_ft=source_roi()
    report={"source":"NYC DCP 2014 3D Model by Community District — BK02",
      "sourceArea":"DUMBO / Brooklyn Heights / Downtown Brooklyn community district",
      "sourceCRS":"EPSG:2263 NAD83 Long Island, US survey feet XY",
      "viewerCRS":"WGS84 local DUMBO east/south metres",
      "originWGS84":[-73.989,40.702],"rootMetreBounds":bounds_m,
      "sourceFootBounds":bounds_ft,"sourceVerticalDatumVerified":False,
      "sourceZInterpretation":"RAW_2014_RHINO_Z_UNVERIFIED_VERTICAL_DATUM",
      "sourceMeshMeaning":"Original Rhino cached display tessellation; not exact Brep trim topology",
      "meshAccepted":False,"layerStats":{},"sourceMeshStats":{},"errors":[]}
    try:
        previous=json.loads(PROBE.read_text())
        if previous.get("imported") is not True:
            raise ValueError("Official BK02 source probe did not pass")
        if hashlib.sha256(SOURCE.read_bytes()).hexdigest()!=previous.get("source3dmSha256"):
            raise ValueError("BK02 3DM bytes differ from exact source-probe SHA")
        model=rhino3dm.File3dm.Read(str(SOURCE))
        if model is None:raise ValueError("rhino3dm could not reload official BK02 3DM")
        report["sourceZipSha256"]=previous.get("zipSha256")
        report["source3dmSha256"]=previous.get("source3dmSha256")
        report["source3dmBytes"]=previous.get("selected3dm",{}).get("uncompressedBytes")
        report["modelUnitSystem"]=previous.get("modelUnitSystem")
        report["readerVersion"]=previous.get("readerVersion")
        layer_names={i:str(x.FullPath or x.Name) for i,x in enumerate(model.Layers)}
        layer_kind={}
        for i,name in layer_names.items():
            if "RoofTop Surface" in name:layer_kind[i]="roof"
            elif "Facade Surface" in name:layer_kind[i]="facade"
            elif "Foot Print Surface" in name or "FootPrint Surface" in name:
                layer_kind[i]="footprint"
        if not {"roof","facade"}.issubset(set(layer_kind.values())):
            raise ValueError("Official BK02 roof/facade surface layers are missing")
        report["surfaceLayers"]={k:[layer_names[i] for i,v in layer_kind.items() if v==k]
                                 for k in ("roof","facade","footprint")}
        counters=collections.Counter();patches=[]
        totals={"roof":0,"facade":0,"footprint":0}
        source_triangles=0;source_vertices=0;z_min=math.inf;z_max=-math.inf
        for obj_index,obj in enumerate(model.Objects):
            if obj_index>=500000:raise ValueError("BK02 object scan exceeds safety cap")
            idx=obj.Attributes.LayerIndex
            if idx not in layer_kind:continue
            kind=layer_kind[idx];counters[kind+"Total"]+=1
            geom=obj.Geometry
            if not hasattr(geom,"GetBoundingBox"):
                counters[kind+"MissingBounds"]+=1;continue
            bbox=geom.GetBoundingBox()
            if bbox is None:
                counters[kind+"MissingBounds"]+=1;continue
            a,b=bbox.Min,bbox.Max
            if b.X<bounds_ft[0] or a.X>bounds_ft[2] or b.Y<bounds_ft[1] or a.Y>bounds_ft[3]:
                continue
            counters[kind+"InsideROI"]+=1
            if not hasattr(geom,"Faces"):continue
            for face_index,face in enumerate(geom.Faces):
                try:
                    cached=face.GetMesh(rhino3dm.MeshType.Any)
                    patch=face_mesh_record(cached,bbox,str(obj.Attributes.Id),
                                           face_index,kind,layer_names[idx])
                    if patch is None:
                        counters[kind+"CachedMeshMissing"]+=1;continue
                    source_triangles+=patch["triangleCount"]
                    source_vertices+=patch["vertexCount"]
                    if source_triangles>MAX_SOURCE_TRIANGLES or source_vertices>MAX_SOURCE_VERTICES:
                        raise ValueError("BK02 source mesh exceeds bounded WebGL preview budget")
                    z_min=min(z_min,patch["sourceBoundsUSSurveyFeet"][2])
                    z_max=max(z_max,patch["sourceBoundsUSSurveyFeet"][5])
                    patches.append(patch);totals[kind]+=1
                    counters[kind+"CachedMeshFacesAccepted"]+=1
                    if len(patches)>MAX_PATCHES:
                        raise ValueError("BK02 source ROI contains too many mesh patches")
                except ValueError:raise
                except Exception as err:
                    counters[kind+"MeshExtractionExceptions"]+=1
                    if counters[kind+"MeshExtractionExceptions"]<=4:
                        report["errors"].append(f"{kind} Rhino face {face_index}: {type(err).__name__}: {err}")
        report["scannedSourceObjects"]=len(model.Objects)
        report["layerStats"]=dict(counters)
        report["sourceMeshStats"]={"roofPatches":totals["roof"],
          "facadePatches":totals["facade"],"footprintPatches":totals["footprint"],
          "triangles":source_triangles,"vertices":source_vertices,
          "rawSourceZFeetRange":[z_min,z_max] if math.isfinite(z_min) else None,
          "degenerateSourceTrianglesRejected":sum(p["degenerateSourceTrianglesRejected"] for p in patches)}
        report["readyForBoundedPreview"]=(totals["roof"]>10 and totals["facade"]>50 and
          source_triangles>500 and source_vertices>500 and math.isfinite(z_min) and z_max>z_min)
        if report["readyForBoundedPreview"]:
            MESH_OUT.write_text(json.dumps({
              "schema":"patrol-nyc-dumbo-bk02-2014-cached-roof-facade-mesh-v1",
              "role":"ISOLATED_2014_DCP_SOURCE_MESH_PREVIEW_NOT_2026_PATROL_GAME",
              "sourceZipSha256":previous.get("zipSha256"),
              "source3dmSha256":previous.get("source3dmSha256"),
              "sourceCRS":"EPSG:2263 (US survey feet XY; raw Z datum unverified)",
              "viewerCRS":"DUMBO local east/south metres",
              "originWGS84":[-73.989,40.702],"boundsMeters":bounds_m,
              "rawSourceZFeetRange":[z_min,z_max],
              "verticalDatumVerified":False,"meshPatches":patches,
              "counts":report["sourceMeshStats"]
            },separators=(",",":")))
            report["meshAccepted"]=True
        report["sourceModelObjects"]=len(model.Objects)
    except Exception as err:
        report["errors"].append(f"{type(err).__name__}: {err}")
    finally:
        SOURCE.unlink(missing_ok=True)
        if not report["meshAccepted"]:MESH_OUT.unlink(missing_ok=True)
        REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2))
        print(json.dumps(report,ensure_ascii=False,indent=2))
    if report["errors"] or report["layerStats"].get("roofInsideROI",0)==0 or report["layerStats"].get("facadeInsideROI",0)==0:
        raise SystemExit(1)
    if not report["readyForBoundedPreview"]:
        raise SystemExit(2)

if __name__=="__main__":inspect()
