// Real browser WebGL2 acceptance for the optional CC0 NYC harbor ferry.
// A controlled CAMERA/FREEZE fixture is injected in-memory for screenshots;
// no debug hooks or frozen movement are committed to production index.html.
import {chromium} from 'playwright';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const html=readFileSync('index.html','utf8');
const bridge='  window.PatrolSpaceBridge = {';
const flight='    if(crash || scenicViewActive){';
if(!html.includes(bridge)||!html.includes(flight))throw Error('Fixture anchors changed');
const eol=html.includes('\r\n')?'\r\n':'\n';
const injected=html.replace(flight,
  ['    if(window.__patrolFerryQaHold){',
   '      flightStep={basis:getPlaneBasis(),boundaryAssist:false};',
   '    }else if(crash || scenicViewActive){'].join(eol))
 .replace(bridge,[
  '  window.PatrolFerrySceneQA={',
  '    boats:()=>boats.map(b=>({kind:b.kind,x:b.x,z:b.z,halfLength:b.halfLength,halfWidth:b.halfWidth})),',
  '    view:(distance)=>{',
  "      const ferry=boats.find(b=>b.kind==='ferry'&&!b.wreck);",
  "      if(!ferry)throw Error('No valid ferry actor');",
  '      const [x,z,yaw]=sceneryPose(ferry,sceneryTime);',
  '      const px=x-Math.sin(yaw)*distance,pz=z-Math.cos(yaw)*distance;',
  '      window.__patrolFerryQaHold=true;',
  '      plane.pos=[px,WATER_H+8.2,pz];plane.yaw=yaw;plane.pitch=-.09;',
  '      plane.speed=0;plane.vsi=0;plane.bank=0;camInitialized=false;',
  '      return {distance,boat:[x,z,yaw],camera:[px,WATER_H+8.2,pz]};',
  '    },',
  '    read:()=>({map:Object.keys(FLIGHT_MAPS).find(k=>FLIGHT_MAPS[k]===selectedMap),',
  '      enabled:nycFerryLods?.ready??false, stats:window.PatrolFerryLodQA?.()??null})',
  '  };'].join(eol)+eol+bridge);
mkdirSync('artifacts/nyc/ferry-lod',{recursive:true});
writeFileSync('nyc-ferry-qa-runtime.html',injected);
const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist',
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader'
]});
const base='http://127.0.0.1:8765/nyc-ferry-qa-runtime.html';
const cases=[
  {id:'nyc-preview',map:'manhattan',query:'?nycHarborVessels=cc0-ferry-preview',need:true},
  {id:'nyc-default',map:'manhattan',query:'',need:false},
  {id:'nyc-compat',map:'manhattan',query:'?nycHarborVessels=cc0-ferry-preview&graphics=compat',need:false},
  {id:'alaska-isolation',map:'alaska',query:'?nycHarborVessels=cc0-ferry-preview',need:false},
  {id:'chongqing-isolation',map:'chongqing',query:'?nycHarborVessels=cc0-ferry-preview',need:false}
];
const report={kind:'PATROL_NYC_FERRY_CC0_WEBGL2_A_B_CROSSMAP',renderer:'Chromium SwiftShader software WebGL2',cases:{},limits:[
  'The camera fixture does not modify the shipped game code.',
  'Full actual NYC Ferry vessel identity and scaling are not claimed; source is a generic tevy CC0 ro-ro.',
  'Software-WebGL2 frame pacing is not physical GPU FPS. Moving ferry routes and collisions are not changed.'
]};
try{
  for(const c of cases){
    const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
    const errors=[],glbRes=[],loaderMessages=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{
      if(m.type()==='error')errors.push(m.text());
      if(m.text().includes('[PATROL NYC ferry LOD]'))loaderMessages.push(m.text());
    });
    page.on('response',r=>{
      if(r.url().includes('/assets/nyc/harbor/tevy-ro-ro-lod'))
        glbRes.push({url:r.url().split('/').pop(),status:r.status()});
    });
    await page.goto(base+c.query,{waitUntil:'domcontentloaded',timeout:45000});
    await page.locator('input[name="flightMap"][value="'+c.map+'"]').check({force:true});
    await page.locator('#startFlight').click({force:true,timeout:15000});
    await page.waitForFunction(()=>{
      const t=document.querySelector('#titleOverlay'),l=document.querySelector('#loadOverlay');
      return Boolean(t?.hidden&&l?.classList.contains('done'));
    },null,{timeout:160000,polling:450});
    const loaded=await page.evaluate(()=>window.PatrolSpaceBridge?.getState?.());
    if(!loaded?.playing||loaded.map!==c.map)
      throw Error('Incorrect map/start state '+c.id+': '+JSON.stringify(loaded));
    if(c.need){
      await page.waitForFunction(()=>window.PatrolFerryLodQA?.()?.ready?.length===3||
        window.PatrolFerryLodQA?.()?.failed?.length>0,
        null,{timeout:115000,polling:500});
      const diagnostic=await page.evaluate(()=>window.PatrolFerryLodQA());
      if(diagnostic.ready.length!==3||diagnostic.failed.length)
        throw Error('Three in-game LOD decodes failed: '+JSON.stringify(diagnostic));
      if(glbRes.length!==3||glbRes.some(r=>r.status!==200))
        throw Error('Unexpected source URLs/status: '+JSON.stringify(glbRes));
      const views=[];
      await page.addStyleTag({content:
        'body.patrol-ferry-qa-hide *{visibility:hidden!important} '+
        'body.patrol-ferry-qa-hide #glCanvas{visibility:visible!important}'});
      for(const [name,distance] of [['near',60],['mid',220],['far',475]]){
        const before=await page.evaluate(()=>window.PatrolFerryLodQA().selections);
        const fixture=await page.evaluate(d=>window.PatrolFerrySceneQA.view(d),distance);
        await page.waitForTimeout(1400);
        const after=await page.evaluate(()=>window.PatrolFerryLodQA().selections);
        const img=await page.evaluate(()=>document.querySelector('#glCanvas')?.getContext('webgl2')?.isContextLost());
        if(img)throw Error('WebGL context lost at ferry '+name);
        if(after[name]<=before[name])throw Error('No actual '+name+' LOD draw at '+distance+' units: '+JSON.stringify({before,after}));
        await page.evaluate(()=>document.body.classList.add('patrol-ferry-qa-hide'));
        await page.locator('#glCanvas').screenshot({
          path:'artifacts/nyc/ferry-lod/'+name+'.png',timeout:75000
        });
        await page.evaluate(()=>document.body.classList.remove('patrol-ferry-qa-hide'));
        views.push({name,fixture,selectedDraws:after[name]-before[name]});
      }
      report.cases[c.id]={map:loaded.map,glbRes,loaderMessages,views,
        final:await page.evaluate(()=>window.PatrolFerryLodQA()),errors};
    }else{
      await page.waitForTimeout(1200);
      if(glbRes.length!==0)throw Error('Forbidden GLB fetch in '+c.id);
      report.cases[c.id]={map:loaded.map,glbRes,errors};
      await page.screenshot({path:'artifacts/nyc/ferry-lod/'+c.id+'.png',timeout:75000});
    }
    if(errors.length)throw Error('Page errors on '+c.id+': '+errors.join(' | '));
    console.log('[PATROL NYC ferry QA] PASS '+c.id,JSON.stringify(report.cases[c.id]).slice(0,1400));
    await page.close();
  }
  report.status='PASS';
}finally{
  writeFileSync('artifacts/nyc/ferry-lod/report.json',JSON.stringify(report,null,2)+'\n');
  await browser.close();
}
console.log('PASS NYC ferry WebGL2 near/mid/far and default/compat/Alaska/Chongqing guards');
