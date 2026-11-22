// Combined #88+#100+#102 real NYC full-cycle and vehicle-footprint QA.
// Derived from the existing PATROL PR #111 browser QA script; no production changes.
// The probe is injected into the Playwright HTTP response ONLY; index.html
// in Git and its production runtime remain unchanged. Chromium uses software
// WebGL2 on CI; rAF intervals below are NOT GPU timing measurements.
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {mkdir,writeFile} from 'node:fs/promises';

const base=(process.env.PATROL_BASE_URL||'http://127.0.0.1:8765').replace(/\/$/,'');
const out='artifacts/nyc-bridgehead-full-footprint';
await mkdir(out,{recursive:true});
const errors=[],screenshots=[];
const result={passed:false,errors,screenshots,renderer:'unverified',probeInjected:false};
const assert=(ok,message)=>{if(!ok)throw Error(message);};
// Fixed camera ROI calibrated against the first actual 1280x720 WebGL PNGs,
// not an inferred shader color. Rescale coordinates if capture DPR changes.
// Small lamp ROI, not a photorealism or scene-wide brightness measurement.
function lampMeanRgb(bytes,roi){
  const png=PNG.sync.read(bytes);
  const [l,t,r,b]=roi;
  const x0=Math.floor(l*png.width/1280),x1=Math.ceil(r*png.width/1280);
  const y0=Math.floor(t*png.height/720),y1=Math.ceil(b*png.height/720);
  const sums=[0,0,0];let n=0;
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
    const i=(y*png.width+x)*4;
    sums[0]+=png.data[i];sums[1]+=png.data[i+1];
    sums[2]+=png.data[i+2];n++;
  }
  assert(n>40,'Signal screenshot ROI unexpectedly too small');
  return sums.map(v=>Number((v/n).toFixed(1)));
}
const injection=String.raw`
  // Test-only closure access; this string never enters the repository's index.
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
        (actor.signalQueueSlot??0)*9;
      // Construct an actor whose next crossing would nominally be amber.
      // Reuse real route, pace and signal controller; no mock clock.
      const amberActor={...actor,offset:stopAt-actor.pace*29};
      const amberStops={
        approach:bridgeheadSignalTravel(amberActor,29),
        amberEnd:bridgeheadSignalTravel(amberActor,32),
        redEnd:bridgeheadSignalTravel(amberActor,44),
        greenAfter:bridgeheadSignalTravel(amberActor,44.5)
      };
      let prev=bridgeheadResolvedTravel(actor,0);
      let previousHeld=false,redHoldSamples=0,greenResumeSamples=0,
        movingSamples=0,misplacedStops=0,invalidDistance=0;
      for(let t=.25;t<=1000;t+=.25){
        const at=bridgeheadResolvedTravel(actor,t);
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
        misplacedStops,invalidDistance,amberStops};
    });
    // Independent pairwise vehicle envelope verification on the *live*
    // loaded bridge-to-DUMBO route; do not substitute the artificial clear
    // terrain Node fixture or collide oncoming lane centerpoints.
    const pair={samples:0,nearPasses:0,badSamples:0,minGap:Infinity,
      firstIssue:null,horizonSeconds:9000,bodyHalfWidth:1.0,
      bodyHalfLength:2.05,minimumRequiredClearance:.08};
    const carAxes=p=>[[Math.cos(p.yaw),-Math.sin(p.yaw)],
      [Math.sin(p.yaw),Math.cos(p.yaw)]];
    const carGap=(a,b)=>{
      const axesA=carAxes(a),axesB=carAxes(b);
      const dx=a.x-b.x,dz=a.z-b.z;
      let separation=-Infinity;
      for(const axis of [...axesA,...axesB]){
        const extent=axes=>Math.abs(
          axis[0]*axes[0][0]+axis[1]*axes[0][1])*pair.bodyHalfWidth+
          Math.abs(axis[0]*axes[1][0]+axis[1]*axes[1][1])*pair.bodyHalfLength;
        separation=Math.max(separation,
          Math.abs(dx*axis[0]+dz*axis[1])-extent(axesA)-extent(axesB));
      }
      return separation;
    };
    if(cars.length===2)for(let k=0;k<=36000;k++){
      const t=k*.25,a=trafficPose(cars[0],t),b=trafficPose(cars[1],t);
      if(Math.abs(a.y-b.y)>1.5)continue; // Elevated bridge vs dry street.
      const gap=carGap(a,b);pair.samples++;
      if(gap<pair.minGap)pair.minGap=gap;
      if(gap<.5)pair.nearPasses++;
      if(!Number.isFinite(gap)||gap<pair.minimumRequiredClearance){
        pair.badSamples++;
        pair.firstIssue??={t,gap,a,b};
      }
    }
    // Real browser-loaded controller: test the leader-pace join, rather
    // than only checking its final nine-unit distance cap.
    let followerBlend=null;
    if(cars.length===2&&cars[1].bridgeheadLeader===cars[0]){
      const lead=cars[0],sedan=cars[1];
      const speedAt=(t,h=.0005)=>
        (bridgeheadResolvedTravel(sedan,t+h)-
          bridgeheadResolvedTravel(sedan,t-h))/(2*h);
      const joinTime=(lead.offset-sedan.offset-9)/
        (sedan.pace-lead.pace);
      followerBlend={
        joinTime,entrySpeed:speedAt(.2),beforeSpeed:speedAt(joinTime-.025),
        centerSpeed:speedAt(joinTime),afterSpeed:speedAt(joinTime+.025),
        cruiseSpeed:speedAt(joinTime+5),
        clearance:bridgeheadResolvedTravel(lead,joinTime)-
          bridgeheadResolvedTravel(sedan,joinTime)
      };
    }
    // 3D upright oriented hulls taken from real buildStreetVehicle()
    // vertices in tests/nyc-bridgehead-mesh-3d-clearance.test.mjs.
    // taxi mesh has 990 triangles, sedan 942. Sizes are asserted from
    // production source by Node; keep this client probe independent.
    const modelHull={
      taxi:{center:[0,.96375,.006],half:[1.005,.95375,2.006]},
      sedan:{center:[0,.8,.006],half:[1.005,.79,2.006]}
    };
    const pair3d={samples:0,refined:0,near:0,minGap:Infinity,
      bad:0,firstIssue:null,threshold:.08,bounds:modelHull};
    const clearance3d=(a,b)=>{
      const ma=modelHull.taxi,mb=modelHull.sedan;
      const c=[Math.cos(a.yaw),Math.cos(b.yaw)],
        ss=[Math.sin(a.yaw),Math.sin(b.yaw)];
      const ca=ma.center,cb=mb.center,ra=ma.half,rb=mb.half;
      const ax=a.x+c[0]*ca[0]+ss[0]*ca[2],
        az=a.z-ss[0]*ca[0]+c[0]*ca[2],ay=a.y+ca[1];
      const bx=b.x+c[1]*cb[0]+ss[1]*cb[2],
        bz=b.z-ss[1]*cb[0]+c[1]*cb[2],by=b.y+cb[1];
      const dx=ax-bx,dz=az-bz;
      let separation=Math.abs(ay-by)-ra[1]-rb[1];
      for(const [u,v] of [
        [c[0],-ss[0]],[ss[0],c[0]],
        [c[1],-ss[1]],[ss[1],c[1]]
      ]){
        const extent=ra[0]*Math.abs(u*c[0]-v*ss[0])+
          ra[2]*Math.abs(u*ss[0]+v*c[0])+
          rb[0]*Math.abs(u*c[1]-v*ss[1])+
          rb[2]*Math.abs(u*ss[1]+v*c[1]);
        separation=Math.max(separation,Math.abs(dx*u+dz*v)-extent);
      }
      return separation;
    };
    if(cars.length===2)for(let k=0;k<=36000;k++){
      const t=k*.25,dist=clearance3d(
        trafficPose(cars[0],t),trafficPose(cars[1],t));
      pair3d.samples++;
      if(dist<pair3d.minGap)pair3d.minGap=dist;
      if(dist<.5)pair3d.near++;
      if(!Number.isFinite(dist)||dist<pair3d.threshold){
        pair3d.bad++;pair3d.firstIssue??={t,dist};
      }
      // Extra densely sampled near encounters, including true vertical
      // bounds; an interval check cannot certify swept triangle meshes.
      if(dist<.9&&k>0)for(let j=1;j<25;j++){
        const rt=t-.25+j*.01;
        const r=clearance3d(
          trafficPose(cars[0],rt),trafficPose(cars[1],rt));
        pair3d.refined++;
        if(r<pair3d.minGap)pair3d.minGap=r;
        if(!Number.isFinite(r)||r<pair3d.threshold){
          pair3d.bad++;pair3d.firstIssue??={t:rt,dist:r};
        }
      }
    }
    // Time-CONTINUOUS exclusion for upright 3D car hulls, conditionally
    // certified by the model-derived Node speed/route precondition test.
    // A world-space SAT witness at t0 stays separating throughout dt if
    // even worst-case projected vehicle-vertex motion cannot close its gap.
    // 40 units/s per car is above the current controller's derived bound.
    const swept3d={baseIntervals:36000,certified:0,subdivisions:0,
      maxDepth:0,minGuaranteed:Infinity,firstIssue:null,
      maxRelativeVertexSpeed:80,requiredClearance:.08};
    if(cars.length===2){
      const at=t=>clearance3d(
        trafficPose(cars[0],t),trafficPose(cars[1],t));
      function certifyInterval(t0,t1,g0,depth){
        const guaranteed=g0-swept3d.maxRelativeVertexSpeed*(t1-t0);
        if(Number.isFinite(g0)&&guaranteed>swept3d.requiredClearance){
          swept3d.certified++;
          swept3d.maxDepth=Math.max(swept3d.maxDepth,depth);
          swept3d.minGuaranteed=Math.min(swept3d.minGuaranteed,guaranteed);
          return;
        }
        if(depth>=17){
          swept3d.firstIssue??={t0,t1,g0,guaranteed};
          return;
        }
        swept3d.subdivisions++;
        const mid=(t0+t1)/2,gMid=at(mid);
        certifyInterval(t0,mid,g0,depth+1);
        certifyInterval(mid,t1,gMid,depth+1);
      }
      let last=at(0);
      for(let k=0;k<36000;k++){
        const t0=k*.25,t1=(k+1)*.25;
        certifyInterval(t0,t1,last,0);
        last=at(t1);
        // Report first failed interval, don't spin on a broken model.
        if(swept3d.firstIssue)break;
      }
    }
    return {mapCity:!!selectedMap.city,actorCount:cityTraffic.length,
      bridgeheadCount:cars.length,bridgeLinePoints:CITY_STREETS[0].length,
      streetY:STREET_Y,waterY:WATER_H,
      lightGreen:bridgeheadSignalGreen(sceneryTime),rows,signalRows,pair,
      followerBlend,pair3d,swept3d};
  };
  // Test-only snapshot clock: drive the production signal's actual scene
  // time to known red/green windows for a stable physical-lens comparison.
  window.__patrolBridgeheadLightState = () => ({
    time:sceneryTime,green:bridgeheadSignalGreen(sceneryTime),
    phase:bridgeheadSignalPhase(sceneryTime)
  });
  window.__patrolBridgeheadVisualClock = time => {
    sceneryTime=time;
    return window.__patrolBridgeheadLightState();
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
    let instrumented=html.replace(marker,injection+marker);
    if(process.env.PATROL_NYC_SIGNAL_VISUAL_QA==='1'){
      // This scenic view exists ONLY in the served test response, never
      // in the committed gameplay or normal Scenic Views dropdown.
      const key='  const NYC_SCENIC_VIEWS=[';
      assert(instrumented.includes(key),'NYC scenic views marker missing');
      assert(instrumented.split(key).length===2,'NYC scenic view anchor ambiguous');
      instrumented=instrumented.replace(key,key+`\n    {name:'Bridge Signal QA · Close',x:253,z:-345.51,
      height:4.05,bearing:-90,radius:13,rise:2.3,
      detail:'Test-only west-facing view of active bridge signal'},`);
    }
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
      sig.misplacedStops===0&&sig.invalidDistance===0&&
      sig.amberStops.approach<sig.stopAt&&
      Math.abs(sig.amberStops.amberEnd-sig.stopAt)<.00001&&
      Math.abs(sig.amberStops.redEnd-sig.stopAt)<.00001&&
      sig.amberStops.greenAfter>sig.stopAt,
      'Red stop/green restart failed in real NYC runtime: '+JSON.stringify(sig));
  }
  assert(traffic.pair?.samples>1000&&traffic.pair.nearPasses>5&&
    traffic.pair.badSamples===0&&
    traffic.pair.minGap>=traffic.pair.minimumRequiredClearance,
    'Live taxi/sedan body envelopes collide during long-run bridge traffic: '+
    JSON.stringify(traffic.pair));
  assert(traffic.pair3d?.samples===36001&&
    traffic.pair3d.near>30&&traffic.pair3d.refined>1000&&
    traffic.pair3d.bad===0&&
    traffic.pair3d.minGap>=traffic.pair3d.threshold,
    'Real-mesh 3D car envelopes overlap in live NYC WebGL2: '+
    JSON.stringify(traffic.pair3d));
  assert(traffic.swept3d?.baseIntervals===36000&&
    traffic.swept3d.certified>=36000&&
    traffic.swept3d.subdivisions>1000&&
    traffic.swept3d.maxDepth>=8&&
    traffic.swept3d.firstIssue===null&&
    traffic.swept3d.minGuaranteed>.08,
    'Continuous-time 3D car hull interval certificate failed: '+
    JSON.stringify(traffic.swept3d));
  const blend=traffic.followerBlend;
  assert(blend&&Math.abs(blend.joinTime-5)<.001&&
    Math.abs(blend.entrySpeed-5.6)<.01&&
    Math.abs(blend.centerSpeed-5.3)<.02&&
    Math.abs(blend.beforeSpeed-blend.afterSpeed)<.025&&
    Math.abs(blend.cruiseSpeed-5)<.01&&
    blend.clearance>=9,
    'Loaded scene follower velocity must blend without a sudden speed step: '+
    JSON.stringify(blend));
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
  if(process.env.PATROL_NYC_SIGNAL_VISUAL_QA==='1'){
    await page.locator('#hotelTarget').selectOption(
      {label:'Bridge Signal QA · Close'});
    await page.locator('#hotelZoom').evaluate(el=>{
      el.value='90';el.dispatchEvent(new Event('input',{bubbles:true}));
    });
    await page.waitForTimeout(1700);
    result.signalVisual={camera:'Bridge Signal QA · Close',captures:[],
      roi:{upperRed:[633,344,648,361],middleAmber:[633,362,648,375],
        lowerGreen:[633,380,648,393]},
      colorContrast:null};
    // Two calibrated lamp positions: the #161 BQE relocation removes the
    // elevated exit beneath this camera, shifting its red lens 16px up.
    // Both tight ROIs cover ONLY the real physical signal housing.
    const redLampPngByPhase={};
    for(const [phase,time,name] of [
      ['red',1,'03-bridge-signal-close-red.png'],
      ['green',18,'04-bridge-signal-close-green.png'],
      ['amber',27.1,'05-bridge-signal-close-amber.png']
    ]){
      // Force *real* signal clock only in intercepted test HTML; render
      // the actual existing 3D housing and selected red/green mesh.
      // Screenshots include scene pixels only, never test overlays.
      let snapshot=null;
      for(let attempt=0;attempt<3;attempt++){
        const set=await page.evaluate(t=>
          window.__patrolBridgeheadVisualClock?.(t),time);
        assert(set?.phase===phase,'Test-only clock failed to select light phase');
        await page.waitForTimeout(500);
        const before=await page.evaluate(()=>
          window.__patrolBridgeheadLightState?.());
        assert(before?.phase===phase,'Scene signal phase already drifted');
        await page.evaluate(()=>
          document.body.classList.add('patrol-bridge-qa'));
        let pngBytes=null;
        try{
          pngBytes=await page.locator('#glCanvas').screenshot({
            path:out+'/'+name,timeout:90000,animations:'allow'
          });
        }finally{
          await page.evaluate(()=>
            document.body.classList.remove('patrol-bridge-qa'));
        }
        const after=await page.evaluate(()=>
          window.__patrolBridgeheadLightState?.());
        snapshot={name,phase,before,after,attempt:attempt+1,
          topRedRgb:lampMeanRgb(pngBytes,[633,344,648,361]),
          midAmberRgb:lampMeanRgb(pngBytes,[633,362,648,375]),
          bottomGreenRgb:lampMeanRgb(pngBytes,[633,380,648,393])};
        redLampPngByPhase[phase]=pngBytes;
        if(after?.phase===phase)break;
      }
      assert(snapshot?.after?.phase===phase,
        'Screenshot drifted into wrong signal phase: '+JSON.stringify(snapshot));
      const gl=await page.evaluate(()=>document.getElementById('glCanvas')
        ?.getContext('webgl2')?.getError());
      assert(gl===0,'Signal close-up WebGL error: '+gl);
      result.signalVisual.captures.push(snapshot);
      screenshots.push({name,label:'Bridge Signal QA · Close',
        phase});
    }
    const red=result.signalVisual.captures[0],
      green=result.signalVisual.captures[1],
      amber=result.signalVisual.captures[2];
    // Choose between two *fixed and physically bounded* close-camera ROIs.
    // The red-on/green-off contrast must pass the same original >=25 gate;
    // do not fall back to the brightest red anywhere in the scene.
    const redRoiCandidates=[[633,344,648,361],[633,325,648,342]];
    const candidates=redRoiCandidates.map(roi=>({roi,
      redRgb:lampMeanRgb(redLampPngByPhase.red,roi),
      greenRgb:lampMeanRgb(redLampPngByPhase.green,roi)}));
    const selected=candidates.reduce((best,item)=>
      item.redRgb[0]-item.greenRgb[0]>
        best.redRgb[0]-best.greenRgb[0]?item:best);
    result.signalVisual.roi.upperRed=selected.roi;
    result.signalVisual.upperRedRoiCandidates=candidates.map(item=>({
      roi:item.roi,redGain:Number((item.redRgb[0]-item.greenRgb[0]).toFixed(1))}));
    for(const capture of result.signalVisual.captures)
      capture.topRedRgb=lampMeanRgb(redLampPngByPhase[capture.phase],selected.roi);
    const upperRedGain=Number((red.topRedRgb[0]-green.topRedRgb[0]).toFixed(1));
    const lowerGreenGain=Number((green.bottomGreenRgb[1]-red.bottomGreenRgb[1]).toFixed(1));
    const amberMiddleGain=Number((amber.midAmberRgb[0]-
      Math.max(red.midAmberRgb[0],green.midAmberRgb[0])).toFixed(1));
    result.signalVisual.colorContrast={
      upperRedGain,lowerGreenGain,amberMiddleGain};
    assert(upperRedGain>=25&&lowerGreenGain>=40&&amberMiddleGain>=25,
      'Physical bridge signal is not visually distinguishable red vs green: '+
      JSON.stringify(result.signalVisual));
  }
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
