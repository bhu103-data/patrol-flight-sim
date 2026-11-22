// Optional public NYC Centerline (CSCL) source-only overlay in the *isolated*
// 1:1 Times Square preview, not roadbed/collision/traffic geometry.
// No fake pavement widths or intersections. The public request is live and
// must not be presented as a pinned/relicensed in-repo road asset.
import {toLocalMeters} from './truegeo-times-square.mjs';

export const TIMES_SQUARE_CSCL_BBOX=Object.freeze({
  north:40.7600,west:-73.9890,south:40.7555,east:-73.9830
});
export function csclSourceURL(b=TIMES_SQUARE_CSCL_BBOX){
  const url=new URL('https://data.cityofnewyork.us/resource/inkn-q76z.json');
  url.searchParams.set('$select','physicalid,the_geom,trafdir,rw_type,status');
  url.searchParams.set('$where','within_box(the_geom,'+
    [b.north,b.west,b.south,b.east].join(',')+')');
  url.searchParams.set('$limit','1000');
  url.searchParams.set('$order','physicalid');
  return url.toString();
}
export function buildTrueGeoCSCL(rows){
  if(!Array.isArray(rows)||rows.length===0||rows.length>=1000)
    throw Error('NYC centerline result absent or truncated');
  const ids=new Set(),positions=[],normals=[],surfaceKinds=[],records=[];
  let segments=0;
  for(const row of rows){
    const physicalid=Number(row.physicalid);
    if(!Number.isSafeInteger(physicalid)||ids.has(physicalid))
      throw Error('Bad or duplicate official CSCL PHYSICALID');
    ids.add(physicalid);
    const shape=row.the_geom;
    if(!shape||!['MultiLineString','LineString'].includes(shape.type))
      throw Error('Invalid official street multiline');
    const lines=shape.type==='LineString'?[shape.coordinates]:shape.coordinates;
    if(!Array.isArray(lines)||!lines.length||lines.length>100)
      throw Error('Invalid CSCL source group');
    for(const line of lines){
      if(!Array.isArray(line)||line.length<2||line.length>1000)
        throw Error('Invalid CSCL polyline');
      for(let i=1;i<line.length;i++){
        const a=line[i-1],b=line[i];
        if(![a,b].every(p=>Array.isArray(p)&&p.length>=2&&
            p.slice(0,2).every(Number.isFinite)))
          throw Error('Invalid official road vertex');
        const A=toLocalMeters(a[0],a[1]),B=toLocalMeters(b[0],b[1]);
        if(Math.hypot(B[0]-A[0],B[1]-A[1])<.001)continue;
        for(const p of [A,B]){
          positions.push(p[0],.5,p[1]);
          normals.push(0,1,0);
          surfaceKinds.push(3);
        }
        segments++;
      }
    }
    records.push({physicalid,trafdir:row.trafdir??null,
      rwType:row.rw_type??null,source:'NYC CSCL'});
  }
  if(segments<5)throw Error('Insufficient real road centerline geometry');
  return {positions:new Float32Array(positions),
    normals:new Float32Array(normals),
    surfaceKinds:new Float32Array(surfaceKinds),
    stats:{physicalIds:ids.size,lineSegments:segments,
      coordinateFrame:'same WGS84-to-ENU 1:1 meters as building snapshot',
      geometry:'centerlines, NOT measured roadbed width or curb line'},
    records};
}
export async function fetchNYCCenterlines(){
  const response=await fetch(csclSourceURL(),{signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw Error('Official CSCL HTTP '+response.status);
  return buildTrueGeoCSCL(await response.json());
}
