// Opt-in Times Square 1:1 neighbourhood geometry.
// Municipal NYC roof-height / footprint geometry remains authoritative for
// scale and placement. Street centrelines are NYC DCM records, NOT curb edges.
// Wall palettes/windows/road widths/ground treatment are artist-authored
// illustrative materials: this is NOT surveyed facade or roadbed geometry.
import {wgs84ToMeters,signedAreaMeters,triangulateSimplePolygon} from './times-square-metered-massing.mjs';
import earcut from './earcut.mjs';

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

export function buildNeighborhoodMesh(massing,streetSource,{detail=true,maxWindows=6200,officialRoadbed=null,officialSurfaces=null}={}){
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
    illustrativeRoadBandSegments:0,
    officialRoadbedPolygons:0,officialRoadbedIntersections:0,officialRoadbedTriangles:0,
    officialPlazaPolygons:0,officialPlazaTriangles:0,
    officialSidewalkPolygons:0,officialSidewalkTriangles:0,
    officialSurfaceFeatures:0,officialSurfaceRings:0,officialSurfaceVertices:0,
    officialSurfaceHoles:0,officialSurfaceTriangles:0,
    officialSurfaceAreaSquareMetres:0,officialSurfaceMaxAreaError:0};
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
  // DCM centerlines remain authoritative for alignment/spawn only. When the
  // bounded official OTI surface set is available, do not draw the old guessed
  // width bands or centerline-as-lane-looking trace underneath those surfaces.
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
      if(officialSurfaces===null){
        const sx=-dZ/len*visualWidth*.5,sz=dX/len*visualWidth*.5;
        const A=[a[0]+sx,-.135,a[2]+sz],B=[b[0]+sx,-.135,b[2]+sz],
              C=[b[0]-sx,-.135,b[2]-sz],D=[a[0]-sx,-.135,a[2]-sz];
        quad(A,B,C,D,[.18,.205,.23],2);
        // Source-centreline audit trace only; NOT NYCDOT lane markings.
        const k=.11,tx=-dZ/len*k,tz=dX/len*k;
        quad([a[0]+tx,-.11,a[2]+tz],[b[0]+tx,-.11,b[2]+tz],
          [b[0]-tx,-.11,b[2]-tz],[a[0]-tx,-.11,a[2]-tz],
          [.76,.72,.56],2);
        counts.illustrativeRoadBandSegments++;
      }
      counts.streetSegments++;accepted++;
    }
    if(accepted)counts.streetFeatures++;
  }

  function ringArea(ring){
    let sum=0;
    for(let i=0;i<ring.length;i++){
      const a=ring[i],b=ring[(i+1)%ring.length];
      sum+=a[0]*b[1]-b[0]*a[1];
    }
    return sum*.5;
  }
  function addOtiPolygon(rings,y,color,layerName){
    if(!Array.isArray(rings)||!rings.length)
      throw Error('Empty official OTI '+layerName+' polygon');
    const flat=[],holes=[],cleanRings=[];
    for(let ringIndex=0;ringIndex<rings.length;ringIndex++){
      const raw=rings[ringIndex];
      if(!Array.isArray(raw)||raw.length<3)
        throw Error('Invalid official OTI '+layerName+' ring');
      const clean=[];
      for(const p of raw){
        if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite))
          throw Error('Non-finite official OTI '+layerName+' vertex');
        const previous=clean.at(-1);
        if(!previous||Math.hypot(p[0]-previous[0],p[1]-previous[1])>.001)
          clean.push([p[0],p[1]]);
      }
      if(clean.length>3&&Math.hypot(
        clean[0][0]-clean.at(-1)[0],clean[0][1]-clean.at(-1)[1])<.02)
        clean.pop();
      if(clean.length<3)throw Error('Collapsed official OTI '+layerName+' ring');
      if(ringIndex>0)holes.push(flat.length/2);
      for(const p of clean)flat.push(p[0],p[1]);
      cleanRings.push(clean);
    }
    const indices=earcut(flat,holes,2);
    if(!indices.length||indices.length%3)
      throw Error('Earcut could not triangulate official OTI '+layerName+' polygon');
    const expected=Math.abs(ringArea(cleanRings[0]))-
      cleanRings.slice(1).reduce((n,ring)=>n+Math.abs(ringArea(ring)),0);
    if(!(expected>.01))throw Error('Degenerate official OTI '+layerName+' polygon area');
    let actual=0;
    for(let i=0;i<indices.length;i+=3){
      const ia=indices[i],ib=indices[i+1],ic=indices[i+2];
      const a=[flat[ia*2],flat[ia*2+1]],
            b=[flat[ib*2],flat[ib*2+1]],
            c=[flat[ic*2],flat[ic*2+1]];
      actual+=Math.abs((b[0]-a[0])*(c[1]-a[1])-
        (b[1]-a[1])*(c[0]-a[0]))*.5;
      const pa=point(a,y),pb=point(b,y),pc=point(c,y);
      // Earcut returns valid 2D triangles; flip only their winding if the
      // east/up/-north world transform would otherwise face the ground.
      const uy=pb[2]-pa[2],ux=pb[0]-pa[0],
            vy=pc[2]-pa[2],vx=pc[0]-pa[0];
      if(uy*vx-ux*vy<0)tri(pa,pc,pb,color,2);
      else tri(pa,pb,pc,color,2);
    }
    const error=Math.abs(actual-expected)/expected;
    if(!Number.isFinite(error)||error>.001)
      throw Error('Official OTI '+layerName+' triangulation area mismatch '+error);
    counts.officialSurfaceRings+=cleanRings.length;
    counts.officialSurfaceVertices+=cleanRings.reduce((n,ring)=>n+ring.length,0);
    counts.officialSurfaceHoles+=Math.max(0,cleanRings.length-1);
    counts.officialSurfaceTriangles+=indices.length/3;
    counts.officialSurfaceAreaSquareMetres+=actual;
    counts.officialSurfaceMaxAreaError=Math.max(
      counts.officialSurfaceMaxAreaError,error);
    return indices.length/3;
  }

  if(officialSurfaces!==null){
    if(officialRoadbed!==null)
      throw Error('Use either the complete OTI surface set or the 11-FID local fallback, not both');
    if(officialSurfaces.schema!=='patrol-nyc-oti-surfaces-2022-runtime-v1'||
       officialSurfaces.role!=='VISUAL_SOURCE_ONLY_NOT_COLLISION_OR_ROUTE_PERMISSION'||
       officialSurfaces.imageryYear!==2022||
       !officialSurfaces.origin||!Number.isFinite(officialSurfaces.origin.lon)||
       !Number.isFinite(officialSurfaces.origin.lat)||
       Math.abs(officialSurfaces.origin.lon-massing.origin.lon)>1e-9||
       Math.abs(officialSurfaces.origin.lat-massing.origin.lat)>1e-9||
       !officialSurfaces.sources?.roadbeds?.includes('/Roadbed_2022/FeatureServer/20')||
       !officialSurfaces.sources?.plazas?.includes('/Plaza_2022/FeatureServer/16')||
       !officialSurfaces.sources?.sidewalks?.includes('/Sidewalk_2022/FeatureServer/22')||
       !Array.isArray(officialSurfaces.roadbeds)||
       !Array.isArray(officialSurfaces.plazas)||
       !Array.isArray(officialSurfaces.sidewalks))
      throw Error('Invalid official NYC OTI 2022 surface source or incompatible local metre origin');

    const sets=[
      {key:'roadbeds',layer:'roadbed',y:-.075,
        color:f=>f.subtype===350010?[.235,.254,.268]:[.178,.194,.205]},
      {key:'plazas',layer:'plaza',y:-.072,
        color:()=>[.43,.385,.315]},
      {key:'sidewalks',layer:'sidewalk',y:-.069,
        color:f=>f.subtype===380010?[.56,.535,.475]:[.49,.50,.485]}
    ];
    for(const set of sets){
      const features=officialSurfaces[set.key],seen=new Set();
      const min=set.key==='roadbeds'?70:set.key==='plazas'?10:40;
      if(features.length<min)
        throw Error('Incomplete official OTI '+set.key+' layer: '+features.length);
      for(const feature of features){
        if(!Number.isSafeInteger(feature.objectId)||seen.has(feature.objectId)||
           !Array.isArray(feature.polygons)||!feature.polygons.length)
          throw Error('Invalid or repeated OTI '+set.key+' source OBJECTID');
        seen.add(feature.objectId);
        if(set.key==='roadbeds'&&![350000,350010].includes(feature.subtype))
          throw Error('Unexpected OTI roadbed subtype '+feature.subtype);
        if(set.key==='plazas'&&feature.subtype!==600000)
          throw Error('Unexpected OTI plaza subtype '+feature.subtype);
        if(set.key==='sidewalks'&&![380000,380010].includes(feature.subtype))
          throw Error('Unexpected OTI sidewalk subtype '+feature.subtype);
        for(const polygon of feature.polygons){
          const triangles=addOtiPolygon(
            polygon,set.y,set.color(feature),set.layer);
          if(set.key==='roadbeds'){
            counts.officialRoadbedPolygons++;
            counts.officialRoadbedTriangles+=triangles;
            if(feature.subtype===350010)counts.officialRoadbedIntersections++;
          }else if(set.key==='plazas'){
            counts.officialPlazaPolygons++;
            counts.officialPlazaTriangles+=triangles;
          }else{
            counts.officialSidewalkPolygons++;
            counts.officialSidewalkTriangles+=triangles;
          }
        }
        counts.officialSurfaceFeatures++;
      }
    }
  }else if(officialRoadbed!==null){
    // Offline fallback: the checked-in, simplified 11-FID central roadbed core.
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
      const triangles=triangulateSimplePolygon(ring);
      const pavement=subtype===350010?[.235,.254,.268]:[.178,.194,.205];
      const positions=ring.map(([e,n])=>
        point([e+offsetE,n+offsetN],-.075));
      for(const [a,b,d] of triangles){
        const pa=positions[a],pb=positions[b],pc=positions[d];
        const uy=pb[2]-pa[2],ux=pb[0]-pa[0],
              vy=pc[2]-pa[2],vx=pc[0]-pa[0];
        if(uy*vx-ux*vy<0)tri(pa,pc,pb,pavement,2);
        else tri(pa,pb,pc,pavement,2);
      }
      counts.officialRoadbedPolygons++;
      counts.officialRoadbedTriangles+=triangles.length;
      if(subtype===350010)counts.officialRoadbedIntersections++;
    }
    counts.officialSurfaceTriangles=counts.officialRoadbedTriangles;
  }
  return {interleaved:new Float32Array(v),strideFloats:MESH_STRIDE,
    center:{east:centerE,north:centerN},
    bounds:massing.boundsMeters,
    counts:{...counts,triangles:v.length/(MESH_STRIDE*3)},
    provenance:{buildings:massing.source,streets:streetSource.source,
      streetSourceDate:streetSource.capturedAt,
      roadbed:officialRoadbed?.source||officialSurfaces?.sources?.roadbeds||null,
      plaza:officialSurfaces?.sources?.plazas||null,
      sidewalk:officialSurfaces?.sources?.sidewalks||null,
      surfaceImageryYear:officialSurfaces?.imageryYear||officialRoadbed?.imagery||null,
      surfaceTerms:officialSurfaces?.terms||null,
      surfaceCaptureRules:officialSurfaces?.captureRules||null},
    caveat:officialSurfaces
      ?'True 1:1 NYC source footprints and DCM alignment plus the complete bounded 2022 OTI roadbed/plaza/sidewalk polygon layers for the Times Square query tile. These are 2D source planimetrics with display-only millimetre offsets, not 2026 elevations, traffic permissions, curb-ramp heights, collision, lane markings or full-NYC coverage; facades remain illustrative.'
      :'True 1:1 NYC source footprints and DCM alignment plus the checked-in 11-FID 2022 OTI roadbed fallback only. Other road widths, facades and roof finishes remain illustrative or unverified; no 2026 elevation, curb/lane, traffic permission, collision or full-NYC coverage is inferred.'};
}
