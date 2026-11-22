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

export function buildNeighborhoodMesh(massing,streetSource,{detail=true,maxWindows=6200,officialRoadbed=null,historicalMesh=null}={}){
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
  const sourceRoofFids=new Set(),sourceFacadeFids=new Set(),sourceRoofTopZ=new Map();
  const buildingByFid=new Map(massing.buildings.map(b=>[Number(b.fid),b]));
  let historicalOffsetE=0,historicalOffsetN=0;
  if(historicalMesh!==null){
    if(historicalMesh.schema!=='patrol-nyc-mn05-2014-matched-source-mesh-v1'||
       historicalMesh.assetRole!=='2014_HISTORICAL_SOURCE_GEOMETRY_FOR_OPT_IN_VISUALS_ONLY_NOT_COLLISION'||
       historicalMesh.sourceVintage!==2014||historicalMesh.sourceVerticalUnitVerified!==true||
       historicalMesh.sourceVerticalDatumVerified!==false||historicalMesh.gameCollision!==false||
       historicalMesh.modelIs2026Survey!==false||
       !Array.isArray(historicalMesh.localOriginLonLat)||
       historicalMesh.localOriginLonLat.length!==2||
       !historicalMesh.localOriginLonLat.every(Number.isFinite)||
       !/^[a-f0-9]{64}$/.test(historicalMesh.sourceRhinoSha256||'')||
       !Array.isArray(historicalMesh.roofTriangles)||
       !Array.isArray(historicalMesh.facadeTriangles))
      throw Error('Unverified or incompatible official 2014 MN05 source mesh');
    [historicalOffsetE,historicalOffsetN]=wgs84ToMeters(
      historicalMesh.localOriginLonLat,massing.origin);
    for(const row of historicalMesh.roofTriangles){
      const fid=Number(row?.matched2022BuildingFid),b=buildingByFid.get(fid);
      if(!b||!Number.isFinite(row.matchAreaRatio)||row.matchAreaRatio<.60||
         !Array.isArray(row.sourceRawZFt)||row.sourceRawZFt.length!==3||
         !row.sourceRawZFt.every(Number.isFinite)||
         !Array.isArray(row.vertices)||row.vertices.length!==3||
         row.vertices.some(p=>!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite)))
        throw Error('Invalid or unmatched official 2014 roof triangle');
      sourceRoofFids.add(fid);
      sourceRoofTopZ.set(fid,Math.max(sourceRoofTopZ.get(fid)??-Infinity,...row.sourceRawZFt));
    }
    for(const row of historicalMesh.facadeTriangles){
      const fid=Number(row?.matched2022BuildingFid);
      if(!buildingByFid.has(fid)||!Number.isFinite(row.matchCoverage)||row.matchCoverage<.65||
         !Number.isFinite(row.boundaryDistanceMetres)||row.boundaryDistanceMetres>1.5||
         !Array.isArray(row.vertices)||row.vertices.length!==3||
         row.vertices.some(p=>!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite)))
        throw Error('Invalid or unmatched official 2014 facade triangle');
      sourceFacadeFids.add(fid);
    }
    if(sourceRoofFids.size<3||sourceFacadeFids.size<3)
      throw Error('Official 2014 model has insufficient matched building coverage');
  }
  const v=[],counts={buildings:0,roofTriangles:0,wallTriangles:0,
    facadeWindows:0,streetFeatures:0,streetSegments:0,groundTriangles:0,
    officialRoadbedPolygons:0,officialRoadbedIntersections:0,officialRoadbedTriangles:0,
    historicalRoofTriangles:0,historicalFacadeTriangles:0,historicalRoofFids:0,historicalFacadeFids:0,
    historicalSourceFacadeWindows:0,historicalSourceFacadeWindowFids:0,
    historicalSourceFacadeWindowFidList:[]};
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
    if(!sourceRoofFids.has(Number(b.fid)))for(const ids of b.roofTriangles){
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
  // Original 2014 DCP cached meshes are rendered in the 2022 1:1 frame.
  // Roof height is anchored to same-FID 2022 HEIGHTROOF; absolute datum unknown.
  // Historical meshes are visual-only and never change collision or flight logic.
  if(historicalMesh!==null){
    const sourcePoint=(p,y=p[2])=>point(
      [p[0]+historicalOffsetE,p[1]+historicalOffsetN],y);
    for(const row of historicalMesh.roofTriangles){
      const fid=Number(row.matched2022BuildingFid),b=buildingByFid.get(fid),
        top=sourceRoofTopZ.get(fid);
      const p=row.vertices.map((v,i)=>sourcePoint(v,
        b.roofHeightMeters+.35+(row.sourceRawZFt[i]-top)*.3048));
      const u=p[1].map((x,i)=>x-p[0][i]),w=p[2].map((x,i)=>x-p[0][i]);
      const normalY=u[2]*w[0]-u[0]*w[2];
      if(normalY<0)tri(p[0],p[2],p[1],[.49,.52,.54]);
      else tri(p[0],p[1],p[2],[.49,.52,.54]);
      counts.historicalRoofTriangles++;
    }
    for(const row of historicalMesh.facadeTriangles){
      const p=row.vertices.map(v=>sourcePoint(v));
      const u=p[1].map((x,i)=>x-p[0][i]),w=p[2].map((x,i)=>x-p[0][i]);
      const n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],
        u[0]*w[1]-u[1]*w[0]],len=Math.hypot(...n)||1;
      const raised=p.map(v=>v.map((x,i)=>x+n[i]/len*.02));
      tri(raised[0],raised[1],raised[2],[.50,.44,.36]);
      counts.historicalFacadeTriangles++;
    }
    // MN05 facade surfaces are real, but their saved meshes do not include
    // surveyed window locations or textures. Add restrained illustrative
    // window infill only on source faces exposed outside the current 2022
    // footprint wall; faces inside the footprint use the wall's normal window
    // pass above. This preserves the original 2014 surfaces and avoids
    // drawing windows behind them.
    const facadeGroups=new Map();
    for(const row of historicalMesh.facadeTriangles){
      const fid=Number(row.matched2022BuildingFid),uuid=String(row.sourceUuid||'');
      if(!uuid)continue;
      const key=fid+'|'+uuid;
      if(!facadeGroups.has(key))facadeGroups.set(key,[]);
      facadeGroups.get(key).push(row);
    }
    const dot3=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
    const cross3=(a,b)=>[
      a[1]*b[2]-a[2]*b[1],
      a[2]*b[0]-a[0]*b[2],
      a[0]*b[1]-a[1]*b[0]
    ];
    const norm3=a=>{
      const n=Math.hypot(...a)||1;
      return a.map(x=>x/n);
    };
    const insideTriangle2D=(p,a,b,c)=>{
      const cross2=(u,v,q)=>(v[0]-u[0])*(q[1]-u[1])-
        (v[1]-u[1])*(q[0]-u[0]);
      const x=cross2(a,b,p),y=cross2(b,c,p),z=cross2(c,a,p);
      return !((x<-.0001||y<-.0001||z<-.0001)&&
        (x>.0001||y>.0001||z>.0001));
    };
    const sourceWindowFids=new Set();
    let sourceWindowBudget=Math.min(1800,Math.max(0,maxWindows-counts.facadeWindows));
    if(detail&&sourceWindowBudget>0){
      for(const rows of facadeGroups.values()){
        if(sourceWindowBudget<=0)break;
        const fid=Number(rows[0].matched2022BuildingFid),building=buildingByFid.get(fid);
        if(!building)continue;
        const worldTriangles=rows.map(row=>row.vertices.map(v=>sourcePoint(v)));
        const worldPoints=worldTriangles.flat();
        if(worldPoints.length<6)continue;
        const rawPoints=rows.flatMap(row=>row.vertices);
        const centerE=rawPoints.reduce((sum,p)=>sum+p[0],0)/rawPoints.length+historicalOffsetE;
        const centerN=rawPoints.reduce((sum,p)=>sum+p[1],0)/rawPoints.length+historicalOffsetN;
        const centerHeight=rawPoints.reduce((sum,p)=>sum+p[2],0)/rawPoints.length;
        // A source face inside the footprint is covered by the current wall;
        // its illustrative windows are already placed on that outer wall.
        if(buildingContains(massing,centerE,centerN,centerHeight)!==null)continue;
        const rawNormals=worldTriangles.map(([a,b,c])=>{
          const u=b.map((v,i)=>v-a[i]),w=c.map((v,i)=>v-a[i]);
          return norm3(cross3(u,w));
        });
        const referenceNormal=rawNormals[0];
        const alignedNormals=rawNormals.map(n=>dot3(n,referenceNormal)<0?
          n.map(v=>-v):n);
        if(alignedNormals.some(n=>dot3(n,referenceNormal)<.96))continue;
        let normal=norm3(alignedNormals.reduce((sum,n)=>sum.map((v,i)=>v+n[i]),[0,0,0]));
        if(Math.abs(normal[1])>.12)continue;
        const footprintCenter=building.footprintMeters.reduce(
          (sum,p)=>[sum[0]+p[0]/building.footprintMeters.length,
            sum[1]+p[1]/building.footprintMeters.length],[0,0]);
        const faceCenter=point([centerE,centerN],centerHeight);
        const buildingCenter=point(footprintCenter,0);
        const outward=[faceCenter[0]-buildingCenter[0],0,faceCenter[2]-buildingCenter[2]];
        if(Math.hypot(outward[0],outward[2])<.5)continue;
        if(dot3(normal,outward)<0)normal=normal.map(v=>-v);
        const tangent=norm3([-normal[2],0,normal[0]]);
        const up=norm3(cross3(tangent,normal));
        const plane=worldPoints.reduce((sum,p)=>sum+dot3(p,normal),0)/worldPoints.length;
        if(Math.max(...worldPoints.map(p=>Math.abs(dot3(p,normal)-plane)))>.15)continue;
        const project=p=>[dot3(p,tangent),dot3(p,up)];
        const triangles2=worldTriangles.map(tri=>tri.map(project));
        const projected=triangles2.flat();
        const minS=Math.min(...projected.map(p=>p[0]));
        const maxS=Math.max(...projected.map(p=>p[0]));
        const minH=Math.min(...projected.map(p=>p[1]));
        const maxH=Math.max(...projected.map(p=>p[1]));
        if(maxS-minS<3.2||maxH-minH<5)continue;
        const winW=1.55,winH=2.25,stepS=3.05,stepH=3.65;
        const startS=minS+.78+winW/2,endS=maxS-.78-winW/2;
        const startH=minH+1.05+winH/2,endH=maxH-.85-winH/2;
        if(endS<startS||endH<startH)continue;
        const at=(s,h,offset)=>[
          normal[0]*(plane+offset)+tangent[0]*s+up[0]*h,
          normal[1]*(plane+offset)+tangent[1]*s+up[1]*h,
          normal[2]*(plane+offset)+tangent[2]*s+up[2]*h
        ];
        let faceWindows=0;
        for(let s=startS;s<=endS+.0001;s+=stepS){
          for(let h=startH;h<=endH+.0001;h+=stepH){
            if(sourceWindowBudget<=0||counts.facadeWindows>=maxWindows)break;
            const s0=s-winW/2,s1=s+winW/2,h0=h-winH/2,h1=h+winH/2;
            const corners=[[s0,h0],[s0,h1],[s1,h1],[s1,h0]];
            if(!corners.every(c=>triangles2.some(t=>insideTriangle2D(c,t[0],t[1],t[2]))))continue;
            const shade=(Math.floor(s/stepS)+Math.floor(h/stepH)+fid)%3;
            const glass=shade===0?[.17,.30,.38]:
              shade===1?[.20,.35,.43]:[.24,.39,.46];
            quad(at(s0,h0,.065),at(s0,h1,.065),at(s1,h1,.065),at(s1,h0,.065),
              [.16,.22,.28]);
            quad(at(s0+.10,h0+.10,.105),at(s0+.10,h1-.10,.105),
              at(s1-.10,h1-.10,.105),at(s1-.10,h0+.10,.105),glass,1);
            counts.facadeWindows++;
            counts.historicalSourceFacadeWindows++;
            sourceWindowBudget--;faceWindows++;
          }
        }
        if(faceWindows)sourceWindowFids.add(fid);
      }
    }
    counts.historicalSourceFacadeWindowFids=sourceWindowFids.size;
    counts.historicalSourceFacadeWindowFidList=[...sourceWindowFids].sort((a,b)=>a-b);
    counts.historicalRoofFids=sourceRoofFids.size;
    counts.historicalFacadeFids=sourceFacadeFids.size;
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
  // Roadbed_2022 dataset, simplified from original ArcGIS shapes at <=.061m
  // Hausdorff/<=.096% area change; this opt-in Times Square core slice is
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
      roadbedImageryYear:officialRoadbed?.imagery||null,
      historicalMesh:historicalMesh?{source:historicalMesh.source,sourceVintage:historicalMesh.sourceVintage,sourceRhinoSha256:historicalMesh.sourceRhinoSha256,sourceVerticalDatumVerified:historicalMesh.sourceVerticalDatumVerified}:null},
    caveat:historicalMesh?'True 1:1 2022 OTI footprints and DCM alignment plus matched original NYC DCP 2014 MN05 cached roof/facade source triangles for a bounded 33-roof-FID/30-facade-FID subset. Historical geometry is not a 2026 survey; vertical datum is unknown; facades have no source photo/PBR material; collision remains the 2022 footprint prism.':'True 1:1 OTI roof/footprint FIDs, DCM centreline alignment and opt-in 2022 OTI core roadbed polygon boundaries. This only covers 11 road/intersection FIDs; other road widths, 2026 pavement/curbs/lanes, facades and roof finishes remain illustrative or unverified.'};
}
