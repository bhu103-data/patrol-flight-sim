// Live *in-game* native WebGL2 A/B of genuine GIS facade apertures.
// Default route is photographed first; nycArchitecture=1 only in second run.
// Captures are a visual regression aid, never a photorealism score.
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {mkdir,writeFile} from 'node:fs/promises';
const base=(process.env.PATROL_BASE_URL||'http://127.0.0.1:8765').replace(/\/$/,'');
const dir='artifacts/nyc-architecture-pilot';
await mkdir(dir,{recursive:true});
const result={passed:false,errors:[],warnings:[],captures:[],head:'Times Square GIS aperture, game-space opt-in'};
const assert=(condition,msg)=>{if(!condition)throw Error(msg)};
const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist',
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader'
]});
const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
page.on('pageerror',error=>result.errors.push(error.message));
page.on('requestfailed',request=>{
  if(request.url().includes('/assets/nyc/nyc-gis'))
    result.errors.push('NYC GIS fetch failed '+request.url());
});
const views=[
  ['Times Square Street Level','times-square-street'],
  ['44th Street LED Canyon','44th-street-canyon']
];
const captures={};
async function scene(enabled){
  const mode=enabled?'pilot':'legacy';
  const url=base+'/index.html'+(enabled?'?nycArchitecture=1':'');
  const r=await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  assert(r?.ok(),'PATROL page failed HTTP '+url);
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
      if(!el)throw Error('Missing NYC weather control: '+id);
      el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));
    }
  });
  if(enabled){
    await page.waitForFunction(()=>window.__patrolNycArchitectureQa?.windows>0,
      null,{timeout:60000});
    result.pilotMetrics=await page.evaluate(()=>window.__patrolNycArchitectureQa);
    assert(result.pilotMetrics.facades>0&&result.pilotMetrics.windows>0,
      'Real aperture mesh did not generate');
    assert(result.pilotMetrics.windows<=280&&result.pilotMetrics.facades<=28,
      'Facade budget exceeded');
    assert(result.pilotMetrics.sourceBuildings>=1,'Official NYC FID geometry absent');
  }else{
    assert(await page.evaluate(()=>window.__patrolNycArchitectureQa===undefined),
      'Default scene mistakenly enabled architectural pilot');
  }
  await page.keyboard.press('h');
  await page.waitForFunction(()=>!document.getElementById('hotelViews')?.hidden,
    null,{timeout:15000});
  await page.locator('#hotelZoom').evaluate(el=>{
    el.value='42';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.addStyleTag({content:
    'body.patrol-qa-scene-only *{visibility:hidden!important}'+
    'body.patrol-qa-scene-only #glCanvas{visibility:visible!important}'});
  for(const [label,suffix] of views){
    await page.locator('#hotelTarget').selectOption({label});
    await page.waitForTimeout(1350);
    const status=await page.evaluate(()=>{
      const gl=document.getElementById('glCanvas')?.getContext('webgl2');
      return {webgl:Boolean(gl&&!gl.isContextLost()),error:gl?.getError()??null,
        label:document.getElementById('hotelTarget')?.selectedOptions?.[0]?.textContent};
    });
    assert(status.webgl&&status.error===0&&status.label===label,
      mode+' WebGL lost or camera mismatch: '+JSON.stringify(status));
    await page.evaluate(()=>document.body.classList.add('patrol-qa-scene-only'));
    let image;
    try{
      image=await page.locator('#glCanvas').screenshot({
        path:dir+'/'+mode+'-'+suffix+'.png',timeout:90000});
    }finally{
      await page.evaluate(()=>document.body.classList.remove('patrol-qa-scene-only'));
    }
    const png=PNG.sync.read(image);
    assert(png.width>=640&&png.height>=360,'Blank or tiny WebGL canvas');
    captures[mode+'-'+suffix]=png;
    result.captures.push({mode,label,file:mode+'-'+suffix+'.png',
      width:png.width,height:png.height,status});
  }
}
function compare(label){
  const a=captures['legacy-'+label],b=captures['pilot-'+label];
  assert(a&&b&&a.width===b.width&&a.height===b.height,'Missing matched images');
  let n=0,large=0,sum=0;
  for(let y=0;y<a.height;y+=4)for(let x=0;x<a.width;x+=4){
    const i=(y*a.width+x)*4;
    const d=Math.max(...[0,1,2].map(k=>Math.abs(a.data[i+k]-b.data[i+k])));
    n++;sum+=d;if(d>=28)large++;
  }
  return {samples:n,changedOver28:large,changedFraction:Number((large/n).toFixed(4)),
    meanMaximumRgbDifference:Number((sum/n).toFixed(2)),
    caution:'Weather controlled but traffic/LED animation/capture timing are not identical'};
}
try{
  await scene(false);
  await scene(true);
  result.compare=Object.fromEntries(views.map(([,label])=>[label,compare(label)]));
  assert(result.captures.length===4,'Expected exactly four matched live game images');
  assert(result.errors.length===0,'JS or GIS failures: '+result.errors.join('; '));
  result.passed=true;
}catch(error){
  result.errors.push(error.stack||String(error));
  process.exitCode=1;
}finally{
  await writeFile(dir+'/report.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
  await browser.close();
}
