/**
 * PATROL NYC P0: collect *real* NYC OTI 2022 PLAZA + SIDEWALK polygons in
 * exactly the same metre-based WGS84/DCP projection as the verified Roadbed
 * source (#244). No invented widths, plaza rectangles, facade or game edit.
 * Source-only QA artifacts: NOT distributable runtime assets by default.
 */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {BBOX,ORIGIN,toLocalMeters} from './nyc-times-true-scale-pilot.mjs';
import {
  parseRoadbedPolygons,SOURCE_TERMS,SOURCE_RULES
} from './nyc-times-roadbed-polygon-source.mjs';

export const PEDESTRIAN_LAYERS=Object.freeze({
  plaza:{
    url:'https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Plaza_2022/FeatureServer/16',
    code:3600
  },
  sidewalk:{
    url:'https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Sidewalk_2022/FeatureServer/22',
    code:3800
  }
});
export function pedestrianQueryUrl(kind,offset=0){
  const layer=PEDESTRIAN_LAYERS[kind];
  if(!layer||!Number.isSafeInteger(offset)||offset<0)
    throw Error('Unknown NYC pedestrian layer or offset');
  const url=new URL(layer.url+'/query');
  for(const [k,v] of Object.entries({
    where:'1=1',geometry:BBOX.join(','),
    geometryType:'esriGeometryEnvelope',inSR:'4326',outSR:'4326',
    spatialRel:'esriSpatialRelIntersects',
    outFields:'OBJECTID,SOURCE_ID,FEATURE_CODE,SUB_FEATURE_CODE,STATUS',
    orderByFields:'OBJECTID',resultOffset:String(offset),
    resultRecordCount:'200',returnGeometry:'true',f:'geojson'
  }))url.searchParams.set(k,v);
  return url.toString();
}
async function getPage(url,fetcher){
  let last;
  for(let retry=0;retry<3;retry++){
    try{
      const res=await fetcher(url,{signal:AbortSignal.timeout(35000)});
      if(res.ok){
        const data=await res.json();
        if(data?.error)throw Error('Official ArcGIS error '+JSON.stringify(data.error));
        if(data?.type!=='FeatureCollection'||!Array.isArray(data.features))
          throw Error('Official pedestrian geometry was not GeoJSON');
        return data;
      }
      if(res.status!==429&&res.status<500)throw Error('Official API HTTP '+res.status);
      last=Error('Temporary official API HTTP '+res.status);
    }catch(e){last=e;}
    if(retry<2)await new Promise(resolve=>setTimeout(resolve,(retry+1)*1300));
  }
  throw Error('Official OTI pedestrian API failed after retries: '+String(last));
}
export async function fetchPedestrianLayer(kind,fetcher=fetch){
  if(!PEDESTRIAN_LAYERS[kind])throw Error('Unknown NYC pedestrian layer');
  const features=[],seen=new Set();let done=false;
  for(let offset=0;offset<2000;offset+=200){
    const page=await getPage(pedestrianQueryUrl(kind,offset),fetcher);
    for(const f of page.features){
      const id=f?.properties?.OBJECTID;
      if(Number.isSafeInteger(id)&&!seen.has(id)){
        seen.add(id);features.push(f);
      }
    }
    if(page.features.length<200){done=true;break;}
  }
  if(!done)throw Error('Official '+kind+' query exceeded the 2000 feature guard');
  if(!features.length)throw Error('No official '+kind+' polygons in Times Square bounds');
  const polygons=parseRoadbedPolygons({type:'FeatureCollection',features})
    .map(x=>({...x,sourceLayer:kind}));
  if(!polygons.length)throw Error('No valid '+kind+' polygons');
  return polygons;
}
function round(x){return +x.toFixed(3);}
const pathOf=rings=>rings.map(ring=>ring.map((p,i)=>
  (i?'L':'M')+p[0]+' '+(-p[1])).join(' ')+' Z').join(' ');
export function pedestrianOverlaySvg(source,roadbed,pedestrian){
  if(source?.projection?.originLonLat?.join(',')!==ORIGIN.join(',')||
     roadbed?.projection?.originLonLat?.join(',')!==ORIGIN.join(','))
    throw Error('Pedestrian / roadbed / building CRS origins differ');
  if(!Array.isArray(pedestrian.plaza)||!Array.isArray(pedestrian.sidewalk))
    throw Error('Official plaza and sidewalk datasets required');
  const [a,b]=[toLocalMeters([BBOX[0],BBOX[1]]),
    toLocalMeters([BBOX[2],BBOX[3]])];
  const x0=Math.min(a[0],b[0]),y0=Math.min(a[1],b[1]),
    x1=Math.max(a[0],b[0]),y1=Math.max(a[1],b[1]),
    width=x1-x0,height=y1-y0;
  function shapes(features,fill,stroke){
    return features.flatMap(f=>f.polygons.map(rings=>
      '<path d="'+pathOf(rings)+'" fill="'+fill+'" stroke="'+stroke+
      '" stroke-width=".18" fill-rule="evenodd"/>')).join('\n');
  }
  const roadShapes=shapes(roadbed.roadbeds,'#3f807d','#28625e');
  const sidewalks=shapes(pedestrian.sidewalk,'#d2cfb6','#a3a08a');
  const plazas=shapes(pedestrian.plaza,'#d4a05a','#a16d33');
  const buildings=source.buildings.map(f=>
    '<polygon points="'+f.outline.map(p=>p[0]+','+(-p[1])).join(' ')+
    '" fill="#64748b" stroke="#9ba8b9" stroke-width=".28"/>').join('\n');
  const ctr=source.roads.flatMap(f=>f.lines.map(l=>
    '<polyline points="'+l.map(p=>p[0]+','+(-p[1])).join(' ')+
    '" fill="none" stroke="#b5e8ff" stroke-width=".55" opacity=".9"/>')).join('\n');
  const view=[round(x0),round(-y1),round(width),round(height)].join(' ');
  const legend='<g font-family="sans-serif" font-size="7" font-weight="600">'+
    '<rect x="'+round(x0+6)+'" y="'+round(-y1+5)+'" width="176" height="19" rx="2" fill="#101b2a" opacity=".9"/>'+
    '<text x="'+round(x0+10)+'" y="'+round(-y1+13)+'" fill="#dce6ee">NYC OTI official 2022 planimetrics · source pilot</text>'+
    '<text x="'+round(x0+10)+'" y="'+round(-y1+20)+'" fill="#d2a05a">gold=plaza  </text>'+
    '<text x="'+round(x0+64)+'" y="'+round(-y1+20)+'" fill="#d2cfb6">beige=sidewalk  </text>'+
    '<text x="'+round(x0+125)+'" y="'+round(-y1+20)+'" fill="#60c6ab">teal=roadbed</text>'+
    '</g>';
  return '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="'+
    Math.round(1200*height/width)+'" viewBox="'+view+'">'+
    '<rect x="'+round(x0)+'" y="'+round(-y1)+'" width="'+round(width)+
    '" height="'+round(height)+'" fill="#10202b"/><g>'+
    roadShapes+sidewalks+plazas+buildings+ctr+'</g>'+legend+'</svg>';
}
export function countSource(features){
  return {
    features:features.length,
    polygons:features.reduce((s,x)=>s+x.polygons.length,0),
    rings:features.reduce((s,x)=>s+x.polygons.reduce((v,y)=>v+y.length,0),0),
    vertices:features.reduce((s,x)=>s+x.polygons.reduce((v,y)=>
      v+y.reduce((a,ring)=>a+ring.length,0),0),0),
    subtypes:Object.fromEntries([...new Set(features.map(x=>String(x.subtype)))]
      .map(key=>[key,features.filter(x=>String(x.subtype)===key).length]))
  };
}
export async function run(){
  const ref=JSON.parse(readFileSync('artifacts/nyc-true-scale/source.json','utf8'));
  const roadway=JSON.parse(readFileSync('artifacts/nyc-roadbed-source/roadbed.json','utf8'));
  const plaza=await fetchPedestrianLayer('plaza');
  const sidewalk=await fetchPedestrianLayer('sidewalk');
  const counts={plaza:countSource(plaza),sidewalk:countSource(sidewalk)};
  const out='artifacts/nyc-oti-pedestrian-source';mkdirSync(out,{recursive:true});
  const data={
    schema:'patrol-nyc-oti-plaza-sidewalk-2022-source-v1',
    role:'SOURCE_GEO_REFERENCE_ONLY_NOT_ENABLED_IN_GAME',
    imageryYear:2022,terms:SOURCE_TERMS,captureRules:SOURCE_RULES,
    sources:Object.fromEntries(Object.entries(PEDESTRIAN_LAYERS)
      .map(([name,entry])=>[name,entry.url])),
    caveat:'Public plaza, sidewalk and roadbed 2D mapped 2022 planimetrics; not current 2026 road access, elevations, curb ramps, store fronts or collision.',
    projection:ref.projection,counts,plaza,sidewalk
  };
  writeFileSync(out+'/pedestrian-surfaces.json',JSON.stringify(data,null,2));
  writeFileSync(out+'/pedestrian-roadbed-overlay.svg',
    pedestrianOverlaySvg(ref,roadway,data));
  console.log(JSON.stringify({passed:true,counts,source:data.sources},null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  run().catch(e=>{console.error(e);process.exitCode=1;});
