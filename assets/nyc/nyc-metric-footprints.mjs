/** Independent 1:1-metre Times Square geometry audit/preview.
 * Official WGS84 source: assets/nyc/times-square-footprints.json (NYC OTI).
 * Coordinates: local east X; elevation Y; SOUTH Z (north = -Z).
 * Baselines share one WGS84/ECEF east-north-up basis; no game scale/clamps.
 * Visible roofs are source polygon topology; wall faces are undecorated
 * geometric extrusions, not surveyed façades or ground elevations.
 */
export const TIMES_SQUARE_ORIGIN=Object.freeze({
  longitude:-73.9864883,latitude:40.756421,height:0
});
const D2R=Math.PI/180, A=6378137, F=1/298.257223563;
const E2=F*(2-F), EPS=1e-7;

function ecef(lon,lat,h=0){
  const phi=lat*D2R,lam=lon*D2R,s=Math.sin(phi),c=Math.cos(phi);
  const N=A/Math.sqrt(1-E2*s*s);
  return [(N+h)*c*Math.cos(lam),(N+h)*c*Math.sin(lam),
    (N*(1-E2)+h)*s];
}
export function wgs84ToLocalMetres([lon,lat],origin=TIMES_SQUARE_ORIGIN){
  if(!Number.isFinite(lon)||!Number.isFinite(lat)||Math.abs(lon)>180||
     Math.abs(lat)>90)
    throw new TypeError('Expected finite longitude/latitude WGS84 degrees');
  const [ox,oy,oz]=ecef(origin.longitude,origin.latitude,origin.height??0);
  const [xx,yy,zz]=ecef(lon,lat);
  const dx=xx-ox,dy=yy-oy,dz=zz-oz;
  const lambda=origin.longitude*D2R,phi=origin.latitude*D2R;
  const east=-Math.sin(lambda)*dx+Math.cos(lambda)*dy;
  const north=-Math.sin(phi)*Math.cos(lambda)*dx-
    Math.sin(phi)*Math.sin(lambda)*dy+Math.cos(phi)*dz;
  return [east,-north]; // X east, Z south; no unknown terrain datum inserted
}
export function signedAreaXZ(ring){
  let sum=0;
  for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length];
    sum+=a[0]*b[1]-b[0]*a[1];
  }
  return sum/2;
}
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-
  (b[1]-a[1])*(c[0]-a[0]);
function close(a,b,threshold=.025){return Math.hypot(a[0]-b[0],a[1]-b[1])<threshold;}
export function cleanMetricRing(geoRing,origin=TIMES_SQUARE_ORIGIN){
  if(!Array.isArray(geoRing)||geoRing.length<4)
    throw Error('Polygon needs closed geographic exterior');
  const pts=geoRing.map(p=>wgs84ToLocalMetres(p,origin));
  if(close(pts[0],pts.at(-1)))pts.pop();
  const dedup=[];
  for(const p of pts)if(!dedup.length||!close(dedup.at(-1),p))dedup.push(p);
  if(dedup.length>2&&close(dedup[0],dedup.at(-1)))dedup.pop();
  // Preserve legally relevant bends while stripping duplicate/near-collinear
  // sub-centimetre noise from 1e-6-degree quantized source vertices.
  for(let pass=0;pass<3;pass++){
    let changed=false;
    for(let k=0;k<dedup.length&&dedup.length>3;k++){
      const prev=dedup[(k-1+dedup.length)%dedup.length];
      const next=dedup[(k+1)%dedup.length],cur=dedup[k];
      const edge=Math.hypot(next[0]-prev[0],next[1]-prev[1]);
      if(edge>.05&&Math.abs(cross(prev,cur,next))/edge<.015){
        dedup.splice(k,1);changed=true;k--;
      }
    }
    if(!changed)break;
  }
  if(dedup.length<3||Math.abs(signedAreaXZ(dedup))<.5)
    throw Error('Degenerate geospatial footprint');
  return signedAreaXZ(dedup)<0?dedup.reverse():dedup;
}
const inside=(p,a,b,c)=>cross(a,b,p)>=-EPS&&
  cross(b,c,p)>=-EPS&&cross(c,a,p)>=-EPS;
/** Concave ear triangulation, clockwise roof winding in WebGL X/Z.
 * Do not fan-fill holes: multi-ring features are excluded and reported.
 */
export function triangulateMetricRing(points){
  const order=points.map((_,i)=>i),triangles=[];
  const area=signedAreaXZ(points);
  if(area<=.5)throw Error('Expected clean CCW footprint');
  let guard=points.length*points.length;
  while(order.length>3&&guard-->0){
    let cut=false;
    for(let i=0;i<order.length;i++){
      const ai=order[(i-1+order.length)%order.length],bi=order[i],
        ci=order[(i+1)%order.length],a=points[ai],b=points[bi],c=points[ci];
      if(cross(a,b,c)<.0001)continue;
      if(order.some(j=>j!==ai&&j!==bi&&j!==ci&&inside(points[j],a,b,c)))continue;
      triangles.push([ai,bi,ci]);order.splice(i,1);cut=true;break;
    }
    if(!cut)break;
  }
  if(order.length!==3||cross(points[order[0]],points[order[1]],points[order[2]])<=.0001)
    throw Error('Non-simple or untriangulable source polygon');
  triangles.push([order[0],order[1],order[2]]);
  const covered=triangles.reduce((sum,[i,j,k])=>
    sum+cross(points[i],points[j],points[k])/2,0);
  if(Math.abs(covered-area)>Math.max(.025,area*.00001))
    throw Error('Roof area mismatch in triangulation');
  return {triangles,roofAreaMetres2:covered};
}
function push(vertices,a,b,c,normal,color){
  for(const p of [a,b,c])vertices.push(p[0],p[1],p[2],
    normal[0],normal[1],normal[2],...color);
}
/** Produce static GPU triangles from **existing official OTI snapshot**.
 * Only ring-exterior extrusion is asserted, not photo/ground truth realism.
 */
export function buildMetricFootprints(asset,{origin=TIMES_SQUARE_ORIGIN}={}){
  if(!asset||!Array.isArray(asset.features))throw TypeError('Missing official snapshot features');
  const vertices=[],perFeature=[],rejections=[],seen=new Set();
  let rawRings=0,estimatedTris=0,maxHeightMetres=0;
  let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
  for(const record of asset.features){
    const fid=record?.fid;
    if(!Number.isSafeInteger(fid)||seen.has(fid)){
      rejections.push({fid,reason:'invalid/duplicate FID'});continue;
    }
    seen.add(fid);
    if(record.rings?.length!==1){
      rejections.push({fid,reason:'multipart/holed footprint needs true hole triangulation'});continue;
    }
    if(!Number.isFinite(record.heightFt)||record.heightFt<=0){
      rejections.push({fid,reason:'height unknown; no guessed height'});continue;
    }
    let poly,roof;
    try{
      poly=cleanMetricRing(record.rings[0],origin);
      roof=triangulateMetricRing(poly);
    }catch(e){
      rejections.push({fid,reason:String(e.message)});continue;
    }
    const h=record.heightFt*.3048; // feet -> metres, NO 0.32 multiplier
    maxHeightMetres=Math.max(maxHeightMetres,h);
    const c=({0:[.51,.57,.64],1:[.61,.63,.65],2:[.46,.53,.57],
      3:[.68,.62,.56],4:[.47,.50,.56]})[fid%5];
    const roofColor=c.map(v=>Math.min(1,v*1.12));
    for(const [ai,bi,ci] of roof.triangles){
      const a=poly[ai],b=poly[bi],cc=poly[ci];
      // Ear clip is CCW in X/Z, reverse for +Y normal.
      push(vertices,[a[0],h,a[1]],[cc[0],h,cc[1]],[b[0],h,b[1]],
        [0,1,0],roofColor);estimatedTris++;
    }
    for(let k=0;k<poly.length;k++){
      const a=poly[k],b=poly[(k+1)%poly.length];
      const dx=b[0]-a[0],dz=b[1]-a[1],dist=Math.hypot(dx,dz);
      if(dist<.025)continue;
      const normal=[dz/dist,0,-dx/dist];
      const a0=[a[0],0,a[1]],b0=[b[0],0,b[1]],
        a1=[a[0],h,a[1]],b1=[b[0],h,b[1]];
      push(vertices,a0,b1,b0,normal,c);
      push(vertices,a0,a1,b1,normal,c);estimatedTris+=2;
    }
    for(const [x,z] of poly){
      minX=Math.min(minX,x);maxX=Math.max(maxX,x);
      minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);
    }
    perFeature.push({fid,vertexCount:poly.length,
      sourceHeightFt:record.heightFt,roofHeightMetres:h,
      roofAreaMetres2:roof.roofAreaMetres2,
      roofTriangleCount:roof.triangles.length,polygon:poly});
    rawRings++;
  }
  return {vertexBuffer:new Float32Array(vertices),
    buildings:perFeature,rejections,
    stats:{inputFeatures:asset.features.length,builtFeatures:rawRings,
      rejectedFeatures:rejections.length,triangles:estimatedTris,
      maxHeightMetres,bounds:[minX,minZ,maxX,maxZ],
      units:'metres',worldFrame:'local ENU: X=east, Z=south, Y=up',
      groundElevation:'unknown: zero reference plane, NOT a local survey datum'}};
}
