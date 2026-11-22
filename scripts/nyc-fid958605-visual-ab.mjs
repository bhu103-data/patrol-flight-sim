// QA-only A/B on the PR base and candidate, without changing game code.
// This camera is NOT a surveyed position: it reuses PATROL's existing
// Times Square scenic orbit and locks environment at midday.
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {mkdir,writeFile} from 'node:fs/promises';

const out='artifacts/nyc-fid958605';
await mkdir(out,{recursive:true});
const shots=[],errors=[];
const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist',
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader'
]});
const endpoints=[
  ['baseline','http://127.0.0.1:8766'],
  ['candidate','http://127.0.0.1:8765']
];
async function captureSite(label,base){
  const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(error.message));
  try{
    const res=await page.goto(base+'/index.html',
      {waitUntil:'domcontentloaded',timeout:60000});
    if(!res?.ok())throw Error(label+': launcher failed');
    await page.locator('input[name="flightMap"][value="manhattan"]').check({force:true});
    await page.locator('#startFlight').click({force:true});
    await page.waitForFunction(()=>{
      const title=document.getElementById('titleOverlay');
      const loading=document.getElementById('loadOverlay');
      return title?.hidden&&loading?.classList.contains('done');
    },null,{timeout:120000});
    await page.evaluate(()=>{
      for(const [id,val] of [['skyTime','12'],['skySeason','1'],
        ['skyWeather','Clear']]){
        const el=document.getElementById(id);
        if(!el)throw Error('Missing environment control: '+id);
        el.value=val;
        el.dispatchEvent(new Event('change',{bubbles:true}));
      }
    });
    await page.waitForTimeout(1500);
    await page.keyboard.press('h');
    await page.waitForFunction(()=>!document.getElementById('hotelViews')?.hidden,
      null,{timeout:15000});
    await page.locator('#hotelTarget').selectOption({label:'Times Square'});
    await page.locator('#hotelZoom').evaluate(el=>{
      el.value='42';el.dispatchEvent(new Event('input',{bubbles:true}));
    });
    await page.addStyleTag({content:
      'body.patrol-fid-qa * {visibility:hidden !important;} '+
      'body.patrol-fid-qa #glCanvas {visibility:visible !important;}'});
    for(const angle of [-24,0,24]){
      await page.locator('#hotelAngle').evaluate((el,v)=>{
        el.value=String(v);
        el.dispatchEvent(new Event('input',{bubbles:true}));
      },angle);
      await page.waitForTimeout(1400);
      const state=await page.evaluate(()=>{
        const canvas=document.getElementById('glCanvas');
        const gl=canvas?.getContext('webgl2');
        return {angle:Number(document.getElementById('hotelAngle')?.value),
          camera:document.getElementById('hotelTarget')?.selectedOptions?.[0]?.textContent,
          webgl:Boolean(gl&&!gl.isContextLost()),error:gl?.getError()??-1};
      });
      if(!state.webgl||state.error!==0||state.camera!=='Times Square'||
          state.angle!==angle)throw Error(label+': camera/GL state '+JSON.stringify(state));
      await page.evaluate(()=>document.body.classList.add('patrol-fid-qa'));
      // Page-level capture avoids Playwright's element-stability wait on
      // PATROL's continuously animated/re-sized WebGL canvas. The QA class
      // still hides every UI element except the actual game canvas.
      let pngBytes;
      try{pngBytes=await page.screenshot({
        path:out+'/'+label+'-orbit-'+(angle<0?'neg':'pos')+Math.abs(angle)+'.png',
        animations:'allow',timeout:75000
      });}finally{
        await page.evaluate(()=>document.body.classList.remove('patrol-fid-qa'));
      }
      const png=PNG.sync.read(pngBytes);
      const colors=new Set();
      for(let y=0;y<png.height;y+=12)for(let x=0;x<png.width;x+=12){
        const i=(y*png.width+x)*4;
        colors.add(((png.data[i]>>4)<<8)|
          ((png.data[i+1]>>4)<<4)|(png.data[i+2]>>4));
      }
      if(png.width<640||png.height<360||colors.size<25)
        throw Error(label+': blank or tiny screenshot for angle '+angle);
      shots.push({label,angle,pixels:{w:png.width,h:png.height,
        colorBins:colors.size},file:label+'-orbit-'+(angle<0?'neg':'pos')+
          Math.abs(angle)+'.png'});
    }
    if(pageErrors.length)throw Error(label+': JS errors '+pageErrors.join('; '));
  }finally{await page.close();}
}
let result;
try{
  for(const [label,base] of endpoints)await captureSite(label,base);
  if(shots.length!==6)throw Error('expected 2×3 fixed-camera screenshots');
  result={passed:true,renderer:'Chromium ANGLE SwiftShader WebGL2',
    scenes:['parent #142','PR candidate'],angles:[-24,0,24],
    camera:'Existing Times Square scenic orbit; environmental controls locked at noon',
    shots,errors,
    note:'These are actual game frames. Dynamic traffic, signs and pedestrians vary. No photorealism or native GPU FPS claim.'};
}catch(error){
  errors.push(error.stack||String(error));
  result={passed:false,shots,errors};
}finally{
  await writeFile(out+'/report.json',JSON.stringify(result,null,2));
  await browser.close();
}
process.stdout.write(JSON.stringify(result,null,2)+'\n');
if(!result.passed)process.exitCode=1;
