#!/usr/bin/env python3
"""Export the bounded NYC DCP 2014 BK02 cached roof/facade meshes to GLB 2.0."""
from __future__ import annotations
import argparse, hashlib, json, math, pathlib, struct

SCHEMA = "patrol-nyc-dumbo-bk02-2014-cached-roof-facade-mesh-v1"
ZIP_SHA = "e16f1dae5521f02835042ac5a6a36f3750603b03170d218d7d6b9f2a616c6ff1"
MODEL_SHA = "c22a7e7225425e01b5f50e5d68f6dc75b93a9d05c8a4ae566f1c1d40ec981493"
COLORS = {"roof":[0.58,0.66,0.72,1.0],"facade":[0.36,0.48,0.56,1.0],"footprint":[0.20,0.30,0.36,1.0]}

def pad4(data):
    return data + b"\0" * ((-len(data)) % 4)
def f32(values):
    return struct.pack("<" + "f" * len(values), *values)
def u32(values):
    return struct.pack("<" + "I" * len(values), *values)

def convert_patch(patch, z_base):
    raw, indices = patch.get("vertices"), patch.get("triangles")
    if not isinstance(raw,list) or len(raw)!=patch.get("vertexCount",-1)*3:
        raise ValueError("Invalid BK02 source vertex pool")
    if not isinstance(indices,list) or len(indices)!=patch.get("triangleCount",-1)*3:
        raise ValueError("Invalid BK02 source triangle pool")
    if len(raw)<9 or len(indices)<3:
        raise ValueError("Empty BK02 source patch")
    if any(not isinstance(v,(int,float)) or not math.isfinite(v) for v in raw):
        raise ValueError("Non-finite BK02 source vertex")
    if any(not isinstance(i,int) or i<0 or i>=len(raw)//3 for i in indices):
        raise ValueError("BK02 source index outside vertex pool")
    positions=[]
    for i in range(0,len(raw),3):
        east,south,z_ft=raw[i:i+3]
        positions.extend((float(east),(float(z_ft)-z_base)*0.3048,float(south)))
    normals=[0.0]*len(positions)
    for i in range(0,len(indices),3):
        ia,ib,ic=indices[i:i+3]
        a,b,c=(positions[k*3:k*3+3] for k in (ia,ib,ic))
        u=[b[k]-a[k] for k in range(3)]
        v=[c[k]-a[k] for k in range(3)]
        n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
        mag=math.sqrt(sum(x*x for x in n))
        if not math.isfinite(mag) or mag<1e-9:
            raise ValueError("Degenerate BK02 source triangle")
        for idx in (ia,ib,ic):
            for k in range(3): normals[idx*3+k]+=n[k]
    for i in range(0,len(normals),3):
        n=normals[i:i+3];mag=math.sqrt(sum(x*x for x in n))
        if not math.isfinite(mag): raise ValueError("Non-finite BK02 vertex normal")
        # Rhino cached patches may contain unreferenced pool vertices.
        normals[i:i+3]=[0.0,1.0,0.0] if mag<1e-9 else [x/mag for x in n]
    return positions,normals,indices

def build_glb(source, output_path, provenance_path):
    if source.get("schema")!=SCHEMA: raise ValueError("Unexpected BK02 source mesh schema")
    if source.get("sourceZipSha256")!=ZIP_SHA or source.get("source3dmSha256")!=MODEL_SHA:
        raise ValueError("BK02 source archive/model hash mismatch")
    if source.get("modelUnitSystem")!="UnitSystem.Feet" or source.get("verticalDatumVerified") is not False:
        raise ValueError("BK02 source units or vertical datum gate failed")
    z_range=source.get("rawSourceZRhinoFeetRange")
    if not isinstance(z_range,list) or len(z_range)!=2 or not all(math.isfinite(x) for x in z_range) or z_range[1]<=z_range[0]:
        raise ValueError("Invalid BK02 source Z range")
    patches=source.get("meshPatches")
    if not isinstance(patches,list) or not patches: raise ValueError("No BK02 source mesh patches")
    grouped={k:{"p":[],"n":[],"i":[],"patches":0} for k in COLORS}
    for patch in patches:
        kind=patch.get("kind")
        if kind not in grouped: raise ValueError("Unknown BK02 source surface layer")
        p,n,ix=convert_patch(patch,float(z_range[0]))
        target=grouped[kind];offset=len(target["p"])//3
        target["p"].extend(p);target["n"].extend(n)
        target["i"].extend(offset+int(i) for i in ix);target["patches"]+=1

    binary=bytearray();views=[];accessors=[];primitives=[];stats={}
    def add_view(data,target):
        while len(binary)%4: binary.append(0)
        offset=len(binary);binary.extend(data)
        views.append({"buffer":0,"byteOffset":offset,"byteLength":len(data),"target":target})
        return len(views)-1
    def add_accessor(view_index,component_type,count,typ,minimum=None,maximum=None):
        item={"bufferView":view_index,"byteOffset":0,"componentType":component_type,"count":count,"type":typ}
        if minimum is not None:item["min"]=minimum
        if maximum is not None:item["max"]=maximum
        accessors.append(item);return len(accessors)-1
    for material_index,kind in enumerate(("roof","facade","footprint")):
        g=grouped[kind]
        if not g["i"] or len(g["p"])!=len(g["n"]): raise ValueError("Missing or mismatched BK02 "+kind+" arrays")
        vertex_count=len(g["p"])//3;triangle_count=len(g["i"])//3
        mins=[min(g["p"][axis::3]) for axis in range(3)]
        maxs=[max(g["p"][axis::3]) for axis in range(3)]
        pv=add_view(f32(g["p"]),34962);nv=add_view(f32(g["n"]),34962);iv=add_view(u32(g["i"]),34963)
        pa=add_accessor(pv,5126,vertex_count,"VEC3",mins,maxs)
        na=add_accessor(nv,5126,vertex_count,"VEC3")
        ia=add_accessor(iv,5125,len(g["i"]),"SCALAR")
        primitives.append({"attributes":{"POSITION":pa,"NORMAL":na},"indices":ia,"material":material_index,"mode":4,
            "extras":{"sourceLayerKind":kind,"sourcePatches":g["patches"],"triangles":triangle_count}})
        stats[kind]={"patches":g["patches"],"vertices":vertex_count,"triangles":triangle_count}
    total_triangles=sum(v["triangles"] for v in stats.values())
    if total_triangles!=source.get("counts",{}).get("triangles"):
        raise ValueError("Exported GLB triangle count differs from source cached mesh")
    extras={
        "sourceDataset":"NYC 3D Model by Community District — BK02",
        "publisher":"NYC Department of City Planning / NYC Open Data",
        "sourceVintage":2014,"sourceZipSha256":ZIP_SHA,"source3dmSha256":MODEL_SHA,
        "sourceCoordinateReference":"EPSG:2263 NAD83 New York Long Island US survey feet XY; Rhino document feet Z",
        "viewerCoordinateFrame":"DUMBO local east/up/south metres; origin WGS84 [-73.989, 40.702]",
        "verticalDatumVerified":False,
        "zTransform":"(raw Rhino Z feet - minimum extracted raw Z feet) * 0.3048; relative preview only",
        "sourceMeshMeaning":"Original Rhino cached display tessellation of roof/facade/footprint Brep faces; not exact Brep trim topology or photogrammetry",
        "sourceVintageWarning":"Historical 2014 aerial survey model, not 2026 as-built geometry",
        "diagnosticOffsetApplied":False,
        "diagnosticOffsetNote":"2014-to-2022 footprint report measured candidate +3.5022m east / -0.4438m south; unverified and not applied",
        "runtimeRole":"VISUAL_ONLY_HISTORICAL_SOURCE_LAYER; no collision or current building replacement",
        "modifications":[
            "Bounded extraction from official BK02 Rhino source within DUMBO AOI plus 25m padding",
            "EPSG:2263 US survey foot XY transformed to local DUMBO east/south metres",
            "Rhino Z converted from feet to relative metres from minimum extracted source Z; absolute datum remains unverified",
            "Original cached triangles retained without simplification; per-vertex normals calculated from source triangles",
            "Visualization-only flat PBR base colours assigned by source layer kind; no fabricated textures or signage"
        ]
    }
    materials=[{"name":"2014 source "+kind,"doubleSided":True,
        "pbrMetallicRoughness":{"baseColorFactor":COLORS[kind],"metallicFactor":0.0,"roughnessFactor":0.92}}
        for kind in ("roof","facade","footprint")]
    document={"asset":{"version":"2.0","generator":"PATROL BK02 2014 source mesh exporter","extras":extras},
        "scene":0,"scenes":[{"name":"DUMBO BK02 2014 historical source surfaces","nodes":[0]}],
        "nodes":[{"name":"DUMBO BK02 2014 source mesh","mesh":0}],
        "meshes":[{"name":"DUMBO BK02 2014 source roof facade footprint","primitives":primitives}],
        "materials":materials,"buffers":[{"byteLength":len(binary)}],"bufferViews":views,"accessors":accessors}
    json_raw=json.dumps(document,separators=(",",":"),ensure_ascii=False).encode("utf-8")
    json_chunk=json_raw+b" "*((-len(json_raw))%4)
    bin_chunk=pad4(bytes(binary));total=12+8+len(json_chunk)+8+len(bin_chunk)
    glb=struct.pack("<III",0x46546C67,2,total)
    glb+=struct.pack("<II",len(json_chunk),0x4E4F534A)+json_chunk
    glb+=struct.pack("<II",len(bin_chunk),0x004E4942)+bin_chunk
    output_path.parent.mkdir(parents=True,exist_ok=True);output_path.write_bytes(glb)
    provenance={
        "asset":output_path.name,"assetBytes":len(glb),"assetSha256":hashlib.sha256(glb).hexdigest(),
        "sourceDataset":extras["sourceDataset"],"publisher":extras["publisher"],"sourceVintage":2014,
        "sourceZipSha256":ZIP_SHA,"source3dmSha256":MODEL_SHA,
        "sourceCoordinateReference":extras["sourceCoordinateReference"],"viewerCoordinateFrame":extras["viewerCoordinateFrame"],
        "verticalDatumVerified":False,"diagnosticOffsetApplied":False,"sourceMeshMeaning":extras["sourceMeshMeaning"],
        "counts":stats,"totalTriangles":total_triangles,"totalUniqueVertices":sum(v["vertices"] for v in stats.values()),
        "rawSourceZRhinoFeetRange":z_range,
        "sourceLayerNames":{"roof":"Buildings::Surface_RoofTop","facade":"Buildings::Surface_Facade","footprint":"Buildings::Surface_FootPrint"},
        "usePolicy":"NYC Open Data public-data policy; NOT CC0 or a Creative Commons license. NYC Open Data policy states public datasets are available without restrictions or licensing requirements; identify source, version and modifications when republishing or incorporating into an application.",
        "attribution":"Source: NYC Department of City Planning, NYC 3D Model by Community District — BK02, 2014 aerial survey, via NYC Open Data. Modified by PATROL as described in this provenance record.",
        "terms":["https://data.cityofnewyork.us/stories/s/Terms-of-Use/k9k7-3cje","https://www.nyc.gov/opendata/get-started/FAQs",
            "https://cityofnewyork.github.io/opendatatsm/publicpolicies.html",
            "https://www.nyc.gov/assets/planning/download/pdf/data-maps/open-data/nyc-3d-model-metadata.pdf"],
        "disclaimer":"The City disclaims warranties of completeness, accuracy, content and fitness. This historical 2014 source mesh is not a 2026 as-built model; its absolute vertical datum is unverified; do not use for collision or altitude claims.",
        "modifications":extras["modifications"]}
    provenance_path.parent.mkdir(parents=True,exist_ok=True)
    provenance_path.write_text(json.dumps(provenance,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    return provenance

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--input",type=pathlib.Path,required=True)
    parser.add_argument("--output",type=pathlib.Path,required=True)
    parser.add_argument("--provenance",type=pathlib.Path,required=True)
    args=parser.parse_args()
    source=json.loads(args.input.read_text(encoding="utf-8"))
    result=build_glb(source,args.output,args.provenance)
    print(json.dumps({"asset":result["asset"],"bytes":result["assetBytes"],"sha256":result["assetSha256"],
        "triangles":result["totalTriangles"],"counts":result["counts"],"verticalDatumVerified":False},indent=2))

if __name__=="__main__": main()
