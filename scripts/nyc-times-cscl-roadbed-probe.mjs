// Read-only NYC OTI roadbed-centered CSCL audit — NO gameplay import.
// Source: https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Centerline_view/FeatureServer/0
// Official NYC CSCL metadata: CityOfNewYork/nyc-geo-metadata/Metadata/Metadata_StreetCenterline.md
// STREETWIDTH (source feet) is paved-area width, NOT DCM mapped ROW width.
// Actual vehicle use, plazas and signal phases require DOT/field verification.
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {toLocalMeters} from '../assets/nyc/times-square-metric-massing.js';

export const SERVICE='https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Centerline_view/FeatureServer/0';
export const BBOX=[-73.989,40.7555,-73.9825,40.7602];
export const FIELDS=[
  'OBJECTID','PHYSICALID','STREET_NAME','FULL_STREET_NAME','STATUS','TRAFDIR',
  'RW_TYPE','STREETWIDTH','STREETWIDTH_IRR','NUMBER_TRAVEL_LANES',
  'NUMBER_PARK_LANES','NUMBER_TOTAL_LANES','FROM_LEVEL_CODE','TO_LEVEL_CODE',
  'POSTED_SPEED','MODIFIED_DATE'
];
export function makeUrl(offset=0){
  const url=new URL(SERVICE+'/query');
  for(const [key,val] of Object.entries({
    where:'1=1',geometry:BBOX.join(','),geometryType:'esriGeometryEnvelope',
    inSR:'4326',outSR:'4326',spatialRel:'esriSpatialRelIntersects',
    outFields:FIELDS.join(','),returnGeometry:'true',
    orderByFields:'OBJECTID',resultOffset:String(offset),
    resultRecordCount:'1000',f:'geojson'
  }))url.searchParams.set(key,val);
  return url.toString();
}
const finite=(v)=>typeof v==='number'&&Number.isFinite(v);
function countBy(items,key){
  return items.reduce((out,item)=>{
    const code=String(item[key]??'missing');
    out[code]=(out[code]||0)+1;
    return out;
  },{});
}
const asCount=v=>Number.isInteger(v)&&v>=0&&v<=30?v:null;
const calcLength=lines=>lines.reduce((sum,line)=>sum+line.slice(1).reduce((n,b,i)=>{
  const a=line[i];return n+Math.hypot(b[0]-a[0],b[1]-a[1]);
},0),0);
export function checkFeatureCollection(data){
  if(data?.type!=='FeatureCollection'||!Array.isArray(data.features))
    throw Error('Official CSCL returned no GeoJSON FeatureCollection');
  const accepted=[],rejects=[],seen=new Set();
  for(const f of data.features){
    const p=f?.properties||{},id=p.OBJECTID;
    if(!Number.isSafeInteger(id)||seen.has(id)){
      rejects.push({id,reason:'invalid-or-duplicate-OBJECTID'});continue;
    }
    seen.add(id);
    const g=f?.geometry;
    if(!['LineString','MultiLineString'].includes(g?.type)){
      rejects.push({id,reason:'not-a-polyline'});continue;
    }
    const raw=g.type==='LineString'?[g.coordinates]:g.coordinates;
    if(!raw.every(line=>Array.isArray(line)&&line.length>=2&&
      line.every(pt=>Array.isArray(pt)&&pt.length>=2&&
        finite(pt[0])&&finite(pt[1])&&pt[0]>-74.1&&pt[0]<-73.7&&
        pt[1]>40.5&&pt[1]<40.9))){
      rejects.push({id,reason:'invalid-WGS84-geometry'});continue;
    }
    const lines=raw.map(line=>line.map(pt=>toLocalMeters(pt[0],pt[1])));
    const widthFeet=finite(p.STREETWIDTH)&&p.STREETWIDTH>0&&p.STREETWIDTH<400?
      p.STREETWIDTH:null;
    const status=String(p.STATUS??'');
    const direction=String(p.TRAFDIR??'');
    const roadwayType=Number.isInteger(p.RW_TYPE)?p.RW_TYPE:null;
    const laneCount=asCount(p.NUMBER_TRAVEL_LANES);
    const parkingLanes=asCount(p.NUMBER_PARK_LANES);
    const totalLanes=asCount(p.NUMBER_TOTAL_LANES);
    const levelFrom=Number.isInteger(p.FROM_LEVEL_CODE)?p.FROM_LEVEL_CODE:null;
    const levelTo=Number.isInteger(p.TO_LEVEL_CODE)?p.TO_LEVEL_CODE:null;
    // Candidate ONLY. No fabrication of lane markings, curb/sidewalk,
    // stop lines, traffic lights, lane widths or driving behavior.
    const constructed=status==='2';
    const streetRoadbed=roadwayType===1;
    const vehicleDirection=['FT','TF','TW'].includes(direction);
    accepted.push({
      id,physicalId:p.PHYSICALID??null,
      name:String(p.STREET_NAME||p.FULL_STREET_NAME||'').slice(0,100),
      status,direction,roadwayType,
      widthFeet,widthMeters:widthFeet===null?null:widthFeet*0.3048,
      widthIrregular:p.STREETWIDTH_IRR??null,
      travelLanes:laneCount,parkingLanes,totalLanes,
      fromLevel:levelFrom,toLevel:levelTo,
      speedRaw:p.POSTED_SPEED??null,
      modifiedRaw:p.MODIFIED_DATE??null,
      constructedVehicleCandidate:constructed&&streetRoadbed&&vehicleDirection,
      lengthMeters:calcLength(lines),lines
    });
  }
  return {accepted,rejects};
}
export function summarize(result,sourceCount){
  const {accepted,rejects}=result;
  const candidates=accepted.filter(x=>x.constructedVehicleCandidate);
  const widthKnown=candidates.filter(x=>x.widthFeet!==null);
  const laneKnown=candidates.filter(x=>x.travelLanes!==null);
  return {
    sourceFeatures:sourceCount,validFeatures:accepted.length,rejected:rejects.length,
    constructedVehicleCandidates:candidates.length,
    widthKnown:widthKnown.length,travelLaneCountKnown:laneKnown.length,
    totalCandidateLineMeters:candidates.reduce((s,r)=>s+r.lengthMeters,0),
    statuses:countBy(accepted,'status'),trafficDirections:countBy(accepted,'direction'),
    roadwayTypes:countBy(accepted,'roadwayType'),
    candidateNamedStreetCounts:countBy(candidates,'name'),
    sourceKnownWidthExamples:widthKnown.slice(0,12).map(x=>({
      id:x.id,name:x.name,feet:x.widthFeet,metres:+x.widthMeters.toFixed(3),
      direction:x.direction,travelLanes:x.travelLanes,irregular:x.widthIrregular
    })),
    caveats:[
      'Official CSCL is roadbed centerline, not pavement edge/curb/roadbed surface polygons.',
      'Width is source paved-area width in feet, never DCM legal right-of-way width.',
      'Traffic direction is source-relative and must be checked against polyline digitization/field observation before vehicle pathing.',
      'Null number-of-lanes remains unknown, not a guessed 1/2/3 lane count.',
      'Constructed status and street-type classifications are not real-time closures, plazas, construction permits or road signs.',
      'Date and licensing must be independently approved before storing source geometry inside the playable game.'
    ]
  };
}
export async function run(fetcher=fetch){
  const folder='artifacts/nyc-cscl-roadbed';
  await mkdir(folder,{recursive:true});
  let report={passed:false,source:SERVICE,queryBoundsWGS84:BBOX,
    terms:'https://data.cityofnewyork.us/stories/s/Terms-of-Use/k9k7-3cje',
    licenseApprovedForGame:false,
    cityModelModified:false,errors:[]};
  try{
    const features=[],seen=new Set();
    for(let offset=0;offset<=4000;offset+=1000){
      const response=await fetcher(makeUrl(offset),{signal:AbortSignal.timeout(45000)});
      if(!response.ok)throw Error('CSCL official HTTP '+response.status);
      const data=await response.json();
      if(data.error)throw Error('CSCL ArcGIS error: '+JSON.stringify(data.error));
      if(!Array.isArray(data.features))throw Error('Missing official line features');
      for(const feature of data.features){
        const id=feature?.properties?.OBJECTID;
        if(Number.isSafeInteger(id)&&!seen.has(id)){
          features.push(feature);seen.add(id);
        }
      }
      if(data.features.length<1000)break;
      if(offset===4000)throw Error('Pilot exceeds 5000 bounded features');
    }
    const checked=checkFeatureCollection({type:'FeatureCollection',features});
    const summary=summarize(checked,features.length);
    if(checked.accepted.length<15||summary.constructedVehicleCandidates<5)
      throw Error('Too few official roadway candidates: '+JSON.stringify(summary));
    report={...report,passed:true,summary,requestTimestamp:new Date().toISOString(),
      layerLastEditReported:'2026-11-07 (official ArcGIS metadata at check time)',
      sourceFeatureIds:checked.accepted.map(x=>x.id),rejected:checked.rejects};
    await writeFile(folder+'/roadbed-candidate-lines.json',JSON.stringify({
      source:SERVICE,frame:'WGS84 ellipsoid local East/North metres; origin One Times Square',
      licenseApprovedForGame:false,
      records:checked.accepted},null,2));
    console.log('NYC source CSCL roadbed audit PASS',JSON.stringify(summary));
  }catch(e){
    report.errors.push(String(e.stack||e));
    console.error('NYC CSCL roadbed source FAILED',e);
  }finally{
    await writeFile(folder+'/report.json',JSON.stringify(report,null,2));
  }
  if(!report.passed)process.exitCode=1;
  return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  await run();
