#!/usr/bin/env python3
"""Package matched original NYC DCP 2014 MN05 saved meshes for the opt-in 1:1 viewer.

Only authenticated cached Rhino triangles that were spatially matched to 2022
NYC building FIDs are included. The 2014 vertical datum remains unknown; roof
tops are display-anchored to 2022 HEIGHTROOF and facade relief is relative only.
"""
from __future__ import annotations
import json, math, pathlib, hashlib

ROOT=pathlib.Path(__file__).resolve().parents[2]
SRC=ROOT/"artifacts/nyc-official-mn05"
ROOF=SRC/"mn05-cached-roof-metric-preview.json"
FACADE=SRC/"mn05-cached-facade-metric-preview.json"
FOOTPRINTS=ROOT/"assets/nyc/times-square-footprints.json"
OUT=ROOT/"assets/nyc/nyc-mn05-2014-source-mesh.json"
MODEL_SHA="b41afdad1243d12858f7f446325af30667175b1eb36e9689304a4299f1c0df57"
ZIP_SHA="71e6242c55ca7069f67c0bfd8e6d4764c9e6020a361e6bfa77880effe7520bf2"

def read(path):
    return json.loads(path.read_text())

def finite_triangle(tri):
    return (isinstance(tri,dict) and isinstance(tri.get("vertices"),list)
      and len(tri["vertices"])==3 and all(isinstance(p,list) and len(p)==3
      and all(isinstance(v,(int,float)) and math.isfinite(v) for v in p)
      for p in tri["vertices"]))

def main():
    roof,facade=read(ROOF),read(FACADE)
    footprints=read(FOOTPRINTS)
    if roof.get("schema")!="nyc-mn05-2014-saved-brep-roof-triangles-v1" or not roof.get("meshAccepted"):
        raise SystemExit("Original 2014 saved roof mesh not accepted")
    if facade.get("schema")!="nyc-mn05-2014-saved-brep-facade-triangles-v1" or not facade.get("meshAccepted"):
        raise SystemExit("Original 2014 saved facade mesh not accepted")
    for d in (roof,facade):
        if d.get("sourceRhinoSha256")!=MODEL_SHA or d.get("sourceZipSha256")!=ZIP_SHA:
            raise SystemExit("Official source archive/model SHA mismatch")
        if d.get("sourceVerticalDatumVerified") is not False or d.get("modelIs2026Survey") is not False:
            raise SystemExit("Unexpected vertical-datum or source-vintage claim")
    if facade.get("sourceVerticalUnitVerified") is not True or facade.get("sourceModelUnitSystem")!="Feet":
        raise SystemExit("Original Rhino vertical units were not verified as Feet")
    if roof.get("localOriginLonLat")!=facade.get("localOriginLonLat"):
        raise SystemExit("Roof/facade coordinate origins differ")
    source_fids={int(x["fid"]) for x in footprints.get("features",[]) if "fid" in x}
    roof_triangles=roof.get("triangles",[])
    facade_triangles=facade.get("triangles",[])
    if not 100<=len(roof_triangles)<=12000 or not 50<=len(facade_triangles)<=60000:
        raise SystemExit("Source mesh triangle count outside reviewed budgets")
    roof_fids={int(x["fid"]) for x in roof.get("matchedFids",[])}
    facade_fids={int(x) for x in facade.get("matchedFids",[])}
    if not roof_fids or not facade_fids or not roof_fids<=source_fids or not facade_fids<=source_fids:
        raise SystemExit("2014 source match FIDs do not exist in the 2022 footprint snapshot")
    for tri in roof_triangles:
        if not finite_triangle(tri) or int(tri["matched2022BuildingFid"]) not in roof_fids:
            raise SystemExit("Invalid or unmatched original roof triangle")
        if float(tri.get("matchAreaRatio",0))<.60:
            raise SystemExit("Roof triangle match below 0.60 overlap threshold")
        z=tri.get("sourceRawZFt")
        if not isinstance(z,list) or len(z)!=3 or not all(math.isfinite(v) for v in z):
            raise SystemExit("Missing raw source roof Z values")
    for tri in facade_triangles:
        if not finite_triangle(tri) or int(tri["matched2022BuildingFid"]) not in facade_fids:
            raise SystemExit("Invalid or unmatched original facade triangle")
        if float(tri.get("matchCoverage",0))<.65 or float(tri.get("boundaryDistanceMetres",99))>1.5:
            raise SystemExit("Facade match outside reviewed boundary tolerance")
    asset={
      "schema":"patrol-nyc-mn05-2014-matched-source-mesh-v1",
      "assetRole":"2014_HISTORICAL_SOURCE_GEOMETRY_FOR_OPT_IN_VISUALS_ONLY_NOT_COLLISION",
      "source":"NYC Department of City Planning — NYC 3D Model by Community District, MN05",
      "sourceDataset":"https://data.cityofnewyork.us/d/u5j4-zxpn",
      "sourceDocumentation":"https://www.nyc.gov/assets/planning/download/pdf/data-maps/open-data/nyc-3d-model-metadata.pdf",
      "sourceTerms":"https://opendata.cityofnewyork.us/overview/",
      "sourceVintage":2014,
      "sourceRhinoSha256":MODEL_SHA,"sourceZipSha256":ZIP_SHA,
      "sourceCRS":"NAD83 New York Long Island EPSG:2263 US survey feet XY; Rhino Z in feet",
      "localOriginLonLat":roof["localOriginLonLat"],
      "sourceVerticalUnitVerified":True,"sourceVerticalDatumVerified":False,
      "absoluteAltitudeClaim":False,"gameCollision":False,"modelIs2026Survey":False,
      "roofAnchor":"Original saved 2014 roof triangles, horizontal EPSG:2263 projection, relative source Z retained and anchored per FID to 2022 NYC HEIGHTROOF; +0.35m display offset; not absolute elevation.",
      "facadeAnchor":"Original saved 2014 facade triangles, horizontal EPSG:2263 projection, relative source Z retained and anchored to same-FID 2014 roof top and 2022 NYC HEIGHTROOF; absolute vertical datum unknown.",
      "matchRules":{"roofMinimumAreaOverlap":0.60,"facadeMinimumBoundaryCoverage":0.65,"facadeMaximumBoundaryDistanceMetres":1.5,"ambiguousPartyWallsRejected":True},
      "counts":{"roofTriangles":len(roof_triangles),"roofFids":len(roof_fids),
        "facadeTriangles":len(facade_triangles),"facadeFids":len(facade_fids),
        "candidateRoofObjects":roof["counts"]["candidateSourceRoofObjects"],
        "matchedRoofObjects":roof["counts"]["matchedRoofObjects"],
        "candidateFacadeObjects":facade["counts"]["candidateFacadeObjects"],
        "matchedFacadeObjects":facade["counts"]["matchedFacadeObjects"]},
      "roofTriangles":roof_triangles,"facadeTriangles":facade_triangles
    }
    OUT.write_text(json.dumps(asset,ensure_ascii=False,separators=(",",":")))
    print(json.dumps({"output":str(OUT),"bytes":OUT.stat().st_size,"counts":asset["counts"],
      "sourceRhinoSha256":MODEL_SHA,"sourceVerticalDatumVerified":False},ensure_ascii=False))

if __name__=="__main__": main()
