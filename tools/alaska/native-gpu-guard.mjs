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
  if(!vendor.test(renderer))
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
    if(!Array.isArray(r.intervals)||r.intervals.length<220 ||
       r.intervals.some(v=>!Number.isFinite(v)||v<=0))
      throw new Error('Insufficient or invalid native frame samples in '+r.label);
    if(!Number.isFinite(r.firstPlayableMs)||r.firstPlayableMs<=0||
       !Array.isArray(r.pageErrors)||r.pageErrors.length||
       r.contextLost!==false||r.map!=='alaska'||r.pose!==79)
      throw new Error('Invalid first-load, WebGL state, or fixed floe pose in '+r.label);
  }
  // A change from integrated Intel graphics to a discrete NVIDIA GPU
  // halfway through ABBA would make a speedup appear to come from this PR.
  // Reject mixed adapters, even if both devices are physical hardware.
  const deviceKey=r=>[r.renderer.unmaskedRenderer,r.renderer.unmaskedVendor]
    .map(s=>String(s).trim().replace(/\s+/g,' ').toLowerCase()).join(' | ');
  const adapters=new Set(runs.map(deviceKey));
  if(adapters.size!==1)
    throw new Error('Mixed GPU renderer/vendor identities across ABBA runs');

  const perRun=r=>({
    label:r.label,firstPlayableMs:r.firstPlayableMs,
    frameP95Ms:percentileMs(r.intervals,.95)
  });
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
  const all=runs.map(perRun), candidateRuns=all.filter(r=>r.label==='updated');
  const baselineRuns=all.filter(r=>r.label==='baseline');
  const candidateWorstFrameMs=Math.max(...candidateRuns.map(r=>r.frameP95Ms));
  const baselineBestFrameMs=Math.min(...baselineRuns.map(r=>r.frameP95Ms));
  const candidateWorstFirstPlayableMs=Math.max(...candidateRuns.map(r=>r.firstPlayableMs));
  const baselineBestFirstPlayableMs=Math.min(...baselineRuns.map(r=>r.firstPlayableMs));
  const worstFrameRegressionPct=(candidateWorstFrameMs/baselineBestFrameMs-1)*100;
  const worstFirstLoadRegressionPct=
    (candidateWorstFirstPlayableMs/baselineBestFirstPlayableMs-1)*100;
  // Per-run checks prevent the combined 440-frame P95 from masking one
  // unusually slow candidate run and fail closed on run-to-run variability.
  const checks={
    p95Budget:candidateRuns.every(r=>r.frameP95Ms<=maxP95Ms),
    firstPlayableBudget:candidateRuns.every(r=>r.firstPlayableMs<=maxFirstPlayableMs),
    frameRegression:frameRegressionPct<=maxRegressionPct &&
      worstFrameRegressionPct<=maxRegressionPct,
    firstLoadRegression:firstLoadRegressionPct<=maxRegressionPct &&
      worstFirstLoadRegressionPct<=maxRegressionPct
  };
  return {status:Object.values(checks).every(Boolean)?'PASS':'FAIL',
    baselines:baseline,candidate:updated,
    frameRegressionPct:Math.round(frameRegressionPct*100)/100,
    firstLoadRegressionPct:Math.round(firstLoadRegressionPct*100)/100,
    worstFrameRegressionPct:Math.round(worstFrameRegressionPct*100)/100,
    worstFirstLoadRegressionPct:Math.round(worstFirstLoadRegressionPct*100)/100,
    perRun:all,gpuIdentity:[...adapters][0],
    checks,budgets:{maxP95Ms,maxFirstPlayableMs,maxRegressionPct},
    caveat:'Native GPU backed browser RAF presentation cadence, not isolated GPU-timer queries; visual review and physical hardware model still required.'};
}
