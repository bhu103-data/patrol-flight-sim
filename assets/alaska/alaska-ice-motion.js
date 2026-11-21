/**
 * PATROL Alaska-only low-poly ice motion. Original code and geometry.
 * Real USGS terrain is sampled at spawn and while drifting, so floes cannot
 * move across the new Tracy Arm shoreline. No collision changes are made.
 * Each chunk is a tiny independent GPU mesh, capped at 11 draw calls.
 */
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
const hash=n=>{const x=Math.sin(n*128.103+19.233)*43758.5443;return x-Math.floor(x);};
const SITES=[
  [95,370],[122,338],[164,313],[129,264],[154,202],[92,96],
  [65,-56],[101,-185],
  [113,443],[133,451],[147,430],
];
// A rotating floe's largest perimeter point reaches 1.11x its design width.
function chunkRadius(seed,calving){
  return calving?1.7+hash(seed*4)*1.9:2.1+hash(seed*7)*3.4;
}
function waterFootprintClear(x,z,radius,terrainAt,waterY,allowance=.08){
  if(terrainAt(x,z)>waterY+allowance)return false;
  for(let step=0;step<16;step++){
    const angle=step*Math.PI/8;
    if(terrainAt(x+Math.cos(angle)*radius,
                 z+Math.sin(angle)*radius)>waterY+allowance)return false;
  }
  return true;
}
function findWater(x,z,terrainAt,waterY,radius){
  for(let ring=0;ring<5;ring++){
    const steps=ring===0?1:16;
    for(let k=0;k<steps;k++){
      const a=k*2*Math.PI/steps;
      const px=x+Math.cos(a)*ring*10,pz=z+Math.sin(a)*ring*10;
      if(Math.hypot(px,pz)>780)continue;
      if(waterFootprintClear(px,pz,radius*1.12,terrainAt,waterY))
        return [px,pz];
    }
  }
  return null;
}
function makeChunk(addTri,addQuad,seed,calving) {
  const count=7+(seed%3),width=chunkRadius(seed,calving);
  const height=(calving?2.1:0.28)+hash(seed*13)*(calving?1.8:0.36);
  const ring=[];
  for(let k=0;k<count;k++){
    const a=2*Math.PI*k/count,rad=.79+.32*hash(seed*23+k*19);
    ring.push([Math.cos(a)*width*rad,0,Math.sin(a)*width*(.5+.25*hash(seed+20))*rad]);
  }
  const tint=hash(seed*71);
  const blue=[.32+.15*tint,.58+.08*tint,.68+.09*tint];
  const pale=[.67+.15*tint,.83+.08*tint,.88+.08*tint];
  const deep=[.15+.11*tint,.34+.10*tint,.43+.07*tint];
  const peak=[.25*width,height,0];
  for(let k=0;k<count;k++){
    const next=(k+1)%count;
    const a=ring[k],b=ring[next];
    const top0=[a[0],height*.48,a[2]],top1=[b[0],height*.48,b[2]];
    addTri(top0,top1,peak,k%3===0?blue:pale);
    addQuad([a[0],-.19,a[2]],[b[0],-.19,b[2]],top1,top0,k%2?blue:deep);
    if(k%3===0){
      const crack=[.08,.26,.32],c=[(a[0]+b[0])*.48,height*.49,(a[2]+b[2])*.48];
      addTri(peak,top0,c,crack);
    }
  }
  return width;
}
export function createAlaskaIceActors({makeMesh,terrainAt,waterY}){
  if(typeof makeMesh!=='function'||typeof terrainAt!=='function'||
     !Number.isFinite(waterY))throw new TypeError('Invalid Alaska ice geometry configuration');
  const actors=[];
  for(let i=0;i<SITES.length;i++){
    const [sx,sz]=SITES[i],calving=i>=8;
    const radius=chunkRadius(i+19,calving);
    const water=findWater(sx,sz,terrainAt,waterY,radius);
    if(!water)continue;
    const [x,z]=water,mesh=makeMesh();
    makeChunk(mesh.addTri,mesh.addQuad,i+19,calving);
    const uploaded=mesh.upload();
    if(!uploaded || !Number.isInteger(uploaded.count) || uploaded.count<=0)
      throw new Error('Invalid Alaska drift-ice mesh');
    actors.push({
      kind:calving?'calving':'floe',
      mesh:uploaded,anchor:[x,z],radius,
      phase:hash(i*29+10)*19,
      period:70+hash(i*73+7)*25,
      yaw:hash(i*101+15)*Math.PI*2
    });
  }
  return actors;
}
export function poseAlaskaIce(actor,time,terrainAt,waterY){
  if(!actor||!Number.isFinite(time))return {visible:false};
  const slow=time*.0065+actor.phase;
  const ox=Math.sin(slow*.9)*3.8,oz=Math.cos(slow*.7)*5.1;
  const nx=actor.anchor[0]+ox,nz=actor.anchor[1]+oz;
  // Sample the full rotated hull rather than a center/cardinal cross.
  const safe=waterFootprintClear(nx,nz,actor.radius*1.12,terrainAt,waterY,.12);
  const x=safe?nx:actor.anchor[0],z=safe?nz:actor.anchor[1];
  const yaw=actor.yaw+time*.0035;
  if(actor.kind==='calving'){
    const cycle=(time+actor.phase*2.2)%actor.period;
    if(cycle>18)return {visible:false};
    // A visually brief ice fracture/fall above the water, then debris floats.
    const fall=cycle<2.3?Math.max(0,7.8-1.65*cycle*cycle):0;
    const y=waterY+.12+fall+Math.sin(time*.47+actor.phase)*.032;
    return {visible:true,x,y,z,yaw,kind:'calving'};
  }
  const y=waterY+.10+Math.sin(time*.24+actor.phase)*.044;
  return {visible:true,x,y,z,yaw,kind:'floe'};
}
