#!/usr/bin/env python3
import argparse, json
from pathlib import Path
import pyarrow.parquet as pq
from pyproj import Transformer
from shapely import from_wkb
from shapely.geometry import box

def normalize_tags(value):
    if value is None: return {}
    if hasattr(value, "as_py"): value=value.as_py()
    if isinstance(value, dict): return {str(k):str(v) for k,v in value.items() if v is not None}
    out={}
    if isinstance(value,(list,tuple)):
        for item in value:
            if isinstance(item,dict) and "key" in item and "value" in item:
                if item["value"] is not None: out[str(item["key"])]=str(item["value"])
            elif isinstance(item,(list,tuple)) and len(item)==2 and item[1] is not None:
                out[str(item[0])]=str(item[1])
    return out

def row_to_element(row,bbox_geom,to_wgs84):
    kind=str(row.get("osm_type") or "")
    if kind not in ("way","relation"): return None
    tags=normalize_tags(row.get("tags"))
    if not tags.get("building") and not tags.get("building:part"): return None
    raw=row.get("geometry")
    if raw is None: return None
    try: geom=from_wkb(bytes(raw))
    except Exception: return None
    if geom.is_empty or not geom.intersects(bbox_geom): return None
    polys=list(geom.geoms) if geom.geom_type=="MultiPolygon" else [geom]
    polys=[p for p in polys if p.geom_type=="Polygon" and not p.is_empty]
    if not polys: return None
    poly=max(polys,key=lambda p:p.area)
    item={"type":kind,"id":int(row["osm_id"]),"tags":tags}
    if kind=="way":
        item["geometry"]=[{"lon":float(lon),"lat":float(lat)}
            for lon,lat in (to_wgs84.transform(x,y) for x,y in poly.exterior.coords)]
    return item

def extract(nycosm_root,source_path,output_path):
    source=json.loads(Path(source_path).read_text(encoding="utf-8"))
    fwd=Transformer.from_crs("EPSG:4326","EPSG:2263",always_xy=True)
    rev=Transformer.from_crs("EPSG:2263","EPSG:4326",always_xy=True)
    west,south,east,north=source["bboxWGS84"]
    corners=[fwd.transform(west,south),fwd.transform(west,north),fwd.transform(east,south),fwd.transform(east,north)]
    bbox=box(min(x for x,y in corners),min(y for x,y in corners),max(x for x,y in corners),max(y for x,y in corners))
    root=Path(nycosm_root)
    layers=[
      (root/"inst/extdata/nyc_osm_buildings_manhattan.parquet",False),
      (root/"inst/extdata/nyc_osm_areas.parquet",True)
    ]
    elements=[];scanned={"manhattan_buildings":0,"areas":0}
    for path,parts_only in layers:
        pf=pq.ParquetFile(path)
        for batch in pf.iter_batches(batch_size=4096,columns=["osm_type","osm_id","tags","geometry"]):
            for row in batch.to_pylist():
                scanned["areas" if parts_only else "manhattan_buildings"]+=1
                tags=normalize_tags(row.get("tags"))
                if parts_only and not tags.get("building:part"): continue
                item=row_to_element(row,bbox,rev)
                if item is not None: elements.append(item)
    out=Path(output_path);out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps({"elements":elements},separators=(",",":")),encoding="utf-8")
    summary={"source":"kjhealy/nycosm","extractDate":"2026-10-18","license":"ODbL-1.0",
      "attribution":"© OpenStreetMap contributors","bboxWGS84":source["bboxWGS84"],
      "scannedRows":scanned,"elementsInBBox":len(elements),"rawDataIsTemporary":True}
    print(json.dumps(summary,indent=2));return summary

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--nycosm-root",default=".tmp/nycosm")
    p.add_argument("--source",default="assets/nyc/times-square-footprints.json")
    p.add_argument("--out",default="/tmp/nyc-osm-times-square-elements.json")
    a=p.parse_args();extract(a.nycosm_root,a.source,a.out)
if __name__=="__main__": main()
