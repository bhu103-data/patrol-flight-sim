// Offline, independent true-metre low-flight CAMERA collision for the opt-in
// DUMBO source viewer. NOT PATROL C185 physics and NOT as-built 3D NYC curbs.
// 48 OTI polygon prisms and AGL roof heights are the only solid obstacles.
// Treat all footprints conservatively: no fly-through even if CSCL cuts them.
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const valid3=p=>Array.isArray(p)&&p.length===3&&p.every(finite);
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
function segDistance2(p,a,b){
  const vx=b[0]-a[0],vz=b[1]-a[1],length=vx*vx+vz*vz;
  const t=length>1e-16?
    clamp(((p[0]-a[0])*vx+(p[1]-a[1])*vz)/length,0,1):0;
  return (p[0]-a[0]-t*vx)**2+(p[1]-a[1]-t*vz)**2;
}
export function pointInSourceRing(p,ring){
  if(!Array.isArray(p)||p.length!==2||!Array.isArray(ring)||ring.length<3)
    throw new TypeError('Invalid source footprint geometry');
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[j],b=ring[i];
    if(segDistance2(p,a,b)<1e-12)return true;
    if((a[1]>p[1])!==(b[1]>p[1]) &&
      p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])
      inside=!inside;
  }
  return inside;
}
function proximity(p,ring){
  if(pointInSourceRing(p,ring))return 0;
  let nearest=Infinity;
  for(let i=0;i<ring.length;i++)
    nearest=Math.min(nearest,segDistance2(p,ring[i],ring[(i+1)%ring.length]));
  return Math.sqrt(nearest);
}
export function makeDumboMetricFlySafety(buildings,bounds,options={}){
  if(!Array.isArray(buildings)||buildings.length!==48||
     !bounds||!['minX','maxX','minZ','maxZ'].every(x=>finite(bounds[x])))
    throw new TypeError('Official 48-building metre district and bounds required');
  const radius=options.radius??1.3,roofMargin=options.roofMargin??1.8,
    minY=options.minY??2.2,maxY=options.maxY??210;
  if(![radius,roofMargin,minY,maxY].every(finite)||radius<.6||
     radius>3||roofMargin<0||roofMargin>5||minY<1||maxY<40)
    throw new RangeError('Unsafe collision clearance');
  const world={minX:bounds.minX-25,maxX:bounds.maxX+25,
    minZ:bounds.minZ-25,maxZ:bounds.maxZ+25,minY,maxY};
  const records=buildings.map(b=>{
    if(!Number.isSafeInteger(b.fid)||!finite(b.roofY)||
       b.roofY<=3.048||!Array.isArray(b.ring)||b.ring.length<3)
      throw new TypeError('Invalid municipal building prism');
    return {fid:b.fid,roofY:b.roofY,ring:b.ring,
      minX:Math.min(...b.ring.map(p=>p[0]))-radius,
      maxX:Math.max(...b.ring.map(p=>p[0]))+radius,
      minZ:Math.min(...b.ring.map(p=>p[1]))-radius,
      maxZ:Math.max(...b.ring.map(p=>p[1]))+radius};
  });
  function obstacle(pos){
    if(!valid3(pos))throw new TypeError('Finite metre position required');
    const [x,y,z]=pos;
    if(x<world.minX||x>world.maxX||z<world.minZ||z>world.maxZ||
      y<world.minY||y>world.maxY)
      return {kind:'out-of-metre-tile',fid:null};
    for(const b of records){
      // RoofY is NYC source HEIGHT_ROOF above a diagnostic FLAT ground.
      // No real terrain datum or cross-year grade is fabricated.
      if(y>b.roofY+roofMargin||x<b.minX||x>b.maxX||
        z<b.minZ||z>b.maxZ)continue;
      if(proximity([x,z],b.ring)<=radius)
        return {kind:'building',fid:b.fid};
    }
    return null;
  }
  function sweep(from,to){
    if(!valid3(from)||!valid3(to))throw new TypeError('Invalid swept metre segment');
    if(obstacle(from))throw new Error('Unsafe initial camera position');
    const dist=Math.hypot(...from.map((v,i)=>to[i]-v));
    if(dist>400)throw new RangeError('Excessive single-step flight displacement');
    const count=Math.max(1,Math.ceil(dist/.55));
    let last=from;
    for(let i=1;i<=count;i++){
      const t=i/count,p=from.map((v,k)=>v+(to[k]-v)*t);
      const block=obstacle(p);
      if(block)return {position:last,blocked:true,
        ...block,movedMetres:Math.hypot(...last.map((v,k)=>v-from[k])),
        requestedMetres:dist};
      last=p;
    }
    return {position:to,blocked:false,kind:null,fid:null,
      movedMetres:dist,requestedMetres:dist};
  }
  function sourceStreetSpawn(lines,focus){
    if(!Array.isArray(lines)||!valid3(focus))
      throw new TypeError('Official CSCL lines and camera focus required');
    const available=lines.filter(l=>!l.conflictFids?.length&&
      l.points?.length===2).map(l=>{
      const a=l.points[0],b=l.points[1];
      const pos=[(a[0]+b[0])/2,9.5,(a[1]+b[1])/2];
      return {pos,fid:l.physicalid,d:Math.hypot(pos[0]-focus[0],pos[2]-focus[2])};
    }).sort((a,b)=>a.d-b.d||a.fid-b.fid);
    const candidate=available.find(c=>!obstacle(c.pos));
    if(!candidate)throw new Error('No safe real-source street camera spawn');
    return {position:candidate.pos,sourcePhysicalId:candidate.fid,
      yIsDiagnosticAGL:true,claimedSafeStreetRouting:false};
  }
  return {obstacle,sweep,sourceStreetSpawn,bounds:world,radius,roofMargin,
    buildingCount:records.length};
}
