// node --test tests/nyc-times-seventh-traffic-signal.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('  // PATROL_NYC_TIMES_SIGNAL_V1');
const geom=html.indexOf('  // PATROL_NYC_TIMES_SIGNAL_GEOMETRY_V1',start);
const marker=html.indexOf('  function buildStreetScene(addQuad, box) {',geom);
assert.ok(start>0&&geom>start&&marker>geom,'missing production traffic pilot');
const policy=new Function(html.slice(start,geom)+
  'return {cfg:NYC_TIMES_SEVENTH,phase:timesSeventhSignalPhase,'+
  'next:timesSeventhNextGreen,distance:timesSeventhControlledDistance};')();
const {cfg,phase,next,distance}=policy;

test('live 7th Avenue signal gives pedestrians seven seconds head start',()=>{
  assert.equal(cfg.cycleSeconds,90);
  assert.equal(cfg.lpiSeconds,7);
  for(let s=0;s<7;s+=.25){
    assert.equal(phase(s).vehicle,'red');
    assert.equal(phase(s).pedestrian,'walk');
    assert.equal(phase(s).leadingPedestrian,true);
  }
  assert.equal(phase(7).vehicle,'green');
  assert.equal(phase(7).pedestrian,'walk');
  assert.equal(phase(16).pedestrian,'hand');
  assert.equal(phase(39.9).vehicle,'green');
  assert.equal(phase(40).vehicle,'amber');
  assert.equal(phase(44).vehicle,'red');
  assert.equal(phase(90).leadingPedestrian,true);
  assert.equal(phase(-83).vehicle,'green');
  assert.equal(next(5),7);
  assert.equal(next(10),10);
  assert.equal(next(40),97);
  assert.equal(next(44),97);
  assert.equal(next(90),97);
});

test('right-on-red is never permitted on modeled Manhattan junction',()=>{
  for(let t=0;t<=360;t+=.25)
    assert.equal(phase(t).rightOnRed,false);
  assert.match(html,/NO TURN ON RED/);
  assert.match(html,/ONE WAY/);
});

test('seventh avenue taxis, police and mixed cars follow the signal',()=>{
  for(const value of [
    "cityTraffic.push({kind:'taxi',oneWay:true,timesSeventh:true,route:seventh,",
    "cityTraffic.push({kind:'police',oneWay:true,timesSeventh:true,route:seventh,",
    "cityTraffic.push({kind:['sedan','suv','van'][j%3],oneWay:true,timesSeventh:true,"
  ])assert.ok(html.includes(value),'missing signal binding '+value);
  assert.match(html,/const motion=actor\.timesSeventh\?timesSeventhControlledDistance/);
  assert.ok(html.includes('const seventh=makeTrafficRoute([[12,54],[12,50]'));
  assert.ok(html.includes('stopDistance:47.8'));
});

test('car stops for red and resumes without any path-distance teleport',()=>{
  const actor={route:{total:240},pace:6,offset:cfg.stopDistance};
  assert.ok(Math.abs(distance(actor,0)-cfg.stopDistance)<1e-9);
  assert.equal(distance(actor,1),cfg.stopDistance);
  assert.equal(distance(actor,6.9),cfg.stopDistance);
  assert.equal(distance(actor,7),cfg.stopDistance);
  assert.ok(Math.abs(distance(actor,8)-(cfg.stopDistance+6))<1e-6);
  let holds=0,previous=distance(actor,0);
  for(let t=.125;t<=260;t+=.125){
    const value=distance(actor,t),delta=value-previous;
    assert.ok(Number.isFinite(value));
    assert.ok(delta>=-1e-7,'route went backwards at '+t+': '+delta);
    assert.ok(delta<=actor.pace*.125+1e-5,
      'car teleported across signal at '+t+': '+delta);
    if(delta<1e-8)holds++;
    previous=value;
  }
  assert.ok(holds>60,'expected repeated full red-light stops');
});

test('five source-exact traffic signal meshes stay finite and in one draw batch',()=>{
  const geometry=html.slice(geom,marker);
  let uploaded=0,quadCount=0;
  function createTriangleMesh(){
    const quads=[];
    return {addQuad(...args){
      for(const p of args.slice(0,4))
        assert.ok(p.length===3&&p.every(Number.isFinite),
          'non-finite signal geometry vertex');
      quads.push(args);
    },upload(){
      uploaded++;
      quadCount+=quads.length;
      return {count:quads.length*2,quadCount:quads.length};
    }};
  }
  const addModelBox=(addQuad,x,y,z,w,h,d)=>{
    assert.ok([x,y,z,w,h,d].every(Number.isFinite));
    assert.ok(w>0&&h>0&&d>0);
    addQuad([x-w/2,y-h/2,z+d/2],[x+w/2,y-h/2,z+d/2],
      [x+w/2,y+h/2,z+d/2],[x-w/2,y+h/2,z+d/2],[.8,.8,.8]);
  };
  const create=new Function('createTriangleMesh','addModelBox','STREET_Y',
    'timesSeventhSignalPhase',geometry+
    'return buildTimesSeventhSignalMeshes;')(
      createTriangleMesh,addModelBox,14.86,phase);
  const variants=create();
  assert.equal(uploaded,5,'five static phase variants, no per-frame upload');
  assert.deepEqual(Object.keys(variants),[
    'red-walk','green-walk','green-hand','amber-hand','red-hand'
  ]);
  for(const m of Object.values(variants)){
    assert.ok(m.count>0&&m.count<1000,'single traffic signal draw');
    assert.ok(m.quadCount<500,'bounded traffic signal geometry');
  }
  assert.ok(quadCount>200);
  assert.match(html,/disposeSceneMesh\(m\)/);
  assert.match(html,/drawMesh\(mesh,identity\)/);
});

test('Manhattan only and preserves low graphics and map-switch fallback',()=>{
  assert.ok(html.includes("typeof selectedMap!=='undefined' && selectedMap.city && !graphicsCompat"));
  assert.match(html,/nycTimesSignalMeshes=buildTimesSeventhSignalMeshes\(\)/);
  assert.match(html,/if\(selectedMap\.city && nycTimesSignalMeshes\)/);
  assert.match(html,/nycTimesSignalMeshes=null/);
  const dispose=html.indexOf('if(nycTimesSignalMeshes)for(const m of Object.values(nycTimesSignalMeshes))');
  const build=html.indexOf('landscapeDetails = smoothScenery() ? createLandscapeDetails() : null');
  const mapScenery=html.indexOf('createMapScenery();',build);
  assert.ok(dispose>0&&dispose<build&&build<mapScenery,
    'release previous signal meshes before rebuilding the new city landscape');
  const mapCreation=html.slice(html.indexOf('function createMapScenery() {'),build);
  assert.ok(!mapCreation.includes('nycTimesSignalMeshes=null'),
    'late map scenery initialization must not destroy live signal geometry');

  assert.match(html,/safe\(12,6\)&&safe\(12,1\)&&safe\(7\.05,6\.45\)/);
});
