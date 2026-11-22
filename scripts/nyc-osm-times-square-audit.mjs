import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const OSM_ENDPOINTS=[
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.nchc.org.tw/api/interpreter'
];
export const TAG_KEYS=[
  'height','building:levels','building:part','roof:shape','roof:height',
  'roof:material','building:material','building:colour','name','wikidata'
];
export const OSM_LICENSE='ODbL-1.0';
export const OSM_ATTRIBUTION='© OpenStreetMap contributors';

export function buildOverpassQuery(bbox){
  if(!Array.isArray(bbox)||bbox.length!==4||!bbox.every(Number.isFinite))
    throw new TypeError('Expected [minLon,minLat,maxLon,maxLat] WGS84 bbox');
  const [west,south,east,north]=bbox;
  if(!(west<east&&south<north))throw new RangeError('Invalid WGS84 bbox order');
  const box=[south,west,north,east].join(',');
  return '[out:json][timeout:45];(way["building"]('+box+');relation["building"]('+box+');way["building:part"]('+box+');relation["building:part"]('+box+'););out tags geom;';
}

export function polygonMetrics(ring){
  if(!Array.isArray(ring)||ring.length<4)return null;
  const pts=ring.map(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)?p:null);
  if(pts.some(p=>!p))return null;
  const lat0=pts.reduce((s,p)=>s+p[1],0)/pts.length;
  const origin=pts[0];
  const rad=Math.PI/180,R=6378137;
  const xy=pts.map(p=>[
    R*Math.cos(lat0*rad)*(p[0]-origin[0])*rad,
    R*(p[1]-origin[1])*rad
  ]);
  if(Math.hypot(xy[0][0]-xy.at(-1)[0],xy[0][1]-xy.at(-1)[1])<.02)xy.pop();
  if(xy.length<3)return null;
  let twiceArea=0,cx=0,cy=0;
  for(let i=0;i<xy.length;i++){
    const a=xy[i],b=xy[(i+1)%xy.length],cross=a[0]*b[1]-b[0]*a[1];
    twiceArea+=cross;cx+=(a[0]+b[0])*cross;cy+=(a[1]+b[1])*cross;
  }
  if(Math.abs(twiceArea)<.01)return null;
  const area=Math.abs(twiceArea/2);
  const center=[cx/(3*twiceArea),cy/(3*twiceArea)];
  return {
    areaSquareMeters:area,
    centroidWGS84:[
      origin[0]+center[0]/(R*Math.cos(lat0*rad))/rad,
      origin[1]+center[1]/R/rad
    ]
  };
}
function normalizeWay(element){
  if(element?.type!=='way'||!element.tags?.building||
     element.tags['building:part'])return null;
  if(!Array.isArray(element.geometry)||element.geometry.length<4)return null;
  const ring=element.geometry.map(p=>[p.lon,p.lat]);
  const metrics=polygonMetrics(ring);
  if(!metrics)return null;
  return {id:element.id,tags:element.tags,ring,...metrics};
}
function validFootprint(f){
  if(!Number.isSafeInteger(f?.fid)||!Array.isArray(f.rings)||f.rings.length!==1)
    return null;
  const metrics=polygonMetrics(f.rings[0]);
  return metrics?{fid:f.fid,...metrics}:null;
}
function distanceMeters(a,b){
  const lat0=(a[1]+b[1])/2*Math.PI/180,R=6378137,rad=Math.PI/180;
  return Math.hypot((a[0]-b[0])*rad*R*Math.cos(lat0),(a[1]-b[1])*rad*R);
}
export function analyzeOsmFeatures(source,osm,{retrievedAt=new Date().toISOString(),bbox=source.bboxWGS84}={}){
  if(!Array.isArray(source?.features)||!Array.isArray(osm?.elements))
    throw new TypeError('Expected NYC source footprints and Overpass elements');
  const ways=osm.elements.map(normalizeWay).filter(Boolean);
  const relations=osm.elements.filter(e=>e?.type==='relation'&&e.tags?.building);
  const partRelations=osm.elements.filter(e=>e?.type==='relation'&&e.tags?.['building:part']);
  const parts=osm.elements.filter(e=>e?.tags?.['building:part']);
  const official=source.features.map(validFootprint).filter(Boolean);
  const matches=[],ambiguous=[],unmatched=[];
  for(const f of official){
    const candidates=ways.map(w=>{
      const distance=distanceMeters(f.centroidWGS84,w.centroidWGS84);
      const ratio=w.areaSquareMeters/f.areaSquareMeters;
      return {way:w,distance,areaRatio:ratio};
    }).filter(x=>x.distance<=8&&x.areaRatio>=.5&&x.areaRatio<=2)
      .sort((a,b)=>a.distance-b.distance||Math.abs(Math.log(a.areaRatio))-Math.abs(Math.log(b.areaRatio)));
    if(candidates.length===1){
      const c=candidates[0];
      matches.push({
        fid:f.fid,osmType:'way',osmId:c.way.id,
        centroidDistanceMeters:Number(c.distance.toFixed(3)),
        areaRatio:Number(c.areaRatio.toFixed(4)),
        tagKeys:Object.keys(c.way.tags).sort()
      });
    }else if(candidates.length>1){
      ambiguous.push({fid:f.fid,candidateOsmIds:candidates.map(x=>x.way.id),
        nearestDistanceMeters:Number(candidates[0].distance.toFixed(3))});
    }else unmatched.push(f.fid);
  }
  const matchedIds=new Set(matches.map(x=>x.osmId));
  const matchedWays=ways.filter(w=>matchedIds.has(w.id));
  const coverage=Object.fromEntries(TAG_KEYS.map(key=>[
    key,matchedWays.filter(w=>typeof w.tags[key]==='string'&&w.tags[key].trim()!=='').length
  ]));
  const allCoverage=Object.fromEntries(TAG_KEYS.map(key=>[
    key,ways.filter(w=>typeof w.tags[key]==='string'&&w.tags[key].trim()!=='').length
  ]));
  return {
    schema:'patrol-nyc-osm-times-square-audit-v1',
    status:'source-audit-only-no-game-import',
    retrievedAt,
    source:{
      name:'OpenStreetMap contributors',
      sourceMode:'live Overpass API response; retrievedAt is the source snapshot time',
      referenceExtractCandidate:'Geofabrik New York State extract 2026-10-18 (nycosm), not used by this run',
      queryBboxWGS84:bbox,
      queryType:'Overpass ways + relations tagged building or building:part',
      endpoint:'Overpass API (endpoint recorded by acquisition log)',
      license:OSM_LICENSE,
      attribution:OSM_ATTRIBUTION,
      shareAlike:'Derived OSM database remains under ODbL-1.0'
    },
    officialFootprintReference:{
      source:source.reference,
      retrieved:source.retrieved,
      featuresInSnapshot:source.features.length,
      singleRingValidFeatures:official.length,
      matchingPolicy:'unique OSM building way only; centroid distance <= 8m; OSM/official area ratio 0.5..2.0; building:part ways excluded'
    },
    osmCounts:{
      allElements:osm.elements.length,
      buildingWays:ways.length,
      buildingRelations:relations.length,
      buildingPartRelations:partRelations.length,
      buildingParts:parts.length
    },
    join:{
      uniqueMatches:matches.length,
      ambiguousCount:ambiguous.length,
      unmatchedCount:unmatched.length,
      matchQuality:{
        medianCentroidDistanceMeters:matches.length
          ?Number([...matches].map(x=>x.centroidDistanceMeters).sort((a,b)=>a-b)[Math.floor(matches.length/2)].toFixed(3)):null,
        maxCentroidDistanceMeters:matches.length
          ?Math.max(...matches.map(x=>x.centroidDistanceMeters)):null,
        minAreaRatio:matches.length
          ?Math.min(...matches.map(x=>x.areaRatio)):null,
        maxAreaRatio:matches.length
          ?Math.max(...matches.map(x=>x.areaRatio)):null
      },
      matchPolicy:'unique candidate only; no FID/OSM-ID pair list exported'
    },
    tagCoverage:{
      denominatorUniqueMatches:matchedWays.length,
      matched:coverage,
      allBuildingWaysDenominator:ways.length,
      allBuildingWays:allCoverage
    },
    caveats:[
      'OSM is volunteer-maintained, not an authoritative building survey.',
      'Tags are optional; absence is unknown, not permission to infer a value.',
      'OSM building geometry may derive from municipal footprints; OSM-specific enrichment is not an independent survey.',
      'Only unique way-to-footprint centroid/area matches are counted; relations and ambiguous candidates are reported separately.',
      'This report does not authorize any runtime import, facade reconstruction, or claim of photorealism.'
    ],
    redistribution:{
      license:OSM_LICENSE,
      attribution:OSM_ATTRIBUTION,
      rawOsmSnapshotCommitted:false,
      runtimeImport:false
    }
  };
}
export async function fetchOverpass(query,{fetchImpl=globalThis.fetch,endpoints=OSM_ENDPOINTS,timeoutMs=55000}={}){
  const errors=[];
  for(const endpoint of endpoints){
    try{
      const response=await fetchImpl(endpoint,{
        method:'POST',
        headers:{
          'content-type':'application/x-www-form-urlencoded; charset=UTF-8',
          'accept':'application/json',
          'user-agent':'PATROL-nyc-osm-source-audit/1.0 (source-only GitHub Actions)'
        },
        body:new URLSearchParams({data:query}),
        signal:AbortSignal.timeout(timeoutMs)
      });
      if(!response.ok)throw new Error('HTTP '+response.status);
      const data=await response.json();
      if(!Array.isArray(data.elements))throw new Error('Overpass JSON has no elements array');
      return {data,endpoint};
    }catch(error){errors.push({endpoint,error:String(error)});}
  }
  throw new Error('All Overpass endpoints failed: '+JSON.stringify(errors));
}
async function main(){
  const source=JSON.parse(await readFile(resolve(ROOT,'assets/nyc/times-square-footprints.json'),'utf8'));
  const query=buildOverpassQuery(source.bboxWGS84);
  const {data,endpoint}=await fetchOverpass(query);
  const report=analyzeOsmFeatures(source,data,{bbox:source.bboxWGS84});
  report.source.endpoint=endpoint;
  report.source.query=query;
  const outDir=resolve(ROOT,'artifacts/nyc-osm-times-square-audit');
  await mkdir(outDir,{recursive:true});
  await writeFile(resolve(outDir,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({
    status:report.status,endpoint,
    osmCounts:report.osmCounts,
    sourceFootprints:report.officialFootprintReference.singleRingValidFeatures,
    uniqueMatches:report.join.uniqueMatches,
    ambiguous:report.join.ambiguousFids.length,
    unmatched:report.join.unmatchedFids.length,
    tagCoverage:report.tagCoverage.matched,
    license:report.source.license
  },null,2));
}
if(import.meta.url===`file://${process.argv[1]}`)main().catch(error=>{
  console.error(error);process.exitCode=1;
});
