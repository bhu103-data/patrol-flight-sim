#!/usr/bin/env python3
"""Extract BAKED/CACHED meshes from authentic municipal MN05 Brep ROOF faces.

The 2014 official Rhino model already embeds render meshes for Brep faces.
This uses their *original saved triangles*, never tessellates an untrimmed
surface, builds a bbox roof, convex hull or fake NURBS trim. Match accepted
faces spatially against the separately sourced 2022 municipal FID footprint.
A newer HEIGHTROOF acts as a DISPLAY-ONLY visual anchor. No survey-grade
vertical datum or 2026 facade geometry is asserted.

Outputs only bounded source-derived JSON, never the 627 MB raw .3dm.
"""
from __future__ import annotations
import collections
import hashlib
import json
import math
import pathlib
import sys

import rhino3dm
from shapely.geometry import Polygon
from shapely.ops import unary_union

HERE=pathlib.Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
from official_mn05_projection import (
    mn05_stateplane_to_metric,
    ORIGIN_WGS84,
    METRES_PER_DEG_LATITUDE,
    METRES_PER_DEG_LONGITUDE,
    US_SURVEY_FOOT_IN_METRES)
from inspect_mn05_support import choose_matched_roof, face_from_cached_mesh

DIR=pathlib.Path("artifacts/nyc-official-mn05")
SOURCE=DIR/"mn05-source.3dm"
PROBE=DIR/"mn05-probe.json"
OUTPUT=DIR/"mn05-cached-roof-metric-preview.json"
# Exact identical square as #285. This bbox is *not* 2026 surveyed coverage.
BOUND=(-315.0,-175.0,380.0,530.0)
ZIP_SHA="71e6242c55ca7069f67c0bfd8e6d4764c9e6020a361e6bfa77880effe7520bf2"
MODEL_SHA="b41afdad1243d12858f7f446325af30667175b1eb36e9689304a4299f1c0df57"
MAX_OBJECTS=240
MAX_TRIANGLES=12000


def local_from_wgs(lon,lat):
    return ((lon-ORIGIN_WGS84[0])*METRES_PER_DEG_LONGITUDE,
            (lat-ORIGIN_WGS84[1])*METRES_PER_DEG_LATITUDE)


def official_buildings():
    data=json.loads(pathlib.Path("assets/nyc/times-square-footprints.json").read_text())
    result=[]
    for row in data["features"]:
        if len(row.get("rings",[]))!=1:
            continue
        ring=row["rings"][0]
        if len(ring)<4 or row.get("heightFt",0)<=0:
            continue
        p=Polygon([local_from_wgs(*xy[:2]) for xy in ring])
        if not p.is_valid or p.area<2:
            continue
        result.append({"fid":row["fid"],"heightMetres":row["heightFt"]*.3048,
                       "geometry":p})
    if len(result)<100:
        raise RuntimeError("Original municipal footprint source missing valid records")
    return result


def source_roof_objects(model):
    layers={i:str(layer.FullPath or layer.Name)
            for i,layer in enumerate(model.Layers)}
    roof_layers={i for i,name in layers.items() if "RoofTop Surface" in name}
    if not roof_layers:
        raise RuntimeError("No authentic NYC MN05 RoofTop Surface layer")
    accepted=[]
    rejected=collections.Counter()
    for index,obj in enumerate(model.Objects):
        if obj.Attributes.LayerIndex not in roof_layers:
            continue
        geom=obj.Geometry
        if not hasattr(geom,"Faces") or len(geom.Faces)!=1:
            rejected["notSingleSourceRoofFace"]+=1
            continue
        bbox=geom.GetBoundingBox()
        a,b=bbox.Min,bbox.Max
        try:
            x,z=mn05_stateplane_to_metric((a.X+b.X)*.5,(a.Y+b.Y)*.5)
        except Exception:
            rejected["invalidStatePlaneCoordinate"]+=1
            continue
        if not (BOUND[0]<=x<=BOUND[2] and BOUND[1]<=z<=BOUND[3]):
            continue
        face=geom.Faces[0]
        try:
            cached=face.GetMesh(rhino3dm.MeshType.Any)
        except Exception:
            rejected["cachedMeshAPIUnavailable"]+=1
            continue
        if cached is None or len(cached.Faces)<1 or len(cached.Faces)>2000:
            rejected["noSavedSourceMesh"]+=1
            continue
        try:
            tris=face_from_cached_mesh(cached,mn05_stateplane_to_metric)
        except (ValueError,TypeError) as e:
            rejected["invalidSavedTriangle:"+str(e)[:44]]+=1
            continue
        if not tris:
            rejected["allSourceTrianglesDegenerate"]+=1
            continue
        if len(tris)>MAX_TRIANGLES:
            rejected["objectAboveTriangleBudget"]+=1
            continue
        accepted.append({
            "sourceObjectIndex":index,
            "sourceUuid":str(obj.Attributes.Id),
            "centerMetres":[x,z],
            "rawZFootBounds":[float(a.Z),float(b.Z)],
            "triangles":tris,
            "savedMeshFaceCount":len(cached.Faces)
        })
    accepted.sort(key=lambda r:(r["centerMetres"][0]**2+
                             r["centerMetres"][1]**2,r["sourceUuid"]))
    return accepted[:MAX_OBJECTS],rejected


def main():
    report={"schema":"nyc-mn05-2014-saved-brep-roof-triangles-v1",
        "assetRole":"2014_HISTORICAL_SOURCE_ONLY_NOT_GAME_COLLISION",
        "source":"NYC DCP MN05 2014 official 3-D Rhino model",
        "sourceUrl":"https://data.cityofnewyork.us/d/u5j4-zxpn",
        "sourceRhinoSha256":MODEL_SHA,"sourceZipSha256":ZIP_SHA,
        "horizontalCrs":"EPSG:2263 US survey ft projected to 2022 PATROL local WGS84 metres",
        "localOriginLonLat":list(ORIGIN_WGS84),
        "sourceVerticalDatumVerified":False,
        "visualAnchor":"2022 municipal HEIGHTROOF only; 2014 relative Z is not rendered",
        "modelIs2026Survey":False,
        "matchRule":"source saved roof triangles >=0.60 area overlap within single 2022 FID",
        "sourceRooftopFacesRejected":{},"meshAccepted":False,"errors":[]}
    try:
        previous=json.loads(PROBE.read_text())
        if not previous.get("imported") or previous.get("sha256")!=ZIP_SHA or previous.get("source3dmSha256")!=MODEL_SHA:
            raise RuntimeError("MN05 official source SHA/provenance mismatch")
        if hashlib.sha256(SOURCE.read_bytes()).hexdigest()!=MODEL_SHA:
            raise RuntimeError("Original MN05 source file hash mismatch")
        model=rhino3dm.File3dm.Read(str(SOURCE))
        if model is None:
            raise RuntimeError("Municipal 2014 Brep source cannot be opened")
        buildings=official_buildings()
        candidates,skipped=source_roof_objects(model)
        report["originalRoofObjectsInBoundedSample"]=len(candidates)
        report["sourceRooftopFacesRejected"]=dict(skipped)
        selected=[]
        rejected_match=collections.Counter()
        for row in candidates:
            selected_row=choose_matched_roof(row,buildings)
            if selected_row is None:
                rejected_match["notOverlappingNewerSourceFootprint"]+=1
                continue
            selected.append(selected_row)
        report["sourceRoofMatchesRejected"]=dict(rejected_match)
        # Embed only matched source triangles. Genuine original Rhino
        # triangles in projected XY; 2022 HEIGHTROOF DISPLAY-ONLY Y anchor.
        result_tris=[]
        unique_fids=set()
        for row in selected:
            fid=row["matchedFid"]
            height=row["visualRoofHeightMetres"]
            unique_fids.add(fid)
            for tri in row["triangles"]:
                result_tris.append({
                    "sourceUuid":row["sourceUuid"],
                    "matched2022BuildingFid":fid,
                    "matchAreaRatio":round(row["matchAreaRatio"],5),
                    "sourceRawZFt":[round(p[2],4) for p in tri],
                    "vertices":[[round(p[0],4),round(p[1],4),round(height+.35,4)]
                                for p in tri]
                })
        if len(unique_fids)<3 or len(result_tris)<10 or len(result_tris)>MAX_TRIANGLES:
            raise RuntimeError("Source true-roof matches too few or oversized: "+
                               str({"fids":len(unique_fids),
                                    "triangles":len(result_tris)}))
        assert all(all(math.isfinite(v) for p in tri["vertices"] for v in p)
                   for tri in result_tris)
        report["counts"]={"candidateSourceRoofObjects":len(candidates),
            "matchedRoofObjects":len(selected),
            "matched2022Fids":len(unique_fids),
            "genuineSavedSourceTriangles":len(result_tris),
            "originalMunicipalBuildingFootprints":len(buildings)}
        report["sourceRoofZFootRange"]=[
            min(v for t in result_tris for v in t["sourceRawZFt"]),
            max(v for t in result_tris for v in t["sourceRawZFt"])]
        report["triangles"]=result_tris
        report["matchedFids"]=[
            {"fid":b["fid"],"heightMetres":round(b["heightMetres"],3),
             "outline":[[round(x,4),round(z,4)] for x,z in b["geometry"].exterior.coords]}
            for b in buildings if b["fid"] in unique_fids]
        report["meshAccepted"]=True
    except Exception as error:
        report["errors"].append(type(error).__name__+": "+str(error))
    finally:
        # No 627MB original model is uploaded or committed.
        SOURCE.unlink(missing_ok=True)
        OUTPUT.write_text(json.dumps(report,ensure_ascii=False,separators=(",",":")))
        print("NYC real cached source rooftop mesh",
              json.dumps({k:v for k,v in report.items()
                          if k not in ("triangles","matchedFids")},ensure_ascii=False))
    if not report["meshAccepted"] or report["errors"]:
        raise SystemExit(1)


if __name__=="__main__":
    main()
