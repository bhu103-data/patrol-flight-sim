// PATROL / NYC bridgehead chunk details, adapted from Petalwake's MIT-licensed
// src/world/town.js (three LOD levels by distance to the chunk's AABB).
// Petalwake: Copyright (c) 2026 Jacob Miller, MIT.
// Upstream revision: 25443cef0eba802052d9ef24c94ba3c4157b6f2e
// Full MIT notice: ./PETALWAKE_MIT_NOTICE.md
//
// PATROL uses native WebGL2 and an existing mesh uploader rather than Three.js.
// Only non-colliding street furniture detail is in these optional draw batches.
// Traffic, road splines, terrain, aircraft and global renderer are unchanged.
export const ROAD_CHUNK_NEAR = 43;
export const ROAD_CHUNK_MID = 123;

/** Three-tier chunk LOD directly ported from Petalwake Town.update's
 * d < NEAR ? 2 : d < MID ? 1 : 0, using 3D point-to-AABB distance.
 * PATROL units and camera altitude use a smaller calibrated range.
 */
export function selectNycRoadChunkLod(bounds, eye, near=ROAD_CHUNK_NEAR,
                                     mid=ROAD_CHUNK_MID){
  if(!bounds||!eye||eye.length<3)return 0;
  const dx=eye[0]<bounds.minX?bounds.minX-eye[0]:
    eye[0]>bounds.maxX?eye[0]-bounds.maxX:0;
  const dy=eye[1]<bounds.minY?bounds.minY-eye[1]:
    eye[1]>bounds.maxY?eye[1]-bounds.maxY:0;
  const dz=eye[2]<bounds.minZ?bounds.minZ-eye[2]:
    eye[2]>bounds.maxZ?eye[2]-bounds.maxZ:0;
  const d=Math.hypot(dx,dy,dz);
  return d<near?2:d<mid?1:0;
}

// A single intentionally small bridgehead corridor with three independent
// street blocks. It preserves Petalwake's deterministic chunk layout concept,
// but uses PATROL's existing NYC compressed grid and lot-clearance predicates.
export function buildNycBridgeheadDetailChunks({
  makeMesh, terrainAt, isClear, detailBand, grid,
  streetY, waterY, existingStreets=[]
}){
  const chunks=[];
  if(typeof makeMesh!=='function'||typeof terrainAt!=='function'||
     typeof isClear!=='function'||typeof detailBand!=='function'||!grid)
    return chunks;
  const j=-11,z=j*grid.blockLength,width=5.65,sidewalkExtent=width*.5+1.42;
  const avenueX=i=>i*grid.blockWidth+grid.tilt*z+grid.offset;
  const nearOld=(x,z0)=>{
    for(const road of existingStreets)for(let k=1;k<road.length;k++){
      const a=road[k-1],b=road[k],dx=b[0]-a[0],dz=b[1]-a[1];
      const t=Math.max(0,Math.min(1,
        ((x-a[0])*dx+(z0-a[1])*dz)/(dx*dx+dz*dz||1)));
      if(Math.hypot(x-a[0]-t*dx,z0-a[1]-t*dz)<7.8)return true;
    }
    return false;
  };
  const paint=(mesh,x,z,w,d,y,color)=>{
    const x0=x-w*.5,x1=x+w*.5,z0=z-d*.5,z1=z+d*.5;
    mesh.addQuad([x0,y,z0],[x1,y,z0],[x1,y,z1],[x0,y,z1],color);
  };
  for(const i of [13,14,15,16]){
    const ax=avenueX(i),bx=avenueX(i+1);
    const cx=(ax+bx)*.5;
    if(detailBand(cx,z)<2||nearOld(cx,z))continue;
    // Same dry and building-lot eligibility principles as the authored
    // street batch. Abort the whole chunk rather than painting a grate
    // where the base street may have been clipped or rejected.
    let clear=true;
    const steps=Math.ceil((bx-ax)/1.2);
    for(let n=0;n<=steps&&clear;n++){
      const x=ax+(bx-ax)*n/steps;
      for(const lateral of [-sidewalkExtent,-width*.5,0,width*.5,sidewalkExtent]){
        if(terrainAt(x,z+lateral)<waterY+1.58||
          !isClear(x,z+lateral,.95)){clear=false;break}
      }
    }
    if(!clear)continue;
    // Northern sidewalk: opposite the #100 bridge-facing guardrail.
    // Keep the plate clear of intersections and of midpoint street
    // furniture, and small enough to fit within the concrete slab.
    const x=ax+(bx-ax)*(.20+.045*(i%3));
    const centerZ=z+width*.5+.53;
    if(!isClear(x,centerZ,.45)||terrainAt(x,centerZ)<waterY+1.58)
      continue;
    const baseY=streetY+.154,mid=makeMesh(),near=makeMesh();
    const blackIron=[.215,.241,.247],frame=[.425,.452,.455],
      rib=[.53,.55,.55];
    // Mid LOD: recognizable 0.64 x 0.48m utility grate surround.
    // Actual mesh is slightly above, not coplanar with, the sidewalk.
    paint(mid,x,centerZ,.66,.49,baseY+.021,blackIron);
    const left=x-.335,right=x+.335,top=centerZ-.245,bottom=centerZ+.245;
    paint(mid,x,top,.69,.045,baseY+.026,frame);
    paint(mid,x,bottom,.69,.045,baseY+.026,frame);
    paint(mid,left,centerZ,.045,.49,baseY+.026,frame);
    paint(mid,right,centerZ,.045,.49,baseY+.026,frame);
    // Petalwake-like nearest LOD adds real separate ribs, not a diffuse
    // stamp. Only drawn within the camera's 43-unit AABB distance.
    for(let k=-3;k<=3;k++)
      paint(near,x+k*.072,centerZ,.029,.36,baseY+.034,rib);
    const bounds={
      minX:ax,minY:baseY-.16,minZ:z-sidewalkExtent,
      maxX:bx,maxY:baseY+1.2,maxZ:z+sidewalkExtent
    };
    chunks.push({id:'brooklyn-petalwake-'+i+'-'+j,
      bounds,mid,near,i,j,utility:[x,baseY,centerZ]});
  }
  return chunks;
}
