// Read-only USGS EPQS 3DEP exploratory samples, never called by game runtime.
// Source: https://epqs.nationalmap.gov/v1/docs (USGS National Map).
// Data: US public domain; spatial point queries, not a downloaded full DEM.
// No external dependencies, API keys, logins, asset/texture modifications.
import {mkdir,writeFile} from 'node:fs/promises';

const origin='https://epqs.nationalmap.gov/v1/json';
const outDir='artifacts/vegas-usgs';
await mkdir(outDir,{recursive:true});
const latitudeSamples=[...Array.from({length:11},(_,i)=>+(36.06+i*.016).toFixed(6)),36.1792].sort((a,b)=>a-b);
const transects=[
 {id:'west-red-rock-sample-line',lon:-115.48,
  note:'West of Strip, Spring Mountains approach; longitude is an exploratory sample transect, not a surveyed visible skyline crest'},
 {id:'east-frenchman-sample-line',lon:-114.997,
  note:'Near Frenchman Mountain summit longitude (~36.179 N, 114.997 W), exploratory north-south transect rather than a surveyed visible skyline crest'}
];
const results=[],errors=[];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function fetchPoint(lon,lat){
 const u=new URL(origin);
 u.searchParams.set('x',lon.toFixed(6));
 u.searchParams.set('y',lat.toFixed(6));
 u.searchParams.set('units','Meters');
 u.searchParams.set('wkid','4326');
 u.searchParams.set('includeDate','false');
 let lastError;
 for(let attempt=1;attempt<=3;attempt++){
  try{
   const response=await fetch(u,{headers:{Accept:'application/json'},
    signal:AbortSignal.timeout(30000)});
   if(!response.ok)throw Error('HTTP '+response.status);
   const data=await response.json();
   const elev=Number(data.value);
   if(!Number.isFinite(elev)||elev<0||elev>5000)
    throw Error('invalid elevation '+JSON.stringify(data.value));
   if(Math.abs(Number(data.location?.x)-lon)>0.00001||
      Math.abs(Number(data.location?.y)-lat)>0.00001)
    throw Error('EPQS response location mismatch');
   return {longitude:lon,latitude:lat,elevationMeters:+elev.toFixed(3),
    resolutionMeters:Number(data.resolution)||null,rasterId:data.rasterId??null,
    requestUrl:u.href};
  }catch(e){
   lastError=e;
   if(attempt<3)await sleep(1300*attempt);
  }
 }
 throw Error(lastError?.message||'EPQS query failed');
}
for(const line of transects){
 for(const lat of latitudeSamples){
  try{results.push({transect:line.id,...await fetchPoint(line.lon,lat)});}
  catch(e){errors.push({transect:line.id,longitude:line.lon,latitude:lat,
   error:e.message});}
  await sleep(700);
 }
}
const info={
 source:'USGS National Map EPQS v1 (interpolated 3DEP point elevation)',
 docs:'https://epqs.nationalmap.gov/v1/docs',
 accuracy:'https://www.usgs.gov/faqs/how-accurate-are-elevations-generated-elevation-point-query-service-national-map',
 license:'USGS 3DEP public domain',
 downloadedAtUtc:new Date().toISOString(),
 horizontalDatum:'NAD83 (wkid=4326)',
 unit:'meters',
 status:errors.length?'incomplete':'sample-complete',
 isFullDEM:false,
 mappedToPATROL:false,
 caution:'Exploratory north-south point transects, not a complete DEM or verified Strip line-of-sight silhouette. Do not enable as game mountain geometry without GIS registration/QA.',
 transects,expectedSamples:transects.length*latitudeSamples.length,
 receivedSamples:results.length,
 samples:results,errors
};
await writeFile(outDir+'/epqs-transects.json',JSON.stringify(info,null,2)+'\n');
console.log(JSON.stringify({status:info.status,received:results.length,expected:info.expectedSamples,
 errors:errors.slice(0,5),minElevationMeters:Math.min(...results.map(x=>x.elevationMeters)),
 maxElevationMeters:Math.max(...results.map(x=>x.elevationMeters))},null,2));
if(errors.length)process.exitCode=1;
