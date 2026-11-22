// P0 true-geo Times Square pilot: real WGS84 building outline locations in
// uncompressed local ENU meters. Unlike nyc-gis-infill.js, this does NOT
// miniaturize footprints into PATROL's fictional roads or authored lots.
// Snapshot: assets/nyc/times-square-footprints.json (NYC Open Data, 2026-11-20).
// Not surveyed facades, an operational road system, or production gameplay.
export const TRUEGEO_ORIGIN=Object.freeze({
  lon:-73.9864883,lat:40.756421,heightMeters:0,
  label:'One Times Square origin (documented approximate landmark coordinate)'
});
const A=6378137, E2=6.6943799901413165e-3, RAD=Math.PI/180, EPS=1e-7;

function ecef(lon,lat,heightMeters=0){
  const lam=lon*RAD,phi=lat*RAD;
  const s=Math.sin(phi),c=Math.cos(phi);
  const n=A/Math.sqrt(1-E2*s*s);
  return [(n+heightMeters)*c*Math.cos(lam),
    (n+heightMeters)*c*Math.sin(lam),
    (n*(1-E2)+heightMeters)*s];
}
export function toLocalMeters(lon,lat,origin=TRUEGEO_ORIGIN){
  if(![lon,lat,origin.lon,origin.lat].every(Number.isFinite)||
     Math.abs(lat)>90||Math.abs(lon)>180)
    throw Error('Invalid WGS84 longitude/latitude');
  const xyz=ecef(lon,lat),o=ecef(origin.lon,origin.lat,origin.heightMeters||0);
  const dx=xyz[0]-o[0],dy=xyz[1]-o[1],dz=xyz[2]-o[2];
  const lam=origin.lon*RAD,phi=origin.lat*RAD;
  const east=-Math.sin(lam)*dx+Math.cos(lam)*dy;
  const north=-Math.sin(phi)*Math.cos(lam)*dx-
    Math.sin(phi)*Math.sin(lam)*dy+Math.cos(phi)*dz;
  // 1 PATROL preview X/Z unit = 1 actual horizontal meter.
  // Z grows south to retain a right-handed WebGL X/Y/Z frame.
  return [east,-north];
}
export function polygonSignedArea(poly){
  let area=0;
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length];
    area+=a[0]*b[1]-b[0]*a[1];
  }
  return area*.5;
}
function cross(a,b,c){
  return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
}
function pointInsideTriangle(p,a,b,c){
  return cross(a,b,p)>=-EPS&&cross(b,c,p)>=-EPS&&cross(c,a,p)>=-EPS;
}
// Closed simple rings only. Ear clipping prevents a convex fan incorrectly
// filling many concave source footprints. Rings with holes are excluded,
// not papered over with fabricated flat roofs.
export function triangulateSimplePolygon(poly){
  if(poly.length<3)throw Error('Polygon needs >=3 corners');
  const oriented=polygonSignedArea(poly)>0?poly:poly.slice().reverse();
  const ids=oriented.map((_,i)=>i),out=[];
  let guard=0;
  while(ids.length>3&&guard++<poly.length*poly.length){
    let removed=false;
    for(let k=0;k<ids.length;k++){
      const i0=ids[(k+ids.length-1)%ids.length],i1=ids[k],
        i2=ids[(k+1)%ids.length];
      const a=oriented[i0],b=oriented[i1],c=oriented[i2];
      if(cross(a,b,c)<=EPS)continue;
      if(ids.some(i=>i!==i0&&i!==i1&&i!==i2&&
        pointInsideTriangle(oriented[i],a,b,c)))continue;
      out.push([a,b,c]);ids.splice(k,1);removed=true;break;
    }
    if(!removed)throw Error('Source polygon cannot be safely triangulated');
  }
  if(ids.length!==3||cross(oriented[ids[0]],oriented[ids[1]],
    oriented[ids[2]])<=EPS)throw Error('Degenerate final source roof');
  out.push(ids.map(i=>oriented[i]));
  return out;
}
export function buildTrueGeoTimesSquare(snapshot,{maxFeatures=300}={}){
  if(!snapshot||!Array.isArray(snapshot.features))
    throw Error('Official footprint snapshot required');
  const positions=[],normals=[],surfaceKinds=[],stats=[],skipped=[];
  const ids=new Set();
  const bounds={minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity,
    minY:0,maxY:0};
  const add=(a,b,c,normal,surface)=>{
    for(const p of [a,b,c]){
      positions.push(p[0],p[1],p[2]);
      normals.push(normal[0],normal[1],normal[2]);
      surfaceKinds.push(surface);
    }
  };
  for(const feature of snapshot.features.slice(0,maxFeatures)){
    const fid=feature?.fid;
    if(!Number.isSafeInteger(fid)||ids.has(fid))
      throw Error('Missing/duplicated official FID');
    ids.add(fid);
    const height=feature.heightFt*.3048;
    if(!Number.isFinite(height)||height<=0)
      throw Error('Unknown/invalid source roof height for FID '+fid);
    if(!Array.isArray(feature.rings)||feature.rings.length!==1){
      skipped.push({fid,reason:'source footprint includes courtyard/inner rings'});
      continue;
    }
    const ring=feature.rings[0];
    if(!Array.isArray(ring)||ring.length<4||ring.length>128||
       ring.some(p=>!Array.isArray(p)||p.length!==2||
         !p.every(Number.isFinite))){
      skipped.push({fid,reason:'invalid simple exterior ring'});
      continue;
    }
    const closed=ring[0][0]===ring.at(-1)[0]&&ring[0][1]===ring.at(-1)[1];
    if(!closed){skipped.push({fid,reason:'unclosed source ring'});continue;}
    const poly=ring.slice(0,-1).map(p=>toLocalMeters(p[0],p[1]));
    const area=Math.abs(polygonSignedArea(poly));
    if(area<.5){skipped.push({fid,reason:'source ring too small'});continue;}
    let roofTriangles;
    try{roofTriangles=triangulateSimplePolygon(poly);}
    catch(error){skipped.push({fid,reason:String(error.message)});continue;}
    // Roof is real source HEIGHTROOF in feet converted to meters, unscaled.
    for(const [a,b,c] of roofTriangles)
      add([a[0],height,a[1]],[c[0],height,c[1]],
        [b[0],height,b[1]],[0,1,0],1);
    const oriented=polygonSignedArea(poly)>0?poly:poly.slice().reverse();
    for(let i=0;i<oriented.length;i++){
      const p=oriented[i],q=oriented[(i+1)%oriented.length];
      const dx=q[0]-p[0],dz=q[1]-p[1],len=Math.hypot(dx,dz);
      if(len<.01)continue;
      const n=[dz/len,0,-dx/len];
      const a=[p[0],0,p[1]],b=[q[0],0,q[1]],
        c=[q[0],height,q[1]],d=[p[0],height,p[1]];
      add(a,b,c,n,0);add(a,c,d,n,0);
    }
    for(const p of poly){
      bounds.minX=Math.min(bounds.minX,p[0]);
      bounds.maxX=Math.max(bounds.maxX,p[0]);
      bounds.minZ=Math.min(bounds.minZ,p[1]);
      bounds.maxZ=Math.max(bounds.maxZ,p[1]);
    }
    bounds.maxY=Math.max(bounds.maxY,height);
    stats.push({fid,roofMeters:height,footprintAreaSqMeters:area,
      footprintCorners:poly.length,roofTriangles:roofTriangles.length,
      source:'NYC official snapshot; WGS84 coordinates / HEIGHTROOF feet'});
  }
  return {positions:new Float32Array(positions),
    normals:new Float32Array(normals),
    surfaceKinds:new Float32Array(surfaceKinds),
    bounds,stats,skipped,
    coordinateFrame:'Local WGS84 ECEF-to-ENU metres, X east and Z south',
    spatialTruth:'source polygon locations; NOT certified mapped roads or facades',
    origin:TRUEGEO_ORIGIN};
}
