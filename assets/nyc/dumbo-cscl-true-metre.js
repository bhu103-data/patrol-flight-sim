/**
 * Offline, source-faithful NYC CSCL street centreline preparation.
 * Uses the SAME WGS84 east/up/north metre frame as the NYC OTI buildings.
 * NO guessed curbs, vehicle lanes, elevations, sidewalks, traffic phases,
 * parcel realignment, or bridge deck reconstruction.
 */
const bounded=(x,a,b,eps=1e-10)=>x>=a-eps&&x<=b+eps;
const validNumber=n=>typeof n==='number'&&Number.isFinite(n);

// Liang–Barsky line clipping in source WGS84 lon/lat; preserves true
// global line bearings and avoids non-official rectangle-patch geometry.
export function clipCsclSegment(a,b,bbox){
  if(!Array.isArray(a)||!Array.isArray(b)||a.length!==2||b.length!==2||
      ![...a,...b].every(validNumber))throw new Error('Invalid WGS84 segment');
  const dx=b[0]-a[0],dy=b[1]-a[1],p=[-dx,dx,-dy,dy],
    q=[a[0]-bbox.west,bbox.east-a[0],a[1]-bbox.south,bbox.north-a[1]];
  let lo=0,hi=1;
  for(let i=0;i<4;i++){
    if(Math.abs(p[i])<1e-16){
      if(q[i]<0)return null;
      continue;
    }
    const r=q[i]/p[i];
    if(p[i]<0)lo=Math.max(lo,r);
    else hi=Math.min(hi,r);
    if(lo>hi)return null;
  }
  if(hi-lo<=1e-9)return null;
  return [
    [a[0]+dx*lo,a[1]+dy*lo],
    [a[0]+dx*hi,a[1]+dy*hi]
  ];
}
const allowedGradeTrace=r=>
  (r.roadwayType===1||r.roadwayType===2)&&
  r.fromLevelCode==='13'&&r.toLevelCode==='13'&&
  r.status==='2';

// This is a non-physical diagnostic centreline ribbon of fixed 1.8m width.
// It visually distinguishes real WGS84 positions while not purporting
// to model curb edges or NYC CSCL streetwidth (which can be null/zero).
export function makeCsclRibbon(segment,widthMetres=1.8){
  if(!validNumber(widthMetres)||widthMetres<=0||widthMetres>3)
    throw new Error('Centreline ribbon is explicitly symbolic, at most 3m');
  const [a,b]=segment;
  const dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz);
  if(length<.005)return [];
  const nx=-dz/length*widthMetres*.5,nz=dx/length*widthMetres*.5;
  const p=[a[0]+nx,.08,a[2]+nz],q=[b[0]+nx,.08,b[2]+nz],
    r=[b[0]-nx,.08,b[2]-nz],s=[a[0]-nx,.08,a[2]-nz];
  // Clockwise x/z order yields positive-Y face normals in WebGL.
  return [[p,r,q],[p,s,r]];
}
export function prepareDumboCsclStreetNetwork(snapshot,frame){
  if(snapshot?.dataset!=='inkn-q76z'||snapshot.crs!=='EPSG:4326'||
      snapshot.role!=='OFFICIAL_STREET_CENTERLINE_SOURCE_NOT_CURB_WIDTH_SURVEY'||
      !Array.isArray(snapshot.records)||!snapshot.bbox)
    throw new Error('Untrusted or unsupported official NYC CSCL snapshot');
  if(typeof frame?.project!=='function')
    throw new Error('True WGS84 metre frame required');
  const bbox=snapshot.bbox;
  const seen=new Set(),groundCenterlines=[],excluded=[],skippedSegments=[];
  for(const rec of snapshot.records){
    if(!Number.isSafeInteger(rec.physicalid)||seen.has(rec.physicalid))
      throw new Error('Bad or duplicate source physicalid '+rec.physicalid);
    seen.add(rec.physicalid);
    if(!allowedGradeTrace(rec)){
      excluded.push({physicalid:rec.physicalid,name:rec.name,
        levelCodes:[rec.fromLevelCode,rec.toLevelCode],
        roadwayType:rec.roadwayType});
      continue;
    }
    if(!Array.isArray(rec.paths)||!rec.paths.length)
      throw new Error('Missing source geometry '+rec.physicalid);
    for(const path of rec.paths){
      if(!Array.isArray(path)||path.length<2)
        throw new Error('Broken centerline '+rec.physicalid);
      for(let k=1;k<path.length;k++){
        const clipped=clipCsclSegment(path[k-1],path[k],bbox);
        if(!clipped){
          skippedSegments.push(rec.physicalid);
          continue;
        }
        const [a,b]=clipped.map(p=>frame.project(p[0],p[1],0));
        const dx=b[0]-a[0],dz=b[2]-a[2],meters=Math.hypot(dx,dz);
        if(meters<.01)continue;
        for(const [lon,lat] of clipped)
          if(!bounded(lon,bbox.west,bbox.east)||
             !bounded(lat,bbox.south,bbox.north))
            throw new Error('CSCL clip escaped source bounds');
        groundCenterlines.push({
          physicalid:rec.physicalid,name:rec.name,trafdir:rec.trafdir,
          sourceLevelCode:'13',roadwayType:rec.roadwayType,
          sourceWidthFeet:rec.widthSourceFeet,
          wgs84:clipped,metres:[a,b],lengthMetres:meters
        });
      }
    }
  }
  if(groundCenterlines.length<100)
    throw new Error('Too few official at-grade review traces to visualize');
  const names=[...new Set(groundCenterlines.map(x=>x.name))].sort();
  return {
    bbox,sourceCount:snapshot.records.length,
    acceptedSourceRecordCount:new Set(groundCenterlines.map(x=>x.physicalid)).size,
    excludedSourceRecordCount:excluded.length,
    segmentCount:groundCenterlines.length,names,
    diagnostics:{excluded,skippedSegments},
    groundCenterlines
  };
}
