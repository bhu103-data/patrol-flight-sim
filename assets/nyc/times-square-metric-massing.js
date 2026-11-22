// NYC METRIC MASSING PILOT: original official NYC building polygon data only.
// This is NOT PATROL's compressed city and is NOT a photogrammetric city mesh.
// Source: existing assets/nyc/times-square-footprints.json (NYC NYC Open Data).
// No fake window openings, road widths or floor elevations are inferred.
export const ORIGIN=Object.freeze({
  longitude:-73.9864883,latitude:40.756421,
  label:'One Times Square reference (approximate, not a surveyed control)'
});
const RAD=Math.PI/180,A=6378137,F=1/298.257223563,E2=F*(2-F);
const phi=ORIGIN.latitude*RAD,sin=Math.sin(phi);
const denom=Math.sqrt(1-E2*sin*sin);
const METERS_PER_RAD_LON=A/denom*Math.cos(phi);
const METERS_PER_RAD_LAT=A*(1-E2)/(denom*denom*denom);
export function toLocalMeters(lon,lat){
  if(!Number.isFinite(lon)||!Number.isFinite(lat))throw Error('Invalid WGS84 coordinate');
  return [(lon-ORIGIN.longitude)*RAD*METERS_PER_RAD_LON,
    (lat-ORIGIN.latitude)*RAD*METERS_PER_RAD_LAT];
}
export const feetToMeters=feet=>{
  if(!Number.isFinite(feet)||feet<0)throw Error('Invalid source height');
  return feet*0.3048;
};
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const signedArea=p=>p.reduce((sum,a,i)=>{
  const b=p[(i+1)%p.length];
  return sum+(a[0]*b[1]-b[0]*a[1]);
},0)*.5;
function normalizeOuterRing(coords){
  if(!Array.isArray(coords)||coords.length<4||coords.length>160)return null;
  const ring=[];
  for(const point of coords){
    if(!Array.isArray(point)||point.length<2)return null;
    const m=toLocalMeters(point[0],point[1]);
    if(!ring.length||Math.hypot(m[0]-ring.at(-1)[0],m[1]-ring.at(-1)[1])>.10)
      ring.push(m);
  }
  if(ring.length>2&&Math.hypot(ring[0][0]-ring.at(-1)[0],
    ring[0][1]-ring.at(-1)[1])<.10)ring.pop();
  // Remove only near-zero-area corners (collinear source vertices).
  // Preserve actual parcel corners; do not rectangulate the real polygon.
  let changed=true,iterations=0;
  while(changed&&ring.length>3&&iterations++<160){
    changed=false;
    for(let i=0;i<ring.length;i++){
      const prev=ring[(i+ring.length-1)%ring.length],
        p=ring[i],next=ring[(i+1)%ring.length];
      if(Math.abs(cross(prev,p,next))<0.003){
        ring.splice(i,1);changed=true;break;
      }
    }
  }
  if(ring.length<3||Math.abs(signedArea(ring))<1)return null;
  if(signedArea(ring)<0)ring.reverse();
  return ring;
}
function triangulateRoof(ring){
  const ids=ring.map((_,i)=>i),out=[];
  const inside=(p,a,b,c)=>
    cross(a,b,p)>=-0.000001&&cross(b,c,p)>=-0.000001&&cross(c,a,p)>=-0.000001;
  let guard=0;
  while(ids.length>3&&guard++<ring.length*ring.length){
    let clipped=false;
    for(let i=0;i<ids.length;i++){
      const ia=ids[(i+ids.length-1)%ids.length],ib=ids[i],
        ic=ids[(i+1)%ids.length];
      const a=ring[ia],b=ring[ib],c=ring[ic];
      if(cross(a,b,c)<=0.000001)continue;
      if(ids.some(j=>j!==ia&&j!==ib&&j!==ic&&inside(ring[j],a,b,c)))continue;
      out.push([ia,ib,ic]);ids.splice(i,1);clipped=true;break;
    }
    if(!clipped)return null;
  }
  if(ids.length!==3||cross(...ids.map(i=>ring[i]))<=0.000001)return null;
  out.push(ids);
  return out.length===ring.length-2?out:null;
}
const WALL_PALETTE=[
  [.51,.45,.40],[.40,.47,.50],[.55,.53,.47],
  [.42,.39,.37],[.52,.48,.43],[.43,.46,.44]
];
// Returns CPU geometry and source diagnostics; this module is reusable by
// PATROL's native scene builder after street centerlines have been verified.
export function buildMetricMassing(source){
  if(!source||!Array.isArray(source.features))throw Error('Expected existing NYC GIS snapshot');
  const positions=[],normals=[],colors=[],buildings=[],skipped=[];
  const seen=new Set();
  let roofTriangles=0,wallTriangles=0;
  const triangle=(a,b,c,n,tone)=>{
    for(const v of [a,b,c]){
      positions.push(v[0],v[1],v[2]);
      normals.push(n[0],n[1],n[2]);
      colors.push(...tone);
    }
  };
  for(const rec of source.features){
    const fid=rec.fid;
    if(!Number.isSafeInteger(fid)||seen.has(fid)){
      skipped.push({fid,reason:'invalid-or-duplicate-fid'});continue;
    }
    seen.add(fid);
    if(!Array.isArray(rec.rings)||rec.rings.length!==1){
      skipped.push({fid,reason:'holes-or-multipolygon-requires-explicit-model'});continue;
    }
    if(!(rec.heightFt>0&&rec.heightFt<=1800)){
      skipped.push({fid,reason:'unknown-or-invalid-roof-height'});continue;
    }
    const ring=normalizeOuterRing(rec.rings[0]);
    if(!ring){skipped.push({fid,reason:'degenerate-footprint'});continue;}
    const roof=triangulateRoof(ring);
    if(!roof){skipped.push({fid,reason:'untriangulable-roof'});continue;}
    const roofY=feetToMeters(rec.heightFt);
    const shade=WALL_PALETTE[fid%WALL_PALETTE.length];
    const area=Math.abs(signedArea(ring));
    for(let i=0;i<ring.length;i++){
      const a=ring[i],b=ring[(i+1)%ring.length];
      const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
      if(len<.10)continue;
      const n=[dz/len,0,-dx/len];
      const lowA=[a[0],0,a[1]],lowB=[b[0],0,b[1]],
        highA=[a[0],roofY,a[1]],highB=[b[0],roofY,b[1]];
      triangle(lowA,highB,lowB,n,shade);
      triangle(lowA,highA,highB,n,shade);
      wallTriangles+=2;
    }
    for(const [a,b,c] of roof){
      const col=[.28,.31,.33];
      triangle([ring[a][0],roofY,ring[a][1]],
        [ring[c][0],roofY,ring[c][1]],
        [ring[b][0],roofY,ring[b][1]],[0,1,0],col);
      roofTriangles++;
    }
    buildings.push({fid,roofHeightMeters:roofY,roofHeightFeet:rec.heightFt,
      sourceAreaSquareMeters:area,vertexCount:ring.length,
      center:[ring.reduce((s,p)=>s+p[0],0)/ring.length,
        ring.reduce((s,p)=>s+p[1],0)/ring.length]});
  }
  const bounds={east:[Infinity,-Infinity],north:[Infinity,-Infinity],height:[0,0]};
  for(const v of buildings){
    const m=v.center;
    bounds.east[0]=Math.min(bounds.east[0],m[0]);
    bounds.east[1]=Math.max(bounds.east[1],m[0]);
    bounds.north[0]=Math.min(bounds.north[0],m[1]);
    bounds.north[1]=Math.max(bounds.north[1],m[1]);
    bounds.height[1]=Math.max(bounds.height[1],v.roofHeightMeters);
  }
  return {
    positions:new Float32Array(positions),
    normals:new Float32Array(normals),
    colors:new Float32Array(colors),
    buildings,skipped,bounds,
    stats:{sourceRecords:source.features.length,renderedBuildings:buildings.length,
      skippedBuildings:skipped.length,wallTriangles,roofTriangles,
      totalTriangles:wallTriangles+roofTriangles,metersPerWorldUnit:1,
      coordinateSystem:'local WGS84 ellipsoid East/North metres, up=metres',
      buildingPlacement:'source-preserved relative geometry, no hand-placed game proxies',
      sourceHeights:'HEIGHTROOF in feet * 0.3048; ground elevation not modeled'}
  };
}
