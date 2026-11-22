// QA-only, source-exact DUMBO OTI WebGL2 rAF A/B. No production edits.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';

const urls={baseline:process.env.PATROL_QA_BASELINE_URL,
            candidate:process.env.PATROL_QA_CANDIDATE_URL};
if(!urls.baseline||!urls.candidate)throw Error('Both QA URLs are required');
const out='artifacts/nyc-dumbo-oti-perf';
await mkdir(out,{recursive:true});
const order=['baseline','candidate','candidate','baseline'];
const modes=['otiStreet','otiLowflight','street'];
const report={
  baselineSha:'0eff65fdd133c8c3bd2a762e407e967bc024e299',
  candidateSha:'53f00bd16b6520c161ed85db81f9fa3bf2065ebc',
  order,modes,observations:[],comparisons:[],errors:[],
  scope:'Chromium SwiftShader rAF interval at fixed 1075x605. NOT hardware GPU FPS.'
};
const assert=(v,s)=>{if(!v)throw Error(s);};
const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist',
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader'
]});
async function sample(page){
  return page.evaluate(()=>new Promise(resolve=>{
    const intervals=[];let prior=null;const start=performance.now();
    const finish=()=>{
      intervals.sort((a,b)=>a-b);
      const quantile=q=>intervals.length?Number(intervals[
        Math.floor((intervals.length-1)*q)].toFixed(2)):null;
      resolve({samples:intervals.length,p50Ms:quantile(.5),
        p95Ms:quantile(.95),elapsedMs:Math.round(performance.now()-start)});
    };
    const tick=t=>{
      if(prior!==null&&t>prior)intervals.push(t-prior);
      prior=t;
      if(intervals.length>=18||performance.now()-start>22000)finish();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
}
async function visit(variant,passIndex){
  const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('requestfailed',r=>{
    if(r.url().startsWith(urls[variant]))errors.push('Request: '+r.url());
  });
  try{
    await page.route('**/index.html',async route=>{
      const response=await route.fetch();
      const html=await response.text();
      const adapt='    if (rawDt > 0 && !document.hidden && !frameCheckPending) {';
      const tick='    sceneryTime += Math.min(rawDt, 0.12);';
      const camera='  function getScenicCamera() {';
      const traffic='  function prepareCityTraffic() {';
      const model='  function buildDumboOtiPilotSourceMesh(addTri,addQuad,lot,source,y){';
      for(const token of [adapt,tick,camera,traffic,model])
        assert(html.split(token).length===2,'QA source hook missing: '+token);
      const adapted=adapt.replace('if (','if (!window.__patrolPerfQaFixed && ');
      const frozen=tick+[
        '    if(window.__patrolPerfQaFixed){',
        '      if(resScale!==.84){resScale=.84;resizeTargets();}',
        '      sceneryTime=18;',
        '    }'
      ].join('\n');
      const fixedCamera=camera+[
        '    if(window.__patrolPerfQaMode){',
        '      const v={',
        '        street:{eye:[303,17.8,-367],look:[303,21.2,-347],up:worldUp,fov:64},',
        '        otiStreet:{eye:[381,17.7,-375],look:[381,22.4,-347],up:worldUp,fov:61},',
        '        otiLowflight:{eye:[379,40,-394],look:[380,27,-346],up:worldUp,fov:57}',
        '      };',
        '      return v[window.__patrolPerfQaMode];',
        '    }'
      ].join('\n');
      const modeSetter=[
        '  window.__patrolPerfQaSetMode=mode=>{',
        '    window.__patrolPerfQaMode=mode;',
        '    camInitialized=false;',
        '  };'
      ].join('\n')+'\n'+traffic;
      const sourceCounter=model+
        '\n    (window.__patrolPerfQaFids??=[]).push(source.fid);';
      const htmlQA=html.replace(adapt,adapted).replace(tick,frozen)
        .replace(camera,fixedCamera).replace(traffic,modeSetter)
        .replace(model,sourceCounter);
      await route.fulfill({response,body:htmlQA});
    });
    const response=await page.goto(urls[variant]+'/index.html',
      {waitUntil:'domcontentloaded',timeout:60000});
    assert(response?.ok(),'Cannot load '+variant+' source');
    await page.locator('input[name="flightMap"][value="manhattan"]').check({force:true});
    await page.locator('#startFlight').click({force:true});
    await page.waitForFunction(()=>{
      const title=document.getElementById('titleOverlay');
      const loading=document.getElementById('loadOverlay');
      return title?.hidden&&loading?.classList.contains('done');
    },null,{timeout:150000});
    await page.evaluate(()=>{
      for(const [id,value] of [['skyTime','12'],['skySeason','1'],['skyWeather','Clear']]){
        const el=document.getElementById(id);
        if(!el)throw Error('Missing environment '+id);
        el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));
      }
      window.__patrolPerfQaFixed=true;
    });
    await page.keyboard.press('h');
    await page.waitForFunction(()=>!document.getElementById('hotelViews')?.hidden,
      null,{timeout:15000});
    await page.locator('#hotelTarget').selectOption({label:'Brooklyn Bridge · Deck View'});
    const fids=await page.evaluate(()=>[...new Set(window.__patrolPerfQaFids||[])].sort());
    assert(JSON.stringify(fids)===JSON.stringify([1031082,1051309,1080628]),
      'Missing OTI source mesh: '+JSON.stringify(fids));
    for(const mode of modes){
      await page.evaluate(x=>window.__patrolPerfQaSetMode(x),mode);
      await page.evaluate(()=>new Promise(resolve=>
        requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const probe=()=>page.evaluate(()=>{
        const c=document.getElementById('glCanvas');
        const gl=c.getContext('webgl2');
        return {size:[c.width,c.height],healthy:!gl.isContextLost(),error:gl.getError()};
      });
      const before=await probe();
      assert(before.healthy&&before.error===0&&
        JSON.stringify(before.size)==='[1075,605]',
        'Fixed frame invalid: '+JSON.stringify({variant,mode,before}));
      const pacing=await sample(page);
      const after=await probe();
      assert(pacing.samples>=12&&pacing.p50Ms>0&&
        JSON.stringify(before)===JSON.stringify(after),
        'Insufficient stable rAF frames: '+JSON.stringify({variant,mode,pacing,before,after}));
      const row={variant,passIndex,mode,framebuffer:before.size,...pacing};
      report.observations.push(row);
      console.log('[OTI RAF A/B]',JSON.stringify(row));
      if(mode==='otiStreet'&&(passIndex===0||passIndex===1))
        await page.locator('#glCanvas').screenshot({
          path:out+'/'+variant+'-oti-street.png',timeout:60000});
    }
    assert(errors.length===0,'Browser errors: '+errors.join('; '));
  }finally{
    await page.close();
  }
}
try{
  for(let i=0;i<order.length;i++)await visit(order[i],i);
  for(const mode of modes){
    const values=variant=>report.observations
      .filter(r=>r.variant===variant&&r.mode===mode).map(r=>r.p50Ms);
    const a=values('baseline'),b=values('candidate');
    assert(a.length===2&&b.length===2,'Missing ABBA measurements for '+mode);
    const mean=x=>(x[0]+x[1])/2;
    report.comparisons.push({mode,baselineP50Ms:a,candidateP50Ms:b,
      deltaPercent:Number(((mean(b)/mean(a)-1)*100).toFixed(2)),
      note:'Two software-rasterized repeats; direction is descriptive, not hardware FPS'});
  }
  report.passed=true;
}catch(error){
  report.passed=false;
  report.errors.push(error.stack||String(error));
  process.exitCode=1;
}finally{
  await writeFile(out+'/raf-ab-report.json',JSON.stringify(report,null,2));
  console.log('[OTI RAF A/B RESULT]',JSON.stringify(report,null,2));
  await browser.close();
}
