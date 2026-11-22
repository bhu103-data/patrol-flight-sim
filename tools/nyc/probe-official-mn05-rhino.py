#!/usr/bin/env python3
"""Inspect OFFICIAL NYC DCP 2014 MN05 Rhino-3DM model with hard download bounds.

Only source metadata is uploaded, no redistribution of model bytes until
individual building coordinates, licence and 2014-vs-2026 chronology are QA'd.
Original dataset: NYC 3D Model by Community District (u5j4-zxpn).
Official source: City Planning 2018 metadata. This is NOT 2026 surveyed BIM.
"""
from __future__ import annotations
import hashlib, json, os, pathlib, urllib.request, zipfile

OUT = pathlib.Path("artifacts/nyc-official-mn05")
OUT.mkdir(parents=True, exist_ok=True)
MAX_COMPRESSED = 220 * 1024 * 1024
MAX_3DM = 650 * 1024 * 1024
SRC = [
    "https://www.nyc.gov/assets/planning/download/zip/data-maps/open-data/nyc-3d-model/nyc_3dmodel_mn05.zip",
    "https://www1.nyc.gov/assets/planning/download/zip/data-maps/open-data/nyc-3d-model/nyc_3dmodel_mn05.zip",
]
TERMS = "https://opendata.cityofnewyork.us/overview/"
metadata = {
 "sourceDocumentation":"https://www.nyc.gov/assets/planning/download/pdf/data-maps/open-data/nyc-3d-model-metadata.pdf",
 "source":SRC,"rights":"Public NYC DCP open data, NYC Open Data terms apply",
 "vintage":"2014 aerial survey, 2018 dataset; NOT 2026 facade reality",
 "officialModelRole":"RESEARCH_SOURCE_QA_ONLY_NOT_PATROL_RUNTIME",
 "imported":False, "attempts":[],
 "limits":{"compressedBytes":MAX_COMPRESSED,"max3dmMemberBytes":MAX_3DM}
}
archive = OUT / "mn05-source.zip"
try:
 for url in SRC:
    try:
      req=urllib.request.Request(url,headers={
        "User-Agent":"PATROL-NYC-Open-Data-Source-Inspector/1.0",
        "Accept":"application/zip,application/octet-stream"})
      with urllib.request.urlopen(req,timeout=90) as response:
        length=response.headers.get("Content-Length")
        content_type=response.headers.get("Content-Type")
        effective=response.geturl()
        if length and int(length)>MAX_COMPRESSED:
          raise ValueError("Official source exceeds 220 MiB download budget: "+length)
        digest=hashlib.sha256()
        count=0
        with archive.open("wb") as dest:
          while True:
            chunk=response.read(1024*1024)
            if not chunk:break
            count+=len(chunk)
            if count>MAX_COMPRESSED:raise ValueError("Downloaded ZIP exceeds bounded budget")
            digest.update(chunk);dest.write(chunk)
      if not zipfile.is_zipfile(archive):
        raise ValueError("Source response was not an authentic ZIP")
      metadata.update({"acceptedUrl":url,"resolvedUrl":effective,
        "contentType":content_type,"compressedBytes":count,"sha256":digest.hexdigest()})
      break
    except Exception as err:
      metadata["attempts"].append({"url":url,"error":f"{type(err).__name__}: {err}"})
      archive.unlink(missing_ok=True)
 else:raise RuntimeError("Both officially published NYC MN05 ZIP endpoints failed")
 with zipfile.ZipFile(archive) as zp:
   members=[]
   for item in zp.infolist():
     path=pathlib.PurePosixPath(item.filename)
     if path.is_absolute() or ".." in path.parts:
       raise ValueError("Unsafe original archive member path")
     members.append({"name":item.filename,
                     "bytes":item.file_size,"compressedBytes":item.compress_size})
   metadata["members"]=members[:80]
   model_files=[x for x in zp.infolist() if x.filename.lower().endswith(".3dm")]
   if not model_files:
      raise ValueError("Official MN05 ZIP contains no .3dm source model")
   candidate=max(model_files,key=lambda m:m.file_size)
   if candidate.file_size>MAX_3DM:
      raise ValueError("MN05 Rhino source exceeds safe 650 MiB member limit")
   metadata["selected3dm"]={"filename":candidate.filename,
                             "uncompressedBytes":candidate.file_size}
   raw_path=OUT/"mn05-source.3dm"
   with zp.open(candidate) as src,raw_path.open("wb") as dst:
      while True:
        block=src.read(1024*1024)
        if not block:break
        dst.write(block)
   metadata["source3dmSha256"]=hashlib.sha256(raw_path.read_bytes()).hexdigest()
   import rhino3dm
   metadata["readerVersion"]=str(getattr(rhino3dm,"__version__","unknown"))
   rhino=rhino3dm.File3dm.Read(str(raw_path))
   if rhino is None:raise ValueError("rhino3dm failed to parse official archive model")
   layers=[{"index":i,"name":layer.Name,
            "fullPath":getattr(layer,"FullPath",None)}
           for i,layer in enumerate(rhino.Layers)]
   metadata["layers"]=layers[:100]
   counts={};examples=[]
   limit_objects=250000
   for i,obj in enumerate(rhino.Objects):
     if i>=limit_objects:raise ValueError("MN05 3-D object inventory above bounded 250k")
     geom=obj.Geometry
     k=type(geom).__name__
     counts[k]=counts.get(k,0)+1
     if len(examples)<16 or ("Mesh" in k and not any(x["geometry"]=="Mesh" for x in examples)):
       sample={"geometry":k,"layerIndex":obj.Attributes.LayerIndex,
               "layerName":layers[obj.Attributes.LayerIndex]["name"]
                 if obj.Attributes.LayerIndex>=0 and obj.Attributes.LayerIndex<len(layers) else None,
               "hasBoundingMethod":hasattr(geom,"GetBoundingBox"),
               "hasVertices":hasattr(geom,"Vertices"),
               "hasFaces":hasattr(geom,"Faces")}
       if "Mesh" in k and getattr(geom,"Vertices",None):
         try:
           vs=geom.Vertices
           sample["vertices"]=len(vs)
           sample["sampleVertex"]=[vs[0].X,vs[0].Y,vs[0].Z] if len(vs) else None
         except Exception as err:sample["meshSampleError"]=str(err)
       examples.append(sample)
   metadata["objectCount"]=sum(counts.values())
   metadata["geometryTypes"]=counts
   metadata["sampleGeometry"]=examples
   metadata["imported"]=True
except Exception as exc:
 metadata["error"]=f"{type(exc).__name__}: {exc}"
finally:
 # Keep verified evidence only, never bundle a large model into the repo.
 if os.environ.get("PATROL_KEEP_MN05") != "1":
   (OUT/"mn05-source.3dm").unlink(missing_ok=True)
 archive.unlink(missing_ok=True)
 (OUT/"mn05-probe.json").write_text(json.dumps(metadata,ensure_ascii=False,indent=2))
 print(json.dumps(metadata,ensure_ascii=False,indent=2))
if not metadata["imported"]:raise SystemExit(1)
