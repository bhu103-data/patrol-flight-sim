import {validateTracyArmRaster} from './tracy-arm-geodesy.js';

function hex(bytes){
 return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}
async function sha256(bytes){
 if(!globalThis.crypto?.subtle)throw Error('SHA-256 validation requires a secure browser context');
 return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)));
}
function decodeBase64(text){
 const compact=text.replace(/\s/g,'');
 const binary=atob(compact);
 const bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 return bytes;
}

/**
 * Reconstruct the absolute signed-decimetre grid from a row-major 2D
 * predictor residual. First row stores horizontal deltas; first column of
 * later rows stores vertical deltas; interior stores current-left-up+up-left.
 */
export function decodeAlaskaIfsar5mDelta2(deltaBytes,width,height,noData=-32768){
 if(!(deltaBytes instanceof Uint8Array)||deltaBytes.byteLength!==width*height*2||
    !Number.isInteger(width)||!Number.isInteger(height)||width<2||height<2)
   throw Error('Invalid native IfSAR 5m residual payload dimensions');
 const dv=new DataView(deltaBytes.buffer,deltaBytes.byteOffset,deltaBytes.byteLength);
 const out=new Int16Array(width*height);
 for(let row=0;row<height;row++){
  const base=row*width,prev=base-width;
  for(let col=0;col<width;col++){
   const i=base+col,d=dv.getInt16(i*2,true);
   let value;
   if(row===0)value=col===0?d:out[i-1]+d;
   else if(col===0)value=out[prev]+d;
   else value=d+out[i-1]+out[prev+col]-out[prev+col-1];
   if(value<-32767||value>32767||value===noData)
    throw Error('Native IfSAR 5m delta reconstruction overflow/NoData at '+i);
   out[i]=value;
  }
 }
 return out;
}

export async function loadAlaskaIfsar5m(manifestUrl='./assets/alaska/tracy-arm-ifsar5m-manifest.json'){
 const manifestResponse=await fetch(manifestUrl,{cache:'force-cache'});
 if(!manifestResponse.ok)throw Error('Native IfSAR manifest HTTP '+manifestResponse.status);
 const manifest=await manifestResponse.json();
 if(manifest.format!=='patrol-ifsar5m-delta2-int16-gzip-base64-v1'||
    manifest.crs!=='EPSG:4326'||manifest.rowOrder!=='south-first'||
    manifest.width!==1536||manifest.height!==2880||
    manifest.metresPerInteger!==.1||manifest.noDataInt16!==-32768||
    manifest.sourceVerticalCrs!=='EPSG:5703'||
    manifest.geoid!=='GEOID09'||
    !Array.isArray(manifest.bboxWgs84)||manifest.bboxWgs84.length!==4||
    !manifest.bboxWgs84.every(Number.isFinite)||
    !/^[a-f0-9]{64}$/.test(manifest.gzipSha256||'')||
    !/^[a-f0-9]{64}$/.test(manifest.absoluteRawSha256||''))
  throw Error('Native IfSAR manifest failed source/datum/shape validation');
 const manifestAbsolute=new URL(manifestUrl,document.baseURI);
 const assetUrl=new URL(manifest.assetPath,manifestAbsolute);
 const assetResponse=await fetch(assetUrl,{cache:'force-cache'});
 if(!assetResponse.ok)throw Error('Native IfSAR compressed asset HTTP '+assetResponse.status);
 const base64=await assetResponse.text();
 if(base64.length>4_000_000||base64.length<1000)
  throw Error('Native IfSAR base64 payload size is outside verified bounds');
 const compressed=decodeBase64(base64);
 if(await sha256(compressed)!==manifest.gzipSha256)
  throw Error('Native IfSAR gzip SHA-256 mismatch');
 if(typeof DecompressionStream!=='function')
  throw Error('This browser does not support gzip DecompressionStream');
 const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
 const deltaBytes=new Uint8Array(await new Response(stream).arrayBuffer());
 if(await sha256(deltaBytes)!==manifest.deltaRawSha256)
  throw Error('Native IfSAR delta-grid SHA-256 mismatch');
 const absolute=decodeAlaskaIfsar5mDelta2(deltaBytes,manifest.width,manifest.height,manifest.noDataInt16);
 const absoluteBytes=new Uint8Array(absolute.length*2);
 const view=new DataView(absoluteBytes.buffer);
 for(let i=0;i<absolute.length;i++)view.setInt16(i*2,absolute[i],true);
 if(await sha256(absoluteBytes)!==manifest.absoluteRawSha256)
  throw Error('Native IfSAR reconstructed absolute-grid SHA-256 mismatch');
 const heights=new Float32Array(absolute.length);
 let min=Infinity,max=-Infinity;
 for(let i=0;i<absolute.length;i++){
  const h=absolute[i]*manifest.metresPerInteger;
  if(!Number.isFinite(h)||h< -250||h>3000)
   throw Error('Native IfSAR elevation outside verified bounds at '+i);
  heights[i]=h;min=Math.min(min,h);max=Math.max(max,h);
 }
 const [west,south,east,north]=manifest.bboxWgs84;
 const mid=(south+north)/2*Math.PI/180;
 const dem={
  format:'patrol-usgs-ifsar-5m-source-native-v1',
  source:'USGS 3DEP OPR Alaska IfSAR QL5',
  sourceProject:manifest.project,workunit:manifest.workunit,
  collectionStart:manifest.collectionStart,collectionEnd:manifest.collectionEnd,
  crs:'EPSG:4326',axis:'x=east, z=north, south-first raster rows',
  bbox:manifest.bboxWgs84,width:manifest.width,height:manifest.height,
  heights,highRes:true,metresPerInteger:1,noDataInt16:manifest.noDataInt16,
  verticalDatum:'NAVD88 / GEOID09',verticalCrs:manifest.sourceVerticalCrs,
  sourceVerticalCrs:manifest.sourceVerticalCrs,
  sampleSpacingApproxMeters:[
   (east-west)*111320*Math.cos(mid)/manifest.width,
   (north-south)*111320/manifest.height
  ],
  sourceElevationRangeMeters:[min,max],
  sourceTileSha256:manifest.sourceTileSha256,
  sourceAbsoluteGridSha256:manifest.absoluteRawSha256
 };
 validateTracyArmRaster(dem);
 return dem;
}
