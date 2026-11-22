// Evidence-only same-scene Vegas screenshots: compare the pinned main baseline
// with the USGS candidate. PNG differences are NOT a photo-realism score.
// Run after both PATROL_QA_TAG=baseline and candidate captures, with pngjs.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {PNG} from 'pngjs';

const root='artifacts/vegas';
const readJson=async name=>JSON.parse(await readFile(root+'/'+name+'/vegas-core-report.json','utf8'));
const [baseline,candidate]=await Promise.all([readJson('baseline'),readJson('candidate')]);
if(baseline.status!=='passed'||candidate.status!=='passed')
  throw new Error('Cannot compare failed or incomplete Vegas captures');
if(baseline.graphicsProfile!==candidate.graphicsProfile||
  baseline.browserChannel!==candidate.browserChannel)
  throw new Error('Baseline and candidate graphics profiles differ');
// PNG sizes alone do not prove equivalent WebGL framebuffer resolution.
if(baseline.qaFixedSceneScale!==0.55||candidate.qaFixedSceneScale!==0.55)
  throw new Error('Vegas A/B must use the same QA-only 55% scene scale');

const pairing=JSON.parse(await readFile(root+'/qa-camera-pairing.json','utf8'));
if(pairing.status!=='passed'||!pairing.qaOnlyBaselineCameraOverride)
  throw new Error('World-space camera baseline alignment not verified');
for(const name of ['Strip Street View','Bellagio','The Venetian']){
  if(pairing.after[name]?.join(',')!==pairing.candidate[name]?.join(','))
    throw new Error('World-space camera pose drift for '+name);
}
const names=candidate.screenshots;
if(names.length!==6||baseline.screenshots.length!==6||
  names.some((v,i)=>v!==baseline.screenshots[i]))
  throw new Error('Expected the exact same six Vegas named camera captures');
const matches=[];
for(const name of names){
  const bShot=baseline.shots.find(s=>s.shotName===name);
  const cShot=candidate.shots.find(s=>s.shotName===name);
  if(!bShot||!cShot||bShot.target!==cShot.target||
    bShot.zoom!==cShot.zoom||bShot.angle!==cShot.angle)
    throw new Error('Camera mismatch: '+name);
  if(!Array.isArray(bShot.canvasSize)||!Array.isArray(cShot.canvasSize)||
    bShot.canvasSize.join(',')!=='704,396'||
    cShot.canvasSize.join(',')!=='704,396')
    throw new Error('Internal WebGL framebuffer mismatch for '+name+
      ': baseline='+JSON.stringify(bShot.canvasSize)+
      ' candidate='+JSON.stringify(cShot.canvasSize));
  const [ab,ac]=await Promise.all([
    readFile(root+'/baseline/'+name),readFile(root+'/candidate/'+name)
  ]);
  const b=PNG.sync.read(ab),c=PNG.sync.read(ac);
  if(b.width!==c.width||b.height!==c.height)
    throw new Error('Screenshot dimension mismatch: '+name);
  const diff=new PNG({width:c.width,height:c.height});
  let samples=0,delta=0,changed=0;
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
    const k=(y*c.width+x)*4;
    const dr=Math.abs(b.data[k]-c.data[k]);
    const dg=Math.abs(b.data[k+1]-c.data[k+1]);
    const db=Math.abs(b.data[k+2]-c.data[k+2]);
    const avg=(dr+dg+db)/3;
    diff.data[k]=Math.min(255,Math.round(avg*3));
    diff.data[k+1]=Math.min(255,Math.round(avg));
    diff.data[k+2]=0;
    diff.data[k+3]=255;
    if((x&3)===0&&(y&3)===0){
      samples++;delta+=avg;if(avg>12)changed++;
    }
  }
  const diffName=name.replace(/\.png$/, '-difference.png');
  await writeFile(root+'/'+diffName,PNG.sync.write(diff));
  matches.push({name,camera:cShot.target,zoom:cShot.zoom??null,
    pairedCanvasSize:cShot.canvasSize,
    meanRgbDelta255:Math.round(delta/samples*100)/100,
    fractionChangedAbove12:Math.round(changed/samples*10000)/10000,
    diffName});
}
const baseMs=baseline.frameSampling?.meanFrameIntervalMs;
const candidateMs=candidate.frameSampling?.meanFrameIntervalMs;
const report={
  scope:'Vegas fixed-camera software-WebGL2 visual comparison; NOT a photorealism/GPU FPS grade',
  baselineSha:process.env.PATROL_VEGAS_BASELINE_SHA||'unknown',
  cameraWorldSpaceVerified:true,
  rendererCanvasSizeVerified:true,
  qaFixedSceneScale:0.55,
  scenicPosePairing:pairing.after,
  candidateSha:process.env.GITHUB_SHA||'unknown',
  graphicsProfile:candidate.graphicsProfile,
  browserChannel:candidate.browserChannel,
  baselineLoadMs:baseline.loadMs,candidateLoadMs:candidate.loadMs,
  baselineMeanFrameIntervalMs:baseMs,candidateMeanFrameIntervalMs:candidateMs,
  candidateOverBaselineFrameIntervalRatio:baseMs>0?candidateMs/baseMs:null,
  confounds:'QA-only fixed 55% internal scene framebuffer bypasses production adaptive resolution for both captures. Sequential browser loads, traffic, clouds, LOD, software warmup and clock phase still differ. Pixel deltas establish change, not visual fidelity or native GPU FPS.',
  captures:matches
};
await mkdir(root,{recursive:true});
await writeFile(root+'/ab-compare.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:'passed',captures:matches.length,
  baselineLoadMs:report.baselineLoadMs,
  candidateLoadMs:report.candidateLoadMs,
  frameIntervalRatio:report.candidateOverBaselineFrameIntervalRatio},null,2));
