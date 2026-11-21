// Chongqing Pilot — a self-contained PATROL map built with Three.js.
// Flight feel is informed by Petalwake (Jacob Miller, MIT), but this implementation is original.
// https://github.com/jjcm/petalwake — credits in docs/CHONGQING_HOTPOT_PILOT.md.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { buildChongqingDetails } from './details.js';
import { buildChongqingLandmarks } from './landmarks.js';
import { SpatialObstacleIndex } from './spatial.js';
import { createChongqingPBR } from './pbr.js';

const canvas = document.getElementById('world');
const hint = document.getElementById('hint');
const toastEl = document.getElementById('toast');
const fill = document.getElementById('meterFill');
const meter = document.getElementById('meterStatus');
const minimap = document.getElementById('map');
const mapCtx = minimap.getContext('2d');
const clamp = THREE.MathUtils.clamp;
const TAU = Math.PI * 2;
const clock = new THREE.Clock();
const scene = new THREE.Scene();
scene.background = new THREE.Color('#121c2a');
scene.fog = new THREE.FogExp2(0x253345, 0.00072);

let renderer;
try {
  renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:false, powerPreference:'high-performance'});
} catch (error) {
  document.querySelector('#loading p').textContent = '无法启动 WebGL，请打开浏览器图形加速后重试。';
  throw error;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.36;

const camera = new THREE.PerspectiveCamera(68, innerWidth/innerHeight, 0.15, 4000);
const hemi = new THREE.HemisphereLight(0x879ec1, 0x534b48, 1.18);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0xc3d0e8, 1.03);
moon.position.set(-280,520,-420);
scene.add(moon);
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
  return Math.max(8, 9+d*0.172+terraces+relief);
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
    uvs.push(x/16,z/16);
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
const groundMaterial=pbr.stone.clone();groundMaterial.vertexColors=true;groundMaterial.side=THREE.DoubleSide;
scene.add(new THREE.Mesh(worldGeometry,groundMaterial));

const waterUniforms={uTime:{value:0}};
const waterMaterial=new THREE.ShaderMaterial({
  uniforms:waterUniforms,depthWrite:true,side:THREE.DoubleSide,
  vertexShader:[
    'uniform float uTime; varying vec3 vWorld; varying vec3 vNormalW;',
    'void main(){ vec3 p=position; p.y+=0.25*sin(p.x*.065+uTime*1.1)+0.17*cos(p.z*.13-uTime*.9);',
    'vec4 world=modelMatrix*vec4(p,1.);vWorld=world.xyz;vNormalW=vec3(0.,1.,0.);gl_Position=projectionMatrix*viewMatrix*world; }'
  ].join('\n'),
  fragmentShader:[
    'uniform float uTime; varying vec3 vWorld;varying vec3 vNormalW;',
    'void main(){vec3 n=normalize(vNormalW+vec3(.075*sin(vWorld.x*.095+uTime),0.,.065*cos(vWorld.z*.13-uTime)));',
    'float fresnel=pow(1.-max(dot(n,normalize(cameraPosition-vWorld)),0.),3.0);',
    'float wave=sin(vWorld.x*.17+uTime*2.)*cos(vWorld.z*.11-uTime)*.5+.5;',
    'vec3 deep=vec3(.013,.06,.088), reflection=vec3(.14,.22,.28);',
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

// Buildings use instancing: over 300 varied towers with thousands of cheap emissive windows.
const buildingBase=new THREE.BoxGeometry(1,1,1);
const towerMesh=new THREE.InstancedMesh(buildingBase,M.concrete,360);
towerMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
const windowMesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),M.window,17000);
windowMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
const dummy=new THREE.Object3D(), tempColor=new THREE.Color();
const obstacles=[];
let towerCount=0,windowCount=0;
const hues=['#b4b9bf','#96a5af','#9a9ba5','#b1a6a3','#85949f','#b2aea7','#8b9cab'];
function tower(x,z,w,d,h,k) {
  const base=ground(x,z);
  dummy.position.set(x,base+h/2,z);dummy.rotation.set(0,0,0);dummy.scale.set(w,h,d);
  dummy.updateMatrix();towerMesh.setMatrixAt(towerCount,dummy.matrix);
  towerMesh.setColorAt(towerCount,new THREE.Color(hues[k%hues.length]));
  towerCount++;
  obstacles.push({x,z,w:w+2,d:d+2,base,top:base+h});
  const nx=Math.max(2,Math.floor(w/6)),ny=Math.max(2,Math.floor(h/7));
  for(let r=1;r<ny;r++)for(let col=0;col<nx;col++){
    if(rand()<0.22)continue;
    const wx=x-w/2+(col+.5)*w/nx, wy=base+(r+.4)*h/ny;
    dummy.position.set(wx,wy,z+d/2+0.05);
    dummy.scale.set(Math.max(1.1,w/nx*.45),Math.max(.8,h/ny*.35),1);
    dummy.rotation.set(0,0,0);dummy.updateMatrix();
    if(windowCount<17000){
      windowMesh.setMatrixAt(windowCount,dummy.matrix);
      windowMesh.setColorAt(windowCount,tempColor.set(rand()<.32?'#ffd18d':'#7baac3'));windowCount++;
    }
  }
  for(let r=1;r<ny;r+=2)for(let col=0;col<Math.floor(d/7);col++){
    if(rand()<.45)continue;
    dummy.position.set(x+w/2+.05,base+(r+.4)*h/ny,z-d/2+(col+.5)*7);
    dummy.scale.set(2.4,2.3,1);dummy.rotation.set(0,Math.PI/2,0);dummy.updateMatrix();
    if(windowCount<17000){windowMesh.setMatrixAt(windowCount,dummy.matrix);windowMesh.setColorAt(windowCount,tempColor.set('#b8cbe0'));windowCount++;}
  }
}
// Riverfront residential and office blocks are now aligned with terrace roads.
// Avoid random floating towers, major landmark footprints, train tunnel and riverside promenades.
// A fixed seed keeps the skyline stable across reloads and avoids repeated geometry.
for(const side of [-1,1]){
  for(let tier=0;tier<5;tier++){
    for(let col=0;col<34&&towerCount<360;col++){
      const offset=(rand()-.5)*15;
      const x=-948+col*57.8+offset;
      const bankDistance=180+tier*102+(rand()-.5)*15;
      const z=riverCenter(x)+side*bankDistance;
      if(z<-603||z>603||x<-950||x>950)continue;
      if(riverDist(x,z)<28)continue;
      // Preserve distinctive foreground silhouettes and walkable sightseeing corridors.
      if(Math.hypot(x-285,z-225)<112)continue;
      if(Math.hypot(x-160,z-150)<175)continue;
      if(Math.abs(x+355)<220&&Math.abs(z-176)<106)continue;
      if(Math.abs(x+121)<85&&Math.abs(z+254)<78)continue;
      if(Math.abs(x+135)<58&&Math.abs(z-335)<60)continue;
      const w=18+rand()*22,d=17+rand()*23;
      const business=x>-525&&x<590&&tier<4;
      const heightBand=business?76:38;
      const h=heightBand+rand()*(business?165:76);
      // Mid-rise and low-rise buildings break up an otherwise monotonous wall of towers.
      const finalH=(rand()<.20?h*.52:h);
      tower(x,z,w,d,finalH,Math.abs(col*17+tier*11+(side+1)*3));
    }
  }
}
towerMesh.count=towerCount;windowMesh.count=windowCount;
towerMesh.instanceMatrix.needsUpdate=true;windowMesh.instanceMatrix.needsUpdate=true;
if(towerMesh.instanceColor)towerMesh.instanceColor.needsUpdate=true;
if(windowMesh.instanceColor)windowMesh.instanceColor.needsUpdate=true;
scene.add(towerMesh,windowMesh);

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
  scene.add(o);return o;
}
for(const side of [-1,1])for(let l=0;l<3;l++){
  const points=[];
  for(let i=0;i<=72;i++){
    const x=-960+1920*i/72;
    const z=riverCenter(x)+side*(145+l*105+14*Math.sin(x/115+l));
    points.push(new THREE.Vector3(x,ground(x,z)+1.6,z));
  }
  road(points,13-l*1.5);
}
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
sign('洪崖洞',155,133,177,48,13);
// Bridge and civic monument are identified in the HUD/map, not by floating billboards.

const hotpot={x:285,z:225};
const shopY=ground(hotpot.x,hotpot.z);
box(hotpot.x,shopY+10,hotpot.z,72,20,50,M.beam);
box(hotpot.x,shopY+21.8,hotpot.z,80,3,57,M.roof);
box(hotpot.x,shopY+10,hotpot.z+25.4,68,13,1.4,M.gold);
sign('重庆老火锅',hotpot.x,shopY+23.5,hotpot.z+28.8,52,12);
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

// River passenger boats: tapered curved hulls and glazed passenger cabins,
// rather than simple rectangular white boxes.
const boatPlan=new THREE.Shape();
boatPlan.moveTo(-17,-5.3);boatPlan.lineTo(10.2,-5.3);
boatPlan.quadraticCurveTo(18,-4.8,20,0);
boatPlan.quadraticCurveTo(18,4.8,10.2,5.3);
boatPlan.lineTo(-17,5.3);boatPlan.quadraticCurveTo(-20,0,-17,-5.3);
const boatGeometry=new THREE.ExtrudeGeometry(boatPlan,{depth:3.3,steps:1,bevelEnabled:true,bevelThickness:.6,bevelSize:.5,bevelSegments:2,curveSegments:5});
boatGeometry.rotateX(Math.PI/2);
const deckMaterial=new THREE.MeshStandardMaterial({color:0x555f66,metalness:.48,roughness:.49});
for(let i=0;i<6;i++){
  const x=-800+i*280,z=riverCenter(x),y=1.1;
  const hull=new THREE.Mesh(boatGeometry,deckMaterial);
  hull.position.set(x,y+1.9,z);scene.add(hull);
  box(x-2,y+3.7,z,23,.55,8.4,M.stone);
  box(x-2,y+6.4,z,20,4.4,7,M.glass);
  box(x-2,y+8.9,z,21,.65,8.6,M.stone);
  box(x+3,y+10,z,11,1.8,6,M.glass);
  for(let w=0;w<7;w++){
    const wx=x-11+w*3.1;
    box(wx,y+6.9,z+3.58,2.0,2.1,.12,M.window);
    box(wx,y+6.9,z-3.58,2.0,2.1,.12,M.window);
  }
  box(x-16,y+7,z,.4,5,.5,M.rail);
  ball(x-16,y+9.5,z,.43,M.gold);
}
const treeGeo=new THREE.ConeGeometry(1,2.7,6);
const trunkGeo=new THREE.CylinderGeometry(.22,.27,1,5);
const trees=new THREE.InstancedMesh(treeGeo,M.tree,380);
const stems=new THREE.InstancedMesh(trunkGeo,M.trunk,380);
let treeCount=0;
for(let i=0;i<380;i++){
  const x=(rand()-.5)*1900,z=(rand()-.5)*1300;
  if(riverDist(x,z)<5)continue;
  const y=ground(x,z);
  const s=2.5+rand()*3.2;
  dummy.rotation.set(0,0,0);dummy.position.set(x,y+s,z);dummy.scale.set(s,s*1.6,s);dummy.updateMatrix();
  trees.setMatrixAt(treeCount,dummy.matrix);
  dummy.position.set(x,y+1.5,z);dummy.scale.set(.8,3,.8);dummy.updateMatrix();
  stems.setMatrixAt(treeCount,dummy.matrix);treeCount++;
}
trees.count=stems.count=treeCount;trees.instanceMatrix.needsUpdate=true;stems.instanceMatrix.needsUpdate=true;
scene.add(trees,stems);

// Detailed foreground is isolated in one lightweight, heavily instanced module.
// Only the hero corridor receives close-up geometry; long-distance buildings remain simple.
const detailBuild = buildChongqingDetails({ THREE,scene,ground,riverCenter,rand,box,ball,sign,hotpot,obstacles,pbr });
// Place the two high-fidelity landmarks before the spatial collision index is built.
const landmarkBuild = buildChongqingLandmarks({ THREE,scene,ground,pbr,box,sign,obstacles });
// Build after the hero-zone shops and towers append their collision volumes.
const obstacleIndex=new SpatialObstacleIndex(obstacles);
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
  detailBuild.setQuality(qualityMode==='low'?'low':'normal');
  landmarkBuild.setQuality(qualityMode==='low'?'low':'normal');
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

// The pilot uses rounded anatomical proportions, tapered limbs and a small detailed helmet.
// All shapes are original game geometry, not an unlicensed third-party character mesh.
const avatar=new THREE.Group();scene.add(avatar);
const pilotMetal=new THREE.MeshStandardMaterial({color:0x8c979e,metalness:.82,roughness:.29});
const pilotLens=new THREE.MeshPhysicalMaterial({color:0x5e99b2,metalness:.55,roughness:.15,clearcoat:.75,clearcoatRoughness:.12,emissive:0x15394a,emissiveIntensity:.25});
const pilotDark=new THREE.MeshStandardMaterial({color:0x23282e,roughness:.73,metalness:.16});
const pilotJacket=new THREE.MeshStandardMaterial({color:0x505147,roughness:.93});
const pilotCloth=new THREE.MeshStandardMaterial({color:0x773f37,roughness:.91});
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
pilotMesh(new THREE.CylinderGeometry(.56,.40,1.43,18),pilotJacket,0,-.69,0);
pilotMesh(new THREE.CylinderGeometry(.39,.37,.43,16),M.pants,0,-1.51,0);
pilotMesh(new THREE.CylinderGeometry(.47,.47,.16,16),pilotDark,0,-1.34,0);
pilotMesh(new THREE.CylinderGeometry(.19,.22,.2,12),pilotSkin,0,.10,0);
pilotMesh(new THREE.SphereGeometry(.365,20,14),pilotSkin,0,.57,-.03);
const helmet=pilotMesh(new THREE.SphereGeometry(.415,22,16,0,Math.PI*2,0,Math.PI*.57),pilotDark,0,.67,0);
pilotMesh(new THREE.CylinderGeometry(.44,.43,.1,20),pilotMetal,0,.61,.03);
const gogglesStrap=pilotMesh(new THREE.CylinderGeometry(.384,.386,.13,20),pilotDark,0,.56,-.015);
for(const dir of [-1,1]){
  // Smoked anti-glare flight goggles have reflective curved lenses with metal retaining rings.
  const lens=pilotMesh(new THREE.SphereGeometry(.175,16,12),pilotLens,dir*.188,.58,-.353);
  lens.scale.set(1,.83,.33);
  const ring=pilotMesh(new THREE.TorusGeometry(.175,.028,7,20),pilotMetal,dir*.188,.58,-.407);
  ring.rotation.y=dir*.075;
  pilotMesh(new THREE.SphereGeometry(.12,10,8),pilotMetal,dir*.40,.57,-.02);
  // Shoulder-origin pivots produce a believable run animation.
  const armPivot=new THREE.Group();armPivot.position.set(dir*.60,-.20,0);avatar.add(armPivot);
  const upper=pilotMesh(new THREE.CapsuleGeometry(.20,.49,6,12),pilotJacket,dir*.04,-.43,.01,armPivot);
  upper.rotation.z=dir*.12;
  pilotMesh(new THREE.SphereGeometry(.19,12,10),pilotDark,dir*.08,-.90,-.015,armPivot);
  pilotLimbs.arms.push(armPivot);
  const legPivot=new THREE.Group();legPivot.position.set(dir*.255,-1.46,0);avatar.add(legPivot);
  pilotMesh(new THREE.CapsuleGeometry(.21,.60,7,12),M.pants,0,-.39,.018,legPivot);
  const boot=pilotMesh(new THREE.SphereGeometry(1,15,11),pilotBoot,0,-.97,-.13,legPivot);
  boot.scale.set(.265,.19,.39);
  pilotLimbs.legs.push(legPivot);pilotLimbs.boots.push(boot);
  // Sturdy backpack harness, front straps and back-side buckles.
  const strap=pilotMesh(new THREE.BoxGeometry(.11,1.55,.12),pilotMetal,dir*.38,-.66,-.43);
  strap.rotation.z=dir*.1;
}
const scarf=pilotMesh(new THREE.TorusGeometry(.38,.075,8,24),pilotCloth,0,.055,0);
scarf.rotation.x=Math.PI/2;
const flyingScarf=pilotMesh(new THREE.BoxGeometry(.90,.13,.22),pilotCloth,.61,.06,.26);
flyingScarf.rotation.z=-.12;
// More grounded metal jet unit: housing, exhaust collars and a small painted chili emblem.
pilotMesh(new THREE.BoxGeometry(.85,1.13,.34),pilotDark,0,-.66,.51);
pilotMesh(new THREE.BoxGeometry(.64,.83,.13),pilotMetal,0,-.61,.74);
for(const dir of [-1,1]){
  pilotMesh(new THREE.BoxGeometry(.20,.86,.29),pilotMetal,dir*.35,-.68,.64);
  const nozzle=pilotMesh(new THREE.CylinderGeometry(.12,.20,.30,14),pilotDark,dir*.21,-1.22,.75);
  nozzle.rotation.x=Math.PI/2;
  pilotMesh(new THREE.TorusGeometry(.17,.033,7,18),pilotMetal,dir*.21,-1.22,.89).rotation.x=0;
}
pilotMesh(new THREE.BoxGeometry(.25,.32,.07),pilotCloth,0,-.74,.84);
avatar.rotation.order='YXZ';

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
  if(Math.hypot(state.pos.x-hotpot.x,state.pos.z-hotpot.z)>48){
    message('走到重庆老火锅门口再按 E');return;
  }
  state.spicy=100;state.seenHotpot=true;
  document.getElementById('questHotpot').textContent='✓ 吃一次重庆火锅';
  document.getElementById('questHotpot').classList.add('done');
  message('🌶️ 火锅辣度爆表！屁股喷火推进已激活！',4);
}
function toggleFlight(){
  state.flying=!state.flying;state.onGround=false;
  if(state.flying)state.vel.y=Math.max(9,state.vel.y);
  message(state.flying?'飞行模式开启！Shift 加速，Space 上升，Ctrl 下降':'关闭飞行，准备降落');
}
// Optional viewpoint shortcuts let players visually inspect the distant landmarks
// without waiting for a long flyover; they do not alter the world or quest progress.
function scenicView(key){
  const destinations={
    Digit1:{name:'洪崖洞临江夜景',pos:[155,132,-72],target:[155,112,168]},
    Digit2:{name:'朝天门来福士与水晶连廊',pos:[-355,302,-50],target:[-355,294,176]},
    Digit3:{name:'李子坝轻轨穿楼',pos:[-121,112,-345],target:[-121,100,-254]},
    Digit4:{name:'重庆老火锅',pos:[285,ground(285,265)+2.7,265],target:[285,ground(285,225)+8,225]}
  };
  const next=destinations[key];
  if(!next)return false;
  state.pos.set(...next.pos);
  state.vel.set(0,0,0);
  state.flying=key!=='Digit4';
  state.onGround=key==='Digit4';
  state.boosting=false;
  jumpQueued=false;
  const dx=next.target[0]-state.pos.x,dz=next.target[2]-state.pos.z;
  viewYaw=Math.atan2(dx,-dz);
  viewPitch=.23;
  cameraPos.copy(state.pos).add(new THREE.Vector3(-Math.sin(viewYaw)*camDistance,7,Math.cos(viewYaw)*camDistance));
  message('观景镜头：'+next.name,3);
  return true;
}
function press(key,once=false){
  if(once&&key==='KeyE')eatHotpot();
  if(once&&key==='KeyF')toggleFlight();
  if(once&&key==='Space')jumpQueued=true;
  keys.add(key);
}
window.addEventListener('keydown',e=>{
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
  if(!e.repeat&&scenicView(e.code))return;
  if(!e.repeat&&e.code==='KeyH'){document.body.classList.toggle('cinematic');return;}
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
function move(dt){
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
  // Resolve axes separately so the pilot can slide along facades instead of sticking.
  if(!intersectsBuilding(nx,state.pos.y,pz))state.pos.x=nx;
  else state.vel.x=0;
  if(!intersectsBuilding(state.pos.x,state.pos.y,nz))state.pos.z=nz;
  else state.vel.z=0;
  // Distinguish walkable roofs from solid walls; the water surface is also walkable.
  const floor=obstacleIndex.landingSurface(state.pos.x,state.pos.z,py,state.pos.y,
    Math.max(ground(state.pos.x,state.pos.z),-2.0));
  if(state.pos.y<floor&&state.vel.y<=0){
    state.pos.y=floor;state.vel.y=0;state.onGround=true;
    if(state.flying){state.flying=false;message('安全降落');}
  }else if(state.pos.y>floor+.15)state.onGround=false;
  if(py>300&&state.vel.y>0)state.vel.y=0;
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
  flyingScarf.rotation.y=Math.sin(time*6.8)*.18-(state.boosting?.23:0);
  flyingScarf.rotation.x=Math.sin(time*5.1)*.12;
  flameLight.intensity+=((state.spicy>0&&(state.boosting||state.flying)?65:0)-flameLight.intensity)*Math.min(1,dt*8);
}
const visited={hong:false,bridge:false,raffles:false,liziba:false};
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
  hint.textContent=Math.hypot(state.pos.x-hotpot.x,state.pos.z-hotpot.z)<48
    ?'🍲 按 E 吃重庆火锅，激活麻辣喷火推进'
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
  move(dt);updateFlames(dt);updateCamera(dt);landmarkBuild.update(dt);
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
        '\nIndexed buildings '+obstacleIndex.obstacleCount;
    }
  }
}
window.PatrolSpaceBridge={getState:()=>({
  map:'chongqing',aircraft:'jetpack',playing:!graphicsLost,
  altitude:state.pos.y,climb:state.vel.y,
  position:state.pos.toArray(),heading:state.heading,avatarFlying:state.flying
})};
window.addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(renderRatio);
});
document.getElementById('loading').remove();
message('欢迎来到重庆！走近火锅店按 E 开吃',4);
clock.start();frame();