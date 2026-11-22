// Browser-only matched-camera real PATROL Manhattan WebGL2 evidence.
// The real manifest is NEVER intercepted; only ?nycModels=libertyCC0 requests
// the exact source-reviewed model. QA instrumentation is not committed to HTML.
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base=(process.env.PATROL_BASE_URL||'http://127.0.0.1:8765').replace(/\/$/,'');
const dir='artifacts/nyc-liberty-cc0-live';
await mkdir(dir,{recursive:true});
const result={passed:false,errors:[],renderer:'Chromium WebGL2 SwiftShader (not native GPU)'};
const check=(cond,msg)=>{if(!cond)throw Error(msg)};
const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
async function visit(mode){
  const page=await browser.newPage({viewport:{width:1280,height:720},
    deviceScaleFactor:1});
  const bad=[],requests=[],status=[];
  page.on('pageerror',e=>bad.push(e.message));
  page.on('request',r=>{
    if(r.url().endsWith('/assets/nyc/scenario/liberty.glb'))requests.push(r.url());
  });
  page.on('response',r=>{
    if(r.url().endsWith('/assets/nyc/scenario/liberty.glb'))status.push(r.status());
  });
  await page.route('**/index.html*',async route=>{
    const response=await route.fetch();
    check(response.ok(),'Original PATROL launch HTTP missing');
    let html=await response.text();
    const anchor='  // Web Audio Synthesizer (Muted by default)';
    check(html.includes(anchor),'Game physics anchor unavailable');
    const hook=[
      '  window.__patrolLibertyOptInQa=()=>{',
      '    const m=nycRealismAssets?.models?.liberty;',
      '    return {ready:!!m && !!nycRealismAssets,city:!!selectedMap.city,',
      "      source:m?.source||'bundled',triangles:m?.triangleCount||0,",
      '      dimensions:m?.dimensions||null,',
      '      failures:nycRealismAssets?.failures||[],',
      '      collision:libertyScenarioRadialCollision(0,0,20),',
      '      aircraft:selectedAircraft,',
      '      contextLost:gl.isContextLost(),error:gl.getError()};',
      '  };'
    ].join('\n')+'\n';
    html=html.replace(anchor,hook+anchor);
    const scenic='const NYC_SCENIC_VIEWS=[';
    check(html.includes(scenic),'Scenic camera anchor unavailable');
    html=html.replace(scenic,scenic+
      "\n    {name:'Liberty Base CC0 QA',x:-140,z:-611,height:5,bearing:173,"+
      "radius:38,rise:1.5,detail:'Browser-only fixed camera'},");
    await route.fulfill({response,body:html,
      contentType:'text/html; charset=utf-8',
      headers:{...response.headers(),'cache-control':'no-store'}});
  });
  try{
    const res=await page.goto(base+'/index.html?nycModels='+mode,
      {waitUntil:'domcontentloaded',timeout:60000});
    check(res?.ok(),'Launcher failed');
    await page.locator('input[name="flightMap"][value="manhattan"]').check({force:true});
    await page.locator('input[name="aircraft"][value="seaplane"]').check({force:true});
    await page.locator('#startFlight').click({force:true});
    await page.waitForFunction(()=>{
      return document.getElementById('titleOverlay')?.hidden &&
        document.getElementById('loadOverlay')?.classList.contains('done') &&
        window.__patrolLibertyOptInQa?.().ready;
    },null,{timeout:120000});
    await page.evaluate(()=>{
      for(const [id,value] of [['skyTime','12'],['skySeason','1'],['skyWeather','Clear']]){
        const el=document.getElementById(id);
        if(!el)throw Error('Weather control missing '+id);
        el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));
      }
    });
    await page.keyboard.press('h');
    await page.waitForFunction(()=>!document.getElementById('hotelViews')?.hidden,
      null,{timeout:15000});
    await page.locator('#hotelTarget').selectOption({label:'Statue of Liberty'});
    await page.locator('#hotelZoom').evaluate(el=>{
      el.value='42';el.dispatchEvent(new Event('input',{bubbles:true}));
    });
    await page.waitForTimeout(850);
    const state=await page.evaluate(()=>window.__patrolLibertyOptInQa());
    check(state.city && state.aircraft==='seaplane' && !state.contextLost&&
      state.error===0,'Live PATROL failed '+JSON.stringify(state));
    check(state.collision===true,'Real statue collision logic missing');
    if(mode==='libertyCC0'){
      check(state.source==='scenario' && state.triangles===15900,
        'Candidate not active '+JSON.stringify(state));
      check(Math.abs(state.dimensions.height-31.3)<.01 &&
        Math.abs(state.dimensions.width-9.323)<.04 &&
        Math.abs(state.dimensions.depth-9.323)<.04,
        'GLB dims differ from source-specific collider');
      check(requests.length>0 && status.includes(200),
        'CC0 model never loaded through real manifest path');
      check(!state.failures.some(x=>x.startsWith('scenario liberty:')),
        'CC0 candidate fallback '+JSON.stringify(state.failures));
    }else{
      check(state.source!=='scenario' && requests.length===0,
        'Disabled CC0 loaded without explicit opt-in');
    }
    const snapshots=[];
    async function snap(label){
      await page.addStyleTag({content:
        'body.liberty-qa *{visibility:hidden!important} '+
        'body.liberty-qa #glCanvas{visibility:visible!important}'});
      await page.evaluate(()=>document.body.classList.add('liberty-qa'));
      try{
        const bytes=await page.locator('#glCanvas').screenshot({
          path:dir+'/'+mode+'-'+label+'.png',timeout:90000});
        const png=PNG.sync.read(bytes),bins=new Set();
        for(let y=32;y<png.height;y+=8)for(let x=0;x<png.width;x+=8){
          const i=(y*png.width+x)*4;
          bins.add((png.data[i]>>4)*256+(png.data[i+1]>>4)*16+(png.data[i+2]>>4));
        }
        check(png.width===1280&&png.height===720&&bins.size>40,
          'Blank or wrong-size WebGL screenshot');
        snapshots.push({label,sha:createHash('sha256').update(bytes).digest('hex'),
          colors:bins.size});
        return bytes;
      }finally{await page.evaluate(()=>document.body.classList.remove('liberty-qa'))}
    }
    const front=await snap('front');
    await page.locator('#hotelTarget').selectOption({label:'Liberty Base CC0 QA'});
    await page.locator('#hotelZoom').evaluate(el=>{
      el.value='60';el.dispatchEvent(new Event('input',{bubbles:true}));
    });
    await page.waitForTimeout(650);
    const close=await snap('harbor-close');
    const timing=await page.evaluate(async()=>{
      const samples=[];let last=performance.now();
      for(let i=0;i<44;i++){
        await new Promise(done=>requestAnimationFrame(done));
        const t=performance.now();if(i>3)samples.push(t-last);last=t;
      }
      samples.sort((a,b)=>a-b);
      return {samples:samples.length,p50Ms:samples[Math.floor(samples.length*.5)],
        p95Ms:samples[Math.floor(samples.length*.95)]};
    });
    check(bad.length===0,'Page JS errors: '+bad.join('; '));
    return {state,snapshots,front,close,timing,modelRequests:requests.length,
      modelResponses:status};
  }finally{await page.close();}
}
function diff(a,b,roi){
  const A=PNG.sync.read(a),B=PNG.sync.read(b);
  let changed=0,n=0;
  for(let y=roi[1];y<roi[3];y++)for(let x=roi[0];x<roi[2];x++){
    const off=(y*A.width+x)*4;
    const d=Math.max(Math.abs(A.data[off]-B.data[off]),
      Math.abs(A.data[off+1]-B.data[off+1]),
      Math.abs(A.data[off+2]-B.data[off+2]));
    changed+=d>30?1:0;n++;
  }
  return changed/n;
}
try{
  const old=await visit('normal'),modern=await visit('libertyCC0');
  result.source={state:old.state,snapshots:old.snapshots,timing:old.timing};
  result.cc0={state:modern.state,snapshots:modern.snapshots,
    timing:modern.timing,requests:modern.modelRequests,
    responses:modern.modelResponses};
  result.changedFrontFraction=diff(old.front,modern.front,[500,70,780,610]);
  result.changedCloseFraction=diff(old.close,modern.close,[350,40,920,670]);
  check(result.changedFrontFraction>.035,'No actual fixed-camera landmark improvement');
  check(result.changedCloseFraction>.05,'No actual near-Liberty mesh variation');
  const manifest=JSON.parse(await readFile('assets/nyc/scenario-manifest.json','utf8'));
  check(manifest.landmarks.liberty.enabled===false,'Default activation changed');
  result.passed=true;
}catch(e){result.errors.push(e.stack||String(e));process.exitCode=1}
finally{
  await writeFile(dir+'/report.json',JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
  await browser.close();
}
