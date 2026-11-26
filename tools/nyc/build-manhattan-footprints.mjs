import {readFileSync,writeFileSync} from 'node:fs';

const payload=JSON.parse(readFileSync('assets/nyc/source/manhattan_payload.json','utf8'));
const bytes=Buffer.from(payload.b64,'base64');
const count=bytes.readUInt32LE(0);
if(count!==payload.count)throw Error('Footprint count mismatch');
const {lat0,lon0}=payload.meta;
const en=(lat,lon)=>[(lon-lon0)*111320*Math.cos(lat0*Math.PI/180),(lat-lat0)*111320];
// The game island is compressed and straightened: align the longitudinal
// axis with the authored downtown, Flatiron and Central Park positions.
const [e0,n0]=en(40.71274,-74.01338);
const [e1,n1]=en(40.7829,-73.9654);
const l=Math.hypot(e1-e0,n1-n0), u=(e1-e0)/l, v=(n1-n0)/l;
const axis=(e,n)=>[(e-e0)*u+(n-n0)*v,(e-e0)*v-(n-n0)*u];
const [flat]=axis(...en(40.74106,-73.9897));
function project(e,n){
  const [along,across]=axis(e,n);
  const z=along<=flat?-398+along*218/flat:-180+(along-flat)*386/(l-flat);
  return [30+.24*z+across*.078,z];
}
const round=x=>Math.round(x*100)/100;
const rows=[];
let offset=4;
for(let i=0;i<count;i++){
  const height=bytes.readUInt16LE(offset)*.1; offset+=2;
  const rings=bytes[offset++];
  let polygon=[];
  for(let j=0;j<rings;j++){
    const size=bytes.readUInt16LE(offset); offset+=2;
    for(let k=0;k<size;k++,offset+=4){
      if(j===0)polygon.push(project(bytes.readInt16LE(offset),bytes.readInt16LE(offset+2)).map(round));
    }
  }
  polygon=polygon.filter((p,j,a)=>p[0]!==a[(j+a.length-1)%a.length][0]||p[1]!==a[(j+a.length-1)%a.length][1]);
  let changed=true;
  while(changed&&polygon.length>3){
    changed=false;
    polygon=polygon.filter((b,j,a)=>{
      const c=a[(j+1)%a.length],p=a[(j+a.length-1)%a.length];
      const cross=(b[0]-p[0])*(c[1]-b[1])-(b[1]-p[1])*(c[0]-b[0]);
      if(Math.abs(cross)<.002){changed=true;return false;}
      return true;
    });
  }
  if(polygon.length<3||polygon.length>64||height<=0)continue;
  const xs=polygon.map(p=>p[0]),zs=polygon.map(p=>p[1]);
  const a=Math.min(...xs),b=Math.max(...xs),c=Math.min(...zs),d=Math.max(...zs);
  const x=round((a+b)/2),z=round((c+d)/2);
  if(z<-524||z>662||Math.abs(x-.24*z-30)>145||b-a<.23||d-c<.23)continue;
  if(Math.abs(polygon.reduce((s,p,j)=>{const q=polygon[(j+1)%polygon.length];return s+p[0]*q[1]-q[0]*p[1]},0))<.12)continue;
  rows.push([i+2000000,x,z,round(b-a+.02),round(d-c+.02),round(Math.max(.42,Math.min(75,height*.15))),polygon]);
}
if(offset!==bytes.length)throw Error('Unexpected payload length');
writeFileSync('assets/nyc/manhattan-footprints-v1.json',JSON.stringify({schema:'patrol-manhattan-footprints-v1',sourceCount:count,footprints:rows}));
console.log({sourceCount:count,projected:rows.length});
