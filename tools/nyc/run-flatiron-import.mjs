import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {copyFile, mkdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const REQUEST = 'assets/nyc/scenario/flatiron-import-request.json';
const DCP_URL = 'https://www.nyc.gov/assets/planning/download/zip/data-maps/open-data/nyc-3d-model/nyc_3dmodel_mn05.zip';
const OTI_URL = 'https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/BUILDING_view/FeatureServer/0/query?where=BIN%3D1016278&outFields=BIN%2CBASE_BBL%2CDOITT_ID%2CHEIGHT_ROOF%2CGROUND_ELEVATION%2CLAST_EDITED_DATE%2CLAST_STATUS_TYPE&outSR=2263&returnGeometry=true&f=pjson';

export async function runFlatironImport(artifactRoot='artifacts/nyc/flatiron-dcp-import') {
  if (!existsSync(REQUEST)) return {requested:false, passed:false};
  await mkdir(artifactRoot,{recursive:true});
  const tempRoot=join(tmpdir(),'patrol-flatiron-dcp-import');
  const sourceRoot=join(tempRoot,'source');
  const venv=join(tempRoot,'venv');
  const python=join(venv,'bin','python');
  const zipPath=join(tempRoot,'nyc_3dmodel_mn05.zip');
  const otiPath=join(tempRoot,'flatiron-oti.json');
  const reportPath=join(artifactRoot,'flatiron-import-report.json');
  const outputPath='assets/nyc/scenario/flatiron.glb';
  const provenancePath='assets/nyc/scenario/flatiron-provenance.json';
  const snapshotDate=new Date().toISOString().slice(0,10);
  const runnerReport={requested:true,passed:false,source:DCP_URL,snapshotDate};
  try {
    await mkdir(sourceRoot,{recursive:true});
    execFileSync('python3',['-m','venv',venv],{stdio:'inherit',timeout:120000});
    execFileSync(python,['-m','pip','install','--disable-pip-version-check','--upgrade','pip'],{stdio:'inherit',timeout:180000});
    execFileSync(python,['-m','pip','install','--disable-pip-version-check',
      'rhino3dm==8.17.0','shapely==2.1.2','trimesh==4.6.12',
      'numpy==2.2.6','scipy==1.15.3','fast-simplification==0.1.12'
    ],{stdio:'inherit',timeout:300000});
    execFileSync('curl',['--fail','--location','--retry','2','--retry-all-errors',
      '--connect-timeout','30','--max-time','480',DCP_URL,'-o',zipPath],
      {stdio:'inherit',timeout:510000});
    execFileSync('unzip',['-q',zipPath,'-d',sourceRoot],
      {stdio:'inherit',timeout:180000});
    const source3dm=execFileSync('find',[sourceRoot,'-type','f','-iname','*.3dm','-print','-quit'],
      {encoding:'utf8',timeout:30000}).trim();
    if(!source3dm) throw new Error('Official Manhattan CD05 archive contains no Rhino 3DM file');
    execFileSync('curl',['--fail','--location','--retry','2','--retry-all-errors',
      '--connect-timeout','30','--max-time','90',OTI_URL,'-o',otiPath],
      {stdio:'inherit',timeout:120000});
    execFileSync(python,['tools/nyc/import_dcp_flatiron.py',
      '--source',source3dm,
      '--footprint',otiPath,
      '--output',outputPath,
      '--manifest','assets/nyc/scenario-manifest.json',
      '--report',reportPath,
      '--provenance',provenancePath,
      '--snapshot-date',snapshotDate
    ],{stdio:'inherit',timeout:600000});
    await copyFile(outputPath,join(artifactRoot,'flatiron.glb'));
    await copyFile(provenancePath,join(artifactRoot,'flatiron-provenance.json'));
    await copyFile('assets/nyc/scenario-manifest.json',join(artifactRoot,'scenario-manifest.json'));
    runnerReport.passed=true;
    runnerReport.report=JSON.parse(await readFile(reportPath,'utf8'));
    runnerReport.glbBytes=(await readFile(outputPath)).length;
  } catch (error) {
    runnerReport.error=String(error?.message||error);
    runnerReport.exitStatus=error?.status??null;
    if(existsSync(reportPath)){
      try{runnerReport.report=JSON.parse(await readFile(reportPath,'utf8'));}catch{}
    }
  }
  await writeFile(join(artifactRoot,'flatiron-runner-report.json'),
    JSON.stringify(runnerReport,null,2)+'\n');
  console.log('[PATROL QA] official Flatiron DCP import:',JSON.stringify({
    requested:runnerReport.requested,passed:runnerReport.passed,
    error:runnerReport.error,glbBytes:runnerReport.glbBytes
  }));
  return runnerReport;
}
