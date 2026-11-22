// NYC official CSCL data-only acquisition QA, not a game asset import.
// Validates road centerline locations and traffic direction fields in the
// same WGS84 window as the existing Times Square building snapshot.
// No map geometry is enabled, no guessed width or asphalt created.
import {mkdir,writeFile} from 'node:fs/promises';

const output='artifacts/nyc-truegeo-cscl';
await mkdir(output,{recursive:true});
const bbox={north:40.7600,west:-73.9890,south:40.7555,east:-73.9830};
const source='https://data.cityofnewyork.us/resource/inkn-q76z.json';
const dataset='https://data.cityofnewyork.us/d/inkn-q76z';
const query=new URL(source);
query.searchParams.set('$select','physicalid,the_geom,trafdir,rw_type,status');
query.searchParams.set('$where',
  'within_box(the_geom,'+
  [bbox.north,bbox.west,bbox.south,bbox.east].join(',')+')');
query.searchParams.set('$limit','1000');
query.searchParams.set('$order','physicalid');
const evidence={assetRole:'SOURCE_ROAD_CANDIDATES_ONLY_NOT_IN_PATROL_GAME',
  dataset,source,sourceQuery:query.toString(),bbox,
  retrievedUTC:new Date().toISOString(),records:[],summary:{},passed:false};
function assert(ok,message){if(!ok)throw Error(message);}
try{
  const abort=AbortSignal.timeout(60000);
  const response=await fetch(query,{signal:abort,headers:{accept:'application/json'}});
  const body=await response.text();
  assert(response.ok,
    'NYC CSCL API HTTP '+response.status+': '+body.slice(0,300));
  const rows=JSON.parse(body);
  assert(Array.isArray(rows),'Expected JSON rows from municipal CSCL');
  assert(rows.length>5&&rows.length<1000,
    'Empty or truncated source-query result: '+rows.length);
  const ids=new Set();let allVertices=0,segments=0,nonfinite=0;
  const directions={},roadTypes={};
  for(const row of rows){
    const id=Number(row.physicalid);
    assert(Number.isSafeInteger(id)&&!ids.has(id),
      'Missing/duplicated source PHYSICALID');
    ids.add(id);
    const geom=row.the_geom;
    assert(geom&&['MultiLineString','LineString'].includes(geom.type),
      'Missing/unsupported municipal centerline shape '+id);
    const lines=geom.type==='LineString'?[geom.coordinates]:geom.coordinates;
    assert(lines.length>0&&lines.length<100,'Unsupported multiline count');
    let n=0;
    for(const line of lines){
      assert(Array.isArray(line)&&line.length>=2&&line.length<1000,
        'Invalid municipal road polyline '+id);
      for(const p of line){
        if(!Array.isArray(p)||p.length<2||!p.slice(0,2).every(Number.isFinite)||
          Math.abs(p[0])>180||Math.abs(p[1])>90)nonfinite++;
        else n++;
      }
      segments+=line.length-1;
    }
    assert(n>=2&&nonfinite===0,'Invalid source coordinates');
    allVertices+=n;
    const trafdir=typeof row.trafdir==='string'?row.trafdir:null,
      rwType=Number(row.rw_type);
    directions[trafdir??'UNKNOWN']=(directions[trafdir??'UNKNOWN']||0)+1;
    roadTypes[Number.isFinite(rwType)?String(rwType):'UNKNOWN']=
      (roadTypes[Number.isFinite(rwType)?String(rwType):'UNKNOWN']||0)+1;
    evidence.records.push({physicalid:id,trafdir,rwType:
      Number.isFinite(rwType)?rwType:null,status:row.status??null,
      lines});
  }
  evidence.summary={count:evidence.records.length,uniqueIds:ids.size,
    segments,vertices:allVertices,invalidCoordinates:nonfinite,
    directions,roadTypes,licenseNotYetApprovedForBundledGame:true,
    disclaimer:'Centerline only: no measured asphalt width, sidewalk or rail elevation'};
  assert(evidence.summary.count===ids.size,'ID count inconsistent');
  evidence.passed=true;
}catch(error){
  evidence.error=String(error.stack||error);
  process.exitCode=1;
}finally{
  await writeFile(output+'/cscl-source-evidence.json',
    JSON.stringify(evidence,null,2));
  console.log(JSON.stringify({
    passed:evidence.passed,sourceQuery:evidence.sourceQuery,
    summary:evidence.summary,error:evidence.error??null
  },null,2));
}
