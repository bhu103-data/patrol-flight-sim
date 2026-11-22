#!/usr/bin/env python3
"""Download and build the source-native USGS 5m IfSAR Tracy Arm DEM clip.

This is the production-candidate path: native OPR GeoTIFFs, not an ImageServer
resample. It mosaics the two adjacent 15-minute tiles from the SAME QL5 project,
verifies CRS/resolution/NoData/footprint, reprojects to the corrected actual
WGS84 bbox, and emits a south-first int16 0.1m grid for a later opt-in renderer.
It does not edit the production map or flight physics.
"""
from __future__ import annotations
import base64,gzip,hashlib,json,math,os,pathlib,time,urllib.request,xml.etree.ElementTree as ET
import numpy as np
import rasterio
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
 "USGS_OPR_Alaska_Mid_Accuracy_DEM_Summer_2015_DTM_N5745W13315P.tif":89998420,
 "USGS_OPR_Alaska_Mid_Accuracy_DEM_Summer_2015_DTM_N5745W13330P.tif":99018238,
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
 tmp=path.with_suffix(path.suffix+".part")
 last=None
 for attempt in range(4):
  try:
   req=urllib.request.Request(url,headers={"User-Agent":"PATROL-USGS-OPR-5m-source-QA/1.0"})
   with urllib.request.urlopen(req,timeout=120) as response,open(tmp,"wb") as out:
    length=response.headers.get("Content-Length")
    if length and int(length)!=expected:raise RuntimeError("USGS Content-Length mismatch "+length)
    while True:
     block=response.read(1024*1024)
     if not block:break
     out.write(block)
   if tmp.stat().st_size!=expected:raise RuntimeError("USGS tile byte count mismatch")
   tmp.replace(path);return
  except Exception as e:
   last=e
   if tmp.exists():tmp.unlink()
   if attempt<3:time.sleep(2**attempt)
 raise RuntimeError("Failed native USGS tile download: "+str(last))

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
  "verticalCompatibilityWithLegacy30m":"not assumed; coarse comparison is diagnostic only"
 }
 paths=[]
 for filename,expected_size in EXPECTED.items():
  candidate=candidates[filename]
  if candidate["size"]!=expected_size:raise RuntimeError("Native tile catalog size changed: "+filename)
  tif_path=OUT/filename
  download(candidate["url"],tif_path,expected_size)
  xml_url=candidate["url"][:-4]+".xml"
  xml_path=OUT/(filename[:-4]+".xml")
  download(xml_url,xml_path,10486 if "N5745" in filename else 10486)
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
      "validNativeRaster":bool(valid[iy,ix]),"elevationM":round(float(dst[iy,ix]),2) if valid[iy,ix] else None})
 if not all(x["validNativeRaster"] for x in sample):
  raise RuntimeError("Native raster fails one or more 25-point footprint checks")
 report["nativeRasterCoverageSamples"]=sample
 # Compare to the existing 30m grid using its server-verified actual pixel bbox.
 old=np.frombuffer(base64.b64decode(coarse["heightsBase64"],validate=True),
   dtype="<u2").reshape((256,256)).astype(np.float64)
 OW,OS,OE,ON=geo["actualPixelBboxWgs84"]
 rows=np.arange(0,TARGET_HEIGHT,4);cols=np.arange(0,TARGET_WIDTH,4)
 lons=west+(cols+.5)*(east-west)/TARGET_WIDTH
 lats=south+(rows+.5)*(north-south)/TARGET_HEIGHT
 XX,YY=np.meshgrid((lons-OW)/(OE-OW)*256-.5,(lats-OS)/(ON-OS)*256-.5)
 old_interp=bilinear(old,XX,YY)
 new_sample=dst[np.ix_(rows,cols)].astype(np.float64)
 valid_sample=(new_sample!=NODATA_OUT)
 report["legacy30mComparison"]={
   "sampleStep":4,"verticalDatumCompatibility":"not independently established; do not blend based on this comparison",
   "native5mMinusLegacy30m":dist((new_sample-old_interp)[valid_sample]),
   "edges":{
     "west":dist(dst[valid,0] if False else dst[:,0][valid[:,0]]-old_interp[:,0][valid_sample[:,0]]),
     "east":dist(dst[:,-1][valid[:,-1]]-old_interp[:,-1][valid_sample[:,-1]]),
     "south":dist(dst[0,:][valid[0,:]]-old_interp[0,:][valid_sample[0,:]]),
     "north":dist(dst[-1,:][valid[-1,:]]-old_interp[-1,:][valid_sample[-1,:]])
   }
 }
 # Reproject output is north-first; runtime geodesy module expects south-first.
 south_first=dst[::-1,:]
 q=np.full(south_first.shape,-32768,dtype="<i2")
 q[valid[::-1,:]]=np.rint(south_first[valid[::-1,:]]/QUANT).clip(-32767,32767).astype("<i2")
 raw=q.tobytes(order="C")
 compressed=gzip.compress(raw,compresslevel=9,mtime=0)
 gz_path=ART/"alaska-tracyarm-ifsar5m-int16.bin.gz"
 b64_path=ART/"alaska-tracyarm-ifsar5m-int16.bin.gz.b64"
 gz_path.write_bytes(compressed)
 b64_path.write_text(base64.b64encode(compressed).decode("ascii")+"\n")
 report["runtimeAsset"]={
   "format":"patrol-ifsar5m-int16-gzip-base64-v1",
   "rawBytes":len(raw),"gzipBytes":len(compressed),
   "base64Bytes":b64_path.stat().st_size,
   "rawSha256":hashlib.sha256(raw).hexdigest(),
   "gzipSha256":sha256(gz_path),
   "base64Sha256":sha256(b64_path),
   "width":TARGET_WIDTH,"height":TARGET_HEIGHT,
   "metresPerInteger":QUANT,"noDataInt16":-32768,
   "bboxWgs84":bbox,"rowOrder":"south-first"
 }
 report["status"]="native-5m-mosaic-verified; optional-true-scale-renderer-integration-next"
 report["notYetProven"]=[
   "No post-2025 landslide LiDAR/DEM is included; source acquisition dates are 2010-2012.",
   "Native NAVD88 GEOID09 heights must not be treated as WGS84 ellipsoid height.",
   "This is a 5m source grid; current flight renderer may resample it to its own mesh resolution.",
   "Default production Alaska map and C185 physics have not been changed."
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
