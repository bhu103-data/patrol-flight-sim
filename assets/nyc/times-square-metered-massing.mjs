// Times Square WGS84 -> metre-scale building-massing reference. OPT-IN QA ONLY.
// The source is the existing official-FID subset in times-square-footprints.json.
// It was simplified to 6-decimal-degree vertices: this is not surveyed 3D,
// photogrammetry, building facade data, or today's complete NYC inventory.
// No game-space scaling, height compression, geodata fetching, or runtime patch.
export const TIMES_SQUARE_ORIGIN=Object.freeze({lon:-73.9864883,lat:40.75775});
const DEG=Math.PI/180, A=6378137, E2=6.6943799901413165e-3, FOOT=0.3048;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
function assertPoint(pair){
  if(!Array.isArray(pair)||pair.length!==2||
     !pair.every(finite)||Math.abs(pair[0])>180||Math.abs(pair[1])>90)
    throw new TypeError('Expected finite [longitude, latitude] WGS84 point');
}
function radii(origin){
  const phi=origin.lat*DEG,s=Math.sin(phi),d=1-E2*s*s;
  return {meridian:A*(1-E2)/Math.pow(d,1.5),prime:A/Math.sqrt(d),cos:Math.cos(phi)};
}
// Local tangent approximation of WGS84 geodetic coordinates in metres.
// Linearization is only intended within this sub-kilometre Times Square tile.
// Positive x is east and positive y is north (viewer maps north to -z).
export function wgs84ToMeters(pair,origin=TIMES_SQUARE_ORIGIN){
  assertPoint(pair);
  if(!origin||!finite(origin.lon)||!finite(origin.lat)||
     Math.abs(origin.lon)>180||Math.abs(origin.lat)>=89)
    throw new TypeError('Invalid local tangent-plane origin');
  const r=radii(origin);
  return [(pair[0]-origin.lon)*DEG*r.prime*r.cos,
          (pair[1]-origin.lat)*DEG*r.meridian];
}
export function metersToWgs84(pair,origin=TIMES_SQUARE_ORIGIN){
  if(!Array.isArray(pair)||pair.length!==2||!pair.every(finite))
    throw new TypeError('Expected two finite east/north metre coordinates');
  const r=radii(origin);
  return [origin.lon+pair[0]/(DEG*r.prime*r.cos),
          origin.lat+pair[1]/(DEG*r.meridian)];
}
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-
                    (b[1]-a[1])*(c[0]-a[0]);
export function signedAreaMeters(points){
  if(!Array.isArray(points)||points.length<3)return 0;
  let sum=0;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];
    sum+=a[0]*b[1]-b[0]*a[1];
  }
  return sum*.5;
}
function pointInTri(p,a,b,c){
  const eps=1e-9;
  return cross(a,b,p)>=-eps&&cross(b,c,p)>=-eps&&cross(c,a,p)>=-eps;
}
// Ear-clipping uses the full source polygon; a simple triangle fan would
// fill concave exterior space. The original wall ring is not simplified.
export function triangulateSimplePolygon(points){
  if(!Array.isArray(points)||points.length<3)
    throw new TypeError('Polygon needs at least 3 vertices');
  let ids=points.map((_,i)=>i);
  if(signedAreaMeters(points)<0)ids.reverse();
  const triangles=[];
  let safety=0;
  while(ids.length>3 && safety++<points.length*points.length*2){
    let found=false;
    for(let i=0;i<ids.length;i++){
      const a=ids[(i+ids.length-1)%ids.length],b=ids[i],
            c=ids[(i+1)%ids.length];
      if(cross(points[a],points[b],points[c])<=1e-8)continue;
      if(ids.some(k=>k!==a&&k!==b&&k!==c&&
           pointInTri(points[k],points[a],points[b],points[c])))continue;
      triangles.push([a,b,c]);
      ids.splice(i,1);found=true;break;
    }
    if(!found)break;
  }
  if(ids.length===3&&cross(points[ids[0]],points[ids[1]],points[ids[2]])>1e-8)
    triangles.push([...ids]);
  if(triangles.length!==points.length-2)
    throw new Error('Cannot triangulate this polygon without distortion');
  return triangles;
}
export function buildMeteredMassing(dataset,{origin=TIMES_SQUARE_ORIGIN}={}){
  if(!dataset||!Array.isArray(dataset.features)||
     dataset.coordinateSystem!=='WGS84 lon,lat; heights HEIGHTROOF in feet')
    throw new TypeError('Unrecognized NYC building footprint source');
  const seen=new Set(),buildings=[],skipped={
    invalid:0,duplicate:0,multiRing:0,invalidGeometry:0};
  for(const rec of dataset.features){
    if(!Number.isSafeInteger(rec.fid)||!finite(rec.heightFt)||
       rec.heightFt<=0||rec.heightFt>2500||!Array.isArray(rec.rings)){
      skipped.invalid++;continue;
    }
    if(seen.has(rec.fid)){skipped.duplicate++;continue}
    seen.add(rec.fid);
    // Courtyards/holes need constrained polygon triangulation. Do not
    // silently fill those voids or pretend they are full real buildings.
    if(rec.rings.length!==1){skipped.multiRing++;continue}
    const raw=rec.rings[0];
    if(!Array.isArray(raw)||raw.length<4){
      skipped.invalidGeometry++;continue;
    }
    let points;
    try{
      points=raw.map(p=>wgs84ToMeters(p,origin));
      if(Math.hypot(points[0][0]-points.at(-1)[0],
                   points[0][1]-points.at(-1)[1])<.02)points.pop();
      if(points.length<3||Math.abs(signedAreaMeters(points))<1)
        throw new Error('Invalid footprint area');
      // Physical building roofs are kept at the source HEIGHTROOF in feet,
      // translated to metres. No PATROL .32 factor or arbitrary roof cap.
      const triangles=triangulateSimplePolygon(points);
      buildings.push({fid:rec.fid,roofHeightMeters:rec.heightFt*FOOT,
        areaSquareMeters:Math.abs(signedAreaMeters(points)),
        footprintMeters:points,roofTriangles:triangles});
    }catch{skipped.invalidGeometry++}
  }
  let minE=Infinity,maxE=-Infinity,minN=Infinity,maxN=-Infinity,
      tallest=0,roofTriangles=0;
  for(const b of buildings){
    tallest=Math.max(tallest,b.roofHeightMeters);
    roofTriangles+=b.roofTriangles.length;
    for(const [e,n] of b.footprintMeters){
      minE=Math.min(minE,e);maxE=Math.max(maxE,e);
      minN=Math.min(minN,n);maxN=Math.max(maxN,n);
    }
  }
  return {origin:{...origin},units:'metres',heightScale:1,
    source:dataset.reference,sourceRetrieved:dataset.retrieved,
    coordinatePrecision:'source rounded to 1e-6 degree (about 0.11m in latitude)',
    buildings,skipped,sourceFeatureCount:dataset.features.length,
    boundsMeters:buildings.length?[minE,minN,maxE,maxN]:null,
    tallestRoofMeters:tallest,roofTriangles,
    note:'Real footprint outlines and rooftop heights; NOT real facades, current-day survey, city roads, or a game map replacement.'};
}
