#!/usr/bin/env python3
"""Extract original NYC DCP 2014 saved facade-face meshes for bounded QA.

Only Rhino BrepFace.GetMesh(MeshType.Any) cached faces are used. Vertical
triangles are preserved even though their XY projection has zero area. Each
facade object is matched to one 2022 footprint by projected wall-boundary
overlap; shared party walls and ambiguous matches are rejected. Relative 2014
Z is converted only after the 3DM declares Feet, then anchored to the matched
2022 HEIGHTROOF. The 2014 absolute vertical datum is not asserted.
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
from shapely.geometry import Polygon

HERE=pathlib.Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
from official_mn05_projection import mn05_stateplane_to_metric, ORIGIN_WGS84
from inspect_mn05_support import (
    require_feet_model_unit, anchored_source_height_metres,
    MODEL_FOOT_IN_METRES)
from inspect_mn05_facade_support import (
    face_from_cached_facade_mesh, match_facade_to_building)

DIR=pathlib.Path("artifacts/nyc-official-mn05")
SOURCE=DIR/"mn05-source.3dm"
PROBE=DIR/"mn05-probe.json"
ROOF=DIR/"mn05-cached-roof-metric-preview.json"
OUTPUT=DIR/"mn05-cached-facade-metric-preview.json"
BOUND=(-315.0,-175.0,380.0,530.0)
ZIP_SHA="71e6242c55ca7069f67c0bfd8e6d4764c9e6020a361e6bfa77880effe7520bf2"
MODEL_SHA="b41afdad1243d12858f7f446325af30667175b1eb36e9689304a4299f1c0df57"
MAX_OBJECTS=5000
MAX_TRIANGLES=60000
BOUNDARY_TOLERANCE_METRES=1.5


def official_buildings():
    data=json.loads(pathlib.Path("assets/nyc/times-square-footprints.json").read_text())
    result=[]
    for row in data["features"]:
        if len(row.get("rings",[]))!=1 or row.get("heightFt",0)<=0:
            continue
        ring=row["rings"][0]
        if len(ring)<4:
            continue
        p=Polygon([mn05_stateplane_to_metric(*xy[:2]) for xy in ring])
        if not p.is_valid or p.area<2:
            continue
        result.append({"fid":row["fid"],"heightMetres":row["heightFt"]*.3048,
                       "geometry":p})
    if len(result)<100:
        raise RuntimeError("Official 2022 footprint source missing valid records")
    return result


def source_roof_anchors(roof):
    """Use plausible matched roof source Z tops; reject impossible FID ranges."""
    heights={int(x["fid"]):float(x["heightMetres"]) for x in roof["matchedFids"]}
    grouped=collections.defaultdict(list)
    for tri in roof["triangles"]:
        grouped[int(tri["matched2022BuildingFid"])].extend(
            float(z) for z in tri["sourceRawZFt"])
    refs,metrics,rejected={},{},{}
    for fid,values in grouped.items():
        if fid not in heights or not values or not all(math.isfinite(z) for z in values):
            rejected[str(fid)]="missing-roof-height-or-invalid-z";continue
        top,bottom=max(values),min(values)
        relief=(top-bottom)*MODEL_FOOT_IN_METRES
        metrics[fid]={"sourceTopZFeet":top,"sourceBottomZFeet":bottom,
            "relativeReliefMetres":relief,"current2022RoofHeightMetres":heights[fid]}
        if relief>heights[fid]+2:
            rejected[str(fid)]="2014-roof-relief-exceeds-2022-building-height";continue
        refs[fid]={"topZFeet":top,"heightMetres":heights[fid]}
    return refs,metrics,rejected


def source_facade_objects(model):
    layers={i:str(layer.FullPath or layer.Name) for i,layer in enumerate(model.Layers)}
    facade_layers={i for i,name in layers.items() if "Facade Surface" in name}
    if not facade_layers:
        raise RuntimeError("Original NYC DCP MN05 Facade Surface layer missing")
    accepted=[]
    rejected=collections.Counter()
    candidates=0
    for index,obj in enumerate(model.Objects):
        if obj.Attributes.LayerIndex not in facade_layers:
            continue
        geom=obj.Geometry
        if not hasattr(geom,"Faces"):
            rejected["notBrepFacadeSurface"]+=1;continue
        try:
            bbox=geom.GetBoundingBox()
            a,b=bbox.Min,bbox.Max
            e,n=mn05_stateplane_to_metric((a.X+b.X)*.5,(a.Y+b.Y)*.5)
        except Exception:
            rejected["invalidFacadeBounds"]+=1;continue
        if not (BOUND[0]<=e<=BOUND[2] and BOUND[1]<=n<=BOUND[3]):
            continue
        candidates+=1
        if candidates>MAX_OBJECTS:
            raise RuntimeError("Bounded facade candidate count exceeds explicit object budget")
        triangles=[]
        cached_faces=0
        for face in geom.Faces:
            try:
                cached=face.GetMesh(rhino3dm.MeshType.Any)
            except Exception:
                rejected["cachedFacadeMeshApiUnavailable"]+=1;continue
            if cached is None or len(cached.Faces)<1:
                rejected["facadeFaceHasNoSavedMesh"]+=1;continue
            cached_faces+=len(cached.Faces)
            triangles.extend(face_from_cached_facade_mesh(
                cached,mn05_stateplane_to_metric))
        if not triangles:
            rejected["noUsableSavedFacadeTriangles"]+=1;continue
        accepted.append({"sourceObjectIndex":index,
            "sourceUuid":str(obj.Attributes.Id),
            "centerMetres":[e,n],"triangles":triangles,
            "savedMeshFaces":cached_faces})
    return accepted,rejected,candidates


def main():
    report={"schema":"nyc-mn05-2014-saved-brep-facade-triangles-v1",
        "assetRole":"2014_HISTORICAL_SOURCE_ONLY_NOT_GAME_COLLISION",
        "source":"NYC DCP MN05 2014 official 3-D Rhino model",
        "sourceUrl":"https://data.cityofnewyork.us/d/u5j4-zxpn",
        "sourceRhinoSha256":MODEL_SHA,"sourceZipSha256":ZIP_SHA,
        "horizontalCrs":"EPSG:2263 US survey feet projected to 2022 PATROL local WGS84 metres",
        "sourceModelUnitSystem":None,"sourceVerticalUnitVerified":False,
        "sourceVerticalDatumVerified":False,"sourceZReliefPreserved":False,
        "localOriginLonLat":list(ORIGIN_WGS84),
        "modelIs2026Survey":False,
        "verticalPlacement":"2014 relative Z in verified Rhino Feet, highest matched roof point anchored to 2022 HEIGHTROOF; absolute datum unknown",
        "matching":"XY projection of cached facade mesh against one 2022 footprint boundary; shared/ambiguous party walls rejected",
        "meshAccepted":False,"errors":[]}
    try:
        previous=json.loads(PROBE.read_text())
        if not previous.get("imported") or previous.get("sha256")!=ZIP_SHA or previous.get("source3dmSha256")!=MODEL_SHA:
            raise RuntimeError("MN05 official source SHA/provenance mismatch")
        if hashlib.sha256(SOURCE.read_bytes()).hexdigest()!=MODEL_SHA:
            raise RuntimeError("Original MN05 source file hash mismatch")
        roof=json.loads(ROOF.read_text())
        if not roof.get("meshAccepted") or not roof.get("sourceZReliefPreserved"):
            raise RuntimeError("Validated source roof geometry and vertical unit check required first")
        model=rhino3dm.File3dm.Read(str(SOURCE))
        if model is None:
            raise RuntimeError("Municipal 2014 Brep source cannot be opened")
        unit=require_feet_model_unit(model.Settings)
        report["sourceModelUnitSystem"]=unit
        report["sourceVerticalUnitVerified"]=True
        buildings=official_buildings()
        roof_refs,roof_metrics,roof_rejects=source_roof_anchors(roof)
        report["roofAnchorFids"]=len(roof_refs)
        report["roofAnchorRejectedFids"]=roof_rejects
        candidates,rejected,candidate_count=source_facade_objects(model)
        report["sourceFacadeObjectsInBoundedSample"]=candidate_count
        report["sourceFacadeExtractionRejected"]=dict(rejected)
        output=[]
        matched_objects=collections.Counter()
        rejected_match=collections.Counter()
        for row in candidates:
            match=match_facade_to_building(row["triangles"],buildings,
                tolerance_metres=BOUNDARY_TOLERANCE_METRES)
            if match is None:
                rejected_match["no-unique-footprint-boundary-match"]+=1
                continue
            fid=int(match["matchedFid"])
            anchor=roof_refs.get(fid)
            if anchor is None:
                rejected_match["no-plausible-matched-roof-anchor"]+=1
                continue
            try:
                converted=[]
                for tri in row["triangles"]:
                    converted.append([[round(p[0],4),round(p[1],4),
                        round(anchored_source_height_metres(
                            p[2],anchor["topZFeet"],anchor["heightMetres"],
                            source_vertical_unit_verified=True),4)] for p in tri])
            except ValueError:
                rejected_match["facade-z-outside-current-building-height"]+=1
                continue
            matched_objects[fid]+=1
            for tri,converted_tri in zip(row["triangles"],converted):
                output.append({"sourceUuid":row["sourceUuid"],
                    "matched2022BuildingFid":fid,
                    "matchCoverage":round(match["matchCoverage"],5),
                    "boundaryDistanceMetres":round(match["boundaryDistanceMetres"],4),
                    "sourceRawZFt":[round(p[2],4) for p in tri],
                    "vertices":converted_tri})
            if len(output)>MAX_TRIANGLES:
                raise RuntimeError("Matched facade triangle count exceeds explicit budget")
        fids=sorted(matched_objects)
        if len(fids)<3 or len(output)<50:
            raise RuntimeError("Too few unambiguous real facade meshes matched to 2022 FIDs: "+
                json.dumps({"matchedFids":len(fids),"triangles":len(output),
                            "objects":sum(matched_objects.values()),
                            "rejected":dict(rejected_match)}))
        z_offsets=[(p[2]-roof_refs[int(t["matched2022BuildingFid"])]["topZFeet"])*MODEL_FOOT_IN_METRES
            for t in output for p in [
                [v[0],v[1],z] for v,z in zip(t["vertices"],t["sourceRawZFt"])]]
        report["counts"]={"candidateFacadeObjects":candidate_count,
            "matchedFacadeObjects":sum(matched_objects.values()),
            "matched2022Fids":len(fids),
            "genuineSavedSourceTriangles":len(output),
            "roofAnchorFids":len(roof_refs)}
        report["sourceFacadeMatchesRejected"]=dict(rejected_match)
        report["sourceRelativeZOffsetRangeMetres"]=[
            round(min(z_offsets),3),round(max(z_offsets),3)] if z_offsets else [0,0]
        report["matchedFids"]=fids
        report["triangles"]=output
        report["sourceZReliefPreserved"]=True
        report["meshAccepted"]=True
    except Exception as error:
        report["errors"].append(type(error).__name__+": "+str(error))
    finally:
        SOURCE.unlink(missing_ok=True)
        OUTPUT.write_text(json.dumps(report,ensure_ascii=False,separators=(",",":")))
        print("NYC real cached source facade mesh",
            json.dumps({k:v for k,v in report.items() if k!="triangles"},ensure_ascii=False))
    if not report["meshAccepted"] or report["errors"]:
        raise SystemExit(1)


if __name__=="__main__":
    main()
