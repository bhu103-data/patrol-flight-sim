// Compare two recorded Vegas QA runs, without confusing SwiftShader FPS
// with hardware GPU time. Both captures use the exact same camera settings.
import {readFile,writeFile} from 'node:fs/promises';
const root='artifacts/vegas';
const read=async name=>JSON.parse(await readFile(root+'/'+name+'/vegas-core-report.json','utf8'));
const [candidate,baseline]=await Promise.all([read('candidate'),read('baseline-6d50bfd')]);
const required=['vegas-core-near-noon.png','vegas-core-far-noon.png',
 'vegas-core-near-night.png','vegas-core-far-night.png'];
for(const report of [candidate,baseline]){
 if(report.status!=='passed')throw Error('Cannot compare failed scene: '+report.qaTag);
 if(required.some(name=>!report.screenshots.includes(name)))
   throw Error('Missing fixed camera capture: '+report.qaTag);
}
const metrics={
 loadMs:{baseline:baseline.loadMs,candidate:candidate.loadMs},
 meanFrameIntervalMs:{baseline:baseline.frameSampling.meanFrameIntervalMs,
   candidate:candidate.frameSampling.meanFrameIntervalMs},
 approxSoftwareFPS:{baseline:baseline.frameSampling.approxFPS,
   candidate:candidate.frameSampling.approxFPS}
};
metrics.loadMs.changePercent=100*(metrics.loadMs.candidate/metrics.loadMs.baseline-1);
metrics.meanFrameIntervalMs.changePercent=
 100*(metrics.meanFrameIntervalMs.candidate/metrics.meanFrameIntervalMs.baseline-1);
metrics.approxSoftwareFPS.changePercent=
 100*(metrics.approxSoftwareFPS.candidate/metrics.approxSoftwareFPS.baseline-1);
const result={baseCommit:'6d50bfda4b2d3837e550751ede49b200b140bc72',
 comparison:'identical screenshot camera settings, software SwiftShader 1280x720',
 metrics,notMeasured:'GPU frame time; photogrammetric accuracy; 30 FPS hardware target',
 sample:{candidate: candidate.shots,baseline:baseline.shots}};
await writeFile(root+'/vegas-baseline-comparison.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(metrics,null,2));
