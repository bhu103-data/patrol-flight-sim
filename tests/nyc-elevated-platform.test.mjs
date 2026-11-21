import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const html=(await readFile(new URL('../index.html',import.meta.url),'utf8')).replace(/\r\n/g,'\n');
const a=html.indexOf('    const platformZ=track.z-2.55;');
const b=html.indexOf('  function updateBridgeRails()',a);
assert.ok(a>0&&b>a,'Brooklyn platform geometry must be discoverable');
const end=html.lastIndexOf('    }\n  }\n',b);
assert.ok(end>a,'street-scene closure must exist');
const boxes=[];
const track={z:-275,height:19.8,enabled:true};
new Function('track','box','metal','sidewalk',html.slice(a,end))(
  track,(...v)=>boxes.push(v),[.32,.35,.37],[.53,.54,.51]);

test('raised station uses same rail alignment and platform height as subway',()=>{
  assert.equal(boxes.length,5,'one platform, three supports and one roof');
  const [platform,...rest]=boxes,roof=rest.at(-1);
  assert.ok(Math.abs(platform[2]-(track.z-2.55))<1e-8);
  assert.equal(platform[1],track.height-.10);
  assert.equal(roof[2],platform[2]);
  assert.equal(roof[1],track.height+3.30);
  const doorSide=track.z-2.48/2,platformEdge=platform[2]+platform[5]/2;
  const gap=doorSide-platformEdge;
  assert.ok(gap>.2&&gap<.65,'platform must stop within normal boarding distance');
});

test('modern DUMBO map does not render the obsolete elevated railway by default',()=>{
  assert.match(html,/const BROOKLYN_RAIL = \{[^\n]*enabled:false/);
  assert.match(html,/if\(BROOKLYN_RAIL\.enabled\)\{\n\s*\/\/ Legacy elevated railway scenery/);
  assert.match(html,/if\(BROOKLYN_RAIL\.enabled\)\n\s*cityTraffic\.push\(\{kind:'train'/);
});
