import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodeFootprints} from '../assets/nyc/footprint-pack.mjs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url));
for(const [name,kind] of [['manhattan-footprints-v1',1],['east-bank-footprints-v2',2]]){
  test(name+' compact asset preserves every source coordinate, height and borough',()=>{
    const json=read('assets/nyc/'+name+'.json');
    const bytes=read('assets/nyc/'+name+'.nfp');
    assert.ok(bytes.length<json.length*.35);
    const unpack=bytes=>decodeFootprints(Uint8Array.from(bytes).buffer,kind);
    const source=JSON.parse(json).footprints.sort((a,b)=>b[5]-a[5]||a[0]-b[0]);
    assert.deepEqual(unpack(bytes),source);
    assert.throws(()=>unpack(bytes.subarray(0,bytes.length-1)),/Invalid|Truncated/);
  });
}
test('tile culling retains intersecting ranges and rejects wholly offscreen ranges',()=>{
  const source=read('index.html').toString();
  const code=source.slice(source.indexOf('  function cityFrustumPlanes('),
    source.indexOf('  function disposeSceneMesh('));
  const [planes,visible]=new Function(code+'return [cityFrustumPlanes,visibleCityRange]')();
  const unit=planes([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
  assert.equal(visible({lo:[-.5,-.5,-.5],hi:[.5,.5,.5]},unit),true);
  assert.equal(visible({lo:[.9,-.5,-.5],hi:[2,.5,.5]},unit),true);
  for(const lo of [[2,0,0],[0,2,0],[0,0,2],[-3,0,0],[0,-3,0],[0,0,-3]])
    assert.equal(visible({lo,hi:lo.map(n=>n+.5)},unit),false);
});
