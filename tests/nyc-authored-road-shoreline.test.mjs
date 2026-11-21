// Regression for old NYC authored road strips, which bypass the newer
// assets/nyc/nyc-street-network.js shoreline/lot clipping path.
// Run: node --test tests/nyc-authored-road-shoreline.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
function extract(name){
  const start=html.indexOf('function '+name+'(');
  assert.ok(start>=0,'missing production function '+name);
  const brace=html.indexOf('{',start);
  let depth=0;
  for(let i=brace;i<html.length;i++){
    if(html[i]==='{')depth++;
    else if(html[i]==='}'&&--depth===0)return html.slice(start,i+1);
  }
  throw Error('Unclosed production function '+name);
}
const clip=new Function(extract('clipAuthoredNycStreet')+
  ';return clipAuthoredNycStreet')();
const width=6.05;
const distanceToLine=(x,z,a,b)=>{
  const dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);
  const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(l*l)));
  return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);
};
function checkDry(fragments,terrainAt,lotAt=()=>null){
  for(const [a,b] of fragments){
    const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
    assert.ok(len>=4&&Number.isFinite(len));
    for(let i=0;i<=Math.ceil(len/.30);i++){
      const t=i/Math.ceil(len/.30),x=a[0]+dx*t,z=a[1]+dz*t;
      for(const across of [-1,-.8,-.6,-.4,-.2,0,.2,.4,.6,.8,1]){
        const sx=x-dz/len*width*across,sz=z+dx/len*width*across;
        assert.ok(terrainAt(sx,sz)>12.88,'dry sidewalk envelope');
        assert.ok(!lotAt(sx,sz),'no building below sidewalk');
      }
    }
  }
}
test('fully dry authored avenue remains continuous',()=>{
  const original=[[-60,0],[60,0]];
  assert.deepEqual(clip(...original,()=>14.6,()=>null,12.2),[original]);
});
test('half-submerged road preserves dry approach instead of spanning the harbor',()=>{
  const terrain=(x)=>x<0?7.8:14.6;
  const fragments=clip([-60,0],[60,0],terrain,()=>null,12.2);
  assert.equal(fragments.length,1);
  assert.ok(fragments[0][0][0]>0&&fragments[0][1][0]===60);
  checkDry(fragments,terrain);
});
test('narrow tidal inlet at one curb corner clips entire affected segment',()=>{
  // Road center remains dry; a 0.3-unit opening under one curb sample is wet.
  const terrain=(x,z)=>Math.abs(x-10)<.15&&Math.abs(z-3.63)<.35
    ?7.8:14.6;
  const fragments=clip([-60,0],[60,0],terrain,()=>null,12.2);
  assert.equal(fragments.length,2,'both dry approaches survive');
  assert.ok(fragments[0][1][0]<10&&fragments[1][0][0]>10);
  checkDry(fragments,terrain);
});
test('occupied building cuts road and all decorations without dropping other road segments',()=>{
  const lot=(x,z)=>Math.abs(x)<5&&Math.abs(z)<7?{x,z}:null;
  const fragments=clip([-60,0],[60,0],()=>14.6,lot,12.2);
  assert.equal(fragments.length,2);
  checkDry(fragments,()=>14.6,lot);
});
test('actual authored NYC street scene emits only dry sidewalk geometry',()=>{
  const names=['CITY_STREETS','NYC_FOCUS_ZONES','sampleTerrainHeight',
    'cityLotAt','WATER_H','STREET_Y','pushRoadStrip','lerp','nycDetailBand',
    'addRideBeam','EAST_RIVER_BRIDGE','buildBridgeDeck',
    'buildBridgeRiverfront','BROOKLYN_RAIL','makeTrafficRoute',
    'railwayPoints','railPose'];
  const roads=[],lamps=[];
  let fictionalRailRequests=0;
  const deps={
    CITY_STREETS:[[[0,0],[1,1]],[[-60,0],[60,0]]],
    NYC_FOCUS_ZONES:[[0,0,200,200]],
    sampleTerrainHeight:(x)=>x<0?7.8:14.6,
    cityLotAt:()=>null,WATER_H:12.2,STREET_Y:14.86,
    pushRoadStrip(_quad,a,b,w){if(w===11.6)roads.push([a,b]);},
    lerp:(a,b,t)=>a+(b-a)*t,nycDetailBand:()=>3,
    addRideBeam(){},
    EAST_RIVER_BRIDGE:{x:88,halfLength:30,ramp:15,z:-340},
    buildBridgeDeck(){},buildBridgeRiverfront(){},
    BROOKLYN_RAIL:{height:20,z:-280},
    makeTrafficRoute:points=>({points,total:0}),
    railwayPoints:()=>{fictionalRailRequests++;return [[0,0],[1,0]];},
    railPose:()=>({x:0,z:0,yaw:0})
  };
  const builder=new Function(...names,extract('clipAuthoredNycStreet')+
    extract('buildStreetScene')+';return buildStreetScene')(
    ...names.map(n=>deps[n]));
  builder(()=>{},(...args)=>lamps.push(args));
  assert.equal(roads.length,1,'retain the navigable dry half');
  assert.ok(roads[0][0][0]>0,'no legacy sidewalk should cover water');
  assert.ok(roads[0][1][0]===60);
  assert.ok(lamps.length>0,'bridge fixtures and decor still render');
  assert.equal(fictionalRailRequests,0,
    'disabled modern DUMBO railway must not allocate track geometry');
  assert.ok(!lamps.some(box=>box[3]===33&&box[4]===.72),
    'obsolete elevated boarding platform must not appear in the scene');
});
test('real city terrain has wet legacy streets but all exported dry fragments clear shore',()=>{
  const cityHeight=new Function('city','water','scale','hash','clamp',
    extract('cityHeight')+';return cityHeight')(
    {tilt:.24,offset:30,blockWidth:24,blockLength:33,
      parkHalfWidth:43,parkHalfLength:151,parkCenter:206,
      parkWaters:[],landmarks:[]},
    12.2,54,()=>.5,(v,a,b)=>Math.max(a,Math.min(b,v)));
  const terrain=(x,z)=>cityHeight(x,z)*54;
  const match=html.match(/const CITY_STREETS = (\[[\s\S]*?\]);/);
  assert.ok(match,'real authored routes must exist');
  const routes=new Function('return '+match[1])();
  let wetOriginal=0,generated=0;
  for(const street of routes.slice(1))for(let k=1;k<street.length;k++){
    const a=street[k-1],b=street[k],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    for(let j=0;j<=20;j++){
      const x=a[0]+(b[0]-a[0])*j/20,z=a[1]+(b[1]-a[1])*j/20;
      if(terrain(x,z)<12.88)wetOriginal++;
    }
    const fragments=clip(a,b,terrain,()=>null,12.2);
    generated+=fragments.length;
    checkDry(fragments,terrain);
  }
  assert.ok(wetOriginal>5,'regression fixture must contain a wet route');
  assert.ok(generated>25,'retain plenty of useful land routes');
});
