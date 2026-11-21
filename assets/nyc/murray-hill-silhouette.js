// Standalone visual-only prototype. OTI height and footprint are sourced;
// inset upper terrace is deliberately an authored approximation, not surveyed.
export function murrayHillSilhouettes(snapshot,emit,{origin=[-73.979,40.750],metersPerUnit=9.09}={}){
 if(snapshot?.schema!=='patrol-nyc-murray-hill-visual-only-v1'||snapshot.collision!==false||snapshot.viewOnly!==true)throw new TypeError('Not a visual-only NYC snapshot');
 const project=([lon,lat])=>[(lon-origin[0])*84200/metersPerUnit,(lat-origin[1])*111200/metersPerUnit];
 let count=0,tiers=0;
 for(const building of snapshot.buildings){
  if(building.roofHeightSource!=='HEIGHT_ROOF'||building.ring?.length<3||!Number.isFinite(building.heightFt))continue;
  const ring=building.ring.map(project),h=Math.min(55,building.heightFt*.3048/metersPerUnit);
  if(h<1||ring.some(p=>!p.every(Number.isFinite)))continue;
  count++;
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);
  const turns=ring.map((p,i)=>cross(p,ring[(i+1)%ring.length],ring[(i+2)%ring.length]));
  if(ring.length>8||(Math.min(...turns)<-1e-6&&Math.max(...turns)>1e-6)||h<8){
   emit({kind:'footprint',id:building.id,ring,height:h});continue;
  }
  const cx=ring.reduce((s,p)=>s+p[0],0)/ring.length,cz=ring.reduce((s,p)=>s+p[1],0)/ring.length;
  const inset=ring.map(([x,z])=>[cx+(x-cx)*.83,cz+(z-cz)*.83]);
  emit({kind:'footprint',id:building.id,ring,height:h*.82});
  emit({kind:'approximate-inset-terrace',id:building.id,ring:inset,height:h,baseHeight:h*.82,source:'authored approximation'});tiers++;
 }
 return {buildings:count,approximateRoofTiers:tiers,visualOnly:true};
}