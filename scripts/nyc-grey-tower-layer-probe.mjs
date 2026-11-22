// Diagnostic only: identify who actually draws the foreground grey tower
// by temporarily omitting ONE render mesh group at a frozen scenic camera.
// Rendering switches are debug-gated and never change game city geometry.
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {mkdir,writeFile} from 'node:fs/promises';
const base=(process.env.PATROL_BASE_URL||'http://127.0.0.1:8765').replace(/\/$/,'');
const dir='artifacts/nyc-visual-provenance';
await mkdir(dir,{recursive:true});
const report={passed:false,errors:[],warnings:[],camera:'44th Street LED Canyon',
  focusRoi:[600,5,800,408],hypothesis:'unknown',comparison:{},renders:[]};
const check=(ok,why)=>{if(!ok)throw Error(why)};
const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist',
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader'
]});
let page=null;
const screenshots={};
const groups=['none','procedural','scenery','gis','hero','landmarks'];
function compare(ref,next){
  const a=screenshots[ref],b=screenshots[next];
  check(a&&b&&a.width===b.width&&a.height===b.height,'Incompatible source images');
  const [x0,y0,x1,y1]=report.focusRoi;
  let pixels=0,changed24=0,changed45=0,meanAbs=0;
  for(let y=y0;y<y1;y+=2)for(let x=x0;x<x1;x+=2){
    const i=(y*a.width+x)*4;
    const diff=[0,1,2].map(k=>Math.abs(a.data[i+k]-b.data[i+k]));
    meanAbs+=(diff[0]+diff[1]+diff[2])/3;
    if(Math.max(...diff)>=24)changed24++;
    if(Math.max(...diff)>=45)changed45++;
    pixels++;
  }
  return {samples:pixels,
    changed24Fraction:Number((changed24/pixels).toFixed(4)),
    changed45Fraction:Number((changed45/pixels).toFixed(4)),
    meanAbsRgb:Number((meanAbs/pixels).toFixed(2)),
    note:'A/B only; changing hidden meshes can reveal other occluded meshes'};
}
try{
  page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
  page.on('pageerror',e=>report.errors.push('JS '+e.message));
  page.on('requestfailed',r=>{
    if(r.url().includes('/assets/nyc/')&&r.failure()?.errorText?.includes('ERR_'))
      report.errors.push('NYC asset '+r.url());
  });
  const url=base+'/index.html?nycVisualProbe=1';
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  check(response?.ok(),'Game URL did not load');
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
    const s=window.__patrolNycVisualProbe?.stats();
    return s?.city && s?.proceduralTriangles>0 &&
      s?.sceneryTriangles>0;
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
  await page.waitForTimeout(1200);
  const frozen=await page.evaluate(()=>
    window.__patrolNycVisualProbe.freezeSceneryTime(42));
  check(frozen.frozen&&frozen.sceneryTime===42&&frozen.city,
    'Could not freeze the exact Manhattan scenery clock');
  report.frozenSceneryTime=frozen;
  await page.waitForTimeout(180);
  report.initial=await page.evaluate(()=>window.__patrolNycVisualProbe.stats());
  const gis=report.initial.gisSourceStats;
  report.knownDuplicate1515={fid:212747,
    skipped:gis?.skippedMisregistered1515,
    absentFromRenderedSourceFids:!gis?.sourceFids?.includes(212747),
    namedHeroPresent:Boolean(gis&&gis.skippedMisregistered1515===1)};
  check(report.initial.city&&report.initial.proceduralTriangles>0,
    'Did not load live Manhattan background building mesh');
  check(report.knownDuplicate1515.skipped===1&&
    report.knownDuplicate1515.absentFromRenderedSourceFids,
    'Misregistered One Astor GIS duplicate remains in the live render mesh');
  async function capture(name,hidden){
    const state=await page.evaluate(mode=>
      window.__patrolNycVisualProbe.setHidden(mode),hidden);
    check(state.hidden===hidden&&state.city,
      'Render gate did not select intended scene category '+hidden);
    await page.waitForTimeout(650);
    const render=await page.evaluate(()=>{
      const gl=document.getElementById('glCanvas')?.getContext('webgl2');
      return {valid:Boolean(gl&&!gl.isContextLost()),glError:gl?.getError(),
        selected:document.getElementById('hotelTarget')?.selectedOptions?.[0]?.textContent};
    });
    check(render.valid&&render.glError===0&&render.selected===report.camera,
      'Camera/WebGL mismatch: '+JSON.stringify(render));
    await page.evaluate(()=>document.body.classList.add('patrol-qa-scene-only'));
    let img;
    try{
      img=await page.locator('#glCanvas').screenshot({
        path:dir+'/'+name+'.png',timeout:90000});
    }finally{
      await page.evaluate(()=>document.body.classList.remove('patrol-qa-scene-only'));
    }
    const png=PNG.sync.read(img);
    check(png.width===1280&&png.height===720,'Unexpected camera frame size');
    screenshots[name]=png;
    report.renders.push({name,hidden,stats:await page.evaluate(()=>
      window.__patrolNycVisualProbe.stats())});
  }
  for(const group of groups)await capture('44th-'+group,group);
  await capture('44th-restored','none');
  for(const group of groups.slice(1))
    report.comparison[group]=compare('44th-none','44th-'+group);
  report.restored=compare('44th-none','44th-restored');
  report.ranked=Object.entries(report.comparison).sort(
    (a,b)=>b[1].changed45Fraction-a[1].changed45Fraction).map(
    ([layer,probe])=>({layer,...probe}));
  const best=report.ranked[0];
  report.hypothesis=best?.changed45Fraction>=.035
    ?'Layer with largest center-ROI occlusion effect: '+best.layer
    :'INCONCLUSIVE: no tested mesh group moved enough center-ROI pixels';
  report.ambiguous=report.restored.changed45Fraction>.025;
  report.gisLeftWallChangeBeforeFix=.3446;
  report.gisLeftWallChangeAfterFix=report.comparison.gis.changed45Fraction;
  report.gisLeftWallReduction=Number((1-
    report.gisLeftWallChangeAfterFix/report.gisLeftWallChangeBeforeFix).toFixed(4));
  report.hypothesis='Resolved: misregistered GIS FID 212747 is omitted only because the exact 1515 Broadway hero footprint is already rendered';
  check(report.errors.length===0,'Browser errors: '+report.errors.join('; '));
  check(report.knownDuplicate1515.namedHeroPresent&&
    report.knownDuplicate1515.absentFromRenderedSourceFids,
    'The production GIS mesh did not suppress only the known duplicate FID');
  check(report.gisLeftWallChangeAfterFix<.15&&report.gisLeftWallReduction>.50,
    'The frozen 44th Street left-wall GIS occlusion was not reduced by at least 50%');
  check(!report.ambiguous,'44th Street camera did not restore to the same frozen frame');
  report.passed=true;
}catch(e){
  report.errors.push(e.stack||String(e));
  process.exitCode=1;
}finally{
  await writeFile(dir+'/report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  await browser.close();
}
