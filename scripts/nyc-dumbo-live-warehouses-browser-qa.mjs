// QA: live NYC DUMBO warehouse selection + actual WebGL2 static camera PNGs.
// Modifies only Playwright's served HTML response; NEVER committed game HTML.
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {mkdir,writeFile} from 'node:fs/promises';

const base=(process.env.PATROL_BASE_URL||'http://127.0.0.1:8765').replace(/\/$/,'');
const output='artifacts/nyc-dumbo-warehouses';
await mkdir(output,{recursive:true});
const result={passed:false,errors:[],screenshots:[],sites:[],renderer:'unverified',testOnlyInjection:false};
const assert=(ok,message)=>{if(!ok)throw Error(message)};
const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist',
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader'
]});
const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
page.on('pageerror',e=>result.errors.push('pageerror '+e.message));
page.on('requestfailed',r=>{
 if(r.url().startsWith(base))result.errors.push('asset '+r.url());
});
const siteInsert=[
  'window.__patrolDumboRenderedSites ??= [];',
  'if(!window.__patrolDumboRenderedSites.some(p=>p.variant===variant))',
  ' window.__patrolDumboRenderedSites.push({x,y,z,w,d,h,variant});'
].join('\n');
const cameraInsert=[
  'window.__patrolDumboQaAddCameras = () => {',
  'const sites=window.__patrolDumboRenderedSites||[];',
  'for(const site of sites)for(const [style,viewHeight,bearing,radius,rise] of [',
  '  ["street",2.4,228,23,2.4],["low-flight",9,134,35,7]',
  ']){',
  'const name="QA DUMBO "+site.variant+" "+style;',
  'if(NYC_SCENIC_VIEWS.some(v=>v.site?.name===name))continue;',
  'NYC_SCENIC_VIEWS.push({site:{name},x:site.x,z:site.z,',
  ' height:viewHeight,bearing,radius,rise,',
  ' detail:"Test-only camera; original world geometry retained"});',
  '}',
  'prepareScenicViews();',
  'return {sites,available:NYC_SCENIC_VIEWS.filter(v=>',
  ' v.site?.name?.startsWith("QA DUMBO")).map(v=>v.site.name)};',
  '};'
].join('\n');
function pixels(bytes){
  const p=PNG.sync.read(bytes),bins=new Set();
  let black=0,n=0;
  for(let y=0;y<p.height;y+=12)for(let x=0;x<p.width;x+=12){
    const i=(y*p.width+x)*4,r=p.data[i],g=p.data[i+1],b=p.data[i+2];
    bins.add((r>>4)*256+(g>>4)*16+(b>>4));
    if(r+g+b<25)black++;n++;
  }
  return {width:p.width,height:p.height,colorBins:bins.size,darkFraction:black/Math.max(1,n)};
}
try {
  await page.route('**/index.html',async route=>{
    const response=await route.fetch();let html=await response.text();
    const siteMarker='    const {x,y,z,w,d,h,variant}=site;';
    const cameraMarker='  function getScenicCamera() {';
    assert(html.includes('PATROL_DUMBO_CORNER_WAREHOUSE_V1'),'PR #97 facade missing');
    assert(html.split(siteMarker).length===2,'Site insertion point changed');
    assert(html.split(cameraMarker).length===2,'Camera insertion point changed');
    html=html.replace(siteMarker,siteMarker+'\n'+siteInsert+'\n');
    html=html.replace(cameraMarker,cameraInsert+'\n'+cameraMarker);
    await route.fulfill({response,body:html});
    result.testOnlyInjection=true;
  });
  const response=await page.goto(base+'/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  assert(response?.ok(),'Launcher unavailable');
  await page.locator('input[name="flightMap"][value="manhattan"]').check({force:true});
  await page.locator('#startFlight').click({force:true});
  await page.waitForFunction(()=>{
    const menu=document.getElementById('titleOverlay');
    const load=document.getElementById('loadOverlay');
    return menu?.hidden&&load?.classList.contains('done');
  },null,{timeout:150000});
  await page.evaluate(()=>{
    for(const [id,value] of [['skyTime','12'],['skySeason','1'],['skyWeather','Clear']]){
      const el=document.getElementById(id);
      if(!el)throw Error('Climate control missing '+id);
      el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));
    }
  });
  const state=await page.evaluate(()=>{
    const canvas=document.getElementById('glCanvas'),gl=canvas?.getContext('webgl2');
    return {webgl2:!!gl&&!gl.isContextLost(),error:gl?.getError(),
      width:canvas?.width,height:canvas?.height};
  });
  assert(state.webgl2&&state.error===0,'WebGL2 error '+JSON.stringify(state));
  result.renderer='ANGLE SwiftShader / software WebGL2';
  result.webgl=state;
  result.sites=await page.evaluate(()=>window.__patrolDumboRenderedSites||[]);
  assert(result.sites.length===2,'Expected two ACTUALLY built facades, found '+JSON.stringify(result.sites));
  assert(result.sites.every(p=>[p.x,p.y,p.z,p.w,p.d,p.h].every(Number.isFinite)),
    'Non-finite warehouse dimensions');
  await page.keyboard.press('h');
  await page.waitForFunction(()=>!document.getElementById('hotelViews')?.hidden,
    null,{timeout:15000});
  const cameras=await page.evaluate(()=>window.__patrolDumboQaAddCameras());
  assert(cameras.available.length===4,'Four close cameras missing');
  await page.addStyleTag({content:
   'body.patrol-warehouse-qa *{visibility:hidden!important;}'+
   'body.patrol-warehouse-qa #glCanvas{visibility:visible!important;}'});
  for(const camera of cameras.available){
    await page.locator('#hotelTarget').selectOption({label:camera});
    await page.locator('#hotelZoom').evaluate(el=>{
      el.value='58';el.dispatchEvent(new Event('input',{bubbles:true}));
    });
    await page.waitForTimeout(1800);
    const gl=await page.evaluate(()=>{
      const g=document.getElementById('glCanvas')?.getContext('webgl2');
      return {healthy:!!g&&!g.isContextLost(),error:g?.getError()};
    });
    assert(gl.healthy&&gl.error===0,'Camera loses WebGL '+camera);
    const name=camera.replaceAll(' ','-').toLowerCase()+'.png';
    await page.evaluate(()=>document.body.classList.add('patrol-warehouse-qa'));
    let bytes;
    try{bytes=await page.locator('#glCanvas').screenshot({
      path:output+'/'+name,animations:'allow',timeout:90000
    });}finally{
      await page.evaluate(()=>document.body.classList.remove('patrol-warehouse-qa'));
    }
    const stats=pixels(bytes);
    assert(stats.colorBins>32&&stats.darkFraction<.96,'Blank camera '+JSON.stringify(stats));
    result.screenshots.push({name,camera,pixels:stats});
  }
  assert(result.errors.length===0,'Runtime errors '+result.errors.join('; '));
  result.passed=true;
}catch(e){
  result.errors.push(e.stack||String(e));process.exitCode=1;
}finally{
  await writeFile(output+'/report.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
  await browser.close();
}
