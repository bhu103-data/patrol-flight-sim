// Chongqing Pilot street/parcel clearance shared by city massing and road meshes.
// Conservative 2D AABB vs swept road segment, plus elevation-aware clipping.
// All coordinates are compressed game units; neither roads nor buildings are WGS84.
export function sweptSegmentInterval(a,b,footprint,halfRoadWidth=0,margin=0){
  if(![a.x,a.z,b.x,b.z,footprint.x,footprint.z,footprint.w,footprint.d,
    halfRoadWidth,margin].every(Number.isFinite))return null;
  const marginTotal=Math.max(0,halfRoadWidth)+Math.max(0,margin);
  const bounds=[
    [footprint.x-footprint.w*.5-marginTotal,
      footprint.x+footprint.w*.5+marginTotal,a.x,b.x-a.x],
    [footprint.z-footprint.d*.5-marginTotal,
      footprint.z+footprint.d*.5+marginTotal,a.z,b.z-a.z]
  ];
  let enter=0,exit=1;
  for(const [min,max,origin,delta] of bounds){
    if(Math.abs(delta)<1e-10){
      if(origin<min||origin>max)return null;
      continue;
    }
    const t0=(min-origin)/delta,t1=(max-origin)/delta;
    enter=Math.max(enter,Math.min(t0,t1));
    exit=Math.min(exit,Math.max(t0,t1));
    if(exit<enter)return null;
  }
  return [enter,exit];
}
export function crossesFootprint(a,b,footprint,halfRoadWidth=0,margin=0){
  return sweptSegmentInterval(a,b,footprint,halfRoadWidth,margin)!==null;
}
export function isRoadPassableAtElevation(a,b,building,roadThickness=1){
  // Elevated skybridges do not obstruct a road below them.
  const roadLow=Math.min(a.y??0,b.y??0)-roadThickness;
  const roadHigh=Math.max(a.y??0,b.y??0)+roadThickness;
  return roadHigh<(building.base??-Infinity)||roadLow>(building.top??Infinity);
}
// The road may cross an obstacle's 2D footprint but pass safely UNDER a
// raised building or OVER a lower terrace. Compare heights ONLY at the
// horizontal crossing interval, not at unrelated segment endpoints.
// A global endpoint min/max test falsely rejects steep Chongqing roads.
export function crossesRoadVolume(a,b,building,halfRoadWidth=0,margin=0,roadThickness=1){
  const interval=sweptSegmentInterval(a,b,building,halfRoadWidth,margin);
  if(!interval)return false;
  const ay=a.y??0,by=b.y??0;
  const at=t=>({y:ay+(by-ay)*t});
  return !isRoadPassableAtElevation(
    at(interval[0]),at(interval[1]),building,roadThickness);
}
export function clipRoadToFreeSegments(points,width,obstacles,padding=.7,minLength=3){
  const result=[],stats={testedSegments:0,clippedSegments:0,removedLength:0,keptLength:0};
  let open=null;
  const flush=()=>{if(open?.length>1&&open.reduce((n,p,i)=>i?n+Math.hypot(p.x-open[i-1].x,p.z-open[i-1].z):0,0)>=minLength)
    result.push(open);open=null;};
  const lerp=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});
  const add=(a,b)=>{
    const length=Math.hypot(a.x-b.x,a.z-b.z);
    if(length<1e-7)return;
    if(!open)open=[a,b];
    else{
      const prev=open[open.length-1];
      if(Math.hypot(prev.x-a.x,prev.z-a.z)<1e-6)open.push(b);
      else{flush();open=[a,b];}
    }
    stats.keptLength+=length;
  };
  for(let n=1;n<points.length;n++){
    const a=points[n-1],b=points[n],segmentLength=Math.hypot(b.x-a.x,b.z-a.z);
    if(segmentLength<1e-7)continue;
    stats.testedSegments++;
    const hits=[];
    for(const obstacle of obstacles){
      const interval=sweptSegmentInterval(a,b,obstacle,width*.5,padding);
      if(!interval)continue;
      // Compare vertical clearance at the actual horizontal crossing,
      // not at the extremes of a potentially steep mountain road.
      const at=t=>({y:(a.y??0)+((b.y??0)-(a.y??0))*t});
      if(isRoadPassableAtElevation(at(interval[0]),at(interval[1]),obstacle))continue;
      hits.push(interval);
    }
    if(!hits.length){add(a,b);continue;}
    hits.sort((x,y)=>x[0]-y[0]);stats.clippedSegments++;
    let current=0;
    for(const [min,max] of hits){
      if(min>current+1e-7){
        const length=segmentLength*(min-current);
        if(length>=minLength){add(lerp(a,b,current),lerp(a,b,min));}
        else stats.removedLength+=length;
        flush();
      }else if(open)flush();
      if(max>current){
        stats.removedLength+=segmentLength*(max-Math.max(current,min));
        current=max;
      }
      if(current>=1-1e-9)break;
    }
    if(current<1-1e-7){
      const length=segmentLength*(1-current);
      if(length>=minLength)add(lerp(a,b,current),b);
      else{stats.removedLength+=length;flush();}
    }else flush();
  }
  flush();
  return {paths:result,stats};
}
export function roadReserveAtSite(site,segments,halfWidth=0,padding=0){
  const box={x:site.x,z:site.z,w:site.w,d:site.d};
  for(const segment of segments){
    for(let i=1;i<segment.points.length;i++){
      if(crossesFootprint(segment.points[i-1],segment.points[i],
          box,(segment.width??halfWidth*2)*.5,padding))return true;
    }
  }
  return false;
}
// Reconstruct the analytical terrace centerline between the 27-unit guide
// points. Linear ribbons between those guides can cut through mountain grades
// and leave large daylight gaps under moving traffic. This intentionally uses
// the identical river/tier formula as both streetlife and chongqingTerraceRoads.
// Bounded <=5.5-unit subdivision adds a few thousand triangles, not a new LOD.
export function sampleChongqingTerraceSurface(plan,ground,riverCenter,
  maxStep=5.5,roadLift=1.6){
  if(!plan||!Array.isArray(plan.points)||plan.points.length<2||
     !Number.isFinite(plan.side)||!Number.isFinite(plan.tier)||
     typeof ground!=='function'||typeof riverCenter!=='function'||
     !Number.isFinite(maxStep)||maxStep<=0||maxStep>30||
     !Number.isFinite(roadLift))return [];
  const roadZ=x=>riverCenter(x)+plan.side*
    (145+plan.tier*105+14*Math.sin(x/115+plan.tier));
  const result=[];
  const put=x=>{
    const z=roadZ(x),y=ground(x,z)+roadLift;
    if(![x,y,z].every(Number.isFinite))
      throw Error('Invalid Chongqing terrace surface height');
    result.push({x,y,z});
  };
  put(plan.points[0].x);
  for(let i=1;i<plan.points.length;i++){
    const a=plan.points[i-1],b=plan.points[i];
    const length=Math.hypot(b.x-a.x,b.z-a.z);
    if(!Number.isFinite(length)||length<=0)
      throw Error('Invalid Chongqing terrace guide segment');
    const steps=Math.ceil(length/maxStep);
    for(let n=1;n<=steps;n++)put(a.x+(b.x-a.x)*n/steps);
  }
  return result;
}

// Do not stretch unbridged road ribbons across Chongqing's perpendicular
// tributary. Road centerlines and their FULL shoulder widths must both stay
// on dry terrain; longitudinal midpoint checks close gaps between samples.
// This operates before the independent building-volume clipping pass.
export function clipChongqingDryRoadSegments(points,width,ground,riverDist,
  shoreMargin=2.4,minLength=2.5){
  if(!Array.isArray(points)||points.length<2||
     !Number.isFinite(width)||width<=0||typeof ground!=='function'||
     typeof riverDist!=='function')return [];
  const result=[];let open=null;
  const flush=()=>{
    if(open?.length>1){
      const len=open.reduce((sum,p,i)=>i?
        sum+Math.hypot(p.x-open[i-1].x,p.z-open[i-1].z):0,0);
      if(len>=minLength)result.push(open);
    }
    open=null;
  };
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z;
    const length=Math.hypot(dx,dz);
    if(!Number.isFinite(length)||length<1e-7){flush();continue;}
    const nx=-dz/length,nz=dx/length,offset=width*.5+Math.max(0,shoreMargin);
    let dry=true;
    for(const t of [0,.5,1]){
      const x=a.x+dx*t,z=a.z+dz*t;
      for(const across of [-1,-.5,0,.5,1]){
        const sx=x+nx*offset*across,sz=z+nz*offset*across;
        if(!Number.isFinite(ground(sx,sz))||ground(sx,sz)<=0||
           riverDist(sx,sz)<shoreMargin){dry=false;break;}
      }
      if(!dry)break;
    }
    if(!dry){flush();continue;}
    if(!open)open=[a,b];else{
      const prev=open.at(-1);
      if(Math.hypot(prev.x-a.x,prev.z-a.z)<.001)open.push(b);
      else{flush();open=[a,b];}
    }
  }
  flush();
  return result;
}

export function chongqingTerraceRoads(riverCenter){
  const paths=[];
  for(const side of [-1,1])for(let tier=0;tier<3;tier++){
    const points=[];
    for(let i=0;i<=72;i++){
      const x=-960+1920*i/72,
        z=riverCenter(x)+side*(145+tier*105+14*Math.sin(x/115+tier));
      points.push({x,z});
    }
    paths.push({side,tier,width:13-tier*1.5,points});
  }
  return paths;
}
