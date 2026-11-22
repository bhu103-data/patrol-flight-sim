/** Native metre-frame drawing of official NYC planimetric curb lines.
 * The geometry is 2022-era captured planimetrics, not fabricated buffer offsets
 * around CSCL. This does NOT build or certify roadbed pavement/sidewalks.
 */
import {wgs84ToLocalMetres} from './nyc-metric-footprints.mjs';
const COLOR=[.26,.86,.81],NORMAL=[0,1,0];
const valid=p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&
 Number.isFinite(p[1])&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
const push=(v,p)=>v.push(p[0],.84,p[1],...NORMAL,...COLOR);

export function buildMetricCurbs(source){
 if(source?.sourceDataset!=='NYC Planimetric Database: Curbs / 5xvt-8cbk'||
    !Array.isArray(source.segments))
   throw TypeError('Official NYC planimetric Curbs snapshot required');
 let nEdges=0,nParts=0,totalMetres=0,used=0;
 const values=[],rejected=[],seen=new Set();
 for(const item of source.segments){
   const key=String(item?.id??'');
   if(!key||seen.has(key)){
     rejected.push({id:key,reason:'missing or duplicate source id'});continue;
   }
   seen.add(key);
   if(!Array.isArray(item.parts)||!item.parts.length){
     rejected.push({id:key,reason:'missing source curb geometry'});continue;
   }
   let count=0;
   for(const part of item.parts){
     if(!Array.isArray(part)||part.length<2||part.length>1000||
        !part.every(valid)){
       rejected.push({id:key,reason:'bad WGS84 source curb line'});continue;
     }
     const geo=part.map(p=>wgs84ToLocalMetres(p));
     let section=0;
     for(let i=1;i<geo.length;i++){
       const a=geo[i-1],b=geo[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
       if(!Number.isFinite(len)||len>1500){
         rejected.push({id:key,reason:'implausible source line length'});continue;
       }
       if(len<.03)continue;
       push(values,a);push(values,b);
       nEdges++;section++;totalMetres+=len;
     }
     if(section){nParts++;count++;}
   }
   if(count)used++;
 }
 if(used<1||values.some(v=>!Number.isFinite(v)))
   throw Error('No physical NYC curb edges available from official data');
 return {vertexBuffer:new Float32Array(values),
   stats:{dataset:source.sourceDataset,records:used,sourceParts:nParts,
     edges:nEdges,totalLengthMetres:Math.round(totalMetres*100)/100,
     fetchedUtc:source.fetchedUtc,captureVintage:source.captureVintage,
     noRoadbedOrSidewalks:true},
   rejected};
}
