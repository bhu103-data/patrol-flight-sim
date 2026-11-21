// Chongqing Pilot — a self-contained PATROL map built with Three.js.
// Flight feel is informed by Petalwake (Jacob Miller, MIT), but this implementation is original.
// https://github.com/jjcm/petalwake — original license retained in docs/chongqing-credits.md.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

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
scene.background = new THREE.Color('#1b2745');
scene.fog = new THREE.FogExp2(0x26344d, 0.00066);

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
renderer.toneMappingExposure = 1.32;

const camera = new THREE.PerspectiveCamera(68, innerWidth/innerHeight, 0.15, 4000);
const hemi = new THREE.HemisphereLight(0x94b5ff, 0x5a3c30, 2.0);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0xffcb9b, 2.1);
moon.position.set(-280,520,-420);
scene.add(moon);
const glow = new THREE.PointLight(0xffa044, 145, 230, 2);
glow.position.set(160,105,125);
scene.add(glow);

function mat(color, roughness=0.85, emissive=0x000000, intensity=0) {
  return new THREE.MeshStandardMaterial({color,roughness,metalness:0.06,emissive,emissiveIntensity:intensity});
}
const M = {
  granite:mat('#526477'), stone:mat('#a6a9a5'), concrete:mat('#596273'),
  copper:mat('#946046',0.46), gold:mat('#ffc47a',0.35,0xcc7234,0.42),
  glass:mat('#2e5369',0.23,0x1a4058,0.35), beam:mat('#693a37'),
  roof:mat('#6d2930'), red:mat('#db503a',0.52,0x8c1e13,0.25),
  road:mat('#383e4a'), rail:mat('#9da9b2',0.35),
  window:new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide}),
  white:new THREE.MeshBasicMaterial({color:0xffd998}),
  dark:mat('#22263b'), skin:mat('#e1a97e'), coat:mat('#e4c18b'),
  scarf:mat('#c13c32'), pants:mat('#433a47'), boot:mat('#2e292c'),
  tree:mat('#314d4d'), trunk:mat('#4d3e34'),
  water:new THREE.MeshBasicMaterial({color:0x255675})
};
function box(x,y,z,w,h,d,material,parent=scene) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), material);
  mesh.position.set(x,y,z); parent.add(mesh); return mesh;
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
  const terraces=Math.round(d/72)*2.1;
  const relief=3.4*Math.sin(x/105)*Math.cos(z/150)+2.2*Math.sin(x/39+z/57);
  return Math.max(8, 9+d*0.172+terraces+relief);
}

const worldGeometry=new THREE.BufferGeometry();
const positions=[],colors=[],indexes=[];
const color=new THREE.Color();
const gx=128,gz=102;
for(let iz=0;iz<=gz;iz++){
  const z=-690+1380*iz/gz;
  for(let ix=0;ix<=gx;ix++){
    const x=-990+1980*ix/gx, y=ground(x,z);
    positions.push(x,y,z);
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
worldGeometry.computeVertexNormals();
scene.add(new THREE.Mesh(worldGeometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.96,side:THREE.DoubleSide})));

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
    'vec3 deep=vec3(.018,.12,.20), reflection=vec3(.24,.42,.60);',
    'vec3 rgb=mix(deep,reflection,clamp(.19+fresnel*.82+wave*.13,0.,1.));',
    'rgb+=vec3(.045,.023,.018)*pow(wave,7.);gl_FragColor=vec4(rgb,1.);}'
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
const towerMesh=new THREE.InstancedMesh(buildingBase,mat('#ffffff',0.77),360);
towerMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
const windowMesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),M.window,17000);
windowMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
const dummy=new THREE.Object3D(), tempColor=new THREE.Color();
const obstacles=[];
let towerCount=0,windowCount=0;
const hues=['#4c5a66','#657b83','#4a4c60','#776c70','#54606c','#8b8581','#46566a'];
function tower(x,z,w,d,h,k) {
  const base=ground(x,z);
  dummy.position.set(x,base+h/2,z);dummy.rotation.set(0,0,0);dummy.scale.set(w,h,d);
  dummy.updateMatrix();towerMesh.setMatrixAt(towerCount,dummy.matrix);
  towerMesh.setColorAt(towerCount,new THREE.Color(hues[k%hues.length]));
  towerCount++;
  obstacles.push({x,z,w:w+2,d:d+2,top:base+h});
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
for(let i=0;i<360;i++){
  const x=(rand()-.5)*1770,z=(rand()-.5)*1190;
  if(riverDist(x,z)<26)continue;
  if(Math.hypot(x-285,z-225)<100)continue;
  if(Math.hypot(x-160,z-150)<165)continue;
  const w=17+rand()*25,d=17+rand()*30;
  const downtown=x>-190&&x<560;
  const h=(downtown?55:23)+rand()*(downtown?145:70);
  tower(x,z,w,d,h,i);
}
towerMesh.count=towerCount;windowMesh.count=windowCount;
towerMesh.instanceMatrix.needsUpdate=true;windowMesh.instanceMatrix.needsUpdate=true;
if(towerMesh.instanceColor)towerMesh.instanceColor.needsUpdate=true;
if(windowMesh.instanceColor)windowMesh.instanceColor.needsUpdate=true;
scene.add(towerMesh,windowMesh);

// Roads are swept strips following terraces, not an infinite grid.
function road(points,width,material=M.road){
  const verts=[],ind=[];
  for(let i=0;i<points.length;i++){
    const p=points[i],prev=points[Math.max(0,i-1)],next=points[Math.min(points.length-1,i+1)];
    const dx=next.x-prev.x,dz=next.z-prev.z,inv=1/(Math.hypot(dx,dz)||1);
    const ax=-dz*inv*width/2,az=dx*inv*width/2;
    verts.push(p.x-ax,p.y,p.z-az,p.x+ax,p.y,p.z+az);
    if(i<points.length-1){const j=i*2;ind.push(j,j+1,j+2,j+1,j+3,j+2);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  g.setIndex(ind);g.computeVertexNormals();
  const o=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:material.color,side:THREE.DoubleSide,roughness:0.9}));
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
  for(const z of [-83,83]){
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
bridge(-230,0);bridge(470,1);

// Warm, stacked Hongyadong-style architecture. An intentionally compressed artistic reconstruction.
const hong=new THREE.Group();scene.add(hong);
for(let level=0;level<9;level++){
  const z=112+level*10, y=13+level*11;
  const w=128-level*4;
  box(155,y+5.1,z,w,9.5,23,M.beam,hong);
  box(155,y+5.3,z+12.0,w*.93,7.4,1.0,M.gold,hong);
  for(let col=0;col<11;col++){
    const cx=155-w/2+7+(col+.5)*(w-14)/11;
    box(cx,y+5.4,z+12.65,2.7,5.7,.5,col%3===0?M.red:M.gold,hong);
  }
  box(155,y+10.5,z,w+12,2.6,31,M.roof,hong);
  box(155,y+11.5,z+15,w+16,1.15,2,M.gold,hong);
  for(const x of [155-w/2+6,155+w/2-6]){
    box(x,y+2.5,z+9,2,21,2,M.copper,hong);
    ball(x,y+2,z+14,2.4,M.red,hong);
  }
}
for(let n=0;n<10;n++){
  const z=88+n*3.1;
  box(155,8+n*1.5,z,110,3,3,M.stone,hong);
}

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
sign('洪崖洞',155,116,224,52,14);
sign('千厮门大桥',-230,82,40,40,10);
sign('解放碑',-153,130,275,38,11);

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
box(jiefang.x,jy+55,jiefang.z,15,3,15,M.roof);
const railPoints=[];
for(let i=0;i<=65;i++){
  const x=-850+i*27,z=-235+35*Math.sin(x/210);
  railPoints.push(new THREE.Vector3(x,ground(x,z)+28,z));
  if(i%5===0)box(x,(ground(x,z)+28)/2,z,4,ground(x,z)+28,4,M.stone);
}
road(railPoints,9,M.rail);
for(let i=0;i<3;i++){
  const p=railPoints[27+i];
  box(p.x,p.y+5,p.z,22,9,7,i===0?M.red:M.gold);
  box(p.x,p.y+6,p.z-3.9,17,3,.5,M.glass);
}
// Cable car, a characteristic river crossing.
const cableA=new THREE.Vector3(-510,130,240),cableB=new THREE.Vector3(-365,121,-240);
cylinderBetween(cableA,cableB,.35,M.dark,5);
for(let i=1;i<=3;i++){
  const p=cableA.clone().lerp(cableB,i/4);
  box(p.x,p.y-10,p.z,13,11,10,M.red);
  box(p.x,p.y-9,p.z+5.1,10,5,.4,M.glass);
  cylinderBetween(p,new THREE.Vector3(p.x,p.y-4,p.z),.4,M.rail);
}

// Small river boats, riverside lights and street trees.
for(let i=0;i<6;i++){
  const x=-800+i*280,z=riverCenter(x),y=0.6;
  box(x,y,z,27,4.5,12,M.stone);
  box(x,y+4.2,z,18,6.8,9,M.glass);
  box(x,y+8.6,z,14,1.2,10,M.gold);
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

// Stars are sparse to keep the city's orange glow dominant.
const stars=[];
for(let i=0;i<380;i++){
  const r=1400+rand()*1000,a=rand()*TAU,el=rand()*1.25+.2;
  stars.push(Math.cos(a)*Math.cos(el)*r,Math.sin(el)*r,Math.sin(a)*Math.cos(el)*r);
}
const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.Float32BufferAttribute(stars,3));
scene.add(new THREE.Points(starGeo,new THREE.PointsMaterial({color:0xc5dafa,size:2.4,sizeAttenuation:false})));

const avatar=new THREE.Group();scene.add(avatar);
box(0,-.85,0,1.25,1.65,.9,M.coat,avatar);
ball(0,.53,0,.72,M.skin,avatar);
ball(0,.88,-.12,.74,M.pants,avatar);
box(0,-.12,.65,1.25,1.5,.48,M.copper,avatar);
box(0,.18,-.7,.75,.2,.18,M.glass,avatar);
for(const dir of [-1,1]){
  box(.86*dir,-.58,0,.43,1.3,.44,M.coat,avatar);
  box(.37*dir,-1.9,0,.52,1.1,.55,M.pants,avatar);
  box(.37*dir,-2.48,-.19,.64,.4,1.0,M.boot,avatar);
  ball(.34*dir,.57,-.57,.22,M.glass,avatar);
}
const scarf=box(0,.17,.60,1.1,.25,.65,M.scarf,avatar);
avatar.rotation.order='YXZ';

const state={
  pos:new THREE.Vector3(285,ground(285,240)+2.7,240),
  vel:new THREE.Vector3(),heading:0,flying:false,onGround:true,
  spicy:0,boosting:false,jumpCount:0,seenHong:false,seenBridge:false,seenHotpot:false
};
const keys=new Set();
let viewYaw=0,viewPitch=.25,camDistance=14,dragging=false,mouseX=0,mouseY=0,toastUntil=0;
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
function press(key,once=false){
  if(once&&key==='KeyE')eatHotpot();
  if(once&&key==='KeyF')toggleFlight();
  keys.add(key);
}
window.addEventListener('keydown',e=>{
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
  if(!e.repeat)press(e.code,true);
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>keys.clear());
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
scene.add(fire);
let particleCursor=0,emitAccumulator=0;
function spawnFlame(){
  const p=particles[particleCursor++%particles.length];
  p.life=.35+rand()*.47;p.age=0;p.size=.5+rand()*1.5;
  const backward=new THREE.Vector3(-Math.sin(state.heading),0,Math.cos(state.heading));
  p.p.copy(state.pos).addScaledVector(backward,.8).add(new THREE.Vector3((rand()-.5)*.45,-1.2,(rand()-.5)*.45));
  p.v.copy(backward).multiplyScalar(10+rand()*17);
  p.v.y=-7+rand()*6;
}
function updateFlames(dt){
  if(state.spicy>0&&(state.flying||state.boosting)){
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
  for(const b of obstacles){
    if(y<b.top+1&&Math.abs(x-b.x)<b.w/2+1&&Math.abs(z-b.z)<b.d/2+1)return true;
  }
  return false;
}
function move(dt){
  const forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0);
  const sideways=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);
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
    if(keys.has('Space')&&state.onGround){
      state.vel.y=24;state.onGround=false;state.jumpCount++;
    }
    state.vel.y-=29*dt;
    if(state.spicy>0)state.spicy=Math.max(0,state.spicy-dt*.35);
  }
  const px=state.pos.x,pz=state.pos.z,py=state.pos.y;
  state.pos.addScaledVector(state.vel,dt);
  state.pos.x=clamp(state.pos.x,-935,935);state.pos.z=clamp(state.pos.z,-635,635);
  state.pos.y=clamp(state.pos.y,-1.0,310);
  if(intersectsBuilding(state.pos.x,state.pos.y,state.pos.z)){
    state.pos.x=px;state.pos.z=pz;state.vel.x*=.15;state.vel.z*=.15;
  }
  const floor=ground(state.pos.x,state.pos.z)+2.35;
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
}
const visited={hong:false,bridge:false};
function updateQuest(){
  if(!visited.hong&&Math.hypot(state.pos.x-155,state.pos.z-145)<140&&state.pos.y>45){
    visited.hong=true;const el=document.getElementById('questHong');
    el.textContent='✓ 飞过洪崖洞';el.classList.add('done');message('发现地标：洪崖洞！');
  }
  if(!visited.bridge&&([-230,470].some(x=>Math.abs(state.pos.x-x)<45))&&Math.abs(state.pos.z)<130&&state.pos.y>35){
    visited.bridge=true;const el=document.getElementById('questBridge');
    el.textContent='✓ 飞过跨江大桥';el.classList.add('done');message('飞越两江大桥！');
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
  for(const [x,z,label] of [[155,145,'洪'],[-230,0,'桥'],[470,0,'桥'],[hotpot.x,hotpot.z,'锅']]){
    const px=128+(x-state.pos.x)*.17,py=128+(z-state.pos.z)*.17;
    mapCtx.fillStyle='#ffd28b';mapCtx.beginPath();mapCtx.arc(px,py,10,0,TAU);mapCtx.fill();
    mapCtx.fillStyle='#30251d';mapCtx.font='bold 13px sans-serif';mapCtx.textAlign='center';mapCtx.textBaseline='middle';mapCtx.fillText(label,px,py);
  }
  mapCtx.translate(128,128);mapCtx.rotate(state.heading);
  mapCtx.fillStyle='#ff5e39';mapCtx.beginPath();mapCtx.moveTo(0,-14);mapCtx.lineTo(-9,11);mapCtx.lineTo(9,11);mapCtx.closePath();mapCtx.fill();
  mapCtx.restore();
}
const cameraPos=new THREE.Vector3(285,95,265);
function updateCamera(dt){
  const speed=Math.hypot(state.vel.x,state.vel.z);
  const distance=camDistance*(1+clamp((speed-28)/160,0,.35));
  const cp=Math.cos(viewPitch),sp=Math.sin(viewPitch);
  const desired=new THREE.Vector3(
    state.pos.x-Math.sin(viewYaw)*cp*distance,
    state.pos.y+4.7+sp*distance,
    state.pos.z+Math.cos(viewYaw)*cp*distance
  );
  cameraPos.lerp(desired,1-Math.exp(-dt*4.1));
  camera.position.copy(cameraPos);
  cameraAim.set(state.pos.x,state.pos.y+1.0,state.pos.z);
  camera.lookAt(cameraAim);
  const desiredFov=68+clamp((speed-26)*.24,0,15);
  camera.fov+=(desiredFov-camera.fov)*(1-Math.exp(-dt*2.5));
  camera.updateProjectionMatrix();
}
let time=0,mapTimer=0;
function frame(){
  requestAnimationFrame(frame);
  const dt=Math.min(clock.getDelta(),.04);
  time+=dt;waterUniforms.uTime.value=time;
  move(dt);updateFlames(dt);updateCamera(dt);
  if((mapTimer+=dt)>.09){drawMinimap();updateQuest();mapTimer=0;}
  if(toastUntil&&clock.getElapsedTime()>toastUntil){toastEl.style.opacity='0';toastUntil=0;}
  renderer.render(scene,camera);
}
window.addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
});
document.getElementById('loading').remove();
message('欢迎来到重庆！走近火锅店按 E 开吃',4);
clock.start();frame();