/*
 * Adapted from jjcm/petalwake src/world/town.js (MIT License).
 * Copyright (c) 2026 Jacob Miller.
 * Source: https://github.com/jjcm/petalwake/blob/main/src/world/town.js
 * MIT license: https://github.com/jjcm/petalwake/blob/main/LICENSE
 * Changes: removed Three.js, switched to PATROL game units and tile budget.
 * Preserve attribution and license in docs/NYC_PETALWAKE_ASSET_REUSE.md.
 */
// Petalwake's distance-to-AABB + three-band chunk selection, without GPU dependencies.
export function distanceToChunk(camera,box){
 if(!Array.isArray(camera)||camera.length<3||
    !Array.isArray(box)||box.length!==6||
    !camera.every(Number.isFinite)||!box.every(Number.isFinite)||
    box[0]>box[3]||box[1]>box[4]||box[2]>box[5])
   throw new TypeError('Finite 3D camera and ordered chunk AABB required');
 const dx=Math.max(box[0]-camera[0],0,camera[0]-box[3]);
 const dy=Math.max(box[1]-camera[1],0,camera[1]-box[4]);
 const dz=Math.max(box[2]-camera[2],0,camera[2]-box[5]);
 return Math.hypot(dx,dy,dz);
}
export function selectChunkLOD(distance,near=135,mid=560){
 if(!(Number.isFinite(distance)&&distance>=0&&near>0&&mid>near))
  throw new RangeError('Invalid chunk distance/LOD thresholds');
 return distance<near?2:distance<mid?1:0;
}
// PATROL is world-compressed; a fixed world-space cell budget is safer than
// copying Petalwake's raw metre thresholds or three.js mesh internals.
export function createStreetFurnitureChunkBudget({cellX=96,cellZ=99,bridgeCap=8,otherCap=12}={}){
 if(![cellX,cellZ,bridgeCap,otherCap].every(v=>Number.isFinite(v)&&v>0))
  throw new RangeError('Positive cell extents and limits required');
 const used=new Map();
 const key=(x,z,bridge)=>`${bridge?'bridge':'city'}:${Math.floor(x/cellX)}:${Math.floor(z/cellZ)}`;
 return {
  permits(x,z,detail,bridge=false){
   if(!Number.isFinite(x)||!Number.isFinite(z))return false;
   if(!Number.isInteger(detail)||detail<(bridge?2:3))return false;
   const id=key(x,z,bridge);
   return (used.get(id)||0)<(bridge?bridgeCap:otherCap);
  },
  record(x,z,bridge=false){
   const id=key(x,z,bridge);used.set(id,(used.get(id)||0)+1);
  },
  snapshot(){return Object.fromEntries([...used].sort((a,b)=>a[0].localeCompare(b[0])));}
 };
}
