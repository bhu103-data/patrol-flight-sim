/** Hardware-GPU evidence gate for PATROL Alaska. Never accept software GL. */
const software=/swiftshader|llvmpipe|softpipe|lavapipe|swrast|software|microsoft basic render|warp driver|mesa offscreen|virtualbox|virgl|vmware svga/i;
const vendor=/nvidia|geforce|quadro|rtx|gtx|amd|radeon|intel|iris|arc graphics|apple gpu|apple m[1-9]|mali|adreno|qualcomm/i;

export function classifyHardwareRenderer(rendererInfo){
  const renderer=String(rendererInfo?.unmaskedRenderer||'').trim();
  const provider=String(rendererInfo?.unmaskedVendor||'').trim();
  if(!renderer || !provider)
    return {accepted:false,reason:'WebGL unmasked renderer/vendor unavailable; cannot prove hardware GPU'};
  const identity=renderer+' '+provider;
  if(software.test(identity))
    return {accepted:false,reason:'Software or virtual renderer: '+identity};
  if(!vendor.test(identity))
    return {accepted:false,reason:'Unrecognized hardware renderer (fail closed): '+identity};
  return {accepted:true,reason:'Identified hardware GPU: '+identity};
}

export function percentileMs(samples,q){
  if(!Array.isArray(samples)||samples.length<1||!(q>=0&&q<=1)||
     samples.some(v=>!Number.isFinite(v)||v<=0))
    throw new Error('Invalid positive frame interval samples / percentile');
  const sorted=[...samples].sort((a,b)=>a-b);
  return Math.round(sorted[Math.max(0,Math.ceil(q*sorted.length)-1)]*100)/100;
}

/** Build the evidence report only after both baseline/candidate ran twice,
 * with native graphics, warmup, same pose and no page exceptions.
 */
export function assessNativeGpuRuns(runs,{maxP95Ms,maxFirstPlayableMs,maxRegressionPct=10}){
  if(!Array.isArray(runs)||runs.length!==4 ||
     ![maxP95Ms,maxFirstPlayableMs,maxRegressionPct].every(Number.isFinite)||
     maxP95Ms<=0||maxFirstPlayableMs<=0||maxRegressionPct<0||maxRegressionPct>100)
    throw new Error('Require ABBA four-run order and explicit positive performance budgets');
  const labels=runs.map(r=>r.label).join(',');
  if(labels!=='baseline,updated,updated,baseline')
    throw new Error('ABBA order required to limit time/thermal confounding');
  for(const r of runs){
    if(!classifyHardwareRenderer(r.renderer).accepted)
      throw new Error('Unverified hardware GPU in '+r.label);
    if(!Array.isArray(r.intervals)||r.intervals.length<180)
      throw new Error('Insufficient native frame samples in '+r.label);
    if(!Number.isFinite(r.firstPlayableMs)||r.firstPlayableMs<=0||
       r.pageErrors?.length||r.contextLost||r.map!=='alaska'||r.pose!==79)
      throw new Error('Invalid first-load, WebGL state, or fixed floe pose in '+r.label);
  }
  const byLabel=label=>{
    const subset=runs.filter(r=>r.label===label);
    const intervals=subset.flatMap(r=>r.intervals);
    return {runs:subset.length,frames:intervals.length,
      firstPlayableP50Ms:percentileMs(subset.map(r=>r.firstPlayableMs),.5),
      firstPlayableP95Ms:percentileMs(subset.map(r=>r.firstPlayableMs),.95),
      frameP50Ms:percentileMs(intervals,.5),
      frameP95Ms:percentileMs(intervals,.95)};
  };
  const baseline=byLabel('baseline'),updated=byLabel('updated');
  const frameRegressionPct=(updated.frameP95Ms/baseline.frameP95Ms-1)*100;
  const firstLoadRegressionPct=(updated.firstPlayableP95Ms/baseline.firstPlayableP95Ms-1)*100;
  const checks={
    p95Budget:updated.frameP95Ms<=maxP95Ms,
    firstPlayableBudget:updated.firstPlayableP95Ms<=maxFirstPlayableMs,
    frameRegression:frameRegressionPct<=maxRegressionPct,
    firstLoadRegression:firstLoadRegressionPct<=maxRegressionPct
  };
  return {status:Object.values(checks).every(Boolean)?'PASS':'FAIL',
    baselines:baseline,candidate:updated,
    frameRegressionPct:Math.round(frameRegressionPct*100)/100,
    firstLoadRegressionPct:Math.round(firstLoadRegressionPct*100)/100,
    checks,budgets:{maxP95Ms,maxFirstPlayableMs,maxRegressionPct},
    caveat:'Native GPU backed browser RAF presentation cadence, not isolated GPU-timer queries; visual review and physical hardware model still required.'};
}
