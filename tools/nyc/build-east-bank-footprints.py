"""Extract near-east-bank CityGML LoD1 ground rings from the downloaded ZIP."""
import argparse
import collections
import json
import math
import re
import zipfile
from pathlib import Path

ANCHOR = (300802.88994777395, 59279.95326019298)  # Brooklyn bridgehead, EPSG:32118
END = b'</cityObjectMember>'
LOWER = re.compile(rb'<gml:lowerCorner>([^<]+)<')
UPPER = re.compile(rb'<gml:upperCorner>([^<]+)<')
BIN = re.compile(rb'<gen:(?:int|string)Attribute name="(?:Adress_bin|building_identification_nuber)">\s*<gen:value>([234])\d{6}</gen:value>')
RING = re.compile(rb'<gml:posList[^>]*>([^<]+)<')

def project(e, n, borough):
    # South Bronx anchor, EPSG:32118. Keep north-up and reserve the
    # game’s existing Harlem River gap instead of laying meshes over water.
    if borough==2:
        e, n = e-306244.0046760618, n-71220.28939242958
        return 361 + .072*e + .019*n, 498 - .018*e + .057*n
    if borough==4:
        # Long Island City anchor (western Queens). A separate placement
        # keeps this waterfront district inside the compact flight boundary.
        e, n = e-304726.6838162222, n-68887.12385142752
        return 381 + .075*e + .016*n, 305 - .015*e + .064*n
    e, n = e-ANCHOR[0], n-ANCHOR[1]
    return 247 + .076*e + .022*n, -342 - .018*e + .095*n

def records(f):
    tail = b''
    while chunk := f.read(8*1024*1024):
        *parts, tail = (tail + chunk).split(END)
        yield from parts

def signed_area(poly):
    return sum(x*b-z*a for (x,z),(a,b) in zip(poly,poly[1:]+poly[:1]))*.5

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive',type=Path)
    parser.add_argument('output',type=Path)
    args=parser.parse_args()
    cells=collections.defaultdict(list)
    source=0
    with zipfile.ZipFile(args.archive) as archive, archive.open(archive.namelist()[0]) as f:
        for source, record in enumerate(records(f),1):
            lo=LOWER.search(record)
            if not lo: continue
            e,n,base=map(float,lo[1].split())
            if not (299500<e<314000 and 58000<n<76200): continue
            borough=BIN.search(record)
            hi=UPPER.search(record)
            if not borough or not hi: continue
            borough=int(borough[1])
            x,z=project(e,n,borough)
            if not ({2:460,3:-409,4:96}[borough]<z<{2:670,3:330,4:478}[borough]
                    and .24*z+225<x and x*x+z*z<745**2): continue
            height=float(hi[1].split()[-1])-base
            if not .8<=height<400: continue
            key=(int(x//14),int(z//14))
            candidates=cells[key]
            score=height
            if len(candidates)>=12 and score<=candidates[-1][0]: continue
            solid=record.find(b'<bldg:lod1Solid>')
            if solid<0: continue
            floor=[]
            area=0
            for ring in RING.finditer(record,solid):
                vals=list(map(float,ring[1].split()))
                if len(vals)<12 or len(vals)>195 or len(vals)%3: continue
                if any(abs(v-base)>.08 for v in vals[2::3]): continue
                pts=list(dict.fromkeys(tuple(round(t,2) for t in project(a,b,borough))
                    for a,b in zip(vals[::3],vals[1::3])))
                if len(pts)<3: continue
                size=abs(signed_area(pts))
                if size>area: area,floor=size,pts
            if area<.45: continue
            xs,zs=zip(*floor)
            w,d=max(xs)-min(xs),max(zs)-min(zs)
            if not (.45<w<35 and .45<d<45): continue
            row=[source+4000000,round((min(xs)+max(xs))/2,2),
                 round((min(zs)+max(zs))/2,2),round(w+.02,2),round(d+.02,2),
                 round(max(.42,height*.15),2),floor,borough]
            candidates.append((score,row))
            candidates.sort(key=lambda item:(-item[0],item[1][0]))
            del candidates[12:]
    rows=[row for group in cells.values() for _,row in group]
    args.output.parent.mkdir(parents=True,exist_ok=True)
    tmp=args.output.with_suffix('.tmp')
    tmp.write_text(json.dumps({'schema':'patrol-east-bank-footprints-v2','sourceCount':source,
        'footprints':rows},separators=(',',':')),encoding='utf8')
    tmp.replace(args.output)
    print(source,len(rows),dict(collections.Counter(r[-1] for r in rows)),flush=True)

if __name__=='__main__':
    main()
