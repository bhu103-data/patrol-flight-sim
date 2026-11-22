// Combined #88+#100+#102 real NYC full-cycle and vehicle-footprint QA.
// Derived from the existing PATROL PR #111 browser QA script; no production changes.
// The probe is injected into the Playwright HTTP response ONLY; index.html
// in Git and its production runtime remain unchanged. Chromium uses software
// WebGL2 on CI; rAF intervals below are NOT GPU timing measurements.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';

const base=(process.env.PATROL_BASE_URL||'http://127.0.0.1:8765').replace(/\/$/,'');
const out='artifacts/nyc-bridgehead-full-footprint';
await mkdir(out,{recursive:true});
const errors=[],screenshots=[];
const result={passed:false,errors,screenshots,renderer:'unverified',probeInjected:false};
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const injection=String.raw`
  // Test-only closure access; this string never enters the repository's index.
  window.__patrolBridgeheadQaSetHold = time => {
    if(time===null){
      window.__patrolBridgeheadQaHoldTime=null;
      nextDcView=sceneryTime+8;
      return;
    }
    if(!Number.isFinite(time)||time<0||time>=32)
      throw Error('Invalid test-only signal phase time');
    window.__patrolBridgeheadQaHoldTime=time;
    // Disable scheduled scenic-camera rotation while capturing matched frames.
    nextDcView=Number.POSITIVE_INFINITY;
  };
  window.__patrolBridgeheadQaSignal = () => ({
    time:sceneryTime,state:bridgeheadSignalState(sceneryTime),
    green:bridgeheadSignalGreen(sceneryTime)
  });
  window.__patrolBridgeheadQa = () => {
    const cars=cityTraffic.filter(a=>a.bridgehead);
    const rows=cars.map(actor=>{
      // Geometry QA scans pure distance positions even when the real actor
      // waits at a red light. Separate signal timing is checked below.
      const geometryActor={...actor,signalized:false};
      const radius=actor.laneOffset??1.07;
      const turnLength=Math.PI*radius,period=2*(actor.route.total+turnLength);
      const stats={kind:actor.kind,routePoints:actor.route.points.length,
        routeLength:actor.route.total,period,samples:0,bridgeSamples:0,
        streetSamples:0,turnSamples:0,outboundSamples:0,
        inboundSamples:0,dumboTurnSamples:0,bridgeTurnSamples:0,
        wetStreetSamples:0,
        occupiedStreetSamples:0,badHeightSamples:0,invalidSamples:0,
        footprintStreetSamples:0,footprintWaterHits:0,
        footprintBuildingHits:0,bridgeRailHits:0,firstFootprintIssue:null,
        maxStepXZ:0,maxStepY:0,maxStepYaw:0,
        first:null,last:null,nearBridgeEnd:null,nearDumboTurn:null};
      let previous=null;
      // Sample both directions and BOTH end arcs, independent of real-time
      // vehicle spawn offsets, at 0.25 units of route movement per sample.
      for(let phase=0;phase<=period+.00001;phase+=.25){
        const at=Math.min(period,phase);
        const pose=trafficPose(geometryActor,(at-actor.offset)/actor.pace);
        const finite=[pose.x,pose.y,pose.z,pose.yaw].every(Number.isFinite);
        const expectedY=pose.onBridge
          ?bridgeRoadHeight(pose.x)+.055:STREET_Y+.07;
        const forbidden=!pose.onBridge &&
          (sampleTerrainHeight(pose.x,pose.z)<=WATER_H+.08 ||
           !!cityLotAt(pose.x,pose.z));
        const wet=!pose.onBridge &&
          sampleTerrainHeight(pose.x,pose.z)<=WATER_H+.08;
        const occupied=!pose.onBridge&&!!cityLotAt(pose.x,pose.z);
        stats.samples++;
        if(pose.onBridge)stats.bridgeSamples++;else stats.streetSamples++;
        if(pose.turning)stats.turnSamples++;
        // Explicitly distinguish each leg and both U-turns so a full
        // period cannot falsely pass by only sampling one side.
        if(at<actor.route.total)stats.outboundSamples++;
        else if(at<actor.route.total+turnLength)stats.dumboTurnSamples++;
        else if(at<2*actor.route.total+turnLength)stats.inboundSamples++;
        else stats.bridgeTurnSamples++;
        if(wet)stats.wetStreetSamples++;
        if(occupied)stats.occupiedStreetSamples++;
        // Conservative full-car planar envelope, not merely its center.
        // The 2.45-unit radius is the same envelope as #88's terminal
        // turning-path gate. Include all street poses in both directions.
        if(pose.onBridge){
          const guardZ=EAST_RIVER_BRIDGE.halfWidth-.16;
          if(Math.abs(pose.z-EAST_RIVER_BRIDGE.z)+2.45>=guardZ){
            stats.bridgeRailHits++;
            stats.firstFootprintIssue??={phase:at,pose,kind:'bridge-guard'};
          }
        }else for(let a=0;a<24;a++){
          const angle=a*Math.PI/12;
          const x=pose.x+2.45*Math.cos(angle);
          const z=pose.z+2.45*Math.sin(angle);
          const wet=sampleTerrainHeight(x,z)<=WATER_H+.08;
          const blocked=!!cityLotAt(x,z);
          stats.footprintStreetSamples++;
          if(wet)stats.footprintWaterHits++;
          if(blocked)stats.footprintBuildingHits++;
          if((wet||blocked)&&!stats.firstFootprintIssue)
            stats.firstFootprintIssue={phase:at,pose,edge:{x,z},
              kind:wet?'street-footprint-water':'street-footprint-parcel'};
        }
        if(!finite)stats.invalidSamples++;
        if(Math.abs(pose.y-expectedY)>.02)stats.badHeightSamples++;
        if(previous){
          const deltaXZ=Math.hypot(pose.x-previous.x,pose.z-previous.z);
          const deltaY=Math.abs(pose.y-previous.y);
          const deltaYaw=Math.abs(Math.atan2(
            Math.sin(pose.yaw-previous.yaw),
            Math.cos(pose.yaw-previous.yaw)));
          stats.maxStepXZ=Math.max(stats.maxStepXZ,deltaXZ);
          stats.maxStepY=Math.max(stats.maxStepY,deltaY);
          stats.maxStepYaw=Math.max(stats.maxStepYaw,deltaYaw);
        }
        if(!stats.first)stats.first={phase:at,...pose,forbidden};
        stats.last={phase:at,...pose,forbidden};
        if(!stats.nearBridgeEnd&&at>=actor.route.lengths[actor.bridgeSegmentCount])
          stats.nearBridgeEnd={phase:at,...pose,forbidden};
        if(!stats.nearDumboTurn&&at>=actor.route.total)
          stats.nearDumboTurn={phase:at,...pose,forbidden};
        previous=pose;
      }
      return stats;
    });
    const signalRows=cars.map(actor=>{
      const radius=actor.laneOffset??1.07;
      const period=2*(actor.route.total+Math.PI*radius);
      const stopAt=actor.route.lengths[actor.bridgeSegmentCount]-5.5-
        (actor.signalQueueSlot??0)*5.5;
      let prev=bridgeheadSignalTravel(actor,0);
      let previousHeld=false,redHoldSamples=0,greenResumeSamples=0,
        movingSamples=0,misplacedStops=0,invalidDistance=0;
      for(let t=.25;t<=1000;t+=.25){
        const at=bridgeheadSignalTravel(actor,t);
        const delta=at-prev;
        if(!Number.isFinite(at)||delta<-.00001||delta>actor.pace*.25+.0001)
          invalidDistance++;
        const held=Math.abs(delta)<.00001;
        if(held&&!bridgeheadSignalGreen(t-.125)){
          redHoldSamples++;
          const offset=((at-stopAt)%period+period)%period;
          if(Math.min(offset,period-offset)>.001)misplacedStops++;
        }
        if(previousHeld&&!held&&bridgeheadSignalGreen(t-.125))greenResumeSamples++;
        if(!held)movingSamples++;
        prev=at;previousHeld=held;
      }
      return {kind:actor.kind,signalized:actor.signalized,
        signalQueueSlot:actor.signalQueueSlot,stopAt,
        redHoldSamples,greenResumeSamples,movingSamples,
        misplacedStops,invalidDistance};
    });
    return {mapCity:!!selectedMap.city,actorCount:cityTraffic.length,
      bridgeheadCount:cars.length,bridgeLinePoints:CITY_STREETS[0].length,
      streetY:STREET_Y,waterY:WATER_H,
      lightGreen:bridgeheadSignalGreen(sceneryTime),rows,signalRows};
  };
`;

const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist',
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader'
]});
const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
page.on('pageerror',err=>errors.push('pageerror: '+err.message));
page.on('requestfailed',req=>{
  if(req.url().startsWith(base))errors.push('local request failed: '+req.url());
});
try{
  await page.route('**/index.html',async route=>{
    const response=await route.fetch();
    const html=await response.text();
    const marker='  function prepareCityTraffic() {';
    assert(html.includes(marker),'Production traffic entry missing');
    assert(html.split(marker).length===2,'Traffic injection marker is ambiguous');
    assert(!html.includes('__patrolBridgeheadQa'),'Probe name already in production');
    const tick='    sceneryTime += Math.min(rawDt, 0.12);';
    assert(html.split(tick).length===2,'Scene clock injection marker missing/ambiguous');
    // Test transport only: restore fixed scenery time after each animation tick.
    // Production index.html is not rewritten on disk or in Git.
    const clockHook=tick+'\n'+
      '    if(Number.isFinite(window.__patrolBridgeheadQaHoldTime))'+
      'sceneryTime=window.__patrolBridgeheadQaHoldTime;';
    const instrumented=html.replace(marker,injection+marker).replace(tick,clockHook);
    await route.fulfill({response,body:instrumented});
    result.probeInjected=true;
  });
  const response=await page.goto(base+'/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  assert(response?.ok(),'Launcher did not respond');
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
      if(!el)throw Error('Environment control not found: '+id);
      el.value=value;
      el.dispatchEvent(new Event('change',{bubbles:true}));
    }
  });
  const state=await page.evaluate(()=>{
    const c=document.getElementById('glCanvas');
    const gl=c?.getContext('webgl2');
    return {webgl2:Boolean(gl&&!gl.isContextLost()),
      error:gl?.getError(),size:[c?.width,c?.height],
      probe:typeof window.__patrolBridgeheadQa};
  });
  assert(state.webgl2&&state.error===0,'Native WebGL2 not healthy: '+JSON.stringify(state));
  assert(state.probe==='function','Runtime traffic probe not installed');
  assert(await page.evaluate(()=>
    typeof window.__patrolBridgeheadQaSetHold==='function'&&
    typeof window.__patrolBridgeheadQaSignal==='function'),
  'Test-only signal controls not installed');
  result.renderer='ANGLE SwiftShader / software WebGL2';
  result.webgl=state;
  const traffic=await page.evaluate(()=>window.__patrolBridgeheadQa());
  result.traffic=traffic;
  assert(traffic.mapCity,'Loaded map is not NYC');
  assert(traffic.bridgeheadCount===2,
    'Expected two live bridge-to-DUMBO cars; actual '+traffic.bridgeheadCount);
  assert(traffic.signalRows?.length===2,
    'Missing live signal controller on both bridgehead cars');
  for(const sig of traffic.signalRows){
    assert(sig.signalized===true&&sig.redHoldSamples>=8&&
      sig.greenResumeSamples>0&&sig.movingSamples>0&&
      sig.misplacedStops===0&&sig.invalidDistance===0,
      'Red stop/green restart failed in real NYC runtime: '+JSON.stringify(sig));
  }
  for(const car of traffic.rows){
    assert(car.routePoints>traffic.bridgeLinePoints,'Vehicle never enters DUMBO branch');
    assert(car.samples>100&&car.bridgeSamples>0&&car.streetSamples>0&&car.turnSamples>0&&
      car.outboundSamples>0&&car.inboundSamples>0&&
      car.dumboTurnSamples>=10&&car.bridgeTurnSamples>=10,
      'Both directions and both U-turn arcs must be independently covered: '+JSON.stringify(car));
    assert(car.invalidSamples===0&&car.badHeightSamples===0,
      'Non-finite or wrong road height: '+JSON.stringify(car));
    assert(car.wetStreetSamples===0&&car.occupiedStreetSamples===0,
      'Vehicle crosses water/warehouse outside bridge: '+JSON.stringify(car));
    assert(car.footprintStreetSamples>1000&&car.bridgeRailHits===0,
      'Bridge guard/footprint coverage failure: '+JSON.stringify(car));
    assert(car.footprintWaterHits===0&&car.footprintBuildingHits===0,
      'Car footprint reaches river or parcel on full route: '+JSON.stringify(car));
    assert(car.maxStepXZ<.8&&car.maxStepY<.30&&car.maxStepYaw<.7,
      'Vehicle teleports, jumps in height or snaps heading: '+JSON.stringify(car));
  }
  await page.keyboard.press('h');
  await page.waitForFunction(()=>!document.getElementById('hotelViews')?.hidden,
    null,{timeout:15000});
  await page.locator('#hotelZoom').evaluate(el=>{
    el.value='58';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.addStyleTag({content:
    'body.patrol-bridge-qa *{visibility:hidden!important;}'+
    'body.patrol-bridge-qa #glCanvas{visibility:visible!important;}'});
  for(const [label,name] of [
    ['Brooklyn Bridge · Deck View','01-bridgehead-live-cars.png'],
    ['DUMBO · Warehouse Blocks','02-dumbo-live-cars.png']
  ]){
    await page.locator('#hotelTarget').selectOption({label});
    await page.waitForTimeout(1400);
    const view=await page.evaluate(()=>{
      const gl=document.getElementById('glCanvas')?.getContext('webgl2');
      return {label:document.getElementById('hotelTarget')?.selectedOptions?.[0]?.textContent,
        webgl2:!!gl&&!gl.isContextLost(),error:gl?.getError()};
    });
    assert(view.label===label&&view.webgl2&&view.error===0,'Scenic view failed: '+JSON.stringify(view));
    await page.evaluate(()=>document.body.classList.add('patrol-bridge-qa'));
    try{
      await page.locator('#glCanvas').screenshot({
        path:out+'/'+name,timeout:90000,animations:'allow'
      });
    }finally{
      await page.evaluate(()=>document.body.classList.remove('patrol-bridge-qa'));
    }
    screenshots.push({name,label,view});
  }
  // Three actual WebGL2 frames from the SAME bridgehead scenic camera.
  // Capture with a test-only fixed scene clock, not a mocked signal renderer.
  await page.locator('#hotelTarget').selectOption({label:'Brooklyn Bridge · Deck View'});
  await page.waitForTimeout(500);
  result.signalFrames=[];
  try{
    for(const [expected,time,name] of [
      ['red',4,'03-bridgehead-signal-red.png'],
      ['green',18,'04-bridgehead-signal-green.png'],
      ['amber',30.5,'05-bridgehead-signal-amber.png']
    ]){
      await page.evaluate(value=>window.__patrolBridgeheadQaSetHold(value),time);
      await page.waitForTimeout(250);
      const actual=await page.evaluate(()=>{
        const canvas=document.getElementById('glCanvas');
        const gl=canvas?.getContext('webgl2');
        const signal=window.__patrolBridgeheadQaSignal();
        return {...signal,webgl2:!!gl&&!gl.isContextLost(),
          glError:gl?.getError(),
          label:document.getElementById('hotelTarget')?.selectedOptions?.[0]?.textContent};
      });
      assert(actual.state===expected&&Math.abs(actual.time-time)<1e-6&&
        actual.webgl2&&actual.glError===0&&actual.label==='Brooklyn Bridge · Deck View',
        'Real three-phase WebGL2 frame did not match actual controller: '+
        JSON.stringify({expected,time,actual}));
      await page.evaluate(()=>document.body.classList.add('patrol-bridge-qa'));
      try{
        await page.locator('#glCanvas').screenshot({
          path:out+'/'+name,timeout:90000,animations:'allow'
        });
      }finally{
        await page.evaluate(()=>document.body.classList.remove('patrol-bridge-qa'));
      }
      result.signalFrames.push({name,expected,actual});
      screenshots.push({name,label:actual.label,view:actual});
    }
  }finally{
    await page.evaluate(()=>window.__patrolBridgeheadQaSetHold(null));
  }
  assert(result.signalFrames.length===3,
    'Missing same-camera RGB signal-phase evidence');
  assert(errors.length===0,'Browser exceptions/assets: '+errors.join('; '));
  result.passed=true;
}catch(error){
  errors.push(error.stack||String(error));
  process.exitCode=1;
}finally{
  await writeFile(out+'/bridgehead-cars-report.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
  await browser.close();
}
