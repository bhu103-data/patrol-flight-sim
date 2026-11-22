// Read-only NYC DCP street-centerline source probe. DOES NOT import into game.
// Source official ArcGIS DCM_Street_Center_Line/FeatureServer/0, NYC DCP.
// Streetwidth is a source *string*; do not assume units or current carriageway.
// Paper/unmapped streets and geometry rights need separate checks.
import {mkdir,writeFile} from 'node:fs/promises';
const folder='artifacts/nyc-street-source';
await mkdir(folder,{recursive:true});
const service='https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/DCM_Street_Center_Line/FeatureServer/0/query';
const params=new URLSearchParams({
  where:'1=1',
  geometry:'-73.989,40.7555,-73.9825,40.7602',
  geometryType:'esriGeometryEnvelope',
  inSR:'4326',outSR:'4326',
  spatialRel:'esriSpatialRelIntersects',
  outFields:'OBJECTID,Street_NM,Streetwidth,Feat_status,Build_Status,Paper_ST,Record_ST',
  returnGeometry:'true',
  resultRecordCount:'1600',
  f:'geojson'
});
const url=service+'?'+params.toString();
let report={passed:false,source:service,
  requestBoundsWGS84:[-73.989,40.7555,-73.9825,40.7602],
  dateRequested:new Date().toISOString(),rightsReview:'REQUIRED',errors:[]};
try{
  const response=await fetch(url,{signal:AbortSignal.timeout(45000),headers:{accept:'application/geo+json'}});
  if(!response.ok)throw Error('NYC DCP ArcGIS HTTP '+response.status);
  const geo=await response.json();
  if(geo.error)throw Error('ArcGIS error '+JSON.stringify(geo.error));
  if(geo.type!=='FeatureCollection'||!Array.isArray(geo.features))
    throw Error('Unexpected ArcGIS GeoJSON structure');
  const accepted=[],streetNames={},invalid=[];
  for(const f of geo.features){
    const id=f.properties?.OBJECTID;
    const name=f.properties?.Street_NM??'UNKNOWN';
    const geom=f.geometry;
    if(!Number.isSafeInteger(id)||
      !['LineString','MultiLineString'].includes(geom?.type)){
      invalid.push({id,reason:'invalid id or polyline'});continue;
    }
    const lines=geom.type==='LineString'?[geom.coordinates]:geom.coordinates;
    if(!lines.every(line=>Array.isArray(line)&&line.length>=2&&
      line.every(p=>Array.isArray(p)&&p.length>=2&&
        Number.isFinite(p[0])&&Number.isFinite(p[1])))){
      invalid.push({id,reason:'nonfinite polyline'});continue;
    }
    accepted.push({id,name,
      rawStreetwidth:f.properties?.Streetwidth??null,
      sourceStatus:f.properties?.Feat_status??null,
      buildStatus:f.properties?.Build_Status??null,
      isPaper:f.properties?.Paper_ST??null,
      isRecord:f.properties?.Record_ST??null,
      lines});
    streetNames[name]=(streetNames[name]||0)+1;
  }
  accepted.sort((a,b)=>a.id-b.id);
  report={...report,passed:accepted.length>0,returned:geo.features.length,
    accepted:accepted.length,invalid:invalid.length,
    sourceStreetNames:streetNames,
    sample:accepted.slice(0,12).map(x=>({
      id:x.id,name:x.name,width:x.rawStreetwidth,
      status:x.sourceStatus,build:x.buildStatus,paper:x.isPaper,
      vertices:x.lines.reduce((n,l)=>n+l.length,0)
    })),
    warning:'No geometry or road-width records are shipped with PATROL in this read-only source probe. '+
      'Metadata fields and redistribution terms require independent approval.'};
  await writeFile(folder+'/candidate-streets.geojson.json',
    JSON.stringify({source:service,requestBoundsWGS84:report.requestBoundsWGS84,records:accepted},null,2));
  if(!report.passed)throw Error('No valid official street records');
  console.log('NYC DCP street dataset probe SUCCESS',JSON.stringify({
    returned:report.returned,accepted:report.accepted,invalid:report.invalid,
    streetNames:report.sourceStreetNames,sample:report.sample
  }));
}catch(e){
  report.errors.push(String(e.stack||e));
  console.error('NYC DCP street dataset probe FAILED:',e);
}finally{
  await writeFile(folder+'/source-report.json',JSON.stringify(report,null,2));
}
if(!report.passed)process.exitCode=1;
