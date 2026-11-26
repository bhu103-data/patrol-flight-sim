import {readFileSync,writeFileSync} from 'node:fs';
import {encodeFootprints} from '../../assets/nyc/footprint-pack.mjs';
for(const [name,kind] of [['manhattan-footprints-v1',1],['east-bank-footprints-v2',2]]){
  const input=new URL('../../assets/nyc/'+name+'.json',import.meta.url);
  const source=readFileSync(input);
  const data=JSON.parse(source);
  const rows=data.footprints.sort((a,b)=>b[5]-a[5]||a[0]-b[0]);
  const packed=encodeFootprints(rows,kind);
  writeFileSync(new URL('../../assets/nyc/'+name+'.nfp',import.meta.url),new Uint8Array(packed));
  console.log(name,source.length,packed.byteLength);
}
