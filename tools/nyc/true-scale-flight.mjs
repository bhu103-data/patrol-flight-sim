// PATROL NYC true-metre street-level / low-flight viewer controls.
// Visual flight in a SEPARATE official-source scene, not PATROL aircraft physics.
// City geometry is the actual NYC DCM centerline + municipal 2-D footprint
// dataset; building faces are anonymous massing placeholders, not real facades.
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
const paperStreet=road=>/^(y|yes|true|1)$/i.test(String(road.paperStreet||''));
const validPoint=p=>Array.isArray(p)&&p.length>=2&&p.every(Number.isFinite);
export function distToSegment2(point,a,b){
  if(!validPoint(point)||!validPoint(a)||!validPoint(b))throw Error('Invalid metric coordinate');
  const dx=b[0]-a[0],dz=b[1]-a[1],l2=dx*dx+dz*dz;
  const t=l2>1e-12?clamp(((point[0]-a[0])*dx+(point[1]-a[1])*dz)/l2,0,1):0;
  return Math.hypot(point[0]-(a[0]+t*dx),point[1]-(a[1]+t*dz));
}
export function containsFootprint(point,ring){
  if(!validPoint(point)||!Array.isArray(ring)||ring.length<3)return false;
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if(distToSegment2(point,a,b)<1e-8)return true;
    const crosses=(a[1]>point[1])!==(b[1]>point[1]);
    if(crosses && point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
export function hitsBuilding(position,buildings,radius=1.2){
  if(!Array.isArray(position)||position.length!==3||
     !position.every(Number.isFinite))throw Error('Invalid 3D eye');
  const [x,y,z]=position;
  // Roof elevation is relative to unknown terrain datum. This pilot
  // explicitly ASSUMES flat visual ground y=0; never call this a real DEM.
  for(const b of buildings){
    if(!(b?.heightMeters>0)||!Array.isArray(b.outline))continue;
    if(y>b.heightMeters+radius||y<0)continue;
    const ring=b.outline;
    if(containsFootprint([x,z],ring))return true;
    for(let i=0;i<ring.length;i++){
      if(distToSegment2([x,z],ring[i],ring[(i+1)%ring.length])<=radius)return true;
    }
  }
  return false;
}
export function spawnOnVerifiedStreet(source,buildings){
  if(!Array.isArray(source?.roads)||!source.roads.length)
    throw Error('Actual official road records required before street flight');
  const candidates=[];
  for(const road of source.roads){
    // Exclude paper streets/unimproved record lines as street-level starts.
    if(paperStreet(road))continue;
    if(!/improved/i.test(String(road.buildStatus||'')))continue;
    for(const line of road.lines||[]){
      if(!Array.isArray(line))continue;
      for(let i=1;i<line.length;i++){
        const a=line[i-1],b=line[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
        if(len<8)continue;
        const midpoint=[(a[0]+b[0])*.5,(a[1]+b[1])*.5];
        const position=[midpoint[0],8,midpoint[1]];
        if(hitsBuilding(position,buildings,1.8))continue;
        candidates.push({street:road.streetName||'Unnamed official DCM line',
          sourceObjectId:road.objectId,position,
          yaw:Math.atan2(b[0]-a[0],b[1]-a[1]),
          score:Math.hypot(midpoint[0],midpoint[1]),segmentLength:len});
      }
    }
  }
  if(!candidates.length)throw Error('No clear improved DCM road centerline spawn; no fabricated fallback');
  return candidates.sort((a,b)=>a.score-b.score)[0];
}
export function advanceMetricFlight(state,input,dt,buildings,bounds){
  const {position,yaw,pitch}=state;
  if(!Array.isArray(position)||position.length!==3||position.some(v=>!Number.isFinite(v))||
     !Number.isFinite(yaw)||!Number.isFinite(pitch)||
     !Number.isFinite(dt)||dt<0)throw Error('Invalid flight state or delta');
  if(!Array.isArray(bounds)||bounds.length!==4||
     !bounds.every(Number.isFinite))throw Error('Metric source bounds required');
  const time=clamp(dt,0,.1),speed=(input.ShiftLeft||input.ShiftRight?68:25)*time;
  const fb=(input.KeyW?1:0)-(input.KeyS?1:0),
    side=(input.KeyD?1:0)-(input.KeyA?1:0),
    vertical=(input.KeyE?1:0)-(input.KeyQ?1:0);
  const len=Math.hypot(fb,side,vertical)||1;
  const sin=Math.sin(yaw),cos=Math.cos(yaw);
  const stepX=(fb*sin+side*cos)*speed/len;
  const stepZ=(fb*cos-side*sin)*speed/len;
  const stepY=vertical*speed/len;
  let result=position.slice(),blocked=false;
  // Swept collision: don't tunnel through a whole narrow building on a
  // delayed frame. Check <=1.5 m intervals along the intended travel.
  const segments=Math.max(1,Math.ceil(Math.hypot(stepX,stepZ,stepY)/1.5));
  const dx=stepX/segments,dy=stepY/segments,dz=stepZ/segments;
  for(let i=0;i<segments;i++){
    const candidate=[
      clamp(result[0]+dx,bounds[0]+2,bounds[2]-2),
      clamp(result[1]+dy,2.4,360),
      clamp(result[2]+dz,bounds[1]+2,bounds[3]-2)
    ];
    if(hitsBuilding(candidate,buildings,1.2)){
      // Wall slide: preserve the legal component when diagonal movement
      // contacts a real municipal polygon, without moving the source mesh.
      const xOnly=[candidate[0],candidate[1],result[2]],
        zOnly=[result[0],candidate[1],candidate[2]];
      if(!hitsBuilding(xOnly,buildings,1.2))result=xOnly;
      else if(!hitsBuilding(zOnly,buildings,1.2))result=zOnly;
      else if(!hitsBuilding([result[0],candidate[1],result[2]],buildings,1.2))
        result[1]=candidate[1];
      blocked=true;
    }else result=candidate;
  }
  return {position:result,yaw,pitch,blocked};
}
export function metricFlightTarget(position,yaw,pitch){
  return [position[0]+Math.sin(yaw)*Math.cos(pitch),
    position[1]+Math.sin(pitch),
    position[2]+Math.cos(yaw)*Math.cos(pitch)];
}
