// Versioned historical qualification. Never imported into production or substituted for current-nine QA.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
export const HISTORICAL_TEN_COMMIT='0b6da7aa384e5a65c07221eed9301aa4a94cd4ba';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const git=(args)=>{const r=spawnSync('git',args,{cwd:ROOT,encoding:'utf8',maxBuffer:32*1024*1024});assert.equal(r.status,0,`git ${args.join(' ')}: ${r.stderr}`);return r.stdout;};
const sha=b=>createHash('sha256').update(b).digest('hex');
export function assertHistoricalBlob(bytes,oid,label){
 assert.ok(Buffer.isBuffer(bytes),label+' archived bytes required');
 const actual=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
 assert.equal(actual,oid,label+' immutable Git blob');return sha(bytes);
}
export function historicalVerifierControls(){
 const b=Buffer.from('historical source\n'),oid=createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');
 assertHistoricalBlob(b,oid,'positive control');
 assert.throws(()=>assertHistoricalBlob(Buffer.concat([b,Buffer.from('changed')]),oid,'modified control'));
 assert.throws(()=>assertHistoricalBlob(undefined,oid,'missing control'));
 assert.throws(()=>assertHistoricalBlob(b,'0'.repeat(40),'wrong object control'));
 return {positive:1,negative:3};
}
// The frame-only partition starts from a fresh archive, with no integration-created scratch directory.
export const HISTORICAL_FRAME_RECEIPT = "fs.mkdirSync('scratch',{recursive:true});fs.writeFileSync('scratch/historical-frame-result.json',JSON.stringify(r),{flag:'wx'});";
export function runHistoricalTenQualification({phase='all'}={}){
 assert.ok(['all','integration','frame'].includes(phase),'explicit historical qualification phase');
 assert.equal(git(['rev-parse','--show-object-format']).trim(),'sha1','explicit repository object format');
 assert.equal(git(['rev-parse',`${HISTORICAL_TEN_COMMIT}^{commit}`]).trim(),HISTORICAL_TEN_COMMIT,'exact immutable checkpoint required');
 const tree=git(['rev-parse',`${HISTORICAL_TEN_COMMIT}^{tree}`]).trim();
 const gitDir=git(['rev-parse','--path-format=absolute','--git-common-dir']).trim();
 const entries=git(['ls-tree','-rz','--full-tree',HISTORICAL_TEN_COMMIT]).split('\0').filter(Boolean).map(row=>{const [meta,file]=row.split('\t');const[mode,type,oid]=meta.split(' ');assert.equal(type,'blob');assert.ok(['100644','100755'].includes(mode),'ordinary archived file only: '+file);assert.ok(!path.isAbsolute(file)&&!file.split('/').includes('..'));return {file,oid};});
 const base=path.join(ROOT,'scratch/d082-historical-release-runs');fs.mkdirSync(base,{recursive:true});
 const out=fs.mkdtempSync(path.join(base,'run-')),archive=path.join(out,'snapshot.tar'),snapshot=path.join(out,'source');fs.mkdirSync(snapshot);
 git(['archive',HISTORICAL_TEN_COMMIT,'--format=tar','--output='+archive]);
 const extracted=spawnSync('tar',['-xf',archive,'-C',snapshot],{encoding:'utf8'});assert.equal(extracted.status,0,extracted.stderr);
 const verify=()=>entries.map(({file,oid})=>({file,oid,sha256:assertHistoricalBlob(fs.readFileSync(path.join(snapshot,file)),oid,file)}));
 const before=verify();fs.symlinkSync(path.join(ROOT,'node_modules'),path.join(snapshot,'node_modules'),'dir');
 const report={schema:1,phase,qualification:'Historical rejected-ten source only; not current accepted-nine, browser, merge or deployment success.',commit:HISTORICAL_TEN_COMMIT,tree,archiveSha256:sha(fs.readFileSync(archive)),trackedFiles:entries.length,verifierControls:historicalVerifierControls(),commands:[],passed:false};
 fs.writeFileSync(path.join(out,'source-inventory.json'),JSON.stringify(before,null,2)+'\n');
 for(const [id,file]of [['geometry','tools/d082/geometry-test.mjs'],['architecture','tools/unit-d082-architecture-contract.mjs'],['integration','tools/unit-d082.mjs'],['historical-isolation','tools/test-d082-historical-isolation.mjs'],['browser-surface-api','tools/test-d082-browser-surfaces.mjs'],['partition-inventory','tools/unit-partitions.test.mjs'],['ci-integrity','.github/scripts/ci-integrity.test.mjs'],['frame','tools/unit-d082-frame.mjs']].filter(([id])=>phase==='all'||(phase==='frame'?id==='frame':id!=='frame'))){
  const stdout=fs.openSync(path.join(out,id+'.stdout.log'),'w'),stderr=fs.openSync(path.join(out,id+'.stderr.log'),'w');
  const start=new Date().toISOString();let r;
  const args=id==='frame'?['--experimental-strip-types','--input-type=module','-e',`import fs from 'node:fs';import {d082FrameGuards} from './tools/unit-d082-frame.mjs';const r=await d082FrameGuards((ok,n,d)=>console.log(ok?'OK':'NG',n,d??''));${HISTORICAL_FRAME_RECEIPT}process.exitCode=r.failed?1:0;`]:['--experimental-strip-types',file];
  try{r=spawnSync(process.execPath,args,{cwd:snapshot,env:{...process.env,GIT_DIR:gitDir,GIT_WORK_TREE:snapshot},stdio:['ignore',stdout,stderr]});}finally{fs.closeSync(stdout);fs.closeSync(stderr);}
  report.commands.push({id,command:['node',...args],sourceSha256:sha(fs.readFileSync(path.join(snapshot,file))),started:start,finished:new Date().toISOString(),exitCode:r.status,signal:r.signal,error:r.error?.message??null,stdout:id+'.stdout.log',stderr:id+'.stderr.log'});
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
 }
 assert.deepEqual(verify(),before,'all original tracked files preserved through every test');report.sourcePreserved=true;
 report.passed=report.commands.every(r=>r.exitCode===0&&!r.signal&&!r.error);
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
 return {out,...report};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const report=runHistoricalTenQualification();console.log(JSON.stringify(report,null,2));process.exitCode=report.passed?0:1;}
