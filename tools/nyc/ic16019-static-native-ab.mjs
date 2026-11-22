// Isolated same-camera A/B using actual PATROL ship builder + native WebGL2.
// Static screenshots only; not an animation, not a manufacturer ship scan.
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const source=await readFile('index.html','utf8');
const b=source.indexOf('  function addModelBox(');
const e=source.indexOf('  function buildMooseMesh()',b);
if(b<0||e<b)throw Error('PATROL native ship builder missing');
function createTriangleMesh(){
 const pos=[],norm=[],col=[];
 function tri(a,b,c,rgb){
  const ab=b.map((v,i)=>v-a[i]),ac=c.map((v,i)=>v-a[i]);
  const n=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
  const l=Math.hypot(...n)||1;
  for(const v of [a,b,c]){pos.push(...v);norm.push(...n.map(x=>x/l));col.push(...rgb)}
 }
 return {addTri:(a,b,c,rgb)=>tri(a,b,c,rgb),
  addQuad:(a,b,c,d,rgb)=>{tri(a,b,c,rgb);tri(a,c,d,rgb)},
  upload:()=>({pos,norm,col,triangles:pos.length/9})};
}
const {buildShipMesh}=new Function('createTriangleMesh',source.slice(b,e)+
 String.fromCharCode(10)+'return {buildShipMesh};')(createTriangleMesh);
const models={legacy:buildShipMesh('ferry'),twin:buildShipMesh('nycFerry')};
if(models.legacy.triangles!==3090||models.twin.triangles!==3150)
 throw Error('Unexpected real PATROL mesh triangle count');
const dir='artifacts/nyc-ic16019-visual-ab';
await mkdir(dir,{recursive:true});
function render(){
 const cv=document.querySelector('canvas');
 const gl=cv.getContext('webgl2',{preserveDrawingBuffer:true,antialias:true});
 if(!gl){window.result={done:true,error:'WebGL2 missing'};return}
 try{
  const vert='#version 300 es\nprecision highp float;layout(location=0) in vec3 p;layout(location=1) in vec3 n;layout(location=2) in vec3 c;uniform mat4 pv;out vec3 color;void main(){float light=max(.22,abs(dot(normalize(n),normalize(vec3(.54,.88,.34)))));color=c*(.49+.51*light);gl_Position=pv*vec4(p,1.);gl_PointSize=2.;}';
  const frag='#version 300 es\nprecision highp float;in vec3 color;out vec4 fragColor;void main(){fragColor=vec4(pow(color,vec3(.85)),1.);}';
  function compile(type,s){const shader=gl.createShader(type);gl.shaderSource(shader,s);gl.compileShader(shader);
   if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error('shader: '+gl.getShaderInfoLog(shader));return shader}
  const prog=gl.createProgram();gl.attachShader(prog,compile(gl.VERTEX_SHADER,vert));
  gl.attachShader(prog,compile(gl.FRAGMENT_SHADER,frag));gl.linkProgram(prog);
  if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const vao=gl.createVertexArray();gl.bindVertexArray(vao);
  for(const [loc,k] of [[0,'pos'],[1,'norm'],[2,'col']]){
   const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
   gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(window.mesh[k]),gl.STATIC_DRAW);
   gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,0,0);
  }
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const normalize=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l)};
  const dot=(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0);
  const eye=[22,-3.5,33],target=[0,3.5,0];
  const z=normalize(eye.map((x,i)=>x-target[i])),x=normalize(cross([0,1,0],z)),y=cross(z,x);
  const view=[x[0],y[0],z[0],0,x[1],y[1],z[1],0,
   x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1];
  const f=1/Math.tan(39*Math.PI/360),ar=cv.width/cv.height,near=.1,far=180;
  const p=[f/ar,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0];
  const m=new Array(16).fill(0);
  for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)m[c*4+r]+=p[k*4+r]*view[c*4+k];
  gl.uniformMatrix4fv(gl.getUniformLocation(prog,'pv'),false,new Float32Array(m));
  gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
  gl.viewport(0,0,cv.width,cv.height);gl.clearColor(.68,.82,.90,1);
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES,0,window.mesh.pos.length/3);
  const error=gl.getError();if(error!==0)throw Error('WebGL2 error '+error);
  window.result={done:true,webgl:gl.getParameter(gl.VERSION),
   triangles:window.mesh.triangles,drawCalls:1,glError:0,
   preview:'actual PATROL source mesh, isolated static native WebGL2 preview; not an in-game ferry photograph'};
 }catch(error){window.result={done:true,error:String(error.stack||error)}}
}
for(const [key,mesh] of Object.entries(models)){
 const html='<!DOCTYPE html><meta charset="utf-8"><title>Native PATROL hull</title>'+
  '<style>html,body{margin:0;background:#add0e5;}canvas{width:960px;height:540px}</style>'+
  '<canvas width="960" height="540"></canvas><script>window.mesh='+
  JSON.stringify(mesh)+';('+render.toString()+')();</script>';
 await writeFile(dir+'/'+key+'.html',html);
}
const root=(process.env.PATROL_BASE_URL||'http://127.0.0.1:8899').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,args:['--no-sandbox',
 '--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const outputs=[],pictures={};
try{
 for(const key of Object.keys(models)){
  const pg=await browser.newPage({viewport:{width:960,height:540},deviceScaleFactor:1});
  const errors=[];pg.on('pageerror',e=>errors.push(e.message));pg.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  try{
   const response=await pg.goto(root+'/'+dir+'/'+key+'.html',
    {waitUntil:'domcontentloaded',timeout:50000});
   if(!response?.ok())throw Error('Preview returned '+response?.status());
   await pg.waitForFunction(()=>window.result?.done,null,{timeout:60000});
   const info=await pg.evaluate(()=>window.result);
   if(info.error||!info.webgl?.includes('WebGL 2.0')||errors.length)throw Error(JSON.stringify({info,errors}));
   const image=await pg.locator('canvas').screenshot({path:dir+'/'+key+'-native-gl2.png',timeout:50000});
   pictures[key]=PNG.sync.read(image);
   outputs.push({name:key,...info,screenshot:dir+'/'+key+'-native-gl2.png'});
  }finally{await pg.close()}
 }
}finally{await browser.close()}
const a=pictures.legacy.data,t=pictures.twin.data;let delta=0,painted=0;
for(let i=0;i<a.length;i+=4){
 if(Math.abs(a[i]-t[i])+Math.abs(a[i+1]-t[i+1])+Math.abs(a[i+2]-t[i+2])>48)delta++;
 if(Math.abs(t[i]-174)+Math.abs(t[i+1]-209)+Math.abs(t[i+2]-230)>48)painted++;
}
const report={passed:delta>200&&painted>1500,
 rawImagePixelChanges:delta,nonBackgroundPixels:painted,staticOnly:true,
 inGameScreenshot:false,
 design:'visual PATROL-owned approximations, source facts Incat Crowther IC16019; not designer CAD',
 base:'codex/patrol-integration-20261121 6d50bfd',outputs};
await writeFile(dir+'/static-native-ferry-ab.json',JSON.stringify(report,null,2)+'\n');
console.log('FERRY NATIVE STATIC A/B '+JSON.stringify(report,null,2));
if(!report.passed)process.exitCode=1;
