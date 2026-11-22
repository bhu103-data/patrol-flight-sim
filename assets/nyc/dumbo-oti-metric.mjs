// Only for the isolated, opt-in NYC source-geometry preview.
// NYC OTI BUILDING_view 5zhs-2jue, original WGS84 exterior polygon rings.
// One WGS84 origin and ONE meters-per-degree conversion for every building.
// This is NOT hooked into PATROL collision, NYC roads, the flight camera or the map switch.
export const DUMBO_ORIGIN=Object.freeze({lon:-73.989,lat:40.702});
const deg=Math.PI/180, phi=DUMBO_ORIGIN.lat*deg;
// WGS84 standard local-meter series (appropriate over this <1 km AOI).
export const M_PER_DEG_LAT=111132.92-559.82*Math.cos(2*phi)+
  1.175*Math.cos(4*phi)-0.0023*Math.cos(6*phi);
export const M_PER_DEG_LON=111412.84*Math.cos(phi)-
  93.5*Math.cos(3*phi)+0.118*Math.cos(5*phi);

export function toLocalMeters(lon,lat){
  if(!Number.isFinite(lon)||!Number.isFinite(lat))throw Error('Finite WGS84 lon/lat required');
  return [(lon-DUMBO_ORIGIN.lon)*M_PER_DEG_LON,
    -(lat-DUMBO_ORIGIN.lat)*M_PER_DEG_LAT]; // east=X, south=Z
}
export function toWgs84(x,z){
  if(!Number.isFinite(x)||!Number.isFinite(z))throw Error('Finite metric x/z required');
  return [DUMBO_ORIGIN.lon+x/M_PER_DEG_LON,
    DUMBO_ORIGIN.lat-z/M_PER_DEG_LAT];
}
export function signedArea(ring){
  let twice=0;
  for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length];
    twice+=a[0]*b[1]-b[0]*a[1];
  }
  return twice/2;
}
export function polygonCentroid(ring){
  const area=signedArea(ring);
  if(Math.abs(area)<1e-7)throw Error('Degenerate source footprint');
  let x=0,z=0;
  for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length],v=a[0]*b[1]-b[0]*a[1];
    x+=(a[0]+b[0])*v;z+=(a[1]+b[1])*v;
  }
  return [x/(6*area),z/(6*area)];
}
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
// Ear-clip simple exterior rings, preserve original coordinates and winding.
// Source records with holes or self-intersections must be rejected, not repaired by guess.
export function roofTriangles(points){
  const clean=[];
  for(const p of points){
    if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite))throw Error('Invalid ring coordinate');
    if(!clean.length||Math.hypot(p[0]-clean.at(-1)[0],p[1]-clean.at(-1)[1])>1e-4)
      clean.push(p);
  }
  if(clean.length>2&&Math.hypot(clean[0][0]-clean.at(-1)[0],clean[0][1]-clean.at(-1)[1])<1e-4)
    clean.pop();
  if(clean.length<3||Math.abs(signedArea(clean))<1e-3)throw Error('Degenerate polygon');
  if(signedArea(clean)<0)clean.reverse(); // CCW in local X/Z
  const indices=clean.map((_,i)=>i),tri=[];
  while(indices.length>3){
    let clipped=false;
    for(let k=0;k<indices.length;k++){
      const ai=indices[(k-1+indices.length)%indices.length],
        bi=indices[k],ci=indices[(k+1)%indices.length];
      const a=clean[ai],b=clean[bi],c=clean[ci],area2=cross(a,b,c);
      if(area2<=1e-8)continue;
      let hasVertex=false;
      for(const j of indices){
        if(j===ai||j===bi||j===ci)continue;
        const p=clean[j],u=cross(a,b,p),v=cross(b,c,p),w=cross(c,a,p);
        if(u>=-1e-8&&v>=-1e-8&&w>=-1e-8){hasVertex=true;break;}
      }
      if(hasVertex)continue;
      tri.push([a,b,c]);indices.splice(k,1);clipped=true;break;
    }
    if(!clipped)throw Error('Source polygon needs topology review: cannot ear-clip');
  }
  tri.push(indices.map(i=>clean[i]));
  const sum=tri.reduce((s,t)=>s+Math.abs(cross(...t))*.5,0);
  const total=Math.abs(signedArea(clean));
  if(Math.abs(sum-total)>Math.max(.03,total*1e-5))
    throw Error('Roof triangulation area failed: '+sum+' versus '+total);
  return tri;
}
export function projectBuilding(feature){
  if(!Number.isSafeInteger(feature.fid)||feature.fid<=0||
      !(feature.heightRoofFt>10&&feature.heightRoofFt<=300)||
      !Array.isArray(feature.ring)||feature.ring.length<3)
    throw Error('Invalid OTI building record');
  const ring=feature.ring.map(p=>toLocalMeters(p[0],p[1]));
  const roofY=feature.heightRoofFt*.3048;
  const center=polygonCentroid(ring),tris=roofTriangles(ring);
  return {fid:feature.fid,bin:feature.bin,roofY,ring,center,roofTriangles:tris,
    areaM2:Math.abs(signedArea(ring))};
}
export function prepareDistrict(source){
  if(source?.schema!=='patrol-nyc-dumbo-oti-metric-preview-v1'||
      source.coordinateReference?.includes('1 meter=1 preview unit')!==true||
      !Array.isArray(source.features)||!source.features.length)throw Error('Unexpected metric source snapshot');
  const seen=new Set(),result=[];
  for(const rec of source.features){
    if(seen.has(rec.fid))throw Error('Duplicate OTI FID '+rec.fid);
    seen.add(rec.fid);result.push(projectBuilding(rec));
  }
  return result;
}
