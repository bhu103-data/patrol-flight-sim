// Pixel-level A/B of the 1540 Broadway FID 1000156 duplicate in the actual PATROL scene.
// On THIS exact branch only, intercept the GIS module for the baseline page to remove
// the one targeted skip statement. Never change the source files or any shared branch.
// One fixed real Manhattan 44th Street camera, noon/clear, WebGL2; GIS-only hide is a
// control to distinguish source geometry from the LED/time dynamic background.
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';

const root=(process.env.PATROL_BASE_URL||'http://127.0.0.1:8765').replace(/\/$/,'');
const dir='artifacts/nyc-1540-source-ab';
await mkdir(dir,{recursive:true});
const src=await readFile(new URL('../assets/nyc/nyc-gis-infill.js',import.meta.url),'utf8');
const omit=[
  '    if(rec.fid===1000156 && named1540AlreadyRendered){',
  '      skippedMisregistered1540++;',
  '      continue;',
  '    }',
  ''
].join('\n');
const report={
  passed:false,
  exactSource:'source-exact skip-statement removal in browser response only',
  productionChange:false,
  fid:1000156,
  camera:'44th Street LED Canyon',
  roi:[600,5,800,408],
  baselineModuleIntercepts:0,
  screenshots:[],
  comparisons:{},
  errors:[]
};
const assert=(value,message)=>{if(!value)throw Error(message);};
const frames={};
let browser=null;
function compare(a,b){
  const x=frames[a],y=frames[b];
  assert(x&&y&&x.width===y.width&&x.height===y.height,
    'Missing/incompatible real camera frames: '+a+'/'+b);
  const [xmin,ymin,xmax,ymax]=report.roi;
  let count=0,large24=0,large45=0,rgbMean=0;
  for(let py=ymin;py<ymax;py+=2)for(let px=xmin;px<xmax;px+=2){
    const at=(py*x.width+px)*4;
    const differences=[0,1,2].map(k=>Math.abs(x.data[at+k]-y.data[at+k]));
    const max=Math.max(...differences);
    rgbMean+=(differences[0]+differences[1]+differences[2])/3;
    if(max>=24)large24++;
    if(max>=45)large45++;
    count++;
  }
  return {samples:count,changed24Fraction:+(large24/count).toFixed(4),
    changed45Fraction:+(large45/count).toFixed(4),
    meanAbsRgb:+(rgbMean/count).toFixed(2)};
}
async function runVariant(label,usePreFix){
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
  if(usePreFix){
    await context.route('**/assets/nyc/nyc-gis-infill.js*',async route=>{
      const response=await route.fetch();
      const actual=await response.text();
      assert(actual===src,'The baseline source differs from exact checkout');
      assert(actual.split(omit).length===2,
        'FID-only removal was not uniquely present in the imported source');
      report.baselineModuleIntercepts++;
      await route.fulfill({response,body:actual.replace(omit,'')});
    });
  }
  try{
    const page=await context.newPage();
    page.on('pageerror',e=>report.errors.push(label+': JS '+e.message));
    page.on('requestfailed',r=>{
      if(r.url().includes('/assets/nyc/')&&r.failure()?.errorText?.includes('ERR_'))
        report.errors.push(label+': asset '+r.url());
    });
    const response=await page.goto(root+'/index.html?nycVisualProbe=1',
      {waitUntil:'domcontentloaded',timeout:60000});
    assert(response?.ok(),label+': game failed to load');
    await page.locator('input[name="flightMap"][value="manhattan"]').check({force:true});
    await page.locator('#startFlight').click({force:true});
    await page.waitForFunction(()=>{
      const title=document.getElementById('titleOverlay');
      const load=document.getElementById('loadOverlay');
      return title?.hidden&&load?.classList.contains('done');
    },null,{timeout:120000});
    await page.evaluate(()=>{
      for(const [id,value] of [['skyTime','12'],['skySeason','1'],['skyWeather','Clear']]){
        const el=document.getElementById(id);
        if(!el)throw Error('Missing '+id);
        el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));
      }
    });
    await page.waitForFunction(()=>{
      const data=window.__patrolNycVisualProbe?.stats();
      return data?.city&&data?.proceduralTriangles>0&&data?.gisTriangles>0;
    },null,{timeout:60000});
    await page.keyboard.press('h');
    await page.waitForFunction(()=>!document.getElementById('hotelViews')?.hidden,
      null,{timeout:15000});
    await page.locator('#hotelZoom').evaluate(el=>{
      el.value='42';el.dispatchEvent(new Event('input',{bubbles:true}));
    });
    await page.locator('#hotelTarget').selectOption({label:report.camera});
    await page.addStyleTag({content:
      'body.patrol-qa-scene-only * {visibility:hidden!important} '+
      'body.patrol-qa-scene-only #glCanvas {visibility:visible!important}'});
    await page.waitForTimeout(1400);
    const initial=await page.evaluate(()=>window.__patrolNycVisualProbe.stats());
    assert(initial.city&&initial.gisTriangles>0,
      label+': source GIS mesh did not enter the real scene');
    for(const mode of ['none','gis','restored']){
      const hidden=mode==='restored'?'none':mode;
      const state=await page.evaluate(x=>
        window.__patrolNycVisualProbe.setHidden(x),hidden);
      assert(state.hidden===hidden,label+': wrong layer omission '+hidden);
      await page.waitForTimeout(650);
      const state2=await page.evaluate(()=>{
        const gl=document.getElementById('glCanvas')?.getContext('webgl2');
        return {good:Boolean(gl&&!gl.isContextLost()),error:gl?.getError(),
          selected:document.getElementById('hotelTarget')?.selectedOptions?.[0]?.textContent};
      });
      assert(state2.good&&state2.error===0&&state2.selected===report.camera,
        label+': WebGL/camera invalid '+JSON.stringify(state2));
      const name=label+'-'+mode;
      await page.evaluate(()=>document.body.classList.add('patrol-qa-scene-only'));
      let bytes;
      try{bytes=await page.locator('#glCanvas').screenshot({
        path:dir+'/'+name+'.png',timeout:90000
      });}finally{
        await page.evaluate(()=>document.body.classList.remove('patrol-qa-scene-only'));
      }
      const img=PNG.sync.read(bytes);
      assert(img.width===1280&&img.height===720,
        label+': incorrect screenshot size');
      frames[name]=img;
      report.screenshots.push({name,hidden});
    }
    report[label]={initial};
  }finally{await context.close();}
}
try{
  assert(src.split(omit).length===2,
    'Targeted FID removal is not exactly one source statement in this checkout');
  browser=await chromium.launch({headless:true,args:[
    '--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist',
    '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
    '--enable-unsafe-swiftshader'
  ]});
  await runVariant('before',true);
  await runVariant('after',false);
  assert(report.baselineModuleIntercepts>=1,
    'The original GIS module was never intercepted for the same-source baseline');
  const metrics={
    beforeGis:compare('before-none','before-gis'),
    afterGis:compare('after-none','after-gis'),
    sourceFix:compare('before-none','after-none'),
    noGisControl:compare('before-gis','after-gis'),
    beforeRestoration:compare('before-none','before-restored'),
    afterRestoration:compare('after-none','after-restored')
  };
  report.comparisons=metrics;
  report.afterToBeforeGisEffect=+(metrics.afterGis.changed45Fraction/
    Math.max(1e-8,metrics.beforeGis.changed45Fraction)).toFixed(4);
  // A successful source patch should cause a visible 44th Street difference,
  // while the same rendering with the GIS layer excluded should remain stable.
  // Fail with report evidence if the source-bound fix did not visibly help.
  assert(metrics.beforeGis.changed45Fraction>.20,
    'Baseline cannot reproduce a significant GIS occluder at this camera');
  assert(metrics.sourceFix.changed45Fraction>.10,
    'FID-only source fix did not visibly change the true 44th Street ROI');
  assert(metrics.afterGis.changed45Fraction<
    metrics.beforeGis.changed45Fraction*.8,
    'GIS occlusion remains too similar after the FID-specific fix');
  assert(metrics.noGisControl.changed45Fraction<.07,
    'The no-GIS control drifted; do not attribute dynamic pixels to a FID');
  assert(metrics.beforeRestoration.changed45Fraction<.06&&
    metrics.afterRestoration.changed45Fraction<.06,
    'Within-page time/lighting drift exceeds reliable static screenshot QA');
  assert(report.errors.length===0,
    'Browser errors: '+report.errors.join('; '));
  report.passed=true;
}catch(err){
  report.errors.push(err.stack||String(err));
  process.exitCode=1;
}finally{
  await writeFile(dir+'/report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  await browser?.close();
}
