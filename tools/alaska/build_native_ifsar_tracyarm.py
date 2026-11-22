#!/usr/bin/env python3
"""Download and build the source-native USGS 5m IfSAR Tracy Arm DEM clip.

This is the production-candidate path: native OPR GeoTIFFs, not an ImageServer
resample. It mosaics the two adjacent 15-minute tiles from the SAME QL5 project,
verifies CRS/resolution/NoData/footprint, reprojects to the corrected actual
WGS84 bbox, and emits a south-first int16 0.1m grid for a later opt-in renderer.
It does not edit the production map or flight physics.
"""
from __future__ import annotations
import base64,gzip,hashlib,json,math,os,pathlib,time,urllib.request,urllib.parse,io,xml.etree.ElementTree as ET
import numpy as np
import urllib.parse
import rasterio
import tifffile
from rasterio.crs import CRS
from rasterio.enums import Resampling
from rasterio.transform import from_bounds
from rasterio.warp import reproject,transform_bounds

ROOT=pathlib.Path(__file__).resolve().parents[2]
ART=ROOT/"artifacts"
NATIVE_REPORT=ART/"alaska-usgs5m-native-source.json"
GEOREF=ROOT/"assets/alaska/tracy-arm-3dep-actual-extent.json"
COARSE=ROOT/"assets/alaska/tracy-arm-3dep.json"
OUT=ART/"alaska-tracyarm-ifsar5m"
OUT.mkdir(parents=True,exist_ok=True)
EXPECTED={
 "USGS_OPR_Alaska_Mid_Accuracy_DEM_Summer_2015_DTM_N5745W13330P.tif":99018238,
 "USGS_OPR_Alaska_Mid_Accuracy_DEM_Summer_2015_DTM_N5745W13315P.tif":89998420,
}
NODATA_OUT=-9999.0
QUANT=.1
TARGET_WIDTH=1536
TARGET_HEIGHT=2880

def sha256(path):
 h=hashlib.sha256()
 with open(path,"rb") as f:
  for block in iter(lambda:f.read(1024*1024),b""):h.update(block)
 return h.hexdigest()

def download(url,path,expected):
 if path.exists() and path.stat().st_size==expected:return
 urls=url if isinstance(url,(list,tuple)) else [url]
 tmp=path.with_suffix(path.suffix+".part")
 last=None
 for source_url in urls:
  for attempt in range(3):
   try:
    req=urllib.request.Request(source_url,headers={
      "User-Agent":"Mozilla/5.0 PATROL-USGS-OPR-5m-source-QA/1.0",
      "Accept":"image/tiff,application/octet-stream,*/*"})
    with urllib.request.urlopen(req,timeout=180) as response,open(tmp,"wb") as out:
     length=response.headers.get("Content-Length")
     if length and int(length)!=expected:
      raise RuntimeError("USGS Content-Length mismatch "+length+" for "+source_url)
     while True:
      block=response.read(1024*1024)
      if not block:break
      out.write(block)
    if tmp.stat().st_size!=expected:
     raise RuntimeError("USGS tile byte count mismatch for "+source_url)
    tmp.replace(path);return
   except Exception as e:
    last=RuntimeError(str(e)+" [source "+source_url+"]")
    if tmp.exists():tmp.unlink()
    if attempt<2:time.sleep(2**attempt)
 raise RuntimeError("Failed native USGS download after host fallbacks: "+str(last))

def dist(values):
 a=np.asarray(values,dtype=np.float64)
 a=a[np.isfinite(a)]
 return {"n":int(a.size),"mean_m":round(float(a.mean()),3),
   "rmse_m":round(float(np.sqrt(np.mean(a*a))),3),
   "p95_abs_m":round(float(np.percentile(np.abs(a),95)),3),
   "max_abs_m":round(float(np.abs(a).max()),3)}

def bilinear(grid,x,y):
 x=np.clip(x,0,grid.shape[1]-1);y=np.clip(y,0,grid.shape[0]-1)
 x0=np.floor(x).astype(np.int64);y0=np.floor(y).astype(np.int64)
 x1=np.minimum(x0+1,grid.shape[1]-1);y1=np.minimum(y0+1,grid.shape[0]-1)
 tx=x-x0;ty=y-y0
 return ((1-ty)*((1-tx)*grid[y0,x0]+tx*grid[y0,x1])+
         ty*((1-tx)*grid[y1,x0]+tx*grid[y1,x1]))

def main():
 native=json.loads(NATIVE_REPORT.read_text())
 geo=json.loads(GEOREF.read_text())
 coarse=json.loads(COARSE.read_text())
 bbox=geo["actualPixelBboxWgs84"]
 if bbox!=[-133.265,57.822,-133.135,57.952]:
  raise RuntimeError("Unexpected corrected WGS84 raster footprint")
 if geo["outputCrs"]!="EPSG:4326":raise RuntimeError("Target CRS not EPSG:4326")
 candidates={x["file"]:x for x in native["nativeRasterCandidates"]}
 if set(EXPECTED)-set(candidates):raise RuntimeError("Native project listing missing one or more required 15-minute DTM tiles")
 source_meta=native["metadataCandidates"][0]
 if source_meta["workunit"]!="AK_IFSAR_Sum_L4_C353_2010" or source_meta["dem_gsd_meters"]!=5:
  raise RuntimeError("Native QL5 source project identity mismatch")
 if source_meta["vert_crs"]!="5703" or source_meta["geoid"]!="GEOID09":
  raise RuntimeError("Native vertical CRS metadata changed; manual review required")

 report={
  "status":"building-source-native-ifsar",
  "sourceProject":source_meta,
  "sourceIndexEvidence":"artifacts/alaska-usgs5m-native-source.json",
  "targetBboxWgs84":bbox,"targetCrs":"EPSG:4326",
  "targetWidth":TARGET_WIDTH,"targetHeight":TARGET_HEIGHT,
  "targetRowOrder":"south-first",
  "heightQuantizationMetres":QUANT,
  "noDataInt16":-32768,
  "sourceTiles":[],"tileSeam":{},
  "verticalDatum":"EPSG:5703 NAVD88 / GEOID09 (official 3DEP index metadata)",
  "verticalCompatibilityWithLegacy30m":"not assumed; coarse comparison is diagnostic only",
  "legacySourceGeoTIFFTagCheck":"see oldRasterGeoreference and legacy30mRegistrationDiagnostics"
 }
 paths=[]
 for filename,expected_size in EXPECTED.items():
  candidate=candidates[filename]
  if candidate["size"]!=expected_size:raise RuntimeError("Native tile catalog size changed: "+filename)
  tif_path=OUT/filename
  key=candidate["key"]
  encoded=urllib.parse.quote(key,safe="/")
  urls=[
   "https://prd-tnm.s3.amazonaws.com/"+encoded,
   "https://prd-tnm.s3.us-west-2.amazonaws.com/"+encoded,
   "https://prd-tnm.s3.us-east-1.amazonaws.com/"+encoded
  ]
  download(urls,tif_path,expected_size)
  xml_url=candidate["url"][:-4]+".xml"
  xml_path=OUT/(filename[:-4]+".xml")
  xml_name=filename[:-4]+".xml"
  xml_meta=next((x for x in native["objects"] if x["file"]==xml_name),None)
  if not xml_meta or not isinstance(xml_meta.get("size"),int):
   raise RuntimeError("Native OPR per-tile XML metadata missing from official listing: "+xml_name)
  xml_urls=[xml_url,
   "https://prd-tnm.s3.us-west-2.amazonaws.com/"+urllib.parse.quote(xml_meta["key"],safe="/"),
   "https://prd-tnm.s3.us-east-1.amazonaws.com/"+urllib.parse.quote(xml_meta["key"],safe="/")]
  try:
   download(xml_urls,xml_path,xml_meta["size"])
  except Exception as metadata_error:
   report.setdefault("metadataXmlWarnings",[]).append(str(metadata_error))
  report["sourceTiles"].append({
    "file":filename,"url":candidate["url"],"expectedBytes":expected_size,
    "bytes":tif_path.stat().st_size,"sha256":sha256(tif_path),
    "metadataXmlUrl":xml_url,"metadataXmlSha256":sha256(xml_path),
    "metadataXmlBytes":xml_path.stat().st_size
  })
  paths.append(tif_path)

 west,south,east,north=bbox
 dst_transform=from_bounds(west,south,east,north,TARGET_WIDTH,TARGET_HEIGHT)
 dst_crs=CRS.from_epsg(4326)
 dst=np.full((TARGET_HEIGHT,TARGET_WIDTH),NODATA_OUT,dtype=np.float32)
 source_id=np.zeros((TARGET_HEIGHT,TARGET_WIDTH),dtype=np.uint8)
 tile_infos=[]
 seam_overlap=[]
 for tile_idx,tif_path in enumerate(paths,1):
  with rasterio.open(tif_path) as ds:
   if ds.count!=1:raise RuntimeError("Native DTM must be single-band: "+tif_path.name)
   if ds.crs is None:raise RuntimeError("Native DTM missing horizontal CRS")
   if not (4.8<=abs(ds.res[0])<=5.2 and 4.8<=abs(ds.res[1])<=5.2):
    raise RuntimeError("Native OPR tile is not 5m post spacing: "+str(ds.res))
   transformed=transform_bounds(ds.crs,dst_crs,*ds.bounds,densify_pts=41)
   info={"file":tif_path.name,"width":ds.width,"height":ds.height,
     "crs":ds.crs.to_string(),"crsWkt":ds.crs.to_wkt(),
     "boundsNative":list(ds.bounds),"boundsWgs84":[round(x,9) for x in transformed],
     "resolutionNativeMetres":list(ds.res),"dtype":ds.dtypes[0],
     "nodata":ds.nodata,"bandTags":ds.tags(1),"datasetTags":ds.tags()}
   if not (transformed[0]<=west+1e-5 and transformed[1]<=south+1e-5 and
           transformed[2]>=east-1e-5 and transformed[3]>=north-1e-5):
    # Each 15-minute tile covers only part of the target; report its extent,
    # not a false claim that each tile alone covers the full bbox.
    pass
   tile_infos.append(info)
   tmp=np.full_like(dst,NODATA_OUT)
   reproject(source=rasterio.band(ds,1),destination=tmp,
     src_transform=ds.transform,src_crs=ds.crs,src_nodata=ds.nodata,
     dst_transform=dst_transform,dst_crs=dst_crs,dst_nodata=NODATA_OUT,
     resampling=Resampling.bilinear,num_threads=2,warp_mem_limit=512)
   valid=(np.isfinite(tmp)&(tmp!=NODATA_OUT))
   existing=(np.isfinite(dst)&(dst!=NODATA_OUT))
   overlap=valid&existing
   if overlap.any():
    seam_overlap.append({"tile":tif_path.name,"overlap":dist((tmp-dst)[overlap])})
   fill=valid&~existing
   dst[fill]=tmp[fill]
   source_id[fill]=tile_idx

 valid=np.isfinite(dst)&(dst!=NODATA_OUT)
 south_first=dst[::-1,:]
 valid_fraction=float(valid.mean())
 if valid_fraction<.999:
  raise RuntimeError("Native source mosaic leaves NoData inside target bbox: "+str(valid_fraction))
 report["nativeTileInfo"]=tile_infos
 report["tileSeam"]={
  "overlapComparisons":seam_overlap,
  "sourceTileIds":{str(i):p.name for i,p in enumerate(paths,1)},
  "coverageValidFraction":round(valid_fraction,8),
  "missingCells":int((~valid).sum()),
  "boundaryTransitionCellCount":int(np.count_nonzero(
    (source_id[:,:-1]!=source_id[:,1:])&(source_id[:,:-1]>0)&(source_id[:,1:]>0))),
  "boundaryGradientP95Metres":None
 }
 # Quantify gradients across the source tile boundary against within-tile
 # neighbouring gradients; a tile boundary must not create an artificial cliff.
 horiz=np.abs(dst[:,:-1]-dst[:,1:])
 hvalid=valid[:,:-1]&valid[:,1:]
 same=(source_id[:,:-1]==source_id[:,1:])
 across=hvalid&~same
 within=hvalid&same
 if across.any() and within.any():
  report["tileSeam"]["boundaryGradientP95Metres"]=round(float(np.percentile(horiz[across],95)),3)
  report["tileSeam"]["withinTileGradientP95Metres"]=round(float(np.percentile(horiz[within],95)),3)
  report["tileSeam"]["boundaryGradientP99Metres"]=round(float(np.percentile(horiz[across],99)),3)
 if report["tileSeam"]["boundaryGradientP95Metres"] is None or \
    report["tileSeam"]["boundaryGradientP95Metres"]>10:
  raise RuntimeError("Native IfSAR project-tile boundary exceeds 10m P95 gradient guard")
 if not seam_overlap or seam_overlap[0]["overlap"]["rmse_m"]>0.5 or \
    seam_overlap[0]["overlap"]["p95_abs_m"]>1.0:
  raise RuntimeError("Native IfSAR source-tile overlap failed 0.5m RMSE / 1m P95 guard")
 report["elevationRangeMetres"]={
   "min":round(float(dst[valid].min()),3),"max":round(float(dst[valid].max()),3),
   "mean":round(float(dst[valid].mean()),3),"p50":round(float(np.median(dst[valid])),3)}
 # Confirm the 25 source-index sample points map to actual valid native pixels.
 sample=[]
 for row in range(5):
  for col in range(5):
   lon=west+(east-west)*([.05,.25,.5,.75,.95][col])
   lat=south+(north-south)*([.05,.25,.5,.75,.95][row])
   ix=min(TARGET_WIDTH-1,max(0,int((lon-west)/(east-west)*TARGET_WIDTH)))
   iy=min(TARGET_HEIGHT-1,max(0,int((lat-south)/(north-south)*TARGET_HEIGHT)))
   sample.append({"col":col,"row":row,"lon":round(lon,7),"lat":round(lat,7),
      "validNativeRaster":bool(valid[::-1,:][iy,ix]),"elevationM":round(float(south_first[iy,ix]),2) if valid[::-1,:][iy,ix] else None})
 if not all(x["validNativeRaster"] for x in sample):
  raise RuntimeError("Native raster fails one or more 25-point footprint checks")
 report["nativeRasterCoverageSamples"]=sample
 # Cross-check the independent dynamic ImageServer 5m sample against the
 # source-native OPR mosaic at identical WGS84 pixel centres.
 fine_path=ART/"alaska-tracyarm-five-metre-tile.json"
 if fine_path.exists():
  fine_meta=json.loads(fine_path.read_text())
  fine=np.frombuffer(base64.b64decode(fine_meta["heightsBase64"],validate=True),
    dtype="<i2").reshape((fine_meta["height"],fine_meta["width"])).astype(np.float64)*float(fine_meta["metresPerInteger"])
  FW,FS,FE,FN=fine_meta["bbox"]
  fx=FW+(np.arange(fine_meta["width"])+.5)*(FE-FW)/fine_meta["width"]
  fy=FS+(np.arange(fine_meta["height"])+.5)*(FN-FS)/fine_meta["height"]
  FX,FY=np.meshgrid((fx-west)/(east-west)*TARGET_WIDTH-.5,
                    (fy-south)/(north-south)*TARGET_HEIGHT-.5)
  native_at_fine=bilinear(south_first,FX,FY)
  fine_valid=(fine!=fine_meta["noDataInt16"])&np.isfinite(fine)
  report["dynamic5mImageServerCrossCheck"]={
    "adjustAspectRatio":fine_meta.get("adjustAspectRatio"),
    "sourceRawTiffSha256":fine_meta.get("sourceRawTiffSha256"),
    "sameWgs84Coordinates":True,
    "finePixelCount":int(fine_valid.sum()),
    "native5mMinusDynamic5m":dist((native_at_fine-fine)[fine_valid]),
    "interpretation":"Independent dynamic ImageServer 5m sample vs official source-native OPR 5m tiles; source consistency diagnostic."
  }
 else:
  report["dynamic5mImageServerCrossCheck"]={"status":"not-run; sample asset not built before native mosaic"}
 # Fetch the exact original 30m ImageServer TIFF and inspect its GeoTIFF
 # pixel-to-world tags. f=json extent is not assumed to equal TIFF extent.
 old_url=coarse["sourceQuery"]
 req=urllib.request.Request(old_url,headers={"User-Agent":"PATROL-USGS-GeoTIFF-georef-QA/1.0"})
 with urllib.request.urlopen(req,timeout=60) as response:
  old_tiff=response.read(4_000_001)
 if len(old_tiff)>4_000_000:raise RuntimeError("Original 30m TIFF exceeded safe QA size")
 with tifffile.TiffFile(io.BytesIO(old_tiff)) as old_tif:
  old_raster=old_tif.asarray()
  old_page=old_tif.pages[0]
  old_tags={}
  for tag_name in ("ModelPixelScaleTag","ModelTiepointTag","ModelTransformationTag","GeoKeyDirectoryTag","GeoAsciiParamsTag"):
   tag=old_page.tags.get(tag_name)
   if tag is not None:
    value=tag.value
    old_tags[tag_name]=value.tolist() if hasattr(value,"tolist") else (list(value) if isinstance(value,tuple) else value)
 old_bbox=None
 scale=old_tags.get("ModelPixelScaleTag");tie=old_tags.get("ModelTiepointTag")
 if scale and tie and len(scale)>=2 and len(tie)>=6:
  old_bbox=[float(tie[3]),float(tie[4]-scale[1]*old_raster.shape[0]),
            float(tie[3]+scale[0]*old_raster.shape[1]),float(tie[4])]
 old=np.frombuffer(base64.b64decode(coarse["heightsBase64"],validate=True),
   dtype="<u2").reshape((256,256)).astype(np.float64)
 if old_raster.shape!=(256,256):raise RuntimeError("Fresh original USGS TIFF shape changed")
 # Verify the baked array orientation against the raw source TIFF itself.
 fresh_south=np.maximum(old_raster[::-1].astype(np.float64),0)
 fresh_south=np.rint(fresh_south).clip(0,8000)
 report["oldRasterGeoreference"]={
  "requestedBbox":coarse["bbox"],"fJsonBbox":geo["actualPixelBboxWgs84"],
  "geoTiffTags":old_tags,"bboxDerivedFromGeoTiff":old_bbox,
  "rawTiffSha256":hashlib.sha256(old_tiff).hexdigest(),
  "bakedMatchesFreshSouthFirst":int(np.count_nonzero(fresh_south==old)),
  "pixelCount":int(old.size),
  "fJsonMatchesGeoTiffTags":bool(old_bbox and max(abs(a-b) for a,b in zip(old_bbox,geo["actualPixelBboxWgs84"]))<1e-8)
 }
 rows=np.arange(0,TARGET_HEIGHT,16);cols=np.arange(0,TARGET_WIDTH,16)
 lons=west+(cols+.5)*(east-west)/TARGET_WIDTH
 lats=south+(rows+.5)*(north-south)/TARGET_HEIGHT
 new_sample=south_first[np.ix_(rows,cols)].astype(np.float64)
 valid_sample=(new_sample!=NODATA_OUT)
 bbox_options={"requested":coarse["bbox"],"fJson":geo["actualPixelBboxWgs84"]}
 if old_bbox:bbox_options["geoTiffTags"]=old_bbox
 orientation_options={
  "asBaked":old,"flipY":old[::-1,:],"flipX":old[:,::-1],
  "flipXY":old[::-1,::-1],"transpose":old.T,
  "rotate90CW":np.rot90(old,-1),"rotate90CCW":np.rot90(old,1)
 }
 orient_report=[]
 for bbox_name,ob in bbox_options.items():
  ow,os_,oe,on=ob
  XX,YY=np.meshgrid((lons-ow)/(oe-ow)*256-.5,(lats-os_)/(on-os_)*256-.5)
  for orient_name,orient in orientation_options.items():
   base_valid=(XX>=0)&(XX<=255)&(YY>=0)&(YY<=255)
   best=None
   for dy in range(-12,13):
    for dx in range(-12,13):
     sample_valid=(valid_sample&(XX+dx>=0)&(XX+dx<=255)&
       (YY+dy>=0)&(YY+dy<=255))
     if not sample_valid.any():continue
     interp=bilinear(orient,XX+dx,YY+dy)
     delta=new_sample[sample_valid]-interp[sample_valid]
     rmse=float(np.sqrt(np.mean(delta*delta)))
     if best is None or rmse<best["rmse"]:
      best={"rmse":rmse,"dx":dx,"dy":dy,"n":int(sample_valid.sum()),
        "bias":float(np.mean(delta))}
   if best:
    orient_report.append({"bbox":bbox_name,"orientation":orient_name,
      "rmse":round(best["rmse"],3),"bias":round(best["bias"],3),
      "bestShift30mPx":[best["dx"],best["dy"]],"n":best["n"],
      "searchBoundary":abs(best["dx"])==12 or abs(best["dy"])==12})
 report["legacy30mRegistrationDiagnostics"]=sorted(orient_report,key=lambda x:x["rmse"])[:12]
 # Use TIFF-tag bbox for the primary diagnostic if present; otherwise use the
 # server JSON bbox. Never move pixels to make this diagnostic look better.
 OW,OS,OE,ON=old_bbox if old_bbox else geo["actualPixelBboxWgs84"]
 rows=np.arange(0,TARGET_HEIGHT,4);cols=np.arange(0,TARGET_WIDTH,4)
 lons=west+(cols+.5)*(east-west)/TARGET_WIDTH
 lats=south+(rows+.5)*(north-south)/TARGET_HEIGHT
 XX,YY=np.meshgrid((lons-OW)/(OE-OW)*256-.5,(lats-OS)/(ON-OS)*256-.5)
 old_interp=bilinear(old,XX,YY)
 new_sample=south_first[np.ix_(rows,cols)].astype(np.float64)
 valid_sample=(new_sample!=NODATA_OUT)
 def edge_comparison(side):
  if side=="west":rr=np.arange(TARGET_HEIGHT);cc=np.zeros(TARGET_HEIGHT,dtype=np.int64)
  elif side=="east":rr=np.arange(TARGET_HEIGHT);cc=np.full(TARGET_HEIGHT,TARGET_WIDTH-1,dtype=np.int64)
  elif side=="south":rr=np.zeros(TARGET_WIDTH,dtype=np.int64);cc=np.arange(TARGET_WIDTH)
  else:rr=np.full(TARGET_WIDTH,TARGET_HEIGHT-1,dtype=np.int64);cc=np.arange(TARGET_WIDTH)
  lon=west+(cc+.5)*(east-west)/TARGET_WIDTH
  lat=south+(rr+.5)*(north-south)/TARGET_HEIGHT
  ox=(lon-OW)/(OE-OW)*256-.5;oy=(lat-OS)/(ON-OS)*256-.5
  old_edge=bilinear(old,ox,oy)
  new_edge=south_first[rr,cc]
  mask=valid[rr,cc]
  return dist(new_edge[mask]-old_edge[mask])
 report["legacy30mComparison"]={
   "sampleStep":4,"comparisonBboxSource":"GeoTIFF tags" if old_bbox else "USGS f=json",
   "verticalDatumCompatibility":"not independently established; do not blend based on this comparison",
   "native5mMinusLegacy30m":dist((new_sample-old_interp)[valid_sample]),
   "edges":{side:edge_comparison(side) for side in ("west","east","south","north")}
 }
 # Reproject output is north-first; runtime geodesy module expects south-first.
 # Store a 2D predictive residual grid (left/up/up-left) before gzip. The
 # absolute elevation range is retained exactly at 0.1m int16 precision.
 q=np.full(south_first.shape,-32768,dtype="<i2")
 q[valid[::-1,:]]=np.rint(south_first[valid[::-1,:]]/QUANT).clip(-32767,32767).astype("<i2")
 absolute_raw=q.tobytes(order="C")
 delta=q.astype(np.int32)
 delta[0,1:]=q[0,1:].astype(np.int32)-q[0,:-1].astype(np.int32)
 delta[1:,0]=q[1:,0].astype(np.int32)-q[:-1,0].astype(np.int32)
 delta[1:,1:]=(q[1:,1:].astype(np.int32)-q[1:,:-1].astype(np.int32)
   -q[:-1,1:].astype(np.int32)+q[:-1,:-1].astype(np.int32))
 if delta.min()<-32767 or delta.max()>32767:
  raise RuntimeError("2D elevation residual exceeds signed int16; do not truncate")
 delta_raw=delta.astype("<i2").tobytes(order="C")
 compressed=gzip.compress(delta_raw,compresslevel=9,mtime=0)
 gz_path=ART/"alaska-tracyarm-ifsar5m-delta2-int16.bin.gz"
 b64_path=ART/"alaska-tracyarm-ifsar5m-delta2-int16.bin.gz.b64"
 gz_path.write_bytes(compressed)
 b64_path.write_text(base64.b64encode(compressed).decode("ascii")+"\n")
 report["runtimeAsset"]={
   "format":"patrol-ifsar5m-delta2-int16-gzip-base64-v1",
   "encoding":"2d-residual: first-row horizontal deltas; first-column vertical deltas; interior current-left-up+up-left",
   "absoluteRawBytes":len(absolute_raw),"deltaRawBytes":len(delta_raw),
   "gzipBytes":len(compressed),"base64Bytes":b64_path.stat().st_size,
   "absoluteRawSha256":hashlib.sha256(absolute_raw).hexdigest(),
   "deltaRawSha256":hashlib.sha256(delta_raw).hexdigest(),
   "gzipSha256":sha256(gz_path),"base64Sha256":sha256(b64_path),
   "assetPath":"assets/alaska/tracy-arm-ifsar5m-delta2-int16.bin.gz.b64",
   "width":TARGET_WIDTH,"height":TARGET_HEIGHT,
   "metresPerInteger":QUANT,"noDataInt16":-32768,
   "bboxWgs84":bbox,"rowOrder":"south-first"
 }
 manifest={
   "format":"patrol-ifsar5m-delta2-int16-gzip-base64-v1",
   "assetPath":"./tracy-arm-ifsar5m-delta2-int16.bin.gz.b64",
   "width":TARGET_WIDTH,"height":TARGET_HEIGHT,
   "bboxWgs84":bbox,"crs":"EPSG:4326","rowOrder":"south-first",
   "metresPerInteger":QUANT,"noDataInt16":-32768,
   "sourceHorizontalCrs":"ESRI:102247",
   "sourceVerticalCrs":"EPSG:5703","verticalDatum":"NAVD88",
   "geoid":"GEOID09","collectionStart":source_meta["collect_start"],
   "collectionEnd":source_meta["collect_end"],
   "workunit":source_meta["workunit"],"project":source_meta["project"],
   "sourceTileSha256":[x["sha256"] for x in report["sourceTiles"]],
   "coverageValidFraction":report["tileSeam"]["coverageValidFraction"],
   "tileSeamP95Metres":report["tileSeam"]["boundaryGradientP95Metres"],
   "withinTileGradientP95Metres":report["tileSeam"]["withinTileGradientP95Metres"],
   "tileSeamP99Metres":report["tileSeam"]["boundaryGradientP99Metres"],
   "tileOverlapRmseMetres":seam_overlap[0]["overlap"]["rmse_m"],
   "tileOverlapP95AbsMetres":seam_overlap[0]["overlap"]["p95_abs_m"],
   "sourceLicense":"USGS 3DEP public domain",
   "verticalDatumEvidence":"Official USGS 3DEP index metadata EPSG:5703 / GEOID09; native tile XML directs users to original project metadata for vertical accuracy. Do not treat as WGS84 ellipsoid height.",
   "absoluteRawSha256":report["runtimeAsset"]["absoluteRawSha256"],
   "deltaRawSha256":report["runtimeAsset"]["deltaRawSha256"],
   "gzipSha256":report["runtimeAsset"]["gzipSha256"],
   "encoding":report["runtimeAsset"]["encoding"]
 }
 (ART/"alaska-tracyarm-ifsar5m-manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
 report["status"]="native-5m-mosaic-verified; opt-in-15m-LOD-flight-renderer-implemented; C185-integration-not-accepted"
 report["notYetProven"]=[
   "No post-2025 landslide LiDAR/DEM is included; source acquisition dates are 2010-2012.",
   "NAVD88/GEOID09 values are not WGS84 ellipsoid heights; absolute aircraft altitude conversion is not enabled.",
   "The opt-in full-area renderer uses a 3x3 median 15m mesh LOD from the original 5m source grid.",
   "The 5m runtime manifest and base64 payload are generated as a CI artifact and staged only in the disposable QA checkout.",
   "Default production Alaska map, C185 collision, water physics and other maps have not been changed."
 ]
 (ART/"alaska-tracyarm-ifsar5m-report.json").write_text(json.dumps(report,indent=2)+"\n")
 print("PASS native IfSAR 5m mosaic "+json.dumps({
  "sourceTiles":[x["file"] for x in report["sourceTiles"]],
  "validFraction":valid_fraction,"elevationRange":report["elevationRangeMetres"],
  "seam":report["tileSeam"],"comparison":report["legacy30mComparison"]["native5mMinusLegacy30m"],
  "asset":report["runtimeAsset"]
 },separators=(",",":")))

if __name__=="__main__":
 main()
