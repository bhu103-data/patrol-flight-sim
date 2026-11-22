/** PATROL Alaska #153: repeatable real-GPU-only A/B benchmark.
 * On a clean PR-branch checkout on a GPU PC:
 *   npm install --no-save playwright@1.56.1
 *   node tools/alaska/native-gpu-benchmark.mjs --p95-budget-ms=33.3 --first-playable-budget-ms=10000
 * No SwiftShader flags. Software/unknown GPU always blocks certification.
 */
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {platform,arch} from 'node:os';
import {classifyHardwareRenderer,assessNativeGpuRuns} from './native-gpu-guard.mjs';

const root=resolve('.');
const baselineSha='bc155141742811bca3c4b1988672b238bd50a98b';
const requiredBranch='port/alaska-floe-waterline-main-20261121-chat';
const opts=new Map();
for(const raw of process.argv.slice(2)){
  const m=/^--([a-z-]+)=(.+)$/.exec(raw);
  if(!m||opts.has(m[1])||
     !['p95-budget-ms','first-playable-budget-ms','max-regression-pct','browser'].includes(m[1]))
    throw Error('Unexpected option '+raw);
  opts.set(m[1],m[2]);
}
if(!opts.has('p95-budget-ms')||!opts.has('first-playable-budget-ms'))
  throw Error('Explicit --p95-budget-ms=33.3 and --first-playable-budget-ms=10000 required');
const budgets={
  maxP95Ms:Number(opts.get('p95-budget-ms')),
  maxFirstPlayableMs:Number(opts.get('first-playable-budget-ms')),
  maxRegressionPct:Number(opts.get('max-regression-pct')??10)
};
if(!Number.isFinite(budgets.maxP95Ms)||budgets.maxP95Ms<=0||
   !Number.isFinite(budgets.maxFirstPlayableMs)||budgets.maxFirstPlayableMs<=0||
   !Number.isFinite(budgets.maxRegressionPct)||budgets.maxRegressionPct<0||
   budgets.maxRegressionPct>100)
  throw Error('Budgets must be finite positive numbers; max regression 0–100%');
const channel=opts.get('browser')||'msedge';
if(!['msedge','chrome','chromium'].includes(channel))
  throw Error('Allowed browser channels: msedge, chrome, chromium');
const git=(...parts)=>execFileSync('git',parts,{encoding:'utf8',cwd:root,
  maxBuffer:18*1024*1024}).trimEnd();
const branch=git('branch','--show-current');
if(branch!==requiredBranch)throw Error('Wrong benchmark branch: '+branch);
if(git('status','--porcelain','--untracked-files=no').trim())
  throw Error('Tracked working tree has uncommitted changes');
const prSha=git('rev-parse','HEAD');
const baselineModule=git('show',baselineSha+':assets/alaska/alaska-fjord-detail.js');
const candidateModule=readFileSync('assets/alaska/alaska-fjord-detail.js','utf8');
const hash=s=>createHash('sha256').update(s).digest('hex');
if(hash(baselineModule)===hash(candidateModule))
  throw Error('Baseline and candidate floe module have same bytes');

const importPath='./assets/alaska/alaska-fjord-detail.js';
const pinnedImport='./assets/alaska/alaska-fjord-native-baseline-qa.js';
const marker='  window.PatrolSpaceBridge = {getState: () => ({';
const poseHook="  window.PatrolNativeGpuQA = () => {\n    if(!selectedMap.alaska)throw Error('Expected Alaska before GPU pose');\n    if(sampleTerrainHeight(96.32902988648857,-579.8852495443498)>WATER_H+0.12)\n      throw Error('Pinned floe 79 is no longer in surveyed open water');\n    window.__patrolQaHold=true;\n    sceneryTime=42.125;\n    viewIdx=1;\n    plane.pos=[93.72902988648858,15.3,-585.9852495443498];\n    plane.yaw=0.40291159085351363;\n    plane.pitch=-0.3995474360824037;\n    plane.bank=0;plane.speed=0;plane.throttle=0;plane.vsi=0;\n    camInitialized=false;\n    return {floe:79,position:[...plane.pos],yaw:plane.yaw,pitch:plane.pitch};\n  };\n";
function makeQAPage(html,label){
  if(html.split(importPath).length!==2||html.split(marker).length!==2)
    throw Error('QA anchor absent from '+label+' game HTML');
  if(label==='baseline')html=html.replace(importPath,pinnedImport);
  const flight=/    }else{\r?\n      flightStep=advanceFlight\(dt\);\r?\n    }/g;
  if([...html.matchAll(flight)].length!==1)
    throw Error('QA hold anchor missing for '+label);
  html=html.replace(flight,'    }else if(window.__patrolQaHold){\n'+
    '      flightStep={basis:getPlaneBasis(),boundaryAssist:false};\n'+
    '    }else{\n      flightStep=advanceFlight(dt);\n    }');
  for(const [original,replacement] of [
    ['    const time = now * 0.001;',
      '    const time = window.__patrolQaHold?42.125:now*0.001;'],
    ['    sceneryTime += Math.min(rawDt, 0.12);',
      '    if(!window.__patrolQaHold)sceneryTime += Math.min(rawDt, 0.12);'],
    ['    const environment=sampleFlightEnvironment(Math.min(rawDt,0.12));',
      '    const environment=sampleFlightEnvironment(window.__patrolQaHold?0:Math.min(rawDt,0.12));']
  ]){
    if(html.split(original).length!==2)
      throw Error('Time freeze anchor changed for '+label);
    html=html.replace(original,replacement);
  }
  return html.replace(marker,poseHook+marker);
}
const virtual=new Map([
  ['/alaska-native-baseline.html',
    makeQAPage(git('show',baselineSha+':index.html'),'baseline')],
  ['/alaska-native-updated.html',
    makeQAPage(readFileSync('index.html','utf8'),'updated')],
  ['/assets/alaska/alaska-fjord-native-baseline-qa.js',baselineModule]
]);
const types={'.html':'text/html; charset=utf-8',
  '.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
  '.json':'application/json','.webp':'image/webp','.png':'image/png',
  '.jpg':'image/jpeg','.glb':'model/gltf-binary','.css':'text/css'};
const server=createServer((req,res)=>{
  try{
    const name=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    let data;
    if(virtual.has(name))data=virtual.get(name);
    else{
      const p=resolve(root,'.'+(name==='/'?'/index.html':name));
      if(p!==root&&!p.startsWith(root+sep))throw Error('Unsafe path');
      data=readFileSync(p);
    }
    res.writeHead(200,{'Content-Type':types[extname(name)]||'application/octet-stream',
      'Cache-Control':'no-store'});res.end(data);
  }catch{
    res.writeHead(404,{'Content-Type':'text/plain'});res.end('File unavailable');
  }
});
await new Promise((yes,no)=>{
  server.once('error',no);server.listen(0,'127.0.0.1',yes);
});
const baseUrl='http://127.0.0.1:'+server.address().port;
const output='artifacts/alaska-native-gpu';
mkdirSync(output,{recursive:true});
const order=['baseline','updated','updated','baseline'];
const record={branch,prSha,baselineSha,
  moduleHashes:{baseline:hash(baselineModule),updated:hash(candidateModule)},
  machine:{platform:platform(),arch:arch(),channel},budgets,
  viewport:[1280,800],runs:[],gate:null};
let browser;
try{
  // Headed on the actual user's GPU; no SwiftShader or fake hardware flags.
  browser=await chromium.launch({
    ...(channel==='chromium'?{}:{channel}),
    headless:false,args:['--disable-background-timer-throttling',
      '--disable-renderer-backgrounding']});
  for(let i=0;i<order.length;i++){
    const label=order[i];
    const context=await browser.newContext({viewport:{width:1280,height:800},
      deviceScaleFactor:1});
    const page=await context.newPage(),pageErrors=[],moduleFetches=[];
    page.on('pageerror',e=>pageErrors.push(e.message));
    page.on('response',r=>{
      if(new URL(r.url()).pathname.includes('alaska-fjord-'))
        moduleFetches.push({path:new URL(r.url()).pathname,status:r.status()});
    });
    const started=Date.now();
    const response=await page.goto(baseUrl+'/alaska-native-'+label+
      '.html?alaskaView=harbor',{waitUntil:'domcontentloaded',timeout:30000});
    if(response?.status()!==200)throw Error('Failed to serve '+label);
    await page.locator('input[name="flightMap"][value="alaska"]').check({force:true});
    await page.locator('#startFlight').click({timeout:15000});
    await page.waitForFunction(()=>{
      const err=document.getElementById('menuError');
      const overlay=document.getElementById('loadOverlay');
      const title=document.getElementById('titleOverlay');
      return (err&&!err.hidden)||(overlay?.classList.contains('done')&&title?.hidden);
    },null,{timeout:110000});
    const firstPlayableMs=Date.now()-started;
    const expected=label==='baseline'?
      '/assets/alaska/alaska-fjord-native-baseline-qa.js':
      '/assets/alaska/alaska-fjord-detail.js';
    if(moduleFetches.length!==1||moduleFetches[0].path!==expected||
       moduleFetches[0].status!==200)
      throw Error('Mixed/missing pinned floe module: '+JSON.stringify(moduleFetches));
    const renderer=await page.evaluate(()=>{
      const gl=document.getElementById('glCanvas')?.getContext('webgl2');
      if(!gl)throw Error('WebGL2 unavailable');
      const info=gl.getExtension('WEBGL_debug_renderer_info');
      if(!info)throw Error('Unmasked renderer unavailable');
      return {unmaskedRenderer:gl.getParameter(info.UNMASKED_RENDERER_WEBGL),
        unmaskedVendor:gl.getParameter(info.UNMASKED_VENDOR_WEBGL)};
    });
    const gpu=classifyHardwareRenderer(renderer);
    if(!gpu.accepted)throw Error(gpu.reason);
    await page.evaluate(()=>{
      for(const [name,value] of [['skyTime','12'],['skyWeather','Clear']]){
        const el=document.getElementById(name);
        if(!el)throw Error('Missing weather control '+name);
        el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));
      }
    });
    await page.waitForTimeout(850);
    const pose=await page.evaluate(()=>window.PatrolNativeGpuQA());
    await page.waitForTimeout(800);
    await page.screenshot({path:output+'/'+label+'-'+i+'.png'});
    const intervals=await page.evaluate(()=>new Promise((yes,no)=>{
      const samples=[];let previous=null,count=0,start=null;
      const sample=t=>{
        if(start===null)start=t;
        if(document.visibilityState!=='visible')
          return no(Error('Tab hidden or benchmark window minimized'));
        if(t-start>30000)return no(Error('Native browser too slow for timed frames'));
        if(previous!==null&&count>=60)samples.push(t-previous);
        previous=t;count++;
        if(samples.length===220)yes(samples);
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    }));
    const health=await page.evaluate(()=>({
      state:window.PatrolSpaceBridge?.getState?.(),
      contextLost:document.getElementById('glCanvas')?.getContext('webgl2')?.isContextLost(),
      visible:document.visibilityState==='visible',
      menuError:document.getElementById('menuError')?.hidden?null:
        document.getElementById('menuError')?.textContent
    }));
    if(pageErrors.length||health.contextLost||!health.visible||health.menuError||
       !health.state?.playing||health.state.map!=='alaska')
      throw Error('Unhealthy native test scene '+JSON.stringify({health,pageErrors}));
    record.runs.push({label,renderer,hardwareProof:gpu.reason,
      firstPlayableMs,intervals,pageErrors,contextLost:false,
      map:health.state.map,pose:pose.floe});
    writeFileSync(output+'/report.json',JSON.stringify(record,null,2));
    console.log('Native',i+1,'/',order.length,label,'firstPlayableMs',
      firstPlayableMs,renderer.unmaskedRenderer);
    await context.close();
  }
  record.gate=assessNativeGpuRuns(record.runs,budgets);
  console.log(JSON.stringify(record.gate,null,2));
  process.exitCode=record.gate.status==='PASS'?0:2;
}catch(error){
  record.gate={status:'BLOCKED',reason:String(error?.stack||error)};
  console.error('NATIVE HARDWARE GATE BLOCKED:',record.gate.reason);
  process.exitCode=2;
}finally{
  writeFileSync(output+'/report.json',JSON.stringify(record,null,2));
  if(browser)await browser.close();
  await new Promise(done=>server.close(done));
  console.log('Saved '+output+'/report.json');
}
