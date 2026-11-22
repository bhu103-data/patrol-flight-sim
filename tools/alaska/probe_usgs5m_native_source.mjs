/**
 * Read-only native 5m source discovery for the corrected full Tracy Arm DEM AOI.
 *
 * Queries official USGS 3DEP Index geometry, 5m source work-unit metadata and
 * public S3 object listing. It does NOT infer full coverage from envelope count.
 * This is a gate before downloading or integrating the native IfSAR product.
 */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const root=new URL('../../',import.meta.url);
const geo=JSON.parse(readFileSync(new URL('../../assets/alaska/tracy-arm-3dep-actual-extent.json',import.meta.url),'utf8'));
const bbox=geo.actualPixelBboxWgs84;
if(geo.outputCrs!=='EPSG:4326'||bbox.join(',')!=='-133.265,57.822,-133.135,57.952')
  throw Error('Refusing native product query against unverified Tracy Arm WGS84 bbox');
const base='https://index.nationalmap.gov/arcgis/rest/services/3DEPElevationIndex/MapServer';
const report={
  source:'USGS 3DEP official Alaska 5m OPR / IfSAR source data',
  sourceIndex:base,
  sourceBboxWgs84:bbox,
  checkedAt:new Date().toISOString(),
  metadataCandidates:[],
  productFootprintFeatures:[],
  denseCoverage:{grid:25,total:625,covered:0,missing:0,coverageFraction:0},
  nativeProductDirectory:null,
  objects:[],
  gate:'blocked-until-native-source-and-continuity-verified',
  warnings:[
    'Index envelope intersection is not full AOI coverage proof.',
    '5m OPR projects may be seamless within project but are not guaranteed seamless across projects.',
    'Do not merge the dynamic ImageServer sample into runtime as a substitute for source-native GeoTIFF.'
  ]
};
async function getJson(url,label){
  const response=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(30000)});
  const body=await response.text();
  if(!response.ok)throw Error(label+' HTTP '+response.status+': '+body.slice(0,300));
  let data;try{data=JSON.parse(body)}catch{throw Error(label+' returned non-JSON: '+body.slice(0,200))}
  if(data.error)throw Error(label+' ArcGIS error: '+JSON.stringify(data.error).slice(0,400));
  return data;
}
function queryUrl(layer,params){
  const url=new URL(base+'/'+layer+'/query');
  for(const [k,v] of Object.entries({f:'json',where:'1=1',...params}))url.searchParams.set(k,String(v));
  return url;
}
function xmlValue(text,tag){
  const m=text.match(new RegExp('<'+tag+'>([\\\\s\\\\S]*?)</'+tag+'>'));
  return m?m[1].replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&quot;','"'):null;
}
function pointInRing(x,y,ring){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const [xi,yi]=ring[i],[xj,yj]=ring[j];
    if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))inside=!inside;
  }
  return inside;
}
function pointInFeature(x,y,feature){
  const rings=feature.geometry?.rings||[];
  let crossings=0;
  for(const ring of rings)if(pointInRing(x,y,ring))crossings++;
  return crossings%2===1;
}
async function main(){
  const env={geometry:bbox.join(','),geometryType:'esriGeometryEnvelope',
    inSR:4326,spatialRel:'esriSpatialRelIntersects'};
  const [footprints,metadata]=await Promise.all([
    getJson(queryUrl(3,{...env,returnGeometry:true,outSR:4326,
      geometryPrecision:7,outFields:'*',resultRecordCount:100}),'5m footprint geometry'),
    getJson(queryUrl(20,{...env,returnGeometry:false,
      outFields:'workunit,project,collect_start,collect_end,ql,dem_gsd_meters,horiz_crs,vert_crs,geoid,sourcedem_category,sourcedem_pub_date,metadata_link,sourcedem_link',
      resultRecordCount:100}),'5m source metadata')
  ]);
  report.productFootprintFeatures=(footprints.features||[]).map(f=>({
    attributes:f.attributes||{},rings:f.geometry?.rings||[]
  }));
  report.metadataCandidates=(metadata.features||[]).map(f=>f.attributes||{})
    .filter(a=>a.dem_gsd_meters===5);
  const step=24;
  for(let row=0;row<=step;row++)for(let col=0;col<=step;col++){
    const lon=bbox[0]+(bbox[2]-bbox[0])*(col+.5)/(step+1);
    const lat=bbox[1]+(bbox[3]-bbox[1])*(row+.5)/(step+1);
    const covered=report.productFootprintFeatures.some(f=>pointInFeature(lon,lat,f));
    if(covered)report.denseCoverage.covered++;else report.denseCoverage.missing++;
  }
  report.denseCoverage.coverageFraction=+(report.denseCoverage.covered/625).toFixed(6);
  const projects=report.metadataCandidates.filter(a=>a.sourcedem_link);
  const prefixes=[...new Set(projects.map(a=>{
    const u=new URL(a.sourcedem_link);return u.searchParams.get('prefix');
  }).filter(Boolean))];
  report.nativeProductDirectory=projects.map(a=>({
    workunit:a.workunit,project:a.project,ql:a.ql,demGsdMeters:a.dem_gsd_meters,
    horizontalCrs:a.horiz_crs,verticalCrs:a.vert_crs,geoid:a.geoid,
    collectionStart:a.collect_start,collectionEnd:a.collect_end,
    category:a.sourcedem_category,published:a.sourcedem_pub_date,
    metadataLink:a.metadata_link,sourceDirectory:a.sourcedem_link
  }));
  for(const prefix of prefixes){
    const url=new URL('https://prd-tnm.s3.amazonaws.com/');
    url.searchParams.set('list-type','2');url.searchParams.set('max-keys','1000');
    url.searchParams.set('prefix',prefix.replace(/\/?$/,'/'));
    const response=await fetch(url,{headers:{Accept:'application/xml'},signal:AbortSignal.timeout(30000)});
    const xml=await response.text();
    if(!response.ok)throw Error('Native OPR S3 listing HTTP '+response.status+': '+xml.slice(0,300));
    const objects=[];
    for(const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)){
      const block=m[1],key=xmlValue(block,'Key'),size=Number(xmlValue(block,'Size'));
      if(!key)continue;
      const file=key.split('/').pop();
      objects.push({key,file,size,lastModified:xmlValue(block,'LastModified'),
        url:'https://prd-tnm.s3.amazonaws.com/'+key.split('/').map(encodeURIComponent).join('/')});
    }
    report.objects.push(...objects);
    report.s3Listing={url:url.toString(),status:response.status,
      truncated:xmlValue(xml,'IsTruncated'),keyCount:objects.length};
  }
  const nativeRasters=report.objects.filter(x=>/\.(tif|tiff)$/i.test(x.file));
  report.nativeRasterCandidates=nativeRasters;
  if(report.metadataCandidates.length===0)throw Error('No official QL5 source metadata intersects corrected AOI');
  if(report.denseCoverage.coverageFraction<0.99)
    throw Error('Native 5m footprint dense coverage is incomplete: '+report.denseCoverage.covered+'/625');
  if(nativeRasters.length===0)
    throw Error('No native OPR GeoTIFF listed for exact source workunit; cannot proceed with dynamic service export');
  report.gate='native-source-found-full-sampled-footprint-coverage; verify-raster-extent-and-seams-next';
  mkdirSync('artifacts',{recursive:true});
  writeFileSync('artifacts/alaska-usgs5m-native-source.json',JSON.stringify(report,null,2));
  console.log('PASS native USGS 5m source discovery '+JSON.stringify({
    bbox,footprints:report.productFootprintFeatures.length,
    denseCoverage:report.denseCoverage,projects:report.nativeProductDirectory,
    nativeRasters:nativeRasters.map(x=>({file:x.file,size:x.size,url:x.url})),
    gate:report.gate
  }));
}
main().catch(error=>{
  report.error=error.message;
  mkdirSync('artifacts',{recursive:true});
  writeFileSync('artifacts/alaska-usgs5m-native-source.json',JSON.stringify(report,null,2));
  console.error('BLOCKED native USGS 5m source discovery: '+error.message);
  process.exitCode=1;
});
