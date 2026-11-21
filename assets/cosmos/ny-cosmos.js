/* The universe now lives inside the Manhattan flight document.
 * One lazy Three.js context; paused when the player returns to the city.
 */
let layer=null, active=false, viewerPromise=null, latestFlight=null;
function mountLayer(){
  if(layer)return;
  const style=document.createElement('style');
  style.textContent=[
    '#nyCosmosLayer{position:absolute;inset:0;z-index:80;background:#020714;color:#e8f5ff;font:13px/1.5 system-ui,sans-serif;pointer-events:none;visibility:hidden;opacity:0;transition:opacity .85s ease,visibility 0s linear .85s}',
    '#nyCosmosLayer.active{pointer-events:auto;visibility:visible;opacity:1;transition:opacity .85s ease}',
    '#nyCosmosLayer *{box-sizing:border-box}',
    '#nyCosmosLayer #universe{position:absolute;inset:0;width:100%;height:100%;touch-action:none;display:block;image-rendering:auto}',
    '#nyCosmosLayer #ui{position:absolute;inset:0;pointer-events:none}',
    '#nyCosmosLayer .cos-panel{background:#09192bdf;border:1px solid #8ac7e85c;border-radius:12px;box-shadow:0 6px 30px #0009;backdrop-filter:blur(12px)}',
    '#nyCosmosLayer #header{position:absolute;left:16px;top:16px;max-width:340px;padding:12px 16px}',
    '#nyCosmosLayer #header h1{font-size:22px;margin:0 0 7px;letter-spacing:1.4px;color:#ffdfaa}',
    '#nyCosmosLayer #header p{font-size:12px;margin:4px 0;color:#c3dcf2}',
    '#nyCosmosLayer #controls{position:absolute;top:16px;right:16px;width:270px;padding:12px;pointer-events:auto}',
    '#nyCosmosLayer #controls h2{font-size:13px;margin:0 0 11px;color:#cee4fb}',
    '#nyCosmosLayer #tabs{display:flex;gap:5px}',
    '#nyCosmosLayer button,#nyCosmosLayer #back{cursor:pointer;border:1px solid #7ba8c5;border-radius:6px;background:#163456;color:#eaf4ff;font:inherit;padding:7px;text-decoration:none}',
    '#nyCosmosLayer #tabs button{flex:1;font-size:11px}',
    '#nyCosmosLayer label{display:block;font-size:12px;margin:10px 0 4px;color:#bcdcf1}',
    '#nyCosmosLayer #destination{width:100%;padding:8px;font:inherit;border:1px solid #89bad7;border-radius:6px;background:#102840;color:#fff}',
    '#nyCosmosLayer #timeScale{width:100%;accent-color:#edbc7c}',
    '#nyCosmosLayer #footer{position:absolute;bottom:17px;left:17px;right:17px;display:flex;align-items:end;justify-content:space-between;gap:12px}',
    '#nyCosmosLayer #flightInfo{padding:10px 13px;font:12px/1.55 ui-monospace,monospace;white-space:pre-line;max-width:min(410px,65vw)}',
    '#nyCosmosLayer #back{pointer-events:auto;padding:11px 14px;text-align:center;max-width:190px}',
    '#nyCosmosLayer #loading{position:absolute;inset:0;z-index:5;display:grid;place-items:center;background:radial-gradient(ellipse,#183454,#020812 72%);text-align:center;pointer-events:none;transition:opacity .8s ease}',
    '#nyCosmosLayer #loading.hidden{opacity:0}',
    '#nyCosmosLayer #loading strong{font-size:21px;color:#ffe2ac}',
    '#nyCosmosLayer #warpCurtain{position:absolute;inset:0;z-index:4;pointer-events:none;background:radial-gradient(ellipse,#17385b44,#01040eff 73%);opacity:0;transition:opacity .27s ease}',
    '#nyCosmosLayer #warpCurtain.active{opacity:1}',
    '@media(max-width:700px){#nyCosmosLayer #header{top:8px;left:8px;max-width:48vw;padding:8px}#nyCosmosLayer #header h1{font-size:15px}#nyCosmosLayer #header p{font-size:10px}#nyCosmosLayer #controls{top:8px;right:8px;width:47vw;padding:8px}#nyCosmosLayer #tabs button{padding:4px 2px;font-size:9px}#nyCosmosLayer #controls h2{font-size:10px;margin-bottom:5px}#nyCosmosLayer #destination{font-size:11px;padding:5px}#nyCosmosLayer #footer{left:8px;right:8px;bottom:8px}#nyCosmosLayer #flightInfo{font-size:10px;padding:8px;max-width:61vw}#nyCosmosLayer #back{font-size:11px;padding:8px}#nyCosmosLayer #tutorial{display:none}}'
  ].join('\n');
  document.head.append(style);
  layer=document.createElement('section');
  layer.id='nyCosmosLayer';
  layer.setAttribute('aria-label','New York orbital flight');
  layer.setAttribute('aria-hidden','true');
  layer.innerHTML=[
    '<canvas id="universe" aria-label="3D Earth orbit and solar system"></canvas>',
    '<div id="warpCurtain" aria-hidden="true"></div><div id="ui">',
    '<header id="header" class="cos-panel"><h1>✦ MANHATTAN / COSMOS</h1>',
    '<p id="originLabel">NEW YORK → EARTH ORBIT</p>',
    '<p>纽约天空 → 地球轨道 → 太阳系 → 银河系</p>',
    '<p id="tutorial">Drag · Wheel zoom · WASD move · U / Esc return to aircraft</p></header>',
    '<aside id="controls" class="cos-panel"><h2>NEW YORK / ORBITAL NAVIGATION</h2>',
    '<div id="tabs"><button data-stage="orbit" type="button">地球轨道</button>',
    '<button data-stage="solar" type="button">太阳系</button>',
    '<button data-stage="galaxy" type="button">银河系</button></div>',
    '<label for="destination">航行目的地</label><select id="destination">',
    ...[['earth','地球 Earth'],['moon','月球 Moon'],['sun','太阳 Sun'],['mercury','水星 Mercury'],['venus','金星 Venus'],['mars','火星 Mars'],['jupiter','木星 Jupiter'],['saturn','土星 Saturn'],['uranus','天王星 Uranus'],['neptune','海王星 Neptune'],['pluto','冥王星 Pluto'],['solar','太阳系全景'],['galaxy','银河系全景']].map(([v,n])=>'<option value="'+v+'">'+n+'</option>'),
    '</select><label for="timeScale">轨道模拟速度 <output id="timeLabel">1×</output></label>',
    '<input id="timeScale" type="range" min="0" max="4" value="2" step="1"></aside>',
    '<div id="footer"><output id="flightInfo" class="cos-panel">Preparing orbital navigation...</output>',
    '<a id="back" href="#">↩ 下降返回曼哈顿 [U]</a></div>',
    '<div id="notice" aria-live="polite"></div></div>',
    '<div id="loading"><div><strong>✦ LEAVING NEW YORK ATMOSPHERE</strong>',
    '<p>Linking solar-system rendering to this flight...</p></div></div>'
  ].join('');
  (document.getElementById('wrap')||document.body).append(layer);
}
export const isActive=()=>active;
export const getCraft=()=>latestFlight?.craft||'fighter';
export const getFlight=()=>latestFlight;
export function exit(){
  if(!active)return;
  active=false;
  layer?.classList.remove('active');
  layer?.setAttribute('aria-hidden','true');
  window.PatrolCosmosViewer?.clearInput?.();
  if(latestFlight?.playing)window.PatrolSpaceBridge?.resumeFromOrbit?.();
  window.dispatchEvent(new Event('patrol:orbitReturn'));
}
export async function enter(flight){
  if(active)return;
  if(flight?.map!=='manhattan')throw new Error('Embedded universe currently supports only Manhattan');
  latestFlight=flight;
  mountLayer();
  active=true;
  layer.setAttribute('aria-hidden','false');
  layer.classList.add('active');
  layer.querySelector('#back')?.setAttribute('aria-label',
    latestFlight.playing?'Return to the same Manhattan aircraft':'Return to flight menu');
  try{
    if(!viewerPromise)viewerPromise=import('./cosmos.js');
    await viewerPromise;
    if(active)window.PatrolCosmosViewer?.enterOrbit?.(flight);
  }catch(error){
    viewerPromise=null;
    console.error('New York in-page cosmos failed:',error);
    const load=layer.querySelector('#loading');
    load.style.display='grid';
    load.classList.remove('hidden');
    load.querySelector('p').textContent='宇宙渲染加载失败。请检查网络或 WebGL，按 U 返回纽约。';
  }
}
window.PatrolNYCosmos={enter,exit,isActive,getCraft,getFlight};
