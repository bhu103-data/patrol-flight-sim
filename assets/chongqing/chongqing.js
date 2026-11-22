// Chongqing Pilot — a self-contained PATROL map built with Three.js.
// Flight feel is informed by Petalwake (Jacob Miller, MIT), but this implementation is original.
// https://github.com/jjcm/petalwake — credits in docs/CHONGQING_HOTPOT_PILOT.md.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { buildChongqingDetails } from './details.js';
import { buildChongqingMarketFronts } from './market-fronts.js';
import { buildChongqingLandmarks } from './landmarks.js';
import { buildChongqingStreetlife } from './streetlife.js';
import { buildChongqingWetStreets } from './wetstreets.js';
import { buildChongqingRiverlife } from './riverlife.js';
import { SpatialObstacleIndex } from './spatial.js';
import { createChongqingPBR } from './pbr.js';
import { createChongqingAtmosphere } from './atmosphere.js';
import { createChongqingUrbanArchitecture } from './urban-architecture.js';
import { chongqingTerraceRoads,clipRoadToFreeSegments,sampleChongqingTerraceSurface,clipChongqingDryRoadSegments,collectChongqingShorelineRoadEnds } from './road-clearance.js';
import { loadOptionalHongyadong } from './scenario-assets.js';
import { buildChongqingShorelineBarriers } from './shoreline-barriers.js';

const canvas = document.getElementById('world');
const hint = document.getElementById('hint');
const toastEl = document.getElementById('toast');
const fill = document.getElementById('meterFill');
const meter = document.getElementById('meterStatus');
const minimap = document.getElementById('map');
const mapCtx = minimap.getContext('2d');
const clamp = THREE.MathUtils.clamp;
// Aircraft choice comes from PATROL's global left-side launcher, not this map.
const seaplaneMode=new URLSearchParams(location.search).get('aircraft')==='seaplane';
const TAU = Math.PI * 2;
const clock = new THREE.Clock();
const scene = new THREE.Scene();
scene.background = new THREE.Color('#121c2a');
scene.fog = new THREE.FogExp2(0x253345, 0.00072);

// PATROL_CQ_ADAPTIVE_LIGHTING_V5: do not allocate the MSAA color buffer
// in the battery preset; retain AA in normal/high display modes.
const startupLowGpu=new URLSearchParams(location.search).get('quality')==='low';
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,antialias:!startupLowGpu,alpha:false,
    powerPreference:'high-performance'
  });
} catch (error) {
  document.querySelector('#loading p').textContent = '无法启动 WebGL，请打开浏览器图形加速后重试。';
  throw error;
}
// Bootstrap at 1x; apply the true GPU budget after the city loads.
renderer.setPixelRatio(1);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.36;
// Single localized soft shadow pass: tuned for the active sightseeing corridor,
// not the whole 2-kilometre city. Auto/High only; battery saver turns it off.
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;

const camera = new THREE.PerspectiveCamera(68, innerWidth/innerHeight, 0.15, 4000);
const atmosphere=createChongqingAtmosphere(THREE,scene,camera);
const hemi = new THREE.HemisphereLight(0x879ec1, 0x534b48, 1.18);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0xc3d0e8, 1.03);
moon.position.set(-110,170,-135);
moon.castShadow=true;
moon.shadow.mapSize.set(1024,1024);
moon.shadow.camera.left=-145;moon.shadow.camera.right=145;
moon.shadow.camera.top=145;moon.shadow.camera.bottom=-145;
moon.shadow.camera.near=1;moon.shadow.camera.far=490;
moon.shadow.camera.updateProjectionMatrix();
moon.shadow.bias=-.00012;
moon.shadow.normalBias=.035;
moon.shadow.radius=2;
scene.add(moon,moon.target);
const localShadowOffset=new THREE.Vector3(-110,170,-135);
const glow = new THREE.PointLight(0xffbd76, 170, 235, 2);
glow.position.set(160,105,125);
scene.add(glow);

const pbr=createChongqingPBR(THREE);
function mat(color, roughness=0.85, emissive=0x000000, intensity=0) {
  return new THREE.MeshStandardMaterial({color,roughness,metalness:0.06,emissive,emissiveIntensity:intensity});
}
const M = {
  granite:pbr.cutStone, stone:pbr.stone, concrete:pbr.concrete,
  copper:mat('#946046',0.46), gold:mat('#ffc47a',0.35,0xcc7234,0.42),
  glass:pbr.glass, beam:mat('#654941',.75),
  roof:pbr.roof, red:mat('#ae2932',0.43,0x651318,0.28),
  road:pbr.asphalt, rail:new THREE.MeshStandardMaterial({color:0xa5adb4,roughness:.37,metalness:.42,side:THREE.DoubleSide}),
  window:pbr.glassPane,
  white:new THREE.MeshBasicMaterial({color:0xffd998}),
  dark:mat('#22263b'), skin:mat('#e1a97e'), coat:mat('#e4c18b'),
  scarf:mat('#c13c32'), pants:mat('#433a47'), boot:mat('#2e292c'),
  tree:mat('#314d4d'), trunk:mat('#4d3e34'),
  water:new THREE.MeshBasicMaterial({color:0x255675})
};
const sharedBoxGeometry = new THREE.BoxGeometry(1,1,1);
function box(x,y,z,w,h,d,material,parent=scene) {
  // Share a single GPU cube rather than allocating hundreds of identical vertex buffers.
  const mesh = new THREE.Mesh(sharedBoxGeometry, material);
  mesh.position.set(x,y,z);mesh.scale.set(w,h,d);parent.add(mesh);return mesh;
}
function ball(x,y,z,r,material,parent=scene){
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(r,10,7),material);
  mesh.position.set(x,y,z);parent.add(mesh);return mesh;
}
function cylinderBetween(a,b,r,material,segments=7){
  const axis = new THREE.Vector3().subVectors(b,a);
  const obj = new THREE.Mesh(new THREE.CylinderGeometry(r,r,axis.length(),segments),material);
  obj.position.copy(a).add(b).multiplyScalar(0.5);
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis.normalize());
  scene.add(obj);return obj;
}
function random(seed) {
  let s=seed>>>0;
  return () => {s=(1664525*s+1013904223)>>>0;return s/4294967296;};
}
const rand=random(20261120);
const riverCenter=x=>14*Math.sin(x/130)+29*Math.sin(x/340);
function branchCenter(z){return -390+18*Math.sin(z/175);}
function riverDist(x,z){
  const main=Math.abs(z-riverCenter(x))-78;
  const branch=z<18&&z>-620?Math.abs(x-branchCenter(z))-47:Infinity;
  return Math.min(main,branch);
}
function ground(x,z) {
  const d=riverDist(x,z);
  if(d<0) return -13;
  // Rounded ledges form a stepped mountain city without abrupt discontinuous ground jumps.
  const tier=d/72,tierFrac=tier-Math.floor(tier);
  const sm=tierFrac*tierFrac*(3-2*tierFrac);
  const terraces=(Math.floor(tier)+sm)*2.1;
  const relief=3.4*Math.sin(x/105)*Math.cos(z/150)+2.2*Math.sin(x/39+z/57);
  // Hongyadong is inserted into a steep hillside, not an isolated free-standing
  // 11-storey tower. Local sculpted cliff connects its upper road to street level.
  // This footprint stays compact so the hotpot start and other maps remain unchanged.
  const cliffX=Math.exp(-Math.pow((x-153)/115,4));
  const cliffT=clamp((z-185)/120,0,1);
  const cliffRamp=cliffT*cliffT*(3-2*cliffT);
  const hillside=cliffX*cliffRamp*86;
  return Math.max(8, 9+d*0.172+terraces+relief+hillside);
}

const worldGeometry=new THREE.BufferGeometry();
const positions=[],colors=[],indexes=[],uvs=[];
const color=new THREE.Color();
const gx=208,gz=148;
for(let iz=0;iz<=gz;iz++){
  const z=-690+1380*iz/gz;
  for(let ix=0;ix<=gx;ix++){
    const x=-990+1980*ix/gx, y=ground(x,z);
    positions.push(x,y,z);
    uvs.push(x/48,z/48);
    const n=clamp((y-9)/145,0,1);
    color.setHSL(0.25-0.12*n,0.13+0.06*n,0.28+0.1*(1-n));
    if(y<0)color.setRGB(0.09,0.22,0.26);
    colors.push(color.r,color.g,color.b);
  }
}
for(let z=0;z<gz;z++)for(let x=0;x<gx;x++){
  const i=z*(gx+1)+x;
  indexes.push(i,i+gx+1,i+1,i+1,i+gx+1,i+gx+2);
}
worldGeometry.setIndex(indexes);
worldGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
worldGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
worldGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
worldGeometry.computeVertexNormals();
const groundMaterial=pbr.hillside.clone();groundMaterial.vertexColors=true;groundMaterial.side=THREE.DoubleSide;
const terrainMesh=new THREE.Mesh(worldGeometry,groundMaterial);
terrainMesh.receiveShadow=true;
scene.add(terrainMesh);

const waterUniforms={uTime:{value:0},uDaylight:{value:.38}};
const waterMaterial=new THREE.ShaderMaterial({
  uniforms:waterUniforms,depthWrite:true,side:THREE.DoubleSide,
  vertexShader:[
    'uniform float uTime; varying vec3 vWorld; varying vec3 vNormalW;',
    'void main(){ vec3 p=position; p.y+=0.25*sin(p.x*.065+uTime*1.1)+0.17*cos(p.z*.13-uTime*.9);',
    'vec4 world=modelMatrix*vec4(p,1.);vWorld=world.xyz;vNormalW=vec3(0.,1.,0.);gl_Position=projectionMatrix*viewMatrix*world; }'
  ].join('\n'),
  fragmentShader:[
    'uniform float uTime;uniform float uDaylight; varying vec3 vWorld;varying vec3 vNormalW;',
    'void main(){vec3 n=normalize(vNormalW+vec3(.075*sin(vWorld.x*.095+uTime),0.,.065*cos(vWorld.z*.13-uTime)));',
    'float fresnel=pow(1.-max(dot(n,normalize(cameraPosition-vWorld)),0.),3.0);',
    'float wave=sin(vWorld.x*.17+uTime*2.)*cos(vWorld.z*.11-uTime)*.5+.5;',
    'vec3 deep=mix(vec3(.013,.06,.088),vec3(.063,.19,.22),uDaylight);',
    'vec3 reflection=mix(vec3(.14,.22,.28),vec3(.35,.47,.54),uDaylight);',
    'vec3 rgb=mix(deep,reflection,clamp(.13+fresnel*.83+wave*.08,0.,1.));',
    '// Moving ribbons approximate warm reflections from landmark windows and bridge.',
    'float nearHong=exp(-pow((vWorld.x-155.)/110.,2.))*exp(-pow((vWorld.z-20.)/160.,2.));',
    'float nearBridge=exp(-pow((vWorld.x-40.)/65.,2.))*exp(-pow((vWorld.z+8.)/170.,2.));',
    'float ripple=.34+.66*pow(max(0.,sin(vWorld.x*.19+vWorld.z*.06+uTime*1.4)*sin(vWorld.z*.10-uTime*.76)),2.);',
    'rgb+=vec3(1.0,.40,.10)*nearHong*ripple*.29;',
    'rgb+=vec3(.8,.16,.09)*nearBridge*(.25+.75*ripple)*.24;',
    'rgb+=vec3(.03,.03,.04)*pow(wave,7.);gl_FragColor=vec4(rgb,1.);}'
  ].join('\n')
});
function riverStrip(main=true){
  const verts=[],inds=[],count=160;
  for(let i=0;i<=count;i++){
    const u=i/count;
    let x,z,span;
    if(main){x=-990+1980*u;z=riverCenter(x);span=76;}
    else{z=-630+660*u;x=branchCenter(z);span=45;}
    if(main) verts.push(x,-2.4,z-span,x,-2.4,z+span);
    else verts.push(x-span,-2.5,z,x+span,-2.5,z);
    if(i<count){const j=i*2;inds.push(j,j+1,j+2,j+1,j+3,j+2);}
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  geometry.setIndex(inds);geometry.computeVertexNormals();
  scene.add(new THREE.Mesh(geometry,waterMaterial));
}
riverStrip();riverStrip(false);
// PATROL_CQ_CINEMATIC_V2: One shared ACES tone map and graded atmosphere,
// matching the visual language of PATROL's NYC rather than a separate arcade UI.
// The map still uses its own Three.js scene, so renderer parity is visual,
// not a claim of engine or flight-control identity.
const cqTimeSelect=document.getElementById('cqTime');
const cqTimeOptions=['day','dusk','night'];
const entryTime=new URLSearchParams(location.search).get('time');
cqTimeSelect.value=cqTimeOptions.includes(entryTime)?entryTime:'dusk';
function applyCinematicEnvironment(preset){
  const table={
    day:{light:1,fog:'#72818d',density:.00047,
      sky:'#b5c6d2',ambient:1.92,main:1.66,exposure:1.20,
      glow:50,sun:'#f9ebd2',shadow:[-85,210,-105]},
    dusk:{light:.38,fog:'#394452',density:.00061,
      sky:'#435264',ambient:1.47,main:1.28,exposure:1.31,
      glow:150,sun:'#efc3a3',shadow:[-110,170,-135]},
    night:{light:0,fog:'#202b3a',density:.00073,
      sky:'#152235',ambient:1.10,main:1.04,exposure:1.37,
      glow:210,sun:'#c3d0e8',shadow:[-110,170,-135]}
  };
  const p=table[preset]||table.dusk;
  atmosphere.setDaylight(p.light);
  waterUniforms.uDaylight.value=p.light;
  scene.background.set(p.sky);
  scene.fog.color.set(p.fog);scene.fog.density=p.density;
  hemi.intensity=p.ambient;
  moon.intensity=p.main;moon.color.set(p.sun);
  localShadowOffset.set(...p.shadow);
  glow.intensity=p.glow;
  renderer.toneMappingExposure=p.exposure;
}
applyCinematicEnvironment(cqTimeSelect.value);
cqTimeSelect.addEventListener('change',()=>applyCinematicEnvironment(cqTimeSelect.value));



// PATROL_CQ_CINEMATIC_V2: five profile/extrusion families replace the one
// repeated concrete box tower. Shared meshes retain low GPU draw-call cost.
// Modern Chongqing facade atlases have balcony/AC/window rhythms and realistic
// rooftop setbacks; original landmark footprints and collisions stay intact.
const dummy=new THREE.Object3D(),obstacles=[];
const plannedRoads=chongqingTerraceRoads(riverCenter);
// Buildings and the visible asphalt must use one identical street plan.
const skyline=createChongqingUrbanArchitecture({
  THREE,scene,ground,riverDist,riverCenter,rand,obstacles,pbr,plannedRoads
});
skyline.setTimeOfDay(cqTimeSelect.value);

// Roads are swept strips following terraces, not an infinite grid.
function road(points,width,material=M.road){
  const verts=[],ind=[],roadUV=[];
  let accumulated=0;
  for(let i=0;i<points.length;i++){
    const p=points[i],prev=points[Math.max(0,i-1)],next=points[Math.min(points.length-1,i+1)];
    const dx=next.x-prev.x,dz=next.z-prev.z,inv=1/(Math.hypot(dx,dz)||1);
    const ax=-dz*inv*width/2,az=dx*inv*width/2;
    if(i>0)accumulated+=Math.hypot(p.x-prev.x,p.z-prev.z);
    verts.push(p.x-ax,p.y,p.z-az,p.x+ax,p.y,p.z+az);
    roadUV.push(0,accumulated/8,width/8,accumulated/8);
    if(i<points.length-1){const j=i*2;ind.push(j,j+1,j+2,j+1,j+3,j+2);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(roadUV,2));
  g.setIndex(ind);g.computeVertexNormals();
  const o=new THREE.Mesh(g,material);
  o.receiveShadow=true;
  scene.add(o);return o;
}
// Actual street strips are emitted AFTER all landmark and shop footprints are
// registered, so their surface can be clipped around every physical building.
function bridge(x,style=0){
  const y=59+style*13;
  box(x,y,-1,17,2.4,335,M.road);
  box(x-9,y+1.2,-1,1,1,335,M.rail);box(x+9,y+1.2,-1,1,1,335,M.rail);
  // Qiansimen's real single-pylon cable system and red deck truss are detailed in details.js.
  if(style!==0)for(const z of [-83,83]){
    const top=y+52;
    for(const ox of [-10,10])box(x+ox,(top+y-13)/2,z,4,top-y+13,4,M.stone);
    box(x,top,z,27,2.8,5,M.stone);
    for(let n=0;n<8;n++){
      const dest=z+(n+1)*(z<0?1:-1)*15.5;
      cylinderBetween(new THREE.Vector3(x,top,z),new THREE.Vector3(x,y+3,dest),.42,M.rail,5);
    }
  }
  for(let i=-9;i<=9;i++){
    const z=i*16.5;
    const lane=box(x-3,y+2.15,z,2.2,.10,6,M.gold);
    lane.material=M.gold;
  }
}
bridge(40,0);bridge(470,1);

// Hongyadong's facade, eleven floors and roof cores are batched in details.js.
// The old per-window meshes were removed to avoid duplicate geometry and z-fighting.

function sign(text,x,y,z,w=44,h=11,ink='#ffe3a4',bg='#58202a'){
  const c=document.createElement('canvas');c.width=512;c.height=128;
  const ctx=c.getContext('2d');
  ctx.fillStyle=bg;ctx.fillRect(0,0,512,128);
  ctx.lineWidth=8;ctx.strokeStyle='#efae65';ctx.strokeRect(5,5,502,118);
  ctx.font='bold 66px "Microsoft YaHei",system-ui,sans-serif';
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=ink;
  ctx.fillText(text,256,66,472);
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=2;
  const plane=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));
  plane.position.set(x,y,z);scene.add(plane);return plane;
}
const originalHongyadongSign=sign('洪崖洞',155,133,177,48,13);
// Bridge and civic monument are identified in the HUD/map, not by floating billboards.

const hotpot={x:285,z:225};
const shopY=ground(hotpot.x,hotpot.z+28);
// The entrance follows the graded upper street; rear foundation piers retain the lower slope.
const hotpotDoor={x:hotpot.x,z:hotpot.z+34,y:shopY+2.7};
// Photo-grained dark wooden facade, not a plain terracotta cube.
box(hotpot.x,shopY+10,hotpot.z,72,20,50,pbr.wood);
// A physically curved dark-tile roof replaces the floating, flat 80x3x57 slab.
// Its top remains at/below the original collision top (shopY+23.3).
{
  const verts=[],uvs=[],indices=[],cols=8,rows=12;
  for(let rz=0;rz<=rows;rz++){
    const f=rz/rows,ez=Math.abs(f*2-1);
    for(let cx=0;cx<=cols;cx++){
      const u=cx/cols,edge=Math.abs(u*2-1);
      const lift=2.12*(1-Math.pow(ez,1.5))+.28*Math.pow(edge,6)*Math.pow(ez,6);
      verts.push((u-.5)*80,lift,(f-.5)*57.5);
      uvs.push(u*3.2,f*2.4);
    }
  }
  for(let rz=0;rz<rows;rz++)for(let cx=0;cx<cols;cx++){
    const a=rz*(cols+1)+cx,b=a+1,c=a+cols+1,d=c+1;
    indices.push(a,c,b,b,c,d);
  }
  const geo=new THREE.BufferGeometry();
  geo.setIndex(indices);
  geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geo.computeVertexNormals();
  const roofMat=pbr.roof.clone();
  roofMat.side=THREE.DoubleSide;
  roofMat.roughness=.88;
  roofMat.metalness=.02;
  const roof=new THREE.Mesh(geo,roofMat);
  roof.position.set(hotpot.x,shopY+20.65,hotpot.z);
  roof.castShadow=true;roof.receiveShadow=true;scene.add(roof);
  for(const side of [-1,1]){
    box(hotpot.x,shopY+20.5,hotpot.z+side*28.9,81,.3,.35,pbr.carvedWood);
  }
}
box(hotpot.x,shopY+10.3,hotpot.z+25.35,68,13,1.4,pbr.wood);
// River-facing shopfront used to be one solid wooden wall, visible as a
// cartoon cube from the bridge. Recess true window bays, sills and posts.
const potWarmGlass=new THREE.MeshStandardMaterial({
  color:0x705f4a,emissive:0x91623d,emissiveIntensity:.35,
  metalness:.12,roughness:.36,side:THREE.DoubleSide
});
for(let bay=0;bay<7;bay++){
  const xx=hotpot.x-30+bay*10;
  const riverFront=hotpot.z-25.18;
  const glass=(bay*5+3)%7<3?potWarmGlass:pbr.glassPane;
  box(xx,shopY+10.5,riverFront,8.2,6.5,.28,glass);
  box(xx,shopY+6.95,riverFront-.25,8.6,.23,.48,pbr.carvedWood);
  box(xx,shopY+14.05,riverFront-.22,8.7,.28,.45,pbr.carvedWood);
  box(xx,shopY+10.5,riverFront-.31,.19,6.5,.32,pbr.wood);
}
for(const x of [hotpot.x-31,hotpot.x-10,hotpot.x+11,hotpot.x+31]){
  const z=hotpot.z-21.5,earth=ground(x,z);
  if(earth<shopY-1.3){
    // Stone stilt foundations stop the restaurant from floating above a slope.
    const h=shopY-earth+.8;
    box(x,earth+h*.5,z,2.7,h,3.2,pbr.cutStone);
  }
}
sign('重庆老火锅',hotpot.x,shopY+22.9,hotpot.z+29.1,42,7.5,'#dbbb8f','#302822');
const cauldron=box(278,shopY+4.5,hotpot.z+31,10,5,10,M.dark);
ball(278,shopY+7.2,hotpot.z+31,5,M.red);
const potLight=new THREE.PointLight(0xff693c,85,90,2);
potLight.position.set(hotpot.x,shopY+13,hotpot.z+34);scene.add(potLight);

// Monument and rail crossing a tower-lined district.
const jiefang={x:-135,z:335},jy=ground(jiefang.x,jiefang.z);
box(jiefang.x,jy+7,jiefang.z,20,14,20,M.stone);
box(jiefang.x,jy+34,jiefang.z,12,40,12,M.stone);
box(jiefang.x,jy+55,jiefang.z,15,3,15,M.stone);
// Monument stepped masonry, waist cornice and clock faces, rather than a blank cuboid.
box(jiefang.x,jy+1,jiefang.z,31,2,31,M.stone);
box(jiefang.x,jy+3,jiefang.z,27,2,27,M.granite);
box(jiefang.x,jy+15,jiefang.z,22,1.4,22,M.stone);
box(jiefang.x,jy+48,jiefang.z,16,1.6,16,M.stone);
for(let side=0;side<4;side++){
  const angle=side*Math.PI/2;
  const face=new THREE.Mesh(new THREE.CircleGeometry(3.15,32),
    new THREE.MeshStandardMaterial({color:0xf1e8cf,roughness:.6,metalness:.02,side:THREE.DoubleSide}));
  face.position.set(jiefang.x+Math.sin(angle)*6.2,jy+41,jiefang.z+Math.cos(angle)*6.2);
  face.rotation.y=angle;scene.add(face);
  for(let tick=0;tick<12;tick++){
    const theta=tick*Math.PI/6;
    const mark=box(face.position.x+Math.cos(angle)*Math.sin(theta)*2.53,
      jy+41+Math.cos(theta)*2.53,
      face.position.z-Math.sin(angle)*Math.sin(theta)*2.53,
      .17,.42,.08,M.copper);
    mark.rotation.y=angle;
  }
  const shortHand=box(face.position.x,jy+41.75,face.position.z+.035,.16,1.75,.15,M.dark);
  shortHand.rotation.y=angle;
}

// Liziba Line 2 uses a straddle-type concrete monorail guidebeam, not a wide road slab.
const railPoints=[];
for(let i=0;i<=65;i++){
  const x=-850+i*27,z=-235+35*Math.sin(x/210);
  const surface=ground(x,z);
  const railY=surface+28;
  railPoints.push(new THREE.Vector3(x,railY,z));
  if(i%5===0){
    const pier=new THREE.Mesh(new THREE.CylinderGeometry(1.35,2.4,27.1,9),M.concrete);
    pier.position.set(x,surface+13.55,z);scene.add(pier);
    box(x,railY-1.9,z,6.5,.9,5.2,M.stone);
  }
}
const monorailBeam=new THREE.InstancedMesh(sharedBoxGeometry,M.concrete,65);
for(let i=0;i<65;i++){
  const a=railPoints[i],b=railPoints[i+1];
  const dx=b.x-a.x,dz=b.z-a.z,dy=b.y-a.y;
  dummy.position.set((a.x+b.x)*.5,(a.y+b.y)*.5-.45,(a.z+b.z)*.5);
  dummy.rotation.set(0,-Math.atan2(dz,dx),Math.atan2(dy,Math.hypot(dx,dz)));
  dummy.scale.set(Math.hypot(dx,dz)+.3,1.55,2.65);
  dummy.updateMatrix();monorailBeam.setMatrixAt(i,dummy.matrix);
}
monorailBeam.count=65;
monorailBeam.instanceMatrix.needsUpdate=true;
monorailBeam.computeBoundingSphere();scene.add(monorailBeam);
// The actual animated 3-car Line 2 monorail and walk-through Liziba station are in landmarks.js.
// Cable car, a characteristic river crossing.
const cableA=new THREE.Vector3(-510,130,240),cableB=new THREE.Vector3(-365,121,-240);
cylinderBetween(cableA,cableB,.35,M.dark,5);
for(let i=1;i<=3;i++){
  const p=cableA.clone().lerp(cableB,i/4);
  box(p.x,p.y-10,p.z,13,11,10,M.red);
  box(p.x,p.y-9,p.z+5.1,10,5,.4,M.glass);
  cylinderBetween(p,new THREE.Vector3(p.x,p.y-4,p.z),.4,M.rail);
}

// Dynamic river sightseeing ships are built and advanced by riverlife.js.
// Irregular subtropical street trees. No repeated conical/cartoony canopy.
// Shared instanced branches, bark, and three differently shaped foliage crowns.
const treeLeafMaterial=new THREE.MeshStandardMaterial({
  color:0x75927b,roughness:.98,metalness:0,side:THREE.FrontSide
});
const treeBarkMaterial=new THREE.MeshStandardMaterial({
  color:0x68594e,roughness:.97,metalness:0
});
const treeGeo=new THREE.IcosahedronGeometry(1,2);
const trunkGeo=new THREE.CylinderGeometry(.19,.28,1,8);
const branchGeo=new THREE.CylinderGeometry(.10,.15,1,7);
const trees=new THREE.InstancedMesh(treeGeo,treeLeafMaterial,1140);
const stems=new THREE.InstancedMesh(trunkGeo,treeBarkMaterial,380);
const branches=new THREE.InstancedMesh(branchGeo,treeBarkMaterial,760);
trees.instanceMatrix.setUsage(THREE.StaticDrawUsage);
stems.instanceMatrix.setUsage(THREE.StaticDrawUsage);
branches.instanceMatrix.setUsage(THREE.StaticDrawUsage);
let treeCount=0,leafCount=0,branchCount=0;
const upTree=new THREE.Vector3(0,1,0);
const treeFrom=new THREE.Vector3(),treeTo=new THREE.Vector3(),branchDir=new THREE.Vector3();
const leafTone=new THREE.Color();
for(let i=0;i<380;i++){
  const x=(rand()-.5)*1880,z=(rand()-.5)*1240;
  if(riverDist(x,z)<18)continue;
  let roadside=false;
  for(const side of [-1,1])for(let l=0;l<3;l++){
    const zRoad=riverCenter(x)+side*(145+l*105+14*Math.sin(x/115+l));
    if(Math.abs(z-zRoad)<12.5)roadside=true;
  }
  if(roadside)continue;
  if(obstacles.some(o=>Math.abs(o.x-x)<o.w*.5+6&&Math.abs(o.z-z)<o.d*.5+6))continue;
  if(Math.hypot(x-160,z-145)<145||Math.hypot(x-285,z-225)<70)continue;
  if(Math.abs(x+355)<194&&Math.abs(z-176)<93)continue;
  if(Math.abs(x+121)<55&&Math.abs(z+254)<46)continue;
  const y=ground(x,z),h=4.7+rand()*4.8,spread=3.7+rand()*2.5;
  const trunkScale=.64+rand()*.42;
  dummy.rotation.set(0,0,0);
  dummy.position.set(x,y+h*.52,z);
  dummy.scale.set(trunkScale,h*1.06,trunkScale);
  dummy.updateMatrix();stems.setMatrixAt(treeCount++,dummy.matrix);
  for(let j=0;j<3;j++){
    const angle=(j/3)*TAU+rand()*.9;
    const dx=Math.cos(angle)*spread*.46,dz=Math.sin(angle)*spread*.42;
    const dy=h+(j===0?1.6:j===1?2.7:1.1);
    dummy.position.set(x+dx,y+dy,z+dz);
    dummy.rotation.set(rand()*.17,rand()*TAU,rand()*.12);
    const rr=spread*(j===1?1.11:.83);
    dummy.scale.set(rr,rr*(.72+rand()*.27),rr*(.89+rand()*.11));
    dummy.updateMatrix();
    trees.setMatrixAt(leafCount,dummy.matrix);
    leafTone.setHSL(.322+rand()*.055,.13+rand()*.11,.22+rand()*.08);
    trees.setColorAt(leafCount,leafTone);
    leafCount++;
    if(j>0){
      treeFrom.set(x,y+h*.72,z);
      treeTo.set(x+dx,y+dy-.7,z+dz);
      branchDir.subVectors(treeTo,treeFrom);
      dummy.position.copy(treeFrom).add(treeTo).multiplyScalar(.5);
      dummy.quaternion.setFromUnitVectors(upTree,branchDir.clone().normalize());
      dummy.scale.set(.22,branchDir.length(),.22);
      dummy.updateMatrix();branches.setMatrixAt(branchCount++,dummy.matrix);
    }
  }
}
trees.count=leafCount;stems.count=treeCount;branches.count=branchCount;
for(const vegetation of [trees,stems,branches]){
  vegetation.instanceMatrix.needsUpdate=true;
  if(vegetation.count>0)vegetation.computeBoundingSphere();
  vegetation.frustumCulled=true;
}
if(trees.instanceColor)trees.instanceColor.needsUpdate=true;
scene.add(trees,stems,branches);

// Detailed foreground is isolated in one lightweight, heavily instanced module.
// Only the hero corridor receives close-up geometry; long-distance buildings remain simple.
const detailBuild = buildChongqingDetails({ THREE,scene,ground,riverCenter,rand,box,ball,sign,hotpot,obstacles,pbr });
// Separate bounded street-market sample, clear of PR #93's corner shop.
// Include the suspended gallery slab/posts in the SAME spatial index used
// by pilot, roads and vehicle traffic before that index is constructed.
const marketFronts=buildChongqingMarketFronts({THREE,scene,ground,riverDist,obstacles,pbr});
// Place the two high-fidelity landmarks before the spatial collision index is built.
const landmarkBuild = buildChongqingLandmarks({ THREE,scene,ground,pbr,box,sign,obstacles });
// Static building/landmark collision registration is now complete. Build one
// spatial index reused by the player AND every moving/ornamental street probe.
const obstacleIndex=new SpatialObstacleIndex(obstacles);
// The same occupied volumes control road clipping, decorations and actual cars.
// Check road elevation so intentionally elevated structures remain passable below.
function streetSpaceClear(x,z,y,radius=0){
  if(![x,z,y,radius].every(Number.isFinite))return false;
  // Spatial hash avoids scanning hundreds of towers several times per
  // vehicle, streetlight and wet-road decal on every animation frame.
  // A clear building lookup alone does not mean drivable asphalt: the
  // north-side terrace roads cross a tributary without authored bridges.
  // Keep cars, road paint and lamp bases on dry shoreline clearances.
  if(ground(x,z)<=0||riverDist(x,z)<Math.max(3,radius+2.4))return false;
  return !obstacleIndex.eachNear(x,z,Math.max(0,radius),o=>
    Math.abs(x-o.x)<o.w*.5+radius &&
    Math.abs(z-o.z)<o.d*.5+radius &&
    y+2.2>=(o.base??-Infinity)&&y-1.6<=(o.top??Infinity)
  );
}
const streetBuild = buildChongqingStreetlife({ THREE,scene,ground,riverCenter,isRoadClear:streetSpaceClear });
const wetStreetBuild = buildChongqingWetStreets({ THREE,scene,ground,riverCenter,isRoadClear:streetSpaceClear });
// Match electrical street lighting to the independently selected city environment.
streetBuild.setTimeOfDay(cqTimeSelect.value);
wetStreetBuild.setTimeOfDay(cqTimeSelect.value);
cqTimeSelect.addEventListener('change',()=>{
  streetBuild.setTimeOfDay(cqTimeSelect.value);
  wetStreetBuild.setTimeOfDay(cqTimeSelect.value);
  skyline.setTimeOfDay(cqTimeSelect.value);
});
const riverBuild = buildChongqingRiverlife({ THREE,scene,riverCenter });
// Each generated road is clipped against the FULL building footprint (plus a
// sidewalk margin), instead of visually running underneath a tower.
const roadClearanceStats={paths:0,clipped:0,removedLength:0};
const shorelineRoadEnds=[];
for(const plan of plannedRoads){
  // Follow the same analytical bends as street traffic, sampling terrain at
  // <=5.5-unit intervals before clipping against building volumes.
  const points=sampleChongqingTerraceSurface(plan,ground,riverCenter);
  // Tributary cuts come FIRST; only dry road sections may reach the
  // building-volume clipper, never the river surface or unsupported banks.
  const dryRoads=clipChongqingDryRoadSegments(points,plan.width,ground,riverDist);
  // Building/skybridge clipping must happen BEFORE selecting the riverbank
  // safety guard sites. Otherwise a guard can survive inside a building even
  // when the road section it was supposed to protect no longer exists.
  const finalDryRoads=[];
  for(const dry of dryRoads){
    const clear=clipRoadToFreeSegments(dry,plan.width,obstacles,.8,2.5);
    const finalPaths=clear.paths.filter(path=>path.length>=2);
    finalDryRoads.push(finalPaths);
    for(const path of finalPaths){
      road(path,plan.width);roadClearanceStats.paths++;
    }
    roadClearanceStats.clipped+=clear.stats.clippedSegments;
    roadClearanceStats.removedLength+=clear.stats.removedLength;
  }
  // Only end guards belonging to surviving road fragments get geometry.
  shorelineRoadEnds.push(...collectChongqingShorelineRoadEnds(
    dryRoads,finalDryRoads,plan.width));
}
const shorelineSafety=buildChongqingShorelineBarriers({
  THREE,scene,ground,ends:shorelineRoadEnds
});
// The shared obstacle index was built after all static structures above.
// A vetted Blender GLB can replace only Hongyadong's facade instance ranges.
// The old collision boxes and all other scenic geometry remain intact.
const previewScenario=new URLSearchParams(location.search).get('scenario')==='hongyadong';
const originalRequested=new URLSearchParams(location.search).get('scenario')==='original';
const blenderToggle=document.getElementById('cqBlenderToggle');
if(blenderToggle){
  blenderToggle.textContent='检查写实建筑…';
  blenderToggle.disabled=true;
  blenderToggle.addEventListener('click',()=>{
    // Preserve all other query parameters during explicit facade-only rollback.
    const next=new URL(location.href);
    const active=document.documentElement.dataset.scenarioHongyadong==='ready';
    if(active)next.searchParams.set('scenario','original');
    else if(originalRequested)next.searchParams.delete('scenario');
    else next.searchParams.set('scenario','hongyadong');
    location.assign(next.href);
  });
}
void loadOptionalHongyadong({THREE,scene,detailBuild,search:location.search})
  .then(replacement=>{
    document.documentElement.dataset.scenarioHongyadong=replacement.active?'ready':'off';
    if(blenderToggle){
      blenderToggle.disabled=false;
      blenderToggle.textContent=replacement.active?'查看原始建筑':'切换 Blender 写实';
      blenderToggle.setAttribute('aria-pressed',String(replacement.active));
    }
    if(replacement.active){
      // A flat floating canvas billboard conflicts with the physical Bayu roofline.
      // It belongs to the procedural landmark only, not the vetted GLB preview.
      originalHongyadongSign.visible=false;
      console.info('PATROL Scenario Hongyadong loaded',replacement.audit,replacement.bounds);
      if(previewScenario)message('已加载 Blender 洪崖洞模型预览；保持原有碰撞',4);
    }
  })
  .catch(error=>{
    document.documentElement.dataset.scenarioHongyadong='fallback';
    if(blenderToggle){
      blenderToggle.textContent='写实模型加载失败';
      blenderToggle.setAttribute('aria-pressed','false');
      blenderToggle.disabled=true;
    }
    originalHongyadongSign.visible=true;
    console.warn('Scenario Hongyadong unavailable; preserving original scene:',error);
    if(previewScenario)message('Blender 模型不可用，已保留原本洪崖洞场景',4);
  });
// Raffles shopping podium is an obstacle, in addition to its individual towers.


// Player-selectable quality, with conservative automatic resolution scaling.
const qualityBtn=document.getElementById('qualityBtn');
const perfHud=document.getElementById('perfHud');
const qualityLabels={auto:'画质：自动',high:'画质：高清',low:'画质：省电'};
const qualityParam=new URLSearchParams(location.search).get('quality');
let qualityMode=Object.hasOwn(qualityLabels,qualityParam)?qualityParam:'auto';
const coarsePointer=matchMedia('(pointer:coarse)').matches;
const maxRatio=Math.min(devicePixelRatio||1,coarsePointer?1.25:1.6);
const budgetRatio=Math.min(maxRatio,Math.sqrt((coarsePointer?1600000:3600000)/(innerWidth*innerHeight)));
const minRatio=Math.min(budgetRatio,.75);
let renderRatio=qualityMode==='low'?minRatio:qualityMode==='high'?maxRatio:budgetRatio;
let measuredFPS=0,sampleTime=0,sampleFrames=0,autoCycles=0;
function applyQuality(){
  renderer.setPixelRatio(renderRatio);
  const low=qualityMode==='low';
  renderer.shadowMap.enabled=!low;
  moon.castShadow=!low;
  trees.castShadow=qualityMode==='high';
  detailBuild.setQuality(low?'low':'normal');
  marketFronts.setQuality(low?'low':'normal');
  skyline.setQuality(low?'low':'normal');
  landmarkBuild.setQuality(qualityMode==='low'?'low':'normal');
  streetBuild.setQuality(qualityMode==='low'?'low':'normal');
  wetStreetBuild.setQuality(qualityMode==='low'?'low':'normal');
  riverBuild.setQuality(qualityMode==='low'?'low':'normal');
  qualityBtn.textContent=qualityLabels[qualityMode];
  qualityBtn.title='自动平衡帧率与清晰度；按 P 查看性能数据';
}
qualityBtn.addEventListener('click',()=>{
  qualityMode=qualityMode==='auto'?'high':qualityMode==='high'?'low':'auto';
  renderRatio=qualityMode==='low'?minRatio:qualityMode==='high'?maxRatio:budgetRatio;
  applyQuality();
});
applyQuality();

// Stars are sparse to keep the city's orange glow dominant.
const stars=[];
for(let i=0;i<52;i++){
  const r=1400+rand()*1000,a=rand()*TAU,el=rand()*1.25+.2;
  stars.push(Math.cos(a)*Math.cos(el)*r,Math.sin(el)*r,Math.sin(a)*Math.cos(el)*r);
}
const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.Float32BufferAttribute(stars,3));
scene.add(new THREE.Points(starGeo,new THREE.PointsMaterial({color:0x8fa5b4,size:1.2,sizeAttenuation:false,transparent:true,opacity:.4})));

// Slim adult proportions, a close-fitting flight helmet and restrained flight-suit PBR.
// Authored from local geometry (not a third-party character scan); keep the old
// rig pivots and collision dimensions so movement/hotpot flight remain unchanged.
const avatar=new THREE.Group();scene.add(avatar);
const pilotMetal=new THREE.MeshStandardMaterial({color:0x8c979e,metalness:.82,roughness:.29});
const pilotLens=new THREE.MeshPhysicalMaterial({color:0x5e99b2,metalness:.55,roughness:.15,clearcoat:.75,clearcoatRoughness:.12,emissive:0x15394a,emissiveIntensity:.25});
const pilotDark=new THREE.MeshStandardMaterial({color:0x23282e,roughness:.73,metalness:.16});
const pilotJacket=new THREE.MeshStandardMaterial({color:0x424a47,roughness:.90});
const pilotCloth=new THREE.MeshStandardMaterial({color:0x525750,roughness:.88});
const pilotBoot=new THREE.MeshStandardMaterial({color:0x2f3031,roughness:.78,metalness:.08});
const pilotSkin=new THREE.MeshStandardMaterial({color:0xb7866b,roughness:.93});
const pilotLimbs={arms:[],legs:[],boots:[]};
const flameLight=new THREE.PointLight(0xff6a31,0,21,2);
flameLight.position.set(0,-1.42,1.0);avatar.add(flameLight);
function pilotMesh(geometry,material,x,y,z,parent=avatar){
  const mesh=new THREE.Mesh(geometry,material);
  mesh.position.set(x,y,z);parent.add(mesh);return mesh;
}
// Tapered jacket with shoulders, collar, leather waist belt and a separate pelvis.
pilotMesh(new THREE.CylinderGeometry(.49,.35,1.51,24),pilotJacket,0,-.70,0);
pilotMesh(new THREE.CylinderGeometry(.34,.33,.37,20),M.pants,0,-1.55,0);
pilotMesh(new THREE.CylinderGeometry(.37,.37,.13,20),pilotDark,0,-1.35,0);
pilotMesh(new THREE.CylinderGeometry(.19,.22,.2,12),pilotSkin,0,.10,0);
pilotMesh(new THREE.SphereGeometry(.292,24,18),pilotSkin,0,.54,-.03);
const helmet=pilotMesh(new THREE.SphereGeometry(.354,28,18,0,Math.PI*2,0,Math.PI*.59),pilotDark,0,.62,0);
pilotMesh(new THREE.CylinderGeometry(.365,.36,.075,24),pilotMetal,0,.56,.03);
const gogglesStrap=pilotMesh(new THREE.CylinderGeometry(.335,.337,.08,24),pilotDark,0,.50,-.015);
for(const dir of [-1,1]){
  // Smoked anti-glare flight goggles have reflective curved lenses with metal retaining rings.
  const lens=pilotMesh(new THREE.SphereGeometry(.135,20,14),pilotLens,dir*.145,.53,-.303);
  lens.scale.set(1,.76,.28);
  const ring=pilotMesh(new THREE.TorusGeometry(.134,.018,8,24),pilotMetal,dir*.145,.53,-.348);
  ring.rotation.y=dir*.075;
  pilotMesh(new THREE.SphereGeometry(.085,12,10),pilotMetal,dir*.34,.51,-.025);
  // Shoulder-origin pivots produce a believable run animation.
  const armPivot=new THREE.Group();armPivot.position.set(dir*.515,-.21,0);avatar.add(armPivot);
  const upper=pilotMesh(new THREE.CapsuleGeometry(.165,.59,8,14),pilotJacket,dir*.04,-.47,.01,armPivot);
  upper.rotation.z=dir*.12;
  pilotMesh(new THREE.SphereGeometry(.145,12,10),pilotDark,dir*.08,-.91,-.015,armPivot);
  pilotLimbs.arms.push(armPivot);
  const legPivot=new THREE.Group();legPivot.position.set(dir*.215,-1.50,0);avatar.add(legPivot);
  pilotMesh(new THREE.CapsuleGeometry(.174,.78,8,14),M.pants,0,-.47,.018,legPivot);
  const boot=pilotMesh(new THREE.SphereGeometry(1,18,12),pilotBoot,0,-1.02,-.13,legPivot);
  boot.scale.set(.232,.16,.34);
  pilotLimbs.legs.push(legPivot);pilotLimbs.boots.push(boot);
  // Sturdy backpack harness, front straps and back-side buckles.
  const strap=pilotMesh(new THREE.BoxGeometry(.11,1.55,.12),pilotMetal,dir*.38,-.66,-.43);
  strap.rotation.z=dir*.1;
}
const scarf=pilotMesh(new THREE.TorusGeometry(.38,.075,8,24),pilotCloth,0,.055,0);
scarf.rotation.x=Math.PI/2;
// No oversized, free-floating scarf: that was a stylized visual artifact.
// More grounded metal jet unit: housing, exhaust collars and a small painted chili emblem.
pilotMesh(new THREE.BoxGeometry(.70,1.02,.27),pilotDark,0,-.68,.47);
pilotMesh(new THREE.BoxGeometry(.55,.72,.10),pilotMetal,0,-.64,.66);
for(const dir of [-1,1]){
  pilotMesh(new THREE.BoxGeometry(.20,.86,.29),pilotMetal,dir*.35,-.68,.64);
  const nozzle=pilotMesh(new THREE.CylinderGeometry(.12,.20,.30,14),pilotDark,dir*.21,-1.22,.75);
  nozzle.rotation.x=Math.PI/2;
  pilotMesh(new THREE.TorusGeometry(.17,.033,7,18),pilotMetal,dir*.21,-1.22,.89).rotation.x=0;
}
pilotMesh(new THREE.BoxGeometry(.25,.32,.07),pilotCloth,0,-.74,.84);
avatar.rotation.order='YXZ';
// Only the nearby player and coherent roof silhouettes are shadow casters;
// every window/window-frame should not get its own costly shadow draw.
avatar.traverse(mesh=>{if(mesh.isMesh)mesh.castShadow=true;});

// CESSNA185_CHONGQING_SHARED_V1: the SAME Blender GLB chosen from PATROL's
// launcher is loaded in this independent Three.js map; it is never a map-only
// aircraft. A light fallback preserves playability until the bake publishes.
const floatControl={speed:0,pitch:0,waterborne:true,sinkRate:0};
let seaplaneRoot=null;
if(seaplaneMode){
  for(const child of avatar.children)child.visible=false;
  seaplaneRoot=new THREE.Group();
  seaplaneRoot.rotation.y=Math.PI; // PATROL aircraft use +Z forward.
  avatar.add(seaplaneRoot);
  const shellMat=new THREE.MeshStandardMaterial({color:0xdde1dd,metalness:.22,roughness:.48}),
    floatMat=new THREE.MeshStandardMaterial({color:0xa8b7bf,metalness:.55,roughness:.35}),
    windowMat=new THREE.MeshStandardMaterial({color:0x1f495d,metalness:.14,roughness:.20});
  const fallback=new THREE.Group();
  const fuselage=new THREE.Mesh(new THREE.SphereGeometry(1,18,12),shellMat);
  fuselage.scale.set(.65,.64,3.78);fuselage.position.y=.10;fallback.add(fuselage);
  const wing=new THREE.Mesh(new THREE.BoxGeometry(10.922,.18,1.48),floatMat);
  wing.position.set(0,.95,-.18);fallback.add(wing);
  for(const side of [-1,1]){
    const pontoon=new THREE.Mesh(new THREE.CapsuleGeometry(.49,4.81,7,12),floatMat);
    pontoon.rotation.x=Math.PI/2;
    pontoon.position.set(side*1.27,-1.02,.08);fallback.add(pontoon);
    for(const z of [-1.45,1.45]){
      const strut=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,.87,8),floatMat);
      strut.position.set(side*1.14,-.57,z);strut.rotation.z=side*.18;
      fallback.add(strut);
    }
    const window=new THREE.Mesh(new THREE.BoxGeometry(.052,.55,1.7),windowMat);
    window.position.set(side*.66,.30,.48);fallback.add(window);
  }
  const tail=new THREE.Mesh(new THREE.BoxGeometry(2.68,.1,.76),shellMat);
  tail.position.set(0,.46,-3.07);fallback.add(tail);
  const fin=new THREE.Mesh(new THREE.BoxGeometry(.12,1.7,1.0),floatMat);
  fin.position.set(0,1.08,-3.2);fallback.add(fin);
  const prop=new THREE.Mesh(new THREE.BoxGeometry(.13,2.2,.08),windowMat);
  prop.position.set(0,0,4.0);fallback.add(prop);
  seaplaneRoot.add(fallback);
  // Shared real Blender mesh, not a second independently modeled aircraft.
  import('https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js')
    .then(({GLTFLoader})=>new GLTFLoader().loadAsync('./assets/aircraft/cessna185-floats.glb'))
    .then(gltf=>{
      if(!seaplaneRoot||!gltf.scene)return;
      fallback.visible=false;
      seaplaneRoot.add(gltf.scene);
      gltf.scene.traverse(node=>{if(node.isMesh)node.castShadow=true;});
      console.info('[PATROL] Chongqing uses shared Blender Cessna 185');
    }).catch(error=>console.info('[PATROL] Chongqing C185 fallback:',error.message));
}

const state={
  pos:new THREE.Vector3(285,ground(285,265)+2.7,265),
  vel:new THREE.Vector3(),heading:0,flying:false,onGround:true,
  spicy:0,boosting:false,jumpCount:0,seenHong:false,seenBridge:false,seenHotpot:false
};
// Restore the pilot where the space launch happened, including walking/flight mode.
try {
  const saved=JSON.parse(sessionStorage.getItem('patrol.cosmos.lastLaunch')||'null');
  if(saved && saved.map==='chongqing'){
    sessionStorage.removeItem('patrol.cosmos.lastLaunch');
    if(saved.playing && Array.isArray(saved.position) && saved.position.length===3 &&
        saved.position.every(Number.isFinite)){
      const [x,y,z]=saved.position;
      if(Math.abs(x)<1000 && Math.abs(z)<1000){
        const floor=ground(x,z)+2.7;
        state.pos.set(x,Math.max(floor,Math.min(y,630)),z);
        state.vel.set(0,0,0);
        state.heading=Number.isFinite(saved.heading)?saved.heading:0;
        state.flying=Boolean(saved.avatarFlying);
        state.onGround=!state.flying&&state.pos.y<=floor+0.5;
      }
    }
  }
}catch(error){console.warn('Chongqing return state skipped:',error);}
if(seaplaneMode){
  const savedAirborne=state.flying&&state.pos.y>2;
  if(!savedAirborne){
    state.pos.set(-595,-2.40+1.61,riverCenter(-595));
    state.heading=Math.PI/2;
    state.vel.set(0,0,0);
  }
  floatControl.waterborne=!savedAirborne;
  state.flying=savedAirborne;
  state.onGround=false;
}
const keys=new Set();
let jumpQueued=false;
let touchForward=0,touchSideways=0;
const joystick=document.getElementById('joystick');
const joystickKnob=document.getElementById('joystickKnob');
let joystickPointer=null;
function updateJoystick(e){
  const r=joystick.getBoundingClientRect();
  const x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2;
  const distance=Math.max(1,Math.hypot(x,y));
  const fraction=Math.min(distance/42,1);
  touchSideways=x/distance*fraction;
  touchForward=-y/distance*fraction;
  joystickKnob.style.transform='translate('+Math.round(touchSideways*42)+'px,'+Math.round(-touchForward*42)+'px)';
}
function stopJoystick(e){
  if(joystickPointer!==e.pointerId)return;
  joystickPointer=null;touchForward=0;touchSideways=0;
  joystickKnob.style.transform='translate(0,0)';
}
joystick.addEventListener('pointerdown',e=>{
  if(joystickPointer!==null)return;
  e.preventDefault();joystickPointer=e.pointerId;
  joystick.setPointerCapture(e.pointerId);updateJoystick(e);
});
joystick.addEventListener('pointermove',e=>{if(e.pointerId===joystickPointer)updateJoystick(e);});
joystick.addEventListener('pointerup',stopJoystick);
joystick.addEventListener('pointercancel',stopJoystick);
let viewYaw=-.72,viewPitch=.25,camDistance=14,dragging=false,mouseX=0,mouseY=0,toastUntil=0;
const temp=new THREE.Vector3();
const cameraAim=new THREE.Vector3();
function message(value,seconds=2.6){
  toastEl.textContent=value;toastEl.style.opacity='1';toastUntil=clock.getElapsedTime()+seconds;
}
function eatHotpot(){
  if(seaplaneMode){message('请先返回人物模式体验重庆火锅');return;}
  if(Math.hypot(state.pos.x-hotpotDoor.x,state.pos.z-hotpotDoor.z)>27 ||
     Math.abs(state.pos.y-hotpotDoor.y)>14){
    message('走到重庆老火锅门口再按 E');return;
  }
  state.spicy=100;state.seenHotpot=true;
  document.getElementById('questHotpot').textContent='✓ 吃一次重庆火锅';
  document.getElementById('questHotpot').classList.add('done');
  message('🌶️ 火锅辣度爆表！屁股喷火推进已激活！',4);
}
function toggleFlight(){
  if(seaplaneMode){
    message('水上飞机：Shift 加油门 · W/Space 抬头 · S/Ctrl 下降 · A/D 转向 · B 减速');
    return;
  }
  state.flying=!state.flying;state.onGround=false;
  if(state.flying)state.vel.y=Math.max(9,state.vel.y);
  message(state.flying?'飞行模式开启！Shift 加速，Space 上升，Ctrl 下降':'关闭飞行，准备降落');
}
let marketDetailTarget=null;
// Optional viewpoint shortcuts let players visually inspect the distant landmarks
// without waiting for a long flyover; they do not alter the world or quest progress.
function scenicView(key){
  if(seaplaneMode)return false; // No teleporting aircraft into terrain.
  const destinations={
    Digit1:{name:'洪崖洞临江夜景',pos:[155,132,-72],target:[155,112,168]},
    Digit2:{name:'朝天门来福士与水晶连廊',pos:[-355,302,-50],target:[-355,294,176]},
    Digit3:{name:'李子坝轻轨穿楼',pos:[-121,112,-345],target:[-121,100,-254]},
    Digit4:{name:'重庆老火锅',pos:[285,ground(285,265)+2.7,265],target:[285,ground(285,225)+8,225]},
    // One inspectable bank approach: look east across the unbridged tributary.
    // The camera is still in the actual compressed city, never in water.
    Digit5:{name:'支流护栏与山城道路',pos:[-472,ground(-472,-271)+8,-271],
      target:[-420,ground(-420,-271)+12,-271]}
  };
  // Inspect a crossing that REALLY survived river/building checks.
  // No fixed guessed site: the source is the instantiated street network.
  if(key==='Digit6'){
    const x=streetBuild.snapshot().crossingXs[0];
    if(Number.isFinite(x)){
      const z=riverCenter(x)+250+14*Math.sin(x/115+1);
      destinations.Digit6={
        name:'双向红绿灯与山城街面',
        pos:[x,ground(x,z)+5.5,z],
        target:[x+18,ground(x,z)+6.3,z]
      };
    }
  }
  if(key==='Digit7'){
    const site=marketFronts.snapshot()[1]??marketFronts.snapshot()[0];
    if(site){
      // Look diagonally uphill from the lower eastern terrace. A direct
      // x=284 photo is dominated by an occluding mountain cliff.
      const eyeX=site.x+31,eyeZ=site.z+35;
      destinations.Digit7={
        name:'山城商铺 · 木构廊道与坡屋顶',
        pos:[eyeX,ground(eyeX,eyeZ)+18,eyeZ],
        target:[site.x,site.base+13.5,site.z+1.4]
      };
    }
  }
  if(key==='Digit8'){
    const site=marketFronts.snapshot()[1]??marketFronts.snapshot()[0];
    if(site){
      // A second, closer angle reveals the physical window jamb depth;
      // Digit7 stays unchanged for baseline before/after comparisons.
      const eyeX=site.x+3,eyeZ=site.z+18;
      destinations.Digit8={
        name:'山城商铺 · 实体窗洞近景',
        pos:[eyeX,ground(eyeX,eyeZ)+18,eyeZ],
        target:[site.x,site.base+9.6,site.z+2.6],
        // Aim the lens at two ground openings rather than the pilot's helmet.
        // Only Digit8 gets this inspect target; player camera control is unchanged.
        inspectTarget:[site.x+2.4,site.base+6.8,site.z+2.78]
      };
    }
  }
  const next=destinations[key];
  if(!next)return false;
  marketDetailTarget=next.inspectTarget??null;
  state.pos.set(...next.pos);
  state.vel.set(0,0,0);
  state.flying=key!=='Digit4';
  state.onGround=key==='Digit4';
  state.boosting=false;
  jumpQueued=false;
  const dx=next.target[0]-state.pos.x,dz=next.target[2]-state.pos.z;
  viewYaw=Math.atan2(dx,-dz);
  viewPitch=key==='Digit8'?-.22:key==='Digit7'?-.28:.23;
  cameraPos.copy(state.pos).add(new THREE.Vector3(-Math.sin(viewYaw)*camDistance,7,Math.cos(viewYaw)*camDistance));
  message('观景镜头：'+next.name,3);
  return true;
}
function press(key,once=false){
  // Any deliberate movement/flight input restores normal third-person framing.
  if(marketDetailTarget&&['KeyW','KeyA','KeyS','KeyD','Space',
    'ControlLeft','ControlRight','ShiftLeft','ShiftRight','KeyF',
    'ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(key))marketDetailTarget=null;
  if(once&&key==='KeyE')eatHotpot();
  if(once&&key==='KeyF')toggleFlight();
  if(once&&key==='Space')jumpQueued=true;
  keys.add(key);
}
window.addEventListener('keydown',e=>{
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
  if(!e.repeat&&scenicView(e.code))return;
  if(!e.repeat&&e.code==='KeyH'){document.body.classList.toggle('cinematic');return;}
  if(!e.repeat&&e.code==='KeyT'){
    cqTimeSelect.value=cqTimeOptions[(cqTimeOptions.indexOf(cqTimeSelect.value)+1)%cqTimeOptions.length];
    applyCinematicEnvironment(cqTimeSelect.value);
    streetBuild.setTimeOfDay(cqTimeSelect.value);
    wetStreetBuild.setTimeOfDay(cqTimeSelect.value);
    skyline.setTimeOfDay(cqTimeSelect.value);return;
  }
  if(!e.repeat&&e.code==='KeyP')perfHud.hidden=!perfHud.hidden;
  if(!e.repeat)press(e.code,true);
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{keys.clear();touchForward=touchSideways=0;joystickPointer=null;joystickKnob.style.transform='translate(0,0)';});
canvas.addEventListener('pointerdown',e=>{dragging=true;mouseX=e.clientX;mouseY=e.clientY;canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointerup',()=>dragging=false);
canvas.addEventListener('pointercancel',()=>dragging=false);
canvas.addEventListener('pointermove',e=>{
  if(!dragging)return;
  viewYaw-=(e.clientX-mouseX)*.0065;
  viewPitch=clamp(viewPitch+(e.clientY-mouseY)*.004,-.3,1.05);
  mouseX=e.clientX;mouseY=e.clientY;
});
canvas.addEventListener('wheel',e=>{camDistance=clamp(camDistance+Math.sign(e.deltaY)*1.5,7,32);},{passive:true});
document.querySelectorAll('#mobile button').forEach(b=>{
  const key=b.dataset.key;
  b.addEventListener('pointerdown',e=>{e.preventDefault();press(key,true);b.setPointerCapture(e.pointerId);});
  b.addEventListener('pointerup',()=>keys.delete(key));
  b.addEventListener('pointercancel',()=>keys.delete(key));
});

// An instanced low-poly flame trail, spawned from behind the character's lower back.
const fireGeo=new THREE.IcosahedronGeometry(1,0);
const fireMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.86,depthWrite:false});
const fire=new THREE.InstancedMesh(fireGeo,fireMat,100);
fire.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
fire.frustumCulled=false;
const particles=Array.from({length:100},()=>({life:0,age:0,p:new THREE.Vector3(),v:new THREE.Vector3(),size:1}));
for(let i=0;i<100;i++){fire.setColorAt(i,new THREE.Color(i%3===0?'#fff0a2':i%3===1?'#ffac32':'#f44a21'));dummy.scale.set(0,0,0);dummy.position.set(0,-999,0);dummy.updateMatrix();fire.setMatrixAt(i,dummy.matrix);}
fire.visible=false;
scene.add(fire);
let particleCursor=0,emitAccumulator=0,flameLifetime=0;
function spawnFlame(){
  const p=particles[particleCursor++%particles.length];
  p.life=.35+rand()*.47;p.age=0;p.size=.5+rand()*1.5;
  const sx=-Math.sin(state.heading),sz=Math.cos(state.heading);
  p.p.set(state.pos.x+sx*.8+(rand()-.5)*.45,state.pos.y-1.2,state.pos.z+sz*.8+(rand()-.5)*.45);
  const thrust=10+rand()*17;
  p.v.set(sx*thrust,-7+rand()*6,sz*thrust);
  flameLifetime=Math.max(flameLifetime,p.life);
}
function updateFlames(dt){
  const active=state.spicy>0&&(state.flying||state.boosting);
  if(!active&&flameLifetime<=0){fire.visible=false;return;}
  fire.visible=true;
  flameLifetime=Math.max(0,flameLifetime-dt);
  if(active){
    emitAccumulator+=dt*(state.boosting?120:44);
    while(emitAccumulator>=1){spawnFlame();emitAccumulator--;}
  }else emitAccumulator=0;
  for(let i=0;i<particles.length;i++){
    const p=particles[i];p.age+=dt;
    if(p.age<p.life){
      p.p.addScaledVector(p.v,dt);p.v.y-=8*dt;
      const s=p.size*Math.pow(1-p.age/p.life,.58);
      dummy.position.copy(p.p);dummy.scale.setScalar(s);dummy.rotation.set(0,0,0);
    }else{dummy.position.set(0,-999,0);dummy.scale.setScalar(0);}
    dummy.updateMatrix();fire.setMatrixAt(i,dummy.matrix);
  }
  fire.instanceMatrix.needsUpdate=true;
}
function intersectsBuilding(x,y,z){
  return obstacleIndex.collides(x,y,z);
}
// Independent Chongqing river branch follows the actual mesh's waterline.
function floatWaterSite(x,z,heading){
  const fx=Math.sin(heading),fz=-Math.cos(heading),
    sx=-fz,sz=fx;
  for(const along of [-3,0,3])for(const side of [-1.85,0,1.85]){
    const px=x+fx*along+sx*side,pz=z+fz*along+sz*side;
    // River width + bank setback; never float a 10.9m wing in city blocks.
    if(riverDist(px,pz)>-8||ground(px,pz)>0)return false;
    if(intersectsBuilding(px,0,pz))return false;
  }
  return true;
}
function moveSharedFloatplane(dt){
  const turn=(Number(keys.has('KeyD')||keys.has('ArrowRight'))-
    Number(keys.has('KeyA')||keys.has('ArrowLeft')))+touchSideways;
  const lift=(Number(keys.has('KeyW')||keys.has('ArrowUp')||keys.has('Space'))-
    Number(keys.has('KeyS')||keys.has('ArrowDown')||
      keys.has('ControlLeft')||keys.has('ControlRight')))+touchForward;
  const throttle=keys.has('ShiftLeft')||keys.has('ShiftRight');
  const stop=keys.has('KeyB');
  const f=floatControl;
  state.boosting=throttle;
  if(f.waterborne){
    f.speed=clamp(f.speed+(stop?-10.5:throttle?5.9:-2.3)*dt,0,26);
  }else{
    const target=throttle?25:19;
    f.speed+=(target-f.speed)*(1-Math.exp(-dt*1.3));
  }
  state.heading+=turn*(f.waterborne?clamp(f.speed/24,.07,.51):.94)*dt;
  const x=state.pos.x+Math.sin(state.heading)*f.speed*dt;
  const z=state.pos.z-Math.cos(state.heading)*f.speed*dt;
  const safe=floatWaterSite(x,z,state.heading);
  if(f.waterborne){
    if(!safe){
      // A bank or shallow obstruction stops the hull, never clips through.
      f.speed=0;
      message('前方是岸边／浅滩：浮筒无法滑行');
    }else{
      state.pos.x=x;state.pos.z=z;
    }
    f.pitch=0;
    state.pos.y=-2.40+1.61+.025*Math.sin(time*2.2);
    if(throttle && f.speed>=17.5 && lift>.2 && safe){
      f.waterborne=false;
      f.pitch=.17;
      f.sinkRate=2.2;
      state.pos.y+=.20;
      message('浮筒离水 · 水上飞机起飞');
    }
  }else{
    state.pos.x=clamp(x,-930,930);
    state.pos.z=clamp(z,-630,630);
    const desired=clamp(lift,-1,1)*.34;
    f.pitch+=(desired-f.pitch)*(1-Math.exp(-dt*2.3));
    f.sinkRate=f.speed*Math.sin(f.pitch)-(throttle?.25:1.2);
    state.pos.y=clamp(state.pos.y+f.sinkRate*dt,-.79,725);
    if(state.pos.y<=-2.4+1.61+.02){
      const good=safe&&f.sinkRate>=-7.5&&f.speed<=24.5&&
        f.pitch>=-.17&&f.pitch<=.20&&Math.abs(turn)<.60;
      if(good){
        f.waterborne=true;f.pitch=0;
        state.pos.y=-2.4+1.61;
        message('水面软着陆 · 浮筒滑行');
      }else{
        f.waterborne=true;f.speed=0;f.pitch=0;
        state.pos.set(-595,-2.4+1.61,riverCenter(-595));
        state.heading=Math.PI/2;
        message('不安全的水面冲击：已返回安全水域');
      }
    }
    if(!safe && state.pos.y<=Math.max(ground(state.pos.x,state.pos.z)+2.0,3.0)){
      f.waterborne=true;f.speed=0;f.pitch=0;
      state.pos.set(-595,-2.4+1.61,riverCenter(-595));
      state.heading=Math.PI/2;
      message('碰到陆地：已返回安全水域');
    }
  }
  state.flying=!f.waterborne;
  state.onGround=false;
  state.vel.set(Math.sin(state.heading)*f.speed,f.sinkRate,
    -Math.cos(state.heading)*f.speed);
  avatar.position.copy(state.pos);
  avatar.rotation.y=-state.heading;
  avatar.rotation.x=-f.pitch;
  avatar.rotation.z+=(clamp(-turn*.09,-.22,.22)-avatar.rotation.z)*
    (1-Math.exp(-dt*4));
  if(seaplaneRoot)seaplaneRoot.position.y=0;
}

function move(dt){
  if(seaplaneMode){moveSharedFloatplane(dt);return;}
  // If standing on a moving ferry deck, inherit its motion before player input.
  if(state.onGround&&!state.flying){
    const drift=riverBuild.deckDrift(state.pos.x,state.pos.z,state.pos.y);
    state.pos.x=clamp(state.pos.x+drift.dx,-935,935);
    state.pos.z=clamp(state.pos.z+drift.dz,-635,635);
  }
  const forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)+touchForward;
  const sideways=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+touchSideways;
  const motion=temp.set(
    Math.sin(viewYaw)*forward+Math.cos(viewYaw)*sideways,0,
    -Math.cos(viewYaw)*forward+Math.sin(viewYaw)*sideways
  );
  if(motion.lengthSq()>1)motion.normalize();
  const shift=keys.has('ShiftLeft')||keys.has('ShiftRight');
  state.boosting=shift && (forward!==0||sideways!==0||state.flying);
  const spicyBoost=state.spicy>0&&state.boosting;
  const targetSpeed=state.flying?(spicyBoost?78:shift?48:34):(shift?29:12);
  const blend=1-Math.exp(-dt*(state.flying?3.2:9));
  state.vel.x+=(motion.x*targetSpeed-state.vel.x)*blend;
  state.vel.z+=(motion.z*targetSpeed-state.vel.z)*blend;
  if(motion.lengthSq()>.1){
    const desired=Math.atan2(motion.x,-motion.z);
    const diff=Math.atan2(Math.sin(desired-state.heading),Math.cos(desired-state.heading));
    state.heading+=diff*(1-Math.exp(-dt*8));
  }
  if(state.flying){
    const ascend=keys.has('Space')?1:0;
    const descend=keys.has('ControlLeft')||keys.has('ControlRight')?1:0;
    const vy=(ascend-descend)*(spicyBoost?40:24);
    state.vel.y+=(vy-state.vel.y)*(1-Math.exp(-dt*4.4));
    if(spicyBoost)state.spicy=Math.max(0,state.spicy-dt*6.5);
    else if(state.spicy>0)state.spicy=Math.max(0,state.spicy-dt*.55);
  }else{
    if(jumpQueued&&state.onGround){
      state.vel.y=39;state.onGround=false;state.jumpCount++;
    }
    state.vel.y-=29*dt;
    if(state.spicy>0)state.spicy=Math.max(0,state.spicy-dt*.35);
  }
  jumpQueued=false;
  const px=state.pos.x,pz=state.pos.z,py=state.pos.y;
  const nx=clamp(px+state.vel.x*dt,-935,935);
  const nz=clamp(pz+state.vel.z*dt,-635,635);
  // Permit flight above the 350m Raffles towers and the existing 650m space transition.
  state.pos.y=clamp(py+state.vel.y*dt,-.25,725);
  if(state.vel.y>0){
    const ceiling=obstacleIndex.ceilingSurface(state.pos.x,state.pos.z,py,state.pos.y);
    if(state.pos.y>ceiling){state.pos.y=ceiling;state.vel.y=0;}
  }
  // Resolve axes separately so the pilot can slide along facades instead of sticking.
  if(!intersectsBuilding(nx,state.pos.y,pz)&&!streetBuild.nearby(nx,pz,state.pos.y,.7))state.pos.x=nx;
  else state.vel.x=0;
  if(!intersectsBuilding(state.pos.x,state.pos.y,nz)&&!streetBuild.nearby(state.pos.x,nz,state.pos.y,.7))state.pos.z=nz;
  else state.vel.z=0;
  // Distinguish walkable roofs from solid walls; the water surface is also walkable.
  const floor=Math.max(
    obstacleIndex.landingSurface(state.pos.x,state.pos.z,py,state.pos.y,
      Math.max(ground(state.pos.x,state.pos.z),-2.0)),
    riverBuild.deckSurface(state.pos.x,state.pos.z,py,state.pos.y)
  );
  if(state.pos.y<floor&&state.vel.y<=0){
    state.pos.y=floor;state.vel.y=0;state.onGround=true;
    if(state.flying){state.flying=false;message('安全降落');}
  }else if(state.pos.y>floor+.15)state.onGround=false;
  // Preserve climb speed above the 350m landmark towers: the real upper limit
  // is the explicit 725-unit world clamp, not the removed legacy 300-unit cap.
  if(state.pos.y>=725&&state.vel.y>0)state.vel.y=0;
  avatar.position.copy(state.pos);
  avatar.rotation.y=state.heading;
  const bank=clamp(-state.vel.x*Math.cos(viewYaw)*.005+state.vel.z*Math.sin(viewYaw)*.005,-.24,.24);
  avatar.rotation.z+= (bank-avatar.rotation.z)*(1-Math.exp(-dt*5));
  avatar.rotation.x+=((state.flying?-.11:0)-avatar.rotation.x)*Math.min(1,dt*5);
  const speed=Math.hypot(state.vel.x,state.vel.z);
  const running=!state.flying&&state.onGround?Math.min(speed/20,1):0;
  const swing=Math.sin(time*10.7)*.44*running;
  pilotLimbs.arms[0].rotation.x=swing;
  pilotLimbs.arms[1].rotation.x=-swing;
  pilotLimbs.legs[0].rotation.x=-swing;
  pilotLimbs.legs[1].rotation.x=swing;
  // Keep physical gait and helmet animation without the removed toy scarf.
  flameLight.intensity+=((state.spicy>0&&(state.boosting||state.flying)?65:0)-flameLight.intensity)*Math.min(1,dt*8);
}
const visited={hong:false,bridge:false,raffles:false,liziba:false,ferry:false};
function updateQuest(){
  if(!visited.hong&&Math.hypot(state.pos.x-155,state.pos.z-145)<140&&state.pos.y>45){
    visited.hong=true;const el=document.getElementById('questHong');
    el.textContent='✓ 飞过洪崖洞';el.classList.add('done');message('发现地标：洪崖洞！');
  }
  if(!visited.bridge&&([40,470].some(x=>Math.abs(state.pos.x-x)<45))&&Math.abs(state.pos.z)<130&&state.pos.y>35){
    visited.bridge=true;const el=document.getElementById('questBridge');
    el.textContent='✓ 飞过跨江大桥';el.classList.add('done');message('飞越两江大桥！');
  }
  if(!visited.raffles&&Math.hypot(state.pos.x-landmarkBuild.raffles.x,state.pos.z-landmarkBuild.raffles.z)<170&&state.pos.y>120){
    visited.raffles=true;const el=document.getElementById('questRaffles');
    if(el){el.textContent='✓ 朝天门来福士与水晶连廊';el.classList.add('done');}
    message('发现地标：朝天门来福士！');
  }
  if(!visited.liziba&&Math.hypot(state.pos.x-landmarkBuild.liziba.x,state.pos.z-landmarkBuild.liziba.z)<75&&Math.abs(state.pos.y-landmarkBuild.liziba.y)<75){
    visited.liziba=true;const el=document.getElementById('questLiziba');
    if(el){el.textContent='✓ 李子坝轻轨穿楼';el.classList.add('done');}
    message('发现地标：李子坝轻轨穿楼！');
  }
  if(!visited.ferry&&riverBuild.isAboard(state.pos.x,state.pos.z,state.pos.y)){
    visited.ferry=true;
    const el=document.getElementById('questFerry');
    if(el){el.textContent='✓ 搭乘嘉陵江游船';el.classList.add('done');}
    message('🚢 成功降落游船甲板，可跟随客船沿江巡航！',4);
  }
  if(seaplaneMode){
    const speed=floatControl.speed;
    hint.textContent=floatControl.waterborne
      ?'Cessna 185 · 浮筒接水 · Shift 加速 · W 抬头 (17.5+) · A/D 转向 · B 刹水'
      :'Cessna 185 · 空中 · W 上升 / S 下降 · Shift 加速 · 保持低下沉率接水';
    fill.style.width=(speed/26*100).toFixed(1)+'%';
    meter.textContent=Math.round(speed)+' u/s';
    return;
  }
  hint.textContent=Math.hypot(state.pos.x-hotpotDoor.x,state.pos.z-hotpotDoor.z)<27&&
    Math.abs(state.pos.y-hotpotDoor.y)<14
    ?'🍲 按 E 吃重庆火锅，激活麻辣喷火推进'
    :riverBuild.isAboard(state.pos.x,state.pos.z,state.pos.y)?'🚢 正在搭乘嘉陵江游船 · WASD 甲板移动 · F 起飞'
    :state.spicy>0?'🌶️ 麻辣推进中！按 F 飞行，Shift 加速'
    :state.flying?'按 Space 爬升 · Ctrl 下降 · Shift 冲刺 · F 降落'
    :'WASD 移动 · Shift 奔跑 · Space 超级跳 · F 自由飞行';
  fill.style.width=state.spicy+'%';
  meter.textContent=state.spicy>0?Math.ceil(state.spicy)+'%':'未激活';
}
function drawMinimap(){
  const w=256,h=256;mapCtx.clearRect(0,0,w,h);
  mapCtx.save();mapCtx.beginPath();mapCtx.arc(128,128,124,0,TAU);mapCtx.clip();
  mapCtx.fillStyle='#293648';mapCtx.fillRect(0,0,w,h);
  mapCtx.strokeStyle='#3b90b4';mapCtx.lineWidth=22;mapCtx.beginPath();
  for(let i=0;i<=40;i++){const x=-990+1980*i/40,px=128+(x-state.pos.x)*.17,py=128+(riverCenter(x)-state.pos.z)*.17;if(i===0)mapCtx.moveTo(px,py);else mapCtx.lineTo(px,py);}
  mapCtx.stroke();
  for(const [x,z,label] of [[155,145,'洪'],[40,0,'桥'],[470,0,'桥'],[hotpot.x,hotpot.z,'锅'],[landmarkBuild.raffles.x,landmarkBuild.raffles.z,'来'],[landmarkBuild.liziba.x,landmarkBuild.liziba.z,'轨']]){
    const px=128+(x-state.pos.x)*.17,py=128+(z-state.pos.z)*.17;
    mapCtx.fillStyle='#ffd28b';mapCtx.beginPath();mapCtx.arc(px,py,10,0,TAU);mapCtx.fill();
    mapCtx.fillStyle='#30251d';mapCtx.font='bold 13px sans-serif';mapCtx.textAlign='center';mapCtx.textBaseline='middle';mapCtx.fillText(label,px,py);
  }
  // Moving sightseeing ferries appear as river-blue mini-map markers.
  for(const boat of riverBuild.snapshot()){
    const px=128+(boat.x-state.pos.x)*.17,py=128+(boat.z-state.pos.z)*.17;
    mapCtx.fillStyle='#aee1ed';
    mapCtx.beginPath();mapCtx.arc(px,py,6,0,TAU);mapCtx.fill();
    mapCtx.fillStyle='#173442';mapCtx.font='10px sans-serif';
    mapCtx.textAlign='center';mapCtx.textBaseline='middle';mapCtx.fillText('船',px,py+.5);
  }
  mapCtx.translate(128,128);mapCtx.rotate(state.heading);
  mapCtx.fillStyle='#ff5e39';mapCtx.beginPath();mapCtx.moveTo(0,-14);mapCtx.lineTo(-9,11);mapCtx.lineTo(9,11);mapCtx.closePath();mapCtx.fill();
  mapCtx.restore();
}
const cameraPos=new THREE.Vector3(285,95,265);
const cameraDesired=new THREE.Vector3();
const cameraFocus=new THREE.Vector3();
const cameraRay=new THREE.Vector3();
const cameraSample=new THREE.Vector3();
function updateCamera(dt){
  const speed=Math.hypot(state.vel.x,state.vel.z);
  const distance=camDistance*(1+clamp((speed-28)/160,0,.35));
  const cp=Math.cos(viewPitch),sp=Math.sin(viewPitch);
  cameraDesired.set(
    state.pos.x-Math.sin(viewYaw)*cp*distance,
    state.pos.y+4.7+sp*distance,
    state.pos.z+Math.cos(viewYaw)*cp*distance
  );
  cameraFocus.set(state.pos.x,state.pos.y+1,state.pos.z);
  cameraRay.subVectors(cameraDesired,cameraFocus);
  let cut=1;
  for(let i=1;i<=12;i++){
    const t=i/12;
    cameraSample.copy(cameraFocus).addScaledVector(cameraRay,t);
    if(intersectsBuilding(cameraSample.x,cameraSample.y,cameraSample.z) ||
       cameraSample.y<Math.max(ground(cameraSample.x,cameraSample.z),-2.0)+.95){
      cut=Math.max(.15,(i-1)/12);
      break;
    }
  }
  if(cut<1)cameraDesired.copy(cameraFocus).addScaledVector(cameraRay,cut);
  cameraPos.lerp(cameraDesired,1-Math.exp(-dt*(cut<1?11:4.1)));
  // Never leave the interpolated camera inside a building or beneath the hillside.
  if(intersectsBuilding(cameraPos.x,cameraPos.y,cameraPos.z))cameraPos.copy(cameraDesired);
  cameraPos.y=Math.max(cameraPos.y,Math.max(ground(cameraPos.x,cameraPos.z),-2.0)+1.15);
  camera.position.copy(cameraPos);
  cameraAim.copy(cameraFocus);
  // The collision-safe camera stays behind the player, but this one inspector
  // looks at the physical door/window reveals instead of centering the avatar.
  if(marketDetailTarget)cameraAim.set(...marketDetailTarget);
  camera.lookAt(cameraAim);
  const desiredFov=68+clamp((speed-26)*.24,0,15);
  const newFov=camera.fov+(desiredFov-camera.fov)*(1-Math.exp(-dt*2.5));
  if(Math.abs(newFov-camera.fov)>.015){camera.fov=newFov;camera.updateProjectionMatrix();}
}
let time=0,mapTimer=0,graphicsLost=false,orbitLaunchSent=false;
canvas.addEventListener('webglcontextlost',event=>{
  event.preventDefault();graphicsLost=true;keys.clear();
  message('显卡连接中断，等待浏览器恢复图形。',5);
});
canvas.addEventListener('webglcontextrestored',()=>{
  // Rebuild all procedural GPU assets safely after WebGL context restoration.
  location.reload();
});
function frame(){
  requestAnimationFrame(frame);
  const raw=clock.getDelta(),dt=Math.min(raw,.04);
  if(document.hidden||graphicsLost)return;
  time+=dt;
  waterUniforms.uTime.value=time;
  streetBuild.update(dt,state.pos);
  wetStreetBuild.update(dt);
  riverBuild.update(dt);
  // Move the directional shadow camera with the avatar, limited to ~290m square.
  // Coarse world-space snapping keeps the shadow image from crawling on wet stone.
  moon.target.position.set(
    Math.round(state.pos.x*.5)*2,
    Math.round(state.pos.y*.5)*2,
    Math.round(state.pos.z*.5)*2
  );
  moon.position.copy(moon.target.position).add(localShadowOffset);
  move(dt);updateFlames(dt);updateCamera(dt);landmarkBuild.update(dt);atmosphere.update(dt);
  if(!orbitLaunchSent&&state.pos.y>=650&&state.vel.y>.4){
    orbitLaunchSent=true;
    window.dispatchEvent(new Event('patrol:orbitLaunch'));
  }
  if(orbitLaunchSent&&state.pos.y<550)orbitLaunchSent=false;
  if((mapTimer+=dt)>.09){drawMinimap();updateQuest();mapTimer=0;}
  if(toastUntil&&clock.getElapsedTime()>toastUntil){toastEl.style.opacity='0';toastUntil=0;}
  renderer.render(scene,camera);
  // Aggregate real frame durations, excluding background-tab stalls.
  if(raw>.001&&raw<.22){sampleTime+=raw;sampleFrames++;}
  if(sampleTime>=2.7){
    measuredFPS=sampleFrames/sampleTime;
    sampleFrames=0;sampleTime=0;autoCycles++;
    if(qualityMode==='auto'&&autoCycles>1){
      let nextRatio=renderRatio;
      if(measuredFPS<43)nextRatio=Math.max(minRatio,renderRatio-.12);
      else if(measuredFPS>57)nextRatio=Math.min(budgetRatio,renderRatio+.07);
      if(Math.abs(nextRatio-renderRatio)>.025){
        renderRatio=nextRatio;renderer.setPixelRatio(renderRatio);
      }
    }
    if(!perfHud.hidden){
      const stats=renderer.info.render;
      perfHud.textContent='FPS '+measuredFPS.toFixed(0)+' / Calls '+stats.calls+
        '\nTriangles '+stats.triangles.toLocaleString()+
        '\nPixel ratio '+renderRatio.toFixed(2)+' / '+qualityMode+
        '\nIndexed buildings '+obstacleIndex.obstacleCount+
        '\nSkyline profiles '+skyline.stats.towers+' / 5'+
        '\nTraffic '+streetBuild.stats.vehicles+' cars / '+streetBuild.stats.streetLamps+' streetlamps'+
        '\nPuddles '+wetStreetBuild.stats.puddles+' / lamp reflections '+wetStreetBuild.stats.reflectionStrips+
        '\nJialing River ferries '+riverBuild.stats.boats+
        '\nStreet cuts '+roadClearanceStats.clipped+' / clear strips '+roadClearanceStats.paths+
        '\nMarket porch roofs '+marketFronts.stats.curvedRoofs+' / '+marketFronts.stats.roofTriangles+' triangles';
    }
  }
}
window.PatrolSpaceBridge={getState:()=>({
  map:'chongqing',aircraft:seaplaneMode?'seaplane':'jetpack',playing:!graphicsLost,
  altitude:state.pos.y,climb:state.vel.y,
  position:state.pos.toArray(),heading:state.heading,avatarFlying:state.flying,
  // Exposed only when asked for the actual browser inspector state.
  signalCrossings:streetBuild.stats.signalizedCrossings,
  signalMasts:streetBuild.stats.trafficSignals,
  signalStopLines:streetBuild.stats.stopLines,
  signalAspect:streetBuild.snapshot().signalAspect,
  marketGalleryRoofs:marketFronts.stats.curvedRoofs,
  marketGalleryInstances:marketFronts.stats.instances,
  marketOpenFacades:marketFronts.stats.openFacades,
  marketOpenFacadeTriangles:marketFronts.stats.openFacadeTriangles,
  marketDetailInspect:Boolean(marketDetailTarget)
})};
window.addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(renderRatio);
});
document.getElementById('loading').remove();
message(seaplaneMode?'Cessna 185 已就位于两江水面：Shift 加速，W 抬头起飞':
  '欢迎来到重庆！走近火锅店按 E 开吃',4);
clock.start();frame();