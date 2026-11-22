// P0 isolated surveyed-footprint reference scene, deliberately separate from PATROL's
// compressed game map. Source: NYC OTI Building Footprints snapshot, 2026-11-20.
// A building footprint is not a surveyed facade, roof structure or ground elevation.
// This module never mutates index.html, existing game traffic or the flight scale.

export const ORIGIN = Object.freeze({lon:-73.98575,lat:40.758,alt:0});
export const FEET_TO_METRES = 0.3048;
const ELLIPSOID_A = 6378137;
const ELLIPSOID_E2 = 6.6943799901413165e-3;
const DEG = Math.PI / 180;

function earthFixed(lon,lat,alt=0){
  const l=lon*DEG,p=lat*DEG;
  const sp=Math.sin(p),cp=Math.cos(p),sl=Math.sin(l),cl=Math.cos(l);
  const normal=ELLIPSOID_A/Math.sqrt(1-ELLIPSOID_E2*sp*sp);
  return [(normal+alt)*cp*cl,(normal+alt)*cp*sl,
          (normal*(1-ELLIPSOID_E2)+alt)*sp];
}

export function wgs84ToEnu(lon,lat,alt=0,origin=ORIGIN){
  if(![lon,lat,alt,origin.lon,origin.lat,origin.alt].every(Number.isFinite) ||
     Math.abs(lon)>180||Math.abs(lat)>90)
    throw new RangeError('Invalid WGS84 coordinate or ENU origin');
  const [x,y,z]=earthFixed(lon,lat,alt);
  const [ox,oy,oz]=earthFixed(origin.lon,origin.lat,origin.alt);
  const dx=x-ox,dy=y-oy,dz=z-oz;
  const l=origin.lon*DEG,p=origin.lat*DEG;
  const sl=Math.sin(l),cl=Math.cos(l),sp=Math.sin(p),cp=Math.cos(p);
  return [
    -sl*dx+cl*dy,
    -sp*cl*dx-sp*sl*dy+cp*dz,
    cp*cl*dx+cp*sl*dy+sp*dz
  ];
}

const area2=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
export function signedArea(ring){
  let sum=0;
  for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length];
    sum+=a[0]*b[1]-b[0]*a[1];
  }
  return sum*.5;
}
function inside(a,b,c,p){
  return area2(a,b,p)>=-1e-8&&
    area2(b,c,p)>=-1e-8&&area2(c,a,p)>=-1e-8;
}
export function triangulateRing(raw){
  // ENU east/north is right-handed in the horizontal plane; make CCW.
  const ring=signedArea(raw)<0?[...raw].reverse():[...raw];
  if(ring.length<3||Math.abs(signedArea(ring))<1e-6)return [];
  const ids=ring.map((_,i)=>i),triangles=[];
  let guard=0;
  while(ids.length>3&&guard++<ring.length*ring.length){
    let clipped=false;
    for(let i=0;i<ids.length;i++){
      const a=ids[(i+ids.length-1)%ids.length],b=ids[i],
        c=ids[(i+1)%ids.length];
      if(area2(ring[a],ring[b],ring[c])<1e-7)continue;
      if(ids.some(j=>j!==a&&j!==b&&j!==c&&
          inside(ring[a],ring[b],ring[c],ring[j])))continue;
      triangles.push([ring[a],ring[b],ring[c]]);
      ids.splice(i,1);
      clipped=true;
      break;
    }
    if(!clipped)return [];
  }
  if(ids.length===3&&area2(ring[ids[0]],ring[ids[1]],ring[ids[2]])>1e-7)
    triangles.push(ids.map(i=>ring[i]));
  return triangles.length===ring.length-2?triangles:[];
}
function finitePoint(p){return Array.isArray(p)&&p.length>=2&&
  Number.isFinite(p[0])&&Number.isFinite(p[1]);}

export function buildMetricFootprintMesh(asset,{origin=ORIGIN}={}){
  if(!Array.isArray(asset?.features))throw new TypeError('Missing official features');
  const values=[],rejects=[],seen=new Set(),acceptedFids=[];
  let roofTriangles=0,wallTriangles=0,minX=Infinity,minZ=Infinity,
    maxX=-Infinity,maxZ=-Infinity,maxHeight=0;
  const vertex=(east,y,north,color)=>{
    // WebGL: X=east, Y=up, Z=-north. 1 unit = 1 physical metre.
    values.push(east,y,-north,...color);
    minX=Math.min(minX,east);maxX=Math.max(maxX,east);
    minZ=Math.min(minZ,-north);maxZ=Math.max(maxZ,-north);
    maxHeight=Math.max(maxHeight,y);
  };
  for(const record of asset.features){
    const fid=record?.fid;
    if(!Number.isSafeInteger(fid)||seen.has(fid)||
        !Number.isFinite(record.heightFt)||record.heightFt<=0||
        record.heightFt>2500||!Array.isArray(record.rings)||
        record.rings.length!==1||!Array.isArray(record.rings[0])){
      rejects.push({fid,reason:'invalid or duplicate footprint/height; interior holes unsupported'});
      continue;
    }
    seen.add(fid);
    const coords=record.rings[0];
    if(coords.length<4||coords.length>256||!coords.every(finitePoint)){
      rejects.push({fid,reason:'invalid geographic ring'});
      continue;
    }
    let points=coords.slice();
    if(Math.hypot(points[0][0]-points.at(-1)[0],
                  points[0][1]-points.at(-1)[1])<1e-10)points.pop();
    const ring=points.map(([lon,lat])=>{
      const [east,north]=wgs84ToEnu(lon,lat,0,origin);
      return [east,north];
    });
    if(ring.length<3||ring.some(p=>!p.every(Number.isFinite))||
       Math.abs(signedArea(ring))<.25){
      rejects.push({fid,reason:'degenerate metric polygon'});
      continue;
    }
    const caps=triangulateRing(ring);
    if(caps.length!==ring.length-2){
      rejects.push({fid,reason:'roof triangulation failed; never fill a courtyard'});
      continue;
    }
    const ordered=signedArea(ring)>0?ring:[...ring].reverse();
    const height=record.heightFt*FEET_TO_METRES;
    const tone=(Math.imul(fid,2654435761)>>>0)%7;
    const swatch=[
      [.53,.53,.51],[.49,.55,.57],[.55,.49,.46],[.40,.48,.53],
      [.57,.55,.50],[.47,.48,.49],[.52,.50,.54]
    ][tone],roof=swatch.map(x=>Math.min(1,x*1.19));
    for(const [a,b,c] of caps){
      vertex(a[0],height,a[1],roof);
      vertex(b[0],height,b[1],roof);
      vertex(c[0],height,c[1],roof);
      roofTriangles++;
    }
    for(let i=0;i<ordered.length;i++){
      const a=ordered[i],b=ordered[(i+1)%ordered.length];
      // Edge AB, with CCW footprint, outward normal points to right.
      vertex(a[0],0,a[1],swatch);
      vertex(b[0],0,b[1],swatch);
      vertex(b[0],height,b[1],swatch);
      vertex(a[0],0,a[1],swatch);
      vertex(b[0],height,b[1],swatch);
      vertex(a[0],height,a[1],swatch);
      wallTriangles+=2;
    }
    acceptedFids.push(fid);
  }
  if(!acceptedFids.length)throw new Error('No valid metric NYC geometry');
  return {
    interleaved:new Float32Array(values),
    strideFloats:6,
    stats:{inputRecords:asset.features.length,acceptedBuildings:acceptedFids.length,
      rejectedBuildings:rejects.length,roofTriangles,wallTriangles,
      triangles:roofTriangles+wallTriangles,metresPerWorldUnit:1,
      minX,maxX,minZ,maxZ,maxHeight,acceptedFids,rejects,
      source:asset.source||'NYC Building Footprints',
      caveat:'True XY metric footprint; source HEIGHTROOF values, simplified flat ground and authored materials. No measured facades, street topology or absolute terrain elevation.'}
  };
}
