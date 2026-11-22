/** Source-exact parent #217 vs added inward snow shoulder bevel in live PATROL WebGL2.
 * QA temporary HTML only: identical GPU time and flyable world, no runtime edit.
 * Software RAF intervals are not target hardware GPU frame timings.
 */
import {chromium} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';

const baseSha='599154e48e06859cf8493fd5c259423f711c2655';
const sourceBaseline=readFileSync('alaska-floe-relief-base.html','utf8');
const sourceCandidate=readFileSync('index.html','utf8');
if(sourceBaseline!==sourceCandidate)
  throw Error('Parent and candidate game HTML differ; cannot isolate floe geometry');
const originalModule='./assets/alaska/alaska-fjord-detail.js';
const baselineModule='./assets/alaska/alaska-fjord-detail-baseline-qa.js';
const injectAt='  window.PatrolSpaceBridge = {getState: () => ({';
const photoPhase=42.125;

function qaCopy(html,isBaseline,file){
  if(html.split(originalModule).length!==2)
    throw Error('Alaska detail import is not unique in '+file);
  if(isBaseline)html=html.replace(originalModule,baselineModule);
  if(html.split(injectAt).length!==2)
    throw Error('QA bridge anchor changed in '+file);
  const hook=[
    '  window.PatrolFloeReliefQA = () => {',
    "    if(!selectedMap.alaska)throw Error('Alaska only');",
    '    const hash=n=>{const s=Math.sin(n*127.1+78.233)*43758.5453;',
    '      return s-Math.floor(s);};',
    '    const isWater=(x,z)=>{',
    '      const h=sampleTerrainHeight(x,z);',
    '      return Number.isFinite(h)&&h<=WATER_H+.12;',
    '    };',
    '    let best=null;',
    '    for(let i=0;i<86;i++){',
    '      const h=hash(i*11+17),j=hash(i*13+37);',
    '      const north=i<56?250+h*195:-600+h*215;',
    '      const east=i<56?28+j*152:38+j*137;',
    '      const radius=1.35+3.9*hash(i*19+3);',
    '      if(!isWater(east,north))continue;',
    '      let clear=true;',
    '      for(let n=0;n<8;n++){',
    '        const angle=n*Math.PI/4;',
    '        if(!isWater(east+Math.cos(angle)*radius,',
    '          north+Math.sin(angle)*radius)){clear=false;break;}',
    '      }',
    '      if(!clear)continue;',
    '      const corners=7+i%3,ring=[];',
    '      for(let n=0;n<corners;n++){',
    '        const a=n*2*Math.PI/corners;',
    '        const scale=.75+.31*hash(i*37+n*23);',
    '        ring.push([east+Math.cos(a)*radius*scale,',
    '          north+Math.sin(a)*radius*(.53+.23*h)*scale]);',
    '      }',
    '      if(ring.some((p,k)=>{',
    '        const next=ring[(k+1)%corners];',
    '        return !isWater(p[0],p[1]) ||',
    '          !isWater((p[0]+next[0])*.5,(p[1]+next[1])*.5) ||',
    '          !isWater((p[0]+east)*.5,(p[1]+north)*.5);',
    '      }))continue;',
    '      const priority=(i>=56?100:0)+radius;',
    '      if(!best||priority>best.priority)',
    '        best={index:i,east,north,radius,corners,priority};',
    '    }',
    "    if(!best)throw Error('No shoreline-safe floe in camera AOI');",
    '    const target=[best.east,WATER_H+.3,best.north];',
    '    const eye=[best.east-2.6,WATER_H+3.1,best.north-6.1];',
    '    const dx=target[0]-eye[0],dz=target[2]-eye[2];',
    '    viewIdx=1;',
    '    window.__patrolFloeReliefHold=true;',
    '    sceneryTime=42.125;',
    '    plane.pos=eye;',
    '    plane.yaw=Math.atan2(dx,dz);',
    '    plane.pitch=Math.atan2(target[1]-eye[1],Math.hypot(dx,dz));',
    '    plane.bank=0;plane.speed=0;plane.throttle=0;plane.vsi=0;',
    '    camInitialized=false;',
    '    return {...best,eye,target,yaw:plane.yaw,pitch:plane.pitch};',
    '  };',
    ''
  ].join('\n');
  html=html.replace(injectAt,hook+injectAt);
  const holdMotion=/    }else{\r?\n      flightStep=advanceFlight\(dt\);\r?\n    }/g;
  if([...html.matchAll(holdMotion)].length!==1)
    throw Error('QA flight hold is not unique in '+file);
  const eol=html.includes('\r\n')?'\r\n':'\n';
  html=html.replace(holdMotion,[
    '    }else if(window.__patrolFloeReliefHold){',
    '      flightStep={basis:getPlaneBasis(),boundaryAssist:false};',
    '    }else{','      flightStep=advanceFlight(dt);','    }'
  ].join(eol));
  // Freeze *both* relevant clocks, only after the normal game is playable.
  const clocks=[
    ['    const time = now * 0.001;',
     '    const time = window.__patrolFloeReliefHold ? 42.125 : now * 0.001;'],
    ['    sceneryTime += Math.min(rawDt, 0.12);',
     '    if(!window.__patrolFloeReliefHold)sceneryTime += Math.min(rawDt, 0.12);'],
    ['    const environment=sampleFlightEnvironment(Math.min(rawDt,0.12));',
     '    const environment=sampleFlightEnvironment(window.__patrolFloeReliefHold?0:Math.min(rawDt,0.12));']
  ];
  for(const [from,to] of clocks){
    if(html.split(from).length!==2)
      throw Error('Animation time hook nonunique: '+from);
    html=html.replace(from,to);
  }
  writeFileSync(file,html);
}
qaCopy(sourceBaseline,true,'alaska-floe-relief-baseline-qa.html');
qaCopy(sourceCandidate,false,'alaska-floe-relief-candidate-qa.html');
mkdirSync('artifacts',{recursive:true});

const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader','--disable-gpu-sandbox'
]});
const record={baselineSha:baseSha,headSha:process.env.GITHUB_SHA||null,
  capture:'live game WebGL2, parent #217 sharp snow lip vs bevelled snow shoulder at identical pose/time',
  softwareOnly:true,frozenShaderTime:photoPhase,scenarios:{}};
async function capture(name,file,expectedModule){
  const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
  const errors=[],modules=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{
    const path=new URL(r.url()).pathname;
    if(path.includes('alaska-fjord-detail'))
      modules.push({path,status:r.status()});
  });
  try{
    const response=await page.goto('http://127.0.0.1:8765/'+file+
      '?alaskaView=harbor',{waitUntil:'domcontentloaded',timeout:30000});
    if(response?.status()!==200)throw Error('Page did not load: '+name);
    if(!await page.evaluate(()=>Boolean(document.querySelector('#glCanvas')?.getContext('webgl2'))))
      throw Error('WebGL2 unavailable: '+name);
    await page.locator('input[name="flightMap"][value="alaska"]').check({force:true});
    await page.locator('#startFlight').click({timeout:15000});
    await page.waitForFunction(()=>{
      const err=document.getElementById('menuError');
      const loader=document.getElementById('loadOverlay');
      const title=document.getElementById('titleOverlay');
      return (err&&!err.hidden)||
        (loader?.classList.contains('done')&&title?.hidden);
    },null,{timeout:110000});
    const state=await page.evaluate(()=>window.PatrolSpaceBridge?.getState?.());
    if(!state?.playing||state.map!=='alaska')
      throw Error('Alaska flight did not start: '+name+' '+JSON.stringify(state));
    await page.evaluate(()=>{
      for(const [id,v] of [['skyTime','12'],['skyWeather','Clear']]){
        const e=document.getElementById(id);
        e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}));
      }
    });
    // Give existing CC0 photo atlas time to load before freezing and capture.
    await page.waitForTimeout(1200);
    const selected=await page.evaluate(()=>window.PatrolFloeReliefQA());
    await page.waitForTimeout(1100);
    const intervals=await page.evaluate(async()=>{
      const samples=[];let prev=null;
      for(let i=0;i<16;i++){
        const t=await new Promise(ok=>requestAnimationFrame(ok));
        if(prev!==null&&i>=4)samples.push(t-prev);
        prev=t;
      }
      const sorted=samples.sort((a,b)=>a-b);
      return {count:sorted.length,p50Ms:sorted[Math.floor(sorted.length/2)],
        p95Ms:sorted[Math.floor(sorted.length*.95)]};
    });
    await page.evaluate(()=>new Promise(ok=>
      requestAnimationFrame(()=>requestAnimationFrame(ok))));
    await page.addStyleTag({content:
      '#flightMap,#statusBar,#skySettings,#hudCanvas{visibility:hidden!important}'});
    await page.screenshot({path:'artifacts/alaska-floe-relief-'+name+'.png'});
    const result=await page.evaluate(()=>({
      pose:window.PatrolSpaceBridge?.getState?.(),
      gl:(()=>{const c=document.getElementById('glCanvas');return {
        width:c.width,height:c.height,lost:c.getContext('webgl2').isContextLost()
      };})()
    }));
    if(result.gl.lost||errors.length)throw Error(name+' failed: '+JSON.stringify(errors));
    if(!modules.some(m=>m.path===expectedModule&&m.status===200)||
       modules.some(m=>m.path!==expectedModule))
      throw Error('Missing or mixed floe module '+name+' '+JSON.stringify(modules));
    record.scenarios[name]={selected,intervals,pose:result.pose,
      canvas:result.gl,modules,pageErrors:errors};
  }finally{await page.close();}
}
try{
  await capture('parent-sharp','alaska-floe-relief-baseline-qa.html',
    '/assets/alaska/alaska-fjord-detail-baseline-qa.js');
  await capture('beveled-lip','alaska-floe-relief-candidate-qa.html',
    '/assets/alaska/alaska-fjord-detail.js');
  const a=record.scenarios['parent-sharp'],b=record.scenarios['beveled-lip'];
  const drift=Math.hypot(...a.pose.position.map((v,i)=>v-b.pose.position[i]));
  if(a.selected.index!==b.selected.index||
     Math.abs(a.selected.radius-b.selected.radius)>.00001||
     drift>.01||Math.abs(a.pose.yaw-b.pose.yaw)>.005||
     a.canvas.width!==b.canvas.width||a.canvas.height!==b.canvas.height)
    throw Error('Invalid aligned floe comparison '+JSON.stringify({drift,parent:a.selected,head:b.selected}));
  record.cameraDrift=drift;
  record.sameFloeIndex=a.selected.index;
  record.sameCanvas=[a.canvas.width,a.canvas.height];
  writeFileSync('artifacts/alaska-floe-relief-paired.json',JSON.stringify(record,null,2));
  console.log('Alaska identical-time floe geometry A/B',JSON.stringify(record));
}finally{await browser.close();}
