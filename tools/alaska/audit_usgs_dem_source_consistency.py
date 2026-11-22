#!/usr/bin/env python3
"""Independent scientific source-fidelity check for USGS Tracy Arm DEM.

Compare the *baked original 30m* to a fresh export of its exact original URL,
then compare source-derived ~5m subregion at WGS84 pixel centres, including
border seams, shifted registration and near-water classification.

Writes inspectable metrics, no changes to shipped terrain or data. Differences
can BLOCK stitching but do not imply the downloaded 5m source is "wrong".
"""
from __future__ import annotations
import argparse
import base64
import io
import json
import math
import pathlib
import urllib.request
import urllib.parse
from datetime import datetime,timezone
import numpy as np
import tifffile

ROOT=pathlib.Path(__file__).resolve().parents[2]
COARSE=ROOT/"assets/alaska/tracy-arm-3dep.json"
FINE=ROOT/"artifacts/alaska-tracyarm-five-metre-tile.json"
OUTPUT=ROOT/"artifacts/alaska-tracyarm-registration-audit.json"
MAX=3_000_000

def fetch_usgs_tiff(url):
    req=urllib.request.Request(url,headers={
        "Accept":"image/tiff,application/octet-stream",
        "User-Agent":"PATROL-tracy-arm-geospatial-source-QA/1.0"})
    with urllib.request.urlopen(req,timeout=50) as r:
        data=r.read(MAX+1)
    if len(data)>MAX or data[:4] not in (b"II*\0",b"MM\0*"):
        raise RuntimeError("Official USGS source did not yield bounded TIFF")
    arr=tifffile.imread(io.BytesIO(data))
    if arr.shape!=(256,256) or arr.dtype.kind!="f":
        raise RuntimeError("Wrong exact-USGS original TIFF dtype/shape: "+str((arr.shape,arr.dtype)))
    return arr[::-1].astype(np.float64)


def export_metadata(request_url, adjust=None):
    """Ask ArcGIS for the ACTUAL export envelope; never trust requested bbox."""
    parts=urllib.parse.urlsplit(request_url)
    q=urllib.parse.parse_qs(parts.query)
    q["f"]=["json"]
    if adjust is not None:q["adjustAspectRatio"]=[str(adjust).lower()]
    check_url=urllib.parse.urlunsplit(
        (parts.scheme,parts.netloc,parts.path,urllib.parse.urlencode(q,doseq=True),""))
    req=urllib.request.Request(check_url,headers={
        "Accept":"application/json",
        "User-Agent":"PATROL-tracy-arm-actual-extent-QA/1.0"})
    with urllib.request.urlopen(req,timeout=40) as r:
        response=json.loads(r.read(250_000))
    if "error" in response:raise RuntimeError("ArcGIS export metadata error "+str(response["error"]))
    envelope=response.get("extent") or {}
    key=["xmin","ymin","xmax","ymax"]
    if not all(k in envelope and isinstance(envelope[k],(int,float)) for k in key):
        raise RuntimeError("ArcGIS omitted actual export extent, no georeference proof")
    sr=envelope.get("spatialReference") or {}
    wkid=sr.get("latestWkid",sr.get("wkid"))
    if wkid!=4326:raise RuntimeError("Unexpected ArcGIS output spatial reference "+str(wkid))
    bbox=[float(envelope[k]) for k in key]
    return {
        "url":check_url,"actualBbox":bbox,"spatialReference":sr,
        "width":response.get("width"),"height":response.get("height"),
        "adjustAspectRatio":adjust,
        "publishedByServer":True
    }


def arcgis_default_aspect_bbox(bbox,width=256,height=256):
    """Esri exportImage default adjustAspectRatio=true: image pixels are square
    in the output spatial reference; preserve centre, enlarge narrow axis.
    This remains a modeled extent until actual server response/GeoTIFF tags
    validate it, not a license to silently rewrite georeferenced assets."""
    west,south,east,north=map(float,bbox)
    dx=east-west;dy=north-south
    if dx/dy>width/height:
        dy=dx*height/width
    else:
        dx=dy*width/height
    cx=(west+east)/2;cy=(south+north)/2
    return [cx-dx/2,cy-dy/2,cx+dx/2,cy+dy/2]

def distribution(a):
    a=np.asarray(a,dtype=np.float64)
    a=a[np.isfinite(a)]
    return dict(n=int(a.size),mean=round(float(a.mean()),3),
        median=round(float(np.median(a)),3),
        rmse=round(float(np.sqrt(np.mean(a*a))),3),
        p95Abs=round(float(np.percentile(np.abs(a),95)),3),
        maxAbs=round(float(np.abs(a).max()),3))

def bilinear(z,x,y):
    x=np.clip(x,0,z.shape[1]-1)
    y=np.clip(y,0,z.shape[0]-1)
    x0=np.floor(x).astype(np.int64);y0=np.floor(y).astype(np.int64)
    x1=np.minimum(x0+1,z.shape[1]-1)
    y1=np.minimum(y0+1,z.shape[0]-1)
    t=x-x0;s=y-y0
    return ((1-s)*((1-t)*z[y0,x0]+t*z[y0,x1])+
       s*((1-t)*z[y1,x0]+t*z[y1,x1]))

def main():
    fine_meta=json.loads(FINE.read_text())
    old_meta=json.loads(COARSE.read_text())
    if fine_meta["format"]!="usgs-3dep-i16dm-southfirst-v1":
        raise RuntimeError("Unverified high-resolution experimental tile")
    old=np.frombuffer(base64.b64decode(old_meta["heightsBase64"],validate=True),
                      dtype="<u2").reshape((256,256)).astype(np.float64)
    fine_int=np.frombuffer(base64.b64decode(fine_meta["heightsBase64"],validate=True),
                           dtype="<i2").reshape((256,256))
    fine=fine_int.astype(np.float64)*.1
    if np.any(fine_int==-32768):raise RuntimeError("NoData in official 5m source tile")
    report={
        "status":"do-not-stitch-without-review",
        "generatedAt":datetime.now(timezone.utc).isoformat(),
        "sourceOriginal":old_meta["sourceQuery"],
        "sourceFiveMetre":fine_meta["sourceQuery"],
        "sourceRawTiffSha256":fine_meta["sourceRawTiffSha256"],
        "originalWgs84Bbox":old_meta["bbox"],
        "fiveMetreWgs84Bbox":fine_meta["bbox"],
        "originalMetreQuantization":"rounded/clipped to unsigned 1m and all <=0m clamped to zero",
        "fineMetreQuantization":"signed 0.1m and -32768 reserved for invalid",
        "indexDoesNotProveExportVerticalCRS":True
    }
    OW,OS,OE,ON=old_meta["bbox"]
    FW,FS,FE,FN=fine_meta["bbox"]
    xs=FW+(np.arange(256)+.5)*(FE-FW)/256
    ys=FS+(np.arange(256)+.5)*(FN-FS)/256
    xx=(xs-OW)/(OE-OW)*256-.5
    yy=(ys-OS)/(ON-OS)*256-.5
    X,Y=np.meshgrid(xx,yy)
    old_interp=bilinear(old,X,Y)
    report["exactCellCentres"]={
        "coarseFirstIndex":[round(float(X[0,0]),6),round(float(Y[0,0]),6)],
        "coarseLastIndex":[round(float(X[-1,-1]),6),round(float(Y[-1,-1]),6)]
    }
    report["fineMinusBakedCoarse"]=distribution(fine-old_interp)
    # Model documented ArcGIS default auto aspect independently from any
    # potentially unreliable service f=json endpoint.
    modelOld=arcgis_default_aspect_bbox(old_meta["bbox"])
    modelFine=arcgis_default_aspect_bbox(fine_meta["bbox"])
    xmodel=modelFine[0]+(np.arange(256)+.5)*(modelFine[2]-modelFine[0])/256
    ymodel=modelFine[1]+(np.arange(256)+.5)*(modelFine[3]-modelFine[1])/256
    MX,MY=np.meshgrid(
       (xmodel-modelOld[0])/(modelOld[2]-modelOld[0])*256-.5,
       (ymodel-modelOld[1])/(modelOld[3]-modelOld[1])*256-.5)
    dmodel=fine-bilinear(old,MX,MY)
    report["modeledArcgisDefaultAspect"]={
      "publishedByServer":False,
      "coarseEffectiveBBox":modelOld,
      "fineEffectiveBBox":modelFine,
      "fineMinusCoarseAfterAspectFix":distribution(dmodel),
      "reductionFromWrongRequestedBBoxRmseMetres":round(
        report["fineMinusBakedCoarse"]["rmse"]-distribution(dmodel)["rmse"],3),
      "actualServerJSONCrosscheckRequired":True,
      "esriReference":"https://developers.arcgis.com/rest/services-reference/enterprise/export-image/"
    }
    report["fineVsCoarseWaterStatus"]={
        "coarseWaterFineLandGt20m":int(np.count_nonzero((old_interp<=1)&(fine>20))),
        "coarseLandGt20mFineWater":int(np.count_nonzero((old_interp>20)&(fine<=1))),
        "bothWaterLe1m":int(np.count_nonzero((old_interp<=1)&(fine<=1)))
    }
    report["edgesFineMinusCoarse"]={
      "west":distribution((fine-old_interp)[:,0]),
      "east":distribution((fine-old_interp)[:,-1]),
      "south":distribution((fine-old_interp)[0,:]),
      "north":distribution((fine-old_interp)[-1,:])
    }
    # Diagnostic shifts in ORIGINAL 30m pixels, not automatic repair.
    shifts=[]
    for dy in range(-5,6):
      for dx in range(-5,6):
        candidate=bilinear(old,X+dx,Y+dy)
        d=fine-candidate
        shifts.append({"dx30mPx":dx,"dy30mPx":dy,
                       "rmse":round(float(np.sqrt(np.mean(d*d))),3),
                       "bias":round(float(np.mean(d)),3)})
    shifts.sort(key=lambda x:x["rmse"])
    report["bestCoarsePixelShiftDiagnostic"]=shifts[0]
    report["secondBestCoarsePixelShiftDiagnostic"]=shifts[1]
    report["rmseImprovementVsOriginal"]=round(
      report["fineMinusBakedCoarse"]["rmse"]-shifts[0]["rmse"],3)
    # ArcGIS official REST: adjustAspectRatio defaults TRUE. With a 256²
    # output but WGS84 bbox of unequal horizontal/vertical degree extents, the
    # server may EXPAND the actual output bbox around the request centre.
    # The old asset stores requested bbox only, so its pixels can be mapped to
    # the wrong latitudes. This can mimic a source-product/epoch offset.
    try:
      o_export=export_metadata(old_meta["sourceQuery"])
      f_export=export_metadata(fine_meta["sourceQuery"])
      o_false=export_metadata(old_meta["sourceQuery"],False)
      f_false=export_metadata(fine_meta["sourceQuery"],False)
      report["arcgisActualExportExtents"]={
         "coarseDefault":o_export,
         "fineDefault":f_export,
         "coarseDisableAutoAspect":o_false,
         "fineDisableAutoAspect":f_false
      }
      CO=o_export["actualBbox"];FI=f_export["actualBbox"]
      fx=FI[0]+(np.arange(256)+.5)*(FI[2]-FI[0])/256
      fy=FI[1]+(np.arange(256)+.5)*(FI[3]-FI[1])/256
      AX,AY=np.meshgrid((fx-CO[0])/(CO[2]-CO[0])*256-.5,
        (fy-CO[1])/(CO[3]-CO[1])*256-.5)
      report["fineMinusCoarseUsingActualArcgisExtents"]=distribution(
         fine-bilinear(old,AX,AY))
      report["actualExtentDifferenceFromRequested"]={
        "coarse":{
          "west":round(CO[0]-OW,9),"south":round(CO[1]-OS,9),
          "east":round(CO[2]-OE,9),"north":round(CO[3]-ON,9)
        },
        "fine":{
          "west":round(FI[0]-FW,9),"south":round(FI[1]-FS,9),
          "east":round(FI[2]-FE,9),"north":round(FI[3]-FN,9)
        }
      }
      report["arcgisAspectExplainsMostMisregistration"]=(
        report["fineMinusCoarseUsingActualArcgisExtents"]["rmse"] <
           report["fineMinusBakedCoarse"]["rmse"]*.4)
    except Exception as error:
      report["arcgisActualExportExtents"]={"error":str(error),
        "verified":False}
      report["arcgisAspectExplainsMostMisregistration"]=False
    # Up to 12 original 30m pixels; these are purely correlation diagnostics
    # and NEVER authorized fixes for an official georeferencing mismatch.
    sampled=(slice(None,None,3),slice(None,None,3))
    xsmall,ysmall=X[sampled],Y[sampled]
    fsmall=fine[sampled]
    broad=[]
    for dy in range(-12,13):
      for dx in range(-12,13):
        offset=fsmall-bilinear(old,xsmall+dx,ysmall+dy)
        broad.append((float(np.sqrt(np.mean(offset*offset))),dx,dy))
    broad.sort()
    report["expandedBestCoarseShiftDiagnostic"]={
      "rmseSampled":round(broad[0][0],3),
      "dx30mPixels":broad[0][1],"dy30mPixels":broad[0][2],
      "searchLimited":any(abs(a)==12 for a in broad[0][1:])
    }
    # Fresh source at the identical original ImageServer resolution/coordinates.
    try:
      fresh=fetch_usgs_tiff(old_meta["sourceQuery"])
      valid=np.isfinite(fresh)&(fresh>-100)&(fresh<9000)
      fresh_encoded=np.where(valid,np.maximum(fresh,0),0)
      report["freshOriginalSource"]={
        "validFraction":round(float(valid.mean()),5),
        "sourceMax":round(float(fresh_encoded.max()),3),
        "bakedMinusFreshExactRequest":distribution(old-fresh_encoded),
        "matchingQuantizedOriginalPixels":int(np.count_nonzero(
           np.rint(fresh_encoded).clip(0,8000)==old)),
        "totalPixels":65536
      }
      fresh_interp=bilinear(fresh_encoded,X,Y)
      report["fineMinusFreshOriginalSource"]=distribution(fine-fresh_interp)
    except Exception as e:
      report["freshOriginalSource"]={"error":str(e),"verified":False}
    report["stitchGate"]={
        "edgeAbsP95MetresLimit":10,
        "allFourSourceBorderEdgesPass":all(
          a["p95Abs"]<=10 for a in report["edgesFineMinusCoarse"].values()),
        "requiresVisualReview":True,
        "requiresSourceMosaicVerification":True}
    report["status"]="needs-source-and-border-review"
    OUTPUT.parent.mkdir(exist_ok=True,parents=True)
    OUTPUT.write_text(json.dumps(report,indent=2)+"\n")
    print("SOURCE-REGISTRATION AUDIT "+
      json.dumps({k:report[k] for k in [
        "fineMinusBakedCoarse","bestCoarsePixelShiftDiagnostic",
        "rmseImprovementVsOriginal","freshOriginalSource","stitchGate",
        "arcgisActualExportExtents","fineMinusCoarseUsingActualArcgisExtents",
        "expandedBestCoarseShiftDiagnostic","modeledArcgisDefaultAspect"] if k in report}),
      flush=True)

if __name__=="__main__":
    main()
