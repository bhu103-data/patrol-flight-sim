/*
 * PATROL Cosmos / MIT-compatible adaptation.
 * Scale-ladder, orbit compression, and logarithmic four-arm galaxy design
 * adapted from oxomkbk/earth-migration (MIT, Copyright (c) 2026 玛卡巴卡).
 * Planet maps: Solar System Scope (CC BY 4.0). See COSMOS_CREDITS.md.
 * Coordinates and sizes below are VISUAL scales, not real astronomical distances.
 */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const canvas = document.getElementById('universe');
const selector = document.getElementById('destination');
const telemetry = document.getElementById('flightInfo');
const originEl = document.getElementById('originLabel');
const back = document.getElementById('back');
const loading = document.getElementById('loading');
const timeScale = document.getElementById('timeScale');
const timeLabel = document.getElementById('timeLabel');
const validMaps = ['manhattan','dc','vegas','alaska','coast','valley','chongqing'];
const query = new URLSearchParams(location.search);
const requestedMap = query.get('from');
const from = validMaps.includes(requestedMap) ? requestedMap : 'manhattan';
const craftName = ['fighter','saucer','jetpack'].includes(query.get('craft')) ? query.get('craft') : 'fighter';
const cityOrigin = {
  manhattan: {name:'Manhattan / New York',lat:40.7128,lon:-74.006},
  dc: {name:'Washington, DC',lat:38.8895,lon:-77.0353},
  vegas: {name:'Las Vegas',lat:36.1699,lon:-115.1398},
  alaska: {name:'Alaska Fjords',lat:58.3,lon:-135.1},
  coast: {name:'Copper Coast · fictional',lat:0,lon:0},
  valley: {name:'Alder River Valley · fictional',lat:0,lon:0},
  chongqing: {name:'Chongqing, China',lat:29.563,lon:106.5516}
};
const source = cityOrigin[from];
originEl.textContent = source.name + ' → EARTH ORBIT / 地球轨道';
back.href = from === 'chongqing'
  ? './chongqing.html'
  : './index.html?returnSpace=' + encodeURIComponent(from) + '&craft=' + encodeURIComponent(craftName);
back.textContent = '↩ 返回 ' + source.name;
const clamp = THREE.MathUtils.clamp;
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = rng(1958);
function gaussian() {
  return Math.sqrt(-2 * Math.log(Math.max(1e-7, random()))) * Math.cos(2 * Math.PI * random());
}
const low = matchMedia('(max-width: 780px), (pointer: coarse)').matches;
let renderer;
try {
  renderer = new THREE.WebGLRenderer({canvas,antialias:!low,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1,low ? 1.15 : 1.65));
  renderer.setSize(innerWidth,innerHeight,false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
} catch (error) {
  loading.querySelector('p').textContent = 'WebGL graphics unavailable. Enable graphics acceleration and reload.';
  throw error;
}
const solar = new THREE.Scene();
const galaxy = new THREE.Scene();
solar.background = new THREE.Color(0x01030b);
galaxy.background = new THREE.Color(0x01030b);
const cameraSolar = new THREE.PerspectiveCamera(62,innerWidth/innerHeight,0.025,1400);
const cameraGalaxy = new THREE.PerspectiveCamera(60,innerWidth/innerHeight,0.1,3000);
solar.add(new THREE.AmbientLight(0x5a7aa9,0.65));
solar.add(new THREE.HemisphereLight(0x628fdf,0x100e16,0.28));
const light = new THREE.PointLight(0xfff0cd,1100,220,1.2);
light.position.set(0,0,0);
solar.add(light);

// A real sky panorama is loaded independently of close stars; low quality
// keeps fewer point sprites but never removes the galactic layer.
const remote = 'https://raw.githubusercontent.com/oxomkbk/earth-migration/main/assets/';
const loader = new THREE.TextureLoader();
loader.setCrossOrigin('anonymous');
function texture(path,material,property='map') {
  loader.load(remote + path, t => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(),4);
    material[property] = t;
    if (property === 'map' && material.color) material.color.set(0xffffff);
    material.needsUpdate = true;
  }, undefined, () => { /* Keep a procedural/colored fallback if offline. */ });
}
function starSphere(scene,count,radius,seed=37) {
  const r = rng(seed);
  const positions = new Float32Array(count*3);
  const colors = new Float32Array(count*3);
  const palette = [new THREE.Color(0xc8d7ff),new THREE.Color(0xf9e5cc),new THREE.Color(0x8baefa),new THREE.Color(0xffffff)];
  for(let i=0;i<count;i++) {
    const y = 2*r()-1, a = r()*Math.PI*2;
    const rr = Math.sqrt(Math.max(0,1-y*y));
    positions.set([rr*Math.cos(a)*radius,y*radius,rr*Math.sin(a)*radius],i*3);
    const c = palette[Math.floor(r()*palette.length)].clone().multiplyScalar(0.4+0.6*Math.pow(r(),2));
    colors.set(c.toArray(),i*3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  const points = new THREE.Points(geometry,new THREE.PointsMaterial({
    size:low?1.15:1.6,sizeAttenuation:false,vertexColors:true,
    transparent:true,opacity:0.9,depthWrite:false
  }));
  scene.add(points);
  return points;
}
const proceduralSolarStars=starSphere(solar,low?2000:4500,620);
starSphere(galaxy,low?1800:3400,910,92);
// NASA SVS Deep Star Maps 2020 / Hipparcos-Tycho derived star field.
// Reuse the equatorial-to-ecliptic rotation and image sampling model of
// earth-migration (MIT); simple SphereGeometry.map UVs would mirror the atlas.
function equatorialDirection(ra,dec){
  const lon=(((0.5-ra/360)%1)+1)%1*Math.PI*2;
  const lat=THREE.MathUtils.degToRad(dec);
  return new THREE.Vector3(Math.cos(lat)*Math.cos(lon),Math.sin(lat),Math.cos(lat)*Math.sin(lon));
}
const equinox=equatorialDirection(0,0);
const pole=equatorialDirection(270,66.5607);
pole.addScaledVector(equinox,-pole.dot(equinox)).normalize();
const basis=new THREE.Matrix4().makeBasis(
  equinox,pole,new THREE.Vector3().crossVectors(equinox,pole));
const EQ2W=basis.clone().transpose();
const W2EQ=new THREE.Matrix3().setFromMatrix4(EQ2W).transpose();
const nightMat=new THREE.ShaderMaterial({
  uniforms:{uMap:{value:null},uInv:{value:W2EQ},uGain:{value:0.23}},
  side:THREE.BackSide,depthWrite:false,depthTest:false,
  vertexShader:`varying vec3 vDir;
    void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`uniform sampler2D uMap;uniform mat3 uInv;uniform float uGain;
    varying vec3 vDir;
    void main(){
      vec3 d=normalize(uInv*normalize(vDir));
      vec2 uv=vec2(fract(atan(d.z,d.x)/6.283185307),
        asin(clamp(d.y,-1.0,1.0))/3.141592654+0.5);
      vec3 imageColor=texture2D(uMap,uv).rgb;
      gl_FragColor=vec4(max(imageColor-vec3(0.012),vec3(0.0))*uGain,1.0);
    }`
});
const nightSky=new THREE.Mesh(
  new THREE.SphereGeometry(590,low?32:64,low?18:32),nightMat);
nightSky.frustumCulled=false;
nightSky.renderOrder=-1000;
nightSky.visible=false;
solar.add(nightSky);
loader.load(remote+'sky/milkyway_4k.jpg',t=>{
  t.colorSpace=THREE.SRGBColorSpace;
  t.generateMipmaps=false;
  t.minFilter=THREE.LinearFilter;
  nightMat.uniforms.uMap.value=t;
  nightSky.visible=true;
},undefined,()=>{/* Keep the generated star field if panorama is unavailable. */});

// The upstream binary contains 6 Float32 values per star: equatorial
// unit direction XYZ and linear RGB flux; approximately 42,000 stars.
// Decode as a compact GPU point cloud instead of thousands of Mesh objects.
let catalogStarCount=0;
fetch(remote+'sky/stars.bin',{mode:'cors',cache:'force-cache'})
  .then(response=>{
    if(!response.ok)throw new Error('Star catalog HTTP '+response.status);
    return response.arrayBuffer();
  })
  .then(buffer=>{
    if(buffer.byteLength<24 || buffer.byteLength%24!==0)throw new Error('Unexpected star catalog format');
    const stars=new Float32Array(buffer);
    const n=Math.min(stars.length/6,60000);
    let brightest=1e-10;
    for(let i=0;i<n;i++){
      const j=i*6;
      brightest=Math.max(brightest,stars[j+3]+stars[j+4]+stars[j+5]);
    }
    const positions=new Float32Array(n*3),photometry=new Float32Array(n*4);
    const direction=new THREE.Vector3();
    for(let i=0;i<n;i++){
      const j=i*6,r=Math.max(0,stars[j+3]),g=Math.max(0,stars[j+4]),b=Math.max(0,stars[j+5]);
      const flux=Math.max(r+g+b,1e-10);
      direction.set(stars[j],stars[j+1],-stars[j+2]).applyMatrix4(EQ2W).normalize();
      positions.set([direction.x*560,direction.y*560,direction.z*560],i*3);
      const channel=Math.max(r,g,b,1e-8);
      photometry.set([
        r/channel,g/channel,b/channel,
        clamp(Math.pow(flux/brightest,0.22),0.03,1)
      ],i*4);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    geometry.setAttribute('aColorFlux',new THREE.BufferAttribute(photometry,4));
    const material=new THREE.ShaderMaterial({
      uniforms:{uPxR:{value:renderer.getPixelRatio()}},
      transparent:true,depthWrite:false,depthTest:true,
      blending:THREE.AdditiveBlending,
      vertexShader:`attribute vec4 aColorFlux;uniform float uPxR;
        varying vec3 vColor;
        void main(){
          vec4 point=modelViewMatrix*vec4(position,1.0);
          gl_Position=projectionMatrix*point;
          float brightness=aColorFlux.w;
          gl_PointSize=(1.0+4.4*pow(brightness,1.05))*uPxR;
          vColor=aColorFlux.rgb*(0.12+1.12*brightness);
        }`,
      fragmentShader:`varying vec3 vColor;
        void main(){
          vec2 uv=gl_PointCoord*2.0-1.0;
          float d2=dot(uv,uv);
          if(d2>1.0)discard;
          float sparkle=exp(-d2*9.0)+0.12*exp(-d2*2.0);
          gl_FragColor=vec4(vColor*sparkle,1.0);
        }`
    });
    const points=new THREE.Points(geometry,material);
    points.frustumCulled=false;
    points.renderOrder=-900;
    solar.add(points);
    proceduralSolarStars.visible=false;
    catalogStarCount=n;
  })
  .catch(error=>{console.warn('Star catalog fallback:',error.message);});


const sourceSphere = new THREE.Group();
const sunMat = new THREE.MeshBasicMaterial({color:0xffca70});
const sun = new THREE.Mesh(new THREE.SphereGeometry(3.4,low?32:64,low?18:40),sunMat);
sourceSphere.add(sun);
solar.add(sourceSphere);
texture('planets/sun_2k.jpg',sunMat);
const sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({
  map: glowTexture(),color:0xffbf73,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false
}));
sunHalo.scale.set(14,14,1);
solar.add(sunHalo);

function glowTexture() {
  const c=document.createElement('canvas');
  c.width=c.height=128;
  const ctx=c.getContext('2d');
  const g=ctx.createRadialGradient(64,64,2,64,64,63);
  g.addColorStop(0,'rgba(255,255,255,1)');
  g.addColorStop(.12,'rgba(255,238,206,.86)');
  g.addColorStop(.38,'rgba(255,181,116,.22)');
  g.addColorStop(1,'rgba(255,130,80,0)');
  ctx.fillStyle=g;ctx.fillRect(0,0,128,128);
  return new THREE.CanvasTexture(c);
}
const glowMap = glowTexture();
const records = [
  {id:'mercury',name:'Mercury',radius:.35,orbit:5.0,period:88,phase:2.9,color:0xa9a9a6,tex:'mercury_2k.jpg'},
  {id:'venus',name:'Venus',radius:.79,orbit:6.8,period:225,phase:1.6,color:0xe7b779,tex:'venus_atmosphere_2k.jpg'},
  {id:'earth',name:'Earth',radius:1.0,orbit:9.2,period:365,phase:0.3,color:0x246bbd,tex:'earth_day_4k.jpg'},
  {id:'mars',name:'Mars',radius:.57,orbit:12.0,period:687,phase:4.1,color:0xc16e40,tex:'mars_2k.jpg'},
  {id:'jupiter',name:'Jupiter',radius:2.10,orbit:19.0,period:4333,phase:3.0,color:0xcba37d,tex:'jupiter_4k.jpg'},
  {id:'saturn',name:'Saturn',radius:1.75,orbit:25.1,period:10759,phase:5.3,color:0xd9c395,tex:'saturn_2k.jpg'},
  {id:'uranus',name:'Uranus',radius:1.19,orbit:30.2,period:30688,phase:2.2,color:0x91d6dd,tex:'uranus_2k.jpg'},
  {id:'neptune',name:'Neptune',radius:1.14,orbit:34.6,period:60182,phase:4.7,color:0x416ed2,tex:'neptune_2k.jpg'},
  {id:'pluto',name:'Pluto',radius:.25,orbit:38.0,period:90560,phase:3.0,color:0xb3a495,tex:'pluto_2k.jpg'}
];
const bodies=new Map();
const loadedPlanetTextures=new Set();
function loadPlanetTexture(spec) {
  if(loadedPlanetTextures.has(spec.id))return;
  loadedPlanetTextures.add(spec.id);
  const body=bodies.get(spec.id);
  if(body)texture('planets/'+spec.tex,body.mesh.material);
}
for (const spec of records) {
  const material=new THREE.MeshStandardMaterial({
    color:spec.color,roughness:1,metalness:0
  });
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(spec.radius,low?24:48,low?16:32),material);
  mesh.position.set(Math.cos(spec.phase)*spec.orbit,0,Math.sin(spec.phase)*spec.orbit);
  mesh.rotation.y=spec.phase;
  solar.add(mesh);
  bodies.set(spec.id,{...spec,mesh});
  if (!low || ['earth','mars','jupiter','saturn'].includes(spec.id)) loadPlanetTexture(spec);
  // Precompute line geometry and share very cheap solar system guides.
  const line = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(Array.from({length:128},(_,i)=>{
      const a=i*2*Math.PI/128;return new THREE.Vector3(Math.cos(a)*spec.orbit,0,Math.sin(a)*spec.orbit);
    })),
    new THREE.LineBasicMaterial({color:0x5783a8,transparent:true,opacity:0.20,depthWrite:false})
  );
  solar.add(line);
}
const earth=bodies.get('earth').mesh;
const cloudMat = new THREE.MeshStandardMaterial({
  color:0xffffff,roughness:1,transparent:true,opacity:0.21,depthWrite:false
});
const clouds = new THREE.Mesh(new THREE.SphereGeometry(1.015,40,30),cloudMat);
earth.add(clouds);
texture('planets/earth_clouds_4k.jpg',cloudMat);
const atm = new THREE.Mesh(
  new THREE.SphereGeometry(1.075,48,32),
  new THREE.ShaderMaterial({
    uniforms:{uColor:{value:new THREE.Color(0x4f9aff)}},
    transparent:true,depthWrite:false,side:THREE.BackSide,blending:THREE.AdditiveBlending,
    vertexShader:'varying vec3 vNormal;varying vec3 vPos;void main(){vNormal=normalize(mat3(modelMatrix)*normal);vPos=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vPos,1.);}',
    fragmentShader:'uniform vec3 uColor;varying vec3 vNormal;varying vec3 vPos;void main(){vec3 look=normalize(cameraPosition-vPos);float f=pow(max(0.,1.-abs(dot(normalize(vNormal),look))),3.0);gl_FragColor=vec4(uColor*f*1.2,f*0.7);}'
  })
);
earth.add(atm);
// NASA-derived nighttime illumination, visible only away from the solar light.
const earthLightsMat=new THREE.ShaderMaterial({
  uniforms:{uNight:{value:null},uSun:{value:new THREE.Vector3(1,0,0)}},
  transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,
  vertexShader:`varying vec2 vUv;varying vec3 vNormal;
    void main(){vUv=uv;vNormal=normalize(mat3(modelMatrix)*normal);
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`uniform sampler2D uNight;uniform vec3 uSun;varying vec2 vUv;varying vec3 vNormal;
    void main(){
      float dark=1.0-smoothstep(-0.13,0.15,dot(normalize(vNormal),normalize(uSun)));
      gl_FragColor=vec4(texture2D(uNight,vUv).rgb*dark*1.7,dark);
    }`
});
const earthLights=new THREE.Mesh(new THREE.SphereGeometry(1.006,48,32),earthLightsMat);
earthLights.visible=false;
earth.add(earthLights);
loader.load(remote+'earth/earth_lights_2048.png',t=>{
  t.colorSpace=THREE.SRGBColorSpace;
  earthLightsMat.uniforms.uNight.value=t;
  earthLights.visible=true;
},undefined,()=>{/* The daytime Earth works offline. */});
const moonMat=new THREE.MeshStandardMaterial({color:0xa5a9b2,roughness:1});
const moon=new THREE.Mesh(new THREE.SphereGeometry(.275,32,22),moonMat);
solar.add(moon);
texture('planets/moon_2k.jpg',moonMat);

// Show which real-world map launched this flight. The fictional map markers
// are intentionally omitted rather than assigning invented coordinates.
if(!['coast','valley'].includes(from)) {
  const marker=new THREE.Group();
  const phi=source.lat*Math.PI/180,lam=source.lon*Math.PI/180;
  marker.position.set(-Math.cos(phi)*Math.sin(lam),Math.sin(phi),Math.cos(phi)*Math.cos(lam));
  const pin = new THREE.Mesh(new THREE.SphereGeometry(.036,12,8),
    new THREE.MeshBasicMaterial({color:0xffc35c}));
  marker.add(pin);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.06,.009,6,24),
    new THREE.MeshBasicMaterial({color:0xffe6aa}));
  ring.position.z=.018;
  marker.add(ring);
  earth.add(marker);
}

const saturn=bodies.get('saturn').mesh;
const rings=new THREE.Mesh(
  new THREE.RingGeometry(2.12,3.65,120),
  new THREE.MeshBasicMaterial({map:ringTexture(),transparent:true,opacity:.86,
    side:THREE.DoubleSide,depthWrite:false,color:0xf4ddbb})
);
// Map U to the actual ring radius so Cassini-like bands form concentric rings.
const ringPositions=rings.geometry.attributes.position;
const ringUvs=rings.geometry.attributes.uv;
for(let i=0;i<ringPositions.count;i++) {
  const radius=Math.hypot(ringPositions.getX(i),ringPositions.getY(i));
  ringUvs.setXY(i,clamp((radius-2.12)/(3.65-2.12),0,1),0.5);
}
ringUvs.needsUpdate=true;
rings.rotation.x=-Math.PI/2.45;
saturn.add(rings);
function ringTexture(){
  const c=document.createElement('canvas');c.width=512;c.height=4;
  const ctx=c.getContext('2d'),g=ctx.createLinearGradient(0,0,512,0);
  g.addColorStop(0,'rgba(80,70,56,0)');g.addColorStop(.11,'rgba(204,187,151,.46)');
  g.addColorStop(.20,'rgba(239,223,187,.85)');g.addColorStop(.45,'rgba(106,95,81,.60)');
  g.addColorStop(.54,'rgba(30,30,33,.10)');g.addColorStop(.66,'rgba(203,185,153,.82)');
  g.addColorStop(.84,'rgba(215,193,164,.67)');g.addColorStop(1,'rgba(175,163,147,0)');
  ctx.fillStyle=g;ctx.fillRect(0,0,512,4);
  const t=new THREE.CanvasTexture(c);
  t.wrapS=THREE.ClampToEdgeWrapping;return t;
}

// Small ship identifies the vehicle brought in from the originating map.
// It is deliberately compact, with no city material duplication in space.
const ship=new THREE.Group();
const hullMat=new THREE.MeshStandardMaterial({color:craftName==='jetpack'?0xbe2630:0xa6b8c6,metalness:.72,roughness:.27});
const trimMat=new THREE.MeshStandardMaterial({color:0xf9c273,metalness:.5,roughness:.35});
const thrusterMat=new THREE.MeshBasicMaterial({color:0x66dbff});
if(craftName==='saucer'){
  const disk=new THREE.Mesh(new THREE.CylinderGeometry(.29,.29,.07,32),hullMat);ship.add(disk);
  const cap=new THREE.Mesh(new THREE.SphereGeometry(.13,20,12),trimMat);cap.position.y=.045;ship.add(cap);
}else if(craftName==='jetpack'){
  const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.09,.20,3,10),hullMat);ship.add(torso);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.075,12,10),trimMat);head.position.y=.23;ship.add(head);
  for(const x of [-.12,.12]){
    const leg=new THREE.Mesh(new THREE.BoxGeometry(.065,.22,.07),hullMat);leg.position.set(x/1.5,-.29,0);ship.add(leg);
    const exhaust=new THREE.Mesh(new THREE.SphereGeometry(.052,10,7),thrusterMat);
    exhaust.position.set(x,-.12,.1);ship.add(exhaust);
  }
}else{
  const fuselage=new THREE.Mesh(new THREE.ConeGeometry(.085,.5,5),hullMat);
  fuselage.rotation.x=Math.PI/2;ship.add(fuselage);
  const wings=new THREE.Mesh(new THREE.BoxGeometry(.6,.018,.14),hullMat);wings.position.z=-.04;ship.add(wings);
  const canopy=new THREE.Mesh(new THREE.SphereGeometry(.08,12,8),trimMat);canopy.scale.set(.65,.5,1.2);canopy.position.set(0,.06,.08);ship.add(canopy);
  const exhaust=new THREE.Mesh(new THREE.SphereGeometry(.045,10,7),thrusterMat);exhaust.position.z=.24;ship.add(exhaust);
}
solar.add(ship);

// L2: Four logarithmic arms and a bright central bulge. The Earth-Migration
// source uses a 15° pitch and R0=22500 ly; normalize that formula to kly.
const galaxyStars = low?7600:18000;
const armsPos = new Float32Array(galaxyStars*3);
const armsCol = new Float32Array(galaxyStars*3);
const armPitch=Math.tan(15*Math.PI/180);
const armPalette=[new THREE.Color(0x9cbdff),new THREE.Color(0xfde4c9),new THREE.Color(0x7ca9ff),new THREE.Color(0xffd5a6)];
for(let i=0;i<galaxyStars;i++){
  const arm=i%4;
  const r=3+Math.pow(random(),.8)*118;
  const theta=arm*Math.PI/2-Math.log(Math.max(r,1)/22.5)/armPitch+gaussian()*.17;
  const spread=(.35+r*.028)*gaussian();
  const x=Math.cos(theta)*r + spread;
  const z=Math.sin(theta)*r + (.35+r*.028)*gaussian();
  const y=gaussian()*(2.9-r*.016)+gaussian()*.3;
  armsPos.set([x,y,z],i*3);
  const c=armPalette[Math.floor(random()*4)].clone().multiplyScalar(.50+random()*.55);
  armsCol.set(c.toArray(),i*3);
}
const g=new THREE.BufferGeometry();
g.setAttribute('position',new THREE.BufferAttribute(armsPos,3));
g.setAttribute('color',new THREE.BufferAttribute(armsCol,3));
const arms=new THREE.Points(g,new THREE.PointsMaterial({
  size:low?1.15:1.6,sizeAttenuation:false,vertexColors:true,transparent:true,
  opacity:.95,blending:THREE.AdditiveBlending,depthWrite:false
}));
galaxy.add(arms);
const dustN=low?1200:3500,dustPos=new Float32Array(dustN*3);
for(let i=0;i<dustN;i++){
  const r=12+Math.pow(random(),.82)*102;
  const arm=i%4,angle=arm*Math.PI/2-Math.log(r/22.5)/armPitch+gaussian()*.13;
  dustPos.set([r*Math.cos(angle)+gaussian()*1.9,gaussian()*.7,r*Math.sin(angle)+gaussian()*1.9],i*3);
}
const dustGeom=new THREE.BufferGeometry();
dustGeom.setAttribute('position',new THREE.BufferAttribute(dustPos,3));
galaxy.add(new THREE.Points(dustGeom,new THREE.PointsMaterial({
  size:low?1.6:2.4,sizeAttenuation:false,color:0x765b52,
  transparent:true,opacity:.18,depthWrite:false
})));
const core = new THREE.Sprite(new THREE.SpriteMaterial({
  map:glowMap,color:0xffdcaa,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending
}));
core.scale.set(41,41,1);
galaxy.add(core);
const halo = new THREE.Mesh(new THREE.SphereGeometry(29,24,16),
  new THREE.MeshBasicMaterial({color:0x2b3b5b,transparent:true,opacity:.08,depthWrite:false}));
galaxy.add(halo);
const solMark=new THREE.Mesh(new THREE.SphereGeometry(1.2,12,8),
  new THREE.MeshBasicMaterial({color:0xffdf8e}));
solMark.position.set(24,0,5);galaxy.add(solMark);
const solLabel = new THREE.Sprite(new THREE.SpriteMaterial({map:labelTexture('SOL · YOU ARE HERE'),transparent:true,depthTest:false}));
solLabel.scale.set(19,3.5,1);solLabel.position.set(34,4,5);galaxy.add(solLabel);
function labelTexture(text){
  const c=document.createElement('canvas');c.width=512;c.height=80;const ctx=c.getContext('2d');
  ctx.fillStyle='#f5e8cb';ctx.font='bold 28px monospace';
  ctx.fillText(text,10,45);
  return new THREE.CanvasTexture(c);
}

// Orbit camera is relative to the selected target; its radius is interpolated
// rather than scaling the original map's world (which would lose precision).
let mode='solar',focus='earth',yaw=.3,pitch=.22,distance=5.3,desiredDistance=5.3;
let curTarget=new THREE.Vector3(0,0,0);
let offset=new THREE.Vector3();
let elapsed=0,simDays=0,frameN=0,noticeTimer=0;
const held=new Set();
const warpCurtain=document.getElementById('warpCurtain');
function minZoom(){
  if(mode==='galaxy')return 30;
  if(focus==='sun')return 4.3;
  return Math.max(1.25,1.35*(bodies.get(focus)?.radius||0.4));
}
const speeds=[0,0.3,1,10,40];
function currentBodyTarget(){
  if(focus==='solar')return new THREE.Vector3(0,0,0);
  if(focus==='moon')return moon.position.clone();
  if(focus==='sun')return sun.position.clone();
  return bodies.get(focus)?.mesh.position.clone() || earth.position.clone();
}
function destination(key){
  if((key==='galaxy')!==(mode==='galaxy') && warpCurtain){
    warpCurtain.classList.add('active');
    window.setTimeout(()=>warpCurtain.classList.remove('active'),430);
  }
  if(bodies.has(key))loadPlanetTexture(bodies.get(key));
  if(key==='galaxy'){
    mode='galaxy';focus='galaxy';desiredDistance=240;distance=240;
    yaw=.7;pitch=.54;offset.set(0,0,0);curTarget.set(0,0,0);
  }else{
    const wasGalaxy=mode==='galaxy';
    mode='solar';focus=key==='solar'?'solar':key;
    if(wasGalaxy){yaw=.3;pitch=.22;curTarget.set(0,0,0);}
    offset.set(0,0,0);
    desiredDistance=key==='solar'?100:key==='sun'?14:key==='moon'?2.4:
      Math.max(3.1,(bodies.get(key)?.radius||1)*4.8);
    if(wasGalaxy)distance=desiredDistance*1.4;
  }
  selector.value=key;
  document.querySelectorAll('[data-stage]').forEach(button=>{
    const active=(button.dataset.stage==='galaxy'&&mode==='galaxy')||
      (button.dataset.stage==='solar'&&focus==='solar')||
      (button.dataset.stage==='orbit'&&focus==='earth');
    button.style.background=active?'#36739a':'#133456';
  });
}
document.querySelectorAll('[data-stage]').forEach(button=>{
  button.addEventListener('click',()=>{
    destination(button.dataset.stage==='galaxy'?'galaxy':
      button.dataset.stage==='solar'?'solar':'earth');
  });
});
selector.addEventListener('change',()=>destination(selector.value));
timeScale.addEventListener('input',()=>{timeLabel.textContent=speeds[+timeScale.value]+'×';});
destination('earth');

function resize(){
  const w=innerWidth,h=innerHeight;
  renderer.setSize(w,h,false);
  cameraSolar.aspect=w/h;cameraSolar.updateProjectionMatrix();
  cameraGalaxy.aspect=w/h;cameraGalaxy.updateProjectionMatrix();
}
window.addEventListener('resize',resize);
const pointers=new Map();
let pinchLength=0;
canvas.addEventListener('pointerdown',e=>{
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{
  const old=pointers.get(e.pointerId);
  if(!old)return;
  const dx=e.clientX-old.x,dy=e.clientY-old.y;
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===1){
    yaw-=dx*.0045;pitch=clamp(pitch+dy*.0045,-1.42,1.42);
  }else if(pointers.size===2){
    const [a,b]=[...pointers.values()];
    const gap=Math.hypot(a.x-b.x,a.y-b.y);
    if(pinchLength>0)desiredDistance=clamp(desiredDistance*pinchLength/Math.max(1,gap),
      minZoom(),mode==='galaxy'?900:220);
    pinchLength=gap;
  }
});
function endPointer(e){pointers.delete(e.pointerId);pinchLength=0;}
canvas.addEventListener('pointerup',endPointer);
canvas.addEventListener('pointercancel',endPointer);
canvas.addEventListener('wheel',e=>{
  e.preventDefault();
  desiredDistance=clamp(desiredDistance*Math.exp(Math.sign(e.deltaY)*.11),
    minZoom(),mode==='galaxy'?900:220);
},{passive:false});
window.addEventListener('keydown',e=>{
  if(e.code==='KeyU' || e.code==='Escape'){
    if(/^(INPUT|SELECT)$/.test(e.target?.tagName||''))return;
    location.assign(back.href);return;
  }
  if(/^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName||''))return;
  held.add(e.code);
  if(['Space','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();
});
window.addEventListener('keyup',e=>held.delete(e.code));
window.addEventListener('blur',()=>held.clear());
canvas.addEventListener('webglcontextlost',e=>{
  e.preventDefault();
  loading.classList.remove('hidden');
  loading.querySelector('p').textContent='Graphics context lost. Waiting for the browser to restore it.';
});
canvas.addEventListener('webglcontextrestored',()=>{
  location.reload();
});
const clock=new THREE.Clock();
let hudTicker=0;
function frame(){
  requestAnimationFrame(frame);
  if(renderer.getContext().isContextLost())return;
  const dt=Math.min(clock.getDelta(),.06);
  if(document.hidden)return;
  elapsed+=dt;
  simDays+=dt*speeds[+timeScale.value]*9;
  // Planetary orbits, artistic scale following r^0.75 compression.
  for(const spec of records){
    const angle=spec.phase+simDays/spec.period*2*Math.PI;
    const body=bodies.get(spec.id).mesh;
    body.position.set(Math.cos(angle)*spec.orbit,0,Math.sin(angle)*spec.orbit);
    body.rotation.y+=dt*.032;
  }
  moon.position.copy(earth.position).add(new THREE.Vector3(
    Math.cos(simDays/27.32*2*Math.PI)*1.78,.12*Math.sin(simDays/27.32*2*Math.PI),
    Math.sin(simDays/27.32*2*Math.PI)*1.78
  ));
  clouds.rotation.y+=dt*.018;
  earthLightsMat.uniforms.uSun.value.copy(earth.position).multiplyScalar(-1).normalize();
  sun.rotation.y+=dt*.005;
  sunHalo.material.rotation=elapsed*.015;
  ship.position.copy(earth.position).add(new THREE.Vector3(
    0.0,.12+Math.sin(elapsed*.5)*.05,1.72
  ));
  ship.rotation.y=elapsed*.08;
  ship.visible=mode==='solar' && (focus==='earth'||focus==='moon');
  // Keep world navigation precise by tracking a local target in each scale.
  const activeCam=mode==='galaxy'?cameraGalaxy:cameraSolar;
  const activeScene=mode==='galaxy'?galaxy:solar;
  const moveRate=(mode==='galaxy'?16:3)*(held.has('ShiftLeft')||held.has('ShiftRight')?3.4:1)*dt;
  const forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
  const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
  if(held.has('KeyW')||held.has('ArrowUp'))offset.addScaledVector(forward,moveRate);
  if(held.has('KeyS')||held.has('ArrowDown'))offset.addScaledVector(forward,-moveRate);
  if(held.has('KeyA')||held.has('ArrowLeft'))offset.addScaledVector(right,-moveRate);
  if(held.has('KeyD')||held.has('ArrowRight'))offset.addScaledVector(right,moveRate);
  if(held.has('KeyQ'))offset.y-=moveRate;
  if(held.has('KeyE'))offset.y+=moveRate;
  if(mode==='solar' && (held.has('KeyW')||held.has('KeyS'))) {
    // Do not fight a zoom command while the user flies around a planet.
    desiredDistance=clamp(desiredDistance,minZoom(),220);
  }
  const desired=mode==='galaxy'?offset.clone():currentBodyTarget().add(offset);
  const follow=1-Math.exp(-dt*3);
  curTarget.lerp(desired,follow);
  distance+=(desiredDistance-distance)*(1-Math.exp(-dt*3.2));
  const cp=Math.cos(pitch);
  activeCam.position.set(
    curTarget.x+Math.sin(yaw)*cp*distance,
    curTarget.y+Math.sin(pitch)*distance,
    curTarget.z+Math.cos(yaw)*cp*distance
  );
  activeCam.lookAt(curTarget);
  renderer.render(activeScene,activeCam);
  hudTicker+=dt;
  if(hudTicker>.18){
    const text=mode==='galaxy'?'L2 · MILKY WAY / GALACTIC VIEW':'L0/L1 · SOLAR SYSTEM / ORBITAL VIEW';
    const bodyLabel=focus==='solar'?'Solar System':focus==='galaxy'?'Milky Way':
      focus==='moon'?'Moon':focus==='sun'?'Sun':bodies.get(focus)?.name||'Earth';
    telemetry.textContent=text+'\nDESTINATION: '+bodyLabel.toUpperCase()+
      '\nVISUAL RANGE: '+distance.toFixed(1)+(mode==='galaxy'?' kly (artistic)':' render units')+
      '\nCRAFT: '+craftName.toUpperCase()+' · '+source.name.toUpperCase()+
      '\nTIME RATE: '+speeds[+timeScale.value]+'× · PERFORMANCE: '+(low?'MOBILE':'DESKTOP')+
      '\nSKY: '+(catalogStarCount?catalogStarCount.toLocaleString()+' REAL CATALOG STARS':'PROCEDURAL BACKUP');
    hudTicker=0;
  }
  if(loading.classList.contains('hidden')===false){
    loading.classList.add('hidden');
    setTimeout(()=>{loading.style.display='none';},800);
  }
}
frame();
