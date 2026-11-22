// QA-only, source-derived DUMBO FID1080628 live WebGL2 rAF A/B. No production edits.
import {chromium} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {PNG} from 'pngjs';

const urls={baseline:process.env.PATROL_QA_BASELINE_URL,
            candidate:process.env.PATROL_QA_CANDIDATE_URL};
if(!urls.baseline||!urls.candidate)throw Error('Both QA URLs are required');
const out='artifacts/nyc-dumbo-fid1080628';
await mkdir(out,{recursive:true});
const order=['baseline','candidate','candidate','baseline'];
const modes=['fidRoof','otiStreet'];
const report={
  expectedFid:1080628,
  roofSource:'NYC OTI BUILDING_view footprint + HEIGHT_ROOF; interior tier authored, not surveyed',
  baselineSha:'91fb2191040e088ec26b2cd884aedffc0e5e6171',
  candidateSha:process.env.PATROL_QA_CANDIDATE_SHA||'current PR head',
  order,modes,observations:[],comparisons:[],visualComparisons:[],errors:[],warnings:[],
  visualPassed:false,performanceStatus:'pending',
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
    const intervals=[];let prior=null,finished=false;
    const start=performance.now();
    const finish=()=>{
      if(finished)return;
      finished=true;clearTimeout(timer);
      intervals.sort((a,b)=>a-b);
      const quantile=q=>intervals.length?Number(intervals[
        Math.floor((intervals.length-1)*q)].toFixed(2)):null;
      resolve({samples:intervals.length,p50Ms:quantile(.5),
        p95Ms:quantile(.95),elapsedMs:Math.round(performance.now()-start),
        complete:intervals.length>=12});
    };
    // SwiftShader may pause rAF for seconds on a busy city scene. Bound the
    // probe even if the browser stops delivering callbacks; this is an
    // inconclusive software pacing result, not a false visual-test failure.
    const timer=setTimeout(finish,30000);
    const tick=t=>{
      if(finished)return;
      if(prior!==null&&t>prior)intervals.push(t-prior);
      prior=t;
      if(intervals.length>=12)finish();
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
      for(const token of [adapt,tick,camera,traffic])
        assert(html.split(token).length===2,'QA source hook missing: '+token);
      const modelCount=html.split(model).length-1;
      const expectedModelCount=variant==='candidate'?1:0;
      assert(modelCount===expectedModelCount,
        'Unexpected OTI source-mesh baseline/candidate state: '+
          JSON.stringify({variant,modelCount,expectedModelCount}));
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
        '        fidRoof:{eye:[378,43,-370],look:[366.89,34,-346.09],up:worldUp,fov:46},',
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
      let htmlQA=html.replace(adapt,adapted).replace(tick,frozen)
        .replace(camera,fixedCamera).replace(traffic,modeSetter);
      // The parent #211 baseline intentionally has no OTI pilot helper.
      // Instrument the source function only in the candidate, then assert
      // the baseline emits zero FIDs and the candidate emits all three.
      if(variant==='candidate')htmlQA=htmlQA.replace(model,sourceCounter);
      await route.fulfill({response,body:htmlQA});
    });
    const loadStart=Date.now();
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
    const firstLoadMs=Date.now()-loadStart;
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
    const expectedFids=variant==='candidate'?[1031082,1051309,1080628]:[];
    assert(JSON.stringify(fids)===JSON.stringify(expectedFids),
      'Unexpected OTI source mesh FIDs: '+JSON.stringify({variant,fids,expectedFids}));
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
      assert(JSON.stringify(before)===JSON.stringify(after),
        'WebGL context/framebuffer changed during bounded sample: '+
          JSON.stringify({variant,mode,pacing,before,after}));
      const perfMeasured=pacing.samples>=10&&Number.isFinite(pacing.p50Ms)&&
        Number.isFinite(pacing.p95Ms);
      const row={variant,passIndex,mode,firstLoadMs,framebuffer:before.size,
        sourceFids:fids,...pacing,
        performanceStatus:perfMeasured?'measured':'inconclusive'};
      if(!perfMeasured)report.warnings.push(
        variant+'/'+mode+': SwiftShader delivered only '+pacing.samples+
        ' rAF intervals in '+pacing.elapsedMs+'ms; performance comparison omitted');
      report.observations.push(row);
      console.log('[OTI RAF A/B]',JSON.stringify(row));
      if(passIndex===0||passIndex===1){
        await page.addStyleTag({content:
          'body.patrol-roof-qa *{visibility:hidden!important}'+
          'body.patrol-roof-qa #glCanvas{visibility:visible!important}'});
        await page.evaluate(()=>document.body.classList.add('patrol-roof-qa'));
        try{
          await page.locator('#glCanvas').screenshot({
            path:out+'/'+variant+'-'+mode+'.png',timeout:90000});
        }finally{
          await page.evaluate(()=>document.body.classList.remove('patrol-roof-qa'));
        }
      }
    }
    assert(errors.length===0,'Browser errors: '+errors.join('; '));
  }finally{
    await page.close();
  }
}
try{
  for(let i=0;i<order.length;i++)await visit(order[i],i);
  for(const mode of modes){
    const baselinePath=out+'/baseline-'+mode+'.png';
    const candidatePath=out+'/candidate-'+mode+'.png';
    const a=PNG.sync.read(await readFile(baselinePath));
    const b=PNG.sync.read(await readFile(candidatePath));
    assert(a.width===b.width&&a.height===b.height,
      'Matched-camera screenshot dimensions differ for '+mode);
    let changed=0,sum=0,minX=a.width,minY=a.height,maxX=-1,maxY=-1;
    const total=a.width*a.height;
    for(let y=0;y<a.height;y++)for(let x=0;x<a.width;x++){
      const i=(y*a.width+x)*4;
      const delta=(Math.abs(a.data[i]-b.data[i])+
        Math.abs(a.data[i+1]-b.data[i+1])+
        Math.abs(a.data[i+2]-b.data[i+2]))/3;
      sum+=delta;
      if(delta>8){
        changed++;minX=Math.min(minX,x);minY=Math.min(minY,y);
        maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
      }
    }
    const visual={mode,width:a.width,height:a.height,
      changedPixelsOver8:changed,changedPercent:Number((changed/total*100).toFixed(4)),
      meanRgbDelta:Number((sum/total).toFixed(4)),
      changedBounds:maxX>=0?[minX,minY,maxX,maxY]:null};
    const minimum=mode==='fidRoof'?200:40;
    assert(changed>=minimum,
      'Source-derived Nexus facade/roof is not visibly changed in matched '+mode+
      ' view: '+JSON.stringify(visual));
    report.visualComparisons.push(visual);
  }
  report.visualPassed=true;
  const complete=report.observations.every(r=>r.performanceStatus==='measured');
  report.performanceStatus=complete?'measured':'inconclusive-swiftshader';
  if(complete){
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
  }else{
    report.warnings.push('At least one SwiftShader view produced fewer than 10 rAF intervals; no performance pass/fail or FPS claim.');
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
