import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const src=readFileSync(new URL('../assets/nyc/central-park.js',import.meta.url),'utf8');
const scope={};
new Script(src.replace(/^export /gm,'')+'\n;globalThis.build=buildCentralPark;')
  .runInNewContext(scope);
const grid={offset:30,tilt:.24,parkCenter:206,parkHalfLength:151,parkHalfWidth:43};
const terrainAt=(x,z)=>15.5+.12*Math.cos(x/30)+.13*Math.sin(z/24);

function forest(quality){
  const trunks=[];
  const stats=scope.build({grid,quality,waterY:12.2,streetY:14.86,
    terrainAt,addQuad(){},addTri(){},box(){},ribbon(){},
    beam:(a,b,w,color)=>{
      if(w!==.18||!Array.isArray(color)||
         color.join(',')!=='0.26,0.21,0.17')return;
      const u=a[0]-grid.offset-grid.tilt*a[2],z=a[2];
      trunks.push({u,z,y:a[1],top:b[1]});
    }
  });
  return {trunks,stats};
}

test('Loeb Boathouse roof, awning and canopy buffer never intersect park trees',()=>{
  for(const quality of ['low','high']){
    const {trunks,stats}=forest(quality);
    assert.equal(stats.trees,quality==='high'?350:165,
      'rejected tree positions must be retried, not silently delete the canopy');
    assert.equal(trunks.length,stats.trees,'collect all generated tree trunks');
    const offending=trunks.filter(t=>Math.abs(t.u-18)<8.2&&Math.abs(t.z-157)<6.5);
    assert.equal(offending.length,0,
      'a trunk or its offset crown may not pierce the solid Boathouse roof');
    assert.ok(trunks.every(t=>[t.u,t.z,t.y,t.top].every(Number.isFinite)));
  }
});

test('non-overlapping trees remain deterministic on the same map seed',()=>{
  for(const quality of ['low','high']){
    const first=forest(quality),second=forest(quality);
    assert.equal(JSON.stringify(first.trunks),JSON.stringify(second.trunks));
    // The exclusion must be local to Boathouse and not alter Central
    // Park water, lawn or paths, or change their generated counts.
    assert.equal(first.stats.waterBodies,6);
    assert.equal(first.stats.skippedWetPaths,0);
    assert.equal(first.stats.paths,second.stats.paths);
  }
});
