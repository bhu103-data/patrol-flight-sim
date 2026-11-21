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
      if(isRoadPassableAtElevation(a,b,obstacle))continue;
      const interval=sweptSegmentInterval(a,b,obstacle,width*.5,padding);
      if(interval)hits.push(interval);
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
