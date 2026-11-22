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
  console.log('Querying official USGS '+label+' '+url.toString());
  let last;
  for(let attempt=1;attempt<=5;attempt++){
    try{
      const response=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(45000)});
      const body=await response.text();
      if(!response.ok){
        last=Error(label+' HTTP '+response.status+': '+body.slice(0,300));
        if(![408,425,429,500,502,503,504].includes(response.status))throw last;
      }else{
        let data;try{data=JSON.parse(body)}catch{throw Error(label+' returned non-JSON: '+body.slice(0,200))}
        if(data.error)throw Error(label+' ArcGIS error: '+JSON.stringify(data.error).slice(0,400));
        return data;
      }
    }catch(error){
      last=error;
      if(attempt===5)throw last;
    }
    console.log('Retry '+attempt+'/5 for '+label+': '+last.message);
    await new Promise(resolve=>setTimeout(resolve,Math.min(16000,1000*2**attempt)));
  }
  throw last||Error(label+' failed');
}
function queryUrl(layer,params){
  const url=new URL(base+'/'+layer+'/query');
  for(const [k,v] of Object.entries({f:'json',where:'1=1',...params}))url.searchParams.set(k,String(v));
  return url;
}
function xmlValue(text,tag){
  const m=text.match(new RegExp('<'+tag+'>([\\s\\S]*?)</'+tag+'>'));
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
  console.log('Checking 5m project metadata over the corrected full source footprint...');
  const metadata=await getJson(queryUrl(20,{...env,returnGeometry:false,
      outFields:'workunit,project,collect_start,collect_end,ql,dem_gsd_meters,horiz_crs,vert_crs,geoid,sourcedem_category,sourcedem_pub_date,metadata_link,sourcedem_link',
      resultRecordCount:100}),'5m source metadata');
  report.productFootprintFeatures=[];
  report.metadataCandidates=(metadata.features||[]).map(f=>f.attributes||{})
    .filter(a=>a.dem_gsd_meters===5);
  const step=4;
  report.denseCoverage.grid=5;report.denseCoverage.total=25;
  for(let row=0;row<=step;row++){
    const checks=[];
    for(let col=0;col<=step;col++){
      const lon=bbox[0]+(bbox[2]-bbox[0])*(col+.5)/(step+1);
      const lat=bbox[1]+(bbox[3]-bbox[1])*(row+.5)/(step+1);
      checks.push({lon,lat,col,row});
    }
    const results=await Promise.all(checks.map(async p=>{
      const data=await getJson(queryUrl(3,{
        geometry:JSON.stringify({x:p.lon,y:p.lat,spatialReference:{wkid:4326}}),
        geometryType:'esriGeometryPoint',inSR:4326,
        spatialRel:'esriSpatialRelIntersects',returnCountOnly:true
      }),'5m point '+p.col+','+p.row);
      return {...p,count:data.count||0};
    }));
    for(const p of results){if(p.count>0)report.denseCoverage.covered++;else report.denseCoverage.missing++;}
    console.log('USGS native 5m grid row '+row+': '+results.filter(p=>p.count>0).length+'/5 covered');
  }
  report.denseCoverage.coverageFraction=+(report.denseCoverage.covered/25).toFixed(6);
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
    console.log('Listing native OPR product directory '+url.toString());
    let xml='',response=null,last,objects=[];
    try{
      for(let attempt=1;attempt<=3;attempt++){
        try{
          response=await fetch(url,{headers:{Accept:'application/xml'},signal:AbortSignal.timeout(18000)});
          xml=await response.text();
          if(response.ok)break;
          last=Error('Native OPR S3 listing HTTP '+response.status+': '+xml.slice(0,300));
        }catch(error){last=error}
        if(attempt===3)throw last;
        console.log('Retry native OPR listing '+attempt+'/3: '+last.message);
        await new Promise(resolve=>setTimeout(resolve,1000*2**attempt));
      }
      for(const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)){
        const block=m[1],key=xmlValue(block,'Key'),size=Number(xmlValue(block,'Size'));
        if(!key)continue;
        const file=key.split('/').pop();
        objects.push({key,file,size,lastModified:xmlValue(block,'LastModified'),
          url:'https://prd-tnm.s3.amazonaws.com/'+key.split('/').map(encodeURIComponent).join('/')});
      }
      report.s3Listing={url:url.toString(),status:response.status,
        truncated:xmlValue(xml,'IsTruncated'),keyCount:objects.length};
    }catch(error){
      report.s3Listing={url:url.toString(),error:error.message};
      console.log('S3 list unavailable; trying official USGS OPR GeoTIFF directory mirror...');
      const workunit=projects.find(a=>a.sourcedem_link)?.workunit;
      if(!workunit)throw error;
      const waf=new URL('https://thor-f5.er.usgs.gov/ngtoc/metadata/waf/elevation/opr_dem/geotiff/'+encodeURIComponent(workunit)+'/');
      const res=await fetch(waf,{headers:{Accept:'text/html'},signal:AbortSignal.timeout(30000)});
      const html=await res.text();
      if(!res.ok)throw Error('Official USGS WAF directory HTTP '+res.status+': '+html.slice(0,300));
      for(const m of html.matchAll(/href=["']([^"'#?]+)["']/gi)){
        const href=m[1];if(href==='../'||href.startsWith('/'))continue;
        const file=decodeURIComponent(href.split('/').filter(Boolean).pop()||href);
        if(!/\.(tif|tiff|zip|xml|pdf)$/i.test(file))continue;
        objects.push({key:workunit+'/'+href,file,size:null,lastModified:null,
          url:new URL(href,waf).toString(),discovery:'official-USGS-WAF'});
      }
      report.wafListing={url:waf.toString(),status:res.status,keyCount:objects.length};
    }
    report.objects.push(...objects);
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
