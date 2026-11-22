// Real Chromium WebGL2 integration audit of the committed original Empire State Building GLB.
// npm install --no-save playwright@1.56.1 && npx playwright install chromium
// python3 -m http.server 8765 --bind 127.0.0.1 &
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({
  headless:true,
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
        '--enable-unsafe-swiftshader','--disable-dev-shm-usage','--no-sandbox']
});
const faults=[];
let audit={status:'FAIL',reason:'Not yet loaded'};
try{
  const page=await browser.newPage({viewport:{width:1120,height:900}});
  page.on('pageerror',e=>faults.push('pageerror: '+e.message));
  page.on('console',m=>{if(m.type()==='error')faults.push('console: '+m.text())});
  const origin=process.env.PATROL_LOCAL_ORIGIN||'http://127.0.0.1:8765';
  const response=await page.goto(origin+'/tools/scenario_model_preview.html?asset=empire',
    {waitUntil:'domcontentloaded',timeout:45000});
  assert.equal(response?.status(),200);
  await page.waitForFunction(()=>{
    const state=document.getElementById('state');
    return state&&['PASS','FAIL'].includes(state.dataset.status);
  },null,{timeout:90000});

  audit=await page.evaluate(async()=>{
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const state=document.getElementById('state');
    const value=id=>document.getElementById(id)?.textContent||'';
    const canvas=document.getElementById('preview');
    const gl=canvas.getContext('webgl2');
    if(!gl)throw Error('No WebGL2');
    const pixels=new Uint8Array(canvas.width*canvas.height*4);
    gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    let lit=0,foreground=0;
    for(let i=0;i<pixels.length;i+=4){
      const r=pixels[i],g=pixels[i+1],b=pixels[i+2];
      if(r>42&&g>42&&b>42)foreground++;
      if(r>80&&g>80&&b>80)lit++;
    }
    return {status:state.dataset.status,text:state.textContent,
      triangles:value('triangles'),footprint:value('footprint'),
      height:value('height'),atlas:value('atlas'),
      source:value('source'),foreground,lit,webglError:gl.getError()};
  });
  await page.screenshot({path:'artifacts/empire-generated-glb-webgl.png',fullPage:true});
  audit.consoleErrors=faults;
  await writeFile('artifacts/empire-webgl-audit.json',
    JSON.stringify(audit,null,2)+'\n');
  console.log(JSON.stringify(audit,null,2));
  assert.equal(audit.status,'PASS',audit.text);
  assert.match(audit.text,/Empire State Building/i);
  const triangleCount=Number(audit.triangles.replaceAll(',',''));
  assert.ok(Number.isInteger(triangleCount)&&triangleCount>=700&&triangleCount<=25000,
    'Imported Empire model must stay within the production GLB triangle budget');
  assert.ok(['Embedded PNG/JPEG','Material colors'].includes(audit.atlas),
    'Imported model must use a supported Base Color representation');
  assert.ok(audit.foreground>1000,'Actual rendered model must occupy visible pixels');
  assert.equal(audit.webglError,0);
  assert.equal(faults.length,0,'Browser errors '+faults.join('; '));
  console.log('PASS: actual '+triangleCount+'-triangle Empire GLB drawn with PATROL WebGL2 decoder');
}catch(e){
  await writeFile('artifacts/empire-webgl-failure.txt',
    String(e.stack||e)+'\n'+JSON.stringify(audit,null,2));
  throw e;
}finally{await browser.close()}
