#!/usr/bin/env python3
"""Acquire and inventory the official NYC DCP 2014 Brooklyn BK02 Rhino model.

BK02 includes DUMBO, Brooklyn Heights, Downtown Brooklyn and Fort Greene.
This is source-only audit; no source archive is committed or uploaded.
"""
from __future__ import annotations
import hashlib,json,os,pathlib,urllib.request,zipfile

OUT=pathlib.Path("artifacts/nyc-official-bk02")
OUT.mkdir(parents=True,exist_ok=True)
MAX_COMPRESSED=400*1024*1024
MAX_3DM=2*1024*1024*1024
MAX_OBJECTS=500000
EXPECTED_ZIP_SHA256='e16f1dae5521f02835042ac5a6a36f3750603b03170d218d7d6b9f2a616c6ff1'
EXPECTED_3DM_SHA256='c22a7e7225425e01b5f50e5d68f6dc75b93a9d05c8a4ae566f1c1d40ec981493'
SRC=[
 "https://www.nyc.gov/assets/planning/download/zip/data-maps/open-data/nyc-3d-model/nyc_3dmodel_bk02.zip",
 "https://www1.nyc.gov/assets/planning/download/zip/data-maps/open-data/nyc-3d-model/nyc_3dmodel_bk02.zip"
]
TERMS="https://opendata.cityofnewyork.us/overview/"
DOC="https://www.nyc.gov/assets/planning/download/pdf/data-maps/open-data/nyc-3d-model-metadata.pdf"
archive=OUT/"bk02-source.zip"
raw_path=OUT/"bk02-source.3dm"
def sha256_file(path):
    h=hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda:f.read(1024*1024),b""):h.update(chunk)
    return h.hexdigest()
metadata={
 "dataset":"NYC 3D Model by Community District — BK02",
 "sourceDocumentation":DOC,
 "sourceTerms":TERMS,
 "sourceUrls":SRC,
 "area":"BK02 includes DUMBO, Brooklyn Heights, Downtown Brooklyn, Fort Greene, Fulton Ferry and Navy Yard",
 "vintage":"2014 aerial survey; 2018 DCP model/readme; NOT a 2026 as-built facade model",
 "sourceCRS":"NAD83 / New York Long Island EPSG:2263, US survey feet (XY)",
 "sourceVerticalDatumVerified":False,
 "rights":"Public NYC DCP/NYC Open Data; retain attribution and source-date caveats",
 "role":"ISOLATED_2014_SOURCE_GEOMETRY_AUDIT_NOT_PATROL_GAME_ASSET",
 "imported":False,"attempts":[],
 "limits":{"compressedBytes":MAX_COMPRESSED,"max3dmMemberBytes":MAX_3DM,
           "maxRhinoObjects":MAX_OBJECTS}
}
try:
    for url in SRC:
        try:
            req=urllib.request.Request(url,headers={
              "User-Agent":"PATROL-NYC-BK02-Open-Data-Source-Inspector/1.0",
              "Accept":"application/zip,application/octet-stream"})
            with urllib.request.urlopen(req,timeout=180) as response:
                length=response.headers.get("Content-Length")
                if length and int(length)>MAX_COMPRESSED:
                    raise ValueError("Official BK02 ZIP exceeds 400 MiB cap: "+length)
                digest=hashlib.sha256();count=0
                metadata["resolvedUrl"]=response.geturl()
                metadata["contentType"]=response.headers.get("Content-Type")
                with archive.open("wb") as dst:
                    while True:
                        chunk=response.read(1024*1024)
                        if not chunk:break
                        count+=len(chunk)
                        if count>MAX_COMPRESSED:
                            raise ValueError("BK02 ZIP exceeded bounded 400 MiB stream")
                        digest.update(chunk);dst.write(chunk)
            if not zipfile.is_zipfile(archive):
                raise ValueError("Official response is not a valid ZIP archive")
            zip_sha=digest.hexdigest()
            metadata.update({"acceptedUrl":url,"compressedBytes":count,
                             "zipSha256":zip_sha})
            if zip_sha!=EXPECTED_ZIP_SHA256:
                raise ValueError("Official BK02 ZIP SHA differs from the reviewed source snapshot")
            break
        except Exception as err:
            metadata["attempts"].append({"url":url,"error":f"{type(err).__name__}: {err}"})
            archive.unlink(missing_ok=True)
    else:
        raise RuntimeError("Both official NYC DCP BK02 archive endpoints failed")
    with zipfile.ZipFile(archive) as zp:
        members=[]
        for item in zp.infolist():
            p=pathlib.PurePosixPath(item.filename)
            if p.is_absolute() or ".." in p.parts:
                raise ValueError("Unsafe source ZIP member path")
            members.append({"name":item.filename,"bytes":item.file_size,
                            "compressedBytes":item.compress_size})
        metadata["members"]=members[:120]
        candidates=[x for x in zp.infolist() if x.filename.lower().endswith(".3dm")]
        if not candidates:raise ValueError("Official BK02 archive has no Rhino .3dm model")
        selected=max(candidates,key=lambda x:x.file_size)
        if selected.file_size>MAX_3DM:
            raise ValueError("BK02 Rhino model exceeds bounded 2 GiB member cap")
        metadata["selected3dm"]={"filename":selected.filename,
                                  "uncompressedBytes":selected.file_size}
        with zp.open(selected) as src,raw_path.open("wb") as dst:
            for chunk in iter(lambda:src.read(1024*1024),b""):dst.write(chunk)
    metadata["source3dmSha256"]=sha256_file(raw_path)
    if metadata["source3dmSha256"]!=EXPECTED_3DM_SHA256:
        raise ValueError("Official BK02 Rhino 3DM SHA differs from the reviewed source snapshot")
    import rhino3dm
    metadata["readerVersion"]=str(getattr(rhino3dm,"__version__","unknown"))
    model=rhino3dm.File3dm.Read(str(raw_path))
    if model is None:raise ValueError("rhino3dm could not parse official BK02 .3dm")
    try:
        metadata["modelUnitSystem"]=str(model.Settings.ModelUnitSystem)
    except Exception as err:
        metadata["modelUnitSystem"]="unavailable: "+str(err)[:180]
    settings=model.Settings
    setting_names=[name for name in dir(settings) if not name.startswith("_")]
    metadata["modelSettingsProperties"]=setting_names
    metadata["modelSettingsGeoreference"]={}
    for name in setting_names:
        if any(token in name.casefold() for token in ("earth","anchor","basepoint","base_point","origin","coordinate")):
            try:
                value=getattr(settings,name)
                if isinstance(value,(str,int,float,bool)) or value is None:
                    metadata["modelSettingsGeoreference"][name]=value
                else:
                    props=[p for p in dir(value) if not p.startswith("_")]
                    fields={}
                    for prop in props:
                        try:
                            v=getattr(value,prop)
                            if isinstance(v,(str,int,float,bool)) or v is None:
                                fields[prop]=v
                        except Exception:pass
                    metadata["modelSettingsGeoreference"][name]={
                      "type":type(value).__name__,"repr":repr(value)[:300],
                      "properties":fields}
            except Exception as err:
                metadata["modelSettingsGeoreference"][name]="unavailable: "+str(err)[:120]
    def color_json(value):
        if value is None:return None
        fields={}
        for key in ("R","G","B","A"):
            try:fields[key]=int(getattr(value,key))
            except Exception:pass
        return {"type":type(value).__name__,"rgba":fields,"repr":repr(value)[:120]}
    try:
        materials=list(model.Materials)
        metadata["materialCount"]=len(materials)
        metadata["materials"]=[]
        for i,material in enumerate(materials[:200]):
            item={"index":i}
            for key in ("Name","Transparency","Shine","Reflectivity","Metallic","Roughness"):
                try:
                    value=getattr(material,key)
                    if isinstance(value,(str,int,float,bool)) or value is None:item[key]=value
                except Exception:pass
            for key in ("DiffuseColor","SpecularColor","EmissionColor"):
                try:item[key]=color_json(getattr(material,key))
                except Exception:pass
            metadata["materials"].append(item)
    except Exception as err:
        metadata["materialInventoryError"]=str(err)[:300]
        metadata["materialCount"]=None
    layers=[{"index":i,"name":x.Name,"fullPath":getattr(x,"FullPath",None),
             "color":color_json(getattr(x,"Color",None))}
            for i,x in enumerate(model.Layers)]
    metadata["layers"]=layers[:160]
    counts={};layer_counts={};examples=[]
    style_counts={};style_samples=[]
    for i,obj in enumerate(model.Objects):
        if i>=MAX_OBJECTS:
            raise ValueError("BK02 Rhino object inventory exceeds 500,000 object safety cap")
        geom=obj.Geometry;kind=type(geom).__name__
        counts[kind]=counts.get(kind,0)+1
        li=obj.Attributes.LayerIndex
        lname=layers[li]["fullPath"] or layers[li]["name"] if 0<=li<len(layers) else "unknown"
        layer_counts[lname]=layer_counts.get(lname,0)+1
        attrs=obj.Attributes
        material_source=str(getattr(attrs,"MaterialSource","unknown"))
        color_source=str(getattr(attrs,"ColorSource","unknown"))
        material_index=getattr(attrs,"MaterialIndex",-1)
        style_counts["materialSource:"+material_source]=style_counts.get("materialSource:"+material_source,0)+1
        style_counts["colorSource:"+color_source]=style_counts.get("colorSource:"+color_source,0)+1
        if any(token in lname.casefold() for token in ("surface_facade","facade surface","surface_rooftop","rooftop surface")) and len(style_samples)<60:
            style_samples.append({"layerName":lname,"geometry":kind,
              "materialSource":material_source,"materialIndex":material_index,
              "colorSource":color_source,"objectColor":color_json(getattr(attrs,"ObjectColor",None))})
        if len(examples)<20:
            sample={"geometry":kind,"layerIndex":li,"layerName":lname,
                    "hasBoundingBox":hasattr(geom,"GetBoundingBox"),
                    "hasVertices":hasattr(geom,"Vertices"),
                    "hasFaces":hasattr(geom,"Faces")}
            if hasattr(geom,"GetBoundingBox"):
                try:
                    bb=geom.GetBoundingBox()
                    sample["bboxXYFeet"]=[bb.Min.X,bb.Min.Y,bb.Max.X,bb.Max.Y]
                except Exception as err:sample["bboxError"]=str(err)[:120]
            examples.append(sample)
    metadata["objectCount"]=sum(counts.values())
    metadata["geometryTypes"]=counts
    metadata["layerObjectCounts"]=layer_counts
    metadata["styleSourceCounts"]=style_counts
    metadata["styleSamples"]=style_samples
    metadata["sampleObjects"]=examples
    metadata["imported"]=True
except Exception as exc:
    metadata["error"]=f"{type(exc).__name__}: {exc}"
finally:
    archive.unlink(missing_ok=True)
    if os.environ.get("PATROL_KEEP_BK02")!="1":
        raw_path.unlink(missing_ok=True)
    (OUT/"bk02-probe.json").write_text(json.dumps(metadata,ensure_ascii=False,indent=2))
    print(json.dumps(metadata,ensure_ascii=False,indent=2))
if not metadata["imported"]:raise SystemExit(1)
