// One Times Square must not render debugging serials as its primary ad art.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const begin=html.indexOf('PATROL_NYC_ONE_TIMES_AD_UNIQUENESS_V16');
const finish=html.indexOf('const ball=[[34.18',begin);
assert.ok(begin>0&&finish>begin);
const artwork=html.slice(begin,finish);

test('billboard headline no longer uses the large numbered debug caption',()=>{
 assert.match(artwork,/PATROL_ONE_TIMES_CAMPAIGN_ART_V17/);
 assert.match(artwork,/const headline=caption\.slice/);
 assert.match(artwork,/const edition=caption\.match\(\/\\d\+\$\/\)/);
 assert.match(artwork,/addVegasLettering\(lights\.addQuad,headline/);
 assert.match(artwork,/addVegasLettering\(lights\.addQuad,edition/);
 assert.doesNotMatch(artwork,/addVegasLettering\(lights\.addQuad,caption/);
 assert.match(artwork,/1\.47,\.19/,'edition is a small footer, not the ad headline');
});
test('static creative is visually more than eight flat primary-color boards',()=>{
 assert.match(artwork,/stripe<22/);
 assert.match(artwork,/stripe%3|stripe % 3/);
 assert.match(artwork,/serial\*\.6180339887/);
 assert.match(artwork,/ray<6/);
 assert.match(artwork,/height\*\.24/);
 assert.match(artwork,/v\*wave/);
 assert.match(artwork,/face\+side\*\.391/);
});
test('campaign IDs remain monotonic and never collide across two browser launches',()=>{
 const at=artwork.indexOf('const layouts=side===1?[');
 const until=artwork.indexOf('for(const [base,height,tint,caption] of boards)',at);
 assert.ok(at>0&&until>at);
 const make=new Function('side','oneTimesCreativeBase','pads',
   artwork.slice(at,until)+'return boards;');
 const pad=n=>String(n).padStart(6,'0');
 const boards=[...make(1,1,pad),...make(-1,1,pad),
   ...make(1,9,pad),...make(-1,9,pad)];
 assert.equal(boards.length,16);
 assert.equal(new Set(boards.map(b=>b[3])).size,16);
});
