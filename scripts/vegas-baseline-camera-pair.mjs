// QA-only world-space camera pose alignment for USGS baseline comparison.
// Patches the TEMPORARY pinned-main worktree, never shipped game geometry.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const basePath='/tmp/patrol-vegas-baseline/index.html';
const candidatePath='index.html';
const selections=[
  {name:'Strip Street View',selector:"\\{name:'Strip Street View'\\}"},
  {name:'Bellagio',selector:"VEGAS_SITES\\.bellagio"},
  {name:'The Venetian',selector:"VEGAS_SITES\\.venetian"}
];
function pose(html,entry){
  const re=new RegExp("\\{site:"+entry.selector+",\\s*x:([-.\\d]+),z:([-.\\d]+),height:([-.\\d]+),bearing:([-.\\d]+),radius:([-.\\d]+),rise:([-.\\d]+),","g");
  const matches=[...html.matchAll(re)];
  if(matches.length!==1)throw Error('Expected one scenic pose for '+entry.name+'; found '+matches.length);
  return {source:matches[0][0],values:matches[0].slice(1,7).map(Number)};
}
let [baseline,candidate]=await Promise.all([readFile(basePath,'utf8'),readFile(candidatePath,'utf8')]);
const before={},after={},expected={};
for(const entry of selections){
  const old=pose(baseline,entry),now=pose(candidate,entry);
  before[entry.name]=old.values;
  expected[entry.name]=now.values;
  if(entry.name==='Strip Street View'){
    if(old.values.join(',')!=='-26,-171.5,1.5,169,10,2')throw Error('Original main camera moved: do not silently rewrite provenance');
    if(now.values.join(',')!=='-23,-171.5,1.5,152,10,2')throw Error('Candidate camera differs from approved #149 correction');
    baseline=baseline.replace(old.source,now.source);
  }else if(old.values.join(',')!==now.values.join(',')){
    throw Error('Other scenic camera pose changed: '+entry.name);
  }
}
for(const entry of selections){
  after[entry.name]=pose(baseline,entry).values;
  if(after[entry.name].join(',')!==expected[entry.name].join(','))
    throw Error('World-space camera A/B mismatch: '+entry.name);
}
await writeFile(basePath,baseline);
await mkdir('artifacts/vegas',{recursive:true});
const report={
  status:'passed',baselineSha:'cc56be0aa0cb41c23a7cd97ea49defeb65b24be1',
  qaOnlyBaselineCameraOverride:true,
  names:selections.map(e=>e.name),
  before,after,candidate:expected,
  note:'This sync only changes the detached baseline HTML camera pose; USGS terrain and all physical game files are untouched.'
};
await writeFile('artifacts/vegas/qa-camera-pairing.json',JSON.stringify(report,null,2)+'\n');
console.log('Vegas world-space camera pairing:',JSON.stringify(report));
