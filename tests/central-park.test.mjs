import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const get=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const scene=get('assets/nyc/central-park.js');
const script=scene.replace(/^export /gm,'')+
  '\n;globalThis.__parkTest={PARK_SITES,PARK_WATERS,PARK_LAWNS,'+
  'buildCentralPark,normalizedWaterDistance,shoreRadius,isParkInterior};';
const box={};
new Script(script,{filename:'central-park.js'}).runInNewContext(box);
const park=box.__parkTest;
const cityGrid={tilt:.24,offset:30,parkCenter:206,parkHalfLength:151,
  parkHalfWidth:43};

test('Central Park landmark order follows 59th to 110th Street',()=>{
  const feature=(name)=>park.PARK_WATERS.find(x=>x.name===name);
  const pond=feature('The Pond'),lake=feature('The Lake'),
    reservoir=feature('Reservoir'),meer=feature('Harlem Meer');
  assert.ok(pond.cz<lake.cz);
  assert.ok(lake.cz<reservoir.cz);
  assert.ok(reservoir.cz<meer.cz);
  assert.equal(park.PARK_WATERS.length,6);
  assert.equal(park.PARK_LAWNS.length,4);
  const castle=park.PARK_SITES.find(x=>x.name==='Belvedere Castle');
  assert.ok(castle);
  assert.ok(park.normalizedWaterDistance(castle.u,castle.z,
    feature('Turtle Pond'))>1.25,
    'Castle must not spawn in Turtle Pond');
  assert.equal(park.isParkInterior(0,206,cityGrid),true);
  assert.equal(park.isParkInterior(0,390,cityGrid),false);
});

function build(quality){
  const count={tri:0,quad:0,box:0,beam:0,ribbon:0,invalid:0};
  const validate=(...points)=>{
    for(const p of points){
      if(!Array.isArray(p)||p.length!==3||p.some(n=>!Number.isFinite(n))||
         p[0]<-100||p[0]>220||p[2]<50||p[2]>360||
         p[1]<13||p[1]>30) count.invalid++;
    }
  };
  const at=(x,z)=>15.5+.12*Math.cos(x/30)+.13*Math.sin(z/24);
  const stats=park.buildCentralPark({
    grid:cityGrid,waterY:12.2,streetY:14.86,quality,terrainAt:at,
    addTri:(a,b,c)=>{validate(a,b,c);count.tri++;},
    addQuad:(a,b,c,d)=>{validate(a,b,c,d);count.quad++;},
    box:(x,y,z,w,h,d)=>{count.box++;
      if([x,y,z,w,h,d].some(n=>!Number.isFinite(n)))count.invalid++;},
    beam:(a,b)=>{validate(a,b);count.beam++;},
    ribbon:(a,b)=>{validate(a,b);count.ribbon++;}
  });
  return {stats,count};
}

test('low and high quality park geometry stays finite and bounded',()=>{
  const low=build('low'),high=build('high');
  for(const {stats,count} of [low,high]){
    assert.equal(count.invalid,0,'all mesh positions must be finite and on map');
    assert.equal(stats.waterBodies,6);
    assert.equal(stats.majorLandmarks,3);
    assert.ok(count.tri>6000,'water and organic crowns must be real geometry');
    assert.ok(count.ribbon>1000,'curved drives and shore trails are present');
    assert.ok(count.tri<16000,'park triangle budget must stay bounded');
  }
  assert.ok(low.stats.trees>=150&&low.stats.trees<=170);
  assert.ok(high.stats.trees>=330&&high.stats.trees<=355);
  assert.ok(high.count.tri>low.count.tri);
});

test('Manhattan hooks only: shared lake masks, cleanups and map overlays',()=>{
  const city=get('index.html'),street=get('assets/nyc/nyc-street-network.js');
  assert.match(city,/parkWaters:CENTRAL_PARK_WATERS/);
  assert.match(city,/city\.parkWaters\|\|\[\]/);
  assert.match(city,/import\('\.\/assets\/nyc\/central-park\.js'\)/);
  assert.match(city,/disposeSceneMesh\(nycParkMesh\)/);
  assert.match(city,/nycParkMesh\?\.count\)drawMesh\(nycParkMesh,identity\)/);
  assert.match(city,/heroEpoch!==nycHeroEpoch/);
  assert.doesNotMatch(city,/findScenerySite\(81,257/);
  assert.match(street,/skippedPark/);
  assert.match(street,/Math\.abs\(u\)<grid\.parkHalfWidth\+1\.7/);
  // The existing in-page NYC universe is not removed to add the park.
  assert.match(city,/assets\/cosmos\/portal\.js/);
  assert.match(city,/NYC_ORBIT_CEILING\s*=\s*180/);
});

test('Central Park module JavaScript parses without a bundler',()=>{
  assert.doesNotThrow(()=>new Script(scene.replace(/^export /gm,'')));
});

test('all park walking/driving ribbons avoid lake centers and shore overlap',()=>{
  const everyWater=(u,z)=>
    Math.min(...park.PARK_WATERS.map(f=>
      park.normalizedWaterDistance(u,z,f)));
  for(const quality of ['low','high']){
    let sampled=0,invalid=0,closestCenter=Infinity,closestEdge=Infinity;
    const stats=park.buildCentralPark({
      grid:cityGrid,quality,waterY:12.2,streetY:14.86,
      terrainAt:(x,z)=>15.5+.12*Math.cos(x/30)+.13*Math.sin(z/24),
      addTri:()=>{},addQuad:()=>{},box:()=>{},beam:()=>{},
      ribbon:(a,b,width)=>{
        const u0=a[0]-cityGrid.tilt*a[2]-cityGrid.offset;
        const u1=b[0]-cityGrid.tilt*b[2]-cityGrid.offset;
        const dz=b[2]-a[2],du=u1-u0;
        const len=Math.hypot(du,dz)||1;
        for(let k=0;k<=5;k++){
          const t=k/5,u=u0*(1-t)+u1*t,z=a[2]*(1-t)+b[2]*t;
          const centerDist=everyWater(u,z);
          closestCenter=Math.min(closestCenter,centerDist);
          if(centerDist<1.04)invalid++;
          for(const side of [-1,1]){
            const edgeU=u+side*(dz/len)*width*.5;
            const edgeZ=z-side*(du/len)*width*.5;
            const dist=everyWater(edgeU,edgeZ);
            closestEdge=Math.min(closestEdge,dist);
            if(dist<1.01)invalid++;
          }
          sampled++;
        }
      }
    });
    assert.ok(stats.reroutedPathPoints>=100,'paths must detour around the lakes');
    assert.equal(invalid,0,'no park path or road edge may enter lake water');
    assert.ok(closestCenter>1.04 && closestEdge>1.01);
    assert.ok(sampled>6000,'inspect the full park road and trail system');
    assert.ok(stats.paths<2500,'do not explode the triangle budget');
    assert.equal(stats.skippedWetPaths,0,'lake detours should remain continuous');
  }
});

test('79th and 86th game-scale transverse ribbons clear pond and Reservoir',()=>{
  assert.match(scene,/\[79,170\]/);
  assert.match(scene,/\[86,209\]/);
  for(const z of [170,209])for(let u=-41;u<=41;u+=.5){
    const d=Math.min(...park.PARK_WATERS.map(f=>
      park.normalizedWaterDistance(u,z,f)));
    assert.ok(d>1.1,'transverse z='+z+' u='+u+' overlaps water');
  }
});

test('Manhattan starts sharper, with frame-time adaptation still enabled',()=>{
 const html=get('index.html');
 assert.match(html,/return selectedMap\.city\?\(mobile\?\.67:\.84\):\(mobile\?\.59:\.73\)/);
 assert.match(html,/const sceneScaleFloor=\(\)=>smoothScenery\(\)\?cityScaleFloor\(\):startupScale/);
 assert.match(html,/resScale = Math\.max\(sceneScaleFloor\(\), resScale - 0\.10\)/);
 assert.match(html,/resScale = Math\.min\(limit, resScale \+ 0\.10\)/);
 assert.match(html,/#wrap\.smooth-city canvas\{image-rendering:auto/);
});

test('park triangles carry finite RGB material arrays accepted by real mesh uploader',()=>{
 for(const quality of ['low','high']){
  let triangleCount=0;
  const check=(color)=>{
   assert.ok(Array.isArray(color),'mesh callback requires iterable RGB');
   assert.equal(color.length,3,'mesh requires 3 color channels');
   assert.ok(color.every(Number.isFinite),'mesh color channels must be finite');
  };
  const stats=park.buildCentralPark({
   grid:cityGrid,quality,waterY:12.2,streetY:14.86,
   terrainAt:(x,z)=>15.5+.12*Math.cos(x/30)+.13*Math.sin(z/24),
   addTri:(a,b,c,rgb)=>{triangleCount++;check(rgb);},
   addQuad:(a,b,c,d,rgb)=>check(rgb),
   box:(x,y,z,w,h,d,rgb)=>check(rgb),
   beam:(a,b,w,rgb)=>check(rgb),
   ribbon:(a,b,w,rgb)=>check(rgb)
  });
  assert.ok(triangleCount>6000);
  assert.equal(stats.waterBodies,6);
 }
});
