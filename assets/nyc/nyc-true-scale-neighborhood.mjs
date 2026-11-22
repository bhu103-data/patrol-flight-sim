// Opt-in Times Square 1:1 neighbourhood geometry.
// Municipal NYC roof-height / footprint geometry remains authoritative for
// scale and placement. Street centrelines are NYC DCM records, NOT curb edges.
// Wall palettes/windows/road widths/ground treatment are artist-authored
// illustrative materials: this is NOT surveyed facade or roadbed geometry.
import {wgs84ToMeters,signedAreaMeters,triangulateSimplePolygon} from './times-square-metered-massing.mjs';

export const MESH_STRIDE=10;
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
const length=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const tint=(c,s)=>c.map(x=>clamp(x*s,0,1));

export function buildingContains(massing,east,north,eyeHeight){
  for(const b of massing.buildings){
    if(eyeHeight>=b.roofHeightMeters+1.8)continue;
    const ring=b.footprintMeters;
    let inside=false;
    for(let i=0,j=ring.length-1;i<ring.length;j=i++){
      const a=ring[i],c=ring[j];
      if(((a[1]>north)!==(c[1]>north))&&
         east<(c[0]-a[0])*(north-a[1])/(c[1]-a[1])+a[0])inside=!inside;
    }
    if(inside)return b.fid;
  }
  return null;
}

export function buildNeighborhoodMesh(massing,streetSource,{detail=true,maxWindows=6200,officialRoadbed=null}={}){
  if(massing.units!=='metres'||massing.heightScale!==1||
     !Array.isArray(massing.buildings)||!massing.buildings.length)
    throw Error('A genuine metre-scale NYC source scene is required');
  if(streetSource.schema!=='patrol-nyc-dcm-centerline-segments-v1'||
     !Array.isArray(streetSource.roads)||!Array.isArray(streetSource.originWGS84))
    throw Error('NYC DCM official road data missing or invalid');
  const [minE,minN,maxE,maxN]=massing.boundsMeters;
  const centerE=(minE+maxE)*.5,centerN=(minN+maxN)*.5;
  const [roadOffsetE,roadOffsetN]=wgs84ToMeters(streetSource.originWGS84,massing.origin);
  // Flight-scene coordinates: +X true east, +Y up, -Z true north.
  const point=([e,n],y=0)=>[e-centerE,y,centerN-n];
  const v=[],counts={buildings:0,roofTriangles:0,wallTriangles:0,
    facadeWindows:0,streetFeatures:0,streetSegments:0,groundTriangles:0,
    officialRoadbedPolygons:0,officialRoadbedIntersections:0,officialRoadbedTriangles:0};
  function vertex(p,normal,color,material=0){
    if(![...p,...normal,...color,material].every(Number.isFinite))
      throw Error('Non-finite city vertex');
    v.push(...p,...normal,...color,material);
  }
  function tri(a,b,c,color,material=0){
    const u=b.map((x,i)=>x-a[i]),w=c.map((x,i)=>x-a[i]);
    const n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],
      u[0]*w[1]-u[1]*w[0]],ln=Math.hypot(...n)||1;
    const norm=n.map(x=>x/ln);
    vertex(a,norm,color,material);vertex(b,norm,color,material);
    vertex(c,norm,color,material);
  }
  const quad=(a,b,c,d,color,material=0)=>{
    tri(a,b,c,color,material);tri(a,c,d,color,material);
  };
  const extent=Math.max(maxE-minE,maxN-minN,640);
  const half=extent*.85;
  const base=[.43,.45,.46];
  quad([-half,-.29,-half],[-half,-.29,half],[half,-.29,half],
    [half,-.29,-half],base,2);
  counts.groundTriangles+=2;
  const palette=[
    [.58,.61,.65],[.57,.53,.47],[.44,.48,.51],[.48,.55,.60],
    [.61,.56,.51],[.48,.40,.34],[.48,.57,.60],[.59,.57,.53],
    [.43,.49,.53],[.60,.57,.54]
  ];
  // Render all real footprints. Artist-authored window geometry is capped and
  // quality-gated; it never changes the source polygon, height or collision.
  for(const b of massing.buildings){
    counts.buildings++;
    const roof=b.roofHeightMeters,poly=b.footprintMeters.map(q=>point(q)),
      signed=signedAreaMeters(b.footprintMeters);
    const style=(Math.imul(b.fid,2654435761)>>>0)%palette.length;
    const high=roof>90,facade=high?
      tint([.39,.53,.64],.87+style*.022):palette[style],
      cap=tint(facade,1.18);
    for(const ids of b.roofTriangles){
      tri(poly[ids[0]].map((x,i)=>i===1?roof:x),
        poly[ids[1]].map((x,i)=>i===1?roof:x),
        poly[ids[2]].map((x,i)=>i===1?roof:x),cap);
      counts.roofTriangles++;
    }
    const perBuildingCap=Math.max(1,Math.floor(maxWindows/massing.buildings.length));
    const perEdgeCap=Math.max(1,Math.ceil(perBuildingCap/Math.max(1,poly.length)));
    for(let i=0;i<poly.length;i++){
      let edgeWindows=0;
      const a=poly[i],b2=poly[(i+1)%poly.length],
            side=length([a[0],a[2]],[b2[0],b2[2]]);
      const face=tint(facade,.88+.12*Math.abs(b2[2]-a[2])/(side||1));
      quad([a[0],0,a[2]],[b2[0],0,b2[2]],
        [b2[0],roof,b2[2]],[a[0],roof,a[2]],face);
      counts.wallTriangles+=2;
      if(!detail||side<4.2||roof<8||counts.facadeWindows>=maxWindows)
        continue;
      // Outward vector for CCW source east/north ring; Z is flipped north.
      const dx=b2[0]-a[0],dz=b2[2]-a[2],len=Math.hypot(dx,dz);
      const out= signed>=0?[-dz/len,dx/len]:[dz/len,-dx/len];
      // Roof and street podium exclusion is intentional: entrances, windows,
      // curtain-wall layouts and materials here are approximate, not surveyed.
      const groundStart=roof<20?3.0:5.1;
      const floors=Math.floor((roof-groundStart-1.35)/4.2);
      const bays=Math.floor((len-.8)/3.9);
      const midE=b.footprintMeters.reduce((n,p)=>n+p[0],0)/b.footprintMeters.length;
      const midN=b.footprintMeters.reduce((n,p)=>n+p[1],0)/b.footprintMeters.length;
      const near=Math.hypot(midE-centerE,midN-centerN)<330;
      if(!near||!floors||!bays)continue;
      const interval=Math.max(1,Math.ceil(floors/24)),
        bStep=Math.max(1,Math.ceil(bays/30));
      for(let floor=0;floor<floors;floor+=interval){
        for(let bay=0;bay<bays;bay+=bStep){
          if(counts.facadeWindows>=maxWindows||edgeWindows>=perEdgeCap)break;
          const f=(bay+.5)/bays,mid=[a[0]+dx*f,a[2]+dz*f],
                w=Math.min(2.65,len/bays*.67),
                y0=groundStart+floor*4.2,y1=Math.min(roof-1.05,y0+2.65);
          if(y1-y0<1.7)continue;
          const right=[dx/len,dz/len],offset=.11,
                p=(x,y,step)=>[mid[0]+right[0]*step+out[0]*x,y,
                  mid[1]+right[1]*step+out[1]*x];
          const border=high?[.22,.31,.39]:tint(facade,.48),
                glass=high?[.23,.41,.52]:[.22,.31,.37];
          // Recess illusion: offset framing and central glass. No false claim
          // that the original source supplied real window locations.
          quad(p(offset,y0,-w/2),p(offset,y0,w/2),
            p(offset,y1,w/2),p(offset,y1,-w/2),border);
          quad(p(offset+.018,y0+.22,-w/2+.15),
            p(offset+.018,y0+.22,w/2-.15),
            p(offset+.018,y1-.22,w/2-.15),
            p(offset+.018,y1-.22,-w/2+.15),glass,1);
          if(high&&floor%3===0)quad(
            p(offset+.025,y0+1.22,-w/2+.15),
            p(offset+.025,y0+1.22,w/2-.15),
            p(offset+.025,y0+1.28,w/2-.15),
            p(offset+.025,y0+1.28,-w/2+.15),
            [.72,.76,.79]);
          counts.facadeWindows++;edgeWindows++;
        }
      }
    }
  }
  // Actual NYC DCM centrelines in the SAME 1:1 geographic frame.
  // The width drawn here is a VISUAL placeholder, never a claimed measured
  // curb or lane width. Disable street asphalt if verified roadbed arrives.
  for(const road of streetSource.roads){
    const [name,streetWidthFeet,segments]=road;
    if(typeof name!=='string'||!Array.isArray(segments))continue;
    let accepted=0;
    const visualWidth=clamp((streetWidthFeet||65)*.3048*.37,5.5,12.5);
    for(const segment of segments){
      if(!Array.isArray(segment)||segment.length!==2||
        !segment.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)))
        continue;
      const endpoints=segment.map(p=>point([p[0]+roadOffsetE,p[1]+roadOffsetN]));
      const [a,b]=endpoints,dX=b[0]-a[0],dZ=b[2]-a[2],
            len=Math.hypot(dX,dZ);
      if(len<.7)continue;
      const sx=-dZ/len*visualWidth*.5,sz=dX/len*visualWidth*.5;
      const A=[a[0]+sx,-.135,a[2]+sz],B=[b[0]+sx,-.135,b[2]+sz],
            C=[b[0]-sx,-.135,b[2]-sz],D=[a[0]-sx,-.135,a[2]-sz];
      quad(A,B,C,D,[.18,.205,.23],2);
      // Thin source-centreline audit trace only; NOT NYCDOT lane markings.
      const k=.11,tx=-dZ/len*k,tz=dX/len*k;
      quad([a[0]+tx,-.11,a[2]+tz],[b[0]+tx,-.11,b[2]+tz],
        [b[0]-tx,-.11,b[2]-tz],[a[0]-tx,-.11,a[2]-tz],
        [.76,.72,.56],2);
      counts.streetSegments++;accepted++;
    }
    if(accepted)counts.streetFeatures++;
  }
  // NYC_OFFICIAL_2022_ROADBED_CORE_V1 — exact source FIDs from OTI's
  // Roadbed_2022 dataset, simplified from original ArcGIS shapes at <=.057m
  // Hausdorff/<=.088% area change; this opt-in Times Square core slice is
  // ONLY 11 road/intersection polygons, not a complete 2026 paving survey.
  // The original DCM-width bands are explicitly illustrative *outside* the
  // supplied source polygons. Roadbed faces sit 0.055m above those bands;
  // the source geometries themselves are never stretched to fit the grid.
  if(officialRoadbed!==null){
    if(officialRoadbed.v!==1||officialRoadbed.imagery!==2022||
       !Array.isArray(officialRoadbed.origin)||
       officialRoadbed.origin.length!==2||
       !officialRoadbed.origin.every(Number.isFinite)||
       !Array.isArray(officialRoadbed.polygons)||
       !officialRoadbed.polygons.length||
       officialRoadbed.polygons.length>80||
       !officialRoadbed.source?.includes('/Roadbed_2022/FeatureServer/20'))
      throw Error('Invalid official source roadbed slice');
    const [offsetE,offsetN]=wgs84ToMeters(officialRoadbed.origin,massing.origin);
    const seen=new Set();
    for(const [fid,subtype,ring] of officialRoadbed.polygons){
      if(!Number.isSafeInteger(fid)||seen.has(fid)||
         ![350000,350010].includes(subtype)||
         !Array.isArray(ring)||ring.length<3||ring.length>300||
         !ring.every(p=>Array.isArray(p)&&p.length===2&&
           p.every(Number.isFinite)))
        throw Error('Invalid NYC OTI roadbed footprint or repeated source FID');
      seen.add(fid);
      // Ear clip concave contours; never fan triangles across a turning
      // road edge. A source polygon with holes would need constrained
      // triangulation and is explicitly out of scope for this 11-FID slice.
      const triangles=triangulateSimplePolygon(ring);
      const pavement=subtype===350010?[.235,.254,.268]:[.178,.194,.205];
      const positions=ring.map(([e,n])=>
        point([e+offsetE,n+offsetN],-.075));
      for(const [a,b,d] of triangles)
        tri(positions[a],positions[b],positions[d],pavement,2);
      counts.officialRoadbedPolygons++;
      counts.officialRoadbedTriangles+=triangles.length;
      if(subtype===350010)counts.officialRoadbedIntersections++;
    }
  }
  return {interleaved:new Float32Array(v),strideFloats:MESH_STRIDE,
    center:{east:centerE,north:centerN},
    bounds:massing.boundsMeters,
    counts:{...counts,triangles:v.length/(MESH_STRIDE*3)},
    provenance:{buildings:massing.source,streets:streetSource.source,
      streetSourceDate:streetSource.capturedAt,
      roadbed:officialRoadbed?.source||null,
      roadbedImageryYear:officialRoadbed?.imagery||null},
    caveat:'True 1:1 OTI roof/footprint FIDs, DCM centreline alignment and opt-in 2022 OTI core roadbed polygon boundaries. This only covers 11 road/intersection FIDs; other road widths, 2026 pavement/curbs/lanes, facades and roof finishes remain illustrative or unverified.'};
}
